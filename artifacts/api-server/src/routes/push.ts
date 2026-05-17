import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "../lib/db";
import {
  getVapidPublicKey,
  isPushEnabled,
  broadcastPush,
  type PushPayload,
} from "../lib/push";
import { requireAdmin } from "../middlewares/admin-auth";
import { PushSubscribeBody, AdminBroadcastPushBody } from "@workspace/api-zod";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/push/public-key", (_req: Request, res: Response) => {
  res.json({ enabled: isPushEnabled(), publicKey: getVapidPublicKey() });
});

router.post("/push/subscribe", async (req: Request, res: Response) => {
  const parsed = PushSubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptionsTable)
    .values({
      endpoint,
      p256dh: keys.p256dh,
      authKey: keys.auth,
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500),
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { lastSeenAt: new Date(), p256dh: keys.p256dh, authKey: keys.auth },
    });
  res.json({ ok: true });
});

router.post("/push/unsubscribe", async (req: Request, res: Response) => {
  const endpoint = String((req.body as { endpoint?: string } | undefined)?.endpoint ?? "");
  if (!endpoint) {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ ok: true });
});

// ── Admin ────────────────────────────────────────────────────────────────
router.use("/admin/push", requireAdmin);

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "unknown";
  }
}

function endpointProvider(host: string): string {
  if (host.includes("fcm.googleapis.com") || host.includes("android.googleapis.com"))
    return "Google (FCM/Android)";
  if (host.includes("push.apple.com") || host.includes("web.push.apple.com"))
    return "Apple (Web Push)";
  if (host.includes("mozilla.com") || host.includes("autopush.")) return "Mozilla (Firefox)";
  if (host.includes("notify.windows.com") || host.includes("wns.windows.com"))
    return "Microsoft (WNS)";
  return host || "Unknown";
}

function shortUserAgent(ua: string): string {
  if (!ua) return "Unknown";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

router.get("/admin/push/overview", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(pushSubscriptionsTable);
    const total = rows.length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const newLastWeek = rows.filter(
      (r) => new Date(r.createdAt).getTime() >= sevenDaysAgo,
    ).length;
    const activeLast30 = rows.filter(
      (r) => new Date(r.lastSeenAt).getTime() >= thirtyDaysAgo,
    ).length;
    const stale = rows.filter(
      (r) => new Date(r.lastSeenAt).getTime() < thirtyDaysAgo,
    ).length;

    const providers = new Map<string, number>();
    const platforms = new Map<string, number>();
    for (const r of rows) {
      const p = endpointProvider(endpointHost(r.endpoint));
      providers.set(p, (providers.get(p) ?? 0) + 1);
      const ua = shortUserAgent(r.userAgent);
      platforms.set(ua, (platforms.get(ua) ?? 0) + 1);
    }

    res.json({
      enabled: isPushEnabled(),
      total,
      newLastWeek,
      activeLast30,
      stale,
      providers: Array.from(providers, ([label, count]) => ({ label, count })).sort(
        (a, b) => b.count - a.count,
      ),
      platforms: Array.from(platforms, ([label, count]) => ({ label, count })).sort(
        (a, b) => b.count - a.count,
      ),
    });
  } catch (err) {
    logger.error({ err }, "push.overview.failed");
    res.status(500).json({ error: "Could not load overview" });
  }
});

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  stale: z.enum(["true", "false"]).optional(),
});

router.get("/admin/push/subscriptions", async (req: Request, res: Response) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(pushSubscriptionsTable)
      .orderBy(desc(pushSubscriptionsTable.lastSeenAt))
      .limit(parsed.data.limit);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let filtered = rows.map((r) => {
      const host = endpointHost(r.endpoint);
      return {
        id: r.id,
        host,
        provider: endpointProvider(host),
        platform: shortUserAgent(r.userAgent),
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
        stale: new Date(r.lastSeenAt).getTime() < thirtyDaysAgo,
      };
    });
    if (parsed.data.stale === "true") filtered = filtered.filter((r) => r.stale);
    if (parsed.data.stale === "false") filtered = filtered.filter((r) => !r.stale);
    res.json({ subscriptions: filtered });
  } catch (err) {
    logger.error({ err }, "push.subscriptions.failed");
    res.status(500).json({ error: "Could not list subscriptions" });
  }
});

router.delete("/admin/push/subscriptions/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "push.subscription.delete.failed");
    res.status(500).json({ error: "Could not delete subscription" });
  }
});

router.post("/admin/push/prune-stale", async (_req: Request, res: Response) => {
  try {
    const result = await db
      .delete(pushSubscriptionsTable)
      .where(sql`${pushSubscriptionsTable.lastSeenAt} < now() - interval '30 days'`)
      .returning({ id: pushSubscriptionsTable.id });
    void recordActivity({
      kind: "push_subscriptions_pruned",
      actor: "admin",
      title: `Pruned ${result.length} stale push subscriptions`,
      summary: "Endpoints not seen in 30+ days",
    });
    res.json({ pruned: result.length });
  } catch (err) {
    logger.error({ err }, "push.prune.failed");
    res.status(500).json({ error: "Could not prune subscriptions" });
  }
});

router.post("/admin/push/broadcast", async (req: Request, res: Response) => {
  const parsed = AdminBroadcastPushBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  if (!isPushEnabled()) {
    res
      .status(409)
      .json({ error: "Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY." });
    return;
  }
  try {
    const payload: PushPayload = {
      title: parsed.data.title,
      body: parsed.data.body,
    };
    if (parsed.data.url) payload.url = parsed.data.url;
    const result = await broadcastPush(payload);
    void recordActivity({
      kind: "push_broadcast_sent",
      actor: "admin",
      title: `Push broadcast: ${parsed.data.title}`,
      summary: `Sent ${result.sent} • Failed ${result.failed} • Pruned ${result.pruned}`,
      payload: {
        title: parsed.data.title,
        body: parsed.data.body,
        url: parsed.data.url ?? null,
        ...result,
      },
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "push.broadcast.failed");
    res.status(500).json({ error: "Broadcast failed" });
  }
});

export default router;
