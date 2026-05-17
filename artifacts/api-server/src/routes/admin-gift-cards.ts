import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  giftCardsTable,
  giftCardRedemptionsTable,
  type GiftCardStatus,
  type GiftCardPhysicalStatus,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import {
  GIFT_CARD_MIN,
  GIFT_CARD_MAX,
  defaultGiftCardExpiry,
  lookupGiftCardByCode,
  mintUniqueGiftCardCode,
  normalizeGiftCardCode,
} from "../lib/gift-cards";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/gift-cards", requireAdmin);

router.get("/admin/gift-cards/overview", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const [agg] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${giftCardsTable.status} = 'active' and ${giftCardsTable.expiresAt} > ${now})::int`,
        outstanding: sql<number>`coalesce(sum(${giftCardsTable.balance}) filter (where ${giftCardsTable.status} = 'active'), 0)::int`,
        issuedTotal: sql<number>`coalesce(sum(${giftCardsTable.initialAmount}), 0)::int`,
        redeemedTotal: sql<number>`coalesce(sum(${giftCardsTable.initialAmount} - ${giftCardsTable.balance}), 0)::int`,
        expiringSoon: sql<number>`count(*) filter (where ${giftCardsTable.status} = 'active' and ${giftCardsTable.balance} > 0 and ${giftCardsTable.expiresAt} between ${now} and ${new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)})::int`,
      })
      .from(giftCardsTable);

    const recent = await db
      .select()
      .from(giftCardsTable)
      .orderBy(desc(giftCardsTable.createdAt))
      .limit(10);

    res.json({
      stats: agg ?? {
        total: 0,
        active: 0,
        outstanding: 0,
        issuedTotal: 0,
        redeemedTotal: 0,
        expiringSoon: 0,
      },
      recent,
    });
  } catch (err) {
    logger.error({ err }, "admin.gift-cards.overview failed");
    res.status(500).json({ error: "Could not load gift card overview." });
  }
});

const ListQuery = z.object({
  status: z.enum(["active", "redeemed", "cancelled", "expired"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

router.get("/admin/gift-cards", async (req: Request, res: Response) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  try {
    const filters: SQL[] = [];
    if (parsed.data.status) {
      filters.push(eq(giftCardsTable.status, parsed.data.status));
    }
    if (parsed.data.q) {
      const needle = `%${parsed.data.q}%`;
      const cond = or(
        ilike(giftCardsTable.code, needle),
        ilike(giftCardsTable.purchaserEmail, needle),
        ilike(giftCardsTable.recipientEmail, needle),
      );
      if (cond) filters.push(cond);
    }
    const cards = await db
      .select()
      .from(giftCardsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(giftCardsTable.createdAt))
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);
    res.json({ cards });
  } catch (err) {
    logger.error({ err }, "admin.gift-cards.list failed");
    res.status(500).json({ error: "Could not load gift cards." });
  }
});

router.get("/admin/gift-cards/lookup", async (req: Request, res: Response) => {
  const code = String(req.query["code"] ?? "");
  const lookup = await lookupGiftCardByCode(code);
  if (!lookup.ok) {
    // For admin lookup, also surface cancelled/expired/depleted cards by
    // doing a second non-validating fetch so the operator can investigate.
    const normalized = normalizeGiftCardCode(code);
    const [raw] = normalized
      ? await db
          .select()
          .from(giftCardsTable)
          .where(eq(giftCardsTable.code, normalized))
          .limit(1)
      : [];
    if (!raw) {
      res.status(404).json({ ok: false, reason: lookup.reason });
      return;
    }
    res.json({ ok: false, reason: lookup.reason, card: raw });
    return;
  }
  res.json({ ok: true, card: lookup.card });
});

router.get("/admin/gift-cards/:id/redemptions", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(giftCardRedemptionsTable)
      .where(eq(giftCardRedemptionsTable.giftCardId, id))
      .orderBy(desc(giftCardRedemptionsTable.createdAt))
      .limit(100);
    res.json({ redemptions: rows });
  } catch (err) {
    logger.error({ err }, "admin.gift-cards.redemptions failed");
    res.status(500).json({ error: "Could not load redemptions." });
  }
});

const IssueBody = z.object({
  amount: z.number().int().min(GIFT_CARD_MIN).max(GIFT_CARD_MAX),
  recipientName: z.string().max(120).optional().default(""),
  recipientEmail: z
    .string()
    .email()
    .max(160)
    .optional()
    .or(z.literal(""))
    .default(""),
  senderName: z.string().max(120).optional().default("Dr Tea"),
  message: z.string().max(500).optional().default(""),
  reason: z.string().trim().min(1).max(280),
  expiresAt: z.string().datetime().optional(),
});

// Mint a complimentary card (no payment). Used for support credits, contest
// prizes, influencer gifts, etc. Always tagged with a reason for the audit log.
router.post("/admin/gift-cards/issue", async (req: Request, res: Response) => {
  const parsed = IssueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  try {
    const code = await mintUniqueGiftCardCode();
    const [card] = await db
      .insert(giftCardsTable)
      .values({
        code,
        initialAmount: data.amount,
        balance: data.amount,
        currency: "INR",
        status: "active",
        purchaserUserId: null,
        purchaserEmail: "",
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        senderName: data.senderName || "Dr Tea",
        message: data.message,
        paymentRef: `comp:${data.reason.slice(0, 80)}`,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : defaultGiftCardExpiry(),
      })
      .returning();

    void recordActivity({
      kind: "gift_card_issued",
      title: `Gift card issued: ${card.code} (₹${card.initialAmount})`,
      summary: `${data.reason}${data.recipientEmail ? ` → ${data.recipientEmail}` : ""}`,
      entityType: "gift_card",
      entityId: card.id,
      payload: { amount: card.initialAmount, reason: data.reason },
    });

    res.json({ card });
  } catch (err) {
    logger.error({ err }, "admin.gift-cards.issue failed");
    res.status(500).json({ error: "Could not issue gift card." });
  }
});

const CancelBody = z.object({
  reason: z.string().trim().min(1).max(280),
});

router.post("/admin/gift-cards/:id/cancel", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = CancelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Reason is required" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(giftCardsTable)
      .where(eq(giftCardsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Gift card not found" });
      return;
    }
    if (existing.status === "cancelled") {
      res.status(409).json({ error: "Already cancelled" });
      return;
    }
    if (existing.status === "redeemed") {
      res.status(409).json({ error: "Card is fully redeemed; nothing to cancel" });
      return;
    }
    const [updated] = await db
      .update(giftCardsTable)
      .set({
        status: "cancelled" as GiftCardStatus,
        updatedAt: sql`now()`,
      })
      .where(eq(giftCardsTable.id, id))
      .returning();

    void recordActivity({
      kind: "gift_card_cancelled",
      title: `Gift card cancelled: ${existing.code}`,
      summary: `${parsed.data.reason} — voided ₹${existing.balance} of ₹${existing.initialAmount}`,
      entityType: "gift_card",
      entityId: id,
      payload: { reason: parsed.data.reason, voidedBalance: existing.balance },
    });

    res.json({ card: updated });
  } catch (err) {
    logger.error({ err }, "admin.gift-cards.cancel failed");
    res.status(500).json({ error: "Could not cancel gift card." });
  }
});

const ExtendBody = z.object({
  expiresAt: z.string().datetime(),
});

router.post("/admin/gift-cards/:id/extend", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = ExtendBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid expiry" });
    return;
  }
  const newExpiry = new Date(parsed.data.expiresAt);
  if (newExpiry.getTime() <= Date.now()) {
    res.status(400).json({ error: "New expiry must be in the future" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(giftCardsTable)
      .where(eq(giftCardsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Gift card not found" });
      return;
    }
    if (existing.status === "cancelled" || existing.status === "redeemed") {
      res.status(409).json({ error: `Cannot extend a ${existing.status} card` });
      return;
    }
    const [updated] = await db
      .update(giftCardsTable)
      .set({
        expiresAt: newExpiry,
        // Re-activate if it had auto-expired
        status: "active" as GiftCardStatus,
        updatedAt: sql`now()`,
      })
      .where(eq(giftCardsTable.id, id))
      .returning();

    void recordActivity({
      kind: "gift_card_extended",
      title: `Gift card expiry extended: ${existing.code}`,
      summary: `New expiry ${newExpiry.toISOString().slice(0, 10)}`,
      entityType: "gift_card",
      entityId: id,
      payload: { newExpiry: newExpiry.toISOString() },
    });

    res.json({ card: updated });
  } catch (err) {
    logger.error({ err }, "admin.gift-cards.extend failed");
    res.status(500).json({ error: "Could not extend expiry." });
  }
});

// ─── Physical fulfilment queue ──────────────────────────────────────

const QueueQuery = z.object({
  status: z
    .enum(["pending", "printed", "shipped", "delivered", "all"])
    .optional()
    .default("pending"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

router.get("/admin/gift-cards/queue", async (req: Request, res: Response) => {
  const parsed = QueueQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  try {
    const filters: SQL[] = [eq(giftCardsTable.format, "physical")];
    if (parsed.data.status !== "all") {
      filters.push(eq(giftCardsTable.physicalStatus, parsed.data.status));
    } else {
      filters.push(ne(giftCardsTable.physicalStatus, "na"));
    }
    const rows = await db
      .select()
      .from(giftCardsTable)
      .where(and(...filters))
      .orderBy(desc(giftCardsTable.createdAt))
      .limit(parsed.data.limit);

    // Counts by status — tile across the top of the queue UI.
    const counts = await db
      .select({
        status: giftCardsTable.physicalStatus,
        n: sql<number>`count(*)::int`,
      })
      .from(giftCardsTable)
      .where(
        and(
          eq(giftCardsTable.format, "physical"),
          ne(giftCardsTable.physicalStatus, "na"),
        ),
      )
      .groupBy(giftCardsTable.physicalStatus);

    const byStatus: Record<string, number> = {
      pending: 0,
      printed: 0,
      shipped: 0,
      delivered: 0,
    };
    for (const row of counts) byStatus[row.status] = row.n;

    res.json({ cards: rows, counts: byStatus });
  } catch (err) {
    logger.error({ err }, "admin.gift-cards.queue failed");
    res.status(500).json({ error: "Could not load fulfilment queue." });
  }
});

const PhysicalUpdateBody = z.object({
  physicalStatus: z.enum(["pending", "printed", "shipped", "delivered"]),
  physicalCourier: z.string().max(80).optional(),
  physicalAwb: z.string().max(80).optional(),
  physicalTrackingUrl: z.string().url().max(2048).optional().or(z.literal("")),
  physicalNotes: z.string().max(500).optional(),
});

router.patch(
  "/admin/gift-cards/:id/physical",
  async (req: Request, res: Response) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = PhysicalUpdateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    try {
      const [existing] = await db
        .select()
        .from(giftCardsTable)
        .where(eq(giftCardsTable.id, id))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Gift card not found" });
        return;
      }
      if (existing.format !== "physical") {
        res.status(400).json({ error: "This card is digital — no physical fulfilment." });
        return;
      }
      const next = parsed.data;
      const [updated] = await db
        .update(giftCardsTable)
        .set({
          physicalStatus: next.physicalStatus as GiftCardPhysicalStatus,
          physicalCourier: next.physicalCourier ?? existing.physicalCourier,
          physicalAwb: next.physicalAwb ?? existing.physicalAwb,
          physicalTrackingUrl:
            next.physicalTrackingUrl !== undefined
              ? next.physicalTrackingUrl
              : existing.physicalTrackingUrl,
          physicalNotes: next.physicalNotes ?? existing.physicalNotes,
          updatedAt: sql`now()`,
        })
        .where(eq(giftCardsTable.id, id))
        .returning();

      void recordActivity({
        kind: "gift_card_physical_updated",
        title: `Gift card ${existing.code} → ${next.physicalStatus}`,
        summary: next.physicalAwb ? `AWB ${next.physicalAwb}` : undefined,
        entityType: "gift_card",
        entityId: id,
        payload: {
          status: next.physicalStatus,
          courier: next.physicalCourier ?? null,
          awb: next.physicalAwb ?? null,
        },
      });

      res.json({ card: updated });
    } catch (err) {
      logger.error({ err }, "admin.gift-cards.physical update failed");
      res.status(500).json({ error: "Could not update fulfilment status." });
    }
  },
);

void isNotNull;

export default router;
