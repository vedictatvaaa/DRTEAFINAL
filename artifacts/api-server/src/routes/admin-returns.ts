import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import {
  db,
  ordersTable,
  shipmentsTable,
  returnsTable,
  type ReturnStatus,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/returns", requireAdmin);

// Returns / RMA — separate from shipment status changes. A return row
// represents a customer-initiated request to send goods back, with its
// own state machine ending in refunded or rejected.

const ListQuery = z.object({
  status: z
    .enum(["requested", "approved", "in_transit", "received", "refunded", "rejected"])
    .optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

router.get("/admin/returns", async (req: Request, res: Response) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const filters: SQL[] = [];
  if (parsed.data.status) {
    filters.push(eq(returnsTable.status, parsed.data.status));
  }
  if (parsed.data.q) {
    const needle = `%${parsed.data.q}%`;
    filters.push(
      sql`(${ilike(ordersTable.customerEmail, needle)} OR cast(${returnsTable.orderId} as text) ilike ${needle})`,
    );
  }
  try {
    const rows = await db
      .select({
        ret: returnsTable,
        order: {
          id: ordersTable.id,
          customerName: ordersTable.customerName,
          customerEmail: ordersTable.customerEmail,
          total: ordersTable.total,
        },
      })
      .from(returnsTable)
      .leftJoin(ordersTable, eq(ordersTable.id, returnsTable.orderId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(returnsTable.createdAt))
      .limit(parsed.data.limit + 1)
      .offset(parsed.data.offset);
    const hasMore = rows.length > parsed.data.limit;
    const items = (hasMore ? rows.slice(0, parsed.data.limit) : rows).map(
      (r) => ({ ...r.ret, order: r.order }),
    );
    res.json({
      items,
      hasMore,
      nextOffset: hasMore ? parsed.data.offset + parsed.data.limit : null,
    });
  } catch (err) {
    logger.error({ err }, "returns.list.failed");
    res.status(500).json({ error: "Failed to list returns" });
  }
});

const CreateBody = z.object({
  orderId: z.number().int().positive(),
  reason: z.string().trim().min(2).max(500),
  notes: z.string().trim().max(2000).optional(),
  refundAmount: z.number().int().min(0).max(10_000_000).optional(),
});

router.post("/admin/returns", async (req: Request, res: Response) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
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
    const [ship] = await db
      .select()
      .from(shipmentsTable)
      .where(eq(shipmentsTable.orderId, order.id))
      .orderBy(desc(shipmentsTable.createdAt))
      .limit(1);
    // Default refund is 0 — admin must explicitly set the amount when
    // approving. Defaulting to order.total would silently issue a full
    // refund on partial returns.
    const [row] = await db
      .insert(returnsTable)
      .values({
        orderId: order.id,
        shipmentId: ship?.id ?? null,
        reason: parsed.data.reason,
        notes: parsed.data.notes ?? null,
        refundAmount: parsed.data.refundAmount ?? 0,
        status: "requested",
      })
      .returning();
    void recordActivity({
      kind: "return_created",
      actor: "admin",
      title: `Return requested for order #${order.id}`,
      summary: parsed.data.reason,
      entityType: "return",
      entityId: String(row.id),
    });
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "returns.create.failed");
    res.status(500).json({ error: "Failed to create return" });
  }
});

const PatchBody = z.object({
  status: z
    .enum(["requested", "approved", "in_transit", "received", "refunded", "rejected"])
    .optional(),
  notes: z.string().trim().max(2000).optional(),
  refundAmount: z.number().int().min(0).max(10_000_000).optional(),
  pickupAwb: z.string().trim().max(80).optional(),
});

// Allowed forward transitions. Terminal states (refunded, rejected) have
// no successors, so an admin must create a new return rather than reopen
// a closed one. Same-state PATCHes (e.g. just updating notes/refund) are
// always allowed because they're not transitions.
const ALLOWED_NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["in_transit", "rejected"],
  in_transit: ["received"],
  received: ["refunded"],
  refunded: [],
  rejected: [],
};

router.patch("/admin/returns/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = PatchBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    // Load the current row + order to validate transitions and refund cap.
    const [current] = await db
      .select({
        ret: returnsTable,
        orderTotal: ordersTable.total,
      })
      .from(returnsTable)
      .leftJoin(ordersTable, eq(ordersTable.id, returnsTable.orderId))
      .where(eq(returnsTable.id, id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const nextStatus = parsed.data.status;
    const currentStatus = current.ret.status;
    if (nextStatus && nextStatus !== currentStatus) {
      const allowed = ALLOWED_NEXT[currentStatus];
      if (!allowed.includes(nextStatus)) {
        res.status(409).json({
          error: `Invalid transition: ${currentStatus} → ${nextStatus}`,
        });
        return;
      }
    }

    // Determine the effective refund amount post-patch, so we can validate
    // it against the order total AND the refunded-state invariant.
    const effectiveRefund =
      parsed.data.refundAmount ?? current.ret.refundAmount;
    if (
      typeof current.orderTotal === "number" &&
      effectiveRefund > current.orderTotal
    ) {
      res.status(400).json({
        error: "Refund amount cannot exceed order total",
      });
      return;
    }
    if (nextStatus === "refunded" && effectiveRefund <= 0) {
      res.status(400).json({
        error: "Set a refund amount before marking as refunded",
      });
      return;
    }

    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    if (nextStatus) patch.status = nextStatus;
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
    if (parsed.data.refundAmount !== undefined)
      patch.refundAmount = parsed.data.refundAmount;
    if (parsed.data.pickupAwb !== undefined)
      patch.pickupAwb = parsed.data.pickupAwb;
    const [row] = await db
      .update(returnsTable)
      .set(patch)
      .where(eq(returnsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (nextStatus && nextStatus !== currentStatus) {
      void recordActivity({
        kind: "return_status_changed",
        actor: "admin",
        title: `Return #${id} → ${nextStatus}`,
        summary: parsed.data.notes ?? "",
        entityType: "return",
        entityId: String(id),
      });
    }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "returns.update.failed");
    res.status(500).json({ error: "Failed to update return" });
  }
});

export default router;
