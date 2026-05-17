import { useMemo } from 'react';
import type { Product } from '@/data/products';

export interface PdpCategoryConfig {
  eyebrow: string;
  heroGradient: string;
  serifAccent: string;
  badges: string[];
  occasions: string[];
  dailyCups: number;
  brewIntro: string;
  strength: 1 | 2 | 3 | 4;
  comparison: { bestFor: string; caffeine: string; flavor: string };
  benefitsHeadline: string;
  storyHeadline: string;
  storyBody: string;
}

const CATEGORY_CONFIG: Record<string, PdpCategoryConfig> = {
  'Floral Tisane': {
    eyebrow: 'Botanical Calm',
    heroGradient: 'linear-gradient(135deg, hsla(330, 60%, 95%, 0.85), hsla(280, 40%, 96%, 0.4))',
    serifAccent: 'italic',
    badges: ['Naturally Caffeine Free', 'Floral Tisane', 'Vegan', 'Small Batch Packed'],
    occasions: ['Evening reading', 'Mindful mornings', 'Self-care rituals', 'Rainy evenings', 'Guest serving'],
    dailyCups: 2,
    brewIntro: 'A delicate steep — gentler heat preserves the floral oils that give this tisane its character.',
    strength: 1,
    comparison: { bestFor: 'Relaxation & calm', caffeine: 'None', flavor: 'Floral, delicate' },
    benefitsHeadline: "A floral pause for mind and body",
    storyHeadline: 'A Ritual Rooted in Nature',
    storyBody:
      'At Dr Tea, we believe a tisane is more than a drink — it is a slow, mindful pause. Every blend is sourced from trusted growers, hand-selected at peak bloom, and packed in small batches to preserve the purity of aroma, colour, and feeling in every cup.',
  },
  'Chai': {
    eyebrow: 'Warm Indian Ritual',
    heroGradient: 'linear-gradient(135deg, hsla(25, 70%, 85%, 0.9), hsla(15, 60%, 90%, 0.5))',
    serifAccent: '',
    badges: ['Whole Spices', 'Single-Origin Assam', 'Small Batch Packed', 'No Artificial Flavours'],
    occasions: ['Morning ritual', 'Monsoon afternoons', 'Family moments', 'With biscuits', 'Work breaks'],
    dailyCups: 3,
    brewIntro: 'Chai blooms in the simmer, not the steep — boil with milk and water until the kitchen smells like home.',
    strength: 4,
    comparison: { bestFor: 'Energy & warmth', caffeine: 'High', flavor: 'Malty, spiced' },
    benefitsHeadline: 'Why a real chai feels different',
    storyHeadline: 'A Cup that Tastes Like Home',
    storyBody:
      'Every Dr Tea chai begins with single-origin Assam CTC from the Brahmaputra flood plains, blended with whole spices ground in small batches. We do not crush the spices into powder — we let the kettle do the work, the way it has been done in Indian kitchens for generations.',
  },
  'Kadha': {
    eyebrow: 'Ayurvedic Wellness',
    heroGradient: 'linear-gradient(135deg, hsla(45, 60%, 88%, 0.9), hsla(30, 50%, 90%, 0.5))',
    serifAccent: '',
    badges: ['Ayurvedic Blend', 'Whole Herbs', 'Caffeine Free', 'Traditionally Crafted'],
    occasions: ['First scratch of a cold', 'Monsoon evenings', 'Post-meal unwind', 'Restorative rituals'],
    dailyCups: 2,
    brewIntro: 'A traditional decoction — bring the water to a rolling boil, then simmer covered to release the herbs slowly.',
    strength: 3,
    comparison: { bestFor: 'Wellness & restoration', caffeine: 'None', flavor: 'Herbal, warming' },
    benefitsHeadline: "The grandmother's remedy, decoded",
    storyHeadline: 'A Recipe Older Than the Recipe Book',
    storyBody:
      "Kadha is the Indian household's first answer to a long day, a chilly evening, or the very first scratch of a cold. Our blends are built around whole roots, leaves, and spices, sourced from Ayurvedic farms and proportioned the way grandmothers — not chemists — weighed them.",
  },
  'Green Tea': {
    eyebrow: 'Fresh Wellness',
    heroGradient: 'linear-gradient(135deg, hsla(120, 30%, 92%, 0.9), hsla(140, 25%, 94%, 0.4))',
    serifAccent: '',
    badges: ['High Altitude', 'Pan-Fired', 'Light Caffeine', 'Antioxidant-Rich'],
    occasions: ['Mid-morning focus', 'Post-meal cleanse', 'Workouts', 'Reading breaks', 'Bright afternoons'],
    dailyCups: 3,
    brewIntro: 'Cooler water, shorter steep — high heat scorches the leaves and turns this tea bitter.',
    strength: 2,
    comparison: { bestFor: 'Focus & cleansing', caffeine: 'Low', flavor: 'Vegetal, crisp' },
    benefitsHeadline: "Clean energy that doesn't crash",
    storyHeadline: 'Mountain Air, in a Cup',
    storyBody:
      'Our greens come from estate gardens above 1,500m, where cool air, mineral soil, and quick pan-firing within hours of plucking lock in a crisp, vegetal cup. No flavouring, no shortcuts — just the leaf as the mountain made it.',
  },
  'Black Tea': {
    eyebrow: 'Heritage Sophistication',
    heroGradient: 'linear-gradient(135deg, hsla(15, 40%, 88%, 0.9), hsla(0, 30%, 92%, 0.4))',
    serifAccent: '',
    badges: ['Single-Origin', 'Whole Leaf', 'Heritage Garden', 'Premium Grade'],
    occasions: ['Slow mornings', 'Afternoon reading', 'After dinner', 'Quiet conversation'],
    dailyCups: 3,
    brewIntro: 'A rolling boil and a longer steep — black tea wants time, not tricks.',
    strength: 3,
    comparison: { bestFor: 'Refined daily ritual', caffeine: 'Medium-High', flavor: 'Malty, brisk' },
    benefitsHeadline: 'The classic that earned its place',
    storyHeadline: 'Heritage in Every Steep',
    storyBody:
      'Each of our black teas comes from a single estate with a name and a history — Darjeeling, Assam, Nilgiri. We work directly with garden managers to select lots that show the character of their region rather than chasing volume.',
  },
  'Tea Reserve': {
    eyebrow: 'Connoisseur Selection',
    heroGradient: 'linear-gradient(135deg, hsla(45, 60%, 75%, 0.9), hsla(0, 0%, 95%, 0.5))',
    serifAccent: 'italic',
    badges: ['Single-Estate', 'Hand-Plucked', 'Small Lot', 'Collector Edition'],
    occasions: ['Ceremonial moments', 'Tasting flights', 'Gift-worthy occasions', 'Slow Sundays'],
    dailyCups: 2,
    brewIntro: 'Treat it like a fine wine — pre-warm the vessel, pour gently, and let the leaves give you three or four infusions.',
    strength: 2,
    comparison: { bestFor: 'Connoisseur tasting', caffeine: 'Variable', flavor: 'Complex, evolving' },
    benefitsHeadline: 'A tea worth slowing down for',
    storyHeadline: 'For the Few Who Care About the Many',
    storyBody:
      'The Tea Reserve is our smallest and most considered collection. Every lot is hand-plucked from a single estate, often a single hillside, and packed in numbered tins. Once a season ends, that lot is gone until the next harvest.',
  },
};

const DEFAULT_CONFIG: PdpCategoryConfig = CATEGORY_CONFIG['Floral Tisane']!;

export function configForCategory(category: string): PdpCategoryConfig {
  return CATEGORY_CONFIG[category] ?? DEFAULT_CONFIG;
}

export function usePdpTheme(category: string): PdpCategoryConfig {
  return useMemo(() => configForCategory(category), [category]);
}

export interface IngredientSpotlight {
  name: string;
  origin: string;
  flavor: string;
  traditionalUse: string;
}

const INGREDIENT_DETAILS: Array<{ key: string; data: Omit<IngredientSpotlight, 'name'> }> = [
  { key: 'hibiscus',   data: { origin: 'Andhra Pradesh delta farms',                 flavor: 'Tart, cranberry-bright, floral',     traditionalUse: 'Traditionally enjoyed as a cooling, ruby-red infusion celebrated for its vitamin C content.' } },
  { key: 'chamomile',  data: { origin: 'High-altitude Kullu Valley',                 flavor: 'Honey-soft, apple-sweet',            traditionalUse: 'Traditionally taken in the evening to support a calm, restorative wind-down.' } },
  { key: 'lavender',   data: { origin: 'Uttarakhand mountain valleys',               flavor: 'Aromatic, faintly sweet, herbaceous', traditionalUse: 'Traditionally used to help quiet a racing mind before sleep.' } },
  { key: 'rose',       data: { origin: 'Kannauj — the rose belt of Rajasthan',       flavor: 'Perfumed, lightly honeyed',          traditionalUse: 'Used in Ayurveda for over five millennia to nourish the heart and skin.' } },
  { key: 'fennel',     data: { origin: 'Saurashtra, Gujarat',                        flavor: 'Sweet anise, gently warming',        traditionalUse: 'A classic post-meal mukhwas to support digestion and freshen breath.' } },
  { key: 'peppermint', data: { origin: 'Tarai plains, Uttar Pradesh',                flavor: 'Cooling, clean, mentholic',          traditionalUse: 'Traditionally served to cool the body and clear the head.' } },
  { key: 'pea',        data: { origin: 'Kerala backwaters',                          flavor: 'Earthy, smooth, faintly floral',     traditionalUse: 'Used in Southeast Asian preparations and prized for its anthocyanin pigment.' } },
  { key: 'cardamom',   data: { origin: 'Sahyadri foothills, Kerala',                 flavor: 'Sweet citrus, eucalyptus, regal',    traditionalUse: 'The "queen of spices" — long woven into chai for warmth and aroma.' } },
  { key: 'cinnamon',   data: { origin: 'South Indian estates',                       flavor: 'Sweet wood, gentle heat',            traditionalUse: 'Used across Ayurveda to support digestion and warming circulation.' } },
  { key: 'clove',      data: { origin: 'Kerala coast',                               flavor: 'Pungent, sweet, deeply warming',     traditionalUse: 'Traditionally added to kadhas and chais for warming aromatic depth.' } },
  { key: 'ginger',     data: { origin: 'Idukki and Sikkim hills',                    flavor: 'Sharp, peppery warmth',              traditionalUse: 'A staple of Indian kitchens for supporting digestion and warming the body.' } },
  { key: 'pepper',     data: { origin: 'Malabar coast',                              flavor: 'Sharp, bright heat',                 traditionalUse: 'Activates the wellness compounds of other spices in classic chai blends.' } },
  { key: 'tulsi',      data: { origin: 'Vrindavan and Vidarbha gardens',             flavor: 'Clove-like, herbal, slightly sweet', traditionalUse: 'Holy basil — revered in Ayurveda as a daily adaptogen.' } },
  { key: 'mulethi',    data: { origin: 'Single-source Ayurvedic farms',              flavor: 'Naturally sweet, woody',             traditionalUse: "A grandmother's remedy, traditionally used to soothe the throat and chest." } },
  { key: 'liquorice',  data: { origin: 'Single-source Ayurvedic farms',              flavor: 'Naturally sweet, woody',             traditionalUse: "A grandmother's remedy, traditionally used to soothe the throat and chest." } },
  { key: 'assam',      data: { origin: 'Brahmaputra flood plains, Assam',            flavor: 'Malty, robust, full-bodied',         traditionalUse: "India's heritage CTC — the foundation of every great chai." } },
  { key: 'green tea',  data: { origin: 'High-altitude estate gardens',               flavor: 'Vegetal, crisp, mineral',            traditionalUse: 'Pan-fired or steamed within hours of plucking to preserve freshness.' } },
  { key: 'buckthorn',  data: { origin: 'Ladakh river valleys above 3,500m',          flavor: 'Tart, citrus-bright, tropical',      traditionalUse: 'A Himalayan superfood prized for over 190 bioactive compounds.' } },
  { key: 'salt',       data: { origin: 'Himalayan rock salt',                        flavor: 'Mineral, subtly savoury',            traditionalUse: 'Used in noon chai and traditional kadhas for body and balance.' } },
];

const CATEGORY_COMPANIONS: Record<string, IngredientSpotlight[]> = {
  'Floral Tisane': [
    { name: 'The Water', origin: 'Filtered, soft water at 85–90°C', flavor: 'A clean carrier that lets florals speak', traditionalUse: 'A gentler temperature is what keeps petals from turning bitter.' },
    { name: 'The Vessel', origin: 'Glass or porcelain teapot', flavor: 'Neutral — preserves true colour', traditionalUse: 'Choose clear glass to enjoy the visual ritual of bloom and steep.' },
  ],
  'Green Tea': [
    { name: 'The Water', origin: 'Filtered, soft water at 75–80°C', flavor: 'Crisp, never scorched', traditionalUse: 'Greens want cooler water — a boil will burn the leaves.' },
    { name: 'The Vessel', origin: 'Glass gaiwan or kyusu', flavor: 'Quick pour, even extraction', traditionalUse: 'Re-steep two to three times — flavour evolves with each pour.' },
  ],
  'Black Tea': [
    { name: 'The Water', origin: 'Filtered, fresh boil at 95–100°C', flavor: 'Full extraction of body and brisk character', traditionalUse: 'A rolling boil pulls the malt forward without astringency.' },
    { name: 'The Vessel', origin: 'Bone china or stoneware', flavor: 'Holds heat for the full steep', traditionalUse: 'Pre-warm the cup so the first sip arrives at the right temperature.' },
  ],
  'Tea Reserve': [
    { name: 'The Water', origin: 'Filtered, low-mineral water', flavor: 'Lets nuance show through', traditionalUse: 'Hard water dulls delicate, single-estate teas.' },
    { name: 'The Vessel', origin: 'Pre-warmed gaiwan or porcelain pot', flavor: 'Neutral aroma, even heat', traditionalUse: 'Multiple short infusions reveal layers a single steep cannot.' },
  ],
  'Chai': [
    { name: 'The Milk', origin: 'Whole-fat dairy or barista oat', flavor: 'Carries the spices, rounds the malt', traditionalUse: 'Boil milk with the tea — never add cold milk to a brewed cup.' },
  ],
  'Kadha': [
    { name: 'The Vessel', origin: 'Heavy-bottomed pot or clay handi', flavor: 'Even, sustained simmer', traditionalUse: 'A long, low simmer is what unlocks the wellness compounds in roots.' },
  ],
};

function detailFor(name: string): Omit<IngredientSpotlight, 'name'> {
  const key = name.toLowerCase();
  for (const { key: k, data } of INGREDIENT_DETAILS) {
    if (key.includes(k)) return data;
  }
  return {
    origin: 'Carefully sourced from trusted Indian growers',
    flavor: 'A distinctive aromatic note',
    traditionalUse: 'A considered addition to this small-batch blend.',
  };
}

const CATEGORY_CARD_CAP: Record<string, number> = {
  'Floral Tisane': 6,
  'Kadha': 6,
  'Chai': 3,
  'Green Tea': 3,
  'Black Tea': 3,
  'Tea Reserve': 3,
};

export function getIngredientSpotlights(category: string, ingredients: string[]): IngredientSpotlight[] {
  const cap = CATEGORY_CARD_CAP[category] ?? 3;
  const primary: IngredientSpotlight[] = ingredients.map(name => ({ name, ...detailFor(name) }));
  if (primary.length >= 3) return primary.slice(0, cap);
  const companions = CATEGORY_COMPANIONS[category] ?? [];
  const merged = [...primary];
  for (const c of companions) {
    if (merged.length >= 3) break;
    merged.push(c);
  }
  return merged.slice(0, cap);
}

export function gramsFromSize(size: string): number {
  if (size.endsWith('kg')) return parseFloat(size) * 1000;
  return parseFloat(size);
}

export function estimatedDuration(grams: number, dailyCups: number, gramsPerCup = 2.2): string {
  const cups = grams / gramsPerCup;
  const days = Math.max(1, Math.round(cups / dailyCups));
  if (days < 14) return `≈ ${days} days`;
  if (days < 60) {
    const weeks = days / 7;
    const lo = Math.max(1, Math.round(weeks - 0.5));
    const hi = Math.round(weeks + 0.5);
    return `≈ ${lo}–${hi} weeks`;
  }
  const months = days / 30;
  const lo = Math.max(1, Math.round(months - 0.5));
  const hi = Math.round(months + 0.5);
  return `≈ ${lo}–${hi} months`;
}

export function splitNotes(notes: string[]): { top: string[]; mid: string[]; finish: string[] } {
  if (notes.length === 0) return { top: [], mid: [], finish: [] };
  if (notes.length === 1) return { top: notes, mid: [], finish: [] };
  if (notes.length === 2) return { top: [notes[0]!], mid: [], finish: [notes[1]!] };
  if (notes.length === 3) return { top: [notes[0]!], mid: [notes[1]!], finish: [notes[2]!] };
  const t = Math.ceil(notes.length / 3);
  return { top: notes.slice(0, t), mid: notes.slice(t, t * 2), finish: notes.slice(t * 2) };
}

export interface FomoMessage { tone: 'urgent' | 'soft'; text: string; iconKey: 'flame' | 'sprout' | 'package' | 'award' | 'sparkles' | 'heart' }

export function pickFomo(product: Product, stock: number): FomoMessage | null {
  if (stock > 0 && stock < 12) return { tone: 'urgent', iconKey: 'flame', text: `Only ${stock} tins remain in this batch` };
  switch (product.fomoTag) {
    case 'fresh-harvest': return { tone: 'soft', iconKey: 'sprout',   text: 'Fresh harvest — packed this month' };
    case 'limited-batch': return { tone: 'soft', iconKey: 'package',  text: 'Small batch packed for peak freshness' };
    case 'rare-reserve':  return { tone: 'soft', iconKey: 'award',    text: 'Limited estate harvest — collector edition' };
    case 'trending':      return { tone: 'soft', iconKey: 'sparkles', text: `Popular with ${product.category.toLowerCase()} lovers this week` };
    case 'bestseller':    return { tone: 'soft', iconKey: 'heart',    text: 'Customer favourite — top-rated blend' };
    default: return null;
  }
}
