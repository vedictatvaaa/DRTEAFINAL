// Admin CRUD + AI-suggest for the homepage SEO singleton row.
//
// Operator-facing surface for the H1, sr-only keyword expansion, sub-line,
// meta keywords list, and breadcrumb root label that drive the live homepage
// hero. The AI-suggest endpoint reads current catalog signals (top categories
// + product names) and proposes a fresh set the operator can accept or edit.

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
  db,
  homepageSeoSettingsTable,
  productsTable,
  type HomepageSeoSettingsRow,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";
import { chatCompletionJSON } from "../lib/openaiText";
import { projectHomepageSeo } from "../lib/homepage-seo-defaults";

const router: IRouter = Router();
router.use("/admin/homepage-seo", requireAdmin);

async function ensureRow(): Promise<HomepageSeoSettingsRow> {
  const [existing] = await db
    .select()
    .from(homepageSeoSettingsTable)
    .where(eq(homepageSeoSettingsTable.id, 1))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(homepageSeoSettingsTable)
    .values({ id: 1 })
    .returning();
  return created;
}

router.get("/admin/homepage-seo", async (_req: Request, res: Response) => {
  try {
    const row = await ensureRow();
    res.json({
      raw: row,
      effective: projectHomepageSeo(row),
    });
  } catch (err) {
    logger.error({ err }, "homepage-seo.get_failed");
    res.status(500).json({ error: "Failed to load homepage SEO settings" });
  }
});

const PatchBody = z
  .object({
    h1Visible: z.string().trim().max(200).nullable().optional(),
    h1SrOnly: z.string().trim().max(800).nullable().optional(),
    h1Subline: z.string().trim().max(240).nullable().optional(),
    heroEyebrow: z.string().trim().max(80).nullable().optional(),
    heroSubcopy: z.string().trim().max(400).nullable().optional(),
    metaKeywords: z
      .array(z.string().trim().min(2).max(80))
      .max(20)
      .optional(),
    breadcrumbHomeLabel: z.string().trim().max(40).nullable().optional(),
    breadcrumbsJsonLdEnabled: z.boolean().optional(),
    aiNotes: z.string().trim().max(800).nullable().optional(),
  })
  .strict();

router.patch("/admin/homepage-seo", async (req: Request, res: Response) => {
  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }
  try {
    await ensureRow();
    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      patch[k] = v;
    }
    const [updated] = await db
      .update(homepageSeoSettingsTable)
      .set(patch)
      .where(eq(homepageSeoSettingsTable.id, 1))
      .returning();
    await recordActivity({
      kind: "homepage_seo_updated",
      actor: "admin",
      title: "Homepage SEO updated",
      summary: `Fields: ${Object.keys(parsed.data).join(", ")}`,
      entityType: "homepage_seo_settings",
      entityId: "1",
    });
    res.json({
      raw: updated,
      effective: projectHomepageSeo(updated),
    });
  } catch (err) {
    logger.error({ err }, "homepage-seo.patch_failed");
    res.status(500).json({ error: "Failed to update homepage SEO settings" });
  }
});

// ─── AI-suggest ──────────────────────────────────────────────────────────
//
// Pulls live category + product signal from the catalog and asks an LLM to
// propose a buyer-intent H1, sr-only keyword expansion, sub-line and 10
// trimmed meta keywords. Falls back to the current effective values if the
// LLM is unavailable so the operator never gets a blank suggestion card.

interface AiSuggestion {
  h1Visible: string;
  h1SrOnly: string;
  h1Subline: string;
  heroEyebrow: string;
  heroSubcopy: string;
  metaKeywords: string[];
  rationale: string;
}

async function buildCatalogSignal(): Promise<{
  categories: string[];
  topProducts: string[];
}> {
  try {
    const rows = await db
      .select({
        name: productsTable.name,
        category: productsTable.category,
      })
      .from(productsTable)
      .limit(60);
    const categories = Array.from(
      new Set(rows.map((r) => r.category).filter((c): c is string => !!c)),
    ).slice(0, 12);
    const topProducts = rows.map((r) => r.name).filter(Boolean).slice(0, 20);
    return { categories, topProducts };
  } catch {
    return { categories: [], topProducts: [] };
  }
}

router.post("/admin/homepage-seo/suggest", async (_req: Request, res: Response) => {
  try {
    const row = await ensureRow();
    const effective = projectHomepageSeo(row);
    const signal = await buildCatalogSignal();

    const userPrompt = [
      `You are an SEO copywriter for Dr Tea (https://drtea.in), a premium`,
      `Indian tea D2C brand selling: ${signal.categories.join(", ") || "chai, kadha, green tea, black tea, tisanes"}.`,
      `Current bestsellers: ${signal.topProducts.slice(0, 10).join(", ") || "(unknown)"}.`,
      ``,
      `Propose a homepage hero rewrite optimised for commercial buyer intent`,
      `(buyers searching "buy tea online india", "masala chai online", etc.).`,
      `Rules:`,
      `- h1Visible: 2-6 words, action verb first, max 60 chars. Use "\\n" for the line break in the visible H1.`,
      `- h1SrOnly: one sentence, 200-340 chars, lists category keywords and a value prop.`,
      `- h1Subline: 4-7 keywords joined by " · ", max 90 chars.`,
      `- heroEyebrow: 1-3 words, optional brand framing.`,
      `- heroSubcopy: 1 sentence, 140-220 chars, sensory + trust signal.`,
      `- metaKeywords: 8-12 short search-intent phrases, lowercase, no hashtags.`,
      `- rationale: 1-2 sentences explaining why this set converts.`,
      ``,
      `Current values for context:`,
      `  h1Visible: ${JSON.stringify(effective.h1Visible)}`,
      `  h1Subline: ${JSON.stringify(effective.h1Subline)}`,
      `  metaKeywords: ${JSON.stringify(effective.metaKeywords)}`,
      ``,
      `Respond with strict JSON: {h1Visible, h1SrOnly, h1Subline, heroEyebrow, heroSubcopy, metaKeywords:[], rationale}.`,
    ].join("\n");

    const ai = await chatCompletionJSON<Partial<AiSuggestion>>({
      systemPrompt:
        "You write conversion-focused, schema-friendly SEO copy. Return only JSON.",
      userPrompt,
      maxTokens: 700,
      timeoutMs: 45_000,
    });

    const clamp = (v: unknown, fallback: string, max: number): string => {
      if (typeof v !== "string") return fallback;
      const s = v.trim();
      if (!s) return fallback;
      return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
    };
    const cleanKw = (raw: unknown): string[] => {
      if (!Array.isArray(raw)) return effective.metaKeywords;
      const out: string[] = [];
      const seen = new Set<string>();
      for (const v of raw) {
        if (typeof v !== "string") continue;
        const k = v.replace(/\s+/g, " ").trim();
        if (k.length < 2 || k.length > 80) continue;
        const key = k.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(k);
        if (out.length >= 12) break;
      }
      return out.length >= 4 ? out : effective.metaKeywords;
    };

    const suggestion: AiSuggestion = {
      h1Visible: clamp(ai?.h1Visible, effective.h1Visible, 200),
      h1SrOnly: clamp(ai?.h1SrOnly, effective.h1SrOnly, 800),
      h1Subline: clamp(ai?.h1Subline, effective.h1Subline, 240),
      heroEyebrow: clamp(ai?.heroEyebrow, effective.heroEyebrow, 80),
      heroSubcopy: clamp(ai?.heroSubcopy, effective.heroSubcopy, 400),
      metaKeywords: cleanKw(ai?.metaKeywords),
      rationale:
        typeof ai?.rationale === "string" && ai.rationale.trim().length > 0
          ? ai.rationale.trim().slice(0, 600)
          : ai
            ? "AI returned values — review before applying."
            : "AI unavailable — showing current values as a starting point.",
    };

    // Stamp the timestamp so the admin can see "last suggested at" without
    // forcing them to apply.
    await db
      .update(homepageSeoSettingsTable)
      .set({ lastAiSuggestionAt: sql`now()` })
      .where(eq(homepageSeoSettingsTable.id, 1));

    res.json({
      suggestion,
      aiAvailable: !!ai,
    });
  } catch (err) {
    logger.error({ err }, "homepage-seo.suggest_failed");
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

export default router;
