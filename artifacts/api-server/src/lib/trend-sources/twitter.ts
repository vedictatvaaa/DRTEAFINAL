import type { TrendSourceRow } from "../db";
import { deriveHashtags, type AdapterResult, type RawTrendItem } from "./index";

const TIMEOUT_MS = 12_000;

interface XSearchResp {
  data?: Array<{ id: string; text: string; created_at?: string; entities?: { hashtags?: Array<{ tag: string }> } }>;
}

// SCAFFOLD ONLY — disabled by default. To activate:
//   1. Add TWITTER_BEARER_TOKEN to environment secrets (X API v2, ~$100/mo).
//   2. Set the source's `enabled` to true in admin.
// If the bearer token is missing the adapter returns empty silently.
// source.url stores the X search query (e.g. "tea OR matcha lang:en").
export async function fetchTwitter(source: TrendSourceRow): Promise<AdapterResult> {
  const token = process.env["TWITTER_BEARER_TOKEN"];
  if (!token) return { items: [] };
  const q = source.url?.trim() || "tea";
  const u = new URL("https://api.twitter.com/2/tweets/search/recent");
  u.searchParams.set("query", q);
  u.searchParams.set("max_results", "50");
  u.searchParams.set("tweet.fields", "created_at,entities");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as XSearchResp;
    const items: RawTrendItem[] = [];
    for (const it of j.data ?? []) {
      const text = it.text?.trim() ?? "";
      if (!text) continue;
      const xtags = (it.entities?.hashtags ?? []).map((h) => `#${h.tag.toLowerCase()}`).slice(0, 8);
      items.push({
        topic: text.slice(0, 240),
        url: `https://twitter.com/i/web/status/${it.id}`,
        tags: xtags,
        hashtags: xtags.length ? xtags : deriveHashtags(text, undefined, undefined),
        publishedAt: it.created_at ? new Date(it.created_at) : undefined,
      });
    }
    return { items };
  } finally {
    clearTimeout(t);
  }
}
