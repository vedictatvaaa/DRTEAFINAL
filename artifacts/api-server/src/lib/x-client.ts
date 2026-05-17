import { createHmac, randomBytes } from "node:crypto";
import { getIntegrationKey } from "./integration-keys";
import { logger } from "./logger";

interface XCreds {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}

async function loadCreds(): Promise<XCreds | null> {
  const [consumerKey, consumerSecret, token, tokenSecret] = await Promise.all([
    getIntegrationKey("X_API_KEY"),
    getIntegrationKey("X_API_SECRET"),
    getIntegrationKey("X_ACCESS_TOKEN"),
    getIntegrationKey("X_ACCESS_TOKEN_SECRET"),
  ]);
  if (!consumerKey || !consumerSecret || !token || !tokenSecret) return null;
  return { consumerKey, consumerSecret, token, tokenSecret };
}

/**
 * Minimal X (Twitter) API v2 client with OAuth 1.0a user-context request
 * signing — the only auth flavour that lets you POST tweets on behalf of a
 * connected account. Pure node, no SDK.
 *
 * Required env: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *
 * Free tier limits (May 2025): 500 writes / month / app + ~17 tweets / 24h.
 * The posting cron throttles itself well under these.
 */

export interface XPostResult {
  ok: boolean;
  tweetId?: string;
  url?: string;
  error?: string;
  rateLimited?: boolean;
}

export async function isXConfigured(): Promise<boolean> {
  return (await loadCreds()) !== null;
}

function pctEncode(s: string): string {
  // RFC 3986 — encodeURIComponent + a few extras X expects.
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

interface OAuthParams {
  oauth_consumer_key: string;
  oauth_nonce: string;
  oauth_signature_method: "HMAC-SHA1";
  oauth_timestamp: string;
  oauth_token: string;
  oauth_version: "1.0";
  oauth_signature?: string;
}

function buildAuthHeader(
  method: "POST" | "GET",
  url: string,
  bodyParams: Record<string, string>,
  creds: XCreds,
): string {
  const oauth: OAuthParams = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.token,
    oauth_version: "1.0",
  };

  // Signature base = method & encoded URL & encoded sorted params (oauth + body if form-encoded)
  // For JSON bodies we MUST NOT include the body in the signature base.
  const allParams: Record<string, string> = { ...oauth, ...bodyParams };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map((k) => `${pctEncode(k)}=${pctEncode(allParams[k]!)}`)
    .join("&");
  const baseString = [method, pctEncode(url), pctEncode(paramString)].join("&");
  const signingKey = `${pctEncode(creds.consumerSecret)}&${pctEncode(creds.tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  oauth.oauth_signature = signature;

  return (
    "OAuth " +
    Object.entries(oauth)
      .map(([k, v]) => `${pctEncode(k)}="${pctEncode(String(v))}"`)
      .join(", ")
  );
}

export interface PostTweetInput {
  text: string;
  /** Optional X media IDs (uploaded via v1.1 /media/upload — not used yet). */
  mediaIds?: string[];
  /** Optional reply context. */
  inReplyToTweetId?: string;
}

/**
 * POST a tweet via /2/tweets. JSON body, OAuth 1.0a signed (body NOT in
 * signature base — that's correct per X docs for application/json requests).
 */
export async function postTweet(input: PostTweetInput): Promise<XPostResult> {
  const creds = await loadCreds();
  if (!creds) {
    return { ok: false, error: "X API not configured" };
  }
  const text = input.text.trim();
  if (!text) return { ok: false, error: "Empty tweet" };
  if (text.length > 280) return { ok: false, error: `Tweet too long (${text.length}/280)` };

  const url = "https://api.twitter.com/2/tweets";
  const body: Record<string, unknown> = { text };
  if (input.mediaIds && input.mediaIds.length) {
    body["media"] = { media_ids: input.mediaIds };
  }
  if (input.inReplyToTweetId) {
    body["reply"] = { in_reply_to_tweet_id: input.inReplyToTweetId };
  }

  const auth = buildAuthHeader("POST", url, {}, creds);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        "User-Agent": "DrTea-AutoTweet/1.0",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await r.json().catch(() => ({}))) as {
      data?: { id?: string; text?: string };
      errors?: Array<{ message?: string; detail?: string }>;
      title?: string;
      detail?: string;
    };
    if (!r.ok) {
      const msg =
        j.detail ??
        j.title ??
        j.errors?.[0]?.detail ??
        j.errors?.[0]?.message ??
        `HTTP ${r.status}`;
      logger.warn({ status: r.status, msg }, "X postTweet failed");
      return {
        ok: false,
        error: msg,
        rateLimited: r.status === 429,
      };
    }
    const id = j.data?.id;
    if (!id) return { ok: false, error: "X returned no tweet id" };
    return {
      ok: true,
      tweetId: id,
      url: `https://x.com/i/status/${id}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verify credentials by hitting /2/users/me — used by admin "test" button. */
export async function verifyXCredentials(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const creds = await loadCreds();
  if (!creds) return { ok: false, error: "X API not configured" };
  const url = "https://api.twitter.com/2/users/me";
  const auth = buildAuthHeader("GET", url, {}, creds);
  try {
    const r = await fetch(url, {
      headers: { Authorization: auth, "User-Agent": "DrTea-AutoTweet/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json().catch(() => ({}))) as {
      data?: { username?: string };
      detail?: string;
    };
    if (!r.ok) return { ok: false, error: j.detail ?? `HTTP ${r.status}` };
    return { ok: true, username: j.data?.username };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
