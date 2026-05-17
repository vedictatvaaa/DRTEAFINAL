import type {
  ContentChannel,
  ExperienceBanner,
  ExperienceHeroTakeover,
  ParticleEffect,
  AdCreative,
} from "@workspace/db";
import { z } from "zod";
import { chatCompletionJSON } from "./openaiText";
import { logger } from "./logger";

const SocialChannelEnum = z.enum(["instagram","facebook","twitter","pinterest","linkedin"]);
const ParticleEnum = z.enum(["none","rain","snow","leaves","diyas","petals"]);

export const CampaignBundleSchema = z.object({
  experience: z.object({
    name: z.string(),
    themeTokens: z.record(z.string()).optional(),
    banner: z.object({}).passthrough().nullish(),
    heroTakeover: z.object({}).passthrough().nullish(),
    particleEffect: ParticleEnum.optional(),
  }),
  blog: z.object({
    title: z.string(),
    body: z.string(),
    imagePrompt: z.string(),
    cta: z.string(),
    hashtags: z.array(z.string()),
  }),
  socials: z.array(z.object({
    channel: SocialChannelEnum,
    body: z.string(),
    hashtags: z.array(z.string()),
    cta: z.string(),
    imagePrompt: z.string(),
  })),
  email: z.object({
    subject: z.string(),
    preheader: z.string(),
    body: z.string(),
    ctaLabel: z.string(),
    ctaUrl: z.string(),
  }),
  adCreatives: z.array(z.object({
    headline: z.string(),
    description: z.string(),
    imagePrompt: z.string(),
    imageUrl: z.string().nullish(),
  })),
});

const PARTICLE_VALUES: ParticleEffect[] = ["none", "rain", "snow", "leaves", "diyas", "petals"];

const SOCIAL_CHANNELS: ContentChannel[] = [
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "linkedin",
];

const BRAND_VOICE = [
  "You write for Dr Tea, a premium Indian tea brand.",
  "Voice: warm, sensorial, knowledgeable but never preachy. Lean on tea origins,",
  "sensory cues, wellness rituals, and seasonal moments. No medical claims.",
  "Always sound human and specific — name a varietal, region, or brewing tip.",
].join(" ");

export interface CampaignBundle {
  experience: {
    name: string;
    themeTokens?: Record<string, string>;
    banner?: ExperienceBanner | null;
    heroTakeover?: ExperienceHeroTakeover | null;
    particleEffect?: ParticleEffect;
  };
  blog: { title: string; body: string; imagePrompt: string; cta: string; hashtags: string[] };
  socials: Array<{
    channel: ContentChannel;
    body: string;
    hashtags: string[];
    cta: string;
    imagePrompt: string;
  }>;
  email: { subject: string; preheader: string; body: string; ctaLabel: string; ctaUrl: string };
  adCreatives: AdCreative[];
}

export interface OrchestrateInput {
  brief: string;
  moment?: string;
  productHints?: Array<{ id: string; name: string; category: string; shortDescription: string }>;
  keywordDigest?: Array<{ term: string; summary: string }>;
}

/**
 * Single orchestrated AI call that returns the full campaign bundle.
 * Each section is best-effort — missing fields fall back to safe defaults
 * so the operator can edit any card inline before approval.
 */
export async function orchestrateCampaign(
  input: OrchestrateInput,
): Promise<CampaignBundle | null> {
  const productLines = (input.productHints ?? [])
    .slice(0, 6)
    .map((p) => `- ${p.name} (${p.category}): ${p.shortDescription}`)
    .join("\n");

  const keywordLines = (input.keywordDigest ?? [])
    .slice(0, 8)
    .map((k) => `- "${k.term}": ${k.summary}`)
    .join("\n");

  const userPrompt = [
    `Campaign moment: ${input.moment || "(operator brief only)"}`,
    `Operator brief: ${input.brief}`,
    productLines ? `Featured products:\n${productLines}` : "",
    keywordLines ? `Recent organic-search trends to lean into where natural:\n${keywordLines}` : "",
    "",
    "Propose a complete Dr Tea campaign bundle. Return STRICT JSON with keys:",
    "  experience: {",
    "    name (<= 60 chars label),",
    "    themeTokens (optional map of CSS vars like {\"--primary\":\"24 60% 40%\"}; keep small),",
    "    banner: { text (<= 80 chars), ctaLabel?, ctaHref? } | null,",
    "    heroTakeover: { eyebrow?, title (<= 60 chars), subtitle?, ctaLabel, ctaHref, imageUrl? } | null,",
    "    particleEffect: one of [none,rain,snow,leaves,diyas,petals]",
    "  }",
    "  blog: { title (<= 70 chars), body (Markdown ~600 words, no H1), imagePrompt, cta, hashtags (3-6) }",
    "  socials: array of objects, ONE per channel in [instagram,facebook,twitter,pinterest,linkedin].",
    "    Each: { channel, body (per-channel rules: ig 100-150 words, fb 80-150 words, twitter <=270 chars,",
    "    pinterest 100-180 words, linkedin 150-300 words), hashtags (without #), cta, imagePrompt }",
    "  email: { subject (<= 60 chars), preheader (<= 90 chars), body (HTML-safe plain markdown ~250 words),",
    "    ctaLabel, ctaUrl (use /shop or a relevant /products/{slug}) }",
    "  adCreatives: array of EXACTLY 3 objects { headline (<= 30 chars), description (<= 90 chars),",
    "    imagePrompt (single sentence visual brief) }",
    "",
    "Tone is consistent with the brand voice. No medical claims. No emoji in ad copy.",
  ].filter(Boolean).join("\n");

  try {
    const out = await chatCompletionJSON<Partial<CampaignBundle>>({
      systemPrompt: BRAND_VOICE,
      userPrompt,
      maxTokens: 4500,
      timeoutMs: 90_000,
    });
    if (!out) return null;
    return normalizeBundle(out);
  } catch (err) {
    logger.error({ err }, "Campaign orchestrator failed");
    return null;
  }
}

function normalizeBundle(o: Partial<CampaignBundle>): CampaignBundle {
  const exp = (o.experience ?? {}) as CampaignBundle["experience"];
  const particle = (exp.particleEffect && PARTICLE_VALUES.includes(exp.particleEffect))
    ? exp.particleEffect : "none";
  const themeTokens: Record<string, string> = {};
  if (exp.themeTokens && typeof exp.themeTokens === "object") {
    for (const [k, v] of Object.entries(exp.themeTokens)) {
      if (typeof v === "string") themeTokens[k] = v;
    }
  }
  const blog = (o.blog ?? { title: "", body: "", imagePrompt: "", cta: "", hashtags: [] }) as CampaignBundle["blog"];
  const socialsRaw = Array.isArray(o.socials) ? o.socials : [];
  const socialsMap = new Map<ContentChannel, CampaignBundle["socials"][number]>();
  for (const s of socialsRaw) {
    if (!s || typeof s !== "object") continue;
    const ch = (s.channel ?? "") as ContentChannel;
    if (!SOCIAL_CHANNELS.includes(ch)) continue;
    socialsMap.set(ch, {
      channel: ch,
      body: String(s.body ?? "").trim(),
      hashtags: Array.isArray(s.hashtags) ? s.hashtags.map((h) => String(h).replace(/^#/, "").trim()).filter(Boolean) : [],
      cta: String(s.cta ?? "").trim(),
      imagePrompt: String(s.imagePrompt ?? "").trim(),
    });
  }
  // Backfill any missing channels with empty stubs so the UI always shows 5 cards.
  const socials = SOCIAL_CHANNELS.map((ch) => socialsMap.get(ch) ?? {
    channel: ch, body: "", hashtags: [], cta: "", imagePrompt: "",
  });
  const email = (o.email ?? { subject: "", preheader: "", body: "", ctaLabel: "", ctaUrl: "" }) as CampaignBundle["email"];
  const adCreatives = (Array.isArray(o.adCreatives) ? o.adCreatives : [])
    .slice(0, 3)
    .map((a) => ({
      headline: String(a?.headline ?? "").slice(0, 60).trim(),
      description: String(a?.description ?? "").slice(0, 180).trim(),
      imagePrompt: String(a?.imagePrompt ?? "").trim(),
    }))
    .filter((a) => a.headline);

  return {
    experience: {
      name: String(exp.name ?? "Untitled experience").slice(0, 80),
      themeTokens,
      banner: exp.banner ?? null,
      heroTakeover: exp.heroTakeover ?? null,
      particleEffect: particle,
    },
    blog: {
      title: String(blog.title ?? "").trim(),
      body: String(blog.body ?? "").trim(),
      imagePrompt: String(blog.imagePrompt ?? "").trim(),
      cta: String(blog.cta ?? "").trim(),
      hashtags: Array.isArray(blog.hashtags)
        ? blog.hashtags.map((h) => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 8)
        : [],
    },
    socials,
    email: {
      subject: String(email.subject ?? "").trim(),
      preheader: String(email.preheader ?? "").trim(),
      body: String(email.body ?? "").trim(),
      ctaLabel: String(email.ctaLabel ?? "Shop now").trim(),
      ctaUrl: String(email.ctaUrl ?? "/shop").trim(),
    },
    adCreatives,
  };
}
