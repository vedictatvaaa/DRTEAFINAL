import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import {
  db,
  giftCardsTable,
  giftCardRedemptionsTable,
  type ShopperUserRow,
} from "../lib/db";
import { logger } from "../lib/logger";
import { getProvider } from "../lib/payments";
import { getSettings } from "../lib/payments/settings";
import { getShopper, requireShopper } from "../lib/shopper-auth";
import {
  GIFT_CARD_MIN,
  GIFT_CARD_MAX,
  GIFT_CARD_PRESETS,
  defaultGiftCardExpiry,
  lookupGiftCardByCode,
  mintUniqueGiftCardCode,
  normalizeGiftCardCode,
} from "../lib/gift-cards";
import {
  GIFT_CARD_DESIGNS,
  daysUntilFestival,
  getDesign,
  isDesignInSeason,
} from "../lib/gift-card-designs";
import { GIFT_CARD_PACKAGING, getPackaging } from "../lib/gift-card-packaging";
import {
  GIFT_CARD_TIERS,
  computeLoadBonus,
  formatSerial,
  getTier,
  resolveTier,
} from "../lib/gift-card-tiers";
import { recordActivity } from "../lib/activity-log";

const router: IRouter = Router();

// ─── Public catalog ─────────────────────────────────────────────────

router.get("/gift-cards/designs", (_req: Request, res: Response) => {
  const now = new Date();
  // Sort: in-season first (by festival proximity), then evergreen by weight desc.
  const enriched = GIFT_CARD_DESIGNS.map((d) => ({
    ...d,
    inSeason: isDesignInSeason(d, now),
    daysUntilFestival: daysUntilFestival(d, now),
  }));
  enriched.sort((a, b) => {
    if (a.inSeason !== b.inSeason) return a.inSeason ? -1 : 1;
    if (a.daysUntilFestival != null && b.daysUntilFestival != null) {
      return a.daysUntilFestival - b.daysUntilFestival;
    }
    if (a.daysUntilFestival != null) return -1;
    if (b.daysUntilFestival != null) return 1;
    return b.weight - a.weight;
  });
  res.json({ designs: enriched });
});

router.get("/gift-cards/designs/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"] ?? "");
  const design = getDesign(id);
  if (!design) {
    res.status(404).json({ error: "Design not found" });
    return;
  }
  const now = new Date();
  const inSeason = isDesignInSeason(design, now);
  const daysLeft = daysUntilFestival(design, now);

  // FOMO: how many physical cards in this design have been sold this season.
  // Capped query — we only count physical orders within the design's season window.
  let soldThisSeason = 0;
  if (design.physicalSeasonCap != null && design.seasonStart && design.seasonEnd) {
    const win = seasonWindow(design.seasonStart, design.seasonEnd, now);
    const [agg] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(giftCardsTable)
      .where(
        and(
          eq(giftCardsTable.designId, design.id),
          eq(giftCardsTable.format, "physical"),
          gte(giftCardsTable.createdAt, win.start),
          lt(giftCardsTable.createdAt, win.endExclusive),
        ),
      );
    soldThisSeason = agg?.n ?? 0;
  }

  res.json({
    design,
    inSeason,
    daysUntilFestival: daysLeft,
    physicalSold: soldThisSeason,
    physicalRemaining:
      design.physicalSeasonCap != null
        ? Math.max(0, design.physicalSeasonCap - soldThisSeason)
        : null,
  });
});

router.get("/gift-cards/packaging", (_req: Request, res: Response) => {
  res.json({ packaging: GIFT_CARD_PACKAGING });
});

router.get("/gift-cards/quote", (req: Request, res: Response) => {
  const amount = Number(req.query["amount"] ?? "0");
  const packagingId = String(req.query["packagingId"] ?? "digital");
  const designId = String(req.query["designId"] ?? "classic-evergreen");
  const requestedFormat = req.query["format"] != null ? String(req.query["format"]) : null;
  const pkg = getPackaging(packagingId);
  const design = getDesign(designId);
  if (!pkg || !design) {
    res.status(400).json({ error: "Unknown design or packaging" });
    return;
  }
  // Reject incompatible packaging/format combos so the quote always reflects
  // a buyable cart (e.g. "heritage-trunk" cannot be sold as digital).
  if (requestedFormat && requestedFormat !== pkg.format) {
    res.status(400).json({
      error: `Packaging "${pkg.name}" is ${pkg.format}; cannot be quoted as ${requestedFormat}.`,
    });
    return;
  }
  if (!Number.isFinite(amount) || amount < GIFT_CARD_MIN || amount > GIFT_CARD_MAX) {
    res.status(400).json({ error: `Amount must be between ₹${GIFT_CARD_MIN} and ₹${GIFT_CARD_MAX}` });
    return;
  }
  const total = Math.round(amount + pkg.fee);
  // Cutoff = festivalDate − leadTimeDays. null when no festival.
  let cutoff: string | null = null;
  if (design.festivalDate && pkg.format === "physical") {
    const fest = new Date(`${design.festivalDate}T00:00:00+05:30`);
    fest.setDate(fest.getDate() - pkg.leadTimeDays);
    cutoff = fest.toISOString();
  }
  res.json({
    cardAmount: amount,
    packagingFee: pkg.fee,
    total,
    cutoff,
    leadTimeDays: pkg.leadTimeDays,
  });
});

// FOMO: counts of cards purchased in the trailing N hours, broken out by
// format. Used for the "23 sent in the last hour" ticker.
router.get("/gift-cards/activity", async (_req: Request, res: Response) => {
  try {
    const oneHour = new Date(Date.now() - 60 * 60 * 1000);
    const oneDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [hour] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(giftCardsTable)
      .where(gte(giftCardsTable.createdAt, oneHour));
    const [day] = await db
      .select({
        total: sql<number>`count(*)::int`,
        physical: sql<number>`count(*) filter (where ${giftCardsTable.format} = 'physical')::int`,
      })
      .from(giftCardsTable)
      .where(gte(giftCardsTable.createdAt, oneDay));
    res.json({
      lastHour: hour?.n ?? 0,
      last24h: day?.total ?? 0,
      last24hPhysical: day?.physical ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "gift-cards.activity failed");
    res.json({ lastHour: 0, last24h: 0, last24hPhysical: 0 });
  }
});

// Public: balance check by code.
router.get("/gift-cards/check", async (req: Request, res: Response) => {
  const code = String(req.query["code"] ?? "");
  const lookup = await lookupGiftCardByCode(code);
  if (!lookup.ok) {
    res.status(404).json({ ok: false, reason: lookup.reason });
    return;
  }
  res.json({
    ok: true,
    code: lookup.card.code,
    serial: lookup.card.serial,
    tier: lookup.card.tier,
    balance: lookup.card.balance,
    initialAmount: lookup.card.initialAmount,
    bonusCredit: lookup.card.bonusCredit,
    lifetimeLoaded: lookup.card.lifetimeLoaded,
    lifetimeRedeemed: lookup.card.lifetimeRedeemed,
    topupCount: lookup.card.topupCount,
    currency: lookup.card.currency,
    expiresAt: lookup.card.expiresAt,
    status: lookup.card.status,
    isReloadable: lookup.card.status === "active",
  });
});

router.get(
  "/gift-cards/mine",
  requireShopper(),
  async (req: Request, res: Response) => {
    const user = (req as Request & { shopper?: ShopperUserRow }).shopper!;
    try {
      const rows = await db
        .select()
        .from(giftCardsTable)
        .where(
          or(
            eq(giftCardsTable.purchaserUserId, user.id),
            eq(giftCardsTable.recipientEmail, user.email),
          ),
        )
        .orderBy(desc(giftCardsTable.createdAt));
      res.json({ cards: rows });
    } catch (err) {
      logger.error({ err }, "gift-cards.mine failed");
      res.status(500).json({ error: "Could not load gift cards." });
    }
  },
);

router.get("/gift-cards/config", (_req: Request, res: Response) => {
  res.json({
    min: GIFT_CARD_MIN,
    max: GIFT_CARD_MAX,
    presets: GIFT_CARD_PRESETS,
  });
});

// Membership-tier catalog. Surfaced on the storefront so shoppers can see
// the bonus they'll earn at each load level before they commit.
router.get("/gift-cards/tiers", (_req: Request, res: Response) => {
  res.json({ tiers: GIFT_CARD_TIERS });
});

// Quote a load (for purchase or top-up): given an amount + the previous
// lifetime load on the card, returns bonus credit + tier-after.
router.get("/gift-cards/load-quote", (req: Request, res: Response) => {
  const amount = Number(req.query["amount"] ?? "0");
  const prev = Number(req.query["previousLifetimeLoaded"] ?? "0");
  if (!Number.isFinite(amount) || amount < GIFT_CARD_MIN || amount > GIFT_CARD_MAX) {
    res.status(400).json({ error: `Amount must be between ₹${GIFT_CARD_MIN} and ₹${GIFT_CARD_MAX}` });
    return;
  }
  const { bonus, tierAfter } = computeLoadBonus({
    amount,
    previousLifetimeLoaded: Math.max(0, prev),
  });
  res.json({ bonus, tierAfter, tierProfile: getTier(tierAfter) });
});

// ─── Purchase ───────────────────────────────────────────────────────

const DeliveryAddressSchema = z.object({
  fullName: z.string().min(1).max(120),
  phone: z.string().min(7).max(20),
  street1: z.string().min(1).max(160),
  street2: z.string().max(160).optional(),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  pincode: z.string().min(4).max(12),
  country: z.string().min(1).max(60).default("India"),
  landmark: z.string().max(120).optional(),
});

const PersonalizationSchema = z.object({
  recipientPhotoUrl: z.string().max(2048).optional(),
  calligraphyName: z.string().max(80).optional(),
  signature: z.string().max(80).optional(),
  occasionTag: z.string().max(60).optional(),
  voiceNoteUrl: z.string().max(2048).optional(),
});

const PurchaseBody = z.object({
  amount: z.number().int().min(GIFT_CARD_MIN).max(GIFT_CARD_MAX),
  currency: z.string().min(3).max(8).default("INR"),
  recipientName: z.string().max(120).optional().default(""),
  recipientEmail: z.string().email().max(160).optional().or(z.literal("")).default(""),
  senderName: z.string().max(120).optional().default(""),
  message: z.string().max(500).optional().default(""),
  purchaserName: z.string().max(120).optional().default(""),
  purchaserEmail: z.string().email().max(160),

  // Premium ─────
  format: z.enum(["digital", "physical"]).default("digital"),
  designId: z.string().min(1).max(80).default("classic-evergreen"),
  packagingId: z.string().min(1).max(80).default("digital"),
  personalization: PersonalizationSchema.optional(),
  deliveryAddress: DeliveryAddressSchema.optional(),
  scheduledDeliveryAt: z.string().datetime().optional(),

  payment: z.discriminatedUnion("method", [
    z.object({
      method: z.literal("razorpay"),
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
    }),
  ]),
});

router.post("/gift-cards/purchase", async (req: Request, res: Response) => {
  const parsed = PurchaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;

  // Validate design + packaging combo against the catalog.
  const design = getDesign(data.designId);
  if (!design) {
    res.status(400).json({ error: `Unknown design "${data.designId}"` });
    return;
  }
  const pkg = getPackaging(data.packagingId);
  if (!pkg) {
    res.status(400).json({ error: `Unknown packaging "${data.packagingId}"` });
    return;
  }
  if (data.format !== pkg.format) {
    res.status(400).json({
      error: `Packaging "${pkg.name}" is ${pkg.format}; cannot be sold as ${data.format}.`,
    });
    return;
  }
  if (data.format === "physical" && !data.deliveryAddress) {
    res.status(400).json({ error: "Delivery address is required for physical cards." });
    return;
  }
  // Capacity check for limited-edition festive runs.
  if (
    data.format === "physical" &&
    design.physicalSeasonCap != null &&
    design.seasonStart &&
    design.seasonEnd
  ) {
    const win = seasonWindow(design.seasonStart, design.seasonEnd, new Date());
    const [agg] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(giftCardsTable)
      .where(
        and(
          eq(giftCardsTable.designId, design.id),
          eq(giftCardsTable.format, "physical"),
          gte(giftCardsTable.createdAt, win.start),
          lt(giftCardsTable.createdAt, win.endExclusive),
        ),
      );
    if ((agg?.n ?? 0) >= design.physicalSeasonCap) {
      res.status(409).json({
        error: `Sold out — this season's run of ${design.physicalSeasonCap} cards has been claimed.`,
      });
      return;
    }
  }

  try {
    const settings = await getSettings();
    if (settings.activeProvider !== "razorpay") {
      res.status(400).json({ error: "Razorpay is not the active provider" });
      return;
    }
    const provider = getProvider("razorpay");
    if (!provider.isConfigured()) {
      res.status(503).json({ error: "Razorpay keys missing" });
      return;
    }
    const sigOk = await provider.verify({
      providerOrderId: data.payment.razorpay_order_id,
      providerPaymentId: data.payment.razorpay_payment_id,
      providerSignature: data.payment.razorpay_signature,
    });
    if (!sigOk) {
      logger.warn(
        { orderId: data.payment.razorpay_order_id, email: data.purchaserEmail },
        "razorpay signature mismatch — rejecting gift-card purchase",
      );
      res.status(400).json({ error: "Payment signature invalid" });
      return;
    }
    let fetched;
    try {
      fetched = await provider.fetchOrder(data.payment.razorpay_order_id);
    } catch (err) {
      logger.warn({ err }, "razorpay order fetch failed during gift-card purchase");
      res.status(502).json({ error: "Could not confirm payment with gateway." });
      return;
    }
    // Total = card amount + packaging fee. Customer paid in paise.
    const expectedPaise = (data.amount + pkg.fee) * 100;
    if (fetched.amountInPaise !== expectedPaise) {
      logger.warn(
        {
          orderId: data.payment.razorpay_order_id,
          paid: fetched.amountInPaise,
          requested: expectedPaise,
        },
        "razorpay amount mismatch — rejecting gift-card purchase",
      );
      res.status(400).json({ error: "Paid amount does not match card amount + packaging" });
      return;
    }

    const shopper = await getShopper(req);
    const code = await mintUniqueGiftCardCode();
    const physicalStatus = data.format === "physical" ? "pending" : "na";
    // Tier promotion + bonus credit on this first load.
    const { bonus, tierAfter } = computeLoadBonus({
      amount: data.amount,
      previousLifetimeLoaded: 0,
    });
    const initialBalance = data.amount + bonus;
    const [card] = await db
      .insert(giftCardsTable)
      .values({
        code,
        initialAmount: data.amount,
        balance: initialBalance,
        currency: data.currency,
        status: "active",
        purchaserUserId: shopper?.id ?? null,
        purchaserEmail: data.purchaserEmail,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        senderName: data.senderName || data.purchaserName,
        message: data.message,
        paymentRef: data.payment.razorpay_payment_id,
        expiresAt: defaultGiftCardExpiry(),
        format: data.format,
        designId: data.designId,
        packagingId: data.packagingId,
        packagingFee: pkg.fee,
        personalization: data.personalization ?? null,
        deliveryAddress: data.deliveryAddress ?? null,
        scheduledDeliveryAt: data.scheduledDeliveryAt
          ? new Date(data.scheduledDeliveryAt)
          : null,
        physicalStatus,
        tier: tierAfter,
        lifetimeLoaded: data.amount,
        bonusCredit: bonus,
        topupCount: 0,
      })
      .returning();

    // Backfill the human-readable serial now that we have the row id.
    const serial = formatSerial(card.id);
    const [stamped] = await db
      .update(giftCardsTable)
      .set({ serial })
      .where(eq(giftCardsTable.id, card.id))
      .returning();

    res.json({
      code: stamped.code,
      serial: stamped.serial,
      tier: stamped.tier,
      amount: stamped.initialAmount,
      bonusCredit: stamped.bonusCredit,
      balance: stamped.balance,
      currency: stamped.currency,
      expiresAt: stamped.expiresAt,
      recipientEmail: stamped.recipientEmail,
      format: stamped.format,
      designId: stamped.designId,
      packagingId: stamped.packagingId,
      packagingFee: stamped.packagingFee,
      physicalStatus: stamped.physicalStatus,
    });
  } catch (err) {
    logger.error({ err }, "gift-cards.purchase failed");
    res.status(500).json({ error: "Could not complete the purchase. Please contact support." });
  }
});

// ─── Top-up (recharge) ─────────────────────────────────────────────
//
// Reload an existing card. Anyone with the code can top up — gift cards
// are bearer instruments. Razorpay payment is verified server-side
// against amount * 100 (no packaging applies on a top-up). Tier may
// promote based on the new lifetime load value.

const TopupBody = z.object({
  code: z.string().min(4).max(40),
  amount: z.number().int().min(GIFT_CARD_MIN).max(GIFT_CARD_MAX),
  currency: z.string().min(3).max(8).default("INR"),
  payment: z.object({
    method: z.literal("razorpay"),
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
  }),
});

router.post("/gift-cards/topup", async (req: Request, res: Response) => {
  const parsed = TopupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const lookup = await lookupGiftCardByCode(data.code);
  if (!lookup.ok) {
    res.status(404).json({ error: `Card not eligible: ${lookup.reason}` });
    return;
  }
  const card = lookup.card;
  if (card.status !== "active") {
    res.status(400).json({ error: "Only active cards can be topped up." });
    return;
  }
  try {
    const settings = await getSettings();
    if (settings.activeProvider !== "razorpay") {
      res.status(400).json({ error: "Razorpay is not the active provider" });
      return;
    }
    const provider = getProvider("razorpay");
    if (!provider.isConfigured()) {
      res.status(503).json({ error: "Razorpay keys missing" });
      return;
    }
    const sigOk = await provider.verify({
      providerOrderId: data.payment.razorpay_order_id,
      providerPaymentId: data.payment.razorpay_payment_id,
      providerSignature: data.payment.razorpay_signature,
    });
    if (!sigOk) {
      logger.warn(
        { orderId: data.payment.razorpay_order_id, code: card.code },
        "razorpay signature mismatch — rejecting gift-card top-up",
      );
      res.status(400).json({ error: "Payment signature invalid" });
      return;
    }
    let fetched;
    try {
      fetched = await provider.fetchOrder(data.payment.razorpay_order_id);
    } catch (err) {
      logger.warn({ err }, "razorpay order fetch failed during gift-card top-up");
      res.status(502).json({ error: "Could not confirm payment with gateway." });
      return;
    }
    if (fetched.amountInPaise !== data.amount * 100) {
      logger.warn(
        {
          orderId: data.payment.razorpay_order_id,
          paid: fetched.amountInPaise,
          requested: data.amount * 100,
        },
        "razorpay amount mismatch — rejecting gift-card top-up",
      );
      res.status(400).json({ error: "Paid amount does not match top-up amount" });
      return;
    }

    const previousTier = card.tier;
    const { bonus, tierAfter } = computeLoadBonus({
      amount: data.amount,
      previousLifetimeLoaded: card.lifetimeLoaded ?? 0,
    });
    const promoted = previousTier !== tierAfter;
    // Only promote upward — never demote a card whose lifetime load is high
    // but whose tier was already at the top of the table.
    const finalTier = promoted ? tierAfter : previousTier;

    const [updated] = await db
      .update(giftCardsTable)
      .set({
        balance: sql`${giftCardsTable.balance} + ${data.amount + bonus}`,
        lifetimeLoaded: sql`${giftCardsTable.lifetimeLoaded} + ${data.amount}`,
        bonusCredit: sql`${giftCardsTable.bonusCredit} + ${bonus}`,
        topupCount: sql`${giftCardsTable.topupCount} + 1`,
        tier: finalTier,
        lastToppedUpAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(giftCardsTable.id, card.id))
      .returning();

    void recordActivity({
      kind: "gift_card_topped_up",
      title: `Card ${card.code} +₹${data.amount}${bonus ? ` (+₹${bonus} bonus)` : ""}`,
      summary: `Lifetime load ₹${updated.lifetimeLoaded} · Tier ${finalTier}`,
      entityType: "gift_card",
      entityId: card.id,
      payload: {
        amount: data.amount,
        bonus,
        tierBefore: previousTier,
        tierAfter: finalTier,
      },
    });
    if (promoted) {
      void recordActivity({
        kind: "gift_card_tier_promoted",
        title: `Card ${card.code} → ${finalTier}`,
        entityType: "gift_card",
        entityId: card.id,
        payload: { from: previousTier, to: finalTier },
      });
    }

    res.json({
      code: updated.code,
      serial: updated.serial,
      tier: updated.tier,
      tierPromoted: promoted,
      addedAmount: data.amount,
      bonusCredit: bonus,
      balance: updated.balance,
      lifetimeLoaded: updated.lifetimeLoaded,
      topupCount: updated.topupCount,
      currency: updated.currency,
      expiresAt: updated.expiresAt,
    });
  } catch (err) {
    logger.error({ err }, "gift-cards.topup failed");
    res.status(500).json({ error: "Could not complete the top-up. Please contact support." });
  }
});

// Helper: turn the design's season MM-DD start into an absolute Date in the
// current operating year (handles year-end wrap by stepping back a year).
function seasonStart(mmdd: string, now: Date): Date {
  const [m, d] = mmdd.split("-").map(Number);
  const year = now.getFullYear();
  let candidate = new Date(year, (m ?? 1) - 1, d ?? 1);
  // If today is BEFORE the candidate but the season is wrap-style, the season
  // actually started last year (e.g. Pongal: 12-15 → 01-31, today is 01-20).
  if (candidate.getTime() > now.getTime()) {
    candidate = new Date(year - 1, (m ?? 1) - 1, d ?? 1);
  }
  return candidate;
}

// Resolve the absolute [start, end) date range of the design's *current*
// season, given `now`. Handles three cases:
//   1. Same-year window (e.g. Diwali 09-15 → 11-15)
//   2. Wrap window, today within the trailing tail (e.g. Pongal 12-15 → 01-31, today is 01-20)
//   3. Wrap window, today within the leading head (today is 12-20)
// We bound the count by [start, endExclusive) so post-season purchases never
// inflate FOMO numbers and never block out-of-season sales of evergreens.
function seasonWindow(
  startMMDD: string,
  endMMDD: string,
  now: Date,
): { start: Date; endExclusive: Date } {
  const start = seasonStart(startMMDD, now);
  const [em, ed] = endMMDD.split("-").map(Number);
  // End is INCLUSIVE in product terms (e.g. "ends 11-15"), so we compute the
  // next-day midnight as the exclusive upper bound for the SQL query.
  let end = new Date(
    start.getFullYear(),
    (em ?? 1) - 1,
    (ed ?? 1) + 1, // +1 day → exclusive
  );
  // Wrap-style windows (start > end MM-DD) span a year boundary.
  if (startMMDD > endMMDD) {
    end = new Date(
      start.getFullYear() + 1,
      (em ?? 1) - 1,
      (ed ?? 1) + 1,
    );
  }
  return { start, endExclusive: end };
}

void normalizeGiftCardCode;
void giftCardRedemptionsTable;

export default router;
