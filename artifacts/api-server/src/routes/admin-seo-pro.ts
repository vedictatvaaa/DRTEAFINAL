/**
 * Extended SEO admin endpoints: per-entity analysis, AI guidance, keyword
 * tracking, backlink ledger, and outreach pipeline. Kept in a separate router
 * file from the legacy `admin-seo.ts` (health/pings/meta gen) to avoid
 * touching the api-zod codegen contract those routes use.
 *
 * All routes are mounted under `/api/admin/seo-pro/*` and gated by requireAdmin.
 * The admin UI calls these via plain `fetch` (not the typed @workspace/api-client-react)
 * to keep the iteration loop fast.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  articlesTable,
  teapediaEntriesTable,
  recipesTable,
  contentHubEntriesTable,
  keywordsTable,
  keywordRanksTable,
  seoBacklinksTable,
  seoOutreachTable,
  seoAuditRunsTable,
  seoKeywordTargetsTable,
  type SeoEntityKind,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { analyzeEntity, siteWideOpportunities } from "../lib/seo-analyzer";
import { suggestRewrites, generateBrief, draftOutreach, suggestInternalLinkAnchors } from "../lib/seo-ai-guide";
import { generateProductMeta, persistProductMeta, generateArticleMeta, persistArticleMeta } from "../lib/seo-meta";

const router: IRouter = Router();
router.use("/admin/seo-pro", requireAdmin);

const KindSchema = z.enum(["product", "article", "teapedia", "recipe", "content-hub"]);

// ─────────────────────────────── Analysis ───────────────────────────────────

const AnalyzeBody = z.object({
  kind: KindSchema,
  ref: z.string().min(1),
  persist: z.boolean().optional(),
});

router.post("/admin/seo-pro/analyze", async (req: Request, res: Response) => {
  const parsed = AnalyzeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const analysis = await analyzeEntity(parsed.data.kind, parsed.data.ref);
  if (!analysis) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  if (parsed.data.persist) {
    await db.insert(seoAuditRunsTable).values({
      entityKind: analysis.kind,
      entityRef: analysis.ref,
      score: analysis.score,
      breakdown: analysis.breakdown,
      issues: analysis.issues,
      suggestions: analysis.quickFixes,
    });
  }
  res.json(analysis);
});

router.get("/admin/seo-pro/opportunities", async (_req: Request, res: Response) => {
  const list = await siteWideOpportunities();
  res.json({ opportunities: list });
});

router.get("/admin/seo-pro/entities", async (_req: Request, res: Response) => {
  // Lightweight pickers for the per-entity editor dropdown.
  const [products, articles, teap, recipes, hub] = await Promise.all([
    db.select({ id: productsTable.id, name: productsTable.name, slug: productsTable.slug }).from(productsTable).orderBy(productsTable.name),
    db.select({ id: articlesTable.id, title: articlesTable.title, slug: articlesTable.slug }).from(articlesTable).where(eq(articlesTable.published, true)).orderBy(desc(articlesTable.updatedAt)),
    db.select({ id: teapediaEntriesTable.id, title: teapediaEntriesTable.title, slug: teapediaEntriesTable.slug }).from(teapediaEntriesTable).where(eq(teapediaEntriesTable.published, true)).orderBy(desc(teapediaEntriesTable.updatedAt)),
    db.select({ id: recipesTable.id, title: recipesTable.title, slug: recipesTable.slug }).from(recipesTable).where(eq(recipesTable.published, true)).orderBy(desc(recipesTable.updatedAt)),
    db.select({ id: contentHubEntriesTable.id, title: contentHubEntriesTable.title, slug: contentHubEntriesTable.slug, hub: contentHubEntriesTable.hub }).from(contentHubEntriesTable).where(eq(contentHubEntriesTable.published, true)).orderBy(desc(contentHubEntriesTable.updatedAt)),
  ]);
  res.json({
    products: products.map((p) => ({ ref: p.id, label: p.name, slug: p.slug })),
    articles: articles.map((a) => ({ ref: String(a.id), label: a.title, slug: a.slug })),
    teapedia: teap.map((t) => ({ ref: String(t.id), label: t.title, slug: t.slug })),
    recipes: recipes.map((r) => ({ ref: String(r.id), label: r.title, slug: r.slug })),
    "content-hub": hub.map((h) => ({ ref: String(h.id), label: `[${h.hub}] ${h.title}`, slug: h.slug })),
  });
});

// ─────────────────────────────── AI Guidance ────────────────────────────────

const SuggestBody = z.object({
  kind: KindSchema,
  ref: z.string().min(1),
  field: z.enum(["metaTitle", "metaDescription", "slug", "h1", "intro"]),
  focusKeyword: z.string().optional(),
});

router.post("/admin/seo-pro/suggest", async (req: Request, res: Response) => {
  const parsed = SuggestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const analysis = await analyzeEntity(parsed.data.kind, parsed.data.ref);
  if (!analysis) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  const suggestions = await suggestRewrites({
    kind: parsed.data.kind,
    title: analysis.title,
    currentMetaTitle: analysis.raw.metaTitle,
    currentMetaDescription: analysis.raw.metaDescription,
    bodyExcerpt: "",
    focusKeyword: parsed.data.focusKeyword,
    field: parsed.data.field,
  });
  res.json({ suggestions });
});

const ApplyBody = z.object({
  kind: KindSchema,
  ref: z.string().min(1),
  patch: z.object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    slug: z.string().optional(),
  }),
});

router.post("/admin/seo-pro/apply", async (req: Request, res: Response) => {
  const parsed = ApplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { kind, ref, patch } = parsed.data;
  const updatedAt = new Date();
  const update: Record<string, unknown> = { updatedAt };
  if (typeof patch.metaTitle === "string") update.metaTitle = patch.metaTitle;
  if (typeof patch.metaDescription === "string") update.metaDescription = patch.metaDescription;
  if (typeof patch.slug === "string") update.slug = patch.slug;
  if (Object.keys(update).length === 1) {
    res.status(400).json({ error: "Empty patch" });
    return;
  }
  try {
    let result: { rowCount?: number | null } = {};
    if (kind === "product") {
      result = await db.update(productsTable).set(update).where(eq(productsTable.id, ref));
    } else {
      const id = Number(ref);
      if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid ref for kind" }); return; }
      if (kind === "article") result = await db.update(articlesTable).set(update).where(eq(articlesTable.id, id));
      else if (kind === "teapedia") result = await db.update(teapediaEntriesTable).set(update).where(eq(teapediaEntriesTable.id, id));
      else if (kind === "recipe") result = await db.update(recipesTable).set(update).where(eq(recipesTable.id, id));
      else if (kind === "content-hub") result = await db.update(contentHubEntriesTable).set(update).where(eq(contentHubEntriesTable.id, id));
    }
    if (!result.rowCount) {
      res.status(404).json({ error: "Entity not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "seo apply failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Apply failed" });
  }
});

const BriefBody = z.object({
  focusKeyword: z.string().min(1),
  kind: KindSchema,
  intent: z.string().optional(),
});

router.post("/admin/seo-pro/brief", async (req: Request, res: Response) => {
  const parsed = BriefBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const brief = await generateBrief(parsed.data);
  if (!brief) {
    res.status(502).json({ error: "AI brief generation failed" });
    return;
  }
  res.json({ brief });
});

const LinkBody = z.object({
  kind: KindSchema,
  ref: z.string().min(1),
});
router.post("/admin/seo-pro/internal-links", async (req: Request, res: Response) => {
  const parsed = LinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const analysis = await analyzeEntity(parsed.data.kind, parsed.data.ref);
  if (!analysis) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  // Build a candidate pool from articles + teapedia for cross-linking.
  const [articles, teap] = await Promise.all([
    db.select({ slug: articlesTable.slug, title: articlesTable.title, excerpt: articlesTable.excerpt }).from(articlesTable).where(eq(articlesTable.published, true)).limit(40),
    db.select({ slug: teapediaEntriesTable.slug, title: teapediaEntriesTable.title, summary: teapediaEntriesTable.summary }).from(teapediaEntriesTable).where(eq(teapediaEntriesTable.published, true)).limit(20),
  ]);
  const pool = [
    ...articles.map((a) => ({ url: `/journal/${a.slug}`, title: a.title, summary: a.excerpt })),
    ...teap.map((t) => ({ url: `/teapedia/${t.slug}`, title: t.title, summary: t.summary })),
  ];
  const picks = await suggestInternalLinkAnchors({
    kind: parsed.data.kind,
    title: analysis.title,
    excerpt: analysis.raw.metaDescription,
    candidatePool: pool,
  });
  res.json({ picks });
});

// ─────────────────────────────── Bulk fixes ─────────────────────────────────

const BulkBody = z.object({
  scope: z.enum(["products", "articles"]),
  action: z.enum(["fill-missing-meta"]),
  limit: z.number().min(1).max(200).optional(),
});

router.post("/admin/seo-pro/bulk", async (req: Request, res: Response) => {
  const parsed = BulkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const limit = parsed.data.limit ?? 25;
  let done = 0;
  let failed = 0;
  if (parsed.data.scope === "products") {
    const rows = await db.select().from(productsTable).limit(200);
    for (const row of rows.filter((r) => !r.metaTitle || !r.metaDescription || !r.jsonLd).slice(0, limit)) {
      try {
        const m = await generateProductMeta(row);
        await persistProductMeta(row.id, m);
        done++;
      } catch (err) {
        req.log.warn({ err, id: row.id }, "bulk meta product failed");
        failed++;
      }
    }
  } else {
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.published, true)).limit(500);
    for (const row of rows.filter((r) => !r.metaTitle || !r.metaDescription || !r.jsonLd).slice(0, limit)) {
      try {
        const m = await generateArticleMeta(row);
        await persistArticleMeta(row.id, m);
        done++;
      } catch (err) {
        req.log.warn({ err, id: row.id }, "bulk meta article failed");
        failed++;
      }
    }
  }
  res.json({ done, failed });
});

// ─────────────────────────────── Keywords ───────────────────────────────────

router.get("/admin/seo-pro/keywords", async (_req: Request, res: Response) => {
  const rows = await db.select().from(keywordsTable).orderBy(asc(keywordsTable.term));
  // Pull latest rank per keyword.
  const latestPerKw = await db
    .select({
      keywordId: keywordRanksTable.keywordId,
      position: keywordRanksTable.position,
      url: keywordRanksTable.url,
      checkedAt: keywordRanksTable.checkedAt,
    })
    .from(keywordRanksTable)
    .orderBy(desc(keywordRanksTable.checkedAt));
  const latestMap = new Map<number, { position: number | null; url: string; checkedAt: Date }>();
  for (const r of latestPerKw) {
    if (!latestMap.has(r.keywordId)) latestMap.set(r.keywordId, r);
  }
  const targets = await db.select().from(seoKeywordTargetsTable);
  const targetMap = new Map<number, typeof targets>();
  for (const t of targets) {
    const arr = targetMap.get(t.keywordId) ?? [];
    arr.push(t);
    targetMap.set(t.keywordId, arr);
  }
  res.json({
    keywords: rows.map((k) => ({
      ...k,
      latest: latestMap.get(k.id) ?? null,
      targets: targetMap.get(k.id) ?? [],
    })),
  });
});

const KeywordCreate = z.object({
  term: z.string().min(2),
  market: z.string().optional(),
});
router.post("/admin/seo-pro/keywords", async (req: Request, res: Response) => {
  const parsed = KeywordCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  try {
    const [row] = await db
      .insert(keywordsTable)
      .values({ term: parsed.data.term.toLowerCase().trim(), market: parsed.data.market ?? "IN" })
      .returning();
    res.json(row);
  } catch (err) {
    res.status(409).json({ error: "Keyword already exists" });
  }
});

router.delete("/admin/seo-pro/keywords/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(seoKeywordTargetsTable).where(eq(seoKeywordTargetsTable.keywordId, id));
  await db.delete(keywordRanksTable).where(eq(keywordRanksTable.keywordId, id));
  await db.delete(keywordsTable).where(eq(keywordsTable.id, id));
  res.json({ ok: true });
});

const RankCreate = z.object({
  keywordId: z.number(),
  position: z.number().int().min(1).max(200).nullable(),
  url: z.string().optional(),
  source: z.string().optional(),
});
router.post("/admin/seo-pro/keywords/rank", async (req: Request, res: Response) => {
  const parsed = RankCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .insert(keywordRanksTable)
    .values({
      keywordId: parsed.data.keywordId,
      position: parsed.data.position,
      url: parsed.data.url ?? "",
      source: parsed.data.source ?? "manual",
    })
    .returning();
  res.json(row);
});

const TargetCreate = z.object({
  keywordId: z.number(),
  entityKind: KindSchema,
  entityRef: z.string().min(1),
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]).optional(),
  priority: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});
router.post("/admin/seo-pro/keywords/target", async (req: Request, res: Response) => {
  const parsed = TargetCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const [row] = await db.insert(seoKeywordTargetsTable).values({
    keywordId: parsed.data.keywordId,
    entityKind: parsed.data.entityKind,
    entityRef: parsed.data.entityRef,
    intent: parsed.data.intent ?? "informational",
    priority: parsed.data.priority ?? 3,
    notes: parsed.data.notes ?? "",
  }).returning();
  res.json(row);
});

router.delete("/admin/seo-pro/keywords/target/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const r = await db.delete(seoKeywordTargetsTable).where(eq(seoKeywordTargetsTable.id, id));
  if (!r.rowCount) { res.status(404).json({ error: "Target not found" }); return; }
  res.json({ ok: true });
});

// ─────────────────────────────── Backlinks ──────────────────────────────────

router.get("/admin/seo-pro/backlinks", async (_req: Request, res: Response) => {
  const rows = await db.select().from(seoBacklinksTable).orderBy(desc(seoBacklinksTable.firstSeenAt));
  res.json({ backlinks: rows });
});

const BacklinkCreate = z.object({
  sourceUrl: z.string().url(),
  targetUrl: z.string().min(1),
  anchor: z.string().optional(),
  domainAuthority: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(["live", "lost", "pending", "nofollow"]).optional(),
  notes: z.string().optional(),
});
router.post("/admin/seo-pro/backlinks", async (req: Request, res: Response) => {
  const parsed = BacklinkCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  let domain = "";
  try {
    domain = new URL(parsed.data.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    res.status(400).json({ error: "Invalid sourceUrl" });
    return;
  }
  const [row] = await db.insert(seoBacklinksTable).values({
    sourceUrl: parsed.data.sourceUrl,
    sourceDomain: domain,
    targetUrl: parsed.data.targetUrl,
    anchor: parsed.data.anchor ?? "",
    domainAuthority: parsed.data.domainAuthority ?? null,
    status: parsed.data.status ?? "pending",
    notes: parsed.data.notes ?? "",
  }).returning();
  res.json(row);
});

const BacklinkPatch = z.object({
  status: z.enum(["live", "lost", "pending", "nofollow"]).optional(),
  anchor: z.string().optional(),
  notes: z.string().optional(),
  domainAuthority: z.number().min(0).max(100).nullable().optional(),
});
router.patch("/admin/seo-pro/backlinks/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = BacklinkPatch.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const patch: Record<string, unknown> = { lastCheckedAt: new Date() };
  if (parsed.data.status) patch.status = parsed.data.status;
  if (typeof parsed.data.anchor === "string") patch.anchor = parsed.data.anchor;
  if (typeof parsed.data.notes === "string") patch.notes = parsed.data.notes;
  if (parsed.data.domainAuthority !== undefined) patch.domainAuthority = parsed.data.domainAuthority;
  const r = await db.update(seoBacklinksTable).set(patch).where(eq(seoBacklinksTable.id, id));
  if (!r.rowCount) { res.status(404).json({ error: "Backlink not found" }); return; }
  res.json({ ok: true });
});

router.delete("/admin/seo-pro/backlinks/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const r = await db.delete(seoBacklinksTable).where(eq(seoBacklinksTable.id, id));
  if (!r.rowCount) { res.status(404).json({ error: "Backlink not found" }); return; }
  res.json({ ok: true });
});

// ─────────────────────────────── Outreach ───────────────────────────────────

router.get("/admin/seo-pro/outreach", async (_req: Request, res: Response) => {
  const rows = await db.select().from(seoOutreachTable).orderBy(desc(seoOutreachTable.createdAt));
  res.json({ outreach: rows });
});

const OutreachCreate = z.object({
  prospectDomain: z.string().min(2),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  angle: z.string().optional(),
  ourUrl: z.string().optional(),
});
router.post("/admin/seo-pro/outreach", async (req: Request, res: Response) => {
  const parsed = OutreachCreate.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const [row] = await db.insert(seoOutreachTable).values({
    prospectDomain: parsed.data.prospectDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
    contactName: parsed.data.contactName ?? "",
    contactEmail: parsed.data.contactEmail ?? "",
    angle: parsed.data.angle ?? "",
    ourUrl: parsed.data.ourUrl ?? "",
    status: "prospect",
    draft: "",
  }).returning();
  res.json(row);
});

const OutreachPatch = z.object({
  status: z.enum(["prospect", "contacted", "replied", "secured", "lost"]).optional(),
  draft: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  angle: z.string().optional(),
  ourUrl: z.string().optional(),
});
router.patch("/admin/seo-pro/outreach/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = OutreachPatch.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const patch: Record<string, unknown> = { lastTouchedAt: new Date() };
  if (parsed.data.status) patch.status = parsed.data.status;
  if (typeof parsed.data.draft === "string") patch.draft = parsed.data.draft;
  if (typeof parsed.data.contactName === "string") patch.contactName = parsed.data.contactName;
  if (typeof parsed.data.contactEmail === "string") patch.contactEmail = parsed.data.contactEmail;
  if (typeof parsed.data.angle === "string") patch.angle = parsed.data.angle;
  if (typeof parsed.data.ourUrl === "string") patch.ourUrl = parsed.data.ourUrl;
  const r = await db.update(seoOutreachTable).set(patch).where(eq(seoOutreachTable.id, id));
  if (!r.rowCount) { res.status(404).json({ error: "Outreach prospect not found" }); return; }
  res.json({ ok: true });
});

router.delete("/admin/seo-pro/outreach/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const r = await db.delete(seoOutreachTable).where(eq(seoOutreachTable.id, id));
  if (!r.rowCount) { res.status(404).json({ error: "Outreach prospect not found" }); return; }
  res.json({ ok: true });
});

const OutreachDraftBody = z.object({
  id: z.number(),
});
router.post("/admin/seo-pro/outreach/draft", async (req: Request, res: Response) => {
  const parsed = OutreachDraftBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const [row] = await db.select().from(seoOutreachTable).where(eq(seoOutreachTable.id, parsed.data.id)).limit(1);
  if (!row) { res.status(404).json({ error: "Outreach prospect not found" }); return; }
  const draft = await draftOutreach({
    prospectDomain: row.prospectDomain,
    contactName: row.contactName || undefined,
    angle: row.angle || "We publish in-depth tea education content that fits your audience",
    ourUrl: row.ourUrl || "https://drtea.in",
  });
  if (!draft) { res.status(502).json({ error: "AI draft failed" }); return; }
  const drafted = `Subject: ${draft.subject}\n\n${draft.body}`;
  await db.update(seoOutreachTable).set({ draft: drafted, lastTouchedAt: new Date() }).where(eq(seoOutreachTable.id, parsed.data.id));
  res.json({ subject: draft.subject, body: draft.body });
});

// ─────────────────────────────── Audit history ──────────────────────────────

router.get("/admin/seo-pro/audits/:kind/:ref", async (req: Request, res: Response) => {
  const kindParsed = KindSchema.safeParse(req.params.kind);
  if (!kindParsed.success) { res.status(400).json({ error: "Invalid kind" }); return; }
  const rows = await db
    .select()
    .from(seoAuditRunsTable)
    .where(and(eq(seoAuditRunsTable.entityKind, kindParsed.data), eq(seoAuditRunsTable.entityRef, req.params.ref)))
    .orderBy(desc(seoAuditRunsTable.createdAt))
    .limit(20);
  res.json({ audits: rows });
});

// ─────────────────────────────── Dashboard rollup ───────────────────────────

router.get("/admin/seo-pro/dashboard", async (_req: Request, res: Response) => {
  const [productsCount, articlesCount, backlinksCount, outreachCount, keywordsCount, opportunities] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(productsTable),
    db.select({ c: sql<number>`count(*)::int` }).from(articlesTable).where(eq(articlesTable.published, true)),
    db.select({ c: sql<number>`count(*)::int` }).from(seoBacklinksTable),
    db.select({ c: sql<number>`count(*)::int` }).from(seoOutreachTable),
    db.select({ c: sql<number>`count(*)::int` }).from(keywordsTable),
    siteWideOpportunities(),
  ]);
  const avgScore = opportunities.length > 0
    ? Math.round(opportunities.reduce((a, b) => a + b.score, 0) / opportunities.length)
    : 100;
  res.json({
    counts: {
      products: productsCount[0]?.c ?? 0,
      articles: articlesCount[0]?.c ?? 0,
      backlinks: backlinksCount[0]?.c ?? 0,
      outreach: outreachCount[0]?.c ?? 0,
      keywords: keywordsCount[0]?.c ?? 0,
    },
    avgScore,
    opportunities: opportunities.slice(0, 15),
  });
});

export default router;
