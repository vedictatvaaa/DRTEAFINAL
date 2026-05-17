import { db, productsTable, articlesTable, seoHealthSnapshotsTable } from "./db";
import { eq, desc } from "drizzle-orm";
import { siteUrl, productPath, articlePath } from "./seo-site";
import { logger } from "./logger";

export interface HealthSummary {
  // Computed live each request:
  catalog: {
    productCount: number;
    articleCount: number;
    productMissingMeta: Array<{ id: string; slug: string; name: string }>;
    articleMissingMeta: Array<{ id: number; slug: string; title: string }>;
    duplicateProductTitles: Array<{ title: string; ids: string[] }>;
    duplicateArticleTitles: Array<{ title: string; ids: number[] }>;
  };
  // Indexed-vs-unindexed proxy: items with complete meta + JSON-LD are
  // considered "ready to be indexed" (sitemap-eligible AND have searchable
  // metadata); items missing meta are not yet indexable. Operators should
  // still cross-check with Search Console — these are local proxies, not
  // live Google index counts.
  indexable: {
    productUrls: string[];
    articleUrls: string[];
    indexedCount: number;
    unindexedCount: number;
    totalUrls: number;
  };
  // From cache (refreshed via /admin/seo/health/refresh):
  brokenLinks: Array<{ from: string; to: string; status: number }>;
  crawledAt?: string;
  crawledUrlCount?: number;
  cwv: Array<{
    url: string;
    strategy: "mobile" | "desktop";
    lcp?: number;
    cls?: number;
    inp?: number;
    performance?: number;
    error?: string;
  }>;
  cwvFetchedAt?: string;
}

export async function computeHealthSummary(): Promise<HealthSummary> {
  const [products, articles, [snapshot]] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(articlesTable).where(eq(articlesTable.published, true)),
    db
      .select()
      .from(seoHealthSnapshotsTable)
      .orderBy(desc(seoHealthSnapshotsTable.createdAt))
      .limit(1),
  ]);

  const productMissingMeta = products
    .filter((p) => !p.metaTitle || !p.metaDescription || !p.jsonLd)
    .map((p) => ({ id: p.id, slug: p.slug, name: p.name }));
  const articleMissingMeta = articles
    .filter((a) => !a.metaTitle || !a.metaDescription || !a.jsonLd)
    .map((a) => ({ id: a.id, slug: a.slug, title: a.title }));

  const productTitles = new Map<string, string[]>();
  for (const p of products) {
    const t = (p.metaTitle || p.name).trim().toLowerCase();
    if (!t) continue;
    productTitles.set(t, [...(productTitles.get(t) ?? []), p.id]);
  }
  const articleTitles = new Map<string, number[]>();
  for (const a of articles) {
    const t = (a.metaTitle || a.title).trim().toLowerCase();
    if (!t) continue;
    articleTitles.set(t, [...(articleTitles.get(t) ?? []), a.id]);
  }

  return {
    catalog: {
      productCount: products.length,
      articleCount: articles.length,
      productMissingMeta,
      articleMissingMeta,
      duplicateProductTitles: [...productTitles.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([title, ids]) => ({ title, ids })),
      duplicateArticleTitles: [...articleTitles.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([title, ids]) => ({ title, ids })),
    },
    indexable: (() => {
      const productUrls = products.map((p) => siteUrl(productPath(p.slug)));
      const articleUrls = articles.map((a) => siteUrl(articlePath(a.slug)));
      const totalUrls = productUrls.length + articleUrls.length;
      const unindexedCount = productMissingMeta.length + articleMissingMeta.length;
      const indexedCount = Math.max(0, totalUrls - unindexedCount);
      return { productUrls, articleUrls, indexedCount, unindexedCount, totalUrls };
    })(),
    brokenLinks: snapshot?.summary.brokenLinks ?? [],
    crawledAt: snapshot?.summary.crawledAt,
    crawledUrlCount: snapshot?.summary.crawledUrlCount,
    cwv: snapshot?.summary.cwv ?? [],
    cwvFetchedAt: snapshot?.summary.cwvFetchedAt,
  };
}

const HREF_RE = /\bhref\s*=\s*["']([^"'#]+)/gi;

function extractInternalLinks(html: string, origin: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = HREF_RE.exec(html))) {
    const raw = m[1]!.trim();
    if (!raw) continue;
    if (raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:"))
      continue;
    try {
      const abs = new URL(raw, origin).toString();
      if (new URL(abs).origin === origin) out.add(abs);
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

/**
 * Crawl the storefront for broken internal links. Bounded fetch fan-out so
 * it remains cheap even on big catalogs. Operator triggers via the SEO Health
 * dashboard "Refresh" button.
 */
export async function crawlInternalLinks(origin: string, maxPages = 30): Promise<{
  crawled: number;
  brokenLinks: Array<{ from: string; to: string; status: number }>;
}> {
  const products = await db.select().from(productsTable);
  const articles = await db.select().from(articlesTable).where(eq(articlesTable.published, true));
  const seedPaths = [
    "/",
    "/shop",
    "/journal",
    "/about",
    "/quiz",
    ...products.map((p) => productPath(p.slug)),
    ...articles.map((a) => articlePath(a.slug)),
  ];
  const pages = seedPaths.slice(0, maxPages).map((p) => `${origin}${p}`);
  const linkSet = new Set<string>();
  for (const url of pages) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const html = await res.text();
      for (const link of extractInternalLinks(html, origin)) linkSet.add(link);
    } catch (err) {
      logger.warn({ err, url }, "Crawl page fetch failed");
    }
  }
  const broken: Array<{ from: string; to: string; status: number }> = [];
  const links = [...linkSet].slice(0, 200);
  await Promise.all(
    links.map(async (link) => {
      try {
        const r = await fetch(link, { method: "HEAD", signal: AbortSignal.timeout(8_000) });
        if (r.status >= 400) broken.push({ from: origin, to: link, status: r.status });
      } catch (err) {
        broken.push({ from: origin, to: link, status: 0 });
        logger.debug({ err, link }, "Broken link probe failed");
      }
    }),
  );
  return { crawled: pages.length, brokenLinks: broken };
}

/**
 * Fetches Core Web Vitals for a small set of URLs via Google's PageSpeed
 * Insights API. PSI works without an API key (rate-limited); if the operator
 * sets PSI_API_KEY they get higher limits.
 */
export async function fetchCwv(
  urls: string[],
  strategy: "mobile" | "desktop" = "mobile",
): Promise<HealthSummary["cwv"]> {
  const key = process.env.PSI_API_KEY?.trim();
  const out: HealthSummary["cwv"] = [];
  for (const url of urls.slice(0, 10)) {
    const params = new URLSearchParams({ url, strategy, category: "PERFORMANCE" });
    if (key) params.set("key", key);
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
    try {
      const res = await fetch(psiUrl, { signal: AbortSignal.timeout(45_000) });
      if (!res.ok) {
        out.push({ url, strategy, error: `HTTP ${res.status}` });
        continue;
      }
      const json = (await res.json()) as {
        lighthouseResult?: {
          audits?: Record<string, { numericValue?: number }>;
          categories?: { performance?: { score?: number } };
        };
      };
      const audits = json.lighthouseResult?.audits ?? {};
      out.push({
        url,
        strategy,
        lcp: audits["largest-contentful-paint"]?.numericValue,
        cls: audits["cumulative-layout-shift"]?.numericValue,
        inp: audits["interaction-to-next-paint"]?.numericValue ??
          audits["max-potential-fid"]?.numericValue,
        performance: json.lighthouseResult?.categories?.performance?.score,
      });
    } catch (err) {
      out.push({
        url,
        strategy,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

export async function refreshHealthSnapshot(opts: {
  origin: string;
  cwvUrls?: string[];
}): Promise<void> {
  const [{ crawled, brokenLinks }, cwv] = await Promise.all([
    crawlInternalLinks(opts.origin),
    fetchCwv(opts.cwvUrls ?? [], "mobile"),
  ]);
  await db.insert(seoHealthSnapshotsTable).values({
    summary: {
      crawledAt: new Date().toISOString(),
      crawledUrlCount: crawled,
      brokenLinks,
      cwv,
      cwvFetchedAt: new Date().toISOString(),
    },
  });
}
