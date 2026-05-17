import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, desc, sql, inArray, or, ilike } from "drizzle-orm";
import {
  db,
  contentHubEntriesTable,
  productsTable,
  recipesTable,
  type ContentHubKind,
} from "../lib/db";

const router: IRouter = Router();

const HUBS: readonly ContentHubKind[] = ["pairing", "wellness", "regional"] as const;

function isHub(s: string): s is ContentHubKind {
  return (HUBS as readonly string[]).includes(s);
}

const listColumns = {
  id: contentHubEntriesTable.id,
  slug: contentHubEntriesTable.slug,
  hub: contentHubEntriesTable.hub,
  title: contentHubEntriesTable.title,
  summary: contentHubEntriesTable.summary,
  category: contentHubEntriesTable.category,
  tags: contentHubEntriesTable.tags,
  hero: contentHubEntriesTable.hero,
  viewCount: contentHubEntriesTable.viewCount,
  updatedAt: contentHubEntriesTable.updatedAt,
};

router.get("/content/:hub", async (req: Request, res: Response) => {
  const hub = String(req.params.hub);
  if (!isHub(hub)) {
    res.status(404).json({ error: "Unknown hub" });
    return;
  }
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const tag = typeof req.query.tag === "string" ? req.query.tag.toLowerCase() : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : undefined;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 60;

  const where = [
    eq(contentHubEntriesTable.hub, hub),
    eq(contentHubEntriesTable.published, true),
  ];
  if (category) where.push(eq(contentHubEntriesTable.category, category));
  if (q) {
    const like = `%${q}%`;
    const matches = or(
      ilike(contentHubEntriesTable.title, like),
      ilike(contentHubEntriesTable.summary, like),
    );
    if (matches) where.push(matches);
  }
  if (tag) {
    where.push(
      sql`lower(${contentHubEntriesTable.tags}::text)::jsonb @> ${JSON.stringify([tag])}::jsonb`,
    );
  }
  const rows = await db
    .select(listColumns)
    .from(contentHubEntriesTable)
    .where(and(...where))
    .orderBy(desc(contentHubEntriesTable.viewCount), desc(contentHubEntriesTable.updatedAt))
    .limit(limit);
  res.json(rows);
});

router.get("/content/:hub/categories", async (req: Request, res: Response) => {
  const hub = String(req.params.hub);
  if (!isHub(hub)) {
    res.status(404).json({ error: "Unknown hub" });
    return;
  }
  const rows = await db
    .select({
      category: contentHubEntriesTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(contentHubEntriesTable)
    .where(
      and(
        eq(contentHubEntriesTable.hub, hub),
        eq(contentHubEntriesTable.published, true),
      ),
    )
    .groupBy(contentHubEntriesTable.category)
    .orderBy(desc(sql<number>`count(*)`));
  res.json(rows);
});

router.get("/content/:hub/:slug", async (req: Request, res: Response) => {
  const hub = String(req.params.hub);
  const slug = String(req.params.slug);
  if (!isHub(hub)) {
    res.status(404).json({ error: "Unknown hub" });
    return;
  }
  const [row] = await db
    .select()
    .from(contentHubEntriesTable)
    .where(
      and(
        eq(contentHubEntriesTable.slug, slug),
        eq(contentHubEntriesTable.hub, hub),
        eq(contentHubEntriesTable.published, true),
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
  const recipes = (row.relatedRecipeSlugs ?? []).length
    ? await db
        .select({
          slug: recipesTable.slug,
          title: recipesTable.title,
          summary: recipesTable.summary,
          hero: recipesTable.hero,
          category: recipesTable.category,
        })
        .from(recipesTable)
        .where(
          and(
            eq(recipesTable.published, true),
            inArray(recipesTable.slug, row.relatedRecipeSlugs ?? []),
          ),
        )
    : [];
  const related = (row.relatedEntrySlugs ?? []).length
    ? await db
        .select({
          slug: contentHubEntriesTable.slug,
          title: contentHubEntriesTable.title,
          summary: contentHubEntriesTable.summary,
          category: contentHubEntriesTable.category,
          hero: contentHubEntriesTable.hero,
          hub: contentHubEntriesTable.hub,
        })
        .from(contentHubEntriesTable)
        .where(
          and(
            eq(contentHubEntriesTable.published, true),
            inArray(contentHubEntriesTable.slug, row.relatedEntrySlugs ?? []),
          ),
        )
    : [];
  res.json({ entry: row, relatedProducts: products, relatedRecipes: recipes, relatedEntries: related });
});

router.post("/content/:hub/:slug/view", async (req: Request, res: Response) => {
  const hub = String(req.params.hub);
  const slug = String(req.params.slug);
  if (!isHub(hub)) {
    res.status(404).json({ error: "Unknown hub" });
    return;
  }
  await db
    .update(contentHubEntriesTable)
    .set({ viewCount: sql`${contentHubEntriesTable.viewCount} + 1` })
    .where(
      and(
        eq(contentHubEntriesTable.slug, slug),
        eq(contentHubEntriesTable.hub, hub),
      ),
    );
  res.json({ ok: true });
});

export default router;
