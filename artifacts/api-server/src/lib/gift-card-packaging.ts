// ─────────────────────────────────────────────────────────────────────
// Packaging tiers for gift cards. "digital" is the default and free —
// the card is delivered by email + on the My Account page. Anything
// else is physical and the order joins the fulfilment queue.
// ─────────────────────────────────────────────────────────────────────

export interface GiftCardPackaging {
  id: string;
  name: string;
  /** Storefront-facing one-line summary. */
  tagline: string;
  /** Three short bullets, displayed on the picker card. */
  features: string[];
  /** Add-on price in rupees. 0 = free. Always charged on top of the gift card amount. */
  fee: number;
  /** Physical SKUs only — used by the fulfilment queue. */
  format: "digital" | "physical";
  /** Days the warehouse needs from order to courier handover. Used for cutoff math. */
  leadTimeDays: number;
}

export const GIFT_CARD_PACKAGING: GiftCardPackaging[] = [
  {
    id: "digital",
    name: "Digital — Instant",
    tagline: "Delivered by email the moment the payment clears.",
    features: [
      "Reaches the recipient in seconds, even at midnight",
      "Animated unwrap when they tap the link on their phone",
      "Carbon-zero — no print, no courier",
    ],
    fee: 0,
    format: "digital",
    leadTimeDays: 0,
  },
  {
    id: "envelope",
    name: "Premium Card + Envelope",
    tagline: "Letterpressed on cotton-blend stock, mailed in a wax-sealed envelope.",
    features: [
      "350gsm cotton-blend cardstock with foil accents",
      "Hand-sealed envelope with a wax stamp",
      "Tracked India Post delivery",
    ],
    fee: 249,
    format: "physical",
    leadTimeDays: 3,
  },
  {
    id: "keepsake-box",
    name: "Keepsake Tea Box",
    tagline: "Magnetic-close box, silk-lined, with a sample chai trio inside.",
    features: [
      "Magnetic-close keepsake box, silk-lined",
      "Three sample sachets of our seasonal chai trio",
      "Hand-tied jute and brass tag with the recipient's name",
      "Express courier — typically 2 working days metro, 4 elsewhere",
    ],
    fee: 549,
    format: "physical",
    leadTimeDays: 4,
  },
  {
    id: "heritage-trunk",
    name: "Heritage Wooden Trunk",
    tagline: "Sheesham-wood trunk with brass clasp, three teas, and a hand-thrown porcelain cup.",
    features: [
      "Sheesham-wood trunk with hand-fitted brass clasp",
      "Three full-size 50g caddies of our most-loved blends",
      "One hand-thrown porcelain tasting cup from a Khurja kiln",
      "White-glove courier with signature on delivery",
      "Ships in 7 working days nationwide",
    ],
    fee: 1499,
    format: "physical",
    leadTimeDays: 7,
  },
];

export function getPackaging(id: string): GiftCardPackaging | undefined {
  return GIFT_CARD_PACKAGING.find((p) => p.id === id);
}
