import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  loyaltyAccountsTable,
  loyaltyLedgerTable,
  shopperUsersTable,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { postLoyaltyEntry } from "../lib/loyalty";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/loyalty", requireAdmin);

router.get("/admin/loyalty/overview", async (_req: Request, res: Response) => {
  try {
    const [agg] = await db
      .select({
        members: sql<number>`count(*)::int`,
        outstanding: sql<number>`coalesce(sum(${loyaltyAccountsTable.pointsBalance}), 0)::int`,
        lifetimePoints: sql<number>`coalesce(sum(${loyaltyAccountsTable.lifetimePoints}), 0)::int`,
        lifetimeSpend: sql<number>`coalesce(sum(${loyaltyAccountsTable.lifetimeSpend}), 0)::int`,
      })
      .from(loyaltyAccountsTable);

    const top = await db
      .select({
        shopperUserId: loyaltyAccountsTable.shopperUserId,
        pointsBalance: loyaltyAccountsTable.pointsBalance,
        lifetimePoints: loyaltyAccountsTable.lifetimePoints,
        lifetimeSpend: loyaltyAccountsTable.lifetimeSpend,
        email: shopperUsersTable.email,
        name: shopperUsersTable.name,
      })
      .from(loyaltyAccountsTable)
      .innerJoin(
        shopperUsersTable,
        eq(shopperUsersTable.id, loyaltyAccountsTable.shopperUserId),
      )
      .orderBy(desc(loyaltyAccountsTable.lifetimePoints))
      .limit(10);

    res.json({
      stats: agg ?? {
        members: 0,
        outstanding: 0,
        lifetimePoints: 0,
        lifetimeSpend: 0,
      },
      topMembers: top,
    });
  } catch (err) {
    logger.error({ err }, "admin.loyalty.overview failed");
    res.status(500).json({ error: "Could not load loyalty overview." });
  }
});

const ListAccountsQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

router.get("/admin/loyalty/accounts", async (req: Request, res: Response) => {
  const parsed = ListAccountsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  try {
    const filters: SQL[] = [];
    if (parsed.data.q) {
      const needle = `%${parsed.data.q}%`;
      const cond = or(
        ilike(shopperUsersTable.email, needle),
        ilike(shopperUsersTable.name, needle),
      );
      if (cond) filters.push(cond);
    }
    const rows = await db
      .select({
        shopperUserId: loyaltyAccountsTable.shopperUserId,
        pointsBalance: loyaltyAccountsTable.pointsBalance,
        lifetimePoints: loyaltyAccountsTable.lifetimePoints,
        lifetimeSpend: loyaltyAccountsTable.lifetimeSpend,
        updatedAt: loyaltyAccountsTable.updatedAt,
        email: shopperUsersTable.email,
        name: shopperUsersTable.name,
      })
      .from(loyaltyAccountsTable)
      .innerJoin(
        shopperUsersTable,
        eq(shopperUsersTable.id, loyaltyAccountsTable.shopperUserId),
      )
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(loyaltyAccountsTable.pointsBalance))
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);
    res.json({ accounts: rows });
  } catch (err) {
    logger.error({ err }, "admin.loyalty.accounts failed");
    res.status(500).json({ error: "Could not load loyalty accounts." });
  }
});

const ListLedgerQuery = z.object({
  shopperUserId: z.string().trim().min(1).optional(),
  kind: z.enum(["earn", "redeem", "adjust"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

router.get("/admin/loyalty/ledger", async (req: Request, res: Response) => {
  const parsed = ListLedgerQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  try {
    const filters: SQL[] = [];
    if (parsed.data.shopperUserId) {
      filters.push(eq(loyaltyLedgerTable.shopperUserId, parsed.data.shopperUserId));
    }
    if (parsed.data.kind) {
      filters.push(eq(loyaltyLedgerTable.kind, parsed.data.kind));
    }
    const rows = await db
      .select({
        id: loyaltyLedgerTable.id,
        shopperUserId: loyaltyLedgerTable.shopperUserId,
        kind: loyaltyLedgerTable.kind,
        points: loyaltyLedgerTable.points,
        orderId: loyaltyLedgerTable.orderId,
        note: loyaltyLedgerTable.note,
        createdAt: loyaltyLedgerTable.createdAt,
        email: shopperUsersTable.email,
        name: shopperUsersTable.name,
      })
      .from(loyaltyLedgerTable)
      .innerJoin(
        shopperUsersTable,
        eq(shopperUsersTable.id, loyaltyLedgerTable.shopperUserId),
      )
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(loyaltyLedgerTable.createdAt))
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);
    res.json({ entries: rows });
  } catch (err) {
    logger.error({ err }, "admin.loyalty.ledger failed");
    res.status(500).json({ error: "Could not load ledger." });
  }
});

const AdjustBody = z.object({
  shopperUserId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  points: z.number().int().refine((n) => n !== 0, "points cannot be zero"),
  note: z.string().trim().min(1).max(280),
});

router.post("/admin/loyalty/adjust", async (req: Request, res: Response) => {
  const parsed = AdjustBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { shopperUserId, email, points, note } = parsed.data;
  if (!shopperUserId && !email) {
    res.status(400).json({ error: "shopperUserId or email is required" });
    return;
  }
  try {
    let userId = shopperUserId ?? null;
    let userEmail = email ?? null;
    if (!userId && email) {
      const [u] = await db
        .select({ id: shopperUsersTable.id, email: shopperUsersTable.email })
        .from(shopperUsersTable)
        .where(eq(shopperUsersTable.email, email))
        .limit(1);
      if (!u) {
        res.status(404).json({ error: "No shopper with that email." });
        return;
      }
      userId = u.id;
      userEmail = u.email;
    } else if (userId) {
      const [u] = await db
        .select({ email: shopperUsersTable.email })
        .from(shopperUsersTable)
        .where(eq(shopperUsersTable.id, userId))
        .limit(1);
      if (!u) {
        res.status(404).json({ error: "No shopper with that id." });
        return;
      }
      userEmail = u.email;
    }
    if (!userId) {
      res.status(404).json({ error: "Shopper not found." });
      return;
    }

    // For debits, ensure balance won't go negative
    if (points < 0) {
      const [acct] = await db
        .select({ balance: loyaltyAccountsTable.pointsBalance })
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.shopperUserId, userId))
        .limit(1);
      const balance = acct?.balance ?? 0;
      if (balance + points < 0) {
        res.status(409).json({
          error: `Insufficient balance. Has ${balance} pts, cannot debit ${-points}.`,
        });
        return;
      }
    }

    // postLoyaltyEntry's "adjust" branch credits; "redeem" debits. We model a
    // negative manual adjustment as a redeem so a single ledger row reflects
    // the operation cleanly. Both are tagged "[manual] " so the UI can flag
    // them as admin-initiated.
    await db.transaction(async (tx) => {
      await postLoyaltyEntry(tx, {
        shopperUserId: userId!,
        kind: points >= 0 ? "adjust" : "redeem",
        points: Math.abs(points),
        note: `[manual] ${note}`,
      });
    });

    void recordActivity({
      kind: "loyalty_adjusted",
      title: `Loyalty ${points >= 0 ? "credit" : "debit"}: ${Math.abs(points)} pts`,
      summary: `${userEmail ?? userId} — ${note}`,
      entityType: "shopper_user",
      entityId: userId,
      payload: { points, note },
    });

    const [account] = await db
      .select()
      .from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.shopperUserId, userId))
      .limit(1);
    res.json({ ok: true, account });
  } catch (err) {
    logger.error({ err }, "admin.loyalty.adjust failed");
    res.status(500).json({ error: "Could not adjust loyalty balance." });
  }
});

export default router;
