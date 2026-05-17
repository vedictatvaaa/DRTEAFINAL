import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, subscriptionsTable, type ShopperUserRow } from "../lib/db";
import { logger } from "../lib/logger";
import { requireShopper } from "../lib/shopper-auth";
import {
  SUBSCRIPTION_FREQUENCIES_WEEKS,
  DEFAULT_SUBSCRIPTION_FREQUENCY_WEEKS,
  SUBSCRIPTION_DISCOUNT_PCT,
  addWeeks,
  isValidFrequencyWeeks,
} from "../lib/subscriptions";

const router: IRouter = Router();

router.get("/subscriptions/config", (_req: Request, res: Response) => {
  res.json({
    frequencies: SUBSCRIPTION_FREQUENCIES_WEEKS,
    defaultFrequencyWeeks: DEFAULT_SUBSCRIPTION_FREQUENCY_WEEKS,
    discountPct: SUBSCRIPTION_DISCOUNT_PCT,
  });
});

router.get(
  "/subscriptions/mine",
  requireShopper(),
  async (req: Request, res: Response) => {
    const user = (req as Request & { shopper?: ShopperUserRow }).shopper!;
    try {
      const rows = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.shopperUserId, user.id))
        .orderBy(desc(subscriptionsTable.createdAt));
      res.json({ subscriptions: rows });
    } catch (err) {
      logger.error({ err }, "subscriptions.mine failed");
      res.status(500).json({ error: "Could not load subscriptions." });
    }
  },
);

// Helper: load+authorize an action against the caller's subscription.
async function loadOwned(req: Request): Promise<
  | { ok: true; row: typeof subscriptionsTable.$inferSelect }
  | { ok: false; status: number; error: string }
> {
  const user = (req as Request & { shopper?: ShopperUserRow }).shopper;
  if (!user) return { ok: false, status: 401, error: "Sign in required" };
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) return { ok: false, status: 400, error: "Invalid id" };
  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.id, id),
        eq(subscriptionsTable.shopperUserId, user.id),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, status: 404, error: "Subscription not found" };
  return { ok: true, row };
}

router.post(
  "/subscriptions/:id/pause",
  requireShopper(),
  async (req: Request, res: Response) => {
    const r = await loadOwned(req);
    if (!r.ok) { res.status(r.status).json({ error: r.error }); return; }
    if (r.row.status === "cancelled") {
      res.status(409).json({ error: "Cancelled subscriptions cannot be paused." });
      return;
    }
    await db
      .update(subscriptionsTable)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, r.row.id));
    res.json({ ok: true });
  },
);

router.post(
  "/subscriptions/:id/resume",
  requireShopper(),
  async (req: Request, res: Response) => {
    const r = await loadOwned(req);
    if (!r.ok) { res.status(r.status).json({ error: r.error }); return; }
    if (r.row.status === "cancelled") {
      res.status(409).json({ error: "Cancelled subscriptions cannot be resumed." });
      return;
    }
    // If the next delivery slipped into the past while paused, push it
    // forward to today + frequency so we don't ship a backlog.
    const next =
      r.row.nextDeliveryAt.getTime() <= Date.now()
        ? addWeeks(new Date(), r.row.frequencyWeeks)
        : r.row.nextDeliveryAt;
    await db
      .update(subscriptionsTable)
      .set({ status: "active", nextDeliveryAt: next, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, r.row.id));
    res.json({ ok: true });
  },
);

router.post(
  "/subscriptions/:id/skip",
  requireShopper(),
  async (req: Request, res: Response) => {
    const r = await loadOwned(req);
    if (!r.ok) { res.status(r.status).json({ error: r.error }); return; }
    if (r.row.status !== "active") {
      res.status(409).json({ error: "Only active subscriptions can be skipped." });
      return;
    }
    const next = addWeeks(r.row.nextDeliveryAt, r.row.frequencyWeeks);
    await db
      .update(subscriptionsTable)
      .set({ nextDeliveryAt: next, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, r.row.id));
    res.json({ ok: true, nextDeliveryAt: next });
  },
);

router.post(
  "/subscriptions/:id/cancel",
  requireShopper(),
  async (req: Request, res: Response) => {
    const r = await loadOwned(req);
    if (!r.ok) { res.status(r.status).json({ error: r.error }); return; }
    if (r.row.status === "cancelled") { res.json({ ok: true }); return; }
    await db
      .update(subscriptionsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, r.row.id));
    res.json({ ok: true });
  },
);

const Patch = z.object({
  frequencyWeeks: z.number().int().refine(isValidFrequencyWeeks, "Unsupported frequency"),
});

router.patch(
  "/subscriptions/:id",
  requireShopper(),
  async (req: Request, res: Response) => {
    const r = await loadOwned(req);
    if (!r.ok) { res.status(r.status).json({ error: r.error }); return; }
    const parsed = Patch.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid frequency" });
      return;
    }
    if (r.row.status === "cancelled") {
      res.status(409).json({ error: "Cancelled subscriptions cannot be edited." });
      return;
    }
    // Recompute nextDeliveryAt from createdAt with the new cadence so the
    // shopper sees an immediate, sensible date instead of a stale one.
    const next = addWeeks(new Date(), parsed.data.frequencyWeeks);
    await db
      .update(subscriptionsTable)
      .set({
        frequencyWeeks: parsed.data.frequencyWeeks,
        nextDeliveryAt: next,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, r.row.id));
    res.json({ ok: true, nextDeliveryAt: next });
  },
);

export default router;
