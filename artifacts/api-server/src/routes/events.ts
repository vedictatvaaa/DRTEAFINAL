import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, analyticsEventsTable, type AnalyticsEventType } from "../lib/db";

const router: IRouter = Router();

const VALID_TYPES: AnalyticsEventType[] = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_start",
  "order_placed",
];

const EventSchema = z.object({
  sessionId: z.string().min(8).max(64),
  type: z.enum(VALID_TYPES as [AnalyticsEventType, ...AnalyticsEventType[]]),
  path: z.string().max(2048).optional().default(""),
  productId: z.string().max(128).optional(),
  orderId: z.number().int().positive().optional(),
  value: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.string().max(8).optional(),
  referrer: z.string().max(2048).optional().default(""),
  utmSource: z.string().max(128).optional().default(""),
  utmMedium: z.string().max(128).optional().default(""),
  utmCampaign: z.string().max(128).optional().default(""),
  country: z.string().max(8).optional().default(""),
});
const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(50),
});

// Tiny in-memory rate limiter: 60 batches / minute / IP. No external dep so
// this works in any deploy. Swap for redis if we ever scale horizontally.
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const slot = buckets.get(ip);
  if (!slot || slot.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (slot.count >= 60) return false;
  slot.count += 1;
  return true;
}
// Periodically prune expired buckets.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}, 60_000).unref?.();

router.post("/events", async (req: Request, res: Response) => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").toString();
  if (!rateLimit(ip)) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  const parsed = BatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const ua = (req.headers["user-agent"] ?? "").toString().slice(0, 500);
  try {
    await db.insert(analyticsEventsTable).values(
      parsed.data.events.map((e) => ({
        sessionId: e.sessionId,
        type: e.type,
        path: e.path ?? "",
        productId: e.productId ?? null,
        orderId: e.orderId ?? null,
        value: e.value ?? null,
        currency: e.currency ?? null,
        referrer: e.referrer ?? "",
        utmSource: e.utmSource ?? "",
        utmMedium: e.utmMedium ?? "",
        utmCampaign: e.utmCampaign ?? "",
        country: e.country ?? "",
        userAgent: ua,
      })),
    );
    res.json({ accepted: parsed.data.events.length });
  } catch (err) {
    req.log.error({ err }, "Analytics ingest failed");
    res.status(500).json({ error: "Failed to record events" });
  }
});

export default router;
