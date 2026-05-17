// Public endpoint for the /partners landing page. Captures interest from
// Kickstarter backers, investors, and strategic partners. Each submission
// is logged to the admin activity feed so the founder sees them in real
// time. Honeypot + per-IP+email cooldown to keep spam at bay.

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_KIND = ["kickstarter", "investor", "partner", "other"] as const;
const TICKET = [
  "under_1L",
  "1L_5L",
  "5L_25L",
  "25L_1Cr",
  "1Cr_plus",
  "not_applicable",
] as const;

const interestSchema = z.object({
  kind: z.enum(ALLOWED_KIND),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  org: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  ticket: z.enum(TICKET).optional(),
  message: z.string().trim().max(1500).optional().or(z.literal("")),
  // Honeypot — bots fill it, humans don't see it.
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

const recent = new Map<string, number>();
const COOLDOWN_MS = 60_000;

router.post("/partners/interest", async (req: Request, res: Response) => {
  const parsed = interestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Please share a valid name, email, and a short note.",
    });
  }
  const data = parsed.data;
  if (data.website && data.website.length > 0) {
    // Honeypot tripped — pretend success so bots stop trying.
    return res.json({ ok: true });
  }
  // Use Express's resolved req.ip (honours the trust-proxy setting); avoid
  // trusting the raw X-Forwarded-For header which is client-controllable
  // and can be rotated to bypass the cooldown.
  const ip = (req.ip ?? "unknown").toString();
  const key = `${ip}:${data.email.toLowerCase()}`;
  const last = recent.get(key);
  const now = Date.now();
  if (last && now - last < COOLDOWN_MS) {
    return res
      .status(429)
      .json({ ok: false, error: "Please wait a moment before re-submitting." });
  }
  recent.set(key, now);
  // Lazy GC.
  if (recent.size > 5000) {
    for (const [k, t] of recent) {
      if (now - t > COOLDOWN_MS * 10) recent.delete(k);
    }
  }

  try {
    await recordActivity({
      kind: "partner_interest",
      actor: "system",
      title: `New ${data.kind} interest: ${data.name}`,
      summary:
        `${data.email}${data.org ? ` · ${data.org}` : ""}` +
        `${data.ticket ? ` · ticket=${data.ticket}` : ""}` +
        `${data.city ? ` · ${data.city}` : ""}`,
      payload: {
        kind: data.kind,
        name: data.name,
        email: data.email,
        org: data.org || null,
        phone: data.phone || null,
        city: data.city || null,
        ticket: data.ticket || null,
        message: data.message || null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "partners.interest_failed");
    res.status(500).json({ ok: false, error: "Couldn't save right now. Try again shortly." });
  }
});

export default router;
