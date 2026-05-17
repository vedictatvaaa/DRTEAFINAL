import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { db, recipesTable, productsTable } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Card-level projection — never includes ingredients/steps/tips so listing
// payloads stay small even with hundreds of recipes.
const listColumns = {
  id: recipesTable.id,
  slug: recipesTable.slug,
  title: recipesTable.title,
  summary: recipesTable.summary,
  hero: recipesTable.hero,
  category: recipesTable.category,
  tags: recipesTable.tags,
  difficulty: recipesTable.difficulty,
  prepMinutes: recipesTable.prepMinutes,
  cookMinutes: recipesTable.cookMinutes,
  servings: recipesTable.servings,
  viewCount: recipesTable.viewCount,
  origin: recipesTable.origin,
  authorName: recipesTable.authorName,
  authorAvatar: recipesTable.authorAvatar,
  authorLocation: recipesTable.authorLocation,
  hashtags: recipesTable.hashtags,
  updatedAt: recipesTable.updatedAt,
};

router.get("/recipes", async (req: Request, res: Response) => {
  const category = typeof req.query["category"] === "string" ? req.query["category"] : undefined;
  const tag = typeof req.query["tag"] === "string" ? String(req.query["tag"]).toLowerCase() : undefined;
  const productId = typeof req.query["productId"] === "string" ? String(req.query["productId"]) : undefined;
  const q = typeof req.query["q"] === "string" ? String(req.query["q"]).trim().toLowerCase() : undefined;
  const rawLimit = Number(req.query["limit"]);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 200;

  try {
    const where = [eq(recipesTable.published, true)];
    if (category) where.push(eq(recipesTable.category, category));
    if (q) {
      const like = `%${q}%`;
      const matches = or(ilike(recipesTable.title, like), ilike(recipesTable.summary, like));
      if (matches) where.push(matches);
    }
    if (tag) {
      where.push(
        sql`lower(${recipesTable.tags}::text)::jsonb @> ${JSON.stringify([tag])}::jsonb`,
      );
    }
    if (productId) {
      where.push(
        sql`${recipesTable.relatedProductIds}::jsonb @> ${JSON.stringify([productId])}::jsonb`,
      );
    }

    const rows = await db
      .select(listColumns)
      .from(recipesTable)
      .where(and(...where))
      .orderBy(desc(recipesTable.sortOrder), desc(recipesTable.viewCount), desc(recipesTable.updatedAt))
      .limit(limit);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "recipes.list failed");
    res.status(500).json({ error: "Could not load recipes." });
  }
});

router.get("/recipes/categories", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        category: recipesTable.category,
        count: sql<number>`count(*)::int`,
      })
      .from(recipesTable)
      .where(eq(recipesTable.published, true))
      .groupBy(recipesTable.category)
      .orderBy(desc(sql<number>`count(*)`));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "recipes.categories failed");
    res.status(500).json({ error: "Could not load categories." });
  }
});

router.get("/recipes/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params["slug"] ?? "");
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(recipesTable)
      .where(and(eq(recipesTable.slug, slug), eq(recipesTable.published, true)))
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
    res.json({ recipe: row, relatedProducts: products });
  } catch (err) {
    logger.error({ err, slug }, "recipes.detail failed");
    res.status(500).json({ error: "Could not load recipe." });
  }
});

router.post("/recipes/:slug/view", async (req: Request, res: Response) => {
  const slug = String(req.params["slug"] ?? "");
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }
  try {
    await db
      .update(recipesTable)
      .set({ viewCount: sql`${recipesTable.viewCount} + 1` })
      .where(eq(recipesTable.slug, slug));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, slug }, "recipes.view failed");
    res.status(500).json({ error: "Could not record view." });
  }
});

export default router;
