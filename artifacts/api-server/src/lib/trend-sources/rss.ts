import type { TrendSourceRow } from "../db";
import { deriveHashtags, type AdapterResult, type RawTrendItem } from "./index";

const USER_AGENT = "DrTeaTrendBot/1.0 (+https://drtea.in)";
const TIMEOUT_MS = 12_000;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function pickTag(xml: string, tag: string): string {
  // Tries both <tag>...</tag> and <ns:tag>...</ns:tag>; prefers first match.
  const re = new RegExp(`<(?:[a-z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-z0-9]+:)?${tag}>`, "i");
  const m = xml.match(re);
  return m ? stripTags(m[1] ?? "") : "";
}

function pickLink(xml: string): string {
  // RSS <link>url</link> OR Atom <link href="..."/>.
  const m1 = xml.match(/<link[^>]*href="([^"]+)"/i);
  if (m1) return m1[1] ?? "";
  return pickTag(xml, "link");
}

function splitItems(xml: string): string[] {
  // Both RSS <item> and Atom <entry>.
  const out: string[] = [];
  const re = /<(item|entry)[\s>][\s\S]*?<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[0]);
    if (out.length >= 50) break;
  }
  return out;
}

function passesKeywordFilter(text: string, filterKeywords: string): boolean {
  const tokens = filterKeywords
    .split(/[,\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const hay = text.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

/**
 * Reject obviously-internal URLs to prevent SSRF via the admin "add source"
 * form. Even though only admins can configure sources, we treat these as
 * untrusted inputs because operator accounts get phished and the cron runs
 * server-side on every fetch.
 */
function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("URL must be http or https");
  }
  const host = u.hostname.toLowerCase();
  // Block bare-IP loopback and private ranges (incl. cloud metadata).
  const PRIVATE = [
    /^(localhost|0\.0\.0\.0)$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./,
    /^::1$/,
    /^fe80:/,
    /^fc00:/,
    /^fd00:/,
  ];
  if (PRIVATE.some((re) => re.test(host))) {
    throw new Error("URL host is not allowed");
  }
  return u;
}

export async function fetchRss(source: TrendSourceRow): Promise<AdapterResult> {
  if (!source.url) return { items: [] };
  const safeUrl = assertSafeUrl(source.url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(safeUrl.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    const itemsXml = splitItems(xml);
    const items: RawTrendItem[] = [];
    for (const it of itemsXml) {
      const title = pickTag(it, "title");
      if (!title) continue;
      const desc = pickTag(it, "description") || pickTag(it, "summary") || pickTag(it, "content");
      const link = pickLink(it);
      const dateRaw = pickTag(it, "pubDate") || pickTag(it, "published") || pickTag(it, "updated");
      const haystack = `${title} ${desc}`;
      if (!passesKeywordFilter(haystack, source.filterKeywords)) continue;
      const cats = Array.from(it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi))
        .map((m) => stripTags(m[1] ?? ""))
        .filter(Boolean)
        .slice(0, 6);
      items.push({
        topic: title.slice(0, 240),
        summary: desc.slice(0, 600),
        url: link,
        tags: cats,
        hashtags: deriveHashtags(title, desc, cats),
        publishedAt: dateRaw ? new Date(dateRaw) : undefined,
      });
    }
    return { items };
  } finally {
    clearTimeout(t);
  }
}
