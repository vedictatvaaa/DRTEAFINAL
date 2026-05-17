import { getIntegrationKey } from "./integration-keys";
import { logger } from "./logger";

/**
 * Bluesky (AT Protocol) client. Auth = `createSession` with the user's
 * handle + app-password (never their main password — generated at
 * https://bsky.app/settings/app-passwords). The returned `accessJwt` is
 * good for ~2 hours; we cache it in memory and refresh on 401.
 *
 * Posting = `com.atproto.repo.createRecord` with collection
 * `app.bsky.feed.post`. 300 char limit. We don't build facets (link/tag
 * objects) — Bluesky clients auto-parse URLs and hashtags from the text.
 */

const BSKY_HOST = "https://bsky.social";

interface BskySession {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  handle: string;
  expiresAt: number; // ms epoch
}

let cached: BskySession | null = null;

interface BskyCreds {
  handle: string;
  appPassword: string;
}

async function loadCreds(): Promise<BskyCreds | null> {
  const [handle, appPassword] = await Promise.all([
    getIntegrationKey("BLUESKY_HANDLE"),
    getIntegrationKey("BLUESKY_APP_PASSWORD"),
  ]);
  if (!handle || !appPassword) return null;
  return { handle: handle.replace(/^@/, ""), appPassword };
}

export async function isBlueskyConfigured(): Promise<boolean> {
  return (await loadCreds()) !== null;
}

async function createSession(force = false): Promise<BskySession | null> {
  if (!force && cached && Date.now() < cached.expiresAt - 60_000) return cached;
  const creds = await loadCreds();
  if (!creds) return null;
  try {
    const r = await fetch(`${BSKY_HOST}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: creds.handle, password: creds.appPassword }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      logger.warn({ status: r.status, body: txt.slice(0, 200) }, "Bluesky createSession failed");
      cached = null;
      return null;
    }
    const j = (await r.json()) as { accessJwt: string; refreshJwt: string; did: string; handle: string };
    cached = {
      accessJwt: j.accessJwt,
      refreshJwt: j.refreshJwt,
      did: j.did,
      handle: j.handle,
      // Bluesky JWTs last ~2h; conservatively cache for 90 minutes.
      expiresAt: Date.now() + 90 * 60 * 1000,
    };
    return cached;
  } catch (err) {
    logger.warn({ err }, "Bluesky createSession threw");
    cached = null;
    return null;
  }
}

export interface BskyPostInput {
  text: string;
}
export interface BskyPostResult {
  ok: boolean;
  uri?: string;
  cid?: string;
  url?: string;
  error?: string;
  rateLimited?: boolean;
}

/**
 * Walk the text and emit AT-Proto `facets` for every URL and #hashtag.
 * Without facets, Bluesky shows them as plain text — no clickable link.
 * Byte indices (UTF-8) are required, not char indices.
 */
function buildFacets(text: string): Array<Record<string, unknown>> {
  const enc = new TextEncoder();
  const facets: Array<Record<string, unknown>> = [];
  // URLs (very loose match — catches https?://...)
  const urlRe = /https?:\/\/[^\s)]+/g;
  for (const m of text.matchAll(urlRe)) {
    const start = enc.encode(text.slice(0, m.index!)).length;
    const end = start + enc.encode(m[0]).length;
    facets.push({
      index: { byteStart: start, byteEnd: end },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  // #hashtags (alphanumeric + underscore, no leading digit)
  const tagRe = /(^|\s)#([A-Za-z][\w]*)/g;
  for (const m of text.matchAll(tagRe)) {
    const tagStart = m.index! + m[1].length;
    const start = enc.encode(text.slice(0, tagStart)).length;
    const end = start + enc.encode(`#${m[2]}`).length;
    facets.push({
      index: { byteStart: start, byteEnd: end },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[2] }],
    });
  }
  return facets;
}

export async function postBlueskyPost(input: BskyPostInput): Promise<BskyPostResult> {
  let session = await createSession();
  if (!session) return { ok: false, error: "Bluesky not configured" };
  const text = input.text.trim();
  if (!text) return { ok: false, error: "Empty post" };
  if (text.length > 300) return { ok: false, error: `Post too long (${text.length}/300)` };

  const body = {
    repo: session.did,
    collection: "app.bsky.feed.post",
    record: {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
      facets: buildFacets(text),
      langs: ["en"],
    },
  };

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      const r = await fetch(`${BSKY_HOST}/xrpc/com.atproto.repo.createRecord`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 401 && attempt === 1) {
        // Stale JWT — refresh and retry once.
        session = (await createSession(true))!;
        if (!session) return { ok: false, error: "Bluesky re-auth failed" };
        continue;
      }
      if (r.status === 429) {
        return { ok: false, rateLimited: true, error: "Rate limited" };
      }
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        return { ok: false, error: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
      }
      const j = (await r.json()) as { uri: string; cid: string };
      // uri is "at://did:plc:.../app.bsky.feed.post/<rkey>" — convert to web URL.
      const rkey = j.uri.split("/").pop();
      const url = `https://bsky.app/profile/${session.handle}/post/${rkey}`;
      return { ok: true, uri: j.uri, cid: j.cid, url };
    } catch (err) {
      if (attempt < 2) continue;
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { ok: false, error: "Unreachable" };
}

export async function verifyBlueskyCredentials(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const s = await createSession(true);
  if (!s) return { ok: false, error: "Could not authenticate — check handle and app password" };
  return { ok: true, username: s.handle };
}
