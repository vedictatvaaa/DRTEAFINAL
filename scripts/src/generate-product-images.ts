import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs";
import path from "path";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const OUT_DIR = path.resolve("artifacts/dr-tea/public/images/products");
fs.mkdirSync(OUT_DIR, { recursive: true });

const categoryAccent: Record<string, string> = {
  "Floral Tisane": "dusty rose and mauve, delicate floral botanical illustrations",
  "Chai":          "warm copper and terracotta, chai spice pattern of cardamom cloves cinnamon",
  "Kadha":         "deep forest green and earthy brown, ayurvedic herb motifs",
  "Green Tea":     "fresh sage green and white, minimal leaf illustration",
  "Black Tea":     "deep charcoal and ink black, elegant botanical line art",
  "Tea Reserve":   "rich gold and deep forest green, premium single-estate badge",
};

const products = [
  { slug: "hibiscus-tea",            name: "Ruby Hibiscus Tisane",            category: "Floral Tisane" },
  { slug: "blue-pea-flower",         name: "Blue Pea Flower Infusion",         category: "Floral Tisane" },
  { slug: "chamomile-tea",           name: "Golden Chamomile Dream",           category: "Floral Tisane" },
  { slug: "lavender-tea",            name: "Provençal Lavender Bloom",         category: "Floral Tisane" },
  { slug: "rose-tea",                name: "Damask Rose Petal Infusion",       category: "Floral Tisane" },
  { slug: "fennel-tea",              name: "Sweet Fennel Seed Brew",           category: "Floral Tisane" },
  { slug: "sea-buckthorn-tea",       name: "Himalayan Sea Buckthorn",          category: "Floral Tisane" },
  { slug: "peppermint-tea",          name: "Pure Peppermint Leaf",             category: "Floral Tisane" },
  { slug: "butterfly-pea-blue",      name: "Butterfly Pea Blue",              category: "Floral Tisane" },
  { slug: "royal-masala-chai",       name: "Royal Masala Chai",               category: "Chai" },
  { slug: "dr-tea-gold-ctc",         name: "Dr Tea Gold CTC",                 category: "Chai" },
  { slug: "dr-tea-premium-ctc",      name: "Dr Tea Premium CTC",              category: "Chai" },
  { slug: "dr-tea-kadak-chai",       name: "Dr Tea Kadak Chai",               category: "Chai" },
  { slug: "dr-tea-dum-chai",         name: "Dr Tea Dum Chai",                 category: "Chai" },
  { slug: "kashmiri-noon-chai",      name: "Kashmiri Noon Chai",              category: "Chai" },
  { slug: "tulsi-ginger-kadha",      name: "Tulsi Ginger Kadha",              category: "Kadha" },
  { slug: "haldi-mulethi-kadha",     name: "Haldi Mulethi Kadha",             category: "Kadha" },
  { slug: "ashwagandha-kadha",       name: "Ashwagandha Adaptogen Kadha",     category: "Kadha" },
  { slug: "giloy-tulsi-kadha",       name: "Giloy Tulsi Immunity Kadha",      category: "Kadha" },
  { slug: "brahmi-kadha",            name: "Brahmi Cognitive Kadha",          category: "Kadha" },
  { slug: "moringa-kadha",           name: "Moringa Miracle Kadha",           category: "Kadha" },
  { slug: "jeshtimadh-throat-kadha", name: "Jeshtimadh Throat Kadha",         category: "Kadha" },
  { slug: "himalayan-green-tea",     name: "Himalayan Spring Green Tea",      category: "Green Tea" },
  { slug: "lemon-green-tea",         name: "Lemon Verbena Green Tea",         category: "Green Tea" },
  { slug: "jasmine-green-tea",       name: "Jasmine Pearl Green Tea",         category: "Green Tea" },
  { slug: "mint-green-tea",          name: "Spearmint Green Fusion",          category: "Green Tea" },
  { slug: "tulsi-green-tea",         name: "Tulsi Green Rejuvenation",        category: "Green Tea" },
  { slug: "moroccan-mint-green-tea", name: "Moroccan Mint Ceremony",          category: "Green Tea" },
  { slug: "munnar-mountain-green",   name: "Munnar Mountain Green",           category: "Green Tea" },
  { slug: "assam-gold",              name: "Assam Gold Second Flush",         category: "Black Tea" },
  { slug: "darjeeling-black-tea",    name: "Darjeeling Muscatel Black",       category: "Black Tea" },
  { slug: "earl-grey",               name: "Earl Grey Bergamot Classic",      category: "Black Tea" },
  { slug: "english-breakfast",       name: "Indian Breakfast Blend",          category: "Black Tea" },
  { slug: "nilgiri-black-tea",       name: "Nilgiri Blue Mountain",           category: "Black Tea" },
  { slug: "darjeeling-first-flush",  name: "Darjeeling First Flush",          category: "Tea Reserve" },
  { slug: "darjeeling-second-flush", name: "Darjeeling Second Flush",         category: "Tea Reserve" },
  { slug: "darjeeling-autumn-flush", name: "Darjeeling Autumn Flush",         category: "Tea Reserve" },
  { slug: "silver-needle-white",     name: "Silver Needle Imperial White",    category: "Tea Reserve" },
  { slug: "moonlight-white-tea",     name: "Moonlight White Tea",             category: "Tea Reserve" },
  { slug: "white-peony-tea",         name: "White Peony Bai Mudan",           category: "Tea Reserve" },
  { slug: "himalayan-oolong",        name: "Himalayan Jade Oolong",           category: "Tea Reserve" },
  { slug: "muscatel-oolong",         name: "Muscatel Dark Oolong",            category: "Tea Reserve" },
  { slug: "single-estate-assam",     name: "Single Estate Assam Reserve",     category: "Tea Reserve" },
  { slug: "seasonal-reserve-tea",    name: "Seasonal Reserve Selection",      category: "Tea Reserve" },
  { slug: "kangra-silver-tips",      name: "Kangra Silver Tips Reserve",      category: "Tea Reserve" },
];

function buildPrompt(name: string, category: string): string {
  const accent = categoryAccent[category] ?? "neutral warm tones";
  return `Professional product photography of a standing 250g premium tea pouch on a pure white background. 
The pouch is matte kraft paper with a clean modern shape. 
On the front: at the top center, a small elegant logo badge reading "DR. TEA" in serif caps with a tiny leaf icon below it. 
Below the logo, a minimal rectangular sticker label with the product name "${name}" in clean serif typography.
Below the name, a small text line reads "${category}" in light uppercase tracking.
The pouch accent color and subtle pattern: ${accent}.
The bottom of the pouch has a thin accent stripe in the category color.
Style: clean studio product shot, soft diffused lighting, no harsh shadows, sharp focus on the label, slight perspective tilt at 5 degrees for dimension. 
No text other than what is specified. Pure white background. Photorealistic.`;
}

async function generateImage(prompt: string): Promise<{ b64_json: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData
  );

  if (!imagePart?.inlineData?.data) throw new Error("No image data in response");
  return { b64_json: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateWithRetry(
  prompt: string,
  retries = 4,
  delayMs = 8000
): Promise<{ b64_json: string; mimeType: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await generateImage(prompt);
    } catch (err: unknown) {
      const msg = String(err);
      const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate");
      if (attempt < retries) {
        const wait = isRateLimit ? delayMs * (attempt + 2) : delayMs;
        console.log(`  Retry ${attempt + 1}/${retries} after ${wait}ms...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

const CONCURRENCY = 2;

async function main() {
  const toGenerate = products.filter((p) => {
    const outPath = path.join(OUT_DIR, `${p.slug}.png`);
    return !fs.existsSync(outPath);
  });

  console.log(`Generating ${toGenerate.length} images (${products.length - toGenerate.length} already done)...\n`);

  const results: { slug: string; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < toGenerate.length; i += CONCURRENCY) {
    const batch = toGenerate.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (p) => {
        const outPath = path.join(OUT_DIR, `${p.slug}.png`);
        console.log(`[${i + batch.indexOf(p) + 1}/${toGenerate.length}] Generating: ${p.name} (${p.category})`);
        try {
          const prompt = buildPrompt(p.name, p.category);
          const { b64_json } = await generateWithRetry(prompt);
          fs.writeFileSync(outPath, Buffer.from(b64_json, "base64"));
          console.log(`  ✓ Saved ${p.slug}.png`);
          results.push({ slug: p.slug, ok: true });
        } catch (err) {
          console.error(`  ✗ Failed ${p.slug}: ${err}`);
          results.push({ slug: p.slug, ok: false, error: String(err) });
        }
      })
    );
    if (i + CONCURRENCY < toGenerate.length) await sleep(3000);
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\nDone: ${ok}/${toGenerate.length} succeeded`);
  if (fail.length) console.log("Failed:", fail.map((f) => f.slug).join(", "));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
