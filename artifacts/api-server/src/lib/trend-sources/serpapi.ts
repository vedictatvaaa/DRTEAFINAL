import type { TrendSourceRow } from "../db";
import { deriveHashtags, type AdapterResult, type RawTrendItem } from "./index";

const TIMEOUT_MS = 15_000;

interface SerpNewsResp {
  news_results?: Array<{
    title?: string;
    snippet?: string;
    link?: string;
    date?: string;
    source?: string;
  }>;
}

// SCAFFOLD ONLY — disabled by default. To activate:
//   1. Add SERPAPI_KEY to environment secrets.
//   2. Set the source's `enabled` to true in admin.
// If SERPAPI_KEY is missing the adapter returns empty silently.
// source.url stores the Google News query (e.g. "indian tea trends").
export async function fetchSerpApi(source: TrendSourceRow): Promise<AdapterResult> {
  const key = process.env["SERPAPI_KEY"];
  if (!key) return { items: [] };
  const q = source.url?.trim() || "indian tea";
  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("engine", "google_news");
  u.searchParams.set("q", q);
  u.searchParams.set("api_key", key);
  u.searchParams.set("num", "30");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(u.toString(), { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as SerpNewsResp;
    const items: RawTrendItem[] = [];
    for (const it of j.news_results ?? []) {
      const title = it.title?.trim() ?? "";
      if (!title) continue;
      const summary = it.snippet?.slice(0, 600) ?? "";
      const tags = it.source ? [it.source] : [];
      items.push({
        topic: title.slice(0, 240),
        summary,
        url: it.link ?? "",
        tags,
        hashtags: deriveHashtags(title, summary, tags),
        publishedAt: it.date ? new Date(it.date) : undefined,
      });
    }
    return { items };
  } finally {
    clearTimeout(t);
  }
}
