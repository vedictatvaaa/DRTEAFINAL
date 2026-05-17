import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { AdminUpdateOrderStatusBody } from "@workspace/api-zod";
import { sendEmail } from "../lib/email";
import { renderOrderStatus } from "../lib/email-templates";
import { logger } from "../lib/logger";
import { recordActivity } from "../lib/activity-log";
import { recordStockChange } from "../lib/inventory";

const STATUS_EMAIL_KIND: Record<string, "order_packed" | "order_shipped" | "order_delivered" | "order_refunded" | null> = {
  packed: "order_packed",
  shipped: "order_shipped",
  delivered: "order_delivered",
  refunded: "order_refunded",
};

const router: IRouter = Router();

router.use("/admin/orders", requireAdmin);

async function hydrateOrder(orderRow: typeof ordersTable.$inferSelect) {
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderRow.id));
  return { ...orderRow, items };
}

router.get("/admin/orders", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt));
  const out = await Promise.all(rows.map(hydrateOrder));
  res.json(out);
});

router.get("/admin/orders/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(await hydrateOrder(row));
});

router.patch("/admin/orders/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AdminUpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  // Capture the prior status BEFORE the update so we only send a lifecycle
  // email when it actually changes (avoids duplicate notes from idempotent PATCHes).
  const [prior] = await db.select({ status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, id));
  const [row] = await db
    .update(ordersTable)
    .set({
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const hydrated = await hydrateOrder(row);

  // Restock when an order is cancelled or refunded so the units don't
  // permanently leak from inventory. Only restock when the prior status
  // had decremented stock (paid/pending/packed/shipped) — we don't double
  // restock on idempotent PATCHes or already-cancelled orders.
  const becameClosed =
    parsed.data.status === "cancelled" &&
    prior?.status !== "cancelled";
  if (becameClosed) {
    try {
      for (const item of hydrated.items) {
        if (!item.productId || !item.variantSize || !item.quantity) continue;
        await recordStockChange({
          productId: item.productId,
          variantSize: item.variantSize,
          delta: item.quantity,
          kind: "return",
          reason: `Order #${id} ${parsed.data.status}`,
          refType: "order",
          refId: String(id),
          createdBy: "admin",
        });
      }
    } catch (err) {
      logger.warn({ err, orderId: id }, "order.cancel.restock_failed");
    }
  }

  // Audit feed — only log when the status actually changed.
  if (!prior || prior.status !== parsed.data.status) {
    void recordActivity({
      kind: "order_status_changed",
      actor: "admin",
      title: `Order #${id}: ${prior?.status ?? "unknown"} → ${parsed.data.status}`,
      summary: parsed.data.notes ?? "",
      entityType: "order",
      entityId: id,
      payload: { from: prior?.status ?? null, to: parsed.data.status },
    });
  }

  // Lifecycle email — fire-and-forget when the new status changes from prior.
  const statusChanged = !prior || prior.status !== parsed.data.status;
  const kind = STATUS_EMAIL_KIND[parsed.data.status];
  if (statusChanged && kind && row.customerEmail) {
    const tpl = renderOrderStatus(hydrated, parsed.data.status as "packed" | "shipped" | "delivered" | "refunded");
    void sendEmail({
      to: row.customerEmail,
      subject: tpl.subject,
      html: tpl.html,
      kind,
      orderId: row.id,
    }).catch((err) => logger.error({ err, orderId: row.id }, "Order status email failed"));
  }

  res.json(hydrated);
});

export default router;
