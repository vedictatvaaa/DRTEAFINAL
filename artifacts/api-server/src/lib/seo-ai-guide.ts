import { z } from "zod";
import { chatCompletionJSON } from "./openaiText";
import { logger } from "./logger";
import type { SeoEntityKind } from "./db";

const RewriteSchema = z.object({
  suggestions: z
    .array(z.object({ text: z.string().min(1), rationale: z.string().default("") }))
    .max(5),
});

const BriefSchema = z.object({
  workingTitle: z.string().min(1),
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  slug: z.string().min(1),
  intent: z.string().min(1),
  searchPersona: z.string().default(""),
  outline: z.array(z.object({ h2: z.string(), bullets: z.array(z.string()).default([]) })).default([]),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  internalLinkAnchors: z.array(z.string()).default([]),
  schemaToAdd: z.array(z.string()).default([]),
  primaryKeyword: z.string().default(""),
  semanticKeywords: z.array(z.string()).default([]),
  estimatedWordCount: z.number().int().min(200).max(5000).default(1200),
});

const OutreachSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

const LinkPicksSchema = z.object({
  picks: z
    .array(z.object({ anchor: z.string().min(1), url: z.string().min(1), reason: z.string().default("") }))
    .max(10),
});

interface RewriteSuggestion {
  text: string;
  rationale: string;
}

export interface SuggestRewritesInput {
  kind: SeoEntityKind;
  title: string;
  currentMetaTitle?: string;
  currentMetaDescription?: string;
  bodyExcerpt?: string;
  focusKeyword?: string;
  field: "metaTitle" | "metaDescription" | "slug" | "h1" | "intro";
}

export async function suggestRewrites(input: SuggestRewritesInput): Promise<RewriteSuggestion[]> {
  const constraints: Record<string, string> = {
    metaTitle: "35–60 characters, front-load the focus keyword, include the brand 'Dr Tea' when natural, no quotes.",
    metaDescription: "120–155 characters, compelling and concrete, include the focus keyword once near the start, end with a soft CTA.",
    slug: "lowercase, hyphenated, 3–6 words, no stop words, include the focus keyword.",
    h1: "60–80 characters, descriptive, contains the focus keyword once.",
    intro: "2 short sentences (40–60 words total), states the user benefit, includes the focus keyword naturally.",
  };

  const userPrompt = [
    `You are a senior SEO copywriter for an Indian premium tea brand "Dr Tea". Write 3 alternatives for the "${input.field}" field of a ${input.kind} page.`,
    `Constraints: ${constraints[input.field] ?? ""}`,
    input.focusKeyword ? `Focus keyword: "${input.focusKeyword}"` : "",
    `Page title: ${input.title}`,
    input.currentMetaTitle ? `Current meta title: ${input.currentMetaTitle}` : "",
    input.currentMetaDescription ? `Current meta description: ${input.currentMetaDescription}` : "",
    input.bodyExcerpt ? `Body excerpt: ${input.bodyExcerpt.slice(0, 800)}` : "",
    `Return JSON: { "suggestions": [{ "text": string, "rationale": string }, ...] } — exactly 3 items.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const json = await chatCompletionJSON({
      systemPrompt: "You return strict JSON. No prose outside JSON.",
      userPrompt,
    });
    const parsed = RewriteSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, "suggestRewrites: model returned invalid shape");
      return [];
    }
    return parsed.data.suggestions
      .map((s) => ({ text: s.text.trim(), rationale: s.rationale.trim() }))
      .slice(0, 5);
  } catch (err) {
    logger.warn({ err }, "suggestRewrites failed");
    return [];
  }
}

export interface ContentBriefInput {
  focusKeyword: string;
  kind: SeoEntityKind;
  intent?: string;
}

export interface ContentBrief {
  workingTitle: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  intent: string;
  searchPersona: string;
  outline: Array<{ h2: string; bullets: string[] }>;
  faqs: Array<{ q: string; a: string }>;
  internalLinkAnchors: string[];
  schemaToAdd: string[];
  primaryKeyword: string;
  semanticKeywords: string[];
  estimatedWordCount: number;
}

export async function generateBrief(input: ContentBriefInput): Promise<ContentBrief | null> {
  const prompt = `You are an SEO content strategist for Dr Tea (premium Indian tea brand, indian audience).
Build a content brief for a new "${input.kind}" page targeting the keyword: "${input.focusKeyword}".
Search intent guess: ${input.intent ?? "infer from the keyword"}.

Return STRICT JSON with these keys:
{
  "workingTitle": string,
  "metaTitle": string (35-60 chars),
  "metaDescription": string (120-155 chars),
  "slug": string (lowercase, hyphenated),
  "intent": "informational" | "commercial" | "transactional" | "navigational",
  "searchPersona": string (1 sentence about the searcher),
  "outline": [{ "h2": string, "bullets": [string, string, string] }, ... 5-7 items],
  "faqs": [{ "q": string, "a": string }, ... 4-6 items],
  "internalLinkAnchors": [string, ... 4-6 anchor texts to use],
  "schemaToAdd": [string, ... e.g. "Article", "FAQPage", "BreadcrumbList"],
  "primaryKeyword": string,
  "semanticKeywords": [string, ... 8-12 LSI/related terms],
  "estimatedWordCount": number (between 800 and 2200)
}
No prose outside JSON.`;

  try {
    const json = await chatCompletionJSON({
      systemPrompt: "You return strict JSON. No prose outside JSON.",
      userPrompt: prompt,
      maxTokens: 1600,
    });
    const parsed = BriefSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, "generateBrief: model returned invalid shape");
      return null;
    }
    return parsed.data;
  } catch (err) {
    logger.warn({ err }, "generateBrief failed");
    return null;
  }
}

export interface OutreachInput {
  prospectDomain: string;
  contactName?: string;
  angle: string;
  ourUrl: string;
}

export interface OutreachDraft {
  subject: string;
  body: string;
}

export async function draftOutreach(input: OutreachInput): Promise<OutreachDraft | null> {
  const prompt = `You are a polite, concise PR & link-outreach specialist writing on behalf of Dr Tea (premium Indian tea brand).
Write a short, genuine outreach email to ${input.contactName ? `${input.contactName} at ` : ""}${input.prospectDomain}.
Angle / why we'd be a good fit: ${input.angle}
Our relevant URL: ${input.ourUrl}

Rules: under 130 words, no fluff, no buzzwords, no "I hope this email finds you well". Specific compliment about their site, clear ask, easy out. No HTML. Sign off as "— The Dr Tea team".

Return STRICT JSON: { "subject": string, "body": string } — body uses \\n for line breaks.`;

  try {
    const json = await chatCompletionJSON({
      systemPrompt: "You return strict JSON. No prose outside JSON.",
      userPrompt: prompt,
    });
    const parsed = OutreachSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, "draftOutreach: model returned invalid shape");
      return null;
    }
    return parsed.data;
  } catch (err) {
    logger.warn({ err }, "draftOutreach failed");
    return null;
  }
}

export interface InternalLinkPick {
  anchor: string;
  url: string;
  reason: string;
}

export async function suggestInternalLinkAnchors(input: {
  kind: SeoEntityKind;
  title: string;
  excerpt: string;
  candidatePool: Array<{ url: string; title: string; summary: string }>;
}): Promise<InternalLinkPick[]> {
  if (input.candidatePool.length === 0) return [];
  const pool = input.candidatePool.slice(0, 40).map((c) => `- ${c.url} :: ${c.title} :: ${c.summary.slice(0, 140)}`).join("\n");
  const prompt = `You are an SEO internal-linking expert. From the candidate pool below, pick the 5 BEST internal links to add to this ${input.kind} page.
Page: "${input.title}"
Excerpt: ${input.excerpt.slice(0, 400)}

Candidates:
${pool}

Return STRICT JSON: { "picks": [{ "anchor": string (3-6 words), "url": string, "reason": string }, ...] } — 5 items.`;
  try {
    const json = await chatCompletionJSON({
      systemPrompt: "You return strict JSON. No prose outside JSON.",
      userPrompt: prompt,
    });
    const parsed = LinkPicksSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, "suggestInternalLinkAnchors: model returned invalid shape");
      return [];
    }
    return parsed.data.picks.slice(0, 5);
  } catch (err) {
    logger.warn({ err }, "suggestInternalLinkAnchors failed");
    return [];
  }
}
