import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  db,
  articlesTable,
  teapediaEntriesTable,
  recipesTable,
  contentHubEntriesTable,
} from "../lib/db";
import { generateAndStoreImage } from "../lib/campaign-image-gen";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";

const router: Router = Router();
router.use("/admin/images", requireAdmin);

type Scope = "journal" | "teapedia" | "recipes" | "content-hub" | "all";

const Body = z.object({
  scope: z.enum(["journal", "teapedia", "recipes", "content-hub", "all"]).default("all"),
  limit: z.number().int().min(1).max(500).default(200),
  onlyMissing: z.boolean().default(false),
});

// Subject-only prompts. The visual *setup* (setting, lighting, lens, palette,
// composition) is chosen per-item by sceneVariation(seed) so two posts never
// share the same look.

const RECIPE_PROMPT = (r: { title: string; summary: string; category: string; origin?: string | null }) =>
  `Subject: a finished cup of "${r.title}" — a ${r.category.toLowerCase()} tea recipe${
    r.origin ? ` from ${r.origin}` : ""
  }. Show steam rising from the brewed cup with the key ingredients suggested by this description scattered in-frame: ${r.summary}`;

const TEAPEDIA_PROMPT = (e: { title: string; summary: string; category: string }) =>
  `Subject: an editorial illustration of "${e.title}" (${e.category}). Feature authentic tea leaves, brewed liquor and any traditional teaware appropriate to the topic. Topic detail: ${e.summary}`;

const HUB_PROMPT = (e: { title: string; summary: string; hub: string; category: string }) =>
  `Subject: a human moment matching the article "${e.title}" — ${e.hub}, ${e.category}. Show real people, gestures or cultural details consistent with this description: ${e.summary}`;

const ARTICLE_PROMPT = (a: { title: string; excerpt: string; category: string }) =>
  `Subject: an editorial hero image for a journal article titled "${a.title}" (${a.category}). Capture the moment described: ${a.excerpt}`;

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = 3,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        const item = items[idx]!;
        try {
          await worker(item);
          ok += 1;
        } catch (err) {
          failed += 1;
          logger.warn({ err }, "image backfill: item failed");
        }
      }
    }),
  );
  return { ok, failed };
}

async function backfillRecipes(limit: number, onlyMissing: boolean) {
  const rows = await db.select().from(recipesTable).limit(limit);
  const targets = onlyMissing ? rows.filter((r) => !r.hero) : rows;
  return runWithConcurrency(targets, async (r) => {
    const url = await generateAndStoreImage(RECIPE_PROMPT(r), "1536x1024", {
      seed: `recipe-${r.id}-${r.slug ?? r.title}`,
      sceneKind: "recipe",
    });
    await db
      .update(recipesTable)
      .set({ hero: url, updatedAt: new Date() })
      .where(eq(recipesTable.id, r.id));
  });
}

async function backfillTeapedia(limit: number, onlyMissing: boolean) {
  const rows = await db.select().from(teapediaEntriesTable).limit(limit);
  const targets = onlyMissing ? rows.filter((r) => !r.hero) : rows;
  return runWithConcurrency(targets, async (e) => {
    const url = await generateAndStoreImage(TEAPEDIA_PROMPT(e), "1536x1024", {
      seed: `teapedia-${e.id}-${e.slug ?? e.title}`,
      sceneKind: "teapedia",
    });
    await db
      .update(teapediaEntriesTable)
      .set({ hero: url, updatedAt: new Date() })
      .where(eq(teapediaEntriesTable.id, e.id));
  });
}

async function backfillContentHub(limit: number, onlyMissing: boolean) {
  const rows = await db.select().from(contentHubEntriesTable).limit(limit);
  const targets = onlyMissing ? rows.filter((r) => !r.hero) : rows;
  return runWithConcurrency(targets, async (e) => {
    const url = await generateAndStoreImage(HUB_PROMPT(e), "1536x1024", {
      seed: `hub-${e.id}-${e.slug ?? e.title}`,
      sceneKind: "hub",
    });
    await db
      .update(contentHubEntriesTable)
      .set({ hero: url, updatedAt: new Date() })
      .where(eq(contentHubEntriesTable.id, e.id));
  });
}

async function backfillJournal(limit: number, onlyMissing: boolean) {
  const rows = await db.select().from(articlesTable).limit(limit);
  const targets = onlyMissing ? rows.filter((r) => !r.cover) : rows;
  return runWithConcurrency(targets, async (a) => {
    const url = await generateAndStoreImage(
      ARTICLE_PROMPT({ title: a.title, excerpt: a.excerpt, category: a.category }),
      "1536x1024",
      {
        seed: `journal-${a.id}-${a.slug ?? a.title}`,
        sceneKind: "journal",
      },
    );
    await db
      .update(articlesTable)
      .set({ cover: url, updatedAt: new Date() })
      .where(eq(articlesTable.id, a.id));
  });
}

router.post("/admin/images/backfill", async (req: Request, res: Response) => {
  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { scope, limit, onlyMissing } = parsed.data;

  // Fire-and-forget: image regeneration takes minutes per item. Respond
  // immediately with a queued status; the operator can refresh listings to
  // see new heroes appear as they finish.
  const scopes: Scope[] =
    scope === "all" ? ["journal", "teapedia", "recipes", "content-hub"] : [scope];

  void (async () => {
    for (const s of scopes) {
      try {
        const result =
          s === "journal"
            ? await backfillJournal(limit, onlyMissing)
            : s === "teapedia"
              ? await backfillTeapedia(limit, onlyMissing)
              : s === "recipes"
                ? await backfillRecipes(limit, onlyMissing)
                : await backfillContentHub(limit, onlyMissing);
        logger.info({ scope: s, ...result }, "image backfill scope finished");
      } catch (err) {
        logger.error({ err, scope: s }, "image backfill scope failed");
      }
    }
  })();

  res.json({ queued: true, scopes, limit, onlyMissing });
});

export default router;
