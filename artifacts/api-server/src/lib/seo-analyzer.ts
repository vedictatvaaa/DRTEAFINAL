import {
  db,
  productsTable,
  articlesTable,
  teapediaEntriesTable,
  recipesTable,
  contentHubEntriesTable,
  type SeoEntityKind,
  type ProductRow,
  type ArticleRow,
  type TeapediaEntryRow,
  type RecipeRow,
  type ContentHubEntryRow,
} from "./db";
import { eq } from "drizzle-orm";
import { productPath, articlePath } from "./seo-site";

export type SeoSeverity = "info" | "warn" | "error";

export interface SeoIssue {
  code: string;
  severity: SeoSeverity;
  message: string;
  fix?: string;
}

export interface SeoSuggestion {
  label: string;
  field: string;
  before?: string;
  after: string;
}

export interface SeoAnalysis {
  kind: SeoEntityKind;
  ref: string;
  url: string | null;
  title: string;
  score: number;
  breakdown: {
    title: number;
    description: number;
    slug: number;
    content: number;
    images: number;
    schema: number;
    internalLinks: number;
    keywords: number;
    readability: number;
  };
  issues: SeoIssue[];
  quickFixes: SeoSuggestion[];
  raw: {
    metaTitle: string;
    metaDescription: string;
    bodyWordCount: number;
    imageCount: number;
    imageMissingAlt: number;
    hasJsonLd: boolean;
    internalLinkCount: number;
    keywords: string[];
  };
}

interface NormalisedEntity {
  kind: SeoEntityKind;
  ref: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  bodyText: string;
  bodyWordCount: number;
  hasJsonLd: boolean;
  imageCount: number;
  imageMissingAlt: number;
  internalLinkCount: number;
  keywords: string[];
  relatedCount: number;
  url: string | null;
}

const TITLE_MIN = 35;
const TITLE_MAX = 65;
const DESC_MIN = 110;
const DESC_MAX = 160;
const BODY_MIN_WORDS = 280;
const BODY_GOOD_WORDS = 600;
const SLUG_MAX = 72;
const KEYWORD_MIN = 3;

function wordsIn(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function bodyToText(body: unknown): string {
  if (!Array.isArray(body)) return "";
  const parts: string[] = [];
  for (const block of body as Array<{ heading?: string; paragraphs?: string[] }>) {
    if (block?.heading) parts.push(block.heading);
    if (Array.isArray(block?.paragraphs)) parts.push(...block.paragraphs);
  }
  return parts.join("\n\n");
}

function recipeBodyText(r: RecipeRow): string {
  const stepText = (r.steps ?? []).map((s) => `${s.title ?? ""} ${s.body}`).join("\n");
  const ingText = (r.ingredients ?? []).map((i) => `${i.amount} ${i.name}`).join(", ");
  return [r.summary, ingText, stepText, (r.tips ?? []).join("\n")].filter(Boolean).join("\n\n");
}

function productBodyText(p: ProductRow): string {
  const benefits = (p.wellnessBenefits ?? []).join(", ");
  const notes = (p.tastingNotes ?? []).join(", ");
  const brew = `${p.brewingGuide?.temperature ?? ""} ${p.brewingGuide?.steepTime ?? ""}`;
  return [p.description, p.shortDescription, p.plantationStory, benefits, notes, brew]
    .filter(Boolean)
    .join("\n\n");
}

async function loadEntity(
  kind: SeoEntityKind,
  ref: string,
): Promise<NormalisedEntity | null> {
  if (kind === "product") {
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, ref)).limit(1);
    if (!row) return null;
    const body = productBodyText(row);
    const images = [row.imageUrl, ...(row.images ?? []).map((i) => i.url)].filter(Boolean);
    const missingAlt = (row.images ?? []).filter((i) => !i.alt || i.alt.trim().length < 3).length;
    return {
      kind,
      ref,
      slug: row.slug,
      title: row.name,
      metaTitle: row.metaTitle ?? "",
      metaDescription: row.metaDescription ?? "",
      excerpt: row.shortDescription ?? "",
      bodyText: body,
      bodyWordCount: wordsIn(body),
      hasJsonLd: !!row.jsonLd,
      imageCount: images.length,
      imageMissingAlt: missingAlt,
      internalLinkCount: (row.relatedProductIds?.length ?? 0) + (row.relatedArticleSlugs?.length ?? 0),
      keywords: [],
      relatedCount: (row.relatedProductIds?.length ?? 0) + (row.relatedArticleSlugs?.length ?? 0),
      url: productPath(row.slug),
    };
  }
  if (kind === "article") {
    const id = Number(ref);
    if (Number.isNaN(id)) return null;
    const [row] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
    if (!row) return null;
    const body = bodyToText(row.body);
    return {
      kind,
      ref,
      slug: row.slug,
      title: row.title,
      metaTitle: row.metaTitle ?? "",
      metaDescription: row.metaDescription ?? "",
      excerpt: row.excerpt ?? "",
      bodyText: body,
      bodyWordCount: wordsIn(body),
      hasJsonLd: !!row.jsonLd,
      imageCount: row.cover ? 1 : 0,
      imageMissingAlt: 0,
      internalLinkCount: (row.relatedProductIds?.length ?? 0) + (row.relatedArticleSlugs?.length ?? 0),
      keywords: row.seoKeywords ?? [],
      relatedCount: (row.relatedProductIds?.length ?? 0) + (row.relatedArticleSlugs?.length ?? 0),
      url: articlePath(row.slug),
    };
  }
  if (kind === "teapedia") {
    const id = Number(ref);
    if (Number.isNaN(id)) return null;
    const [row] = await db.select().from(teapediaEntriesTable).where(eq(teapediaEntriesTable.id, id)).limit(1);
    if (!row) return null;
    const body = bodyToText(row.body);
    return {
      kind,
      ref,
      slug: row.slug,
      title: row.title,
      metaTitle: row.metaTitle ?? "",
      metaDescription: row.metaDescription ?? "",
      excerpt: row.summary ?? "",
      bodyText: body,
      bodyWordCount: wordsIn(body),
      hasJsonLd: !!row.jsonLd,
      imageCount: row.hero ? 1 : 0,
      imageMissingAlt: 0,
      internalLinkCount:
        (row.relatedProductIds?.length ?? 0) +
        (row.relatedCategorySlugs?.length ?? 0) +
        (row.relatedEntrySlugs?.length ?? 0),
      keywords: [],
      relatedCount:
        (row.relatedProductIds?.length ?? 0) +
        (row.relatedCategorySlugs?.length ?? 0) +
        (row.relatedEntrySlugs?.length ?? 0),
      url: `/teapedia/${row.slug}`,
    };
  }
  if (kind === "recipe") {
    const id = Number(ref);
    if (Number.isNaN(id)) return null;
    const [row] = await db.select().from(recipesTable).where(eq(recipesTable.id, id)).limit(1);
    if (!row) return null;
    const body = recipeBodyText(row);
    return {
      kind,
      ref,
      slug: row.slug,
      title: row.title,
      metaTitle: row.metaTitle ?? "",
      metaDescription: row.metaDescription ?? "",
      excerpt: row.summary ?? "",
      bodyText: body,
      bodyWordCount: wordsIn(body),
      hasJsonLd: false, // recipes emit JSON-LD inline on the page from row data
      imageCount: row.hero ? 1 : 0,
      imageMissingAlt: 0,
      internalLinkCount: row.relatedProductIds?.length ?? 0,
      keywords: row.seoKeywords ?? [],
      relatedCount: row.relatedProductIds?.length ?? 0,
      url: `/recipes/${row.slug}`,
    };
  }
  if (kind === "content-hub") {
    const id = Number(ref);
    if (Number.isNaN(id)) return null;
    const [row] = await db.select().from(contentHubEntriesTable).where(eq(contentHubEntriesTable.id, id)).limit(1);
    if (!row) return null;
    const body = bodyToText(row.body);
    return {
      kind,
      ref,
      slug: row.slug,
      title: row.title,
      metaTitle: row.metaTitle ?? "",
      metaDescription: row.metaDescription ?? "",
      excerpt: row.summary ?? "",
      bodyText: body,
      bodyWordCount: wordsIn(body),
      hasJsonLd: !!row.jsonLd,
      imageCount: row.hero ? 1 : 0,
      imageMissingAlt: 0,
      internalLinkCount:
        (row.relatedProductIds?.length ?? 0) +
        (row.relatedRecipeSlugs?.length ?? 0) +
        (row.relatedEntrySlugs?.length ?? 0),
      keywords: [],
      relatedCount:
        (row.relatedProductIds?.length ?? 0) +
        (row.relatedRecipeSlugs?.length ?? 0) +
        (row.relatedEntrySlugs?.length ?? 0),
      url: `/${row.hub === "regional" ? "regional-teas" : row.hub === "wellness" ? "wellness" : "pairings"}/${row.slug}`,
    };
  }
  return null;
}

function scoreTitle(t: string): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  const len = t.trim().length;
  if (len === 0) {
    issues.push({ code: "title.missing", severity: "error", message: "Meta title is empty", fix: "Generate a meta title with the AI suggester" });
    return { score: 0, issues };
  }
  if (len < TITLE_MIN) {
    issues.push({ code: "title.short", severity: "warn", message: `Meta title is ${len} chars; aim for ${TITLE_MIN}-${TITLE_MAX}` });
    return { score: 60, issues };
  }
  if (len > TITLE_MAX) {
    issues.push({ code: "title.long", severity: "warn", message: `Meta title is ${len} chars; Google truncates around ${TITLE_MAX}` });
    return { score: 70, issues };
  }
  return { score: 100, issues };
}

function scoreDescription(d: string): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  const len = d.trim().length;
  if (len === 0) {
    issues.push({ code: "desc.missing", severity: "error", message: "Meta description is empty", fix: "Generate a meta description with the AI suggester" });
    return { score: 0, issues };
  }
  if (len < DESC_MIN) {
    issues.push({ code: "desc.short", severity: "warn", message: `Meta description is ${len} chars; aim for ${DESC_MIN}-${DESC_MAX}` });
    return { score: 60, issues };
  }
  if (len > DESC_MAX) {
    issues.push({ code: "desc.long", severity: "warn", message: `Meta description is ${len} chars; SERP truncates around ${DESC_MAX}` });
    return { score: 75, issues };
  }
  return { score: 100, issues };
}

function scoreSlug(slug: string): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  if (!slug) {
    issues.push({ code: "slug.missing", severity: "error", message: "Slug is empty" });
    return { score: 0, issues };
  }
  if (slug.length > SLUG_MAX) {
    issues.push({ code: "slug.long", severity: "warn", message: `Slug is ${slug.length} chars; keep under ${SLUG_MAX}` });
    return { score: 70, issues };
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    issues.push({ code: "slug.format", severity: "warn", message: "Slug should be lowercase letters, numbers, and hyphens only" });
    return { score: 75, issues };
  }
  return { score: 100, issues };
}

function scoreContent(words: number): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  if (words < BODY_MIN_WORDS) {
    issues.push({ code: "content.thin", severity: "warn", message: `Body is ${words} words; thin-content threshold ~${BODY_MIN_WORDS}` });
    return { score: Math.max(20, Math.round((words / BODY_MIN_WORDS) * 70)), issues };
  }
  if (words < BODY_GOOD_WORDS) {
    return { score: 80, issues: [] };
  }
  return { score: 100, issues: [] };
}

function scoreImages(count: number, missingAlt: number): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  if (count === 0) {
    issues.push({ code: "image.missing", severity: "warn", message: "No images on this page" });
    return { score: 50, issues };
  }
  if (missingAlt > 0) {
    issues.push({ code: "image.alt", severity: "warn", message: `${missingAlt} image(s) missing alt text`, fix: "Add descriptive alt text" });
    return { score: Math.max(60, 100 - missingAlt * 10), issues };
  }
  return { score: 100, issues: [] };
}

function scoreSchema(has: boolean, kind: SeoEntityKind): { score: number; issues: SeoIssue[] } {
  if (has) return { score: 100, issues: [] };
  if (kind === "recipe") {
    // Recipes generate JSON-LD inline from the row, not from the jsonLd column.
    return { score: 100, issues: [] };
  }
  return {
    score: 30,
    issues: [
      {
        code: "schema.missing",
        severity: "error",
        message: "No JSON-LD structured data",
        fix: "Generate schema with the AI suggester",
      },
    ],
  };
}

function scoreInternalLinks(count: number): { score: number; issues: SeoIssue[] } {
  if (count >= 3) return { score: 100, issues: [] };
  if (count >= 1) return { score: 70, issues: [{ code: "links.few", severity: "info", message: "Add more internal links for better topic clustering" }] };
  return { score: 30, issues: [{ code: "links.missing", severity: "warn", message: "No internal links" }] };
}

function scoreKeywords(keywords: string[]): { score: number; issues: SeoIssue[] } {
  if (keywords.length >= KEYWORD_MIN) return { score: 100, issues: [] };
  if (keywords.length > 0) return { score: 70, issues: [{ code: "keywords.few", severity: "info", message: `${keywords.length} keyword(s) — aim for ${KEYWORD_MIN}+` }] };
  return { score: 50, issues: [{ code: "keywords.missing", severity: "info", message: "No focus keywords set" }] };
}

function scoreReadability(text: string): { score: number; issues: SeoIssue[] } {
  if (!text.trim()) return { score: 50, issues: [] };
  // Lightweight readability proxy: average sentence length and word length.
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return { score: 60, issues: [] };
  const avgLen = sentences.reduce((a, s) => a + s.trim().split(/\s+/).length, 0) / sentences.length;
  const issues: SeoIssue[] = [];
  if (avgLen > 28) {
    issues.push({ code: "readability.long", severity: "info", message: `Average sentence is ${Math.round(avgLen)} words — try breaking long sentences` });
    return { score: 70, issues };
  }
  if (avgLen < 8) {
    issues.push({ code: "readability.short", severity: "info", message: `Average sentence is ${Math.round(avgLen)} words — content may feel choppy` });
    return { score: 80, issues };
  }
  return { score: 100, issues: [] };
}

export async function analyzeEntity(
  kind: SeoEntityKind,
  ref: string,
): Promise<SeoAnalysis | null> {
  const e = await loadEntity(kind, ref);
  if (!e) return null;

  // Score raw meta fields so missing meta is penalized (don't silently fall back
  // to the on-page title/excerpt — that produced inflated "healthy" scores for
  // pages that had no meta_title/meta_description set).
  const t = scoreTitle(e.metaTitle ?? "");
  if (!e.metaTitle || !e.metaTitle.trim()) {
    t.issues.push({
      code: "title.metaMissing",
      severity: "error",
      message: "Meta title is empty — set a unique <title> for this page",
      fix: e.title ? `Suggest: "${e.title}"` : undefined,
    });
    t.score = Math.min(t.score, 30);
  }
  const d = scoreDescription(e.metaDescription ?? "");
  if (!e.metaDescription || !e.metaDescription.trim()) {
    d.issues.push({
      code: "description.metaMissing",
      severity: "error",
      message: "Meta description is empty — write a 120-155 char summary",
      fix: e.excerpt ? `Source excerpt: "${e.excerpt.slice(0, 180)}"` : undefined,
    });
    d.score = Math.min(d.score, 30);
  }
  const s = scoreSlug(e.slug);
  const c = scoreContent(e.bodyWordCount);
  const i = scoreImages(e.imageCount, e.imageMissingAlt);
  const sc = scoreSchema(e.hasJsonLd, kind);
  const il = scoreInternalLinks(e.internalLinkCount);
  const kw = scoreKeywords(e.keywords);
  const r = scoreReadability(e.bodyText);

  // Weighted overall score.
  const breakdown = {
    title: t.score,
    description: d.score,
    slug: s.score,
    content: c.score,
    images: i.score,
    schema: sc.score,
    internalLinks: il.score,
    keywords: kw.score,
    readability: r.score,
  };
  const weights = { title: 0.15, description: 0.15, slug: 0.05, content: 0.18, images: 0.08, schema: 0.14, internalLinks: 0.1, keywords: 0.08, readability: 0.07 };
  const score = Math.round(
    (Object.entries(breakdown) as Array<[keyof typeof breakdown, number]>).reduce(
      (acc, [k, v]) => acc + v * weights[k],
      0,
    ),
  );

  const issues = [
    ...t.issues,
    ...d.issues,
    ...s.issues,
    ...c.issues,
    ...i.issues,
    ...sc.issues,
    ...il.issues,
    ...kw.issues,
    ...r.issues,
  ];

  const quickFixes: SeoSuggestion[] = [];
  if (!e.metaTitle) quickFixes.push({ label: "Generate meta title", field: "metaTitle", after: "" });
  if (!e.metaDescription) quickFixes.push({ label: "Generate meta description", field: "metaDescription", after: "" });
  if (!e.hasJsonLd && kind !== "recipe") quickFixes.push({ label: "Generate JSON-LD schema", field: "jsonLd", after: "" });
  if (e.internalLinkCount < 3) quickFixes.push({ label: "Suggest internal links", field: "relatedLinks", after: "" });

  return {
    kind,
    ref,
    url: e.url,
    title: e.title,
    score,
    breakdown,
    issues,
    quickFixes,
    raw: {
      metaTitle: e.metaTitle,
      metaDescription: e.metaDescription,
      bodyWordCount: e.bodyWordCount,
      imageCount: e.imageCount,
      imageMissingAlt: e.imageMissingAlt,
      hasJsonLd: e.hasJsonLd,
      internalLinkCount: e.internalLinkCount,
      keywords: e.keywords,
    },
  };
}

export async function siteWideOpportunities(): Promise<
  Array<{ kind: SeoEntityKind; ref: string; title: string; score: number; topIssue: string }>
> {
  // Pulls top 30 lowest-scored published items for the dashboard.
  const [products, articles, teap, recipes, hub] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(articlesTable).where(eq(articlesTable.published, true)),
    db.select().from(teapediaEntriesTable).where(eq(teapediaEntriesTable.published, true)),
    db.select().from(recipesTable).where(eq(recipesTable.published, true)),
    db.select().from(contentHubEntriesTable).where(eq(contentHubEntriesTable.published, true)),
  ]);

  const targets: Array<{ kind: SeoEntityKind; ref: string }> = [
    ...products.map((p) => ({ kind: "product" as const, ref: p.id })),
    ...articles.map((a) => ({ kind: "article" as const, ref: String(a.id) })),
    ...teap.map((t) => ({ kind: "teapedia" as const, ref: String(t.id) })),
    ...recipes.map((r) => ({ kind: "recipe" as const, ref: String(r.id) })),
    ...hub.map((h) => ({ kind: "content-hub" as const, ref: String(h.id) })),
  ];

  const out: Array<{ kind: SeoEntityKind; ref: string; title: string; score: number; topIssue: string }> = [];
  for (const t of targets) {
    const a = await analyzeEntity(t.kind, t.ref);
    if (!a) continue;
    if (a.score >= 95) continue;
    out.push({
      kind: a.kind,
      ref: a.ref,
      title: a.title,
      score: a.score,
      topIssue: a.issues[0]?.message ?? "Minor improvements available",
    });
  }
  out.sort((a, b) => a.score - b.score);
  return out.slice(0, 30);
}
