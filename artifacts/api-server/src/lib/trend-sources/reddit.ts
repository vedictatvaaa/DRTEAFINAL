import type { TrendSourceRow } from "../db";
import { deriveHashtags, type AdapterResult, type RawTrendItem } from "./index";

const USER_AGENT = "DrTeaTrendBot/1.0 (+https://drtea.in)";
const TIMEOUT_MS = 12_000;

interface RedditChild {
  data: {
    title?: string;
    selftext?: string;
    permalink?: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    link_flair_text?: string;
    over_18?: boolean;
  };
}
interface RedditListing {
  data: { children: RedditChild[] };
}

function passes(text: string, filter: string): boolean {
  const tokens = filter.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const hay = text.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

export async function fetchReddit(source: TrendSourceRow): Promise<AdapterResult> {
  // source.url stores the subreddit name, optionally with a sort/period suffix:
  //   "tea"                → /r/tea/top.json?t=week
  //   "tea:hot"            → /r/tea/hot.json
  //   "Indianfood:top:day" → /r/Indianfood/top.json?t=day
  if (!source.url) return { items: [] };
  const [sub, sort = "top", period = "week"] = source.url.split(":");
  if (!sub) return { items: [] };
  const url = sort === "hot" || sort === "new"
    ? `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.json?limit=40`
    : `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.json?t=${encodeURIComponent(period)}&limit=40`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as RedditListing;
    const out: RawTrendItem[] = [];
    for (const c of j.data?.children ?? []) {
      const d = c.data;
      const title = d.title?.trim() ?? "";
      if (!title || d.over_18) continue;
      const summary = d.selftext?.slice(0, 500) ?? "";
      if (!passes(`${title} ${summary}`, source.filterKeywords)) continue;
      const flair = d.link_flair_text ?? "";
      const tags = [flair, `r/${sub}`].filter(Boolean) as string[];
      out.push({
        topic: title.slice(0, 240),
        summary,
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : "",
        tags,
        hashtags: deriveHashtags(title, summary, tags),
        popularity: d.score ?? 0,
        publishedAt: d.created_utc ? new Date(d.created_utc * 1000) : undefined,
      });
    }
    return { items: out };
  } finally {
    clearTimeout(t);
  }
}
