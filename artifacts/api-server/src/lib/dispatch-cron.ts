import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  dispatchSettingsTable,
  dispatchRunsTable,
  ordersTable,
  shipmentsTable,
} from "./db";
import { createShipment, getCourier } from "./courier";
import { recordActivity } from "./activity-log";
import { logger } from "./logger";

// Auto-dispatch worker. Loads the singleton settings row, finds eligible
// orders that haven't been shipped yet, and creates one shipment per
// order using the highest-priority courier within the weight cap.
//
// Records a dispatch_runs row for every invocation (cron or manual) so
// the admin UI can show a history with success / failure.

export interface AutoDispatchResult {
  runId: number;
  created: number;
  shipmentIds: number[];
  errorMessage: string | null;
}

const FALLBACK_PRIORITY = ["delhivery", "xpressbees", "bluedart"];

async function loadSettings() {
  const [row] = await db
    .select()
    .from(dispatchSettingsTable)
    .where(eq(dispatchSettingsTable.id, 1))
    .limit(1);
  return row ?? null;
}

export async function runAutoDispatch(
  trigger: "cron" | "manual" | "api",
): Promise<AutoDispatchResult> {
  const [run] = await db
    .insert(dispatchRunsTable)
    .values({ trigger, shipmentsCreated: 0 })
    .returning();
  const runId = run.id;
  const orderIds: number[] = [];
  const shipmentIds: number[] = [];

  try {
    const settings = await loadSettings();
    if (settings && !settings.enabled && trigger === "cron") {
      // Cron is gated; manual runs always proceed.
      await db
        .update(dispatchRunsTable)
        .set({ finishedAt: sql`now()`, errorMessage: "disabled" })
        .where(eq(dispatchRunsTable.id, runId));
      return { runId, created: 0, shipmentIds: [], errorMessage: "disabled" };
    }

    const priority =
      settings?.courierPriority?.length
        ? settings.courierPriority
        : FALLBACK_PRIORITY;
    const maxWeight = settings?.maxWeightGrams ?? 10_000;
    const onlyStatus = settings?.onlyOrderStatus ?? "paid";

    // Eligible orders = matching status, not yet shipped. We do this with
    // a left-join + isNull(manifestId) check on shipments.
    const orderQuery =
      onlyStatus === "any"
        ? db.select().from(ordersTable).limit(50)
        : db.select().from(ordersTable).where(eq(ordersTable.status, onlyStatus)).limit(50);
    const candidates = await orderQuery;

    // Filter out orders that already have a shipment row.
    const shippedRows = candidates.length
      ? await db
          .select({ orderId: shipmentsTable.orderId })
          .from(shipmentsTable)
          .where(
            sql`${shipmentsTable.orderId} IN (${sql.join(
              candidates.map((o) => sql`${o.id}`),
              sql`, `,
            )})`,
          )
      : [];
    const shippedSet = new Set(shippedRows.map((r) => r.orderId));

    const errors: string[] = [];
    for (const order of candidates) {
      if (shippedSet.has(order.id)) continue;
      const weight = 500;
      if (weight > maxWeight) continue;
      // Pick the first courier in priority order that we recognise.
      const courierCode = priority.find((c: string) => getCourier(c)) ?? "manual";
      try {
        const dispatch = await createShipment({
          order,
          courierCode,
          weightGrams: weight,
          declaredValue: order.total,
        });
        // Idempotent insert: the unique index on shipments.order_id makes
        // duplicate dispatches (race between cron + manual run) a no-op
        // returning zero rows rather than a second shipment.
        const inserted = await db
          .insert(shipmentsTable)
          .values({
            orderId: order.id,
            courierCode,
            awb: dispatch.awb,
            status: "manifested",
            weightGrams: weight,
            declaredValue: order.total,
            labelUrl: dispatch.labelUrl,
            trackingUrl: dispatch.trackingUrl,
            expectedDeliveryAt: dispatch.expectedDeliveryAt,
            shippedAt: new Date(),
            lastEventAt: new Date(),
          })
          .onConflictDoNothing({ target: shipmentsTable.orderId })
          .returning();
        if (!inserted.length) {
          // Another runner beat us to this order — skip silently.
          continue;
        }
        const row = inserted[0];
        orderIds.push(order.id);
        shipmentIds.push(row.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`order #${order.id}: ${msg}`);
        logger.warn({ err, orderId: order.id }, "dispatch.cron.order_failed");
      }
    }

    const errorMessage = errors.length ? errors.slice(0, 5).join("; ") : null;

    await db
      .update(dispatchRunsTable)
      .set({
        finishedAt: sql`now()`,
        shipmentsCreated: shipmentIds.length,
        errorMessage,
        details: { orderIds, shipmentIds },
      })
      .where(eq(dispatchRunsTable.id, runId));

    await db
      .update(dispatchSettingsTable)
      .set({
        lastRunAt: sql`now()`,
        lastRunCount: shipmentIds.length,
        lastRunError: errorMessage,
      })
      .where(eq(dispatchSettingsTable.id, 1));

    if (shipmentIds.length) {
      void recordActivity({
        kind: "shipment_created",
        actor: trigger === "cron" ? "system" : "admin",
        title: `Auto-dispatch (${trigger}) shipped ${shipmentIds.length} orders`,
        summary: errors.length
          ? `${shipmentIds.length} ok · ${errors.length} failed`
          : `IDs: ${shipmentIds.join(", ")}`,
        entityType: "shipment",
        entityId: null,
      });
    }

    return {
      runId,
      created: shipmentIds.length,
      shipmentIds,
      errorMessage,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "dispatch.cron.failed");
    await db
      .update(dispatchRunsTable)
      .set({ finishedAt: sql`now()`, errorMessage: msg })
      .where(eq(dispatchRunsTable.id, runId));
    return { runId, created: 0, shipmentIds: [], errorMessage: msg };
  }
}

// Cron loop. We sleep for 60s and consult the settings each tick so the
// admin can change the cadence at runtime without a server restart.
let timer: NodeJS.Timeout | null = null;
let lastTickAt = 0;

async function tick() {
  try {
    const settings = await loadSettings();
    if (!settings || !settings.enabled) return;
    const intervalMs = (settings.runEveryMinutes ?? 15) * 60_000;
    if (Date.now() - lastTickAt < intervalMs) return;
    lastTickAt = Date.now();
    await runAutoDispatch("cron");
  } catch (err) {
    logger.error({ err }, "dispatch.cron.tick_failed");
  }
}

export function startDispatchCron() {
  if (timer) return;
  // Kick first check after 30s so the server fully boots first.
  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), 60_000);
    timer.unref?.();
  }, 30_000);
  logger.info("Dispatch cron started (60s tick, gated by settings)");
}
