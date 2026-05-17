import { getIntegrationKey } from "./integration-keys";
import { logger } from "./logger";

/**
 * Threads (Meta) client. Auth = long-lived user access token (60 days,
 * obtained via the Meta OAuth flow at developers.facebook.com → Threads
 * Graph API → Tools → Access Token Generator). Token + numeric user id
 * are stored in the Integrations panel.
 *
 * Posting is a 2-step flow:
 *   1. POST /{user_id}/threads (create media container)
 *   2. POST /{user_id}/threads_publish (publish it)
 * 500 char limit. Text-only posts use media_type=TEXT.
 */

const HOST = "https://graph.threads.net/v1.0";

interface ThreadsCreds {
  userId: string;
  accessToken: string;
}

async function loadCreds(): Promise<ThreadsCreds | null> {
  const [userId, accessToken] = await Promise.all([
    getIntegrationKey("THREADS_USER_ID"),
    getIntegrationKey("THREADS_ACCESS_TOKEN"),
  ]);
  if (!userId || !accessToken) return null;
  return { userId, accessToken };
}

export async function isThreadsConfigured(): Promise<boolean> {
  return (await loadCreds()) !== null;
}

export interface ThreadsPostInput {
  text: string;
}
export interface ThreadsPostResult {
  ok: boolean;
  threadId?: string;
  url?: string;
  error?: string;
  rateLimited?: boolean;
}

export async function postThreadsPost(input: ThreadsPostInput): Promise<ThreadsPostResult> {
  const creds = await loadCreds();
  if (!creds) return { ok: false, error: "Threads not configured" };
  const text = input.text.trim();
  if (!text) return { ok: false, error: "Empty post" };
  if (text.length > 500) return { ok: false, error: `Post too long (${text.length}/500)` };

  try {
    // Step 1: create container.
    const createUrl = new URL(`${HOST}/${creds.userId}/threads`);
    createUrl.searchParams.set("media_type", "TEXT");
    createUrl.searchParams.set("text", text);
    createUrl.searchParams.set("access_token", creds.accessToken);
    const c = await fetch(createUrl.toString(), {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    if (c.status === 429) return { ok: false, rateLimited: true, error: "Rate limited" };
    if (!c.ok) {
      const txt = await c.text().catch(() => "");
      return { ok: false, error: `Create container HTTP ${c.status}: ${txt.slice(0, 200)}` };
    }
    const cj = (await c.json()) as { id?: string };
    if (!cj.id) return { ok: false, error: "No container id returned" };

    // Step 2: publish.
    const pubUrl = new URL(`${HOST}/${creds.userId}/threads_publish`);
    pubUrl.searchParams.set("creation_id", cj.id);
    pubUrl.searchParams.set("access_token", creds.accessToken);
    const p = await fetch(pubUrl.toString(), {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    if (p.status === 429) return { ok: false, rateLimited: true, error: "Rate limited (publish)" };
    if (!p.ok) {
      const txt = await p.text().catch(() => "");
      return { ok: false, error: `Publish HTTP ${p.status}: ${txt.slice(0, 200)}` };
    }
    const pj = (await p.json()) as { id?: string };
    if (!pj.id) return { ok: false, error: "No thread id returned" };

    // Best-effort permalink fetch (may not be ready immediately).
    let url: string | undefined;
    try {
      const permUrl = new URL(`${HOST}/${pj.id}`);
      permUrl.searchParams.set("fields", "permalink");
      permUrl.searchParams.set("access_token", creds.accessToken);
      const perm = await fetch(permUrl.toString(), { signal: AbortSignal.timeout(8_000) });
      if (perm.ok) {
        const pdj = (await perm.json()) as { permalink?: string };
        url = pdj.permalink;
      }
    } catch {
      /* permalink lookup is non-fatal */
    }

    return { ok: true, threadId: pj.id, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyThreadsCredentials(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const creds = await loadCreds();
  if (!creds) return { ok: false, error: "Threads not configured" };
  try {
    const url = new URL(`${HOST}/${creds.userId}`);
    url.searchParams.set("fields", "username,id");
    url.searchParams.set("access_token", creds.accessToken);
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
    }
    const j = (await r.json()) as { username?: string };
    return { ok: true, username: j.username };
  } catch (err) {
    logger.warn({ err }, "Threads verify threw");
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
