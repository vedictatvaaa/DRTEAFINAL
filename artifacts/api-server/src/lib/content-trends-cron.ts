import { db, contentIdeasTable } from "./db";
import { sql } from "drizzle-orm";
import { generateTrendIdeas, DEFAULT_TREND_SEEDS } from "./content-studio";
import { getFreshTrendingTopics, markTopicsUsed, getTrendConfig } from "./trend-bank";
import { logger } from "./logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let cronTimer: NodeJS.Timeout | null = null;
let inflight = false;

/**
 * Generate fresh trend ideas using the seed keywords and persist them. Called
 * from the daily cron and from the manual refresh endpoint.
 */
export async function refreshTrendIdeas(opts: { seeds?: string[] } = {}): Promise<number> {
  if (inflight) {
    logger.info("Trend refresh skipped — already in flight");
    return 0;
  }
  inflight = true;
  try {
    // Pull live trending topics; fall back to static seeds when the bank
    // is empty or AI doesn't bite. Topics are mixed into the seed list so
    // the AI can riff off real-world signal.
    const cfg = await getTrendConfig();
    const trending = await getFreshTrendingTopics(cfg.topNPerCron);
    const trendingPhrases = trending.map((t) => t.topic);
    // Include related hashtags as seed signals so generated ideas inherit the
    // discovery surface (e.g. #chaitok) rather than just topic phrases.
    const trendingHashtags = Array.from(
      new Set(trending.flatMap((t) => t.hashtags ?? [])),
    ).slice(0, 8);
    const seeds = opts.seeds ?? [
      ...trendingPhrases,
      ...trendingHashtags,
      ...DEFAULT_TREND_SEEDS,
    ].slice(0, 18);
    const ideas = await generateTrendIdeas({ seedKeywords: seeds, count: 5 });
    if (ideas.length && trending.length) {
      await markTopicsUsed(trending.map((t) => t.id));
    }
    if (!ideas.length) {
      logger.warn("Trend refresh produced 0 ideas (AI unavailable or empty response)");
      return 0;
    }
    // Avoid duplicate headlines from earlier runs.
    const headlines = ideas.map((i) => i.headline);
    const existing = await db
      .select({ headline: contentIdeasTable.headline })
      .from(contentIdeasTable)
      .where(sql`${contentIdeasTable.headline} = ANY(${headlines})`);
    const existingSet = new Set(existing.map((r) => r.headline));
    const fresh = ideas.filter((i) => !existingSet.has(i.headline));
    if (!fresh.length) return 0;
    await db.insert(contentIdeasTable).values(
      fresh.map((i) => ({
        headline: i.headline,
        rationale: i.rationale,
        channels: i.channels,
        source: seeds.join(", ").slice(0, 200),
      })),
    );
    return fresh.length;
  } finally {
    inflight = false;
  }
}

/**
 * Start a daily-ish cron (24h interval) that refreshes trend ideas in the
 * background. Best-effort: failures are logged and the next tick still runs.
 */
export function startContentTrendsCron(): void {
  if (cronTimer) return;
  // Initial delayed run so we don't compete with server startup.
  setTimeout(() => {
    void refreshTrendIdeas().catch((err) =>
      logger.error({ err }, "Initial trend refresh failed"),
    );
  }, 60_000).unref?.();
  cronTimer = setInterval(() => {
    void refreshTrendIdeas().catch((err) =>
      logger.error({ err }, "Daily trend refresh failed"),
    );
  }, ONE_DAY_MS);
  cronTimer.unref?.();
  logger.info("Content trends cron started (24h interval)");
}
