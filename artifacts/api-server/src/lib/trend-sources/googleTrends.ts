import type { TrendSourceRow } from "../db";
import type { AdapterResult, RawTrendItem } from "./index";
import { fetchRss } from "./rss";

// Google Trends exposes a public daily-trending RSS feed per country.
// source.url stores the geo code (e.g. "IN", "US", "GB"). Default: "IN".
export async function fetchGoogleTrends(source: TrendSourceRow): Promise<AdapterResult> {
  const geo = (source.url || "IN").trim().toUpperCase();
  const feedUrl = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  // Reuse the RSS adapter, swapping URL.
  return fetchRss({ ...source, url: feedUrl });
}
