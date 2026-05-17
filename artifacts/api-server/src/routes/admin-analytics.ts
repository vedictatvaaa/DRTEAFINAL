import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, analyticsEventsTable, analyticsInsightsTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { computeAnalyticsSummary, computeSalesForecast } from "../lib/analytics";
import { refreshAnalyticsInsights } from "../lib/analytics-insights-cron";

const router: IRouter = Router();
router.use("/admin/analytics", requireAdmin);

router.get("/admin/analytics/summary", async (req: Request, res: Response) => {
  const days = Number(req.query.days ?? 7);
  const summary = await computeAnalyticsSummary(Number.isFinite(days) ? days : 7);
  const forecast = await computeSalesForecast(7);
  res.json({ summary, forecast });
});

router.get("/admin/analytics/sessions/:id", async (req: Request, res: Response) => {
  const sessionId = String(req.params.id);
  if (!sessionId || sessionId.length < 8) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  const rows = await db
    .select()
    .from(analyticsEventsTable)
    .where(eq(analyticsEventsTable.sessionId, sessionId))
    .orderBy(asc(analyticsEventsTable.createdAt))
    .limit(500);
  res.json({ sessionId, events: rows });
});

router.get("/admin/analytics/insights", async (_req: Request, res: Response) => {
  const [latest] = await db
    .select()
    .from(analyticsInsightsTable)
    .orderBy(desc(analyticsInsightsTable.createdAt))
    .limit(1);
  res.json(latest ?? null);
});

router.post("/admin/analytics/insights/refresh", async (req: Request, res: Response) => {
  try {
    const days = Number(req.body?.windowDays ?? 7);
    const out = await refreshAnalyticsInsights({ windowDays: Number.isFinite(days) ? days : 7 });
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "Insights refresh failed");
    res.status(500).json({ error: "Failed to refresh insights" });
  }
});

export default router;
