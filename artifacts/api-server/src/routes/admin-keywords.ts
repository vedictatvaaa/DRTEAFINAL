import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, gte } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  keywordsTable,
  keywordRanksTable,
  type KeywordRankRow,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  refreshKeywordRanks,
  summarizeKeywordMovement,
  listProviders,
  getActiveProvider,
  setActiveProvider,
  PROVIDER_IDS,
  type ProviderId,
} from "../lib/keyword-rank-cron";

const router: IRouter = Router();
router.use("/admin/keywords", requireAdmin);

const MAX_KEYWORDS = 50;

// ── List with rolling 14-day rank deltas ────────────────────────────────
router.get("/admin/keywords", async (_req: Request, res: Response) => {
  const rows = await db.select().from(keywordsTable).orderBy(desc(keywordsTable.createdAt));
  if (!rows.length) { res.json([]); return; }
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const ranks = await db
    .select()
    .from(keywordRanksTable)
    .where(gte(keywordRanksTable.checkedAt, since))
    .orderBy(desc(keywordRanksTable.checkedAt));
  const byKw = new Map<number, KeywordRankRow[]>();
  for (const r of ranks) {
    const arr = byKw.get(r.keywordId) ?? [];
    arr.push(r);
    byKw.set(r.keywordId, arr);
  }
  res.json(rows.map((k) => {
    const series = byKw.get(k.id) ?? [];
    const latest = series[0]?.position ?? null;
    const earlier = series[series.length - 1]?.position ?? null;
    return {
      ...k,
      currentRank: latest,
      previousRank: earlier,
      delta: latest != null && earlier != null ? earlier - latest : null,
      latestSource: series[0]?.source ?? null,
      history: series.slice(0, 14).map((r) => ({
        position: r.position,
        checkedAt: r.checkedAt,
        url: r.url,
      })),
    };
  }));
});

// ── Live/shadow mode status + provider catalog ──────────────────────────
router.get("/admin/keywords/status", async (_req: Request, res: Response) => {
  const activeProvider = await getActiveProvider();
  const providers = listProviders();
  const active = providers.find((p) => p.id === activeProvider);
  res.json({
    mode: active?.configured ? "live" : "shadow",
    activeProvider,
    targetDomain: process.env["PUBLIC_SITE_DOMAIN"] ?? "drtea",
    providers,
  });
});

const SetProviderBody = z.object({
  provider: z.enum(PROVIDER_IDS as unknown as [ProviderId, ...ProviderId[]]),
});
router.put("/admin/keywords/provider", async (req: Request, res: Response) => {
  const parsed = SetProviderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  await setActiveProvider(parsed.data.provider);
  res.json({ ok: true, activeProvider: parsed.data.provider });
});

const CreateBody = z.object({
  term: z.string().trim().min(2).max(120),
  market: z.string().trim().min(2).max(4).optional(),
});
router.post("/admin/keywords", async (req: Request, res: Response) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const count = await db.select({ id: keywordsTable.id }).from(keywordsTable);
  if (count.length >= MAX_KEYWORDS) {
    res.status(400).json({ error: `Limit reached (${MAX_KEYWORDS} keywords)` });
    return;
  }
  try {
    const [row] = await db
      .insert(keywordsTable)
      .values({ term: parsed.data.term, market: parsed.data.market ?? "IN" })
      .returning();
    res.status(201).json(row);
  } catch {
    res.status(409).json({ error: "Keyword already tracked" });
  }
});

router.delete("/admin/keywords/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(keywordRanksTable).where(eq(keywordRanksTable.keywordId, id));
  await db.delete(keywordsTable).where(eq(keywordsTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/keywords/refresh", async (_req: Request, res: Response) => {
  const r = await refreshKeywordRanks();
  res.json(r);
});

router.post("/admin/keywords/summary", async (_req: Request, res: Response) => {
  const r = await summarizeKeywordMovement();
  res.json(r);
});

// Used by the campaign orchestrator prompt — surfaces a compact movement digest.
router.get("/admin/keywords/digest", async (_req: Request, res: Response) => {
  const rows = await db.select().from(keywordsTable);
  const out: Array<{ term: string; summary: string }> = [];
  for (const k of rows) {
    if (k.lastSummary) out.push({ term: k.term, summary: k.lastSummary });
  }
  res.json({ items: out });
});

export default router;
