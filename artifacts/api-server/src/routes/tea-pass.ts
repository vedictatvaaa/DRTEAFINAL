import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_CATEGORIES = [
  "floral-tisane",
  "chai",
  "kadha",
  "green-tea",
  "black-tea",
  "tea-reserve",
] as const;

const interestSchema = z.object({
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  name: z.string().trim().max(80).optional().or(z.literal("")),
  categories: z
    .array(z.enum(ALLOWED_CATEGORIES))
    .min(2)
    .max(2)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Pick two different categories.",
    }),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  source: z.string().trim().max(40).optional(),
});

const recent = new Map<string, number>();
const COOLDOWN_MS = 60_000;

router.post("/tea-pass/interest", async (req: Request, res: Response) => {
  const parsed = interestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Please share a valid email and pick exactly 2 categories.",
    });
  }
  const { email, phone, name, categories, city, source } = parsed.data;
  const ip = (req.headers["x-forwarded-for"] as string | undefined) ?? req.ip ?? "unknown";
  const key = `${ip}:${email.toLowerCase()}`;
  const last = recent.get(key);
  const now = Date.now();
  if (last && now - last < COOLDOWN_MS) {
    return res.status(429).json({ ok: false, error: "Please wait a moment before re-submitting." });
  }
  recent.set(key, now);
  if (recent.size > 500) {
    const cutoff = now - COOLDOWN_MS;
    for (const [k, t] of recent) if (t < cutoff) recent.delete(k);
  }

  try {
    await recordActivity({
      kind: "tea_pass_interest",
      actor: "system",
      title: `Tea Pass interest — ${email}`,
      summary: `Categories: ${categories.join(" + ")}${city ? ` · ${city}` : ""}`,
      entityType: "tea_pass_lead",
      entityId: email.toLowerCase(),
      payload: {
        email: email.toLowerCase(),
        phone: phone || null,
        name: name || null,
        categories,
        city: city || null,
        source: source || "tea-pass-page",
        receivedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.warn({ err }, "Failed to record Tea Pass interest");
  }

  return res.json({
    ok: true,
    message: "You're on the list — we'll email you the moment the Pass goes live.",
  });
});

export default router;
