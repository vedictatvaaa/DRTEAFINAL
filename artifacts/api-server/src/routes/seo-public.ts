import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc } from "drizzle-orm";
import {
  db,
  productsTable,
  articlesTable,
  teapediaEntriesTable,
  homepageSeoSettingsTable,
} from "../lib/db";
import { getSiteOrigin, productPath, articlePath } from "../lib/seo-site";
import { projectHomepageSeo } from "../lib/homepage-seo-defaults";

const router: IRouter = Router();

const STATIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/shop", priority: "0.9", changefreq: "daily" },
  { path: "/journal", priority: "0.8", changefreq: "weekly" },
  { path: "/teapedia", priority: "0.9", changefreq: "daily" },
  { path: "/about", priority: "0.5", changefreq: "monthly" },
  { path: "/quiz", priority: "0.5", changefreq: "monthly" },
  { path: "/contact", priority: "0.4", changefreq: "monthly" },
  { path: "/shipping", priority: "0.4", changefreq: "monthly" },
  { path: "/refunds", priority: "0.4", changefreq: "monthly" },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(opts: {
  loc: string;
  lastmod?: string;
  priority?: string;
  changefreq?: string;
  images?: Array<{ loc: string; title?: string }>;
}): string {
  const parts: string[] = [`<url><loc>${escapeXml(opts.loc)}</loc>`];
  if (opts.lastmod) parts.push(`<lastmod>${opts.lastmod}</lastmod>`);
  if (opts.changefreq) parts.push(`<changefreq>${opts.changefreq}</changefreq>`);
  if (opts.priority) parts.push(`<priority>${opts.priority}</priority>`);
  for (const img of opts.images ?? []) {
    parts.push(`<image:image><image:loc>${escapeXml(img.loc)}</image:loc>`);
    if (img.title) parts.push(`<image:title>${escapeXml(img.title)}</image:title>`);
    parts.push(`</image:image>`);
  }
  parts.push(`</url>`);
  return parts.join("");
}

router.get("/sitemap.xml", async (_req: Request, res: Response) => {
  const origin = getSiteOrigin();
  const [products, articles, teapedia] = await Promise.all([
    db.select().from(productsTable).orderBy(asc(productsTable.sortOrder)),
    db.select().from(articlesTable).where(eq(articlesTable.published, true)),
    db.select().from(teapediaEntriesTable).where(eq(teapediaEntriesTable.published, true)),
  ]);
  const entries: string[] = [];
  for (const sp of STATIC_PATHS) {
    entries.push(urlEntry({ loc: `${origin}${sp.path}`, priority: sp.priority, changefreq: sp.changefreq }));
  }
  for (const p of products) {
    const images = [p.imageUrl, ...(p.images ?? []).map((i) => i.url)]
      .filter(Boolean)
      .slice(0, 5)
      .map((url) => ({ loc: url, title: p.name }));
    entries.push(
      urlEntry({
        loc: `${origin}${productPath(p.slug)}`,
        lastmod: p.updatedAt.toISOString(),
        priority: "0.8",
        changefreq: "weekly",
        images,
      }),
    );
  }
  for (const a of articles) {
    entries.push(
      urlEntry({
        loc: `${origin}${articlePath(a.slug)}`,
        lastmod: a.updatedAt.toISOString(),
        priority: "0.6",
        changefreq: "monthly",
        images: a.cover ? [{ loc: a.cover, title: a.title }] : [],
      }),
    );
  }
  for (const t of teapedia) {
    entries.push(
      urlEntry({
        loc: `${origin}/teapedia/${t.slug}`,
        lastmod: t.updatedAt.toISOString(),
        priority: "0.7",
        changefreq: "weekly",
        images: t.hero ? [{ loc: t.hero, title: t.title }] : [],
      }),
    );
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">` +
    entries.join("") +
    `</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.send(xml);
});

router.get("/sitemap-images.xml", async (_req: Request, res: Response) => {
  const origin = getSiteOrigin();
  const products = await db.select().from(productsTable);
  const entries: string[] = [];
  for (const p of products) {
    const images = [p.imageUrl, ...(p.images ?? []).map((i) => i.url)].filter(Boolean);
    if (!images.length) continue;
    entries.push(
      urlEntry({
        loc: `${origin}${productPath(p.slug)}`,
        images: images.slice(0, 10).map((u) => ({ loc: u, title: p.name })),
      }),
    );
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">` +
    entries.join("") +
    `</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.send(xml);
});

// Public read-only projection of the singleton homepage_seo_settings row.
// Consumed by the dr-tea client to drive the H1, sr-only keyword expansion,
// keyword sub-line, meta keywords and breadcrumb root label. Falls back to
// the same defaults the admin sees on first load.
router.get("/api/seo-public/homepage", async (_req: Request, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(homepageSeoSettingsTable)
      .where(eq(homepageSeoSettingsTable.id, 1))
      .limit(1);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(projectHomepageSeo(row));
  } catch {
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(projectHomepageSeo(undefined));
  }
});

router.get("/robots.txt", (_req: Request, res: Response) => {
  const origin = getSiteOrigin();
  const body = [
    "User-agent: *",
    "Allow: /",
    // Admin surface — never index
    "Disallow: /admin",
    "Disallow: /api/admin",
    // User-private surfaces — no SEO value, prevents thin-content + duplicate hits
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /order-confirmed",
    "Disallow: /print-card",
    // Tracking-parameter URL variants are duplicates of the canonical
    "Disallow: /*?utm_",
    "Disallow: /*?fbclid",
    "Disallow: /*?gclid",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Sitemap: ${origin}/sitemap-images.xml`,
    "",
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(body);
});

export default router;
