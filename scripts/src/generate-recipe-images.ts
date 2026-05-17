import { GoogleGenAI, Modality } from "@google/genai";
import { writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

// Unique photorealistic prompt for every recipe slug
const PROMPTS: Record<string, string> = {
  "classic-masala-chai":
    "Professional food photography of a traditional Indian masala chai in a brass kulhad cup, rich dark orange chai with cream froth on top, cardamom pods and cinnamon sticks scattered on a wooden surface, steam rising, warm morning kitchen light, 16:9",
  "darjeeling-cold-brew":
    "Professional photography of Darjeeling cold brew tea in a clear tall glass jar with a wooden lid, pale amber liquid, loose Darjeeling first flush leaves visible inside, condensation on glass, misty Himalayan plantation background, 16:9",
  "kashmiri-kahwa":
    "Professional food photography of Kashmiri kahwa in an ornate silver cup with saffron strands floating on the surface, crushed pistachios and almonds scattered on top, traditional Kashmiri copper samovar in the background, rich amber colour, 16:9",
  "tulsi-ginger-immunity-kadha":
    "Professional photography of tulsi ginger kadha in a clay pot being poured, deep golden-brown liquid, fresh tulsi holy basil leaves and raw ginger root beside the pot, Ayurvedic herbs scattered on jute cloth, warm light, 16:9",
  "rose-hibiscus-iced-tea":
    "Professional food photography of rose hibiscus iced tea in a tall clear glass, jewel-toned deep ruby red colour, dried rose petals floating on top, slices of lime, ice cubes, condensation dripping down the glass, white marble surface, 16:9",
  "mint-green-tea-lemonade":
    "Professional food photography of mint green tea lemonade in a mason jar with a paper straw, pale lime-green colour, fresh mint sprigs and lemon slices inside, ice cubes, bright summery outdoor table setting, sunlight filtering through, 16:9",
  "ginger-masala-chai":
    "Professional food photography closeup of freshly poured adrak masala chai, steam rising from a small clay kulhad, large grated ginger root beside the cup, visible orange-brown colour, dark rustic wooden table, 16:9",
  "cardamom-chai":
    "Professional food photography of elaichi chai poured into a small steel tumbler, six cracked green cardamom pods arranged beside it, rich warm brown chai with milk, steam rising, blurred Indian kitchen background, 16:9",
  "saffron-chai":
    "Professional food photography of kesar chai, golden yellow saffron milk tea in a white porcelain cup, real saffron strands floating on the surface, warm luxurious lighting on marble surface, 16:9",
  "tandoori-chai":
    "Professional photography of tandoori chai being poured from a red-hot glowing clay kulhad, dramatic smoke and steam billowing out, fiery orange glow of the hot clay, dark kitchen background, dramatic action shot, 16:9",
  "irani-chai":
    "Professional food photography of Hyderabadi Irani chai served in a glass with a handle, distinct two-layer effect of dark tea and creamy condensed milk cloud, old Irani café setting with checkered tiles and marble tables, 16:9",
  "sulaimani-tea":
    "Professional photography of Sulaimani tea in a clear glass, black tea with fresh lemon juice creating a beautiful amber colour, whole spices visible, traditional Kerala Malabar setting with green leaves in background, 16:9",
  "tulsi-chai":
    "Professional food photography of tulsi chai in a steel cup, fresh holy basil leaves floating on top of orange-brown chai, sunlit Indian courtyard setting with a terracotta pot of tulsi plant, 16:9",
  "jaggery-chai":
    "Professional food photography of jaggery chai being stirred in a brass vessel, golden-brown gur jaggery piece beside the cup melting into the chai, dark Punjabi winter kitchen atmosphere, 16:9",
  "adrak-chai":
    "Professional photography of extremely strong kadak adrak chai in a small kulhad, deep mahogany colour, visible steam, large fresh ginger root and a grater beside it, bold dramatic lighting, 16:9",
  "bengal-mishti-chai":
    "Professional food photography of Bengali mishti chai in a terracotta bhar clay cup, delicate Darjeeling brew colour, sandesh mishti on a leaf beside it, Kolkata morning light, artistic composition, 16:9",
  "punjab-doodh-patti":
    "Professional food photography of Punjabi doodh patti, pure all-milk chai being poured from a steel pan showing thick creamy consistency, rich dark cream colour, farmhouse kitchen setting in Punjab, 16:9",
  "mumbai-tapri-chai":
    "Professional street photography of Mumbai tapri cutting chai in two small glass tumblers, deep brown chai, condensation on glasses, old battered steel pan and chai tapri stall in background, street bokeh, 16:9",
  "kashmiri-noon-chai-recipe":
    "Professional food photography of Kashmiri noon chai, stunning pastel pink salted tea in a traditional white cup with floral patterns, crushed pistachios on top, saffron strands, traditional Kashmiri wooden table, 16:9",
  "chocolate-chai":
    "Professional food photography of chocolate masala chai in a dark ceramic mug, rich cocoa-brown colour, cocoa powder dusted on top, dark chocolate bar and cinnamon stick beside it, moody winter café lighting, 16:9",
  "saffron-rose-chai":
    "Professional food photography of saffron rose chai in a gold-rimmed white porcelain cup, pink-gold colour with dried rose petals floating, saffron strands visible, Mughal-inspired setting with marble inlay, 16:9",
  "kolkata-cutting-chai-recipe":
    "Professional photography of Kolkata cutting chai in three small glass tumblers on a round tray, deep gingery chai, College Street pavement setting with books and newspapers in background, 16:9",
  "rajasthani-masala-chai":
    "Professional food photography of Rajasthani masala chai in a clay cup, whole fennel seeds and spices visible, served on a painted Rajasthani tray with desert colour palette, warm afternoon light, 16:9",
  "mango-iced-tea":
    "Professional food photography of Alphonso mango iced tea in a tall glass, vibrant golden-orange colour, fresh Alphonso mango slices on the rim, ice cubes, green mint, summer tropical table setting, 16:9",
  "peach-green-iced-tea":
    "Professional food photography of peach green iced tea in a mason jar glass, pale peach-gold colour, fresh ripe peach slices and mint sprigs inside, rustic wooden picnic table, golden afternoon light, 16:9",
  "lychee-iced-tea":
    "Professional food photography of lychee iced green tea in a tall elegant glass, almost clear liquid with a faint jade tinge, whole peeled lychees in the glass, minimalist white marble café table, 16:9",
  "watermelon-mint-iced-tea":
    "Professional food photography of watermelon mint iced tea in a large clear glass, vibrant deep pink colour, fresh watermelon wedge on the rim, mint sprigs, ice, summery outdoor setting, 16:9",
  "coconut-iced-tea":
    "Professional food photography of coconut iced black tea in a tall glass, pale brown colour, coconut strip garnish, fresh green coconut halved beside the glass, Kerala backwater setting background, 16:9",
  "pomegranate-iced-tea":
    "Professional food photography of pomegranate hibiscus iced tea, deep jewel ruby red colour in a crystal glass, fresh pomegranate arils scattered in and around, lime wedge, elegant dinner party setting, 16:9",
  "thai-iced-tea":
    "Professional street food photography of Thai iced tea in a plastic bag with a straw as sold on Bangkok streets, vibrant orange colour with white cream swirling into it, busy colourful Thai market background, 16:9",
  "tamarind-iced-tea":
    "Professional food photography of tamarind spiced iced tea in a copper cup, dark brown tangy drink, raw tamarind pods beside the cup, kala namak black salt in a small bowl, rustic Indian summer setting, 16:9",
  "passion-fruit-iced-tea":
    "Professional food photography of passion fruit iced green tea in a tall glass, golden-green colour, halved passion fruit with seeds on the rim, mint, Goa beach café setting with warm light, 16:9",
  "jasmine-cold-brew":
    "Professional photography of jasmine green tea cold brew in a large clear glass jar, almost crystal clear liquid with a faint green tinge, jasmine flowers floating inside, clean white marble kitchen surface, 16:9",
  "oolong-cold-brew":
    "Professional photography of high mountain oolong cold brew in a clear glass carafe, silky pale amber liquid, rolled oolong leaves visible inside, Taiwan mountain scenery backdrop, morning light, 16:9",
  "hibiscus-cold-brew":
    "Professional photography of hibiscus cold brew in a tall glass, extraordinary deep crimson-magenta colour, no ice, just the pure jewel-toned liquid, dramatic dark background making the colour pop, 16:9",
  "black-tea-cold-brew-cardamom":
    "Professional food photography of cardamom black tea cold brew in a tall glass, rich amber-brown, whole cracked cardamom pods submerged in the liquid, clean modern kitchen surface, 16:9",
  "ashwagandha-chai":
    "Professional food photography of ashwagandha chai latte in a ceramic mug, warm beige-brown colour, cardamom pod and cinnamon stick resting on top, ashwagandha root powder in a wooden spoon beside it, dark stone surface, 16:9",
  "golden-turmeric-tea":
    "Professional food photography of golden turmeric milk tea in a clear glass mug, brilliant golden-yellow colour, steam rising, fresh turmeric root and cinnamon stick beside the mug, warm morning light, 16:9",
  "moringa-green-tea":
    "Professional food photography of moringa green tea in a white cup, vivid bright green colour from the moringa powder, bamboo whisk beside it, fresh moringa leaves scattered, minimalist wellness photography, 16:9",
  "mulethi-tea":
    "Professional food photography of mulethi liquorice root tea being strained through a bamboo strainer, golden amber liquid falling into a clay cup, dried mulethi sticks and tulsi leaves, Ayurvedic apothecary aesthetic, 16:9",
  "giloy-kadha":
    "Professional photography of giloy kadha decoction in a small clay cup, dark golden-brown intensely medicinal looking liquid, fresh giloy stem and tulsi leaves beside it, Ayurvedic wellness setting, 16:9",
  "brahmi-tea":
    "Professional food photography of brahmi tea in a clear glass, pale golden liquid, fresh brahmi water hyssop leaves floating inside, cardamom pods, serene yoga retreat setting with natural light, 16:9",
  "cinnamon-honey-tea":
    "Professional food photography of cinnamon honey tea in a glass mug, amber tea with a cinnamon stick resting in it, a jar of raw honey with a dipper beside it, warm cosy kitchen, 16:9",
  "fennel-seed-tea":
    "Professional food photography of fennel seed saunf tea in a clear glass cup, pale straw-golden liquid, fennel seeds scattered artfully on the wooden surface around the cup, steam rising, 16:9",
  "ajwain-tea":
    "Professional food photography of ajwain carom seed tea in a small clay cup, golden liquid, ajwain seeds visible at the bottom, fresh ginger slice beside it, Indian kitchen setting with terracotta elements, 16:9",
  "peppercorn-detox-tea":
    "Professional food photography of black pepper detox tea in a white cup, dark amber liquid, freshly crushed black peppercorns and lemon slices beside it, morning wellness photography, clean white surface, 16:9",
  "amla-tea":
    "Professional photography of amla Indian gooseberry tea in a clay cup, pale gold-green colour, fresh green amla gooseberries beside the cup, natural organic wellness setting with jute and leaves, 16:9",
  "neem-honey-tea":
    "Professional food photography of neem honey tea in a small white cup, pale yellowish-green colour, fresh neem leaves arranged decoratively beside it, raw honey dipper, Ayurvedic wellness setting, 16:9",
  "shatavari-chai":
    "Professional food photography of shatavari women's wellness chai in a delicate white ceramic mug, creamy golden colour with saffron strands floating, rose petals scattered, feminine wellness photography, 16:9",
  "triphala-herbal-tea":
    "Professional photography of triphala herbal tea in a clay cup, dark tannin-rich brown colour, three dried fruits (amla, haritaki, bibhitaki) arranged beside the cup, Ayurvedic text scroll in background, 16:9",
  "kerala-sulaimani-spiced":
    "Professional food photography of Kerala Sulaimani tea with star anise in a glass cup, dark black tea with amber tones, whole star anise floating on surface, fresh lemon half beside it, Kerala coconut palm background, 16:9",
  "assam-tea-garden-brew":
    "Professional photography of Assam estate tea in a white porcelain cup, deep malty copper colour, Assam tea garden plantation visible through the window in background, morning golden light, 16:9",
  "hyderabadi-dum-chai":
    "Professional food photography of Hyderabadi dum chai being poured from a clay pot with dum seal being broken, steam dramatically escaping from the sealed vessel, rich creamy brown chai, old city Hyderabad kitchen, 16:9",
  "ladakhi-butter-tea":
    "Professional photography of Ladakhi butter tea po cha in a traditional wooden bowl with silver rim, frothy brownish-grey with butter oil visible on surface, Ladakh monastery stone wall and prayer flags behind, 16:9",
  "goa-spiced-chai":
    "Professional food photography of Goan coconut spiced chai in a small glass cup on a wooden veranda, creamy chai with coconut milk, fresh coconut halves and cloves beside it, tropical Goa garden setting, 16:9",
  "sikkim-cardamom-tea":
    "Professional photography of Sikkim black cardamom tea in a small ceramic cup, amber liquid, one whole black cardamom pod cracked open beside it, Himalayan Sikkim mountain landscape in misty background, 16:9",
  "manipur-black-tea":
    "Professional photography of Manipuri black tea yu in a simple white ceramic cup, gentle pale amber colour, loose full leaf tea beside it, Manipuri traditional weaving cloth underneath, northeast India setting, 16:9",
  "assam-milk-tea-garden":
    "Professional photography of garden-fresh Assam milk tea in a large enamel mug, rich deep copper brown colour, Assam tea garden worker in background picking leaves, misty plantation morning, 16:9",
  "darjeeling-himalayan-brew":
    "Professional tea photography of pure Darjeeling single estate brew in a white bone china cup, pale gold muscatel colour, teapot on the side, misty Himalayan mountains visible, Darjeeling tea estate setting, 16:9",
  "moroccan-mint-tea":
    "Professional photography of Moroccan mint tea being poured from a high height into a small ornate glass, frothy green stream catching warm light, silver Moroccan teapot, painted tiles and lanterns in background, Marrakech riad, 16:9",
  "turkish-cay":
    "Professional food photography of Turkish çay in two traditional tulip-shaped tea glasses on a brass tray with sugar cubes, dark amber tea, ornate silver handles, Bosphorus Istanbul view in background, 16:9",
  "earl-grey-bergamot":
    "Professional food photography of Earl Grey tea in a delicate bone china cup with saucer, pale amber with bergamot orange slice on the rim, white linen tablecloth, English silver teapot, afternoon light, 16:9",
  "japanese-matcha-latte":
    "Professional food photography of Japanese matcha latte in a handmade ceramic cup, vivid green colour with latte art leaf pattern in froth, bamboo chasen whisk and matcha powder in wooden measure beside it, Japanese minimalist setting, 16:9",
  "egyptian-karkadeh":
    "Professional photography of Egyptian karkadeh hibiscus tea in a tall glass, extraordinary deep ruby-crimson colour, hibiscus flowers floating, orange blossom petals, Cairo café warm lighting, 16:9",
  "malaysian-teh-tarik":
    "Professional action photography of Malaysian teh tarik being pulled dramatically between two metal jugs, frothy milk tea stream stretching 40cm, hawker stall steam and warm yellow light, 16:9",
  "hong-kong-milk-tea":
    "Professional food photography of Hong Kong milk tea in a glass cup, rich dark velvety brown colour with evaporated milk swirl, traditional cha chaan teng setting with tiled walls, 16:9",
  "sri-lankan-ceylon-tea":
    "Professional photography of Ceylon tea in a white cup, brisk copper-brown colour with clarity, Ceylon tea plantation visible through cafe window, Colombo cafe setting, 16:9",
  "kenyan-chai":
    "Professional food photography of Kenyan African chai, thick mahogany-coloured milk tea in a tin cup, Kenyan tea garden in background, rich bold colour showing the strength of Rift Valley tea, 16:9",
  "persian-chai":
    "Professional photography of Persian chai in a traditional clear glass estékan cup, pale amber tea with dried rose petals floating, nabat saffron rock sugar beside it, Persian carpet pattern underneath, 16:9",
  "taiwanese-bubble-tea-base":
    "Professional food photography of Taiwanese bubble tea in a clear cup with wide straw, dark tapioca pearls settling at the bottom with creamy brown milk tea above, brown sugar syrup drizzle on cup walls, 16:9",
  "south-korean-boricha":
    "Professional food photography of Korean boricha barley tea in a traditional Korean ceramic cup, warm golden-brown colour, roasted barley grains in a bowl beside it, Korean kitchen setting, 16:9",
  "russian-samovar-tea":
    "Professional photography of Russian samovar tea in a glass cup in a silver podstakannik holder, dark amber tea, brass samovar in background, traditional Russian varenye jam in a small crystal dish, 16:9",
  "rose-milk-tea":
    "Professional food photography of rose milk tea in a tall glass, soft blush pink colour, dried rose petals floating on top, fresh pink rose beside the glass, white marble surface, romantic lighting, 16:9",
  "kesar-pista-chai":
    "Professional food photography of kesar pista chai in a golden-rimmed white cup, saffron-tinted golden colour, crushed pistachios and almonds on top, small silver bowl of saffron strands beside it, Mughal aesthetic, 16:9",
  "lavender-earl-grey":
    "Professional food photography of lavender earl grey latte in a ceramic cup, creamy warm golden with slight purple hue from lavender, dried lavender sprig on foam, purple flowers blurred in background, 16:9",
  "apple-cinnamon-chai":
    "Professional food photography of apple cinnamon chai in a rustic mug, warm amber colour, cinnamon stick and fresh apple slices on the rim, Himachal Pradesh apple orchard visible through window, autumn colours, 16:9",
  "caramel-milk-tea":
    "Professional food photography of salted caramel milk tea in a glass mug, rich caramel brown colour, caramel sauce drizzle on top with sea salt crystals, whipped cream, indulgent café setting, 16:9",
  "vanilla-rooibos-tea":
    "Professional food photography of vanilla rooibos latte in a white ceramic mug, warm reddish-brown colour with vanilla pod resting on the rim, frothy milk on top, cosy evening setting with warm lamp light, 16:9",
  "cinnamon-orange-tea":
    "Professional food photography of cinnamon orange black tea in a clear glass teapot, amber tea with orange peel strips curled inside, cinnamon sticks, winter holiday table setting with pine cones, 16:9",
  "pumpkin-spice-chai":
    "Professional food photography of pumpkin spice chai in an orange ceramic mug, warm golden-orange colour, nutmeg dusted on top, small pumpkin and cinnamon sticks beside the mug, autumn harvest setting, 16:9",
  "mango-lassi-chai":
    "Professional food photography of mango lassi chai in a tall clay glass, creamy golden-orange colour, fresh Alphonso mango slices on rim, frothy top from the yoghurt blend, Indian summer terrace setting, 16:9",
  "classic-oolong-gongfu":
    "Professional tea photography of gongfu oolong ceremony, small purple Yixing clay teapot pouring a perfect amber stream into a tiny handleless cup, bamboo tea tray with tea drops, serene meditative setting, 16:9",
  "rose-oolong-tea":
    "Professional food photography of rose oolong tea in a small delicate porcelain cup, golden-amber colour, dried rose petals arranged beside the cup, Tie Guan Yin oolong leaves unfurling in a glass teapot, 16:9",
  "jasmine-pearl-tea":
    "Professional tea photography of jasmine pearl green tea in a glass teapot, hand-rolled pearls slowly unfurling in pale jade-green liquid, jasmine flowers floating, serene tea room setting, 16:9",
  "silver-needle-white-tea":
    "Professional tea photography of silver needle white tea bai hao yinzhen in a white gaiwan bowl, pale honey-gold liquid, silver-tipped buds visible at the bottom, minimalist Zen photography, 16:9",
  "puerh-aged-tea":
    "Professional tea photography of aged pu-erh tea, dark mahogany-brown liquid in a small clay cup, aged pu-erh cake broken open beside it, Yunnan cave ageing cellar in background, complex and deep, 16:9",
  "lychee-oolong-artisan":
    "Professional tea photography of lychee oolong artisan tea, golden amber oolong in a small cup, dried lychee pieces around the cup, Fujian tea plantation background, elegant artisan aesthetic, 16:9",
  "white-peony-tea":
    "Professional tea photography of white peony bai mu dan tea in a glass cup, pale golden liquid, whole bud and leaf unfurling at the bottom of the glass visible from outside, white peony flower beside the cup, 16:9",
  "jun-green-tea-kombucha":
    "Professional photography of jun tea fermenting in a large glass jar, pale golden kombucha-like liquid with a SCOBY visible at the top, air-lock lid, fermentation jars in background, artisan home fermentation aesthetic, 16:9",
  "ginger-beer-chai-ferment":
    "Professional photography of fermented ginger beer chai in a flip-top glass bottle with natural carbonation bubbles rising, dark gingery brown colour, fresh ginger and lime around the bottle, artisan ferment setting, 16:9",
  "kefir-chai":
    "Professional food photography of kefir chai smoothie in a tall glass, creamy beige-brown colour with a frothy top, fresh ginger slice on the rim, kefir grains in a small bowl beside it, wellness morning setting, 16:9",
  "tepache-pineapple-tea-brew":
    "Professional photography of tepache pineapple chai brew in a glass jar, golden-amber fermented liquid, pineapple rind visible inside the fermenting jar, cinnamon sticks and cardamom pods, Mexican-Indian fusion aesthetic, 16:9",
  "lacto-fermented-ginger-lemon-tea":
    "Professional photography of lacto-fermented ginger lemon tea in a clear flip-top bottle, pale amber tart liquid with tiny bubbles of natural carbonation, lemon slices and ginger floating, fermentation shelf background, 16:9",
};

async function generateGeminiImage(prompt: string): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Create a stunning, realistic food/drink photograph: ${prompt}. 
Style: Professional food photography, DSLR quality, shallow depth of field, natural light, no text overlays, no watermarks, no people's faces. Photorealistic, not illustrated.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) =>
      part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function processRecipe(
  slug: string,
  title: string,
  attempt = 1
): Promise<string> {
  const prompt = PROMPTS[slug];
  if (!prompt) {
    console.log(`  ⚠️  No prompt for ${slug}, skipping`);
    return "";
  }

  const outputPath = resolve(REPO_ROOT, `artifacts/dr-tea/public/images/recipe-gemini-${slug}.png`);
  const heroUrl = `/images/recipe-gemini-${slug}.png`;

  // Skip if already generated
  if (existsSync(outputPath)) {
    console.log(`  ⏭️  Already exists: ${title}`);
    await pool.query(
      `UPDATE recipes SET hero = $1, updated_at = NOW() WHERE slug = $2`,
      [heroUrl, slug]
    );
    return heroUrl;
  }

  try {
    console.log(`  📸 Generating: ${title}`);
    const imageBuffer = await generateGeminiImage(prompt);
    writeFileSync(outputPath, imageBuffer);

    // Update DB using pg directly
    await pool.query(
      `UPDATE recipes SET hero = $1, updated_at = NOW() WHERE slug = $2`,
      [heroUrl, slug]
    );

    console.log(`  ✅ Done: ${title}`);
    return heroUrl;
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    const msg = error?.message || String(err);
    if (
      (msg.includes("429") || msg.includes("rate") || msg.includes("quota")) &&
      attempt < 4
    ) {
      const wait = attempt * 15000;
      console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s...`);
      await sleep(wait);
      return processRecipe(slug, title, attempt + 1);
    }
    console.error(`  ❌ Failed: ${title} — ${msg}`);
    return "";
  }
}

async function main() {
  const fromIdx = parseInt(process.env.FROM_IDX || "0", 10);
  const toIdx = parseInt(process.env.TO_IDX || "9999", 10);

  console.log(`🍵 Generating Gemini images (recipes ${fromIdx}–${toIdx})...\n`);

  const result = await pool.query(
    `SELECT slug, title FROM recipes WHERE published = true ORDER BY sort_order ASC`
  );
  const allRecipes: { slug: string; title: string }[] = result.rows;
  const recipes = allRecipes.slice(fromIdx, toIdx + 1);

  console.log(`Processing ${recipes.length} recipes (${fromIdx}–${Math.min(toIdx, allRecipes.length - 1)} of ${allRecipes.length} total)\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    process.stdout.write(`[${fromIdx + i + 1}/${allRecipes.length}] `);
    const result = await processRecipe(r.slug, r.title);
    if (result) success++;
    else failed++;
    // Small delay between requests
    if (i < recipes.length - 1) await sleep(2000);
  }

  await pool.end();
  console.log(`\n🏁 Done! ✅ ${success} generated/skipped, ❌ ${failed} failed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
