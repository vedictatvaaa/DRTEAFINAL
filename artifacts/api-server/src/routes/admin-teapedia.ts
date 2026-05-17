import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, teapediaEntriesTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  generateTeapediaDrafts,
  relinkAllEntries,
  autoLinkEntry,
  backfillHeroImages,
  regenerateHeroForEntryId,
} from "../lib/teapedia-cron";
import { schedulePing } from "../lib/seo-ping";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/teapedia", requireAdmin);

const CreateBody = z.object({
  slug: z.string().min(2).max(120).optional(),
  title: z.string().min(4).max(200),
  summary: z.string().min(10).max(400),
  category: z.string().min(2).max(60).default("Types"),
  tags: z.array(z.string().max(40)).max(10).default([]),
  hero: z.string().url().max(800).optional().default(""),
  body: z
    .array(
      z.object({
        heading: z.string().max(200).optional(),
        paragraphs: z.array(z.string().min(1).max(3000)).min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
  metaTitle: z.string().max(80).optional().default(""),
  metaDescription: z.string().max(200).optional().default(""),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

router.get("/admin/teapedia/list", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(teapediaEntriesTable)
    .orderBy(desc(teapediaEntriesTable.createdAt))
    .limit(500);
  res.json(rows);
});

router.post("/admin/teapedia", async (req: Request, res: Response) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const slug = parsed.data.slug
    ? slugify(parsed.data.slug)
    : slugify(parsed.data.title);
  const fullText = [
    parsed.data.title,
    parsed.data.summary,
    ...parsed.data.body.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
  ].join("\n");
  const links = await autoLinkEntry(fullText);
  try {
    const [row] = await db
      .insert(teapediaEntriesTable)
      .values({
        slug,
        title: parsed.data.title,
        summary: parsed.data.summary,
        category: parsed.data.category,
        tags: parsed.data.tags,
        hero: parsed.data.hero,
        body: parsed.data.body,
        relatedProductIds: links.productIds,
        relatedCategorySlugs: links.categorySlugs,
        metaTitle: parsed.data.metaTitle,
        metaDescription: parsed.data.metaDescription,
        authorType: "admin",
        status: "approved",
        published: true,
      })
      .returning();
    schedulePing();
    res.status(201).json(row);
  } catch (err) {
    const msg = (err as { message?: string }).message ?? "";
    if (/duplicate key|unique/i.test(msg)) {
      res.status(409).json({ error: "Slug already exists" });
      return;
    }
    logger.error({ err }, "Teapedia create failed");
    res.status(500).json({ error: "Create failed" });
  }
});

router.post("/admin/teapedia/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .update(teapediaEntriesTable)
    .set({ status: "approved", published: true, updatedAt: new Date() })
    .where(eq(teapediaEntriesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  schedulePing();
  res.json({ ok: true, entry: row });
});

router.post("/admin/teapedia/:id/reject", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const reason =
    typeof req.body?.reason === "string"
      ? String(req.body.reason).slice(0, 240)
      : "Rejected by admin";
  const [row] = await db
    .update(teapediaEntriesTable)
    .set({
      status: "rejected",
      published: false,
      moderationReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(teapediaEntriesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true, entry: row });
});

router.delete("/admin/teapedia/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(teapediaEntriesTable).where(eq(teapediaEntriesTable.id, id));
  res.json({ ok: true });
});

router.post(
  "/admin/teapedia/generate-now",
  async (_req: Request, res: Response) => {
    try {
      const out = await generateTeapediaDrafts();
      res.json({ ok: true, ...out });
    } catch (err) {
      logger.error({ err }, "Manual teapedia generation failed");
      res.status(500).json({ error: "Generation failed" });
    }
  },
);

router.post(
  "/admin/teapedia/backfill-images",
  async (req: Request, res: Response) => {
    const limit = Number(req.body?.limit);
    const force = Boolean(req.body?.force);
    try {
      const out = await backfillHeroImages({
        limit: Number.isFinite(limit) ? limit : 10,
        force,
      });
      res.json({ ok: true, ...out });
    } catch (err) {
      logger.error({ err }, "Teapedia hero backfill failed");
      res.status(500).json({ error: "Backfill failed" });
    }
  },
);

router.post(
  "/admin/teapedia/:id/regenerate-image",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const out = await regenerateHeroForEntryId(id);
      if (!out.url) {
        res.status(500).json({ error: "Image generation failed" });
        return;
      }
      res.json({ ok: true, hero: out.url });
    } catch (err) {
      logger.error({ err, id }, "Teapedia hero regenerate failed");
      res.status(500).json({ error: "Regeneration failed" });
    }
  },
);

router.post("/admin/teapedia/relink", async (_req: Request, res: Response) => {
  try {
    const out = await relinkAllEntries();
    res.json({ ok: true, ...out });
  } catch (err) {
    logger.error({ err }, "Relink failed");
    res.status(500).json({ error: "Relink failed" });
  }
});

export default router;
