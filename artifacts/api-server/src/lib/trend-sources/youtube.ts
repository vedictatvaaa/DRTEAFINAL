import type { TrendSourceRow } from "../db";
import { deriveHashtags, type AdapterResult, type RawTrendItem } from "./index";

const TIMEOUT_MS = 12_000;

interface YtSearchResp {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      tags?: string[];
    };
  }>;
}

// YouTube Data API v3 search.list endpoint, ordered by viewCount in last 7 days.
// Only runs if YOUTUBE_API_KEY is set; otherwise returns an empty result.
// source.url stores the search query (e.g. "tea brewing", "matcha recipe").
export async function fetchYouTube(source: TrendSourceRow): Promise<AdapterResult> {
  const key = process.env["YOUTUBE_API_KEY"];
  if (!key) return { items: [] };
  const q = source.url?.trim() || "tea";
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  u.searchParams.set("part", "snippet");
  u.searchParams.set("type", "video");
  u.searchParams.set("order", "viewCount");
  u.searchParams.set("publishedAfter", sevenDaysAgo);
  u.searchParams.set("maxResults", "25");
  u.searchParams.set("q", q);
  u.searchParams.set("key", key);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(u.toString(), { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as YtSearchResp;
    const items: RawTrendItem[] = [];
    for (const it of j.items ?? []) {
      const title = it.snippet?.title?.trim() ?? "";
      if (!title) continue;
      const vid = it.id?.videoId;
      const desc = it.snippet?.description?.slice(0, 600) ?? "";
      const tags = it.snippet?.tags?.slice(0, 6) ?? [];
      items.push({
        topic: title.slice(0, 240),
        summary: desc,
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : "",
        tags,
        hashtags: deriveHashtags(title, desc, tags),
        publishedAt: it.snippet?.publishedAt ? new Date(it.snippet.publishedAt) : undefined,
      });
    }
    return { items };
  } finally {
    clearTimeout(t);
  }
}
