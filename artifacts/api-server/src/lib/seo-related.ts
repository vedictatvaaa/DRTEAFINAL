import { eq, ne, and, asc } from "drizzle-orm";
import {
  db,
  productsTable,
  articlesTable,
  type ProductRow,
  type ArticleRow,
} from "./db";
import { chatCompletionJSON } from "./openaiText";
import { logger } from "./logger";

const RERANK_CANDIDATES = 8;
const RELATED_LIMIT = 3;

interface AiRerank {
  productIds?: string[];
  articleSlugs?: string[];
}

async function aiRerank(opts: {
  seedKind: "product" | "article";
  seedSummary: string;
  productCandidates: Array<{ id: string; summary: string }>;
  articleCandidates: Array<{ slug: string; summary: string }>;
}): Promise<{ productIds: string[]; articleSlugs: string[] } | null> {
  if (
    opts.productCandidates.length === 0 &&
    opts.articleCandidates.length === 0
  ) {
    return null;
  }
  const prompt = [
    `Pick the most relevant related products and journal articles for this ${opts.seedKind}.`,
    `Return strict JSON with keys productIds (array of up to ${RELATED_LIMIT} product ids from the list) and articleSlugs (array of up to ${RELATED_LIMIT} article slugs from the list).`,
    `Choose items that complement or deepen the seed content; prefer variety over near-duplicates.`,
    ``,
    `SEED:`,
    opts.seedSummary,
    ``,
    `PRODUCT CANDIDATES:`,
    ...opts.productCandidates.map((p) => `- id=${p.id} :: ${p.summary}`),
    ``,
    `ARTICLE CANDIDATES:`,
    ...opts.articleCandidates.map((a) => `- slug=${a.slug} :: ${a.summary}`),
  ].join("\n");
  const ai = await chatCompletionJSON<AiRerank>({
    systemPrompt:
      "You are a content recommendation engine. Reply with JSON only.",
    userPrompt: prompt,
  });
  if (!ai) return null;
  const productIdSet = new Set(opts.productCandidates.map((c) => c.id));
  const articleSlugSet = new Set(opts.articleCandidates.map((c) => c.slug));
  const productIds = Array.isArray(ai.productIds)
    ? ai.productIds.filter((id): id is string => typeof id === "string" && productIdSet.has(id)).slice(0, RELATED_LIMIT)
    : [];
  const articleSlugs = Array.isArray(ai.articleSlugs)
    ? ai.articleSlugs.filter((s): s is string => typeof s === "string" && articleSlugSet.has(s)).slice(0, RELATED_LIMIT)
    : [];
  if (!productIds.length && !articleSlugs.length) return null;
  return { productIds, articleSlugs };
}

function productSummary(p: ProductRow): string {
  return `${p.name} (${p.category}) — ${(p.shortDescription || p.description || "").slice(0, 200)}`;
}
function articleSummary(a: ArticleRow): string {
  return `${a.title} (${a.category}) — ${(a.excerpt || "").slice(0, 200)}`;
}

interface Suggestion<T> {
  row: T;
  score: number;
}

function tokens(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function productTokens(p: ProductRow): Set<string> {
  return tokens(
    [
      p.category,
      p.name,
      p.description,
      p.shortDescription,
      ...(p.tastingNotes ?? []),
      ...(p.wellnessBenefits ?? []),
      ...(p.flavorProfile ?? []),
      ...(p.wellnessFocus ?? []),
      ...(p.moodTags ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function articleTokens(a: ArticleRow): Set<string> {
  const body = a.body
    .map((s) => [s.heading, ...(s.paragraphs ?? [])].filter(Boolean).join(" "))
    .join(" ");
  return tokens([a.category, a.title, a.excerpt, body].join(" "));
}

export interface RelatedSuggestions {
  productIds: string[];
  articleSlugs: string[];
}

export async function suggestRelatedForProduct(p: ProductRow): Promise<RelatedSuggestions> {
  const [products, articles] = await Promise.all([
    db.select().from(productsTable).where(ne(productsTable.id, p.id)).orderBy(asc(productsTable.name)),
    db.select().from(articlesTable).where(eq(articlesTable.published, true)),
  ]);
  const seed = productTokens(p);
  const ranked: Array<Suggestion<ProductRow>> = products
    .map((row) => ({
      row,
      score:
        jaccard(seed, productTokens(row)) +
        (row.category === p.category ? 0.15 : 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const articleRanked: Array<Suggestion<ArticleRow>> = articles
    .map((row) => ({ row, score: jaccard(seed, articleTokens(row)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const productCandidates = ranked.slice(0, RERANK_CANDIDATES);
  const articleCandidates = articleRanked.slice(0, RERANK_CANDIDATES);
  const heuristic = {
    productIds: productCandidates.slice(0, RELATED_LIMIT).map((r) => r.row.id),
    articleSlugs: articleCandidates.slice(0, RELATED_LIMIT).map((r) => r.row.slug),
  };
  const reranked = await aiRerank({
    seedKind: "product",
    seedSummary: productSummary(p),
    productCandidates: productCandidates.map((r) => ({
      id: r.row.id,
      summary: productSummary(r.row),
    })),
    articleCandidates: articleCandidates.map((r) => ({
      slug: r.row.slug,
      summary: articleSummary(r.row),
    })),
  });
  if (!reranked) return heuristic;
  return {
    productIds: reranked.productIds.length ? reranked.productIds : heuristic.productIds,
    articleSlugs: reranked.articleSlugs.length ? reranked.articleSlugs : heuristic.articleSlugs,
  };
}

export async function suggestRelatedForArticle(a: ArticleRow): Promise<RelatedSuggestions> {
  const [products, articles] = await Promise.all([
    db.select().from(productsTable),
    db
      .select()
      .from(articlesTable)
      .where(and(eq(articlesTable.published, true), ne(articlesTable.id, a.id))),
  ]);
  const seed = articleTokens(a);
  const ranked: Array<Suggestion<ProductRow>> = products
    .map((row) => ({ row, score: jaccard(seed, productTokens(row)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const articleRanked: Array<Suggestion<ArticleRow>> = articles
    .map((row) => ({
      row,
      score:
        jaccard(seed, articleTokens(row)) +
        (row.category === a.category ? 0.15 : 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const productCandidates = ranked.slice(0, RERANK_CANDIDATES);
  const articleCandidates = articleRanked.slice(0, RERANK_CANDIDATES);
  const heuristic = {
    productIds: productCandidates.slice(0, RELATED_LIMIT).map((r) => r.row.id),
    articleSlugs: articleCandidates.slice(0, RELATED_LIMIT).map((r) => r.row.slug),
  };
  const reranked = await aiRerank({
    seedKind: "article",
    seedSummary: articleSummary(a),
    productCandidates: productCandidates.map((r) => ({
      id: r.row.id,
      summary: productSummary(r.row),
    })),
    articleCandidates: articleCandidates.map((r) => ({
      slug: r.row.slug,
      summary: articleSummary(r.row),
    })),
  });
  if (!reranked) return heuristic;
  return {
    productIds: reranked.productIds.length ? reranked.productIds : heuristic.productIds,
    articleSlugs: reranked.articleSlugs.length ? reranked.articleSlugs : heuristic.articleSlugs,
  };
}

export async function persistRelatedForProduct(
  id: string,
  related: RelatedSuggestions,
): Promise<void> {
  try {
    await db
      .update(productsTable)
      .set({
        relatedProductIds: related.productIds,
        relatedArticleSlugs: related.articleSlugs,
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, id));
  } catch (err) {
    logger.error({ err, id }, "Failed to persist related for product");
  }
}

export async function persistRelatedForArticle(
  id: number,
  related: RelatedSuggestions,
): Promise<void> {
  try {
    await db
      .update(articlesTable)
      .set({
        relatedProductIds: related.productIds,
        relatedArticleSlugs: related.articleSlugs,
        updatedAt: new Date(),
      })
      .where(eq(articlesTable.id, id));
  } catch (err) {
    logger.error({ err, id }, "Failed to persist related for article");
  }
}

const inflight = new Set<string>();
function once(key: string, fn: () => Promise<void>): void {
  if (inflight.has(key)) return;
  inflight.add(key);
  void fn().finally(() => inflight.delete(key));
}

export function backfillRelatedForProduct(p: ProductRow, force = false): void {
  if (!force && (p.relatedProductIds?.length || p.relatedArticleSlugs?.length)) return;
  once(`rel:product:${p.id}`, async () => {
    const r = await suggestRelatedForProduct(p);
    await persistRelatedForProduct(p.id, r);
  });
}

export function backfillRelatedForArticle(a: ArticleRow, force = false): void {
  if (!force && (a.relatedProductIds?.length || a.relatedArticleSlugs?.length)) return;
  once(`rel:article:${a.id}`, async () => {
    const r = await suggestRelatedForArticle(a);
    await persistRelatedForArticle(a.id, r);
  });
}
