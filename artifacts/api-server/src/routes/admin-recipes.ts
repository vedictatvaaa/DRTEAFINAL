import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, recipesTable, type RecipeDifficulty } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { schedulePing } from "../lib/seo-ping";
import { logger } from "../lib/logger";
import {
  generateRecipeDrafts,
  regenerateHeroForRecipe,
} from "../lib/recipes-cron";

const router: IRouter = Router();
router.use("/admin/recipes", requireAdmin);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const Ingredient = z.object({
  name: z.string().min(1).max(120),
  amount: z.string().max(60).default(""),
  note: z.string().max(160).optional(),
});
const Step = z.object({
  title: z.string().max(120).optional(),
  body: z.string().min(1).max(1000),
});

const RecipeBody = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(400),
  hero: z.string().max(500).optional().default(""),
  category: z.string().trim().min(1).max(60).default("Chai"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
  prepMinutes: z.number().int().min(0).max(480).default(5),
  cookMinutes: z.number().int().min(0).max(480).default(10),
  servings: z.number().int().min(1).max(40).default(2),
  ingredients: z.array(Ingredient).max(60).default([]),
  steps: z.array(Step).max(40).default([]),
  tips: z.array(z.string().min(1).max(280)).max(20).default([]),
  relatedProductIds: z.array(z.string().min(1).max(80)).max(20).default([]),
  metaTitle: z.string().max(180).optional().default(""),
  metaDescription: z.string().max(320).optional().default(""),
  published: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
  authorName: z.string().max(80).optional().default(""),
  authorAvatar: z.string().max(500).optional().default(""),
  authorLocation: z.string().max(80).optional().default(""),
  authorQuote: z.string().max(400).optional().default(""),
  origin: z.string().max(80).optional().default(""),
  storyMode: z
    .array(
      z.object({
        image: z.string().max(500),
        title: z.string().max(120).optional(),
        caption: z.string().max(400),
      }),
    )
    .max(10)
    .optional()
    .default([]),
  hashtags: z.array(z.string().max(40)).max(20).optional().default([]),
  seoKeywords: z.array(z.string().max(120)).max(20).optional().default([]),
  status: z.enum(["pending", "approved", "rejected"]).optional().default("approved"),
});
type RecipeInput = z.infer<typeof RecipeBody>;

const ListQuery = z.object({
  category: z.string().trim().min(1).max(60).optional(),
  published: z.enum(["true", "false"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

router.get("/admin/recipes", async (req: Request, res: Response) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  try {
    const filters: SQL[] = [];
    if (parsed.data.category) {
      filters.push(eq(recipesTable.category, parsed.data.category));
    }
    if (parsed.data.published !== undefined) {
      filters.push(eq(recipesTable.published, parsed.data.published === "true"));
    }
    if (parsed.data.q) {
      const like = `%${parsed.data.q}%`;
      const cond = or(
        ilike(recipesTable.title, like),
        ilike(recipesTable.summary, like),
        ilike(recipesTable.slug, like),
      );
      if (cond) filters.push(cond);
    }
    const rows = await db
      .select()
      .from(recipesTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(
        desc(recipesTable.sortOrder),
        desc(recipesTable.updatedAt),
      )
      .limit(parsed.data.limit);
    res.json({ recipes: rows });
  } catch (err) {
    logger.error({ err }, "admin.recipes.list failed");
    res.status(500).json({ error: "Could not load recipes." });
  }
});

router.get("/admin/recipes/categories", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        category: recipesTable.category,
        count: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${recipesTable.published})::int`,
      })
      .from(recipesTable)
      .groupBy(recipesTable.category)
      .orderBy(desc(sql<number>`count(*)`));
    res.json({ categories: rows });
  } catch (err) {
    logger.error({ err }, "admin.recipes.categories failed");
    res.status(500).json({ error: "Could not load categories." });
  }
});

router.get("/admin/recipes/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(recipesTable)
      .where(eq(recipesTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ recipe: row });
  } catch (err) {
    logger.error({ err }, "admin.recipes.get failed");
    res.status(500).json({ error: "Could not load recipe." });
  }
});

async function ensureUniqueSlug(base: string, excludeId?: number): Promise<string> {
  const seed = slugify(base) || `recipe-${Date.now()}`;
  let candidate = seed;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [existing] = await db
      .select({ id: recipesTable.id })
      .from(recipesTable)
      .where(eq(recipesTable.slug, candidate))
      .limit(1);
    if (!existing || existing.id === excludeId) return candidate;
    n += 1;
    candidate = `${seed}-${n}`;
    if (n > 100) throw new Error("Could not allocate unique slug");
  }
}

router.post("/admin/recipes", async (req: Request, res: Response) => {
  const parsed = RecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const data: RecipeInput = parsed.data;
  try {
    const slug = await ensureUniqueSlug(data.slug || data.title);
    const status = data.status;
    const published = status === "approved" ? data.published : false;
    const [row] = await db
      .insert(recipesTable)
      .values({
        slug,
        title: data.title,
        summary: data.summary,
        hero: data.hero,
        category: data.category,
        tags: data.tags,
        difficulty: data.difficulty as RecipeDifficulty,
        prepMinutes: data.prepMinutes,
        cookMinutes: data.cookMinutes,
        servings: data.servings,
        ingredients: data.ingredients,
        steps: data.steps,
        tips: data.tips,
        relatedProductIds: data.relatedProductIds,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        published,
        sortOrder: data.sortOrder,
        authorName: data.authorName,
        authorAvatar: data.authorAvatar,
        authorLocation: data.authorLocation,
        authorQuote: data.authorQuote,
        origin: data.origin,
        storyMode: data.storyMode,
        hashtags: data.hashtags,
        seoKeywords: data.seoKeywords,
        authorType: "manual",
        status,
      })
      .returning();
    void recordActivity({
      kind: "recipe_created",
      title: `Created recipe: ${row.title}`,
      summary: data.published ? "Published immediately" : "Saved as draft",
      entityType: "recipe",
      entityId: row.id,
    });
    if (row.published) schedulePing();
    res.status(201).json({ recipe: row });
  } catch (err) {
    logger.error({ err }, "admin.recipes.create failed");
    res.status(500).json({ error: "Could not create recipe." });
  }
});

router.patch("/admin/recipes/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = RecipeBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  try {
    const [before] = await db
      .select()
      .from(recipesTable)
      .where(eq(recipesTable.id, id))
      .limit(1);
    if (!before) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const patch: Partial<typeof recipesTable.$inferInsert> = {
      ...(parsed.data as Partial<typeof recipesTable.$inferInsert>),
      updatedAt: new Date(),
    };
    if (parsed.data.slug && parsed.data.slug !== before.slug) {
      patch.slug = await ensureUniqueSlug(parsed.data.slug, id);
    }
    const nextStatus = (patch.status ?? before.status) as
      | "pending"
      | "approved"
      | "rejected";
    if (nextStatus !== "approved") {
      patch.published = false;
    } else if (patch.published === undefined && before.status !== "approved") {
      patch.published = true;
    }
    const [row] = await db
      .update(recipesTable)
      .set(patch)
      .where(eq(recipesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const publishedChanged = before.published !== row.published;
    const slugChanged = before.slug !== row.slug;
    if (publishedChanged) {
      void recordActivity({
        kind: row.published ? "recipe_published" : "recipe_unpublished",
        title: `${row.published ? "Published" : "Unpublished"} recipe: ${row.title}`,
        entityType: "recipe",
        entityId: id,
      });
    } else {
      void recordActivity({
        kind: "recipe_updated",
        title: `Updated recipe: ${row.title}`,
        summary: Object.keys(parsed.data).join(", "),
        entityType: "recipe",
        entityId: id,
      });
    }
    if (publishedChanged || slugChanged || (row.published && before.category !== row.category)) {
      schedulePing();
    }
    res.json({ recipe: row });
  } catch (err) {
    logger.error({ err }, "admin.recipes.update failed");
    res.status(500).json({ error: "Could not update recipe." });
  }
});

router.post("/admin/recipes/generate-now", async (_req: Request, res: Response) => {
  try {
    const result = await generateRecipeDrafts();
    res.json(result);
  } catch (err) {
    logger.error({ err }, "admin.recipes.generate-now failed");
    res.status(500).json({ error: "Could not generate recipes." });
  }
});

router.post(
  "/admin/recipes/:id/regenerate-image",
  async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const result = await regenerateHeroForRecipe(id);
      res.json(result);
    } catch (err) {
      logger.error({ err, id }, "admin.recipes.regenerate-image failed");
      res.status(500).json({ error: "Could not regenerate image." });
    }
  },
);

router.post("/admin/recipes/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .update(recipesTable)
      .set({ status: "approved", published: true, updatedAt: new Date() })
      .where(eq(recipesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    void recordActivity({
      kind: "recipe_published",
      title: `Approved recipe: ${row.title}`,
      entityType: "recipe",
      entityId: id,
    });
    schedulePing();
    res.json({ recipe: row });
  } catch (err) {
    logger.error({ err, id }, "admin.recipes.approve failed");
    res.status(500).json({ error: "Could not approve recipe." });
  }
});

router.post("/admin/recipes/:id/reject", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .update(recipesTable)
      .set({ status: "rejected", published: false, updatedAt: new Date() })
      .where(eq(recipesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ recipe: row });
  } catch (err) {
    logger.error({ err, id }, "admin.recipes.reject failed");
    res.status(500).json({ error: "Could not reject recipe." });
  }
});

router.delete("/admin/recipes/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [before] = await db
      .select()
      .from(recipesTable)
      .where(eq(recipesTable.id, id))
      .limit(1);
    await db.delete(recipesTable).where(eq(recipesTable.id, id));
    if (before) {
      void recordActivity({
        kind: "recipe_deleted",
        title: `Deleted recipe: ${before.title}`,
        entityType: "recipe",
        entityId: id,
      });
      if (before.published) schedulePing();
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.recipes.delete failed");
    res.status(500).json({ error: "Could not delete recipe." });
  }
});

export default router;
