import { eq, sql } from "drizzle-orm";
import { db, trendSourcesTable, trendingTopicsTable, type TrendSourceRow } from "./db";
import { ADAPTERS, isAdapterRunnable, type RawTrendItem } from "./trend-sources";
import { getTrendConfig } from "./trend-bank";
import { logger } from "./logger";

let cronTimer: NodeJS.Timeout | null = null;
let inflight = false;

function topicKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function recencyBoost(d?: Date): number {
  if (!d) return 0.4;
  const ageHours = (Date.now() - d.getTime()) / 3_600_000;
  if (ageHours < 6) return 1.0;
  if (ageHours < 24) return 0.85;
  if (ageHours < 72) return 0.6;
  if (ageHours < 168) return 0.35;
  return 0.15;
}

function popularityBoost(p?: number): number {
  if (!p || p <= 0) return 0.5;
  // log-scaled — 100 → 1.0, 1000 → 1.5, 10000 → 2.0
  return Math.min(2.5, 0.5 + Math.log10(p) * 0.5);
}

function score(source: TrendSourceRow, item: RawTrendItem): number {
  const w = Math.max(0, Math.min(10, source.weight)) / 5; // 0–2 multiplier
  return w * recencyBoost(item.publishedAt) * popularityBoost(item.popularity);
}

async function ingestOne(source: TrendSourceRow): Promise<{ inserted: number; total: number }> {
  if (!source.enabled) return { inserted: 0, total: 0 };
  if (!isAdapterRunnable(source.kind)) {
    logger.info({ id: source.id, kind: source.kind, name: source.name }, "Trend source skipped — adapter not runnable (missing key or scaffold-only)");
    return { inserted: 0, total: 0 };
  }
  const adapter = ADAPTERS[source.kind];
  let result;
  try {
    result = await adapter(source);
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    await db
      .update(trendSourcesTable)
      .set({ lastFetchedAt: new Date(), lastError: msg.slice(0, 500), itemsLastRun: 0 })
      .where(eq(trendSourcesTable.id, source.id));
    logger.warn({ err, source: source.name }, "Trend source fetch failed");
    return { inserted: 0, total: 0 };
  }

  let inserted = 0;
  for (const it of result.items) {
    const key = topicKey(it.topic);
    if (!key) continue;
    try {
      const r = await db
        .insert(trendingTopicsTable)
        .values({
          topic: it.topic.slice(0, 240),
          topicKey: key,
          sourceId: source.id,
          sourceKind: source.kind,
          sourceName: source.name,
          rawUrl: (it.url ?? "").slice(0, 800),
          summary: (it.summary ?? "").slice(0, 800),
          tags: (it.tags ?? []).slice(0, 8),
          hashtags: (it.hashtags ?? []).slice(0, 10),
          score: score(source, it),
          fetchedAt: new Date(),
        })
        .onConflictDoNothing({ target: trendingTopicsTable.topicKey })
        .returning({ id: trendingTopicsTable.id });
      if (r[0]) inserted += 1;
    } catch (err) {
      logger.warn({ err, topic: it.topic }, "Failed to insert trending topic");
    }
  }

  await db
    .update(trendSourcesTable)
    .set({
      lastFetchedAt: new Date(),
      lastError: "",
      itemsLastRun: result.items.length,
    })
    .where(eq(trendSourcesTable.id, source.id));

  return { inserted, total: result.items.length };
}

export async function runTrendIngest(opts: { sourceId?: number } = {}): Promise<{ runs: number; inserted: number }> {
  if (inflight) return { runs: 0, inserted: 0 };
  inflight = true;
  try {
    const where = opts.sourceId
      ? eq(trendSourcesTable.id, opts.sourceId)
      : eq(trendSourcesTable.enabled, true);
    const sources = await db.select().from(trendSourcesTable).where(where);
    let inserted = 0;
    let runs = 0;
    for (const s of sources) {
      const r = await ingestOne(s);
      inserted += r.inserted;
      runs += 1;
    }

    // House-keeping: drop used/dismissed topics older than 30 days. A simple
    // time-based delete is index-friendly and avoids OFFSET scans as the
    // table grows.
    try {
      await db.execute(sql`
        delete from trending_topics
         where (used = true or dismissed = true)
           and fetched_at < now() - interval '30 days'
      `);
    } catch (err) {
      logger.warn({ err }, "Trend topic housekeeping failed");
    }

    logger.info({ runs, inserted }, "Trend ingest complete");
    return { runs, inserted };
  } finally {
    inflight = false;
  }
}

export async function seedDefaultTrendSources(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trendSourcesTable);
  if ((count ?? 0) > 0) return 0;

  const TEA_KEYWORDS = "tea, chai, matcha, kadha, herbal, tisane, oolong, darjeeling, assam, kombucha, infusion";
  const defaults = [
    // RSS — active
    { kind: "rss" as const, name: "World Tea News", url: "https://www.worldteanews.com/feed", filterKeywords: "", weight: 7 },
    { kind: "rss" as const, name: "Tea Journey Magazine", url: "https://teajourney.pub/feed/", filterKeywords: "", weight: 6 },
    { kind: "rss" as const, name: "Tea Epicure", url: "https://teaepicure.com/feed/", filterKeywords: "", weight: 6 },
    { kind: "rss" as const, name: "T Ching", url: "https://tching.com/feed/", filterKeywords: "", weight: 5 },
    // Google Trends — active
    { kind: "google_trends" as const, name: "Google Trends — India", url: "IN", filterKeywords: TEA_KEYWORDS, weight: 7 },
    { kind: "google_trends" as const, name: "Google Trends — US", url: "US", filterKeywords: TEA_KEYWORDS, weight: 4 },
    // Reddit — active
    { kind: "reddit" as const, name: "r/tea (top week)", url: "tea:top:week", filterKeywords: "", weight: 7 },
    { kind: "reddit" as const, name: "r/Indianfood (top week, tea)", url: "Indianfood:top:week", filterKeywords: "tea, chai, kadha, masala chai", weight: 5 },
    { kind: "reddit" as const, name: "r/teasellers (hot)", url: "teasellers:hot", filterKeywords: "", weight: 4 },
    // YouTube — runnable only with YOUTUBE_API_KEY
    { kind: "youtube" as const, name: "YouTube — tea (last 7d)", url: "tea brewing recipe", filterKeywords: "", weight: 5 },
    // Scaffolded but disabled by default
    { kind: "serpapi" as const, name: "Google News — tea (SerpAPI, disabled)", url: "indian tea", filterKeywords: "", weight: 6 },
    { kind: "twitter" as const, name: "X / Twitter — tea (disabled)", url: "tea OR matcha lang:en", filterKeywords: "", weight: 4 },
  ];
  const enabledKinds = new Set(["rss", "google_trends", "reddit", "youtube"]);
  const rows = defaults.map((d) => ({ ...d, enabled: enabledKinds.has(d.kind) }));
  await db.insert(trendSourcesTable).values(rows);
  return rows.length;
}

export function startTrendIngestCron(): void {
  if (cronTimer) return;
  // Seed on first boot, then ingest after a short delay.
  setTimeout(async () => {
    try {
      const seeded = await seedDefaultTrendSources();
      if (seeded) logger.info({ seeded }, "Trend sources seeded");
    } catch (err) {
      logger.warn({ err }, "Trend source seed failed");
    }
    void runTrendIngest().catch((err) =>
      logger.error({ err }, "Initial trend ingest failed"),
    );
  }, 90_000).unref?.();

  // Re-read interval from config every tick so admin changes apply.
  const tick = async () => {
    try {
      const cfg = await getTrendConfig();
      const intervalMs = Math.max(1, cfg.ingestIntervalHours) * 60 * 60 * 1000;
      void runTrendIngest().catch((err) =>
        logger.error({ err }, "Scheduled trend ingest failed"),
      );
      cronTimer = setTimeout(tick, intervalMs);
      cronTimer.unref?.();
    } catch (err) {
      logger.warn({ err }, "Trend ingest tick error");
      cronTimer = setTimeout(tick, 6 * 60 * 60 * 1000);
      cronTimer.unref?.();
    }
  };
  cronTimer = setTimeout(tick, 6 * 60 * 60 * 1000);
  cronTimer.unref?.();
  logger.info("Trend ingest cron scheduled");
}
