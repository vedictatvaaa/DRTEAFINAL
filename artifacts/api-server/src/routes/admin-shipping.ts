import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";

// Minimal HTML escape — the label endpoint renders customer-supplied
// strings into a printable HTML page, so anything that lands in those
// fields (name, address) must be escaped to block stored XSS.
function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
import {
  db,
  ordersTable,
  orderItemsTable,
  shipmentsTable,
  shipmentEventsTable,
  shippingManifestsTable,
  type ShipmentStatus,
  type OrderRow,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  COURIERS,
  getCourier,
  quoteAllCouriers,
  createShipment,
  fetchTrackingAsync,
} from "../lib/courier";
import { isShiprocketConfigured, getHealth as getShiprocketHealth } from "../lib/shiprocket";
import { runAutoDispatch } from "../lib/dispatch-cron";
import {
  dispatchSettingsTable,
  dispatchRunsTable,
} from "../lib/db";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/shipping", requireAdmin);
router.use("/admin/shipments", requireAdmin);
router.use("/admin/manifests", requireAdmin);

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function defaultWeightForOrder(order: OrderRow): number {
  // Conservative baseline; a real catalogue would carry per-SKU weight.
  return 500;
}

// Estimate total parcel weight from order items. We don't carry per-SKU
// weight in the catalogue so we infer from the variant size token (e.g.
// "100g", "250g", "500g", "1kg") falling back to 100g per unit. This is
// what the courier pays on, so it must be sent honestly.
function estimateWeightFromItems(
  items: Array<{ variantSize: string; quantity: number }>,
): number {
  let total = 0;
  for (const it of items) {
    const m = String(it.variantSize ?? "").toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gms)/);
    let perUnit = 100;
    if (m) {
      const n = parseFloat(m[1]);
      const unit = m[2];
      perUnit = unit.startsWith("k") ? Math.round(n * 1000) : Math.round(n);
    }
    total += perUnit * Math.max(1, it.quantity);
  }
  // Add a 60g padding for tin/box + bubble wrap; clamp to courier limits.
  return Math.min(50_000, Math.max(50, total + 60));
}

// Build the SR-shaped item array from real order_items. Each line uses
// "<productId>-<variantSize>" as SKU (the SR dashboard groups by SKU).
function buildShiprocketItems(
  items: Array<{ productId: string; productName: string; variantSize: string; quantity: number; unitPrice: number }>,
): Array<{ name: string; sku: string; units: number; sellingPrice: number }> {
  return items.map((it) => ({
    name: `${it.productName} (${it.variantSize})`.slice(0, 90),
    sku: `${it.productId}-${it.variantSize}`.slice(0, 60),
    units: Math.max(1, it.quantity),
    sellingPrice: it.unitPrice,
  }));
}

async function logEvent(input: {
  shipmentId: number;
  kind: string;
  status?: ShipmentStatus | null;
  message: string;
  location?: string;
  source?: "admin" | "courier_webhook" | "system";
}) {
  try {
    await db.insert(shipmentEventsTable).values({
      shipmentId: input.shipmentId,
      kind: input.kind,
      status: input.status ?? null,
      message: input.message,
      location: input.location ?? null,
      source: input.source ?? "admin",
    });
    await db
      .update(shipmentsTable)
      .set({ lastEventAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(shipmentsTable.id, input.shipmentId));
  } catch (err) {
    logger.warn({ err }, "shipping.event.log_failed");
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Catalogue: list supported couriers + rate quotes
// ──────────────────────────────────────────────────────────────────────────

router.get("/admin/shipping/couriers", (_req, res: Response) => {
  res.json({ items: COURIERS });
});

const QuoteQuery = z.object({
  weightGrams: z.coerce.number().int().min(50).max(50_000).default(500),
  postalCode: z.string().min(3).max(12).default("000000"),
  declaredValue: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

router.get("/admin/shipping/quote", (req: Request, res: Response) => {
  const parsed = QuoteQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid quote query" });
    return;
  }
  res.json({
    quotes: quoteAllCouriers({
      weightGrams: parsed.data.weightGrams,
      destinationPostalCode: parsed.data.postalCode,
      declaredValue: parsed.data.declaredValue,
    }),
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Shipments — list / detail / create / tracking / actions
// ──────────────────────────────────────────────────────────────────────────

const ShipmentList = z.object({
  status: z
    .enum([
      "pending",
      "manifested",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "delayed",
      "undelivered",
      "returned",
      "lost",
    ])
    .optional(),
  courier: z.string().min(1).max(40).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  // Comma-separated list of order IDs — used by the unified Orders tab to
  // hydrate fulfilment state for the visible page without paginating
  // through the entire shipments backlog.
  orderIds: z
    .string()
    .max(2_000)
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const ids = v
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      return ids.length ? ids.slice(0, 500) : undefined;
    }),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

router.get("/admin/shipments", async (req: Request, res: Response) => {
  const parsed = ShipmentList.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const filters: SQL[] = [];
  if (parsed.data.status) {
    filters.push(eq(shipmentsTable.status, parsed.data.status));
  }
  if (parsed.data.courier) {
    filters.push(eq(shipmentsTable.courierCode, parsed.data.courier));
  }
  if (parsed.data.q) {
    const needle = `%${parsed.data.q}%`;
    filters.push(sql`(${ilike(shipmentsTable.awb, needle)} OR cast(${shipmentsTable.orderId} as text) ilike ${needle})`);
  }
  if (parsed.data.orderIds && parsed.data.orderIds.length) {
    const idList = sql.join(
      parsed.data.orderIds.map((id) => sql`${id}`),
      sql`, `,
    );
    filters.push(sql`${shipmentsTable.orderId} IN (${idList})`);
  }
  try {
    const rows = await db
      .select({
        shipment: shipmentsTable,
        order: {
          id: ordersTable.id,
          customerName: ordersTable.customerName,
          customerEmail: ordersTable.customerEmail,
          total: ordersTable.total,
          shippingAddress: ordersTable.shippingAddress,
        },
      })
      .from(shipmentsTable)
      .leftJoin(ordersTable, eq(ordersTable.id, shipmentsTable.orderId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(shipmentsTable.createdAt))
      .limit(parsed.data.limit + 1)
      .offset(parsed.data.offset);
    const hasMore = rows.length > parsed.data.limit;
    const items = (hasMore ? rows.slice(0, parsed.data.limit) : rows).map(
      (r) => ({ ...r.shipment, order: r.order }),
    );
    res.json({
      items,
      hasMore,
      nextOffset: hasMore ? parsed.data.offset + parsed.data.limit : null,
    });
  } catch (err) {
    logger.error({ err }, "shipping.list.failed");
    res.status(500).json({ error: "Failed to list shipments" });
  }
});

router.get("/admin/shipments/_stats", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        status: shipmentsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(shipmentsTable)
      .groupBy(shipmentsTable.status);
    const stats: Record<string, number> = {};
    for (const r of rows) stats[r.status] = r.count;
    res.json({ stats });
  } catch (err) {
    logger.error({ err }, "shipping.stats.failed");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/admin/shipments/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [shipment] = await db
      .select()
      .from(shipmentsTable)
      .where(eq(shipmentsTable.id, id))
      .limit(1);
    if (!shipment) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [orderRow] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, shipment.orderId))
      .limit(1);
    const events = await db
      .select()
      .from(shipmentEventsTable)
      .where(eq(shipmentEventsTable.shipmentId, id))
      .orderBy(desc(shipmentEventsTable.createdAt));
    res.json({ shipment, order: orderRow ?? null, events });
  } catch (err) {
    logger.error({ err }, "shipping.detail.failed");
    res.status(500).json({ error: "Failed to load shipment" });
  }
});

const CreateShipmentBody = z.object({
  orderId: z.number().int().positive(),
  courierCode: z.string().min(2).max(40),
  weightGrams: z.number().int().min(50).max(50_000).optional(),
  declaredValue: z.number().int().min(0).max(10_000_000).optional(),
});

router.post("/admin/shipments", async (req: Request, res: Response) => {
  const parsed = CreateShipmentBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  if (!getCourier(parsed.data.courierCode)) {
    res.status(400).json({ error: "Unknown courier" });
    return;
  }
  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, parsed.data.orderId))
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    // Pull real items so the courier (esp. Shiprocket) gets honest line
    // entries + an estimated weight rather than a single placeholder.
    const items = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));
    const inferredWeight = items.length
      ? estimateWeightFromItems(items)
      : defaultWeightForOrder(order);
    const weight = parsed.data.weightGrams ?? inferredWeight;
    const declared = parsed.data.declaredValue ?? order.total;
    const dispatch = await createShipment({
      order,
      courierCode: parsed.data.courierCode,
      weightGrams: weight,
      declaredValue: declared,
      items: items.length ? buildShiprocketItems(items) : undefined,
    });
    // Idempotent against the unique index on shipments.order_id: if the
    // order already has a shipment (manual race or auto-dispatch beat
    // us), we return 409 instead of silently creating duplicates.
    const inserted = await db
      .insert(shipmentsTable)
      .values({
        orderId: order.id,
        courierCode: parsed.data.courierCode,
        awb: dispatch.awb,
        status: "manifested",
        weightGrams: weight,
        declaredValue: declared,
        labelUrl: dispatch.labelUrl,
        trackingUrl: dispatch.trackingUrl,
        expectedDeliveryAt: dispatch.expectedDeliveryAt,
        shippedAt: new Date(),
        lastEventAt: new Date(),
      })
      .onConflictDoNothing({ target: shipmentsTable.orderId })
      .returning();
    if (!inserted.length) {
      res.status(409).json({ error: "Order already has a shipment" });
      return;
    }
    const row = inserted[0];
    await logEvent({
      shipmentId: row.id,
      kind: "status_changed",
      status: "manifested",
      message: `Shipment created via ${parsed.data.courierCode} (${dispatch.provider})`,
      source: "system",
    });
    void recordActivity({
      kind: "shipment_created",
      actor: "admin",
      title: `Shipment ${dispatch.awb} created for order #${order.id}`,
      summary: `Courier ${parsed.data.courierCode}, ${weight}g, ETA ${dispatch.expectedDeliveryAt.toISOString().slice(0, 10)}`,
      entityType: "shipment",
      entityId: String(row.id),
    });
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "shipping.create.failed");
    res.status(500).json({ error: "Failed to create shipment" });
  }
});

const StatusBody = z.object({
  status: z.enum([
    "pending",
    "manifested",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "delayed",
    "undelivered",
    "returned",
    "lost",
  ]),
  message: z.string().trim().max(500).optional(),
  location: z.string().trim().max(120).optional(),
});

router.patch(
  "/admin/shipments/:id/status",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = StatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const patch: Record<string, unknown> = {
        status: parsed.data.status,
        updatedAt: sql`now()`,
        lastEventAt: sql`now()`,
      };
      if (parsed.data.status === "delivered") patch.deliveredAt = new Date();
      const [row] = await db
        .update(shipmentsTable)
        .set(patch)
        .where(eq(shipmentsTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await logEvent({
        shipmentId: id,
        kind: "status_changed",
        status: parsed.data.status,
        message: parsed.data.message ?? `Status set to ${parsed.data.status}`,
        location: parsed.data.location,
      });
      const activityKind =
        parsed.data.status === "delivered"
          ? "shipment_delivered"
          : parsed.data.status === "returned"
            ? "shipment_returned"
            : parsed.data.status === "in_transit" ||
                parsed.data.status === "out_for_delivery"
              ? "shipment_dispatched"
              : "shipment_troubleshot";
      void recordActivity({
        kind: activityKind,
        actor: "admin",
        title: `Shipment ${row.awb ?? `#${id}`} → ${parsed.data.status}`,
        summary: parsed.data.message ?? "",
        entityType: "shipment",
        entityId: String(id),
      });
      res.json(row);
    } catch (err) {
      logger.error({ err }, "shipping.status.failed");
      res.status(500).json({ error: "Failed to update status" });
    }
  },
);

const ReassignBody = z.object({
  courierCode: z.string().min(2).max(40),
  reason: z.string().trim().max(500).default(""),
});

router.post(
  "/admin/shipments/:id/reassign",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const parsed = ReassignBody.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    if (!getCourier(parsed.data.courierCode)) {
      res.status(400).json({ error: "Unknown courier" });
      return;
    }
    try {
      const [existing] = await db
        .select()
        .from(shipmentsTable)
        .where(eq(shipmentsTable.id, id))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (existing.courierCode === parsed.data.courierCode) {
        res.status(400).json({ error: "Already on this courier" });
        return;
      }
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, existing.orderId))
        .limit(1);
      if (!order) {
        res.status(404).json({ error: "Order missing" });
        return;
      }
      const dispatch = await createShipment({
        order,
        courierCode: parsed.data.courierCode,
        weightGrams: existing.weightGrams,
        declaredValue: existing.declaredValue,
      });
      const [row] = await db
        .update(shipmentsTable)
        .set({
          courierCode: parsed.data.courierCode,
          awb: dispatch.awb,
          labelUrl: dispatch.labelUrl,
          trackingUrl: dispatch.trackingUrl,
          expectedDeliveryAt: dispatch.expectedDeliveryAt,
          status: "manifested",
          manifestId: null,
          reassignReason: parsed.data.reason,
          reassignedFromCourier: existing.courierCode,
          updatedAt: sql`now()`,
          lastEventAt: sql`now()`,
        })
        .where(eq(shipmentsTable.id, id))
        .returning();
      await logEvent({
        shipmentId: id,
        kind: "status_changed",
        status: "manifested",
        message: `Re-assigned ${existing.courierCode} → ${parsed.data.courierCode}. ${parsed.data.reason}`.trim(),
        source: "system",
      });
      void recordActivity({
        kind: "shipment_reassigned",
        actor: "admin",
        title: `Shipment #${id} reassigned to ${parsed.data.courierCode}`,
        summary: parsed.data.reason || `From ${existing.courierCode}`,
        entityType: "shipment",
        entityId: String(id),
      });
      res.json(row);
    } catch (err) {
      logger.error({ err }, "shipping.reassign.failed");
      res.status(500).json({ error: "Failed to reassign courier" });
    }
  },
);

const TroubleshootBody = z.object({
  issue: z.enum(["delayed", "undelivered", "lost"]),
  notes: z.string().trim().min(1).max(2000),
});

router.post(
  "/admin/shipments/:id/troubleshoot",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const parsed = TroubleshootBody.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    try {
      const [row] = await db
        .update(shipmentsTable)
        .set({
          status: parsed.data.issue,
          notes: parsed.data.notes,
          updatedAt: sql`now()`,
          lastEventAt: sql`now()`,
        })
        .where(eq(shipmentsTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await logEvent({
        shipmentId: id,
        kind: "troubleshoot",
        status: parsed.data.issue,
        message: parsed.data.notes,
      });
      void recordActivity({
        kind: "shipment_troubleshot",
        actor: "admin",
        title: `Shipment ${row.awb ?? `#${id}`} flagged ${parsed.data.issue}`,
        summary: parsed.data.notes.slice(0, 200),
        entityType: "shipment",
        entityId: String(id),
      });
      res.json(row);
    } catch (err) {
      logger.error({ err }, "shipping.troubleshoot.failed");
      res.status(500).json({ error: "Failed to flag shipment" });
    }
  },
);

// Refresh tracking from the (mock) courier and append any new events.
router.post(
  "/admin/shipments/:id/refresh-tracking",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const [row] = await db
        .select()
        .from(shipmentsTable)
        .where(eq(shipmentsTable.id, id))
        .limit(1);
      if (!row || !row.awb) {
        res.status(404).json({ error: "Shipment not dispatched yet" });
        return;
      }
      const courier = getCourier(row.courierCode);
      const events = await fetchTrackingAsync(row.awb, courier?.hub ?? "Hub");
      for (const e of events) {
        await db.insert(shipmentEventsTable).values({
          shipmentId: id,
          kind: "tracking_update",
          status: e.status,
          message: e.message,
          location: e.location,
          source: "courier_webhook",
        });
      }
      await db
        .update(shipmentsTable)
        .set({ lastEventAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(shipmentsTable.id, id));
      res.json({ ok: true, fetched: events.length });
    } catch (err) {
      logger.error({ err }, "shipping.tracking.failed");
      res.status(500).json({ error: "Failed to refresh tracking" });
    }
  },
);

// Shiprocket health — surface configured / token age / last call so the
// admin can confirm the integration is wired without leaking creds.
router.get(
  "/admin/shipping/shiprocket/status",
  (_req: Request, res: Response) => {
    const h = getShiprocketHealth();
    res.json({
      configured: h.configured,
      tokenRefreshedAt: h.tokenRefreshedAt
        ? new Date(h.tokenRefreshedAt).toISOString()
        : null,
      tokenExpiresAt: h.tokenExpiresAt
        ? new Date(h.tokenExpiresAt).toISOString()
        : null,
      lastSuccessAt: h.lastSuccessAt
        ? new Date(h.lastSuccessAt).toISOString()
        : null,
      lastFailureAt: h.lastFailureAt
        ? new Date(h.lastFailureAt).toISOString()
        : null,
      lastFailureMessage: h.lastFailureMessage,
      totalCalls: h.totalCalls,
      totalFailures: h.totalFailures,
    });
  },
);

// Manually trigger auto-dispatch (delegates to dispatch-cron so cron and
// manual runs share identical logic + run history).
router.post(
  "/admin/shipments/auto-dispatch",
  async (_req: Request, res: Response) => {
    try {
      const result = await runAutoDispatch("manual");
      res.json(result);
    } catch (err) {
      logger.error({ err }, "shipping.autodispatch.failed");
      res.status(500).json({ error: "Auto-dispatch failed" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Dispatch settings (singleton row id=1) + run history
// ──────────────────────────────────────────────────────────────────────────

router.get(
  "/admin/shipping/dispatch-settings",
  async (_req: Request, res: Response) => {
    try {
      let [row] = await db
        .select()
        .from(dispatchSettingsTable)
        .where(eq(dispatchSettingsTable.id, 1))
        .limit(1);
      if (!row) {
        [row] = await db
          .insert(dispatchSettingsTable)
          .values({ id: 1 })
          .returning();
      }
      res.json({
        settings: row,
        shiprocketConfigured: isShiprocketConfigured(),
      });
    } catch (err) {
      logger.error({ err }, "shipping.settings.get_failed");
      res.status(500).json({ error: "Failed to load settings" });
    }
  },
);

const DispatchSettingsBody = z.object({
  enabled: z.boolean().optional(),
  courierPriority: z.array(z.string().min(2).max(40)).max(10).optional(),
  maxWeightGrams: z.number().int().min(50).max(50_000).optional(),
  onlyOrderStatus: z.enum(["paid", "pending", "any"]).optional(),
  runEveryMinutes: z.number().int().min(5).max(720).optional(),
});

router.patch(
  "/admin/shipping/dispatch-settings",
  async (req: Request, res: Response) => {
    const parsed = DispatchSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      // Validate every courier code in priority list is known.
      if (parsed.data.courierPriority) {
        for (const c of parsed.data.courierPriority) {
          if (!getCourier(c)) {
            res.status(400).json({ error: `Unknown courier: ${c}` });
            return;
          }
        }
      }
      const patch: Record<string, unknown> = { updatedAt: sql`now()` };
      if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
      if (parsed.data.courierPriority)
        patch.courierPriority = parsed.data.courierPriority;
      if (parsed.data.maxWeightGrams !== undefined)
        patch.maxWeightGrams = parsed.data.maxWeightGrams;
      if (parsed.data.onlyOrderStatus)
        patch.onlyOrderStatus = parsed.data.onlyOrderStatus;
      if (parsed.data.runEveryMinutes !== undefined)
        patch.runEveryMinutes = parsed.data.runEveryMinutes;
      // Upsert in case the singleton wasn't created yet.
      const existing = await db
        .select({ id: dispatchSettingsTable.id })
        .from(dispatchSettingsTable)
        .where(eq(dispatchSettingsTable.id, 1))
        .limit(1);
      if (existing.length) {
        const [row] = await db
          .update(dispatchSettingsTable)
          .set(patch)
          .where(eq(dispatchSettingsTable.id, 1))
          .returning();
        res.json(row);
      } else {
        const [row] = await db
          .insert(dispatchSettingsTable)
          .values({ id: 1, ...patch })
          .returning();
        res.json(row);
      }
    } catch (err) {
      logger.error({ err }, "shipping.settings.update_failed");
      res.status(500).json({ error: "Failed to update settings" });
    }
  },
);

router.get(
  "/admin/shipping/dispatch-runs",
  async (_req: Request, res: Response) => {
    try {
      const items = await db
        .select()
        .from(dispatchRunsTable)
        .orderBy(desc(dispatchRunsTable.startedAt))
        .limit(50);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, "shipping.runs.list_failed");
      res.status(500).json({ error: "Failed to list runs" });
    }
  },
);

// Stub label endpoint — returns a minimal printable HTML "label" so the
// admin can preview/print without a real provider PDF.
router.get(
  "/admin/shipments/label/:awb",
  async (req: Request, res: Response) => {
    const awb = String(req.params.awb ?? "").replace(/\.pdf$/, "");
    if (!awb) {
      res.status(400).send("Missing AWB");
      return;
    }
    const [row] = await db
      .select()
      .from(shipmentsTable)
      .where(eq(shipmentsTable.awb, awb))
      .limit(1);
    if (!row) {
      res.status(404).send("Unknown AWB");
      return;
    }
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, row.orderId))
      .limit(1);
    const a = order?.shippingAddress;
    res
      .type("html")
      .send(`<!doctype html><html><head><meta charset="utf-8"><title>Label ${escapeHtml(awb)}</title>
<style>body{font-family:ui-monospace,monospace;padding:24px;color:#1a2416}
.box{border:2px solid #1a2416;padding:18px;max-width:420px}
.h{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#666}
.awb{font-size:22px;font-weight:700;letter-spacing:2px;margin:6px 0 14px}
.row{margin:6px 0}.b{font-weight:600}</style></head>
<body><div class="box">
<div class="h">Dr Tea · Shipping label</div>
<div class="awb">${escapeHtml(awb)}</div>
<div class="h">Courier</div><div class="row b">${escapeHtml(row.courierCode.toUpperCase())}</div>
<div class="h" style="margin-top:10px">Recipient</div>
<div class="row">${escapeHtml(order?.customerName)}</div>
<div class="row">${escapeHtml(a?.line1)}${a?.line2 ? "<br/>" + escapeHtml(a.line2) : ""}</div>
<div class="row">${escapeHtml(a?.city)}${a?.region ? ", " + escapeHtml(a.region) : ""} ${escapeHtml(a?.postalCode)}</div>
<div class="row">${escapeHtml(a?.country)}</div>
<div class="h" style="margin-top:10px">Weight / Value</div>
<div class="row">${row.weightGrams} g · ₹${row.declaredValue}</div>
</div></body></html>`);
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Manifests — group dispatched shipments by courier, close to print pickup.
// ──────────────────────────────────────────────────────────────────────────

router.get("/admin/manifests", async (_req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(shippingManifestsTable)
      .orderBy(desc(shippingManifestsTable.createdAt))
      .limit(100);
    res.json({ items });
  } catch (err) {
    logger.error({ err }, "shipping.manifests.list_failed");
    res.status(500).json({ error: "Failed to list manifests" });
  }
});

const ManifestBody = z.object({
  courierCode: z.string().min(2).max(40),
  shipmentIds: z.array(z.number().int().positive()).min(1).max(500),
});

router.post("/admin/manifests", async (req: Request, res: Response) => {
  const parsed = ManifestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  if (!getCourier(parsed.data.courierCode)) {
    res.status(400).json({ error: "Unknown courier" });
    return;
  }
  try {
    // Block double-manifesting: a shipment already attached to a manifest
    // (open or closed) must be detached first, otherwise the physical
    // courier audit trail diverges from our records.
    const idList = sql.join(
      parsed.data.shipmentIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const conflicts = await db
      .select({ id: shipmentsTable.id, manifestId: shipmentsTable.manifestId })
      .from(shipmentsTable)
      .where(
        and(
          sql`${shipmentsTable.id} IN (${idList})`,
          sql`${shipmentsTable.manifestId} IS NOT NULL`,
        ),
      );
    if (conflicts.length) {
      res.status(409).json({
        error: "Some shipments already belong to a manifest",
        conflicts,
      });
      return;
    }
    const [manifest] = await db
      .insert(shippingManifestsTable)
      .values({
        courierCode: parsed.data.courierCode,
        status: "open",
        shipmentCount: parsed.data.shipmentIds.length,
      })
      .returning();
    const updated = await db
      .update(shipmentsTable)
      .set({ manifestId: manifest.id, updatedAt: sql`now()` })
      .where(
        and(
          eq(shipmentsTable.courierCode, parsed.data.courierCode),
          isNull(shipmentsTable.manifestId),
          sql`${shipmentsTable.id} IN (${idList})`,
        ),
      )
      .returning({ id: shipmentsTable.id });
    res.status(201).json({ ...manifest, attached: updated.length });
  } catch (err) {
    logger.error({ err }, "shipping.manifest.create_failed");
    res.status(500).json({ error: "Failed to create manifest" });
  }
});

router.post(
  "/admin/manifests/:id/close",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const [row] = await db
        .update(shippingManifestsTable)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(shippingManifestsTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      void recordActivity({
        kind: "manifest_closed",
        actor: "admin",
        title: `Manifest #${id} closed (${row.courierCode})`,
        summary: `${row.shipmentCount} shipments`,
        entityType: "manifest",
        entityId: String(id),
      });
      res.json(row);
    } catch (err) {
      logger.error({ err }, "shipping.manifest.close_failed");
      res.status(500).json({ error: "Failed to close manifest" });
    }
  },
);

router.get("/admin/manifests/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [manifest] = await db
      .select()
      .from(shippingManifestsTable)
      .where(eq(shippingManifestsTable.id, id))
      .limit(1);
    if (!manifest) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const shipments = await db
      .select()
      .from(shipmentsTable)
      .where(eq(shipmentsTable.manifestId, id));
    res.json({ manifest, shipments });
  } catch (err) {
    logger.error({ err }, "shipping.manifest.detail_failed");
    res.status(500).json({ error: "Failed to load manifest" });
  }
});

export default router;
