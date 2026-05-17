// Public + admin endpoints for the witty popup-nudge feature.
// Public GET returns the runtime config the frontend trigger engine needs.
// Admin GET/PATCH lets the seller toggle the feature, pick tones/triggers,
// tune thresholds, and manage custom messages.

import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  nudgeSettingsTable,
  type NudgeSettingsRow,
  type NudgeTone,
  type NudgeTrigger,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALL_TONES: NudgeTone[] = [
  "witty",
  "sarcastic",
  "romcom",
  "inspirational",
  "hilarious",
];
const ALL_TRIGGERS: NudgeTrigger[] = [
  "idle_browse",
  "exit_intent",
  "product_dwell",
  "many_products",
  "cart_idle",
  "return_visit",
];

async function ensureSingleton(): Promise<NudgeSettingsRow> {
  const [row] = await db
    .select()
    .from(nudgeSettingsTable)
    .where(eq(nudgeSettingsTable.id, 1))
    .limit(1);
  if (row) return row;
  const [created] = await db
    .insert(nudgeSettingsTable)
    .values({ id: 1 })
    .returning();
  return created!;
}

// Shape the public payload — admin-only fields stripped.
function publicShape(row: NudgeSettingsRow) {
  return {
    enabled: row.enabled,
    tones: row.tones.length ? row.tones : ALL_TONES,
    triggers: row.triggers.length ? row.triggers : ALL_TRIGGERS,
    thresholds: {
      idleSeconds: row.idleSeconds,
      productDwellSeconds: row.productDwellSeconds,
      manyProductsThreshold: row.manyProductsThreshold,
      cartIdleSeconds: row.cartIdleSeconds,
      maxPerSession: row.maxPerSession,
      cooldownSeconds: row.cooldownSeconds,
    },
    customMessages: row.customMessages,
  };
}

// ── Public ──────────────────────────────────────────────────────────────────
router.get("/nudges/settings", async (_req, res: Response) => {
  try {
    const row = await ensureSingleton();
    res.set("Cache-Control", "public, max-age=60");
    res.json(publicShape(row));
  } catch (err) {
    logger.error({ err }, "nudges.public_get_failed");
    // Fail-open: return disabled so the page still works.
    res.json({
      enabled: false,
      tones: ALL_TONES,
      triggers: ALL_TRIGGERS,
      thresholds: {
        idleSeconds: 45,
        productDwellSeconds: 25,
        manyProductsThreshold: 4,
        cartIdleSeconds: 40,
        maxPerSession: 2,
        cooldownSeconds: 90,
      },
      customMessages: [],
    });
  }
});

// Lightweight telemetry — frontend pings when a nudge is shown or clicked.
//
// Abuse hardening: public endpoint, no auth. To avoid being an unauthenticated
// write-amplification sink into admin_activity_log, we:
//   1) Rate-limit per IP via an in-memory token bucket (≤ 12 events / minute).
//   2) Aggregate "shown" events in memory and only flush an hourly summary to
//      admin_activity_log — individual impressions don't write a row.
//   3) Record "converted" events (rare, valuable) directly.
const TelemetryBody = z.object({
  kind: z.enum(["shown", "converted"]),
  tone: z.enum(ALL_TONES as [NudgeTone, ...NudgeTone[]]),
  trigger: z.enum(ALL_TRIGGERS as [NudgeTrigger, ...NudgeTrigger[]]),
  messageId: z.string().max(120).optional(),
});

type Bucket = { tokens: number; refilledAt: number };
const RATE_BUCKETS = new Map<string, Bucket>();
const RATE_MAX = 12; // events per minute per IP
const RATE_WINDOW_MS = 60_000;
function rateAllow(ip: string): boolean {
  const now = Date.now();
  const b = RATE_BUCKETS.get(ip);
  if (!b) {
    RATE_BUCKETS.set(ip, { tokens: RATE_MAX - 1, refilledAt: now });
    return true;
  }
  // Lazy refill.
  const elapsed = now - b.refilledAt;
  if (elapsed >= RATE_WINDOW_MS) {
    b.tokens = RATE_MAX;
    b.refilledAt = now;
  }
  if (b.tokens <= 0) return false;
  b.tokens -= 1;
  return true;
}
// Periodic eviction so the map can't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 5;
  for (const [ip, b] of RATE_BUCKETS) {
    if (b.refilledAt < cutoff) RATE_BUCKETS.delete(ip);
  }
}, RATE_WINDOW_MS * 5).unref?.();

// In-memory rolling impression counters; flushed hourly.
type ImpKey = string; // `${tone}|${trigger}`
const IMPRESSIONS = new Map<ImpKey, number>();
let lastFlushAt = Date.now();
const FLUSH_INTERVAL_MS = 60 * 60 * 1000;
async function maybeFlushImpressions() {
  if (Date.now() - lastFlushAt < FLUSH_INTERVAL_MS) return;
  if (IMPRESSIONS.size === 0) {
    lastFlushAt = Date.now();
    return;
  }
  const snapshot: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of IMPRESSIONS) {
    snapshot[k] = v;
    total += v;
  }
  IMPRESSIONS.clear();
  lastFlushAt = Date.now();
  try {
    await recordActivity({
      kind: "nudge_shown",
      actor: "system",
      title: "Nudges shown (hourly)",
      summary: `${total} impressions across ${Object.keys(snapshot).length} variants`,
      payload: { breakdown: snapshot, total },
    });
  } catch (err) {
    logger.error({ err }, "nudges.flush_failed");
  }
}

router.post("/nudges/telemetry", async (req, res: Response) => {
  const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
  if (!rateAllow(ip)) {
    // Silently accept to avoid leaking the limit, but do no work.
    res.json({ ok: true });
    return;
  }
  const parsed = TelemetryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const { kind, tone, trigger, messageId } = parsed.data;
  try {
    if (kind === "shown") {
      const k = `${tone}|${trigger}`;
      IMPRESSIONS.set(k, (IMPRESSIONS.get(k) ?? 0) + 1);
      void maybeFlushImpressions();
    } else {
      await recordActivity({
        kind: "nudge_converted",
        actor: "system",
        title: "Nudge converted",
        summary: `${tone} · ${trigger}`,
        payload: { tone, trigger, messageId: messageId ?? null },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "nudges.telemetry_failed");
    res.status(500).json({ error: "Failed" });
  }
});

// ── Admin ───────────────────────────────────────────────────────────────────
router.use("/admin/nudges", requireAdmin);

router.get("/admin/nudges/settings", async (_req, res: Response) => {
  try {
    const row = await ensureSingleton();
    res.json({ settings: row });
  } catch (err) {
    logger.error({ err }, "nudges.admin_get_failed");
    res.status(500).json({ error: "Failed to load nudge settings" });
  }
});

const ToneEnum = z.enum(ALL_TONES as [NudgeTone, ...NudgeTone[]]);
const TriggerEnum = z.enum(ALL_TRIGGERS as [NudgeTrigger, ...NudgeTrigger[]]);
const CustomMsg = z.object({
  id: z.string().min(1).max(64).optional(),
  tone: ToneEnum,
  trigger: TriggerEnum,
  text: z.string().trim().min(3).max(240),
  cta: z.string().trim().max(40).optional(),
});

const PatchBody = z
  .object({
    enabled: z.boolean().optional(),
    tones: z.array(ToneEnum).max(ALL_TONES.length).optional(),
    triggers: z.array(TriggerEnum).max(ALL_TRIGGERS.length).optional(),
    idleSeconds: z.number().int().min(5).max(600).optional(),
    productDwellSeconds: z.number().int().min(5).max(600).optional(),
    manyProductsThreshold: z.number().int().min(1).max(50).optional(),
    cartIdleSeconds: z.number().int().min(5).max(600).optional(),
    maxPerSession: z.number().int().min(1).max(10).optional(),
    cooldownSeconds: z.number().int().min(10).max(3600).optional(),
    customMessages: z.array(CustomMsg).max(200).optional(),
  })
  .strict();

router.patch("/admin/nudges/settings", async (req, res: Response) => {
  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const existing = await ensureSingleton();
    const next = { ...parsed.data } as Record<string, unknown>;
    if (parsed.data.customMessages) {
      next.customMessages = parsed.data.customMessages.map((m) => ({
        id: m.id ?? randomUUID(),
        tone: m.tone,
        trigger: m.trigger,
        text: m.text,
        cta: m.cta,
      }));
    }
    next.updatedAt = new Date();
    const [updated] = await db
      .update(nudgeSettingsTable)
      .set(next)
      .where(eq(nudgeSettingsTable.id, 1))
      .returning();
    await recordActivity({
      kind: "nudge_settings_updated",
      actor: "admin",
      title: "Nudge settings updated",
      summary: `enabled=${updated!.enabled} · tones=${updated!.tones.length} · triggers=${updated!.triggers.length}`,
      payload: {
        diff: Object.keys(parsed.data),
        before: { enabled: existing.enabled, tones: existing.tones },
      },
    });
    res.json({ settings: updated });
  } catch (err) {
    logger.error({ err }, "nudges.admin_patch_failed");
    res.status(500).json({ error: "Failed to update" });
  }
});

export default router;
