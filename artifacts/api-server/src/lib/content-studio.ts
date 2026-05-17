import type { ContentChannel } from "@workspace/db";
import { chatCompletionJSON } from "./openaiText";
import { logger } from "./logger";

export const SOCIAL_CHANNELS: ContentChannel[] = [
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "linkedin",
  "youtube_shorts",
];

const BRAND_VOICE = [
  "You write for Dr Tea, a premium Indian tea brand.",
  "Voice: warm, sensorial, knowledgeable but never preachy. Lean on tea origins,",
  "sensory cues (aroma, mouthfeel), wellness rituals, and seasonal moments.",
  "Avoid medical claims. Avoid hype words like 'magic' or 'miracle'.",
  "Always sound human and specific — name a varietal, a region, a brewing tip.",
].join(" ");

interface ChannelRule {
  format: string;
  hashtagCount: string;
  cta: string;
}

const CHANNEL_RULES: Record<ContentChannel, ChannelRule> = {
  instagram: {
    format: "100-150 words, 1-3 short paragraphs, emoji-friendly, sensory hook in line 1",
    hashtagCount: "8-12 niche tea hashtags",
    cta: "soft CTA pointing to bio link or Stories",
  },
  facebook: {
    format: "80-150 words, conversational, question prompt to invite comments",
    hashtagCount: "1-3 hashtags max",
    cta: "CTA to comment / tag a friend",
  },
  twitter: {
    format: "<= 270 characters, single tweet, punchy hook",
    hashtagCount: "0-2 hashtags",
    cta: "implicit CTA, optional reply prompt",
  },
  pinterest: {
    format: "100-180 word pin description, keyword-rich, evocative imagery cues",
    hashtagCount: "5-8 SEO hashtags",
    cta: "CTA to save / shop",
  },
  linkedin: {
    format: "150-300 words, professional, story- or insight-driven (origin, sustainability, wellness science)",
    hashtagCount: "3-5 hashtags",
    cta: "thoughtful CTA to discuss in comments",
  },
  youtube_shorts: {
    format: "Short-form vertical video script under 60 seconds: 3-5 beat outline with on-screen text + voiceover",
    hashtagCount: "3-5 hashtags for the description",
    cta: "CTA to subscribe / visit shop",
  },
  blog: {
    format: "Markdown blog post (used by the blog generator only)",
    hashtagCount: "no hashtags",
    cta: "in-body CTA to a relevant product or related read",
  },
};

export interface SocialDraftOutput {
  body: string;
  hashtags: string[];
  cta: string;
  imagePrompt: string;
}

export async function generateSocialDraft(opts: {
  topic: string;
  channel: ContentChannel;
  productHint?: string;
}): Promise<SocialDraftOutput | null> {
  const rule = CHANNEL_RULES[opts.channel];
  const userPrompt = [
    `Channel: ${opts.channel}`,
    `Format rule: ${rule.format}`,
    `Hashtag rule: ${rule.hashtagCount}`,
    `CTA rule: ${rule.cta}`,
    `Topic: ${opts.topic}`,
    opts.productHint ? `Product context: ${opts.productHint}` : "",
    "",
    "Return strict JSON with keys:",
    `  body (string, the caption / script in the format above; do NOT include hashtags here)`,
    `  hashtags (array of plain strings without the # prefix)`,
    `  cta (one short call-to-action sentence)`,
    `  imagePrompt (one-sentence brief for an AI image generator describing the visual)`,
  ].filter(Boolean).join("\n");
  try {
    const out = await chatCompletionJSON<SocialDraftOutput>({
      systemPrompt: BRAND_VOICE,
      userPrompt,
      maxTokens: 800,
    });
    if (!out) return null;
    return {
      body: String(out.body ?? "").trim(),
      hashtags: Array.isArray(out.hashtags)
        ? out.hashtags
            .map((h) => String(h).replace(/^#/, "").trim())
            .filter(Boolean)
            .slice(0, 15)
        : [],
      cta: String(out.cta ?? "").trim(),
      imagePrompt: String(out.imagePrompt ?? "").trim(),
    };
  } catch (err) {
    logger.error({ err, channel: opts.channel }, "Social draft generation failed");
    return null;
  }
}

export interface BlogDraftOutput {
  title: string;
  body: string; // Markdown
  imagePrompt: string;
  jsonLd: Record<string, unknown> | null;
  cta: string;
  hashtags: string[];
}

export async function generateBlogDraft(opts: {
  topic: string;
  audience?: string;
}): Promise<BlogDraftOutput | null> {
  const userPrompt = [
    `Topic: ${opts.topic}`,
    opts.audience ? `Audience: ${opts.audience}` : "",
    "",
    "Write a full Markdown blog article (~700-1000 words). Structure:",
    "  - H1 title (do not include in body)",
    "  - 1-paragraph hero intro",
    "  - 3-5 H2 sections with 1-3 paragraphs each",
    "  - A '## FAQ' section with 3 question/answer pairs",
    "  - Closing CTA paragraph linking to /shop or a related article",
    "",
    "Return strict JSON with keys:",
    "  title (<= 70 chars)",
    "  body (Markdown WITHOUT the H1 — just the article body starting with the intro)",
    "  imagePrompt (single sentence brief for the hero image)",
    "  jsonLd (a schema.org Article JSON-LD object as a JSON object)",
    "  cta (one short closing CTA)",
    "  hashtags (3-6 SEO topic tags without #)",
  ].filter(Boolean).join("\n");
  try {
    const out = await chatCompletionJSON<BlogDraftOutput>({
      systemPrompt: BRAND_VOICE,
      userPrompt,
      maxTokens: 3000,
    });
    if (!out) return null;
    return {
      title: String(out.title ?? "").trim(),
      body: String(out.body ?? "").trim(),
      imagePrompt: String(out.imagePrompt ?? "").trim(),
      jsonLd: (out.jsonLd && typeof out.jsonLd === "object")
        ? (out.jsonLd as Record<string, unknown>)
        : null,
      cta: String(out.cta ?? "").trim(),
      hashtags: Array.isArray(out.hashtags)
        ? out.hashtags.map((h) => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 8)
        : [],
    };
  } catch (err) {
    logger.error({ err }, "Blog draft generation failed");
    return null;
  }
}

export interface TrendIdeaOutput {
  headline: string;
  rationale: string;
  channels: ContentChannel[];
}

const VALID_CHANNELS = new Set<ContentChannel>([
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "linkedin",
  "youtube_shorts",
  "blog",
]);

/**
 * Generate ~5 timely post ideas for a seed keyword. Used by the daily cron
 * (no live trends scraping; we feed a curated list of tea/wellness/festival
 * keywords plus the current month so the AI can lean on seasonality).
 */
export async function generateTrendIdeas(opts: {
  seedKeywords: string[];
  count?: number;
}): Promise<TrendIdeaOutput[]> {
  const today = new Date();
  const userPrompt = [
    `Today is ${today.toISOString().slice(0, 10)} (month: ${today.toLocaleString("en", { month: "long" })}).`,
    `Seed keywords: ${opts.seedKeywords.join(", ")}`,
    "",
    `Suggest ${opts.count ?? 5} timely Dr Tea content post ideas. Mix channels.`,
    "Lean into the current season, festivals (Diwali, Holi, monsoon, winter wellness, etc.),",
    "and sensory storytelling. Avoid medical claims.",
    "",
    "Return strict JSON: { ideas: [ { headline, rationale, channels } ] }",
    "  - headline: <= 80 chars hook",
    "  - rationale: 1-2 sentences explaining the angle",
    "  - channels: array of 1-3 channels from",
    "    [instagram, facebook, twitter, pinterest, linkedin, youtube_shorts, blog]",
  ].join("\n");
  try {
    const out = await chatCompletionJSON<{ ideas?: TrendIdeaOutput[] }>({
      systemPrompt: BRAND_VOICE,
      userPrompt,
      maxTokens: 1500,
    });
    if (!out?.ideas || !Array.isArray(out.ideas)) return [];
    return out.ideas
      .map((i) => ({
        headline: String(i.headline ?? "").trim(),
        rationale: String(i.rationale ?? "").trim(),
        channels: Array.isArray(i.channels)
          ? i.channels
              .map((c) => String(c).trim() as ContentChannel)
              .filter((c) => VALID_CHANNELS.has(c))
          : [],
      }))
      .filter((i) => i.headline);
  } catch (err) {
    logger.error({ err }, "Trend ideas generation failed");
    return [];
  }
}

/** Default seed keywords used by the trend cron. */
export const DEFAULT_TREND_SEEDS = [
  "Indian tea",
  "wellness tea",
  "Ayurvedic tea ritual",
  "matcha vs masala chai",
  "Darjeeling first flush",
  "monsoon comfort",
  "festive gifting",
  "morning routine",
  "tea pairing",
  "single-origin tea",
];
