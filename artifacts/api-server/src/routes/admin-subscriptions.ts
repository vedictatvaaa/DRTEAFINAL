import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  shopperUsersTable,
  type SubscriptionStatus,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { addWeeks, isValidFrequencyWeeks } from "../lib/subscriptions";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(["/admin/subscriptions"], requireAdmin);

// ─── Overview ──────────────────────────────────────────────────────────────

router.get(
  "/admin/subscriptions/overview",
  async (_req: Request, res: Response) => {
    try {
      // Aggregate counts and recurring revenue by status. unitPrice is paise,
      // discountPct is percent, frequencyWeeks drives MRR normalisation
      // (52 / freq deliveries per year, /12 to monthly).
      const rows = await db
        .select({
          id: subscriptionsTable.id,
          status: subscriptionsTable.status,
          unitPrice: subscriptionsTable.unitPrice,
          quantity: subscriptionsTable.quantity,
          discountPct: subscriptionsTable.discountPct,
          frequencyWeeks: subscriptionsTable.frequencyWeeks,
          nextDeliveryAt: subscriptionsTable.nextDeliveryAt,
        })
        .from(subscriptionsTable);
      const counts = { active: 0, paused: 0, cancelled: 0 };
      let mrrPaise = 0;
      let dueThisWeek = 0;
      let dueOverdue = 0;
      const now = Date.now();
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      for (const r of rows) {
        counts[r.status as SubscriptionStatus] =
          (counts[r.status as SubscriptionStatus] ?? 0) + 1;
        if (r.status === "active") {
          const linePaise =
            r.unitPrice * r.quantity * (1 - r.discountPct / 100);
          // Convert per-delivery → monthly.
          const deliveriesPerYear = 52 / r.frequencyWeeks;
          mrrPaise += (linePaise * deliveriesPerYear) / 12;
          const dueAt = r.nextDeliveryAt.getTime();
          if (dueAt < now) dueOverdue += 1;
          else if (dueAt - now < oneWeekMs) dueThisWeek += 1;
        }
      }
      res.json({
        counts,
        mrrPaise: Math.round(mrrPaise),
        dueThisWeek,
        dueOverdue,
        total: rows.length,
      });
    } catch (err) {
      logger.error({ err }, "subs.overview.failed");
      res.status(500).json({ error: "Failed to load overview" });
    }
  },
);

// ─── List ──────────────────────────────────────────────────────────────────

router.get(
  "/admin/subscriptions",
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const where = status && ["active", "paused", "cancelled"].includes(status)
        ? eq(subscriptionsTable.status, status as SubscriptionStatus)
        : undefined;
      const items = await db
        .select({
          id: subscriptionsTable.id,
          shopperUserId: subscriptionsTable.shopperUserId,
          shopperEmail: shopperUsersTable.email,
          shopperName: shopperUsersTable.name,
          productId: subscriptionsTable.productId,
          productName: subscriptionsTable.productName,
          variantSize: subscriptionsTable.variantSize,
          quantity: subscriptionsTable.quantity,
          unitPrice: subscriptionsTable.unitPrice,
          discountPct: subscriptionsTable.discountPct,
          frequencyWeeks: subscriptionsTable.frequencyWeeks,
          status: subscriptionsTable.status,
          nextDeliveryAt: subscriptionsTable.nextDeliveryAt,
          lastOrderId: subscriptionsTable.lastOrderId,
          createdAt: subscriptionsTable.createdAt,
          updatedAt: subscriptionsTable.updatedAt,
        })
        .from(subscriptionsTable)
        .leftJoin(
          shopperUsersTable,
          eq(shopperUsersTable.id, subscriptionsTable.shopperUserId),
        )
        .where(where as ReturnType<typeof eq>)
        .orderBy(desc(subscriptionsTable.updatedAt))
        .limit(limit);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, "subs.list.failed");
      res.status(500).json({ error: "Failed to list subscriptions" });
    }
  },
);

// ─── Per-id actions ────────────────────────────────────────────────────────

async function loadSub(id: number) {
  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, id))
    .limit(1);
  return row ?? null;
}

router.post(
  "/admin/subscriptions/:id/pause",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const row = await loadSub(id);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (row.status === "cancelled") {
      res.status(409).json({ error: "Cancelled subscriptions can't be paused" });
      return;
    }
    await db
      .update(subscriptionsTable)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, id));
    res.json({ ok: true });
  },
);

router.post(
  "/admin/subscriptions/:id/resume",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const row = await loadSub(id);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (row.status === "cancelled") {
      res.status(409).json({ error: "Cancelled subscriptions can't be resumed" });
      return;
    }
    const next =
      row.nextDeliveryAt.getTime() <= Date.now()
        ? addWeeks(new Date(), row.frequencyWeeks)
        : row.nextDeliveryAt;
    await db
      .update(subscriptionsTable)
      .set({ status: "active", nextDeliveryAt: next, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, id));
    res.json({ ok: true, nextDeliveryAt: next });
  },
);

router.post(
  "/admin/subscriptions/:id/skip",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const row = await loadSub(id);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (row.status !== "active") {
      res.status(409).json({ error: "Only active subscriptions can be skipped" });
      return;
    }
    const next = addWeeks(row.nextDeliveryAt, row.frequencyWeeks);
    await db
      .update(subscriptionsTable)
      .set({ nextDeliveryAt: next, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, id));
    res.json({ ok: true, nextDeliveryAt: next });
  },
);

router.post(
  "/admin/subscriptions/:id/cancel",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db
      .update(subscriptionsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, id));
    res.json({ ok: true });
  },
);

const PatchBody = z.object({
  frequencyWeeks: z
    .number()
    .int()
    .refine(isValidFrequencyWeeks, "Unsupported frequency")
    .optional(),
  quantity: z.number().int().min(1).max(50).optional(),
  nextDeliveryAt: z.string().datetime().optional(),
});

router.patch(
  "/admin/subscriptions/:id",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    const row = await loadSub(id);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (row.status === "cancelled") {
      res.status(409).json({ error: "Cancelled subscriptions can't be edited" });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.frequencyWeeks !== undefined) {
      patch.frequencyWeeks = parsed.data.frequencyWeeks;
      // Reset cadence baseline so the shopper's next delivery date is sensible.
      patch.nextDeliveryAt = addWeeks(new Date(), parsed.data.frequencyWeeks);
    }
    if (parsed.data.quantity !== undefined) patch.quantity = parsed.data.quantity;
    if (parsed.data.nextDeliveryAt !== undefined) {
      patch.nextDeliveryAt = new Date(parsed.data.nextDeliveryAt);
    }
    await db
      .update(subscriptionsTable)
      .set(patch)
      .where(eq(subscriptionsTable.id, id));
    res.json({ ok: true });
  },
);

// ─── Bulk: mark all due as in-flight (placeholder for fulfilment cron) ────

router.post(
  "/admin/subscriptions/run-due",
  async (_req: Request, res: Response) => {
    try {
      // Lightweight "advance" job: for every active subscription whose
      // nextDeliveryAt is in the past, push it forward by one cadence so
      // it lands in tomorrow's queue. Real order creation will be wired
      // when the fulfilment worker is built — this endpoint exists so
      // admins can manually nudge the schedule today.
      const now = new Date();
      const due = await db
        .select({
          id: subscriptionsTable.id,
          frequencyWeeks: subscriptionsTable.frequencyWeeks,
          nextDeliveryAt: subscriptionsTable.nextDeliveryAt,
        })
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.status, "active"),
            sql`${subscriptionsTable.nextDeliveryAt} <= ${now}`,
          ),
        );
      let advanced = 0;
      for (const r of due) {
        await db
          .update(subscriptionsTable)
          .set({
            nextDeliveryAt: addWeeks(now, r.frequencyWeeks),
            updatedAt: now,
          })
          .where(eq(subscriptionsTable.id, r.id));
        advanced += 1;
      }
      res.json({ advanced, total: due.length });
    } catch (err) {
      logger.error({ err }, "subs.run-due.failed");
      res.status(500).json({ error: "Failed to advance" });
    }
  },
);

export default router;
