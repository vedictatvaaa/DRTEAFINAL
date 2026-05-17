import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc, sql } from "drizzle-orm";
import {
  db,
  experiencesTable,
  type ExperienceRow,
  type ExperienceBanner,
  type ExperienceHeroTakeover,
  type ParticleEffect,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordVersion } from "../lib/version-history";
import { schedulePing } from "../lib/seo-ping";

const router: IRouter = Router();

const PARTICLE_VALUES = ["none", "rain", "snow", "leaves", "diyas", "petals"] as const;

function toApi(row: ExperienceRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    themeTokens: row.themeTokens,
    banner: row.banner ?? null,
    heroTakeover: row.heroTakeover ?? null,
    particleEffect: row.particleEffect ?? "none",
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

function parseBanner(v: unknown): ExperienceBanner | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "object") return undefined;
  const obj = v as Record<string, unknown>;
  if (typeof obj.text !== "string" || !obj.text.trim()) return null;
  return {
    text: obj.text,
    ctaLabel: typeof obj.ctaLabel === "string" && obj.ctaLabel ? obj.ctaLabel : undefined,
    ctaHref: typeof obj.ctaHref === "string" && obj.ctaHref ? obj.ctaHref : undefined,
  };
}

function parseHero(v: unknown): ExperienceHeroTakeover | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "object") return undefined;
  const obj = v as Record<string, unknown>;
  if (
    typeof obj.title !== "string" ||
    typeof obj.ctaLabel !== "string" ||
    typeof obj.ctaHref !== "string" ||
    !obj.title.trim()
  ) {
    return null;
  }
  return {
    title: obj.title,
    ctaLabel: obj.ctaLabel,
    ctaHref: obj.ctaHref,
    eyebrow: typeof obj.eyebrow === "string" && obj.eyebrow ? obj.eyebrow : undefined,
    subtitle: typeof obj.subtitle === "string" && obj.subtitle ? obj.subtitle : undefined,
    imageUrl: typeof obj.imageUrl === "string" && obj.imageUrl ? obj.imageUrl : undefined,
  };
}

router.get("/admin/experiences", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(experiencesTable)
    .orderBy(asc(experiencesTable.sortOrder), asc(experiencesTable.name));
  res.json(rows.map(toApi));
});

router.patch(
  "/admin/experiences/:id",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const [target] = await db
      .select()
      .from(experiencesTable)
      .where(eq(experiencesTable.id, id))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Experience not found" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<typeof experiencesTable.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name;
    if (typeof body.description === "string") patch.description = body.description;
    if (body.themeTokens && typeof body.themeTokens === "object") {
      const tokens: Record<string, string> = {};
      for (const [k, v] of Object.entries(body.themeTokens as Record<string, unknown>)) {
        if (typeof v === "string") tokens[k] = v;
      }
      patch.themeTokens = tokens;
    }
    const banner = parseBanner(body.banner);
    if (banner !== undefined) patch.banner = banner;
    const hero = parseHero(body.heroTakeover);
    if (hero !== undefined) patch.heroTakeover = hero;
    if (
      typeof body.particleEffect === "string" &&
      (PARTICLE_VALUES as readonly string[]).includes(body.particleEffect)
    ) {
      patch.particleEffect = body.particleEffect as ParticleEffect;
    }

    const [fresh] = await db
      .update(experiencesTable)
      .set(patch)
      .where(eq(experiencesTable.id, id))
      .returning();
    await recordVersion("experience", id, "update", target, fresh ?? null);
    // Banner / hero takeover changes can affect homepage CTAs and copy that
    // search engines index — re-ping so the sitemap-driven crawl picks it up.
    schedulePing();
    res.json(toApi(fresh!));
  },
);

router.post(
  "/admin/experiences/:id/activate",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const [target] = await db
      .select()
      .from(experiencesTable)
      .where(eq(experiencesTable.id, id))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Experience not found" });
      return;
    }
    const previouslyActive = await db
      .select()
      .from(experiencesTable)
      .where(eq(experiencesTable.isActive, true));
    await db.transaction(async (tx) => {
      await tx
        .update(experiencesTable)
        .set({ isActive: false, updatedAt: sql`now()` })
        .where(eq(experiencesTable.isActive, true));
      await tx
        .update(experiencesTable)
        .set({ isActive: true, updatedAt: sql`now()` })
        .where(eq(experiencesTable.id, id));
    });
    const [fresh] = await db
      .select()
      .from(experiencesTable)
      .where(eq(experiencesTable.id, id))
      .limit(1);
    // Homepage theme is the active experience; record activation/deactivation
    // as version history so theme changes are revertible.
    for (const prev of previouslyActive) {
      if (prev.id === id) continue;
      const [now] = await db
        .select()
        .from(experiencesTable)
        .where(eq(experiencesTable.id, prev.id))
        .limit(1);
      await recordVersion("experience", prev.id, "update", prev, now ?? null);
    }
    await recordVersion("experience", id, "update", target, fresh ?? null);
    // Activating a different experience changes the homepage theme/banner — ping.
    schedulePing();
    res.json(toApi(fresh!));
  },
);

export default router;
