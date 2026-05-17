import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  articlesTable,
  contentHubEntriesTable,
  teapediaEntriesTable,
  trendingTopicsTable,
} from "../lib/db";

const router: IRouter = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface TrendingCard {
  kind: "journal" | "teapedia" | "hub";
  hub?: string | null;
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  url: string;
  date: string;
  category: string;
  tags: string[];
  hashtags: string[];
}

/** Pull only the #-prefixed entries from a tags-jsonb array. */
function pickHashtags(arr: string[] | null | undefined): string[] {
  if (!arr) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    if (typeof t !== "string" || !t.startsWith("#")) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 6) break;
  }
  return out;
}

// GET /api/trending?kind=journal|teapedia|hub|all&hub=regional&limit=8
router.get("/trending", async (req: Request, res: Response) => {
  const kind = String(req.query.kind ?? "all");
  const hub = typeof req.query.hub === "string" ? req.query.hub : undefined;
  const limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 8)));
  const since = new Date(Date.now() - SEVEN_DAYS_MS);

  const out: TrendingCard[] = [];

  if (kind === "all" || kind === "journal") {
    const rows = await db
      .select()
      .from(articlesTable)
      .where(
        and(
          eq(articlesTable.published, true),
          eq(articlesTable.authorType, "ai"),
          gte(articlesTable.createdAt, since),
        ),
      )
      .orderBy(desc(articlesTable.createdAt))
      .limit(limit);
    for (const r of rows) {
      out.push({
        kind: "journal",
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        cover: r.cover,
        url: `/journal/${r.slug}`,
        date: r.date,
        category: r.category,
        tags: r.hashtags ?? [],
        hashtags: r.hashtags ?? [],
      });
    }
  }

  if (kind === "all" || kind === "teapedia") {
    const rows = await db
      .select()
      .from(teapediaEntriesTable)
      .where(
        and(
          eq(teapediaEntriesTable.published, true),
          gte(teapediaEntriesTable.createdAt, since),
        ),
      )
      .orderBy(desc(teapediaEntriesTable.createdAt))
      .limit(limit);
    for (const r of rows) {
      out.push({
        kind: "teapedia",
        slug: r.slug,
        title: r.title,
        excerpt: r.summary,
        cover: r.hero || "",
        url: `/teapedia/${r.slug}`,
        date: new Date(r.createdAt).toISOString().slice(0, 10),
        category: r.category,
        tags: r.tags ?? [],
        hashtags: pickHashtags(r.tags),
      });
    }
  }

  if (kind === "all" || kind === "hub") {
    const conds = [
      eq(contentHubEntriesTable.published, true),
      gte(contentHubEntriesTable.createdAt, since),
    ];
    if (hub === "pairing" || hub === "wellness" || hub === "regional") {
      conds.push(eq(contentHubEntriesTable.hub, hub));
    }
    const rows = await db
      .select()
      .from(contentHubEntriesTable)
      .where(and(...conds))
      .orderBy(desc(contentHubEntriesTable.createdAt))
      .limit(limit);
    const HUB_BASE: Record<string, string> = {
      pairing: "/pairings",
      wellness: "/wellness",
      regional: "/tea-culture",
    };
    for (const r of rows) {
      out.push({
        kind: "hub",
        hub: r.hub,
        slug: r.slug,
        title: r.title,
        excerpt: r.summary,
        cover: r.hero || "",
        url: `${HUB_BASE[r.hub] ?? "/"}/${r.slug}`,
        date: new Date(r.createdAt).toISOString().slice(0, 10),
        category: r.category,
        tags: r.tags ?? [],
        hashtags: pickHashtags(r.tags),
      });
    }
  }

  // Sort newest-first across kinds and cap.
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json(out.slice(0, limit));
});

// GET /api/journal/by-tag/:tag — articles whose hashtags include the slug.
router.get("/journal/by-tag/:tag", async (req: Request, res: Response) => {
  const tagRaw = decodeURIComponent(String(req.params.tag ?? "")).toLowerCase();
  if (!tagRaw) {
    res.json([]);
    return;
  }
  // Match either "#tag" or "tag" by checking against jsonb arrays.
  const variants = [tagRaw, `#${tagRaw.replace(/^#/, "")}`];
  const rows = await db
    .select()
    .from(articlesTable)
    .where(
      and(
        eq(articlesTable.published, true),
        sql`(${articlesTable.hashtags} ?| ${variants}::text[] OR ${articlesTable.seoKeywords} ?| ${variants}::text[])`,
      ),
    )
    .orderBy(desc(articlesTable.createdAt))
    .limit(60);
  res.json(
    rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      category: r.category,
      cover: r.cover,
      date: r.date,
      readTime: r.readTime,
    })),
  );
});

// GET /api/teapedia/by-tag/:tag — entries whose tags include the slug.
router.get("/teapedia/by-tag/:tag", async (req: Request, res: Response) => {
  const tagRaw = decodeURIComponent(String(req.params.tag ?? "")).toLowerCase();
  if (!tagRaw) {
    res.json([]);
    return;
  }
  const variants = [tagRaw, `#${tagRaw.replace(/^#/, "")}`];
  const rows = await db
    .select()
    .from(teapediaEntriesTable)
    .where(
      and(
        eq(teapediaEntriesTable.published, true),
        sql`${teapediaEntriesTable.tags} ?| ${variants}::text[]`,
      ),
    )
    .orderBy(desc(teapediaEntriesTable.createdAt))
    .limit(60);
  res.json(
    rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      category: r.category,
      hero: r.hero,
      tags: r.tags ?? [],
    })),
  );
});

// GET /api/trending/hashtags — top related hashtags from the live trend bank,
// for surfacing as a "what's blowing up" cloud on the storefront.
router.get("/trending/hashtags", async (_req: Request, res: Response) => {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const rows = await db
    .select({ hashtags: trendingTopicsTable.hashtags, score: trendingTopicsTable.score })
    .from(trendingTopicsTable)
    .where(
      and(
        eq(trendingTopicsTable.dismissed, false),
        gte(trendingTopicsTable.fetchedAt, since),
      ),
    )
    .orderBy(desc(trendingTopicsTable.score))
    .limit(200);
  const tally = new Map<string, number>();
  for (const r of rows) {
    for (const tag of r.hashtags ?? []) {
      if (typeof tag !== "string" || !tag.startsWith("#")) continue;
      const key = tag.toLowerCase();
      tally.set(key, (tally.get(key) ?? 0) + (r.score || 1));
    }
  }
  const ranked = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([tag, weight]) => ({ tag, weight: Math.round(weight * 100) / 100 }));
  res.json(ranked);
});

export default router;
