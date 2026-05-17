import type { TrendSourceKind, TrendSourceRow } from "../db";
import { fetchRss } from "./rss";
import { fetchReddit } from "./reddit";
import { fetchGoogleTrends } from "./googleTrends";
import { fetchYouTube } from "./youtube";
import { fetchSerpApi } from "./serpapi";
import { fetchTwitter } from "./twitter";

export interface RawTrendItem {
  topic: string;
  summary?: string;
  url?: string;
  tags?: string[];
  hashtags?: string[];
  popularity?: number;
  publishedAt?: Date;
}

/**
 * Pull #hashtags from any free text. Lowercased, de-duped, capped.
 */
export function extractHashtagsFromText(s: string, max = 8): string[] {
  if (!s) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /#([a-zA-Z0-9_]{2,40})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const tag = `#${m[1]!.toLowerCase()}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Promote plain word/phrase tags into hashtags (camelCased, # prefix).
 * Strips non-alphanumerics; skips empties and stop-words.
 */
const STOP = new Set([
  "the", "and", "for", "with", "from", "this", "that", "you", "your",
  "are", "was", "but", "all", "not", "via", "vs",
]);
export function tagToHashtag(tag: string): string {
  const cleaned = tag.replace(/^#+/, "").trim();
  if (!cleaned) return "";
  // Multi-word: strip whitespace, camelCase first word lower then capitalise
  const parts = cleaned
    .split(/[\s\-_/]+/)
    .map((p) => p.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((p) => p && !STOP.has(p.toLowerCase()));
  if (!parts.length) return "";
  const joined = parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p[0]!.toUpperCase() + p.slice(1).toLowerCase()))
    .join("");
  return `#${joined}`;
}

/**
 * Build a final hashtag list for a trend item: in-text #tags first, then
 * promoted plain tags, capped & de-duped.
 */
export function deriveHashtags(
  topic: string,
  summary: string | undefined,
  tags: string[] | undefined,
  max = 8,
): string[] {
  const found = [
    ...extractHashtagsFromText(topic, max),
    ...extractHashtagsFromText(summary ?? "", max),
  ];
  const promoted = (tags ?? []).map(tagToHashtag).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...found, ...promoted]) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export interface AdapterResult {
  items: RawTrendItem[];
}

export type TrendAdapter = (source: TrendSourceRow) => Promise<AdapterResult>;

export const ADAPTERS: Record<TrendSourceKind, TrendAdapter> = {
  rss: fetchRss,
  reddit: fetchReddit,
  google_trends: fetchGoogleTrends,
  youtube: fetchYouTube,
  serpapi: fetchSerpApi,
  twitter: fetchTwitter,
};

export const ACTIVE_KINDS: ReadonlySet<TrendSourceKind> = new Set([
  "rss",
  "reddit",
  "google_trends",
  "youtube",
]);

export const SCAFFOLD_ONLY_KINDS: ReadonlySet<TrendSourceKind> = new Set([
  "serpapi",
  "twitter",
]);

export function isAdapterRunnable(kind: TrendSourceKind): boolean {
  if (!ACTIVE_KINDS.has(kind)) return false;
  if (kind === "youtube" && !process.env["YOUTUBE_API_KEY"]) return false;
  return true;
}
