// Shopper-facing order history + printable invoice.
//
// Routes (all behind requireShopper — match by case-insensitive email
// against orders.customer_email since orders carry email, not shopperId).
//   GET  /shopper/orders            → list my orders (newest first)
//   GET  /shopper/orders/:id        → single order with items + shipment
//   GET  /shopper/orders/:id/invoice → printable HTML (always customer variant)
//
// Ownership rule: an order is "mine" when its customer_email matches my
// authenticated shopper email (case-insensitive). This intentionally
// includes guest checkouts done with the same email, which is what users
// expect when they later create an account.

import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  shipmentsTable,
  type ShopperUserRow,
} from "../lib/db";
import { requireShopper } from "../lib/shopper-auth";
import { logger } from "../lib/logger";
import { loadBusiness, loadOrderBundle, renderInvoice } from "./admin-documents";

const router: IRouter = Router();
router.use("/shopper/orders", requireShopper());

function shopperEmail(req: Request): string {
  const u = (req as Request & { shopper?: ShopperUserRow }).shopper!;
  return u.email.toLowerCase();
}

router.get("/shopper/orders", async (req: Request, res: Response) => {
  try {
    const email = shopperEmail(req);
    const orders = await db
      .select()
      .from(ordersTable)
      .where(sql`lower(${ordersTable.customerEmail}) = ${email}`)
      .orderBy(desc(ordersTable.createdAt))
      .limit(50);
    if (orders.length === 0) {
      res.json({ orders: [] });
      return;
    }
    const ids = orders.map((o) => o.id);
    const items = await db
      .select()
      .from(orderItemsTable)
      .where(inArray(orderItemsTable.orderId, ids));
    const shipments = await db
      .select()
      .from(shipmentsTable)
      .where(inArray(shipmentsTable.orderId, ids));
    const itemsByOrder = new Map<number, typeof items>();
    for (const it of items) {
      const arr = itemsByOrder.get(it.orderId) ?? [];
      arr.push(it);
      itemsByOrder.set(it.orderId, arr);
    }
    const shipByOrder = new Map(shipments.map((s) => [s.orderId, s]));
    const enriched = orders.map((o) => ({
      ...o,
      items: itemsByOrder.get(o.id) ?? [],
      shipment: shipByOrder.get(o.id) ?? null,
    }));
    res.json({ orders: enriched });
  } catch (err) {
    logger.error({ err }, "shopper.orders.list failed");
    res.status(500).json({ error: "Could not load your orders." });
  }
});

router.get("/shopper/orders/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  try {
    const email = shopperEmail(req);
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);
    if (!order || order.customerEmail.toLowerCase() !== email) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const items = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, id));
    const [ship] = await db
      .select()
      .from(shipmentsTable)
      .where(eq(shipmentsTable.orderId, id))
      .limit(1);
    res.json({ order: { ...order, items, shipment: ship ?? null } });
  } catch (err) {
    logger.error({ err, id }, "shopper.orders.detail failed");
    res.status(500).json({ error: "Could not load order." });
  }
});

router.get(
  "/shopper/orders/:id/invoice",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).end("Invalid order id");
      return;
    }
    try {
      const email = shopperEmail(req);
      const bundle = await loadOrderBundle(id);
      if (!bundle || bundle.order.customerEmail.toLowerCase() !== email) {
        res.status(404).end("Order not found");
        return;
      }
      const business = await loadBusiness();
      const html = renderInvoice(bundle, business, "customer");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err) {
      logger.error({ err, id }, "shopper.orders.invoice failed");
      res.status(500).end("Could not render invoice.");
    }
  },
);

export default router;
