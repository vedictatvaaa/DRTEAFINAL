import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { inArray, eq, sql, and, ne } from "drizzle-orm";
import {
  db,
  productsTable,
  ordersTable,
  orderItemsTable,
  loyaltyAccountsTable,
  giftCardsTable,
  giftCardRedemptionsTable,
  subscriptionsTable,
  stockMovementsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { getProvider } from "../lib/payments";
import { getSettings } from "../lib/payments/settings";
import { getShopper } from "../lib/shopper-auth";
import {
  pointsEarnedForSpend,
  rupeesForPoints,
  maxRedeemablePoints,
  postLoyaltyEntry,
} from "../lib/loyalty";
import { lookupGiftCardByCode, normalizeGiftCardCode } from "../lib/gift-cards";
import {
  DEFAULT_SUBSCRIPTION_FREQUENCY_WEEKS,
  SUBSCRIPTION_DISCOUNT_PCT,
  subscriptionUnitPrice,
  defaultFirstDelivery,
} from "../lib/subscriptions";

const router: IRouter = Router();

const FREE_SHIPPING = 999;
const SHIPPING_FEE = 99;
const GIFT_WRAP_FEE = 49;
const COD_SURCHARGE = 40;
const PREPAID_DISCOUNT_PCT = 0.05;

/**
 * Promo codes accepted at checkout. Kept inline (no DB table yet) so the
 * abandoned-cart popup can hand out a single, well-known recovery code.
 */
const PROMO_CODES: Record<string, { type: "percent"; value: number }> = {
  COMEBACK5: { type: "percent", value: 0.05 },
};

const ItemSchema = z.object({
  productId: z.string().min(1),
  variantSize: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  subscription: z.boolean().optional().default(false),
});

const AddressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  region: z.string().max(100).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(3).default("IN"),
});

const PaymentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("cod") }),
  z.object({
    method: z.literal("razorpay"),
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
]);

const Body = z.object({
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().max(160),
  phone: z.string().min(7).max(20),
  currency: z.string().min(3).max(8).default("INR"),
  shippingAddress: AddressSchema,
  items: z.array(ItemSchema).min(1).max(50),
  giftWrap: z.boolean().optional().default(false),
  giftNote: z.string().max(200).optional().default(""),
  includeBrewCard: z.boolean().optional().default(true),
  deliveryMethod: z.enum(["doorstep", "office", "pickup"]).optional().default("doorstep"),
  discountCode: z.string().trim().toUpperCase().max(40).optional(),
  redeemPoints: z.number().int().min(0).max(1_000_000).optional().default(0),
  giftCardCode: z.string().trim().max(40).optional(),
  payment: PaymentSchema,
});

// Server-authoritative checkout: re-prices the cart from the DB, verifies the
// payment-provider signature when applicable, and only then inserts the
// order. The client cannot dictate price, payment status, or order state.
router.post("/checkout/place", async (req: Request, res: Response) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;

  // Resolve the signed-in shopper (optional — guest checkout still works).
  const shopper = await getShopper(req);
  // If the shopper requested a redemption, look up their balance up front so
  // we can clamp + reject before doing any payment work.
  let availableBalance = 0;
  if (shopper && data.redeemPoints > 0) {
    const [acct] = await db
      .select({ pointsBalance: loyaltyAccountsTable.pointsBalance })
      .from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.shopperUserId, shopper.id))
      .limit(1);
    availableBalance = acct?.pointsBalance ?? 0;
  }

  // Pre-flight gift card lookup. We re-lock + re-verify the row inside the
  // transaction below; this lookup just lets us include the discount in the
  // preview total used for the Razorpay amount-binding check.
  const normalizedGiftCode = data.giftCardCode
    ? normalizeGiftCardCode(data.giftCardCode)
    : null;
  let previewGiftBalance = 0;
  if (normalizedGiftCode) {
    const lookup = await lookupGiftCardByCode(normalizedGiftCode);
    if (!lookup.ok) {
      const reason =
        lookup.reason === "not_found"
          ? "Gift card not found."
          : lookup.reason === "expired"
            ? "This gift card has expired."
            : lookup.reason === "depleted"
              ? "This gift card has no balance left."
              : "This gift card is not redeemable.";
      res.status(400).json({ error: reason });
      return;
    }
    previewGiftBalance = lookup.card.balance;
  }

  // Pre-flight pricing — used to size the Razorpay verification check before
  // we open a transaction. The same re-pricing happens *inside* the
  // transaction below (with row locks) and is the value persisted on the order.
  const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
  const previewProducts = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
  const previewMap = new Map(previewProducts.map((p) => [p.id, p]));

  type PricedItem = {
    productId: string;
    productName: string;
    variantSize: string;
    quantity: number;
    unitPrice: number;
    subscription: boolean;
  };
  type Priced = {
    priced: PricedItem[];
    subtotal: number;
    shipping: number;
    giftWrapCost: number;
    prepaidDiscount: number;
    codSurcharge: number;
    codeDiscount: number;
    appliedCode: string | null;
    loyaltyDiscount: number;
    redeemPointsApplied: number;
    giftCardDiscount: number;
    total: number;
    error?: string;
    status?: number;
  };
  const empty = (error: string, status = 400): Priced => ({
    priced: [], subtotal: 0, shipping: 0, giftWrapCost: 0,
    prepaidDiscount: 0, codSurcharge: 0, codeDiscount: 0, appliedCode: null,
    loyaltyDiscount: 0, redeemPointsApplied: 0, giftCardDiscount: 0,
    total: 0, error, status,
  });
  function price(rowMap: Map<string, typeof previewProducts[number]>): Priced {
    const out: PricedItem[] = [];
    for (const it of data.items) {
      const p = rowMap.get(it.productId);
      if (!p) return empty(`Product ${it.productId} unavailable`);
      const variant = p.variants.find((v) => v.size === it.variantSize);
      if (!variant) return empty(`Variant ${it.variantSize} unavailable for ${p.name}`);
      if (variant.stock < it.quantity) return empty(`Only ${variant.stock} of ${p.name} (${variant.size}) left in stock`, 409);
      const unitPrice = subscriptionUnitPrice(variant.price, !!it.subscription);
      out.push({
        productId: p.id,
        productName: p.name,
        variantSize: variant.size,
        quantity: it.quantity,
        unitPrice,
        subscription: Boolean(it.subscription),
      });
    }
    const subtotal = out.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const shipping = subtotal >= FREE_SHIPPING ? 0 : SHIPPING_FEE;
    const giftWrapCost = data.giftWrap ? GIFT_WRAP_FEE : 0;
    const isPrepaid = data.payment.method === "razorpay";
    const prepaidDiscount = isPrepaid ? Math.round(subtotal * PREPAID_DISCOUNT_PCT) : 0;
    const codSurcharge = data.payment.method === "cod" ? COD_SURCHARGE : 0;
    let codeDiscount = 0;
    let appliedCode: string | null = null;
    if (data.discountCode) {
      const promo = PROMO_CODES[data.discountCode];
      if (promo && promo.type === "percent") {
        codeDiscount = Math.round(subtotal * promo.value);
        appliedCode = data.discountCode;
      }
    }
    // Loyalty redemption — clamped against available balance and the
    // configured % of subtotal cap. Always 0 for guests.
    const redeemPointsRequested = shopper ? data.redeemPoints : 0;
    const redeemPointsApplied = redeemPointsRequested
      ? Math.min(
          redeemPointsRequested,
          maxRedeemablePoints({ balance: availableBalance, subtotal }),
        )
      : 0;
    const loyaltyDiscount = rupeesForPoints(redeemPointsApplied);
    // Payable before gift card redemption — gift cards can wipe out the
    // remainder including shipping/fees. Clamp to the available balance.
    const payableBeforeGift = Math.max(
      0,
      subtotal + shipping + giftWrapCost + codSurcharge - prepaidDiscount - codeDiscount - loyaltyDiscount,
    );
    const giftCardDiscount = normalizedGiftCode
      ? Math.min(previewGiftBalance, payableBeforeGift)
      : 0;
    const total = Math.max(0, payableBeforeGift - giftCardDiscount);
    return {
      priced: out,
      subtotal,
      shipping,
      giftWrapCost,
      prepaidDiscount,
      codSurcharge,
      codeDiscount,
      appliedCode,
      loyaltyDiscount,
      redeemPointsApplied,
      giftCardDiscount,
      total,
    };
  }

  const preview = price(previewMap);
  if (preview.error) {
    res.status(preview.status ?? 400).json({ error: preview.error });
    return;
  }

  // Verify the payment BEFORE we open the transaction, so we don't lock rows
  // while we wait on the gateway. The amount is bound to the server total.
  const settings = await getSettings();
  if (data.payment.method === "cod") {
    if (!settings.codEnabled) {
      res.status(400).json({ error: "Cash on Delivery is currently disabled" });
      return;
    }
  } else {
    // razorpay
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
        { orderId: data.payment.razorpay_order_id, email: data.customerEmail },
        "razorpay signature mismatch — rejecting checkout",
      );
      res.status(400).json({ error: "Payment signature invalid" });
      return;
    }
    // Bind paid amount to server-calculated total. Without this, a client
    // could create a small Razorpay order, pay it, then submit the valid
    // signature for a much larger cart.
    let fetched;
    try {
      fetched = await provider.fetchOrder(data.payment.razorpay_order_id);
    } catch (err) {
      logger.warn({ err }, "razorpay order fetch failed during checkout");
      res.status(502).json({ error: "Could not confirm payment with gateway. Please retry." });
      return;
    }
    const expectedPaise = preview.total * 100;
    if (
      fetched.amountInPaise !== expectedPaise ||
      fetched.amountPaidInPaise < expectedPaise ||
      fetched.currency.toUpperCase() !== data.currency.toUpperCase() ||
      fetched.status !== "paid"
    ) {
      logger.warn(
        {
          orderId: data.payment.razorpay_order_id,
          expectedPaise,
          gateway: fetched,
        },
        "razorpay amount/currency/status mismatch — rejecting checkout",
      );
      res.status(400).json({ error: "Payment does not match cart total" });
      return;
    }
  }

  // Transactional persistence: row-lock the products, re-price + re-check
  // stock against locked rows, decrement stock, insert order + items.
  let result: { id: number; total: number; subtotal: number; shipping: number; giftWrapCost: number; prepaidDiscount: number; codSurcharge: number; codeDiscount: number; appliedCode: string | null; loyaltyDiscount: number; redeemPointsApplied: number; loyaltyPointsEarned: number; giftCardDiscount: number; giftCardCode: string | null; status: string };
  try {
    result = await db.transaction(async (tx) => {
      const lockedRows = await tx
        .select()
        .from(productsTable)
        .where(inArray(productsTable.id, productIds))
        .for("update");
      const lockedMap = new Map(lockedRows.map((p) => [p.id, p]));

      const finalPrice = price(lockedMap);
      if (finalPrice.error) {
        const e = new Error(finalPrice.error) as Error & { status?: number };
        e.status = finalPrice.status ?? 400;
        throw e;
      }
      const {
        priced,
        subtotal,
        shipping,
        giftWrapCost,
        prepaidDiscount,
        codSurcharge,
        codeDiscount,
        appliedCode,
        loyaltyDiscount,
        redeemPointsApplied,
        total,
      } = finalPrice;
      let { giftCardDiscount } = finalPrice;

      // Gift card: lock the row inside the transaction, re-verify status +
      // expiry + balance, then debit. Clamping is identical to the preview
      // logic so the locked card and total stay in sync.
      let lockedGiftCardId: number | null = null;
      if (normalizedGiftCode) {
        const [lockedCard] = await tx
          .select()
          .from(giftCardsTable)
          .where(eq(giftCardsTable.code, normalizedGiftCode))
          .for("update")
          .limit(1);
        if (
          !lockedCard ||
          lockedCard.status === "cancelled" ||
          lockedCard.balance <= 0 ||
          lockedCard.expiresAt.getTime() <= Date.now()
        ) {
          const e = new Error(
            "This gift card is no longer redeemable.",
          ) as Error & { status?: number };
          e.status = 409;
          throw e;
        }
        const payableBeforeGift = Math.max(
          0,
          subtotal + shipping + giftWrapCost + codSurcharge - prepaidDiscount - codeDiscount - loyaltyDiscount,
        );
        giftCardDiscount = Math.min(lockedCard.balance, payableBeforeGift);
        lockedGiftCardId = lockedCard.id;
      }
      const finalTotal = Math.max(
        0,
        subtotal + shipping + giftWrapCost + codSurcharge - prepaidDiscount - codeDiscount - loyaltyDiscount - giftCardDiscount,
      );

      // Loyalty: lock the account row and re-verify the balance. This
      // serialises concurrent checkouts for the same shopper so the same
      // points cannot be redeemed twice across two parallel orders.
      if (shopper && finalPrice.redeemPointsApplied > 0) {
        const [locked] = await tx
          .select({ pointsBalance: loyaltyAccountsTable.pointsBalance })
          .from(loyaltyAccountsTable)
          .where(eq(loyaltyAccountsTable.shopperUserId, shopper.id))
          .for("update")
          .limit(1);
        const lockedBalance = locked?.pointsBalance ?? 0;
        if (lockedBalance < finalPrice.redeemPointsApplied) {
          const e = new Error(
            "Your Tea Club balance changed — please refresh and try again.",
          ) as Error & { status?: number };
          e.status = 409;
          throw e;
        }
      }

      // Decrement stock per item (sum across duplicate cart lines first).
      const decrementsByProduct = new Map<string, Map<string, number>>();
      for (const i of priced) {
        let inner = decrementsByProduct.get(i.productId);
        if (!inner) { inner = new Map(); decrementsByProduct.set(i.productId, inner); }
        inner.set(i.variantSize, (inner.get(i.variantSize) ?? 0) + i.quantity);
      }
      const stockMovementsToLog: Array<{
        productId: string;
        variantSize: string;
        delta: number;
      }> = [];
      for (const [pid, sizeMap] of decrementsByProduct) {
        const row = lockedMap.get(pid)!;
        const nextVariants = row.variants.map((v) => {
          const dec = sizeMap.get(v.size) ?? 0;
          if (dec) {
            stockMovementsToLog.push({
              productId: pid,
              variantSize: v.size,
              delta: -dec,
            });
          }
          return dec ? { ...v, stock: v.stock - dec } : v;
        });
        await tx
          .update(productsTable)
          .set({ variants: nextVariants, updatedAt: sql`now()` })
          .where(eq(productsTable.id, pid));
      }

      // Treat zero-due orders (fully covered by gift card) as paid so they
      // don't get stuck in the COD queue. Razorpay verification still
      // happens above when the payment method is razorpay.
      const orderStatus =
        data.payment.method === "razorpay" || finalTotal === 0 ? "paid" : "pending";
      const loyaltyPointsEarned =
        orderStatus === "paid" && shopper ? pointsEarnedForSpend(subtotal) : 0;
      const meta = {
        paymentMethod: data.payment.method,
        paymentId: data.payment.method === "razorpay" ? data.payment.razorpay_payment_id : null,
        deliveryMethod: data.deliveryMethod,
        giftWrap: data.giftWrap,
        giftNote: data.giftNote || null,
        includeBrewCard: data.includeBrewCard,
        phone: data.phone,
        shipping,
        giftWrapCost,
        prepaidDiscount,
        codSurcharge,
        codeDiscount,
        appliedCode,
        loyaltyDiscount,
        redeemPointsApplied,
        loyaltyPointsEarned,
        giftCardDiscount,
        giftCardCode: normalizedGiftCode,
        subtotal,
        total: finalTotal,
      };
      const notesText = `[meta]${JSON.stringify(meta)}[/meta]${data.giftNote ? `\nGift note: ${data.giftNote}` : ""}`;

      const [order] = await tx
        .insert(ordersTable)
        .values({
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          shippingAddress: data.shippingAddress,
          currency: data.currency,
          subtotal,
          total: finalTotal,
          status: orderStatus,
          notes: notesText,
          shopperUserId: shopper?.id ?? null,
          loyaltyPointsEarned,
          loyaltyPointsRedeemed: redeemPointsApplied,
          loyaltyDiscount,
        })
        .returning();

      await tx.insert(orderItemsTable).values(
        priced.map((i) => ({
          orderId: order.id,
          productId: i.productId,
          productName: i.productName,
          variantSize: i.variantSize,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subscription: i.subscription,
        })),
      );

      // Gift card debit + redemption ledger entry (in the same tx so an
      // order failure rolls the balance change back).
      if (lockedGiftCardId !== null && giftCardDiscount > 0) {
        await tx
          .update(giftCardsTable)
          .set({
            balance: sql`${giftCardsTable.balance} - ${giftCardDiscount}`,
            status: sql`CASE WHEN ${giftCardsTable.balance} - ${giftCardDiscount} <= 0 THEN 'redeemed' ELSE ${giftCardsTable.status} END`,
            updatedAt: sql`now()`,
          })
          .where(eq(giftCardsTable.id, lockedGiftCardId));
        await tx.insert(giftCardRedemptionsTable).values({
          giftCardId: lockedGiftCardId,
          orderId: order.id,
          amount: giftCardDiscount,
        });
      }

      // Subscriptions: for each subscribed line item, create an active
      // subscription row for the signed-in shopper. Guests still get the 10%
      // discount on this order but no recurring tracking — they're nudged
      // to sign in via the checkout banner.
      if (shopper) {
        const firstDelivery = defaultFirstDelivery();
        for (const i of priced.filter((p) => p.subscription)) {
          // Dedupe: if there's already an active or paused subscription for
          // this shopper+product+variant, refresh it (push out next delivery,
          // re-snapshot price, reactivate) instead of inserting a duplicate
          // recurring delivery. Cancelled rows are left alone — a re-buy
          // creates a fresh subscription.
          const [existing] = await tx
            .select({ id: subscriptionsTable.id, frequencyWeeks: subscriptionsTable.frequencyWeeks })
            .from(subscriptionsTable)
            .where(
              and(
                eq(subscriptionsTable.shopperUserId, shopper.id),
                eq(subscriptionsTable.productId, i.productId),
                eq(subscriptionsTable.variantSize, i.variantSize),
                ne(subscriptionsTable.status, "cancelled"),
              ),
            )
            .limit(1);
          if (existing) {
            await tx
              .update(subscriptionsTable)
              .set({
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                currency: data.currency,
                status: "active",
                // Use the existing cadence so the shopper's preference sticks.
                nextDeliveryAt: defaultFirstDelivery(existing.frequencyWeeks),
                lastOrderId: order.id,
                updatedAt: new Date(),
              })
              .where(eq(subscriptionsTable.id, existing.id));
          } else {
            await tx.insert(subscriptionsTable).values({
              shopperUserId: shopper.id,
              productId: i.productId,
              productName: i.productName,
              variantSize: i.variantSize,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              currency: data.currency,
              frequencyWeeks: DEFAULT_SUBSCRIPTION_FREQUENCY_WEEKS,
              discountPct: SUBSCRIPTION_DISCOUNT_PCT,
              status: "active",
              nextDeliveryAt: firstDelivery,
              lastOrderId: order.id,
            });
          }
        }
      }

      // Loyalty: redeem first (so balance is debited), then earn on paid orders.
      if (shopper && redeemPointsApplied > 0) {
        await postLoyaltyEntry(tx, {
          shopperUserId: shopper.id,
          kind: "redeem",
          points: redeemPointsApplied,
          orderId: order.id,
          note: `Redeemed at checkout (\u20b9${loyaltyDiscount} off)`,
        });
      }
      // Audit-log every stock decrement against the new order so the
      // inventory movements page can trace each unit back to its sale.
      if (stockMovementsToLog.length > 0) {
        await tx.insert(stockMovementsTable).values(
          stockMovementsToLog.map((m) => ({
            productId: m.productId,
            variantSize: m.variantSize,
            delta: m.delta,
            kind: "sale" as const,
            reason: `Order #${order.id}`,
            refType: "order",
            refId: String(order.id),
            createdBy: "checkout",
          })),
        );
      }

      if (shopper && loyaltyPointsEarned > 0) {
        await postLoyaltyEntry(tx, {
          shopperUserId: shopper.id,
          kind: "earn",
          points: loyaltyPointsEarned,
          orderId: order.id,
          note: `Earned on order #${order.id}`,
          spendRupees: subtotal,
        });
      }

      return {
        id: order.id,
        total: finalTotal,
        subtotal,
        shipping,
        giftWrapCost,
        prepaidDiscount,
        codSurcharge,
        codeDiscount,
        appliedCode,
        loyaltyDiscount,
        redeemPointsApplied,
        loyaltyPointsEarned,
        giftCardDiscount,
        giftCardCode: normalizedGiftCode,
        status: order.status,
      };
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e?.status) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    logger.error({ err }, "checkout/place transaction failed");
    res.status(500).json({ error: "Could not place order. Please try again." });
    return;
  }

  res.json({
    id: result.id,
    status: result.status,
    subtotal: result.subtotal,
    shipping: result.shipping,
    giftWrapCost: result.giftWrapCost,
    prepaidDiscount: result.prepaidDiscount,
    codSurcharge: result.codSurcharge,
    codeDiscount: result.codeDiscount,
    appliedCode: result.appliedCode,
    total: result.total,
    currency: data.currency,
  });
});

export default router;
