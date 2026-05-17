import { logger } from "./logger";

const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

export type ImageAspect = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type SceneKind = "recipe" | "teapedia" | "hub" | "journal" | "generic";

/**
 * Hard rules that apply to every image: no graphics, no text, photoreal.
 * The actual *look* (setting, light, surface, props, angle, mood) is chosen
 * per-item by `sceneVariation` so different posts don't all share the same
 * 50mm-on-a-wooden-table aesthetic.
 */
const RULES_PREFIX = [
  "Photoreal real-life lifestyle photograph.",
  "No illustration, no 3D render, no flat vector, no cartoon, no text, no captions, no logos, no watermarks, no UI overlays.",
  "Authentic textures, real props, real fabrics, real food. Natural human moments when people are present.",
].join(" ");

// ---------------------------------------------------------------------------
// Per-item scene variation
// ---------------------------------------------------------------------------

const SETTINGS: Record<SceneKind, string[]> = {
  recipe: [
    "a sunlit home kitchen counter",
    "a rustic farmhouse table by an open window",
    "a marble café bar at golden hour",
    "an outdoor garden patio in dappled afternoon light",
    "a Japanese minimalist tea room with tatami flooring",
    "a cosy reading nook with linen cushions and a low coffee table",
    "a moody dark wood bistro table with a single candle",
    "a bright Mediterranean balcony with terracotta tiles",
  ],
  teapedia: [
    "a quiet tea master's workbench with antique brass scoops",
    "a misty mountain tea garden at sunrise",
    "a vintage apothecary shelf of glass jars and dried leaves",
    "a hand-thrown ceramic studio with raw clay tools",
    "an old colonial-era tea warehouse with hessian sacks",
    "a botanical illustration desk with pressed leaves and a magnifying glass",
    "a modern tasting flight on a slate board, lit from above",
    "a rural Asian farmhouse veranda with bamboo baskets",
  ],
  hub: [
    "two friends laughing over tea on a sunlit rooftop",
    "a solo traveller journaling at a quiet teahouse window",
    "a multigenerational family gathered around a low table",
    "a wellness studio with cushions, candles and a steaming pot",
    "a bustling regional street tea stall at dusk",
    "a bookshop café corner with stacked novels and a steaming mug",
    "a cosy winter living room with a wool throw and snow outside the window",
    "an elegant high-tea spread on a hotel terrace",
  ],
  journal: [
    "a flat-lay editorial composition on linen with seasonal florals",
    "a candid kitchen scene with hands mid-pour",
    "a moody chiaroscuro still life on dark stone",
    "a bright airy Scandinavian breakfast nook",
    "a bohemian outdoor picnic on a woven blanket",
    "a writer's desk with notebooks, fountain pen and a cooling cup",
    "a vintage film-style snapshot in a 1970s sunroom",
    "a clean modern minimalist studio backdrop in soft sand tones",
  ],
  generic: [
    "a softly lit interior with natural textures",
    "an outdoor setting with diffuse daylight",
    "a warm domestic scene with everyday objects",
  ],
};

const LIGHTING = [
  "soft morning window light, long shadows",
  "golden-hour backlight, gentle lens flare",
  "overcast diffused daylight, even and creamy",
  "warm tungsten accent with cool blue ambient",
  "single candle and firelight, deep amber shadows",
  "bright midday sunlight filtered through linen curtains",
  "blue-hour twilight with warm interior lamps",
  "overhead skylight, soft top-down illumination",
];

const LENSES = [
  "shot on a 35mm prime at f/2.8, environmental context in frame",
  "shot on a 50mm prime at f/2.0, classic shallow depth of field",
  "shot on an 85mm portrait lens at f/1.8, creamy bokeh",
  "shot on a 24mm wide lens, immersive room context",
  "shot on a 100mm macro, intimate close-up of texture and steam",
  "shot from directly overhead in a flat-lay composition",
];

const PALETTES = [
  "warm earth tones — terracotta, ochre, faded olive",
  "cool muted palette — slate, sage, soft cream",
  "high-contrast moody palette — deep espresso, ember red, candle gold",
  "pastel airy palette — blush, pale mint, dove grey",
  "rich jewel tones — emerald, plum, brass",
  "monochrome neutrals — sand, bone, paper white",
];

const FILMS = [
  "Kodak Portra 400 colour science",
  "Fujifilm Pro 400H softness",
  "Cinestill 800T tungsten character",
  "neutral digital colour, no filter",
  "subtle Ektachrome cool blues",
];

const COMPOSITIONS = [
  "rule-of-thirds composition with breathable negative space on the right",
  "centred symmetrical composition",
  "diagonal leading lines from foreground props into the subject",
  "tight crop with generous out-of-focus foreground",
  "wide environmental composition with the subject anchored lower-left",
  "high-angle three-quarter view",
];

// Tiny stable hash → bucket index. Same seed always produces the same scene
// so re-runs and HMR don't reshuffle a post's look.
function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], h: number, salt: number): T {
  return arr[(h + salt * 2654435761) % arr.length]!;
}

export function sceneVariation(seed: string, kind: SceneKind = "generic"): string {
  const h = hashSeed(`${kind}:${seed}`);
  const setting = pick(SETTINGS[kind], h, 1);
  const lighting = pick(LIGHTING, h, 2);
  const lens = pick(LENSES, h, 3);
  const palette = pick(PALETTES, h, 4);
  const film = pick(FILMS, h, 5);
  const composition = pick(COMPOSITIONS, h, 6);
  return [
    `Setting: ${setting}.`,
    `Lighting: ${lighting}.`,
    `Camera: ${lens}, ${film}.`,
    `Palette: ${palette}.`,
    `Composition: ${composition}.`,
  ].join(" ");
}

// Back-compat: existing imports of LIFESTYLE_STYLE_PREFIX still work but no
// longer carry hard-coded camera/surface choices (those are now per-item).
export const LIFESTYLE_STYLE_PREFIX = RULES_PREFIX;

interface GeminiPart {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mimeType?: string };
}

interface GeminiResp {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  promptFeedback?: { blockReason?: string };
}

function pickModel(quality: "fast" | "pro"): string {
  return quality === "pro"
    ? "gemini-3-pro-image-preview"
    : "gemini-2.5-flash-image";
}

export async function generateGeminiImageBuffer(
  rawPrompt: string,
  opts: {
    aspect?: ImageAspect;
    quality?: "fast" | "pro";
    seed?: string;
    sceneKind?: SceneKind;
  } = {},
): Promise<Buffer> {
  if (!BASE_URL || !API_KEY) {
    throw new Error("Gemini integration not configured (missing env vars)");
  }
  const aspect = opts.aspect ?? "1:1";
  const quality = opts.quality ?? "fast";
  const variation = opts.seed
    ? sceneVariation(opts.seed, opts.sceneKind ?? "generic")
    : "";
  const prompt = [
    RULES_PREFIX,
    variation,
    `Aspect ratio: ${aspect}.`,
    rawPrompt.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const url = `${BASE_URL.replace(/\/+$/, "")}/models/${pickModel(quality)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: aspect },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini image generation failed: ${res.status} ${txt.slice(0, 240)}`);
  }
  const json = (await res.json()) as GeminiResp;
  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked prompt: ${json.promptFeedback.blockReason}`);
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) return Buffer.from(inline.data, "base64");
  }
  logger.warn({ json }, "Gemini returned no image data");
  throw new Error("Gemini returned no image data");
}

export function aspectFromSize(size: string): ImageAspect {
  if (size === "1536x1024") return "16:9";
  if (size === "1024x1536") return "9:16";
  return "1:1";
}
