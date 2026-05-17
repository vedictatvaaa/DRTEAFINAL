import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { db, teapediaEntriesTable, productsTable } from "../lib/db";

const router: IRouter = Router();

// Lightweight projection used by the listing page — never include `body` or
// large jsonb columns since list cards only need card-level fields.
const listColumns = {
  id: teapediaEntriesTable.id,
  slug: teapediaEntriesTable.slug,
  title: teapediaEntriesTable.title,
  summary: teapediaEntriesTable.summary,
  category: teapediaEntriesTable.category,
  tags: teapediaEntriesTable.tags,
  hero: teapediaEntriesTable.hero,
  viewCount: teapediaEntriesTable.viewCount,
  updatedAt: teapediaEntriesTable.updatedAt,
};

router.get("/teapedia", async (req: Request, res: Response) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const tag = typeof req.query.tag === "string" ? req.query.tag.toLowerCase() : undefined;
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : undefined;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 60;

  const where = [eq(teapediaEntriesTable.published, true)];
  if (category) where.push(eq(teapediaEntriesTable.category, category));
  if (q) {
    const like = `%${q}%`;
    const matches = or(
      ilike(teapediaEntriesTable.title, like),
      ilike(teapediaEntriesTable.summary, like),
    );
    if (matches) where.push(matches);
  }
  if (tag) {
    // jsonb array containment with a single lowercased element.
    where.push(
      sql`lower(${teapediaEntriesTable.tags}::text)::jsonb @> ${JSON.stringify([tag])}::jsonb`,
    );
  }

  const rows = await db
    .select(listColumns)
    .from(teapediaEntriesTable)
    .where(and(...where))
    .orderBy(desc(teapediaEntriesTable.viewCount), desc(teapediaEntriesTable.updatedAt))
    .limit(limit);
  res.json(rows);
});

router.get("/teapedia/categories", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      category: teapediaEntriesTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(teapediaEntriesTable)
    .where(eq(teapediaEntriesTable.published, true))
    .groupBy(teapediaEntriesTable.category)
    .orderBy(desc(sql<number>`count(*)`));
  res.json(rows);
});

router.get("/teapedia/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const [row] = await db
    .select()
    .from(teapediaEntriesTable)
    .where(
      and(
        eq(teapediaEntriesTable.slug, slug),
        eq(teapediaEntriesTable.published, true),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const products = (row.relatedProductIds ?? []).length
    ? await db
        .select()
        .from(productsTable)
        .where(inArray(productsTable.id, row.relatedProductIds ?? []))
    : [];
  const related = (row.relatedEntrySlugs ?? []).length
    ? await db
        .select({
          slug: teapediaEntriesTable.slug,
          title: teapediaEntriesTable.title,
          summary: teapediaEntriesTable.summary,
          category: teapediaEntriesTable.category,
          hero: teapediaEntriesTable.hero,
        })
        .from(teapediaEntriesTable)
        .where(
          and(
            eq(teapediaEntriesTable.published, true),
            inArray(teapediaEntriesTable.slug, row.relatedEntrySlugs ?? []),
          ),
        )
    : [];
  res.json({ entry: row, relatedProducts: products, relatedEntries: related });
});

router.post("/teapedia/:slug/view", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  await db
    .update(teapediaEntriesTable)
    .set({ viewCount: sql`${teapediaEntriesTable.viewCount} + 1` })
    .where(eq(teapediaEntriesTable.slug, slug));
  res.json({ ok: true });
});

export default router;
