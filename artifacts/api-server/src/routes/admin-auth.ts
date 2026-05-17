import { Router, type IRouter, type Request, type Response } from "express";
import { timingSafeEqual } from "crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AdminLoginBody } from "@workspace/api-zod";
import { db, adminUsersTable } from "../lib/db";
import {
  setAuthCookie,
  setAdminUserCookie,
  clearAuthCookie,
  isAuthed,
  getCurrentAdmin,
} from "../middlewares/admin-auth";
import { verifyPassword } from "../lib/admin-passwords";
import { logger } from "../lib/logger";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

const router: IRouter = Router();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; firstAt: number }>();

function checkLoginRate(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((LOGIN_WINDOW_MS - (now - entry.firstAt)) / 1000),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

function resetLoginRate(ip: string) {
  loginAttempts.delete(ip);
}

// Login accepts either:
//   { password }            — legacy single-password "owner" login
//   { email, password }     — team-member login backed by admin_users
const TeamLoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post("/admin/auth/login", async (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const rate = checkLoginRate(ip);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfter));
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  // Try team-member login first when an email is supplied.
  const teamParsed = TeamLoginBody.safeParse(req.body);
  if (teamParsed.success) {
    try {
      const [user] = await db
        .select()
        .from(adminUsersTable)
        .where(eq(adminUsersTable.email, teamParsed.data.email))
        .limit(1);
      if (
        !user ||
        user.status !== "active" ||
        !(await verifyPassword(teamParsed.data.password, user.passwordHash))
      ) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      resetLoginRate(ip);
      setAdminUserCookie(res, user.id);
      void db
        .update(adminUsersTable)
        .set({ lastSeenAt: sql`now()` })
        .where(eq(adminUsersTable.id, user.id))
        .catch((err) => logger.warn({ err }, "admin_auth.login.last_seen"));
      res.json({
        authenticated: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
      return;
    } catch (err) {
      logger.error({ err }, "admin_auth.team_login.failed");
      res.status(500).json({ error: "Login failed" });
      return;
    }
  }

  // Fallback: legacy ADMIN_PASSWORD-only body.
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: "ADMIN_PASSWORD not configured" });
    return;
  }
  if (!safeEqual(parsed.data.password, expected)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  resetLoginRate(ip);
  setAuthCookie(res);
  res.json({ authenticated: true });
});

router.post("/admin/auth/logout", (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/admin/auth/me", async (req: Request, res: Response) => {
  const authed = isAuthed(req);
  if (!authed) {
    res.json({ authenticated: false });
    return;
  }
  const user = await getCurrentAdmin(req);
  res.json({
    authenticated: true,
    user: user
      ? { id: user.id, email: user.email, name: user.name, role: user.role }
      : { id: null, email: null, name: "Owner", role: "owner" as const },
  });
});

export default router;
