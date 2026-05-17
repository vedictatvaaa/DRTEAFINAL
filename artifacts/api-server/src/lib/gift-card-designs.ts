// ─────────────────────────────────────────────────────────────────────
// Gift card design catalog. Each design carries:
//   • Visual identity (palette, hero gradient stops, motif glyph)
//   • Occasion metadata (festival, season window, badge)
//   • A+ premium content (story, "what's inside", pairing teas, hero copy)
//
// We ship hand-crafted Indian-festival designs alongside evergreen
// occasions (birthday, wedding, thank you). The "season window" lets the
// storefront prioritise & FOMO-rank festive designs only when they're in
// season (countdown, "limited stock this season" ribbon).
// ─────────────────────────────────────────────────────────────────────

export type DesignBadge = "limited" | "festive" | "bestseller" | "new" | null;

export interface GiftCardDesign {
  id: string;
  name: string;
  occasion: string;
  /** Display order — higher floats higher when out-of-season. In-season trumps this. */
  weight: number;
  /** Short editorial blurb above the design tile. */
  tagline: string;
  /** "Amazon A+" rich content. */
  story: string;
  whatsInside: string[];
  pairingTeas: string[];
  /** Optional one-line recipient suggestion. */
  recipientHint: string;
  /** Three-stop palette: bg, accent, text. */
  palette: { bg: string; accent: string; text: string };
  /** CSS gradient for the card's hero panel. */
  heroGradient: string;
  /** Single-character / short motif rendered behind the amount. */
  motif: string;
  badge: DesignBadge;
  /** Inclusive [MM-DD, MM-DD]. Both null = evergreen. Wraps year-end if start > end. */
  seasonStart: string | null;
  seasonEnd: string | null;
  /** ISO date — the festival itself. Used for the FOMO countdown & cutoff math. */
  festivalDate: string | null;
  /** Hard cap on how many physical-format units we will print this season. Used for FOMO scarcity. */
  physicalSeasonCap: number | null;
}

// Pinned to the current operating year. Update annually as part of catalog refresh.
const Y = new Date().getFullYear();

export const GIFT_CARD_DESIGNS: GiftCardDesign[] = [
  // ───── Indian festivals ─────────────────────────────────────────────
  {
    id: "diwali-marigold-diya",
    name: "Marigold & Diya",
    occasion: "Diwali",
    weight: 100,
    tagline: "A garland of light, sealed in gold leaf.",
    story:
      "Hand-illustrated in Jaipur, our Diwali card is bordered with marigold genda phool — the bloom that India strings into every doorway each Kartik. The amount is set against the warm glow of a single clay diya, foiled in 24-karat gold leaf so it catches candlelight the way the festival was meant to.",
    whatsInside: [
      "24kt gold-foil diya, hand-applied to every card",
      "Hand-bordered marigold motif, drawn in Rajasthani miniature style",
      "FSC-certified 350gsm paper with a soft-touch matte finish",
      "Premium tier ships with 3 sample Masala Chai sachets — your recipient can light a diya and brew a cup the same evening",
    ],
    pairingTeas: ["Royal Masala Chai", "Saffron Cardamom Pearl", "Kashmiri Kahwa"],
    recipientHint: "For parents, in-laws, mentors — anyone you'd touch the feet of on Diwali morning.",
    palette: { bg: "#1a0f06", accent: "#f5b800", text: "#fff7e0" },
    heroGradient: "linear-gradient(135deg, #2a1505 0%, #5a2d0a 50%, #f5b800 130%)",
    motif: "🪔",
    badge: "festive",
    seasonStart: "09-15",
    seasonEnd: "11-15",
    festivalDate: `${Y}-11-01`,
    physicalSeasonCap: 800,
  },
  {
    id: "raksha-bandhan-thread",
    name: "Threads of Forever",
    occasion: "Raksha Bandhan",
    weight: 95,
    tagline: "Knot a promise. Pour a cup. Repeat for life.",
    story:
      "A hand-tied silk rakhi sits embedded in the front of every premium Raksha Bandhan card — the same red-and-gold weave that grandmothers in Banaras still spin by hand. Inside, a pre-printed message space lets you write the line you've never quite said out loud. Best paired with a tin of his favourite chai so the gift outlasts the ceremony.",
    whatsInside: [
      "Real silk rakhi tied to the cardstock by hand",
      "Tilak-paper inset for the day-of ceremony",
      "Foil-stamped 'For the one who calls me first' or 'last' — pick at checkout",
      "Premium tier ships in a wooden trinket trunk your sibling will keep on a shelf",
    ],
    pairingTeas: ["Royal Masala Chai", "Almond Saffron Chai", "Brahmi Calm"],
    recipientHint: "For brothers and sisters across cities, oceans, time zones.",
    palette: { bg: "#3a0a14", accent: "#f4c430", text: "#fff0c0" },
    heroGradient: "linear-gradient(135deg, #3a0a14 0%, #7d1535 60%, #f4c430 130%)",
    motif: "🪢",
    badge: "festive",
    seasonStart: "07-15",
    seasonEnd: "08-31",
    festivalDate: `${Y}-08-09`,
    physicalSeasonCap: 600,
  },
  {
    id: "holi-color-splash",
    name: "Spring of Colour",
    occasion: "Holi",
    weight: 88,
    tagline: "All the colour of the morning, with none of the gulal in your eyes.",
    story:
      "Our Holi card is screen-printed in five passes of plant-derived gulal pigment — turmeric yellow, beetroot pink, marigold orange, indigo, neem green — so the colour stays vibrant for years and never stains. Pair with our cooling Rose Cardamom blend for the post-Holi unwind that Indian summers actually call for.",
    whatsInside: [
      "Five-pass plant-pigment screen print on cotton-blend cardstock",
      "Anti-stain top coat — safe to handle with damp hands",
      "Holi-themed sticker sheet inside, for the kids in the house",
      "Premium tier includes a tin of cooling Rose Cardamom iced-tea blend",
    ],
    pairingTeas: ["Rose Cardamom Cooler", "Kashmiri Kahwa", "Pomegranate Hibiscus"],
    recipientHint: "For your loud-laughing best friend, your noisy neighbours, your favourite cousins.",
    palette: { bg: "#3a0a3a", accent: "#ff6b9d", text: "#ffe6f0" },
    heroGradient: "linear-gradient(135deg, #3a0a3a 0%, #c2185b 50%, #ff9800 100%)",
    motif: "🌈",
    badge: "festive",
    seasonStart: "02-15",
    seasonEnd: "03-31",
    festivalDate: `${Y}-03-14`,
    physicalSeasonCap: 500,
  },
  {
    id: "onam-pookalam",
    name: "Pookalam",
    occasion: "Onam",
    weight: 80,
    tagline: "A flower carpet on cardstock, in time for the King's return.",
    story:
      "A perfect concentric pookalam, screen-printed in twelve flower colours and embossed for depth. Designed in collaboration with a Kochi-based illustrator and finished with the silver thali border that no Onam sadya is served without. Pair with our South-Indian Filter Coffee Tisane for the morning after the feast.",
    whatsInside: [
      "Twelve-colour embossed pookalam, with raised petals",
      "Silver-foil thali border around the gift amount",
      "Optional vaazhilai (banana-leaf) printed envelope upgrade",
      "Premium tier includes a small box of jaggery-and-coconut payasam mix",
    ],
    pairingTeas: ["Cardamom Filter Tisane", "Lemongrass Pepper", "Tulsi Honey"],
    recipientHint: "For grandparents and aunts in Kerala, and the Malayali friends who keep telling you to visit.",
    palette: { bg: "#0a3a2c", accent: "#ffb800", text: "#fff5cc" },
    heroGradient: "linear-gradient(135deg, #0a3a2c 0%, #1d6f4a 60%, #ffb800 130%)",
    motif: "🌺",
    badge: "festive",
    seasonStart: "08-15",
    seasonEnd: "09-30",
    festivalDate: `${Y}-09-05`,
    physicalSeasonCap: 300,
  },
  {
    id: "pongal-harvest",
    name: "Pongal Harvest",
    occasion: "Pongal",
    weight: 78,
    tagline: "Sugarcane, jaggery, and the first sip of a slow January.",
    story:
      "An illustrated kolam border and a sugarcane stalk arc frame the gift amount. Printed on warm cream cardstock with a rice-paper inlay, it nods to the harvest pot boiling over — the ancient Tamil sign of abundance. Pair with our Cardamom Filter Tisane for an unmistakable Madurai morning in a cup.",
    whatsInside: [
      "Hand-drawn kolam border by a Madurai artist",
      "Rice-paper inlay with foiled sugarcane stalks",
      "Premium tier includes a jaggery-cardamom seasoning pouch",
      "Optional pre-printed 'Pongalo Pongal!' banner inside",
    ],
    pairingTeas: ["Cardamom Filter Tisane", "Jaggery Ginger Chai", "Tulsi Honey"],
    recipientHint: "For Tamilian families, college roommates from Chennai, the friend who introduced you to filter kaapi.",
    palette: { bg: "#3a2410", accent: "#e8a23c", text: "#fff2d8" },
    heroGradient: "linear-gradient(135deg, #3a2410 0%, #7a4a1a 60%, #e8a23c 130%)",
    motif: "🌾",
    badge: "festive",
    seasonStart: "12-15",
    seasonEnd: "01-31",
    festivalDate: `${Y + 1}-01-14`,
    physicalSeasonCap: 250,
  },
  {
    id: "eid-crescent",
    name: "Crescent & Cardamom",
    occasion: "Eid",
    weight: 82,
    tagline: "A silver moon on a midnight blend.",
    story:
      "A hand-pulled silver-foil crescent rests against deep midnight blue, bordered in hand-painted henna paisley. Designed in Hyderabad, finished in Bangalore. Pair with our Almond-Saffron Chai for the after-iftar visit and our Kashmiri Kahwa for the morning that follows.",
    whatsInside: [
      "Silver-foil crescent, hand-pulled",
      "Henna paisley border in deep teal",
      "Pearlescent blue envelope, gold seal",
      "Premium tier includes a small tin of Sheer Khurma vermicelli mix",
    ],
    pairingTeas: ["Almond Saffron Chai", "Kashmiri Kahwa", "Royal Masala Chai"],
    recipientHint: "For elders, neighbours, the colleague who always brings you sevaiyan at Eid.",
    palette: { bg: "#0a1a3a", accent: "#c0c0c0", text: "#e8e8ff" },
    heroGradient: "linear-gradient(135deg, #050a1a 0%, #1a2a5a 60%, #c0c0c0 130%)",
    motif: "🌙",
    badge: "festive",
    seasonStart: "03-01",
    seasonEnd: "06-30",
    festivalDate: `${Y}-04-10`,
    physicalSeasonCap: 400,
  },
  {
    id: "navratri-garba",
    name: "Nine Nights",
    occasion: "Navratri",
    weight: 70,
    tagline: "A whirl of dandiya colour, frozen in foil.",
    story:
      "Nine concentric rings of foil — one for each night of the festival — spiral inward toward the gift amount. Printed in Ahmedabad on bandhani-textured cardstock so it feels like a chaniya choli to the touch. Pair with our Tulsi-Honey Tisane for the late-night garba recovery.",
    whatsInside: [
      "Nine-ring foil spiral",
      "Bandhani-textured 350gsm cardstock",
      "Mirror-work envelope upgrade in premium tier",
      "Includes a chant card with the nine forms of the Devi",
    ],
    pairingTeas: ["Tulsi Honey", "Rose Cardamom Cooler", "Brahmi Calm"],
    recipientHint: "For your mother, your aunt, the friend who never misses a single night of garba.",
    palette: { bg: "#3a0a2c", accent: "#ff5e9c", text: "#ffe0ec" },
    heroGradient: "linear-gradient(135deg, #3a0a2c 0%, #8e1a5a 60%, #ff5e9c 130%)",
    motif: "💃",
    badge: "festive",
    seasonStart: "09-01",
    seasonEnd: "10-31",
    festivalDate: `${Y}-10-03`,
    physicalSeasonCap: 350,
  },
  {
    id: "christmas-spice",
    name: "Spiced Pine",
    occasion: "Christmas",
    weight: 75,
    tagline: "Cinnamon, clove, and a faint pine breeze.",
    story:
      "A hand-illustrated wreath of cinnamon bark and clove buds in deep green and burnished copper. Smells faintly of pine — we hand-spritz a single drop of natural pine essential oil on every premium card before sealing the envelope. Pair with our spiced Cinnamon-Orange Black for an unmistakable Indian-Christmas Bandra afternoon.",
    whatsInside: [
      "Hand-spritzed pine essential oil (premium tier only — opens to a faint forest)",
      "Copper-foil wreath, embossed",
      "Recycled kraft envelope with red wax seal",
      "Includes a sample sachet of Cinnamon-Orange Black",
    ],
    pairingTeas: ["Cinnamon Orange Black", "Rose Cardamom Cooler", "Kashmiri Kahwa"],
    recipientHint: "For your house help, your driver, your office Secret Santa pick.",
    palette: { bg: "#0f2418", accent: "#c97e3c", text: "#f5e8d4" },
    heroGradient: "linear-gradient(135deg, #0f2418 0%, #2d4a30 50%, #c97e3c 130%)",
    motif: "🎄",
    badge: "festive",
    seasonStart: "11-15",
    seasonEnd: "12-26",
    festivalDate: `${Y}-12-25`,
    physicalSeasonCap: 600,
  },

  // ───── Evergreen occasions ─────────────────────────────────────────
  {
    id: "birthday-golden-bloom",
    name: "Golden Bloom",
    occasion: "Birthday",
    weight: 60,
    tagline: "Add a year. Add a ritual.",
    story:
      "An evergreen birthday card with a single foil-stamped lotus and your hand-calligraphed message inside. Designed to feel like a small piece of jewellery — heavy in the hand, kept on the dresser long after the cake is gone.",
    whatsInside: [
      "Single foil-stamped lotus on cream linen cardstock",
      "Optional hand-calligraphed name inside (premium tier)",
      "Standard ships in a kraft envelope; premium ships in a magnetic-close keepsake box",
      "Pair with any kit they've been quietly eyeing on the site",
    ],
    pairingTeas: ["Himalayan First Flush Darjeeling", "White Peony", "Saffron Cardamom Pearl"],
    recipientHint: "For anyone, on any year that matters.",
    palette: { bg: "#2a1a0a", accent: "#e9c46a", text: "#fff5d6" },
    heroGradient: "linear-gradient(135deg, #2a1a0a 0%, #5a3a18 60%, #e9c46a 130%)",
    motif: "✦",
    badge: "bestseller",
    seasonStart: null,
    seasonEnd: null,
    festivalDate: null,
    physicalSeasonCap: null,
  },
  {
    id: "wedding-saffron-sandalwood",
    name: "Saffron & Sandalwood",
    occasion: "Wedding",
    weight: 65,
    tagline: "A tea ritual to outlast the wedding playlist.",
    story:
      "A double-foil card — saffron and sandalwood — with the couple's name set in a serif you'd find on a shaadi card. Inside, room for the kind of message you mean. The premium box doubles as a keepsake the couple will use for chai-time letters once the rangolis are swept.",
    whatsInside: [
      "Double-foil saffron + sandalwood emboss",
      "Couple-name personalisation, in a wedding-card serif",
      "Inside spread sized for a long, hand-written message",
      "Premium tier ships in a wooden keepsake trunk with a small mirror inside the lid",
    ],
    pairingTeas: ["Saffron Cardamom Pearl", "Rose Oolong", "Almond Saffron Chai"],
    recipientHint: "For the couple — even better when they didn't ask for a 'no gifts please' wedding.",
    palette: { bg: "#3a1a14", accent: "#f4a82c", text: "#fff5e0" },
    heroGradient: "linear-gradient(135deg, #3a1a14 0%, #7a3a24 60%, #f4a82c 130%)",
    motif: "❀",
    badge: "bestseller",
    seasonStart: null,
    seasonEnd: null,
    festivalDate: null,
    physicalSeasonCap: null,
  },
  {
    id: "anniversary-aged-puerh",
    name: "Aged Pu-erh",
    occasion: "Anniversary",
    weight: 50,
    tagline: "Better with every brew. Same as you two.",
    story:
      "A deep-aged-leaf colour palette, the kind of dark gold a fifteen-year pu-erh leaves at the bottom of a porcelain cup. A hand-letterpress 'still here, still steeping' sits inside. The tea-pairing recommendation rotates by anniversary year — first, fifth, tenth, twenty-fifth.",
    whatsInside: [
      "Hand-letterpress message, debossed into the cardstock",
      "Anniversary-year-specific tea pairing card",
      "Optional photo inset (premium tier)",
      "Wax-sealed envelope in a deep oxblood",
    ],
    pairingTeas: ["Aged Yunnan Pu-erh", "Smoked Lapsang", "Rose Oolong"],
    recipientHint: "For your partner. For your parents on their 40th.",
    palette: { bg: "#1a0f0a", accent: "#a86b3a", text: "#ffe8d4" },
    heroGradient: "linear-gradient(135deg, #1a0f0a 0%, #4a2d1c 60%, #a86b3a 130%)",
    motif: "♥",
    badge: null,
    seasonStart: null,
    seasonEnd: null,
    festivalDate: null,
    physicalSeasonCap: null,
  },
  {
    id: "thank-you-tulsi",
    name: "Tulsi Gratitude",
    occasion: "Thank You",
    weight: 45,
    tagline: "For every cup of tea you didn't ask to be made.",
    story:
      "An evergreen thank-you card with a single sprig of pressed tulsi — yes, real, yes, dried by us in a Coorg estate. The kind of small, deliberate gift you give a teacher, a domestic help, a colleague who covered for you on a hard week.",
    whatsInside: [
      "Pressed tulsi sprig, glassine-protected",
      "Hand-letterpress 'thank you' in three Indian scripts (Devanagari, Tamil, Latin)",
      "Optional 50g sachet of Tulsi-Honey blend in the premium tier",
      "Recycled kraft envelope with a minimal cream seal",
    ],
    pairingTeas: ["Tulsi Honey", "Tulsi Ashwagandha", "Cardamom Filter Tisane"],
    recipientHint: "For the people who make your week run.",
    palette: { bg: "#0f2418", accent: "#9bbf6f", text: "#e8f5d8" },
    heroGradient: "linear-gradient(135deg, #0f2418 0%, #2d4a30 60%, #9bbf6f 130%)",
    motif: "🌿",
    badge: null,
    seasonStart: null,
    seasonEnd: null,
    festivalDate: null,
    physicalSeasonCap: null,
  },
  {
    id: "classic-evergreen",
    name: "House Heritage",
    occasion: "Any occasion",
    weight: 30,
    tagline: "Our most-gifted card. The one without a calendar.",
    story:
      "Our quiet, evergreen card. Deep-house-green linen cardstock, single foil-stamped tea leaf, and a generous spread inside for whatever you want to write. The one that suits a teacher, a manager, a friend you don't see often enough.",
    whatsInside: [
      "Linen 350gsm cardstock in our house deep green",
      "Single foil-stamped tea leaf",
      "Generous inside spread for a hand-written message",
      "Compatible with every packaging tier we sell",
    ],
    pairingTeas: ["Himalayan First Flush Darjeeling", "Royal Masala Chai", "Tulsi Honey"],
    recipientHint: "For the moments you can't quite name. For everyone else.",
    palette: { bg: "#1a2416", accent: "#d4af37", text: "#fff7e0" },
    heroGradient: "linear-gradient(135deg, #0e1810 0%, #1a2416 50%, #3a5a2c 130%)",
    motif: "𓋹",
    badge: null,
    seasonStart: null,
    seasonEnd: null,
    festivalDate: null,
    physicalSeasonCap: null,
  },
];

export function getDesign(id: string): GiftCardDesign | undefined {
  return GIFT_CARD_DESIGNS.find((d) => d.id === id);
}

/** True if today's MM-DD falls within the design's season window (inclusive, wraps year-end). */
export function isDesignInSeason(d: GiftCardDesign, now: Date = new Date()): boolean {
  if (!d.seasonStart || !d.seasonEnd) return true; // evergreen always
  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (d.seasonStart <= d.seasonEnd) {
    return mmdd >= d.seasonStart && mmdd <= d.seasonEnd;
  }
  // Wraps year-end (e.g. Pongal: 12-15 → 01-31)
  return mmdd >= d.seasonStart || mmdd <= d.seasonEnd;
}

/** Days until festivalDate (>=0). null when there's no festival or it's already past. */
export function daysUntilFestival(d: GiftCardDesign, now: Date = new Date()): number | null {
  if (!d.festivalDate) return null;
  const target = new Date(`${d.festivalDate}T00:00:00+05:30`).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.ceil((target - todayMidnight) / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null;
}
