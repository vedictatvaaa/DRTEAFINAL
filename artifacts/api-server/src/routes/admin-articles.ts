import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, articlesTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { AdminCreateArticleBody, AdminUpdateArticleBody } from "@workspace/api-zod";
import { recordVersion } from "../lib/version-history";
import { backfillArticleMeta } from "../lib/seo-meta";
import { backfillRelatedForArticle } from "../lib/seo-related";
import { schedulePing } from "../lib/seo-ping";
import { recordActivity } from "../lib/activity-log";

const router: IRouter = Router();

router.use("/admin/articles", requireAdmin);

router.get("/admin/articles", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(articlesTable)
    .orderBy(desc(articlesTable.date));
  res.json(rows);
});

router.post("/admin/articles", async (req: Request, res: Response) => {
  const parsed = AdminCreateArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .insert(articlesTable)
    .values(parsed.data as typeof articlesTable.$inferInsert)
    .returning();
  if (row) {
    await recordVersion("article", row.id, "create", null, row);
    if (row.published) {
      backfillArticleMeta(row);
      backfillRelatedForArticle(row);
      schedulePing();
    }
    void recordActivity({
      kind: "article_created",
      actor: "admin",
      title: `Created article: ${row.title ?? row.slug ?? `#${row.id}`}`,
      summary: row.published ? "Published immediately" : "Saved as draft",
      entityType: "article",
      entityId: row.id,
    });
  }
  res.status(201).json(row);
});

router.patch("/admin/articles/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AdminUpdateArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [before] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
  const [row] = await db
    .update(articlesTable)
    .set({ ...(parsed.data as Partial<typeof articlesTable.$inferInsert>), updatedAt: new Date() })
    .where(eq(articlesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await recordVersion("article", id, "update", before ?? null, row);
  // Admin-override semantics: explicit SEO field edits in the body win;
  // otherwise we only backfill missing values. Use the dedicated regenerate
  // endpoints to force a refresh.
  const body = parsed.data as Record<string, unknown>;
  const adminEditedMeta =
    "metaTitle" in body || "metaDescription" in body || "jsonLd" in body;
  const adminEditedRelated =
    "relatedProductIds" in body || "relatedArticleSlugs" in body;
  const slugChanged = before?.slug !== row.slug;
  const publishedChanged = before?.published !== row.published;
  const categoryChanged = before?.category !== row.category;

  // Audit feed: surface publish state changes as their own kind so the
  // "Articles published this week" filter is one click away.
  if (publishedChanged) {
    void recordActivity({
      kind: row.published ? "article_published" : "article_unpublished",
      actor: "admin",
      title: `${row.published ? "Published" : "Unpublished"} article: ${row.title ?? row.slug ?? `#${row.id}`}`,
      entityType: "article",
      entityId: row.id,
    });
  } else {
    void recordActivity({
      kind: "article_updated",
      actor: "admin",
      title: `Updated article: ${row.title ?? row.slug ?? `#${row.id}`}`,
      summary: Object.keys(parsed.data as Record<string, unknown>).join(", "),
      entityType: "article",
      entityId: row.id,
    });
  }
  if (row.published) {
    if (!adminEditedMeta) backfillArticleMeta(row);
    if (!adminEditedRelated) backfillRelatedForArticle(row);
  }
  // Slug, published-state, or category changes alter the sitemap or category
  // listing pages — re-ping so crawlers refetch.
  if (slugChanged || publishedChanged || categoryChanged) schedulePing();
  res.json(row);
});

router.delete("/admin/articles/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [before] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
  await db.delete(articlesTable).where(eq(articlesTable.id, id));
  if (before) {
    await recordVersion("article", id, "delete", before, null);
    if (before.published) schedulePing();
    void recordActivity({
      kind: "article_deleted",
      actor: "admin",
      title: `Deleted article: ${before.title ?? before.slug ?? `#${id}`}`,
      entityType: "article",
      entityId: id,
    });
  }
  res.json({ ok: true });
});

export default router;
