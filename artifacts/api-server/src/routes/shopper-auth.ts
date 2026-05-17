import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq, and, gt, isNull, desc, sql } from "drizzle-orm";
import { createHmac, randomInt } from "node:crypto";
import {
  db,
  shopperOtpsTable,
  shopperUsersTable,
  shopperSessionsTable,
} from "../lib/db";
import {
  getShopper,
  newSessionToken,
  newUserId,
  sessionExpiry,
  setShopperCookie,
  clearShopperCookie,
  SHOPPER_COOKIE,
} from "../lib/shopper-auth";
import { sendEmail, isEmailEnabled } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const RequestOtpBody = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional().default(""),
});

const VerifyOtpBody = z.object({
  email: z.string().email().max(200),
  code: z.string().regex(/^\d{6}$/, "6-digit code expected"),
  name: z.string().max(120).optional().default(""),
});

// --- OTP helpers ----------------------------------------------------------
function newOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function otpSecret(): string {
  return process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "dev-otp";
}

function hashOtp(email: string, code: string): string {
  return createHmac("sha256", otpSecret()).update(`${email}:${code}`).digest("hex");
}

const MAX_OTP_ATTEMPTS = 5;

// --- In-memory rate limiter (per-process; sufficient for single-instance) -
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

// Periodically prune the bucket map so it can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 5 * 60 * 1000).unref?.();

router.post("/shopper/auth/request-otp", async (req: Request, res: Response) => {
  const parsed = RequestOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const ip = clientIp(req);

  // 5 OTP requests / 15 min per email and per IP.
  if (
    !rateLimit(`otp-req:email:${email}`, 5, 15 * 60 * 1000) ||
    !rateLimit(`otp-req:ip:${ip}`, 20, 15 * 60 * 1000)
  ) {
    res.status(429).json({ error: "Too many requests. Please wait a few minutes and try again." });
    return;
  }

  const code = newOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  // Store HMAC, not the plaintext code.
  await db
    .insert(shopperOtpsTable)
    .values({ email, code: hashOtp(email, code), expiresAt });

  const subject = "Your Dr Tea sign-in code";
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2a2a2a;">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 8px;">Dr Tea Journal</h1>
      <p style="margin:0 0 24px;color:#666;">Use this code to sign in to the Dr Tea Journal community.</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:18px;background:#f6f3ee;border-radius:12px;">${code}</div>
      <p style="margin:24px 0 0;font-size:13px;color:#999;">This code expires in 15 minutes. If you didn't request it, ignore this email.</p>
    </div>`;

  let devCode: string | undefined;
  if (isEmailEnabled()) {
    try {
      await sendEmail({ to: email, subject, html, kind: "welcome" });
    } catch (err) {
      logger.warn({ err }, "Shopper OTP email send failed");
    }
  } else {
    // Dev mode — surface the code so the user can sign in without an email
    // provider configured. Production must set RESEND_API_KEY + EMAIL_FROM.
    devCode = code;
    logger.info({ email }, "Shopper OTP issued (dev mode, RESEND_API_KEY missing)");
  }

  res.json({ ok: true, devCode });
});

router.post("/shopper/auth/verify-otp", async (req: Request, res: Response) => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const ip = clientIp(req);

  // 10 verify attempts / 15 min per email and per IP — defends against brute force.
  if (
    !rateLimit(`otp-vfy:email:${email}`, 10, 15 * 60 * 1000) ||
    !rateLimit(`otp-vfy:ip:${ip}`, 30, 15 * 60 * 1000)
  ) {
    res.status(429).json({ error: "Too many attempts. Please request a new code." });
    return;
  }

  // Most-recent unconsumed, unexpired OTP for this email.
  const [otp] = await db
    .select()
    .from(shopperOtpsTable)
    .where(
      and(
        eq(shopperOtpsTable.email, email),
        gt(shopperOtpsTable.expiresAt, new Date()),
        isNull(shopperOtpsTable.consumedAt),
      ),
    )
    .orderBy(desc(shopperOtpsTable.createdAt))
    .limit(1);

  if (!otp) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    // Burn the OTP so it can't keep being attempted.
    await db
      .update(shopperOtpsTable)
      .set({ consumedAt: new Date() })
      .where(eq(shopperOtpsTable.id, otp.id));
    res.status(429).json({ error: "Too many attempts on this code. Please request a new one." });
    return;
  }

  const expectedHash = hashOtp(email, parsed.data.code);
  if (otp.code !== expectedHash) {
    await db
      .update(shopperOtpsTable)
      .set({ attempts: sql`${shopperOtpsTable.attempts} + 1` })
      .where(eq(shopperOtpsTable.id, otp.id));
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  await db
    .update(shopperOtpsTable)
    .set({ consumedAt: new Date() })
    .where(eq(shopperOtpsTable.id, otp.id));

  // Upsert user.
  const [existing] = await db
    .select()
    .from(shopperUsersTable)
    .where(eq(shopperUsersTable.email, email))
    .limit(1);
  let userId: string;
  let name: string;
  if (existing) {
    userId = existing.id;
    name = existing.name || parsed.data.name;
    if (!existing.name && parsed.data.name) {
      await db
        .update(shopperUsersTable)
        .set({ name: parsed.data.name })
        .where(eq(shopperUsersTable.id, userId));
    }
  } else {
    userId = newUserId();
    name = parsed.data.name || email.split("@")[0];
    await db.insert(shopperUsersTable).values({ id: userId, email, name });
  }

  const token = newSessionToken();
  await db.insert(shopperSessionsTable).values({
    token,
    userId,
    expiresAt: sessionExpiry(),
  });
  setShopperCookie(res, token);
  res.json({ ok: true, user: { id: userId, email, name } });
});

router.get("/shopper/auth/me", async (req: Request, res: Response) => {
  const user = await getShopper(req);
  if (!user) {
    res.json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

router.post("/shopper/auth/logout", async (req: Request, res: Response) => {
  const token = (req as Request & { signedCookies?: Record<string, string> })
    .signedCookies?.[SHOPPER_COOKIE];
  if (token) {
    await db.delete(shopperSessionsTable).where(eq(shopperSessionsTable.token, token));
  }
  clearShopperCookie(res);
  res.json({ ok: true });
});

export default router;
