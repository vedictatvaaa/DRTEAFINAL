import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, shipmentsTable, shipmentEventsTable } from "../lib/db";
import { mapShiprocketStatus } from "../lib/shiprocket";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

// Terminal shipment states — once we record one of these, later
// webhook hits cannot regress the row. Protects against SR replaying
// stale "in_transit" events after a delivery confirmation.
const TERMINAL_STATES = new Set(["delivered", "returned", "lost"]);

// Warn-once when a public webhook hit lands without SHIPROCKET_WEBHOOK_TOKEN
// configured, so operators notice an unauthenticated receiver.
let warnedOpenWebhook = false;

// Shiprocket webhook receiver. Configure in the SR dashboard:
//   URL:    https://<your-domain>/api/webhooks/shiprocket
//   Token:  set SHIPROCKET_WEBHOOK_TOKEN and pass via the
//           "x-api-key" header (SR's standard webhook auth header).
//
// Payload shape (lightly trimmed — SR sends additional fields we ignore):
//   {
//     awb: "1234567890",
//     current_status: "Out For Delivery",
//     current_status_id: 17,
//     scans: [{ date, activity, location, status }],
//     etd: "2026-05-13T18:00:00",
//     order_id: "DRTEA-42"
//   }
//
// Strategy: lookup shipment by AWB, append event(s), normalise the
// SR status string to our enum, update the row idempotently.

const router: IRouter = Router();

router.post("/webhooks/shiprocket", async (req: Request, res: Response) => {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (expected) {
    // Accept either x-api-key (SR's documented header) or
    // Authorization: Bearer <token> for compatibility.
    const xKey = String(req.header("x-api-key") ?? "");
    const auth = String(req.header("authorization") ?? "");
    const bearer = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
    if (xKey !== expected && bearer !== expected) {
      logger.warn({ ip: req.ip }, "shiprocket.webhook.unauthorized");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } else if (!warnedOpenWebhook) {
    warnedOpenWebhook = true;
    logger.warn(
      "Shiprocket webhook is publicly accessible — set SHIPROCKET_WEBHOOK_TOKEN to require x-api-key (or Bearer) auth.",
    );
  }
  try {
    const body = req.body as {
      awb?: string | number;
      current_status?: string;
      etd?: string;
      scans?: Array<{
        date?: string;
        activity?: string;
        location?: string;
        status?: string;
      }>;
    };
    const awb = body.awb != null ? String(body.awb) : "";
    if (!awb) {
      res.status(400).json({ error: "Missing awb" });
      return;
    }
    const [shipment] = await db
      .select()
      .from(shipmentsTable)
      .where(eq(shipmentsTable.awb, awb))
      .limit(1);
    if (!shipment) {
      // 200 instead of 404 — SR retries non-2xx aggressively. We log
      // and accept so a stale AWB doesn't trigger retry storms.
      logger.warn({ awb }, "shiprocket.webhook.unknown_awb");
      res.json({ ok: true, ignored: "unknown_awb" });
      return;
    }
    const newStatus = mapShiprocketStatus(body.current_status);
    const scans = Array.isArray(body.scans) ? body.scans : [];

    // Dedup against recent webhook events for this shipment so SR
    // replays don't bloat shipment_events. We pull the last 200 events
    // (covers any reasonable replay window) and skip inserts that match
    // an existing (message, location) tuple — that pair is what SR
    // varies per real scan, so it's a safe fingerprint.
    const recent = scans.length
      ? await db
          .select({
            message: shipmentEventsTable.message,
            location: shipmentEventsTable.location,
          })
          .from(shipmentEventsTable)
          .where(
            and(
              eq(shipmentEventsTable.shipmentId, shipment.id),
              eq(shipmentEventsTable.source, "courier_webhook"),
            ),
          )
          .orderBy(desc(shipmentEventsTable.createdAt))
          .limit(200)
      : [];
    const seen = new Set(
      recent.map((r) => `${r.message ?? ""}|${r.location ?? ""}`),
    );
    let inserted = 0;
    for (const s of scans) {
      const message = String(s.activity ?? s.status ?? "Tracking update").slice(0, 480);
      const location = s.location ? String(s.location).slice(0, 120) : null;
      const key = `${message}|${location ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        await db.insert(shipmentEventsTable).values({
          shipmentId: shipment.id,
          kind: "tracking_update",
          status: mapShiprocketStatus(s.status) ?? newStatus ?? null,
          message,
          location,
          source: "courier_webhook",
        });
        inserted += 1;
      } catch (err) {
        logger.warn({ err, awb }, "shiprocket.webhook.event_insert_failed");
      }
    }
    // If we couldn't extract any scans but have a current_status, log
    // one synthetic event so the audit trail still captures the ping.
    if (!scans.length && body.current_status) {
      await db.insert(shipmentEventsTable).values({
        shipmentId: shipment.id,
        kind: "tracking_update",
        status: newStatus ?? null,
        message: String(body.current_status).slice(0, 480),
        source: "courier_webhook",
      });
    }
    // Update shipment row — only flip status if the mapping succeeded
    // and the new status is "newer" (we don't undo a delivered shipment).
    const patch: Record<string, unknown> = {
      lastEventAt: sql`now()`,
      updatedAt: sql`now()`,
    };
    // Terminal states (delivered/returned/lost) are sticky — never
    // regress them via a late-arriving webhook scan.
    if (newStatus && !TERMINAL_STATES.has(shipment.status)) {
      patch.status = newStatus;
      if (newStatus === "delivered") patch.deliveredAt = new Date();
    }
    if (body.etd) {
      const d = new Date(body.etd);
      if (!Number.isNaN(d.getTime())) patch.expectedDeliveryAt = d;
    }
    await db
      .update(shipmentsTable)
      .set(patch)
      .where(eq(shipmentsTable.id, shipment.id));

    // Activity feed — only when the status actually changed, so we
    // don't spam the feed with every poll. Delivered/returned are the
    // milestones operators want to see live.
    if (
      newStatus &&
      newStatus !== shipment.status &&
      (newStatus === "delivered" ||
        newStatus === "returned" ||
        newStatus === "out_for_delivery")
    ) {
      void recordActivity({
        kind:
          newStatus === "delivered"
            ? "shipment_delivered"
            : newStatus === "returned"
              ? "shipment_returned"
              : "shipment_dispatched",
        actor: "system",
        title: `Shiprocket: ${awb} → ${newStatus}`,
        summary: body.current_status ?? "",
        entityType: "shipment",
        entityId: String(shipment.id),
      });
    }
    res.json({
      ok: true,
      awb,
      mapped: newStatus ?? null,
      scansReceived: scans.length,
      scansInserted: inserted,
    });
  } catch (err) {
    logger.error({ err }, "shiprocket.webhook.failed");
    // Still return 200 to avoid SR retry storms on persistent bugs;
    // failures are visible in the logs and the admin's Shiprocket pane.
    res.json({ ok: false, error: "internal" });
  }
});

export default router;
