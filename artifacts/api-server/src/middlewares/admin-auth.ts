import type { Request, Response, NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, adminUsersTable, type AdminUserRow } from "../lib/db";
import { logger } from "../lib/logger";

const COOKIE_NAME = "dr_tea_admin";
const USER_COOKIE = "dr_tea_admin_user";

// We support two parallel auth modes:
//   1. Legacy: ADMIN_PASSWORD login sets dr_tea_admin=1 — treated as the
//      implicit "owner" account so nothing breaks for single-tenant stores.
//   2. Team: a row in admin_users authenticated by email+password sets
//      dr_tea_admin_user=<id>. We surface that user via getCurrentAdmin so
//      every write can be attributed.
// Both cookies are signed and HttpOnly.

export function isAuthed(req: Request): boolean {
  const c = (req as Request & { signedCookies?: Record<string, string> })
    .signedCookies;
  if (!c) return false;
  if (c[COOKIE_NAME] === "1") return true;
  if (c[USER_COOKIE] && /^\d+$/.test(c[USER_COOKIE])) return true;
  return false;
}

export function setAuthCookie(res: Response): void {
  res.cookie(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  });
}

export function setAdminUserCookie(res: Response, userId: number): void {
  res.cookie(USER_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.clearCookie(USER_COOKIE, { path: "/" });
}

export function getAdminUserId(req: Request): number | null {
  const c = (req as Request & { signedCookies?: Record<string, string> })
    .signedCookies;
  const v = c?.[USER_COOKIE];
  if (!v || !/^\d+$/.test(v)) return null;
  return Number(v);
}

// Heat-cache so we do not hit the DB on every authed request just to bump
// last_seen_at. We refresh at most once per user per minute.
const lastSeenCache = new Map<number, number>();
const LAST_SEEN_REFRESH_MS = 60_000;

// Revocation cache: we must verify on every request that the team-user
// behind a signed cookie is still active in DB. To avoid a SELECT per
// request we cache the answer briefly; the trade-off is that revocation
// takes up to ACTIVE_CACHE_MS to propagate. 30s is short enough that
// admins removing a teammate see access cut almost immediately, while
// keeping the hot path effectively zero-DB.
const ACTIVE_CACHE_MS = 30_000;
const activeCache = new Map<number, { until: number; active: boolean }>();
async function isAdminActive(userId: number): Promise<boolean> {
  const now = Date.now();
  const cached = activeCache.get(userId);
  if (cached && cached.until > now) return cached.active;
  try {
    const [row] = await db
      .select({ status: adminUsersTable.status })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, userId))
      .limit(1);
    const active = !!row && row.status === "active";
    activeCache.set(userId, { until: now + ACTIVE_CACHE_MS, active });
    return active;
  } catch (err) {
    // Fail closed on lookup errors — revocation enforcement matters more
    // than uptime for the admin surface.
    logger.warn({ err, userId }, "admin_auth.active_check.failed");
    return false;
  }
}

export function invalidateAdminAuthCache(userId: number): void {
  activeCache.delete(userId);
}

async function bumpLastSeen(userId: number): Promise<void> {
  const now = Date.now();
  const prev = lastSeenCache.get(userId);
  if (prev && now - prev < LAST_SEEN_REFRESH_MS) return;
  lastSeenCache.set(userId, now);
  try {
    await db
      .update(adminUsersTable)
      .set({ lastSeenAt: sql`now()` })
      .where(eq(adminUsersTable.id, userId));
  } catch (err) {
    logger.warn({ err, userId }, "admin_auth.last_seen.failed");
  }
}

export async function getCurrentAdmin(
  req: Request,
): Promise<AdminUserRow | null> {
  const id = getAdminUserId(req);
  if (!id) return null;
  try {
    const [row] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, id))
      .limit(1);
    if (!row || row.status !== "active") return null;
    void bumpLastSeen(id);
    return row;
  } catch (err) {
    logger.warn({ err }, "admin_auth.lookup.failed");
    return null;
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Team users (cookie-bound to admin_users.id) must still be active.
  // The legacy ADMIN_PASSWORD owner cookie is not tied to a row, so it
  // implicitly bypasses this check — that's by design (single-tenant
  // owner) and matches setAuthCookie.
  const userId = getAdminUserId(req);
  if (userId !== null) {
    const active = await isAdminActive(userId);
    if (!active) {
      clearAuthCookie(res);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  next();
}
