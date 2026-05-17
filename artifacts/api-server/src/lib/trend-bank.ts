import { and, desc, eq, sql } from "drizzle-orm";
import { db, trendingTopicsTable, trendConfigTable } from "./db";
import { logger } from "./logger";

/**
 * Reads from the trend topic bank. Used by content-trends-cron,
 * content-hub-cron, teapedia-cron, and journal-cron to source real-world
 * inspiration instead of static seeds.
 */

export interface TrendBankItem {
  id: number;
  topic: string;
  summary: string;
  tags: string[];
  hashtags: string[];
  source: string;
  url: string;
  score: number;
}

/** Top-N fresh, undismissed, unused topics ordered by score. */
export async function getFreshTrendingTopics(limit = 10): Promise<TrendBankItem[]> {
  const rows = await db
    .select()
    .from(trendingTopicsTable)
    .where(
      and(
        eq(trendingTopicsTable.dismissed, false),
        eq(trendingTopicsTable.used, false),
      ),
    )
    .orderBy(desc(trendingTopicsTable.score), desc(trendingTopicsTable.fetchedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    summary: r.summary,
    tags: r.tags ?? [],
    hashtags: r.hashtags ?? [],
    source: r.sourceName,
    url: r.rawUrl,
    score: r.score,
  }));
}

/** Mark a list of topic IDs as consumed by a content cron. */
/**
 * Defang free-text trend strings before they get spliced into an AI prompt.
 * Strips any line/instruction that looks like prompt-injection, JSON braces,
 * code fences, role markers, etc. Hard length cap. Trends are *inspiration*
 * only — they never need to carry markup or punctuation past a clause.
 */
export function sanitiseForPrompt(s: string, maxLen = 180): string {
  if (!s) return "";
  return s
    .replace(/[`{}\[\]<>]/g, " ")
    .replace(/\b(ignore|disregard|forget)\b[^.!?\n]{0,80}(prior|previous|earlier|above|all)\b[^.!?\n]{0,80}(instructions?|prompts?|rules?)/gi, "[redacted]")
    .replace(/\b(system|assistant|user)\s*[:|]/gi, "")
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function markTopicsUsed(ids: number[]): Promise<void> {
  if (!ids.length) return;
  try {
    await db
      .update(trendingTopicsTable)
      .set({ used: true, usedAt: new Date() })
      .where(sql`${trendingTopicsTable.id} = ANY(${ids})`);
  } catch (err) {
    logger.warn({ err, ids }, "Failed to mark topics used");
  }
}

// ── Config bag ────────────────────────────────────────────────────────────
// Stored as one JSON row per key so the admin can edit at runtime.

export interface TrendConfig {
  autoPublish: boolean;
  topNPerCron: number;
  ingestIntervalHours: number;
}

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  autoPublish: true,
  topNPerCron: 6,
  ingestIntervalHours: 6,
};

const CONFIG_KEY = "trend_pipeline";

export async function getTrendConfig(): Promise<TrendConfig> {
  try {
    const [row] = await db
      .select()
      .from(trendConfigTable)
      .where(eq(trendConfigTable.key, CONFIG_KEY))
      .limit(1);
    if (!row) return DEFAULT_TREND_CONFIG;
    return { ...DEFAULT_TREND_CONFIG, ...(row.value as Partial<TrendConfig>) };
  } catch {
    return DEFAULT_TREND_CONFIG;
  }
}

export async function setTrendConfig(patch: Partial<TrendConfig>): Promise<TrendConfig> {
  const next = { ...(await getTrendConfig()), ...patch };
  await db
    .insert(trendConfigTable)
    .values({ key: CONFIG_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: trendConfigTable.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}
