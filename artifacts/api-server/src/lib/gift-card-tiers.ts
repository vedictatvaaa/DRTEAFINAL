import type { GiftCardTier } from "./db";

export interface TierProfile {
  id: GiftCardTier;
  name: string;
  tagline: string;
  /** Minimum lifetimeLoaded (rupees) required to enter this tier. */
  threshold: number;
  /** Bonus credit % applied to every load (purchase or top-up) at this tier. */
  loadBonusPct: number;
  /** Hex foil colour used on physical card stamping + digital UI accent. */
  foil: string;
  /** Solid card-body colour for the luxury card render. */
  body: string;
  /** Roman label embossed below the serial (I, II, III, ★). */
  glyph: string;
  perks: string[];
}

export const GIFT_CARD_TIERS: TierProfile[] = [
  {
    id: "standard",
    name: "Heritage",
    tagline: "Our entry card. The one most chai-lovers start with.",
    threshold: 0,
    loadBonusPct: 0,
    foil: "#d4af37",
    body: "linear-gradient(135deg, #1a2416 0%, #2a3a22 60%, #3a5a2c 130%)",
    glyph: "I",
    perks: [
      "Redeemable on every blend, kit, and ritual",
      "Reload any time — balance never expires for active cards",
      "Hand-numbered, even at the entry tier",
    ],
  },
  {
    id: "silver",
    name: "Silver Estate",
    tagline: "Earned at ₹2,500 lifetime load. Free shipping forever.",
    threshold: 2500,
    loadBonusPct: 3,
    foil: "#c0c8d0",
    body: "linear-gradient(135deg, #2c3038 0%, #4a5560 50%, #c0c8d0 130%)",
    glyph: "II",
    perks: [
      "+3% bonus credit on every reload",
      "Free shipping on every order, no minimum",
      "Two complimentary tea-room tastings per year",
      "Priority access to single-estate seasonal drops",
    ],
  },
  {
    id: "gold",
    name: "Gold Reserve",
    tagline: "Earned at ₹10,000 lifetime load. Tasting-kit on the house.",
    threshold: 10000,
    loadBonusPct: 6,
    foil: "#e8c860",
    body: "linear-gradient(135deg, #3a2b14 0%, #6b4d22 50%, #e8c860 130%)",
    glyph: "III",
    perks: [
      "+6% bonus credit on every reload",
      "Quarterly Reserve tasting kit, complimentary",
      "Personal blend consultation, twice a year",
      "Early access to all limited-edition harvests",
      "Free shipping & express upgrade on every order",
    ],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    tagline: "Earned at ₹50,000 lifetime load. By invitation; rarely seen.",
    threshold: 50000,
    loadBonusPct: 10,
    foil: "#e4d6a8",
    body: "linear-gradient(135deg, #050608 0%, #14171c 60%, #2a2e36 100%)",
    glyph: "★",
    perks: [
      "+10% bonus credit on every reload, for life",
      "Private chai concierge — text us, we curate",
      "Hand-delivered annual harvest kit (Darjeeling First Flush)",
      "Two seats at every Dr Tea cupping in your city",
      "Custom blend bearing your initials, in our archive",
    ],
  },
];

/** Resolve the tier a card sits in given its lifetime load value. */
export function resolveTier(lifetimeLoaded: number): TierProfile {
  // Walk descending so highest qualifying threshold wins.
  for (let i = GIFT_CARD_TIERS.length - 1; i >= 0; i--) {
    const t = GIFT_CARD_TIERS[i]!;
    if (lifetimeLoaded >= t.threshold) return t;
  }
  return GIFT_CARD_TIERS[0]!;
}

export function getTier(id: GiftCardTier): TierProfile {
  return GIFT_CARD_TIERS.find((t) => t.id === id) ?? GIFT_CARD_TIERS[0]!;
}

/**
 * Compute the bonus credit a load of `amount` earns. The bonus is awarded
 * by the tier the *resulting* lifetime load promotes you into — i.e. a
 * first-time ₹3,000 load lands you in Silver and gets the Silver bonus
 * applied to the full amount. Promotion-on-this-load is intentional: it
 * makes the threshold itself feel rewarding to cross.
 */
export function computeLoadBonus(args: {
  amount: number;
  previousLifetimeLoaded: number;
}): { bonus: number; tierAfter: GiftCardTier } {
  const after = args.previousLifetimeLoaded + args.amount;
  const tier = resolveTier(after);
  const bonus = Math.floor((args.amount * tier.loadBonusPct) / 100);
  return { bonus, tierAfter: tier.id };
}

/** Generate a serial like "DT/2026/000427" given an integer card id. */
export function formatSerial(id: number, year = new Date().getFullYear()): string {
  return `DT/${year}/${String(id).padStart(6, "0")}`;
}
