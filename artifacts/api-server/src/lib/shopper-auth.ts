import { randomBytes, randomUUID } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { db, shopperSessionsTable, shopperUsersTable, type ShopperUserRow } from "./db";

export const SHOPPER_COOKIE = "dt_shopper";
const SESSION_TTL_DAYS = 30;

export function newSessionToken(): string {
  return randomBytes(24).toString("hex");
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function setShopperCookie(res: Response, token: string): void {
  res.cookie(SHOPPER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: true,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearShopperCookie(res: Response): void {
  res.clearCookie(SHOPPER_COOKIE, { path: "/" });
}

export async function getShopper(req: Request): Promise<ShopperUserRow | null> {
  const token = (req as Request & { signedCookies?: Record<string, string> })
    .signedCookies?.[SHOPPER_COOKIE];
  if (!token) return null;
  const [row] = await db
    .select({ user: shopperUsersTable })
    .from(shopperSessionsTable)
    .innerJoin(shopperUsersTable, eq(shopperUsersTable.id, shopperSessionsTable.userId))
    .where(
      and(
        eq(shopperSessionsTable.token, token),
        gt(shopperSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.user ?? null;
}

export function requireShopper() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await getShopper(req);
    if (!user) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    (req as Request & { shopper?: ShopperUserRow }).shopper = user;
    next();
  };
}

export function newUserId(): string {
  return randomUUID();
}
