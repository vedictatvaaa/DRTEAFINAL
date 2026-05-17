import { and, eq, gte, sql } from "drizzle-orm";
import { db, recipesTable, productsTable } from "./db";
import { chatCompletionJSON } from "./openaiText";
import { generateAndStoreImage } from "./campaign-image-gen";
import { logger } from "./logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TARGET_PER_DAY = 5;

let cronTimer: NodeJS.Timeout | null = null;
let inflight = false;

interface AiIngredient {
  name: string;
  amount: string;
  note?: string;
}
interface AiStep {
  title?: string;
  body: string;
}
interface AiStorySlide {
  title?: string;
  caption: string;
  imagePrompt: string;
}
interface AiAuthor {
  name: string;
  location: string;
  avatarPrompt: string;
  quote: string;
}
interface AiRecipe {
  title: string;
  summary: string;
  origin: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  ingredients: AiIngredient[];
  steps: AiStep[];
  tips: string[];
  tags: string[];
  hashtags: string[];
  seoKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  author: AiAuthor;
  storySlides: AiStorySlide[];
  heroImagePrompt: string;
}
interface AiBatch {
  recipes: AiRecipe[];
}

const SYSTEM_PROMPT = `You are a senior food editor curating the Dr Tea Recipes — a world-class library of TEA recipes from EVERY corner of the planet (India, Morocco, Japan, China, UK, Tibet, Russia, Turkey, Thailand, Argentina, Korea, Vietnam, Kenya, Iran, Hong Kong, Taiwan, Pakistan, Sri Lanka, USA, Mexico, etc.).
You write in the warm, sensory voice of a real customer who lovingly submitted their family/regional recipe to Dr Tea — not a corporate copywriter.
You ALWAYS pick recipe titles that match high-intent search queries real shoppers Google ("how to make moroccan mint tea", "authentic masala chai recipe", "best matcha latte at home").
You weave high-ranking SEO keywords through the title, summary, and steps naturally; you also produce viral, on-trend Instagram/TikTok hashtags (lowercase, with the # prefix, e.g. "#chailover", "#teatok", "#matchamoment").
Each recipe MUST be authentic to its origin country, give exact measurements (metric + cups), and tell a small human story.`;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || `recipe-${Date.now()}`;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [existing] = await db
      .select({ id: recipesTable.id })
      .from(recipesTable)
      .where(eq(recipesTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
    if (n > 50) return `${base}-${Date.now()}`;
  }
}

function normalizeHashtag(s: string): string {
  const cleaned = s.trim().replace(/^#+/, "").replace(/[^a-zA-Z0-9]+/g, "");
  return cleaned ? `#${cleaned.toLowerCase()}` : "";
}

type ProductForLinking = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  tastingNotes: string[] | null;
  origin: string | null;
};

async function loadProductsForLinking(): Promise<ProductForLinking[]> {
  return db
    .select({
      id: productsTable.id,
      slug: productsTable.slug,
      name: productsTable.name,
      category: productsTable.category,
      tastingNotes: productsTable.tastingNotes,
      origin: productsTable.origin,
    })
    .from(productsTable);
}

async function autoLinkProducts(text: string): Promise<string[]> {
  const products = await loadProductsForLinking();
  const lower = text.toLowerCase();
  const ids: string[] = [];
  for (const p of products) {
    const tokens = [p.name, p.category, p.origin, ...(p.tastingNotes ?? [])]
      .filter((s): s is string => Boolean(s))
      .map((s) => s.toLowerCase());
    let hits = 0;
    for (const t of tokens) {
      if (t.length < 4) continue;
      if (lower.includes(t)) hits += 1;
    }
    if (hits >= 1) ids.push(p.id);
    if (ids.length >= 6) break;
  }
  return ids;
}

function buildHeroPrompt(recipe: {
  title: string;
  summary: string;
  origin: string;
  heroImagePrompt?: string;
}): string {
  // Subject-only — global rules + per-item scene (lighting, lens, palette,
  // composition) come from sceneVariation in geminiImage.ts.
  return [
    `Subject: a finished cup of "${recipe.title}", a tea recipe from ${recipe.origin || "the recipe's origin"}.`,
    recipe.heroImagePrompt
      ? `Scene detail: ${recipe.heroImagePrompt}.`
      : `Scene detail: ${recipe.summary}.`,
    `Cultural authenticity — correct vessels, garnish, ingredients, and table setting for the origin. No people's faces.`,
  ].join(" ");
}

async function generateHeroForRecipe(
  recipeId: number,
  prompt: { title: string; summary: string; origin: string; heroImagePrompt?: string },
): Promise<string | null> {
  try {
    const url = await generateAndStoreImage(buildHeroPrompt(prompt), "1536x1024", {
      seed: `recipe-${recipeId}-${prompt.title}`,
      sceneKind: "recipe",
    });
    await db
      .update(recipesTable)
      .set({ hero: url, updatedAt: new Date() })
      .where(eq(recipesTable.id, recipeId));
    return url;
  } catch (err) {
    logger.warn(
      { err, recipeId, title: prompt.title },
      "Recipes hero image generation failed",
    );
    return null;
  }
}

async function generateAvatarForRecipe(
  recipeId: number,
  author: { name: string; location: string; avatarPrompt?: string },
): Promise<string | null> {
  try {
    const prompt = [
      `Soft, warm portrait illustration in a flat editorial illustration style (NOT a photograph) of a friendly home cook from ${author.location || "South Asia"} named ${author.name}.`,
      author.avatarPrompt ? `Detail: ${author.avatarPrompt}.` : ``,
      `Tight head-and-shoulders crop, looking slightly to camera with a small smile, holding or beside a cup of tea.`,
      `Muted earthy palette: amber, cream, sage. Warm soft lighting. No text, no logos, no watermark.`,
      `Aspect 1:1.`,
    ].filter(Boolean).join(" ");
    const url = await generateAndStoreImage(prompt, "1024x1024", {
      seed: `avatar-${recipeId}-${author.name}`,
    });
    await db
      .update(recipesTable)
      .set({ authorAvatar: url, updatedAt: new Date() })
      .where(eq(recipesTable.id, recipeId));
    return url;
  } catch (err) {
    logger.warn({ err, recipeId }, "Recipes author-avatar generation failed");
    return null;
  }
}

async function generateStorySlideImages(
  recipeId: number,
  recipe: { title: string; origin: string },
  slides: AiStorySlide[],
): Promise<void> {
  if (!slides.length) return;
  // Cap at 5 slides to keep generation cost / time reasonable.
  const capped = slides.slice(0, 5);
  const finalSlides: Array<{ image: string; title?: string; caption: string }> = [];
  for (const s of capped) {
    try {
      const prompt = [
        `Photorealistic editorial food photograph for the recipe "${recipe.title}" from ${recipe.origin}.`,
        `Scene: ${s.imagePrompt}.`,
        `Vertical 9:16 phone aspect, natural daylight, magazine quality, no text, no logos, no watermark, no people's faces.`,
      ].join(" ");
      const url = await generateAndStoreImage(prompt, "1024x1536", {
        seed: `slide-${recipeId}-${s.title ?? s.caption.slice(0, 32)}`,
        sceneKind: "recipe",
      });
      const slide: { image: string; title?: string; caption: string } = {
        image: url,
        caption: s.caption,
      };
      if (s.title) slide.title = s.title;
      finalSlides.push(slide);
    } catch (err) {
      logger.warn(
        { err, recipeId, slideTitle: s.title },
        "Recipes story-slide image generation failed",
      );
    }
  }
  if (finalSlides.length) {
    await db
      .update(recipesTable)
      .set({ storyMode: finalSlides, updatedAt: new Date() })
      .where(eq(recipesTable.id, recipeId));
  }
}

export async function regenerateHeroForRecipe(
  id: number,
): Promise<{ url: string | null }> {
  const [row] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, id))
    .limit(1);
  if (!row) return { url: null };
  const url = await generateHeroForRecipe(row.id, {
    title: row.title,
    summary: row.summary,
    origin: row.origin,
  });
  return { url };
}

export async function generateRecipeDrafts(): Promise<{
  created: number;
  skipped: boolean;
}> {
  if (inflight) return { created: 0, skipped: true };
  inflight = true;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recipesTable)
      .where(
        and(
          eq(recipesTable.authorType, "ai"),
          gte(recipesTable.createdAt, startOfDay),
        ),
      );
    if ((count ?? 0) >= TARGET_PER_DAY) {
      logger.info({ count }, "Recipes cron: today already at quota");
      return { created: 0, skipped: true };
    }
    const need = TARGET_PER_DAY - (count ?? 0);

    const existing = await db
      .select({ title: recipesTable.title, origin: recipesTable.origin })
      .from(recipesTable)
      .limit(500);
    const seenTitles = existing.map((r) => r.title).slice(-80).join(" | ");
    const seenOrigins = Array.from(
      new Set(existing.map((r) => r.origin).filter(Boolean)),
    ).slice(-30).join(", ");

    const out = await chatCompletionJSON<AiBatch>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: [
        `Generate exactly ${need} fresh, distinct, NEW Dr Tea TEA recipes from around the world.`,
        `Rotate origin countries — DO NOT repeat any origin already in: ${seenOrigins || "(none)"} unless absolutely needed for variety.`,
        `Avoid duplicates of these existing titles: ${seenTitles || "(none)"}.`,
        `For EACH recipe produce:`,
        `  - title (search-optimised, 4-8 words)`,
        `  - summary (<= 240 chars, sensory + benefit-led)`,
        `  - origin (country or region — "Morocco", "Japan", "Kashmir, India", "Hong Kong", etc.)`,
        `  - category (one of: Chai, Iced Tea, Latte, Wellness, Dessert, Cocktail, Traditional)`,
        `  - difficulty: "easy" | "medium" | "hard"`,
        `  - prepMinutes, cookMinutes, servings (integers)`,
        `  - ingredients: 4-12 items, each { name, amount (metric + cups in parens), note? }`,
        `  - steps: 4-9 items, each { title, body (40-120 words, conversational, second-person) }`,
        `  - tips: 2-4 short pro tips`,
        `  - tags: 4-8 short topical lowercase tags (no #)`,
        `  - hashtags: 6-10 viral on-trend Instagram/TikTok hashtags (lowercase, with #)`,
        `  - seoKeywords: 4-8 high-intent SEO keyword phrases real shoppers Google`,
        `  - metaTitle (<= 60 chars) and metaDescription (140-160 chars)`,
        `  - author: { name (real-sounding first + last name from the recipe's region), location ("Mumbai, India", "Marrakech, Morocco"), avatarPrompt (1 sentence describing the person), quote (1-2 warm sentences from the customer about why this recipe matters to them) }`,
        `  - storySlides: 4-5 vertical-story slides telling the recipe as a narrative — each { title?, caption (15-30 words, like an Instagram story caption), imagePrompt (1 sentence describing the photograph) }`,
        `  - heroImagePrompt (1 sentence describing the hero food photograph)`,
        `Return strict JSON: { "recipes": [ <recipe>, ... ] }`,
      ].join("\n"),
      maxTokens: 12000,
      timeoutMs: 150_000,
    });
    if (!out?.recipes?.length) {
      logger.warn("Recipes cron: AI returned no recipes");
      return { created: 0, skipped: false };
    }

    let created = 0;
    for (const r of out.recipes.slice(0, need)) {
      try {
        const baseSlug = slugify(r.title ?? "");
        const slug = await uniqueSlug(baseSlug);
        const fullText = [
          r.title,
          r.summary,
          r.origin,
          ...(r.ingredients ?? []).map((i) => `${i.amount} ${i.name}`),
          ...(r.steps ?? []).flatMap((s) => [s.title ?? "", s.body]),
        ].join("\n");
        const productIds = await autoLinkProducts(fullText);

        const title = (r.title ?? "Untitled").slice(0, 160);
        const summary = (r.summary ?? "").slice(0, 400);
        const origin = (r.origin ?? "").slice(0, 80);
        const category = (r.category ?? "Chai").slice(0, 60);
        const difficulty: "easy" | "medium" | "hard" =
          r.difficulty === "medium" || r.difficulty === "hard"
            ? r.difficulty
            : "easy";
        const tags = Array.isArray(r.tags) ? r.tags.slice(0, 8) : [];
        const hashtags = Array.isArray(r.hashtags)
          ? r.hashtags.map(normalizeHashtag).filter(Boolean).slice(0, 12)
          : [];
        const seoKeywords = Array.isArray(r.seoKeywords)
          ? r.seoKeywords.map((s) => s.trim()).filter(Boolean).slice(0, 10)
          : [];
        const ingredients = Array.isArray(r.ingredients)
          ? r.ingredients
              .filter((i) => i && i.name)
              .slice(0, 30)
              .map((i) => ({
                name: String(i.name).slice(0, 120),
                amount: String(i.amount ?? "").slice(0, 60),
                ...(i.note ? { note: String(i.note).slice(0, 160) } : {}),
              }))
          : [];
        const steps = Array.isArray(r.steps)
          ? r.steps
              .filter((s) => s && s.body)
              .slice(0, 20)
              .map((s) => ({
                ...(s.title ? { title: String(s.title).slice(0, 120) } : {}),
                body: String(s.body).slice(0, 1000),
              }))
          : [];
        const tips = Array.isArray(r.tips)
          ? r.tips.map((t) => String(t).slice(0, 280)).slice(0, 8)
          : [];
        const author = r.author && typeof r.author === "object" ? r.author : null;
        const authorName = author?.name ? String(author.name).slice(0, 80) : "";
        const authorLocation = author?.location
          ? String(author.location).slice(0, 80)
          : "";
        const authorQuote = author?.quote ? String(author.quote).slice(0, 400) : "";
        const metaTitle = (r.metaTitle ?? title).slice(0, 80);
        const metaDescription = (r.metaDescription ?? summary).slice(0, 200);

        const [inserted] = await db
          .insert(recipesTable)
          .values({
            slug,
            title,
            summary,
            hero: "",
            category,
            tags,
            difficulty,
            prepMinutes: Math.max(0, Math.min(480, Number(r.prepMinutes) || 5)),
            cookMinutes: Math.max(0, Math.min(480, Number(r.cookMinutes) || 10)),
            servings: Math.max(1, Math.min(40, Number(r.servings) || 2)),
            ingredients,
            steps,
            tips,
            relatedProductIds: productIds,
            authorName,
            authorAvatar: "",
            authorLocation,
            authorQuote,
            origin,
            storyMode: [],
            hashtags,
            seoKeywords,
            authorType: "ai",
            status: "pending",
            metaTitle,
            metaDescription,
            published: false,
          })
          .returning({ id: recipesTable.id });

        if (inserted?.id) {
          // Fire-and-forget media generation so insertion isn't blocked.
          void generateHeroForRecipe(inserted.id, {
            title,
            summary,
            origin,
            ...(r.heroImagePrompt ? { heroImagePrompt: r.heroImagePrompt } : {}),
          });
          if (authorName) {
            void generateAvatarForRecipe(inserted.id, {
              name: authorName,
              location: authorLocation,
              ...(author?.avatarPrompt ? { avatarPrompt: author.avatarPrompt } : {}),
            });
          }
          if (Array.isArray(r.storySlides) && r.storySlides.length) {
            void generateStorySlideImages(
              inserted.id,
              { title, origin },
              r.storySlides,
            );
          }
        }
        created += 1;
      } catch (err) {
        logger.warn({ err }, "Recipes cron: failed to insert one recipe");
      }
    }
    logger.info({ created }, "Recipes cron: drafts generated");
    return { created, skipped: false };
  } finally {
    inflight = false;
  }
}

export function startRecipesCron(): void {
  if (cronTimer) return;
  setTimeout(() => {
    void generateRecipeDrafts().catch((err) =>
      logger.error({ err }, "Initial recipe draft generation failed"),
    );
  }, 180_000).unref?.();
  cronTimer = setInterval(() => {
    void generateRecipeDrafts().catch((err) =>
      logger.error({ err }, "Daily recipe draft generation failed"),
    );
  }, ONE_DAY_MS);
  cronTimer.unref?.();
  logger.info("Recipes drafts cron started (24h interval, 5 recipes/day worldwide)");
}
