import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  campaignsTable,
  productsTable,
  experiencesTable,
  contentDraftsTable,
  marketingCampaignsTable,
  type CampaignBundleStatus,
  type CampaignRow,
  type AdCreative,
  type ContentChannel,
  type ContentKind,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { orchestrateCampaign, CampaignBundleSchema, type CampaignBundle } from "../lib/campaign-orchestrator";
import { buildGoogleAdsRsaCsv, buildMetaAdsCsv } from "../lib/ad-platform-exports";
import { getKeywordDigest } from "../lib/keyword-rank-cron";
import {
  generateCampaignImages,
  generateAndStoreImage,
  type CampaignImageJob,
  type CampaignImageFailure,
} from "../lib/campaign-image-gen";

const router: IRouter = Router();
router.use("/admin/campaigns", requireAdmin);

// ── List + get ─────────────────────────────────────────────────────────
router.get("/admin/campaigns", async (_req: Request, res: Response) => {
  const rows = await db.select().from(campaignsTable).orderBy(desc(campaignsTable.createdAt));
  res.json(rows);
});

router.get("/admin/campaigns/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(row);
});

// ── Generate (AI) ──────────────────────────────────────────────────────
const GenerateBody = z.object({
  brief: z.string().trim().min(8),
  moment: z.string().trim().max(120).optional(),
  targetProductIds: z.array(z.string()).max(12).optional(),
  name: z.string().trim().max(120).optional(),
  save: z.boolean().optional(),
});
router.post("/admin/campaigns/generate", async (req: Request, res: Response) => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const v = parsed.data;
  const ids = v.targetProductIds ?? [];
  const products = ids.length
    ? await db.select().from(productsTable).where(inArray(productsTable.id, ids))
    : [];
  const productHints = products.map((p) => ({
    id: p.id, name: p.name, category: p.category, shortDescription: p.shortDescription,
  }));
  const keywordDigest = await getKeywordDigest().catch(() => []);
  const bundle = await orchestrateCampaign({
    brief: v.brief,
    moment: v.moment,
    productHints,
    keywordDigest,
  });
  if (!bundle) {
    res.status(502).json({ error: "AI orchestration failed (is OPENAI configured?)" });
    return;
  }
  if (v.save !== false) {
    const [row] = await db.insert(campaignsTable).values({
      name: v.name?.trim() || bundle.experience.name || "Untitled campaign",
      brief: v.brief,
      moment: v.moment ?? "",
      status: "draft" as CampaignBundleStatus,
      targetProductIds: ids,
      proposed: bundle,
    }).returning();
    res.status(201).json(row);
    return;
  }
  res.json({ proposed: bundle });
});

// ── Patch (edit any field, including the proposed bundle) ──────────────
const PatchBody = z.object({
  name: z.string().trim().max(120).optional(),
  brief: z.string().optional(),
  moment: z.string().optional(),
  status: z.enum(["draft", "approved", "scheduled", "live", "archived"]).optional(),
  targetProductIds: z.array(z.string()).optional(),
  proposed: CampaignBundleSchema.nullish(),
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
});
router.patch("/admin/campaigns/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const v = parsed.data;
  const patch: Partial<typeof campaignsTable.$inferInsert> = { updatedAt: new Date() };
  if (v.name !== undefined) patch.name = v.name;
  if (v.brief !== undefined) patch.brief = v.brief;
  if (v.moment !== undefined) patch.moment = v.moment;
  if (v.status !== undefined) patch.status = v.status;
  if (v.targetProductIds !== undefined) patch.targetProductIds = v.targetProductIds;
  if (v.proposed !== undefined) patch.proposed = v.proposed as CampaignRow["proposed"];
  if (v.scheduledAt !== undefined) patch.scheduledAt = v.scheduledAt ? new Date(v.scheduledAt) : null;
  const [row] = await db.update(campaignsTable).set(patch).where(eq(campaignsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(row);
});

router.delete("/admin/campaigns/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  res.json({ ok: true });
});

// ── Approve & apply ─────────────────────────────────────────────────────
const ApproveBody = z.object({
  activateExperience: z.boolean().optional(),
  emailScheduledAt: z.string().nullish(),
  blogScheduledAt: z.string().nullish(),
  socialScheduledAt: z.string().nullish(),
});
router.post("/admin/campaigns/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ApproveBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const bundle = c.proposed as CampaignBundle | null;
  if (!bundle) { res.status(400).json({ error: "Campaign has no proposed bundle" }); return; }

  // 1) Experience preset row.
  const expId = `campaign-${c.id}`;
  const [existingExp] = await db.select().from(experiencesTable).where(eq(experiencesTable.id, expId)).limit(1);
  if (existingExp) {
    await db.update(experiencesTable).set({
      name: bundle.experience.name,
      description: c.brief.slice(0, 240),
      themeTokens: bundle.experience.themeTokens ?? {},
      banner: bundle.experience.banner ?? null,
      heroTakeover: bundle.experience.heroTakeover ?? null,
      particleEffect: bundle.experience.particleEffect ?? "none",
      updatedAt: new Date(),
    }).where(eq(experiencesTable.id, expId));
  } else {
    await db.insert(experiencesTable).values({
      id: expId,
      name: bundle.experience.name,
      description: c.brief.slice(0, 240),
      themeTokens: bundle.experience.themeTokens ?? {},
      banner: bundle.experience.banner ?? null,
      heroTakeover: bundle.experience.heroTakeover ?? null,
      particleEffect: bundle.experience.particleEffect ?? "none",
      isActive: false,
    });
  }
  if (parsed.data.activateExperience) {
    await db.transaction(async (tx) => {
      await tx.update(experiencesTable).set({ isActive: false, updatedAt: new Date() }).where(eq(experiencesTable.isActive, true));
      await tx.update(experiencesTable).set({ isActive: true, updatedAt: new Date() }).where(eq(experiencesTable.id, expId));
    });
  }

  const blogScheduled = parsed.data.blogScheduledAt ? new Date(parsed.data.blogScheduledAt) : null;
  const socialScheduled = parsed.data.socialScheduledAt ? new Date(parsed.data.socialScheduledAt) : null;

  // 2) Blog draft.
  let blogDraftId: number | null = null;
  if (bundle.blog?.title) {
    const [b] = await db.insert(contentDraftsTable).values({
      kind: "blog" as ContentKind,
      channel: "blog" as ContentChannel,
      topic: c.name,
      title: bundle.blog.title,
      body: bundle.blog.body,
      hashtags: bundle.blog.hashtags,
      cta: bundle.blog.cta,
      imagePrompt: bundle.blog.imagePrompt,
      prompt: c.brief,
      scheduledAt: blogScheduled,
    }).returning();
    blogDraftId = b?.id ?? null;
  }

  // 3) Social drafts. Track each row by channel so we can attach the
  //    generated cover image after the fact.
  const socialIds: number[] = [];
  const socialIdByChannel = new Map<ContentChannel, number>();
  for (const s of bundle.socials ?? []) {
    if (!s.body) continue;
    const [row] = await db.insert(contentDraftsTable).values({
      kind: "social" as ContentKind,
      channel: s.channel,
      topic: c.name,
      body: s.body,
      hashtags: s.hashtags,
      cta: s.cta,
      imagePrompt: s.imagePrompt,
      prompt: c.brief,
      scheduledAt: socialScheduled,
    }).returning();
    if (row) {
      socialIds.push(row.id);
      socialIdByChannel.set(s.channel, row.id);
    }
  }

  // 4) Email campaign (status=draft, scheduled if provided).
  let emailCampaignId: number | null = null;
  if (bundle.email?.subject) {
    const scheduled = parsed.data.emailScheduledAt ? new Date(parsed.data.emailScheduledAt) : null;
    const [e] = await db.insert(marketingCampaignsTable).values({
      channel: "email",
      subject: bundle.email.subject,
      preheader: bundle.email.preheader,
      body: bundle.email.body,
      ctaLabel: bundle.email.ctaLabel,
      ctaUrl: bundle.email.ctaUrl,
      audience: "all",
      status: "draft",
      scheduledAt: scheduled,
    }).returning();
    emailCampaignId = e?.id ?? null;
  }

  const adCreatives: AdCreative[] = (bundle.adCreatives ?? []).map((a) => ({ ...a }));

  // 5) Auto-generate cover images for blog / social / ad creatives.
  //    Each job is independent and best-effort — failures are surfaced
  //    inline so the operator can retry from the draft / creative.
  const jobs: CampaignImageJob[] = [];
  if (blogDraftId && bundle.blog?.imagePrompt) {
    jobs.push({ target: { kind: "blog" }, prompt: bundle.blog.imagePrompt });
  }
  for (const s of bundle.socials ?? []) {
    if (!s.imagePrompt || !socialIdByChannel.has(s.channel)) continue;
    jobs.push({ target: { kind: "social", channel: s.channel }, prompt: s.imagePrompt });
  }
  adCreatives.forEach((a, idx) => {
    if (a.imagePrompt) jobs.push({ target: { kind: "ad", index: idx }, prompt: a.imagePrompt });
  });

  const imageFailures: CampaignImageFailure[] = [];
  if (jobs.length) {
    const results = await generateCampaignImages(jobs);
    // Group successful blog/social URLs to append to imageRefs in one update.
    const blogUrls: Array<{ url: string; alt?: string }> = [];
    const socialUrlsByDraftId = new Map<number, Array<{ url: string; alt?: string }>>();
    for (const r of results) {
      if (r.error) {
        imageFailures.push({ target: r.target, prompt: r.prompt, error: r.error });
        continue;
      }
      if (!r.url) continue;
      if (r.target.kind === "blog") {
        blogUrls.push({ url: r.url, alt: bundle.blog?.title || c.name });
      } else if (r.target.kind === "social") {
        const draftId = socialIdByChannel.get(r.target.channel as ContentChannel);
        if (!draftId) continue;
        const list = socialUrlsByDraftId.get(draftId) ?? [];
        list.push({ url: r.url, alt: c.name });
        socialUrlsByDraftId.set(draftId, list);
      } else if (r.target.kind === "ad") {
        const ad = adCreatives[r.target.index];
        if (ad) ad.imageUrl = r.url;
      }
    }
    if (blogDraftId && blogUrls.length) {
      const [existing] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, blogDraftId)).limit(1);
      const next = [...(existing?.imageRefs ?? []), ...blogUrls];
      await db.update(contentDraftsTable).set({ imageRefs: next, updatedAt: new Date() }).where(eq(contentDraftsTable.id, blogDraftId));
    }
    for (const [draftId, urls] of socialUrlsByDraftId.entries()) {
      const [existing] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, draftId)).limit(1);
      const next = [...(existing?.imageRefs ?? []), ...urls];
      await db.update(contentDraftsTable).set({ imageRefs: next, updatedAt: new Date() }).where(eq(contentDraftsTable.id, draftId));
    }
  }

  const [updated] = await db.update(campaignsTable).set({
    status: parsed.data.activateExperience ? "live" : "approved",
    experienceId: expId,
    blogDraftId,
    socialDraftIds: socialIds,
    emailCampaignId,
    adCreatives,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(campaignsTable.id, id)).returning();
  res.json({ campaign: updated, imageFailures });
});

// ── Per-target retry of a single failed cover image ───────────────────
const RetryImageBody = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("blog") }),
    z.object({ kind: z.literal("social"), channel: z.string().min(1) }),
    z.object({ kind: z.literal("ad"), index: z.number().int().nonnegative() }),
  ]),
  prompt: z.string().trim().optional(),
});
router.post("/admin/campaigns/:id/retry-image", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RetryImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }

  const target = parsed.data.target;
  let prompt = parsed.data.prompt ?? "";
  let draftId: number | null = null;

  if (target.kind === "blog") {
    if (!c.blogDraftId) { res.status(400).json({ error: "Campaign has no blog draft" }); return; }
    draftId = c.blogDraftId;
    if (!prompt) {
      const [d] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, draftId)).limit(1);
      prompt = d?.imagePrompt ?? "";
    }
  } else if (target.kind === "social") {
    const ids = c.socialDraftIds ?? [];
    if (!ids.length) { res.status(400).json({ error: "Campaign has no social drafts" }); return; }
    const drafts = await db.select().from(contentDraftsTable).where(inArray(contentDraftsTable.id, ids));
    const d = drafts.find((x) => x.channel === target.channel);
    if (!d) { res.status(400).json({ error: `No social draft for channel ${target.channel}` }); return; }
    draftId = d.id;
    if (!prompt) prompt = d.imagePrompt ?? "";
  } else {
    const ad = c.adCreatives?.[target.index];
    if (!ad) { res.status(400).json({ error: `No ad creative at index ${target.index}` }); return; }
    if (!prompt) prompt = ad.imagePrompt ?? "";
  }

  if (!prompt.trim()) { res.status(400).json({ error: "Image prompt is empty" }); return; }

  let url: string;
  try {
    url = await generateAndStoreImage(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    res.status(502).json({ error: msg });
    return;
  }

  const editedPrompt = parsed.data.prompt?.trim() ?? "";

  if (target.kind === "blog" || target.kind === "social") {
    const [existing] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, draftId!)).limit(1);
    const next = [...(existing?.imageRefs ?? []), { url, alt: c.name }];
    const draftPatch: Partial<typeof contentDraftsTable.$inferInsert> = {
      imageRefs: next,
      updatedAt: new Date(),
    };
    if (editedPrompt && editedPrompt !== existing?.imagePrompt) {
      draftPatch.imagePrompt = editedPrompt;
    }
    await db.update(contentDraftsTable).set(draftPatch).where(eq(contentDraftsTable.id, draftId!));

    // Mirror the edited prompt back into the campaign's proposed bundle so a
    // future re-approval uses it too.
    if (editedPrompt && c.proposed) {
      const proposed = c.proposed as CampaignBundle;
      let mutated = false;
      const nextProposed: CampaignBundle = { ...proposed };
      if (target.kind === "blog" && proposed.blog && proposed.blog.imagePrompt !== editedPrompt) {
        nextProposed.blog = { ...proposed.blog, imagePrompt: editedPrompt };
        mutated = true;
      } else if (target.kind === "social" && proposed.socials) {
        const idx = proposed.socials.findIndex((s) => s.channel === target.channel);
        if (idx >= 0 && proposed.socials[idx]?.imagePrompt !== editedPrompt) {
          const socials = proposed.socials.slice();
          socials[idx] = { ...socials[idx]!, imagePrompt: editedPrompt };
          nextProposed.socials = socials;
          mutated = true;
        }
      }
      if (mutated) {
        await db.update(campaignsTable)
          .set({ proposed: nextProposed as CampaignRow["proposed"], updatedAt: new Date() })
          .where(eq(campaignsTable.id, id));
      }
    }
    res.json({ target, url, campaign: c });
    return;
  }

  const adCreatives: AdCreative[] = (c.adCreatives ?? []).map((a, i) =>
    i === target.index
      ? { ...a, imageUrl: url, ...(editedPrompt ? { imagePrompt: editedPrompt } : {}) }
      : a,
  );
  const campaignPatch: Partial<typeof campaignsTable.$inferInsert> = {
    adCreatives,
    updatedAt: new Date(),
  };
  if (editedPrompt && c.proposed) {
    const proposed = c.proposed as CampaignBundle;
    const ads = (proposed.adCreatives ?? []).slice();
    if (ads[target.index] && ads[target.index]!.imagePrompt !== editedPrompt) {
      ads[target.index] = { ...ads[target.index]!, imagePrompt: editedPrompt };
      campaignPatch.proposed = { ...proposed, adCreatives: ads } as CampaignRow["proposed"];
    }
  }
  const [updated] = await db.update(campaignsTable)
    .set(campaignPatch)
    .where(eq(campaignsTable.id, id))
    .returning();
  res.json({ target, url, campaign: updated ?? c });
});

// ── Ad-creative export (CSV + JSON) ────────────────────────────────────
function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function campaignSlug(name: string, id: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `campaign-${id}`;
}

function extFromContentType(ct: string | null | undefined, fallbackUrl: string): string {
  const lower = (ct ?? "").toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  const m = fallbackUrl.split("?")[0]?.match(/\.([a-z0-9]{3,4})$/i);
  return (m?.[1] ?? "jpg").toLowerCase();
}

async function fetchImageBytes(
  url: string,
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Image fetch failed (${r.status})`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return { bytes: buf, contentType: r.headers.get("content-type") };
}
router.get("/admin/campaigns/:id/ad-creatives.csv", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const rows = (c.adCreatives.length ? c.adCreatives : (c.proposed?.adCreatives ?? [])) as AdCreative[];
  const headers = ["campaign", "headline_1", "description_1", "image_prompt", "image_url"];
  const lines = [headers.join(",")];
  for (const a of rows) {
    lines.push([c.name, a.headline, a.description, a.imagePrompt, a.imageUrl ?? ""].map(csvEscape).join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${id}-ads.csv"`);
  res.send(lines.join("\n"));
});

router.get("/admin/campaigns/:id/ad-creatives.json", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const rows = (c.adCreatives.length ? c.adCreatives : (c.proposed?.adCreatives ?? [])) as AdCreative[];
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${id}-ads.json"`);
  res.json({ campaign: c.name, creatives: rows });
});

// Resolve the most sensible "Final URL" for an ad export: the first targeted
// product's PDP if any, else the storefront /shop. Ad platforms reject
// imports with empty Final URLs, so we always return something concrete.
async function resolveCampaignFinalUrlPath(c: CampaignRow): Promise<string> {
  const ids = (c.targetProductIds ?? []).filter(Boolean);
  if (ids.length) {
    const [p] = await db
      .select({ slug: productsTable.slug })
      .from(productsTable)
      .where(eq(productsTable.id, ids[0]!))
      .limit(1);
    if (p?.slug) return `/products/${p.slug}`;
  }
  return "/shop";
}

router.get("/admin/campaigns/:id/google-ads.csv", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const creatives = (c.adCreatives.length ? c.adCreatives : (c.proposed?.adCreatives ?? [])) as AdCreative[];
  if (!creatives.length) { res.status(400).json({ error: "Campaign has no ad creatives yet" }); return; }
  const finalUrlPath = await resolveCampaignFinalUrlPath(c);
  const csv = buildGoogleAdsRsaCsv({
    campaignId: c.id,
    campaignName: c.name,
    finalUrlPath,
    creatives,
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${id}-google-ads.csv"`);
  res.send(csv);
});

router.get("/admin/campaigns/:id/meta-ads.csv", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const creatives = (c.adCreatives.length ? c.adCreatives : (c.proposed?.adCreatives ?? [])) as AdCreative[];
  if (!creatives.length) { res.status(400).json({ error: "Campaign has no ad creatives yet" }); return; }
  const finalUrlPath = await resolveCampaignFinalUrlPath(c);
  const csv = buildMetaAdsCsv({
    campaignId: c.id,
    campaignName: c.name,
    finalUrlPath,
    creatives,
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${id}-meta-ads.csv"`);
  res.send(csv);
});

// ── Ad-creative cover image downloads ──────────────────────────────────
router.get("/admin/campaigns/:id/ad-creatives/:index/image", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const index = Number(req.params.index);
  if (Number.isNaN(id) || Number.isNaN(index) || index < 0) {
    res.status(400).json({ error: "Invalid id or index" });
    return;
  }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const rows = (c.adCreatives.length ? c.adCreatives : (c.proposed?.adCreatives ?? [])) as AdCreative[];
  const ad = rows[index];
  const url = ad?.imageUrl ?? null;
  if (!ad || !url) { res.status(404).json({ error: "No cover image for this ad" }); return; }
  try {
    const { bytes, contentType } = await fetchImageBytes(url);
    const ext = extFromContentType(contentType, url);
    const filename = `${campaignSlug(c.name, c.id)}-ad-${index + 1}.${ext}`;
    res.setHeader("Content-Type", contentType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.end(Buffer.from(bytes));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Image fetch failed" });
  }
});

// Helper: resolve a single content draft and return its first cover URL.
async function loadDraftCoverUrl(draftId: number): Promise<{
  draft: typeof contentDraftsTable.$inferSelect;
  url: string;
} | null> {
  const [d] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, draftId)).limit(1);
  if (!d) return null;
  const url = d.imageRefs?.[0]?.url ?? null;
  if (!url) return null;
  return { draft: d, url };
}

router.get("/admin/campaigns/:id/blog-cover/image", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  if (!c.blogDraftId) { res.status(404).json({ error: "Campaign has no blog draft" }); return; }
  const found = await loadDraftCoverUrl(c.blogDraftId);
  if (!found) { res.status(404).json({ error: "No cover image for blog draft" }); return; }
  try {
    const { bytes, contentType } = await fetchImageBytes(found.url);
    const ext = extFromContentType(contentType, found.url);
    const filename = `${campaignSlug(c.name, c.id)}-blog.${ext}`;
    res.setHeader("Content-Type", contentType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.end(Buffer.from(bytes));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Image fetch failed" });
  }
});

router.get("/admin/campaigns/:id/social-covers/:channel/image", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const channel = String(req.params.channel ?? "");
  if (Number.isNaN(id) || !channel) { res.status(400).json({ error: "Invalid id or channel" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const ids = c.socialDraftIds ?? [];
  if (!ids.length) { res.status(404).json({ error: "Campaign has no social drafts" }); return; }
  const drafts = await db.select().from(contentDraftsTable).where(inArray(contentDraftsTable.id, ids));
  const draft = drafts.find((d) => d.channel === channel);
  if (!draft) { res.status(404).json({ error: `No social draft for channel ${channel}` }); return; }
  const url = draft.imageRefs?.[0]?.url ?? null;
  if (!url) { res.status(404).json({ error: "No cover image for this social draft" }); return; }
  try {
    const { bytes, contentType } = await fetchImageBytes(url);
    const ext = extFromContentType(contentType, url);
    const safeChannel = channel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const filename = `${campaignSlug(c.name, c.id)}-social-${safeChannel}.${ext}`;
    res.setHeader("Content-Type", contentType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.end(Buffer.from(bytes));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Image fetch failed" });
  }
});

// Combined zip of all blog + social + ad cover images for the campaign.
router.get("/admin/campaigns/:id/covers.zip", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const slug = campaignSlug(c.name, c.id);

  type Job = { name: string; url: string; label: string };
  const jobs: Job[] = [];

  // Blog cover.
  if (c.blogDraftId) {
    const found = await loadDraftCoverUrl(c.blogDraftId);
    if (found) jobs.push({ name: `${slug}-blog`, url: found.url, label: "blog" });
  }
  // Social covers.
  const socialIds = c.socialDraftIds ?? [];
  if (socialIds.length) {
    const drafts = await db.select().from(contentDraftsTable).where(inArray(contentDraftsTable.id, socialIds));
    for (const d of drafts) {
      const url = d.imageRefs?.[0]?.url;
      if (!url) continue;
      const safeChannel = d.channel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      jobs.push({ name: `${slug}-social-${safeChannel}`, url, label: `social ${d.channel}` });
    }
  }
  // Ad creatives.
  const adRows = (c.adCreatives.length ? c.adCreatives : (c.proposed?.adCreatives ?? [])) as AdCreative[];
  adRows.forEach((a, i) => {
    if (typeof a.imageUrl === "string" && a.imageUrl) {
      jobs.push({ name: `${slug}-ad-${i + 1}`, url: a.imageUrl, label: `ad ${i + 1}` });
    }
  });

  if (jobs.length === 0) {
    res.status(404).json({ error: "No cover images available for this campaign" });
    return;
  }

  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const results = await Promise.allSettled(
      jobs.map(async (j) => {
        const { bytes, contentType } = await fetchImageBytes(j.url);
        const ext = extFromContentType(contentType, j.url);
        return { name: `${j.name}.${ext}`, bytes, label: j.label };
      }),
    );
    const failures: Array<{ label: string; error: string }> = [];
    let succeeded = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        zip.file(r.value.name, r.value.bytes);
        succeeded += 1;
      } else {
        failures.push({
          label: jobs[i]!.label,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });
    if (succeeded === 0) {
      res.status(502).json({ error: "All cover image downloads failed", failures });
      return;
    }
    if (failures.length > 0) {
      const lines = [
        `Campaign: ${c.name}`,
        `Generated: ${new Date().toISOString()}`,
        `Successful: ${succeeded}`,
        `Failed: ${failures.length}`,
        "",
        "Failed covers:",
        ...failures.map((f) => `  ${f.label}: ${f.error}`),
      ];
      zip.file("README.txt", lines.join("\n"));
    }
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${slug}-covers.zip"`);
    res.setHeader("Content-Length", String(buf.byteLength));
    res.end(buf);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Zip build failed" });
  }
});

router.get("/admin/campaigns/:id/ad-creatives.zip", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Campaign not found" }); return; }
  const rows = (c.adCreatives.length ? c.adCreatives : (c.proposed?.adCreatives ?? [])) as AdCreative[];
  const slug = campaignSlug(c.name, c.id);
  const withImages = rows
    .map((a, i) => ({ ad: a, index: i }))
    .filter((r) => typeof r.ad.imageUrl === "string" && r.ad.imageUrl);
  if (withImages.length === 0) {
    res.status(404).json({ error: "No cover images available for this campaign" });
    return;
  }
  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const results = await Promise.allSettled(
      withImages.map(async (r) => {
        const { bytes, contentType } = await fetchImageBytes(r.ad.imageUrl as string);
        const ext = extFromContentType(contentType, r.ad.imageUrl as string);
        return { index: r.index, bytes, ext };
      }),
    );
    const failures: Array<{ index: number; error: string }> = [];
    let succeeded = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        zip.file(`${slug}-ad-${r.value.index + 1}.${r.value.ext}`, r.value.bytes);
        succeeded += 1;
      } else {
        failures.push({
          index: withImages[i]!.index,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });
    if (succeeded === 0) {
      res.status(502).json({ error: "All cover image downloads failed", failures });
      return;
    }
    if (failures.length > 0) {
      const lines = [
        `Campaign: ${c.name}`,
        `Generated: ${new Date().toISOString()}`,
        `Successful: ${succeeded}`,
        `Failed: ${failures.length}`,
        "",
        "Failed ads (1-indexed):",
        ...failures.map((f) => `  ad ${f.index + 1}: ${f.error}`),
      ];
      zip.file("README.txt", lines.join("\n"));
    }
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${slug}-ad-covers.zip"`);
    res.setHeader("Content-Length", String(buf.byteLength));
    res.end(buf);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Zip build failed" });
  }
});

export default router;
