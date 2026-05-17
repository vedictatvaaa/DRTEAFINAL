import { eq } from "drizzle-orm";
import { db, productsTable, articlesTable, type ProductRow, type ArticleRow } from "./db";
import { chatCompletionJSON } from "./openaiText";
import { siteUrl, productPath, articlePath } from "./seo-site";
import { logger } from "./logger";

export interface MetaBundle {
  metaTitle: string;
  metaDescription: string;
  jsonLd: Record<string, unknown> | null;
  hashtags: string[];
  seoKeywords: string[];
}

interface AiMeta {
  metaTitle?: string;
  metaDescription?: string;
  faq?: Array<{ question: string; answer: string }>;
  hashtags?: string[];
  seoKeywords?: string[];
}

const HASHTAG_LIMIT = 12;
const KEYWORD_LIMIT = 12;

function normaliseHashtag(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "").replace(/[^A-Za-z0-9_#]/g, "");
  if (!compact) return null;
  const withHash = compact.startsWith("#") ? compact : `#${compact}`;
  if (withHash.length < 3) return null;
  return withHash;
}

function normaliseKeyword(raw: string): string | null {
  const compact = raw.replace(/\s+/g, " ").trim().toLowerCase();
  if (compact.length < 2) return null;
  return compact;
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function cleanHashtags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = (input as unknown[])
    .filter((s): s is string => typeof s === "string")
    .map(normaliseHashtag)
    .filter((s): s is string => !!s);
  return dedupe(cleaned).slice(0, HASHTAG_LIMIT);
}

function cleanKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = (input as unknown[])
    .filter((s): s is string => typeof s === "string")
    .map(normaliseKeyword)
    .filter((s): s is string => !!s);
  return dedupe(cleaned).slice(0, KEYWORD_LIMIT);
}

function fallbackArticleHashtags(a: ArticleRow): string[] {
  const base = ["#DrTea", "#TeaJournal", "#TeaTime", "#TeaLovers"];
  const cat = a.category ? `#${a.category.replace(/[^A-Za-z0-9]/g, "")}` : "";
  const slugTag = a.slug
    ? `#${a.slug
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("")
        .slice(0, 30)}`
    : "";
  return cleanHashtags([...base, cat, slugTag]);
}

function fallbackArticleKeywords(a: ArticleRow): string[] {
  const out: string[] = [];
  if (a.title) out.push(a.title.toLowerCase());
  if (a.category) out.push(a.category.toLowerCase());
  if (a.category) out.push(`${a.category.toLowerCase()} tea`);
  if (a.slug) out.push(a.slug.replace(/-/g, " "));
  out.push("dr tea", "indian tea", "tea brewing", "tea benefits");
  return cleanKeywords(out);
}

function fallbackProductHashtags(p: ProductRow): string[] {
  const base = ["#DrTea", "#TeaTime", "#PremiumTea"];
  const cat = p.category ? `#${p.category.replace(/[^A-Za-z0-9]/g, "")}` : "";
  const name = p.name ? `#${p.name.replace(/[^A-Za-z0-9]/g, "")}` : "";
  return cleanHashtags([...base, cat, name]);
}

function fallbackProductKeywords(p: ProductRow): string[] {
  const out: string[] = [];
  if (p.name) out.push(p.name.toLowerCase());
  if (p.category) out.push(p.category.toLowerCase(), `${p.category.toLowerCase()} tea`);
  if (p.origin) out.push(`${p.origin.toLowerCase()} tea`);
  for (const note of p.tastingNotes ?? []) out.push(`${note.toLowerCase()} tea`);
  for (const benefit of p.wellnessBenefits ?? []) out.push(benefit.toLowerCase());
  return cleanKeywords(out);
}

const TITLE_MAX = 65;
const DESCRIPTION_MAX = 160;

function trim(text: string, max: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return compact.slice(0, max - 1).trimEnd() + "…";
}

function flattenArticleBody(rows: ArticleRow["body"]): string {
  return rows
    .map((s) => [s.heading, ...(s.paragraphs ?? [])].filter(Boolean).join(". "))
    .join(" ")
    .slice(0, 4000);
}

function fallbackProductMeta(p: ProductRow): MetaBundle {
  return {
    metaTitle: trim(`${p.name} — ${p.category} | Dr Tea`, TITLE_MAX),
    metaDescription: trim(p.shortDescription || p.description || "", DESCRIPTION_MAX),
    jsonLd: buildProductJsonLd(p, []),
    hashtags: fallbackProductHashtags(p),
    seoKeywords: fallbackProductKeywords(p),
  };
}

function fallbackArticleMeta(a: ArticleRow): MetaBundle {
  return {
    metaTitle: trim(`${a.title} | Dr Tea Journal`, TITLE_MAX),
    metaDescription: trim(a.excerpt || flattenArticleBody(a.body) || "", DESCRIPTION_MAX),
    jsonLd: buildArticleJsonLd(a, []),
    hashtags: fallbackArticleHashtags(a),
    seoKeywords: fallbackArticleKeywords(a),
  };
}

function buildProductJsonLd(
  p: ProductRow,
  faq: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  const url = siteUrl(productPath(p.slug));
  const offers = (p.variants ?? []).map((v) => ({
    "@type": "Offer",
    sku: `${p.id}-${v.size}`,
    name: `${p.name} (${v.size})`,
    priceCurrency: "INR",
    price: v.price,
    availability:
      v.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    url,
  }));
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.id,
    category: p.category,
    description: p.description,
    image: [p.imageUrl, ...(p.images ?? []).map((i) => i.url)].filter(Boolean),
    brand: { "@type": "Brand", name: "Dr Tea" },
    url,
  };
  if (offers.length) product.offers = offers;
  if (p.rating > 0 && p.reviewCount > 0) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.reviewCount,
    };
  }
  if (faq.length) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        product,
        {
          "@type": "FAQPage",
          mainEntity: faq.map((q) => ({
            "@type": "Question",
            name: q.question,
            acceptedAnswer: { "@type": "Answer", text: q.answer },
          })),
        },
      ],
    };
  }
  return product;
}

function buildArticleJsonLd(
  a: ArticleRow,
  faq: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  const url = siteUrl(articlePath(a.slug));
  const article: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt,
    image: a.cover ? [a.cover] : undefined,
    author: { "@type": "Organization", name: "Dr Tea" },
    publisher: {
      "@type": "Organization",
      name: "Dr Tea",
      logo: { "@type": "ImageObject", url: siteUrl("/favicon.svg") },
    },
    datePublished: a.date,
    mainEntityOfPage: url,
    articleSection: a.category,
  };
  if (faq.length) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        article,
        {
          "@type": "FAQPage",
          mainEntity: faq.map((q) => ({
            "@type": "Question",
            name: q.question,
            acceptedAnswer: { "@type": "Answer", text: q.answer },
          })),
        },
      ],
    };
  }
  return article;
}

export async function generateProductMeta(p: ProductRow): Promise<MetaBundle> {
  const prompt = [
    `You are an SEO copywriter for Dr Tea, a premium Indian tea brand.`,
    `Write meta for this product page. Return strict JSON with keys:`,
    `  metaTitle (<=60 chars, brand-friendly, includes product name)`,
    `  metaDescription (<=155 chars, keyword-rich, friendly, ends with a benefit)`,
    `  faq (array of 3 short Q&A pairs about brewing, taste, or wellness)`,
    `  hashtags (array of 8-12 viral, on-brand social hashtags including the # prefix; mix branded #DrTea with discovery tags like #TeaTime, #WellnessTea)`,
    `  seoKeywords (array of 8-12 long-tail, high-intent search keywords; lowercase phrases, no #)`,
    ``,
    `PRODUCT:`,
    `Name: ${p.name}`,
    `Category: ${p.category}`,
    `Origin: ${p.origin}`,
    `Tasting notes: ${(p.tastingNotes ?? []).join(", ")}`,
    `Wellness benefits: ${(p.wellnessBenefits ?? []).join(", ")}`,
    `Short: ${p.shortDescription}`,
    `Long: ${(p.description ?? "").slice(0, 1200)}`,
  ].join("\n");
  const ai = await chatCompletionJSON<AiMeta>({
    systemPrompt: "You produce concise, factual SEO meta as JSON only.",
    userPrompt: prompt,
  });
  const fallback = fallbackProductMeta(p);
  if (!ai) return fallback;
  const faq = Array.isArray(ai.faq) ? ai.faq.filter((q) => q.question && q.answer).slice(0, 5) : [];
  const hashtags = cleanHashtags(ai.hashtags);
  const seoKeywords = cleanKeywords(ai.seoKeywords);
  return {
    metaTitle: trim(ai.metaTitle || fallback.metaTitle, TITLE_MAX),
    metaDescription: trim(ai.metaDescription || fallback.metaDescription, DESCRIPTION_MAX),
    jsonLd: buildProductJsonLd(p, faq),
    hashtags: hashtags.length ? hashtags : fallback.hashtags,
    seoKeywords: seoKeywords.length ? seoKeywords : fallback.seoKeywords,
  };
}

export async function generateArticleMeta(a: ArticleRow): Promise<MetaBundle> {
  const prompt = [
    `You are an SEO copywriter for Dr Tea Journal.`,
    `Write meta for this article. Return strict JSON with keys:`,
    `  metaTitle (<=60 chars)`,
    `  metaDescription (<=155 chars, hooks the reader)`,
    `  faq (array of 3 short Q&A pairs related to the article)`,
    `  hashtags (array of 8-12 viral, on-brand social hashtags including the # prefix; pull from the article topic — mix branded tags like #DrTea, #TeaJournal with discovery tags relevant to the title/category)`,
    `  seoKeywords (array of 8-12 long-tail, high-intent search keywords related to the article topic; lowercase phrases, no #)`,
    ``,
    `ARTICLE:`,
    `Title: ${a.title}`,
    `Category: ${a.category}`,
    `Excerpt: ${a.excerpt}`,
    `Body: ${flattenArticleBody(a.body).slice(0, 2000)}`,
  ].join("\n");
  const ai = await chatCompletionJSON<AiMeta>({
    systemPrompt: "You produce concise, factual SEO meta as JSON only.",
    userPrompt: prompt,
  });
  const fallback = fallbackArticleMeta(a);
  if (!ai) return fallback;
  const faq = Array.isArray(ai.faq) ? ai.faq.filter((q) => q.question && q.answer).slice(0, 5) : [];
  const hashtags = cleanHashtags(ai.hashtags);
  const seoKeywords = cleanKeywords(ai.seoKeywords);
  return {
    metaTitle: trim(ai.metaTitle || fallback.metaTitle, TITLE_MAX),
    metaDescription: trim(ai.metaDescription || fallback.metaDescription, DESCRIPTION_MAX),
    jsonLd: buildArticleJsonLd(a, faq),
    hashtags: hashtags.length ? hashtags : fallback.hashtags,
    seoKeywords: seoKeywords.length ? seoKeywords : fallback.seoKeywords,
  };
}

/**
 * Save generated meta back to the row. Best-effort — logs and swallows
 * errors so callers (admin write paths) never see SEO failures.
 */
export async function persistProductMeta(id: string, meta: MetaBundle): Promise<void> {
  try {
    await db
      .update(productsTable)
      .set({
        metaTitle: meta.metaTitle,
        metaDescription: meta.metaDescription,
        jsonLd: meta.jsonLd,
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, id));
  } catch (err) {
    logger.error({ err, id }, "Failed to persist product meta");
  }
}

export async function persistArticleMeta(id: number, meta: MetaBundle): Promise<void> {
  try {
    await db
      .update(articlesTable)
      .set({
        metaTitle: meta.metaTitle,
        metaDescription: meta.metaDescription,
        jsonLd: meta.jsonLd,
        hashtags: meta.hashtags,
        seoKeywords: meta.seoKeywords,
        updatedAt: new Date(),
      })
      .where(eq(articlesTable.id, id));
  } catch (err) {
    logger.error({ err, id }, "Failed to persist article meta");
  }
}

/**
 * Fire-and-forget meta backfill triggered from admin write paths. Uses an
 * in-process inflight set to coalesce duplicate requests for the same row.
 */
const inflight = new Set<string>();
function once(key: string, fn: () => Promise<void>): void {
  if (inflight.has(key)) return;
  inflight.add(key);
  void fn().finally(() => inflight.delete(key));
}

export function backfillProductMeta(p: ProductRow, force = false): void {
  if (!force && p.metaTitle && p.metaDescription && p.jsonLd) return;
  once(`product:${p.id}`, async () => {
    const meta = await generateProductMeta(p);
    await persistProductMeta(p.id, meta);
  });
}

export function backfillArticleMeta(a: ArticleRow, force = false): void {
  const hasHashtags = (a.hashtags ?? []).length > 0;
  const hasKeywords = (a.seoKeywords ?? []).length > 0;
  if (!force && a.metaTitle && a.metaDescription && a.jsonLd && hasHashtags && hasKeywords) return;
  once(`article:${a.id}`, async () => {
    const meta = await generateArticleMeta(a);
    await persistArticleMeta(a.id, meta);
  });
}
