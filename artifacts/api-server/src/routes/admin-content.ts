import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  contentDraftsTable,
  contentIdeasTable,
  articlesTable,
  productsTable,
  type ContentChannel,
  type ContentKind,
  type ContentStatus,
  type ContentDraftRow,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  generateSocialDraft,
  generateBlogDraft,
} from "../lib/content-studio";
import { refreshTrendIdeas } from "../lib/content-trends-cron";
import { storeImageBuffer } from "../lib/campaign-image-gen";
import { generateImageBuffer, type ImageSize } from "../lib/openaiImage";
import { promoteBlogDraftToArticle } from "../lib/promote-blog-draft";


const router: IRouter = Router();
router.use("/admin/content", requireAdmin);

const CHANNELS = [
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "linkedin",
  "youtube_shorts",
  "blog",
] as const;
const Channel = z.enum(CHANNELS);
const Kind = z.enum(["social", "blog"]);
const Status = z.enum(["draft", "approved", "posted"]);

// ──────────────────────────────────────────────────────────────────────────
// Drafts
// ──────────────────────────────────────────────────────────────────────────

router.get("/admin/content/drafts", async (req: Request, res: Response) => {
  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const channel = typeof req.query.channel === "string" ? req.query.channel : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conditions: SQL[] = [];
  if (kind && Kind.safeParse(kind).success) conditions.push(eq(contentDraftsTable.kind, kind as ContentKind));
  if (channel && Channel.safeParse(channel).success) conditions.push(eq(contentDraftsTable.channel, channel as ContentChannel));
  if (status && Status.safeParse(status).success) conditions.push(eq(contentDraftsTable.status, status as ContentStatus));
  const q = db.select().from(contentDraftsTable).$dynamic();
  if (conditions.length === 1) q.where(conditions[0]!);
  else if (conditions.length > 1) q.where(and(...conditions)!);
  const rows = await q.orderBy(desc(contentDraftsTable.createdAt)).limit(500);
  res.json(rows);
});

const CreateDraftBody = z.object({
  kind: Kind,
  channel: Channel,
  topic: z.string().optional(),
  body: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  cta: z.string().optional(),
  imagePrompt: z.string().optional(),
  title: z.string().optional(),
  scheduledAt: z.string().nullish(),
});
router.post("/admin/content/drafts", async (req: Request, res: Response) => {
  const parsed = CreateDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const v = parsed.data;
  const [row] = await db
    .insert(contentDraftsTable)
    .values({
      kind: v.kind,
      channel: v.channel,
      topic: v.topic ?? "",
      body: v.body ?? "",
      hashtags: v.hashtags ?? [],
      cta: v.cta ?? "",
      imagePrompt: v.imagePrompt ?? "",
      title: v.title ?? "",
      scheduledAt: v.scheduledAt ? new Date(v.scheduledAt) : null,
    })
    .returning();
  res.status(201).json(row);
});

const PatchDraftBody = z.object({
  topic: z.string().optional(),
  body: z.string().optional(),
  title: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  cta: z.string().optional(),
  imagePrompt: z.string().optional(),
  imageRefs: z.array(z.object({ url: z.string(), alt: z.string().optional() })).optional(),
  channel: Channel.optional(),
  status: Status.optional(),
  scheduledAt: z.string().nullish(),
});
router.patch("/admin/content/drafts/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = PatchDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const v = parsed.data;
  const patch: Partial<typeof contentDraftsTable.$inferInsert> = { updatedAt: new Date() };
  if (v.topic !== undefined) patch.topic = v.topic;
  if (v.body !== undefined) patch.body = v.body;
  if (v.title !== undefined) patch.title = v.title;
  if (v.hashtags !== undefined) patch.hashtags = v.hashtags;
  if (v.cta !== undefined) patch.cta = v.cta;
  if (v.imagePrompt !== undefined) patch.imagePrompt = v.imagePrompt;
  if (v.imageRefs !== undefined) patch.imageRefs = v.imageRefs;
  if (v.channel !== undefined) patch.channel = v.channel;
  if (v.status !== undefined) patch.status = v.status;
  if (v.scheduledAt !== undefined) patch.scheduledAt = v.scheduledAt ? new Date(v.scheduledAt) : null;
  const [row] = await db
    .update(contentDraftsTable)
    .set(patch)
    .where(eq(contentDraftsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  res.json(row);
});

router.delete("/admin/content/drafts/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(contentDraftsTable).where(eq(contentDraftsTable.id, id));
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────────────────
// Generation
// ──────────────────────────────────────────────────────────────────────────

const GenerateSocialBody = z.object({
  topic: z.string().min(3),
  channels: z.array(Channel).min(1),
  productId: z.string().optional(),
});
router.post("/admin/content/social/generate", async (req: Request, res: Response) => {
  const parsed = GenerateSocialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { topic, channels, productId } = parsed.data;
  // Filter to valid social-only channels (the blog channel goes through the
  // dedicated blog endpoint so prompts and persistence stay consistent).
  const social = channels.filter((c) => c !== "blog") as ContentChannel[];
  if (!social.length) {
    res.status(400).json({ error: "No social channels selected" });
    return;
  }
  let productHint: string | undefined;
  if (productId) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
    if (p) productHint = `${p.name} (${p.category}) — ${p.shortDescription}`;
  }
  const drafts: ContentDraftRow[] = [];
  for (const channel of social) {
    const out = await generateSocialDraft({ topic, channel, productHint });
    if (!out) continue;
    const [row] = await db
      .insert(contentDraftsTable)
      .values({
        kind: "social" as ContentKind,
        channel,
        topic,
        body: out.body,
        hashtags: out.hashtags,
        cta: out.cta,
        imagePrompt: out.imagePrompt,
        prompt: topic,
      })
      .returning();
    if (row) drafts.push(row);
  }
  if (!drafts.length) {
    res.status(502).json({ error: "AI generation produced no drafts" });
    return;
  }
  res.status(201).json(drafts);
});

const GenerateBlogBody = z.object({
  topic: z.string().min(3),
  audience: z.string().optional(),
});
router.post("/admin/content/blog/generate", async (req: Request, res: Response) => {
  const parsed = GenerateBlogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { topic, audience } = parsed.data;
  const out = await generateBlogDraft({ topic, audience });
  if (!out) {
    res.status(502).json({ error: "AI generation failed" });
    return;
  }
  const [row] = await db
    .insert(contentDraftsTable)
    .values({
      kind: "blog" as ContentKind,
      channel: "blog" as ContentChannel,
      topic,
      title: out.title,
      body: out.body,
      hashtags: out.hashtags,
      cta: out.cta,
      imagePrompt: out.imagePrompt,
      jsonLd: out.jsonLd,
      prompt: topic,
    })
    .returning();
  res.status(201).json(row);
});

// Convert a blog draft into an articles-table row (kept unpublished so the
// editor can review it). Returns the new article id. The auto-publish cron
// reuses the same helper but with `publish: true` once a draft's
// scheduledAt window arrives.
router.post("/admin/content/blog/:id/promote", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [draft] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, id)).limit(1);
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  if (draft.kind !== "blog") {
    res.status(400).json({ error: "Only blog drafts can be promoted to articles" });
    return;
  }
  try {
    const out = await promoteBlogDraftToArticle(draft, { publish: false });
    // Preserve the prior side-effect: manual promote also moves the draft to
    // 'approved' so the operator can see at a glance which drafts have been
    // converted.
    await db
      .update(contentDraftsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(contentDraftsTable.id, id));
    res.json({ articleId: out.articleId, slug: out.slug });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Promote failed" });
  }
});

// CSV export — drafts within an optional date range (by scheduledAt or createdAt).
router.get("/admin/content/drafts.csv", async (req: Request, res: Response) => {
  const since = typeof req.query.since === "string" ? new Date(req.query.since) : undefined;
  const until = typeof req.query.until === "string" ? new Date(req.query.until) : undefined;
  const all = await db.select().from(contentDraftsTable).orderBy(desc(contentDraftsTable.scheduledAt));
  const filtered = all.filter((d) => {
    const ref = d.scheduledAt ?? d.createdAt;
    if (since && ref < since) return false;
    if (until && ref > until) return false;
    return true;
  });
  const headers = [
    "id", "kind", "channel", "status", "scheduledAt", "title", "topic", "body", "hashtags", "cta", "imagePrompt",
  ];
  const escape = (v: unknown): string => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const d of filtered) {
    lines.push(
      [
        d.id,
        d.kind,
        d.channel,
        d.status,
        d.scheduledAt ? d.scheduledAt.toISOString() : "",
        d.title,
        d.topic,
        d.body,
        d.hashtags.join(" "),
        d.cta,
        d.imagePrompt,
      ].map(escape).join(","),
    );
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="content-drafts.csv"`);
  res.send(lines.join("\n"));
});

// ──────────────────────────────────────────────────────────────────────────
// Trend ideas
// ──────────────────────────────────────────────────────────────────────────

router.get("/admin/content/ideas", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(contentIdeasTable)
    .orderBy(desc(contentIdeasTable.createdAt))
    .limit(50);
  res.json(rows);
});

router.post("/admin/content/ideas/refresh", async (_req: Request, res: Response) => {
  const inserted = await refreshTrendIdeas();
  res.json({ inserted });
});

router.patch("/admin/content/ideas/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const dismissed = typeof req.body?.dismissed === "boolean" ? req.body.dismissed : undefined;
  if (dismissed === undefined) {
    res.status(400).json({ error: "Body must include dismissed:boolean" });
    return;
  }
  const [row] = await db
    .update(contentIdeasTable)
    .set({ dismissed })
    .where(eq(contentIdeasTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Idea not found" });
    return;
  }
  res.json(row);
});

// ──────────────────────────────────────────────────────────────────────────
// Image generation — pipes a draft's imagePrompt through the existing
// AI image generator and stores the result in imageRefs.
// ──────────────────────────────────────────────────────────────────────────

const GenerateDraftImageBody = z.object({
  prompt: z.string().optional(),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
  alt: z.string().optional(),
});
router.post("/admin/content/drafts/:id/generate-image", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = GenerateDraftImageBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [draft] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, id)).limit(1);
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  const promptText = (parsed.data.prompt ?? draft.imagePrompt ?? "").trim();
  if (!promptText) {
    res.status(400).json({ error: "No image prompt available — set draft.imagePrompt or pass prompt" });
    return;
  }
  let buffer: Buffer;
  try {
    buffer = await generateImageBuffer(promptText, (parsed.data.size as ImageSize) ?? "1024x1024");
  } catch (err) {
    req.log.error({ err }, "Content draft image generation failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "AI image generation failed" });
    return;
  }
  let publicPath: string;
  try {
    publicPath = await storeImageBuffer(buffer);
  } catch (err) {
    req.log.error({ err }, "Image storage failed");
    res.status(500).json({ error: "Failed to store generated image" });
    return;
  }
  const nextRefs: ContentDraftRow["imageRefs"] = [
    ...(draft.imageRefs ?? []),
    { url: publicPath, alt: parsed.data.alt ?? draft.title ?? draft.topic ?? "AI image" },
  ];
  const [row] = await db
    .update(contentDraftsTable)
    .set({ imageRefs: nextRefs, updatedAt: new Date() })
    .where(eq(contentDraftsTable.id, id))
    .returning();
  res.json(row);
});

export default router;
