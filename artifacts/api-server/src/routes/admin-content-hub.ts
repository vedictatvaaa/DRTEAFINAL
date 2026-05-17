import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, contentHubEntriesTable, type ContentHubKind } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  generateContentHubDrafts,
  regenerateHeroForContentEntry,
} from "../lib/content-hub-cron";
import { schedulePing } from "../lib/seo-ping";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/content-hub", requireAdmin);

const HubEnum = z.enum(["pairing", "wellness", "regional"]);

const SectionSchema = z.object({
  heading: z.string().max(200).optional(),
  paragraphs: z.array(z.string().min(1).max(3000)).min(1).max(20),
});

const FaqSchema = z.object({
  q: z.string().min(2).max(240),
  a: z.string().min(2).max(2000),
});

const Body = z.object({
  slug: z.string().min(2).max(140).optional(),
  hub: HubEnum,
  title: z.string().min(4).max(200),
  summary: z.string().min(10).max(400),
  category: z.string().max(80).default(""),
  tags: z.array(z.string().max(60)).max(20).default([]),
  hero: z.string().max(800).optional().default(""),
  body: z.array(SectionSchema).min(1).max(25),
  facets: z.record(z.unknown()).nullable().optional(),
  faqs: z.array(FaqSchema).max(20).default([]),
  relatedProductIds: z.array(z.string().max(120)).max(12).default([]),
  relatedRecipeSlugs: z.array(z.string().max(140)).max(12).default([]),
  relatedEntrySlugs: z.array(z.string().max(140)).max(12).default([]),
  metaTitle: z.string().max(80).optional().default(""),
  metaDescription: z.string().max(200).optional().default(""),
  published: z.boolean().optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

router.get("/admin/content-hub/list", async (req: Request, res: Response) => {
  const hub = typeof req.query.hub === "string" ? req.query.hub : undefined;
  const where = hub ? [eq(contentHubEntriesTable.hub, hub as ContentHubKind)] : [];
  const rows = await db
    .select()
    .from(contentHubEntriesTable)
    .where(where.length ? where[0] : undefined)
    .orderBy(desc(contentHubEntriesTable.createdAt))
    .limit(500);
  res.json(rows);
});

router.post("/admin/content-hub", async (req: Request, res: Response) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const slug = parsed.data.slug
    ? slugify(parsed.data.slug)
    : slugify(parsed.data.title);
  try {
    const [row] = await db
      .insert(contentHubEntriesTable)
      .values({
        slug,
        hub: parsed.data.hub,
        title: parsed.data.title,
        summary: parsed.data.summary,
        category: parsed.data.category,
        tags: parsed.data.tags,
        hero: parsed.data.hero ?? "",
        body: parsed.data.body,
        facets: parsed.data.facets ?? null,
        faqs: parsed.data.faqs,
        relatedProductIds: parsed.data.relatedProductIds,
        relatedRecipeSlugs: parsed.data.relatedRecipeSlugs,
        relatedEntrySlugs: parsed.data.relatedEntrySlugs,
        metaTitle: parsed.data.metaTitle,
        metaDescription: parsed.data.metaDescription,
        authorType: "admin",
        status: "approved",
        published: parsed.data.published ?? true,
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
    logger.error({ err }, "Content-hub create failed");
    res.status(500).json({ error: "Create failed" });
  }
});

router.patch("/admin/content-hub/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = Body.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (typeof parsed.data.slug === "string") patch.slug = slugify(parsed.data.slug);
  const [row] = await db
    .update(contentHubEntriesTable)
    .set(patch)
    .where(eq(contentHubEntriesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  schedulePing();
  res.json(row);
});

router.post("/admin/content-hub/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .update(contentHubEntriesTable)
    .set({ status: "approved", published: true, updatedAt: new Date() })
    .where(eq(contentHubEntriesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  schedulePing();
  res.json({ ok: true, entry: row });
});

router.post("/admin/content-hub/:id/reject", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const reason =
    typeof req.body?.reason === "string"
      ? String(req.body.reason).slice(0, 240)
      : "Rejected by admin";
  const [row] = await db
    .update(contentHubEntriesTable)
    .set({
      status: "rejected",
      published: false,
      moderationReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(contentHubEntriesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true, entry: row });
});

router.delete("/admin/content-hub/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(contentHubEntriesTable).where(eq(contentHubEntriesTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/content-hub/generate-now", async (_req: Request, res: Response) => {
  try {
    const out = await generateContentHubDrafts();
    res.json({ ok: true, ...out });
  } catch (err) {
    logger.error({ err }, "Manual content-hub generation failed");
    res.status(500).json({ error: "Generation failed" });
  }
});

router.post(
  "/admin/content-hub/:id/regenerate-image",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const out = await regenerateHeroForContentEntry(id);
      if (!out.url) {
        res.status(500).json({ error: "Image generation failed" });
        return;
      }
      res.json({ ok: true, hero: out.url });
    } catch (err) {
      logger.error({ err, id }, "Content-hub hero regenerate failed");
      res.status(500).json({ error: "Regeneration failed" });
    }
  },
);

export default router;
