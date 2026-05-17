import { db, analyticsInsightsTable } from "./db";
import { sql, desc } from "drizzle-orm";
import { computeAnalyticsSummary, computeSalesForecast } from "./analytics";
import { chatCompletionJSON } from "./openaiText";
import { logger } from "./logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let cronTimer: NodeJS.Timeout | null = null;
let inflight = false;

interface InsightOutput { bullets?: string[] }

/**
 * Generate AI insight bullets summarizing the last `windowDays` of metrics
 * and persist them with the deterministic forecast. Best-effort: if the AI
 * call fails we still store the forecast and a fallback bullet list.
 */
export async function refreshAnalyticsInsights(opts: { windowDays?: number } = {}): Promise<{ bullets: string[]; forDate: string }> {
  if (inflight) {
    logger.info("Analytics insights refresh skipped — already in flight");
    const [latest] = await db.select().from(analyticsInsightsTable).orderBy(desc(analyticsInsightsTable.createdAt)).limit(1);
    return { bullets: latest?.bullets ?? [], forDate: latest?.forDate ?? new Date().toISOString().slice(0, 10) };
  }
  inflight = true;
  try {
    const windowDays = opts.windowDays ?? 7;
    const summary = await computeAnalyticsSummary(windowDays);
    const forecast = await computeSalesForecast(7);
    const forDate = new Date().toISOString().slice(0, 10);

    const fallback = (): string[] => [
      `Past ${windowDays} days saw ${summary.totals.sessions} sessions and ${summary.totals.orders} orders.`,
      `Top page: ${summary.topPages[0]?.path ?? "(no traffic yet)"}.`,
      `Strongest referrer: ${summary.referrers[0]?.referrer ?? "(direct)"}.`,
      `Funnel: ${summary.funnel.pageViewSessions} → ${summary.funnel.productViewSessions} → ${summary.funnel.addToCartSessions} → ${summary.funnel.orderSessions}.`,
      `Forecast next 7 days: ${forecast.forecast.reduce((s, p) => s + p.orders, 0)} orders.`,
    ];

    let bullets: string[] = fallback();
    try {
      const out = await chatCompletionJSON<InsightOutput>({
        systemPrompt:
          "You are an analyst for Dr Tea, a premium tea brand. Write tight, plain-English insight bullets (no fluff, no medical claims). Use specific numbers from the data when relevant.",
        userPrompt: [
          `Window: last ${windowDays} days.`,
          `Totals: ${JSON.stringify(summary.totals)}`,
          `Funnel sessions: ${JSON.stringify(summary.funnel)}`,
          `Top pages: ${JSON.stringify(summary.topPages.slice(0, 5))}`,
          `Top products: ${JSON.stringify(summary.topProducts.slice(0, 5))}`,
          `Referrers: ${JSON.stringify(summary.referrers.slice(0, 5))}`,
          `UTM sources: ${JSON.stringify(summary.utmSources.slice(0, 5))}`,
          `Countries: ${JSON.stringify(summary.countries.slice(0, 5))}`,
          `7d order forecast total: ${forecast.forecast.reduce((s, p) => s + p.orders, 0)}`,
          "",
          "Return strict JSON: { bullets: string[] } with EXACTLY 5 bullets, each <= 180 chars.",
        ].join("\n"),
        maxTokens: 600,
      });
      if (out?.bullets && Array.isArray(out.bullets)) {
        const cleaned = out.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 5);
        if (cleaned.length === 5) bullets = cleaned;
      }
    } catch (err) {
      logger.warn({ err }, "AI insights generation failed — using fallback bullets");
    }

    await db.insert(analyticsInsightsTable).values({
      forDate,
      windowDays,
      bullets,
      forecast: forecast.forecast,
      assumptions: forecast.assumptions as unknown as Record<string, unknown>,
    });

    // Compact: keep latest 30 rows.
    await db.execute(sql`
      delete from ${analyticsInsightsTable}
      where created_at < (
        select created_at from ${analyticsInsightsTable}
        order by created_at desc offset 30 limit 1
      )
    `);

    return { bullets, forDate };
  } finally {
    inflight = false;
  }
}

/** Daily-ish cron — runs once a day to refresh AI insights + forecast. */
export function startAnalyticsInsightsCron(): void {
  if (cronTimer) return;
  setTimeout(() => {
    void refreshAnalyticsInsights().catch((err) =>
      logger.error({ err }, "Initial analytics insights refresh failed"),
    );
  }, 90_000).unref?.();
  cronTimer = setInterval(() => {
    void refreshAnalyticsInsights().catch((err) =>
      logger.error({ err }, "Daily analytics insights refresh failed"),
    );
  }, ONE_DAY_MS);
  cronTimer.unref?.();
  logger.info("Analytics insights cron started (24h interval)");
}
