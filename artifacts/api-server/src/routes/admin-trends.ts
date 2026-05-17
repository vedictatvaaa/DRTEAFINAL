import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  trendSourcesTable,
  trendingTopicsTable,
  type TrendSourceKind,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { runTrendIngest } from "../lib/trend-ingest-cron";
import { getTrendConfig, setTrendConfig } from "../lib/trend-bank";
import { ACTIVE_KINDS, SCAFFOLD_ONLY_KINDS } from "../lib/trend-sources";

const router: IRouter = Router();
router.use("/admin/trends", requireAdmin);

const KINDS = ["rss", "reddit", "google_trends", "youtube", "serpapi", "twitter"] as const;
const Kind = z.enum(KINDS);

// ── Sources ───────────────────────────────────────────────────────────────

router.get("/admin/trends/sources", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(trendSourcesTable)
    .orderBy(desc(trendSourcesTable.enabled), trendSourcesTable.kind, trendSourcesTable.id);
  res.json(
    rows.map((r) => ({
      ...r,
      runnable: ACTIVE_KINDS.has(r.kind),
      scaffoldOnly: SCAFFOLD_ONLY_KINDS.has(r.kind),
    })),
  );
});

const UpsertSource = z.object({
  kind: Kind,
  name: z.string().min(1).max(120),
  url: z.string().max(500).default(""),
  filterKeywords: z.string().max(500).default(""),
  weight: z.number().int().min(0).max(10).default(5),
  enabled: z.boolean().default(true),
});

router.post("/admin/trends/sources", async (req: Request, res: Response) => {
  const parsed = UpsertSource.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [row] = await db.insert(trendSourcesTable).values(parsed.data).returning();
  res.json(row);
});

router.put("/admin/trends/sources/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpsertSource.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .update(trendSourcesTable)
    .set(parsed.data)
    .where(eq(trendSourcesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/admin/trends/sources/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(trendSourcesTable).where(eq(trendSourcesTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/trends/run", async (req: Request, res: Response) => {
  const id = req.body?.sourceId ? Number(req.body.sourceId) : undefined;
  const out = await runTrendIngest(id ? { sourceId: id } : {});
  res.json(out);
});

// ── Topics ────────────────────────────────────────────────────────────────

router.get("/admin/trends/topics", async (req: Request, res: Response) => {
  const status = String(req.query.status ?? "fresh");
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));
  const conditions = [];
  if (status === "fresh") {
    conditions.push(eq(trendingTopicsTable.dismissed, false));
    conditions.push(eq(trendingTopicsTable.used, false));
  } else if (status === "used") {
    conditions.push(eq(trendingTopicsTable.used, true));
  } else if (status === "dismissed") {
    conditions.push(eq(trendingTopicsTable.dismissed, true));
  }
  const rows = await db
    .select()
    .from(trendingTopicsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(trendingTopicsTable.score), desc(trendingTopicsTable.fetchedAt))
    .limit(limit);
  res.json(rows);
});

router.post("/admin/trends/topics/:id/dismiss", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .update(trendingTopicsTable)
    .set({ dismissed: true })
    .where(eq(trendingTopicsTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/trends/topics/:id/restore", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .update(trendingTopicsTable)
    .set({ dismissed: false, used: false })
    .where(eq(trendingTopicsTable.id, id));
  res.json({ ok: true });
});

// ── Config ────────────────────────────────────────────────────────────────

router.get("/admin/trends/config", async (_req: Request, res: Response) => {
  const cfg = await getTrendConfig();
  res.json(cfg);
});

const ConfigPatch = z.object({
  autoPublish: z.boolean().optional(),
  topNPerCron: z.number().int().min(1).max(50).optional(),
  ingestIntervalHours: z.number().int().min(1).max(168).optional(),
});

router.put("/admin/trends/config", async (req: Request, res: Response) => {
  const parsed = ConfigPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const next = await setTrendConfig(parsed.data);
  res.json(next);
});

// ── Stats / Overview ──────────────────────────────────────────────────────

router.get("/admin/trends/stats", async (_req: Request, res: Response) => {
  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      fresh: sql<number>`count(*) filter (where used = false and dismissed = false)::int`,
      used: sql<number>`count(*) filter (where used = true)::int`,
      dismissed: sql<number>`count(*) filter (where dismissed = true)::int`,
    })
    .from(trendingTopicsTable);
  res.json(agg ?? { total: 0, fresh: 0, used: 0, dismissed: 0 });
});

export default router;
