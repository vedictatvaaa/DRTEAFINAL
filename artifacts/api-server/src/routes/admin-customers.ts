import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  shopperUsersTable,
  journalCommentsTable,
  loyaltyAccountsTable,
  loyaltyLedgerTable,
  giftCardsTable,
  subscriptionsTable,
  productReviewsTable,
  newsletterSubscribersTable,
  abandonedCartsTable,
  emailLogsTable,
  customerNotesTable,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/customers", requireAdmin);

// ──────────────────────────────────────────────────────────────────────────
// LIST: distinct customers derived from orders. We aggregate spend / order
// counts in SQL so the list view is one round-trip and remains snappy at
// thousands of orders. Email is the canonical key (case-insensitive).
// ──────────────────────────────────────────────────────────────────────────

const ListQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  sort: z
    .enum(["lastOrder", "totalSpend", "orderCount", "name"])
    .default("lastOrder"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

router.get("/admin/customers", async (req: Request, res: Response) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { q, sort, limit, offset } = parsed.data;

  const emailLower = sql<string>`lower(${ordersTable.customerEmail})`;
  const filters: SQL[] = [];
  if (q) {
    const needle = `%${q}%`;
    filters.push(
      sql`(${ilike(ordersTable.customerEmail, needle)} OR ${ilike(
        ordersTable.customerName,
        needle,
      )})`,
    );
  }

  const orderColumn =
    sort === "totalSpend"
      ? sql`sum(${ordersTable.total}) DESC`
      : sort === "orderCount"
        ? sql`count(*) DESC`
        : sort === "name"
          ? sql`min(${ordersTable.customerName}) ASC`
          : sql`max(${ordersTable.createdAt}) DESC`;

  try {
    const rows = await db
      .select({
        email: emailLower,
        displayEmail: sql<string>`min(${ordersTable.customerEmail})`,
        displayName: sql<string>`min(${ordersTable.customerName})`,
        orderCount: sql<number>`count(*)::int`,
        totalSpend: sql<number>`coalesce(sum(${ordersTable.total}),0)::int`,
        lastOrderAt: sql<string | null>`max(${ordersTable.createdAt})`,
        firstOrderAt: sql<string | null>`min(${ordersTable.createdAt})`,
      })
      .from(ordersTable)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .groupBy(emailLower)
      .orderBy(orderColumn)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({ items, hasMore, nextOffset: hasMore ? offset + limit : null });
  } catch (err) {
    logger.error({ err }, "admin_customers.list.failed");
    res.status(500).json({ error: "Failed to load customers" });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// DETAIL: full Customer 360 for one email. We deliberately gather every
// surface in parallel — none of these tables blocks the others — and let
// individual queries fail soft (empty array) so a missing dependency
// (e.g. reviews not seeded) does not blank the entire panel.
// ──────────────────────────────────────────────────────────────────────────

function decodeEmail(raw: string): string | null {
  try {
    const v = decodeURIComponent(raw).trim().toLowerCase();
    if (!v || v.length > 320 || !v.includes("@")) return null;
    return v;
  } catch {
    return null;
  }
}

async function safe<T>(p: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await p;
  } catch (err) {
    logger.warn({ err, label }, "admin_customers.detail.partial_failure");
    return fallback;
  }
}

router.get("/admin/customers/:email", async (req: Request, res: Response) => {
  const email = decodeEmail(String(req.params.email ?? ""));
  if (!email) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }
  const emailEq = sql`lower(${ordersTable.customerEmail}) = ${email}`;

  try {
    const [
      orders,
      shopperUsers,
      newsletter,
      comments,
      gifts,
      abandoned,
      emails,
      notes,
    ] = await Promise.all([
      safe(
        db
          .select()
          .from(ordersTable)
          .where(emailEq)
          .orderBy(desc(ordersTable.createdAt))
          .limit(100),
        [],
        "orders",
      ),
      safe(
        db
          .select()
          .from(shopperUsersTable)
          .where(sql`lower(${shopperUsersTable.email}) = ${email}`)
          .limit(1),
        [],
        "shopper",
      ),
      safe(
        db
          .select()
          .from(newsletterSubscribersTable)
          .where(sql`lower(${newsletterSubscribersTable.email}) = ${email}`)
          .limit(1),
        [],
        "newsletter",
      ),
      safe(
        db
          .select()
          .from(journalCommentsTable)
          .where(sql`lower(${journalCommentsTable.authorEmail}) = ${email}`)
          .orderBy(desc(journalCommentsTable.createdAt))
          .limit(50),
        [],
        "comments",
      ),
      safe(
        db
          .select()
          .from(giftCardsTable)
          .where(
            sql`(lower(${giftCardsTable.purchaserEmail}) = ${email} OR lower(${giftCardsTable.recipientEmail}) = ${email})`,
          )
          .orderBy(desc(giftCardsTable.createdAt))
          .limit(20),
        [],
        "gift_cards",
      ),
      safe(
        db
          .select()
          .from(abandonedCartsTable)
          .where(sql`lower(${abandonedCartsTable.email}) = ${email}`)
          .orderBy(desc(abandonedCartsTable.lastSeenAt))
          .limit(20),
        [],
        "abandoned",
      ),
      safe(
        db
          .select()
          .from(emailLogsTable)
          .where(sql`lower(${emailLogsTable.toAddress}) = ${email}`)
          .orderBy(desc(emailLogsTable.createdAt))
          .limit(50),
        [],
        "emails",
      ),
      safe(
        db
          .select()
          .from(customerNotesTable)
          .where(sql`lower(${customerNotesTable.customerEmail}) = ${email}`)
          .orderBy(
            desc(customerNotesTable.pinned),
            desc(customerNotesTable.createdAt),
          ),
        [],
        "notes",
      ),
    ]);

    // Order items (one query per order would N+1; one query for all).
    const orderIds = orders.map((o) => o.id);
    const items = orderIds.length
      ? await safe(
          db
            .select()
            .from(orderItemsTable)
            .where(
              sql`${orderItemsTable.orderId} IN (${sql.join(
                orderIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            ),
          [],
          "order_items",
        )
      : [];
    const itemsByOrder = new Map<number, typeof items>();
    for (const it of items) {
      const arr = itemsByOrder.get(it.orderId) ?? [];
      arr.push(it);
      itemsByOrder.set(it.orderId, arr);
    }
    const ordersHydrated = orders.map((o) => ({
      ...o,
      items: itemsByOrder.get(o.id) ?? [],
    }));

    // Loyalty + subscriptions + reviews require shopperUserId.
    const shopperUser = shopperUsers[0] ?? null;
    let loyaltyAccount: typeof loyaltyAccountsTable.$inferSelect | null = null;
    let loyaltyLedger: (typeof loyaltyLedgerTable.$inferSelect)[] = [];
    let subscriptions: (typeof subscriptionsTable.$inferSelect)[] = [];
    let reviews: (typeof productReviewsTable.$inferSelect)[] = [];
    if (shopperUser) {
      const [acct, led, subs, revs] = await Promise.all([
        safe(
          db
            .select()
            .from(loyaltyAccountsTable)
            .where(eq(loyaltyAccountsTable.shopperUserId, shopperUser.id))
            .limit(1),
          [],
          "loyalty_account",
        ),
        safe(
          db
            .select()
            .from(loyaltyLedgerTable)
            .where(eq(loyaltyLedgerTable.shopperUserId, shopperUser.id))
            .orderBy(desc(loyaltyLedgerTable.createdAt))
            .limit(50),
          [],
          "loyalty_ledger",
        ),
        safe(
          db
            .select()
            .from(subscriptionsTable)
            .where(eq(subscriptionsTable.shopperUserId, shopperUser.id))
            .orderBy(desc(subscriptionsTable.createdAt)),
          [],
          "subscriptions",
        ),
        safe(
          db
            .select()
            .from(productReviewsTable)
            .where(eq(productReviewsTable.shopperUserId, shopperUser.id))
            .orderBy(desc(productReviewsTable.createdAt))
            .limit(50),
          [],
          "reviews",
        ),
      ]);
      loyaltyAccount = acct[0] ?? null;
      loyaltyLedger = led;
      subscriptions = subs;
      reviews = revs;
    }

    // KPIs computed in app (small N, simpler than parallel SQL).
    const totalSpend = orders.reduce((s, o) => s + (o.total ?? 0), 0);
    const orderCount = orders.length;
    const aov = orderCount > 0 ? Math.round(totalSpend / orderCount) : 0;
    const firstOrderAt = orders[orders.length - 1]?.createdAt ?? null;
    const lastOrderAt = orders[0]?.createdAt ?? null;
    const status = (() => {
      if (orderCount === 0) return "lead";
      if (orderCount === 1) return "new";
      if (orderCount >= 5 || totalSpend >= 500000) return "vip";
      return "returning";
    })();

    res.json({
      email,
      displayEmail: orders[0]?.customerEmail ?? shopperUser?.email ?? email,
      displayName:
        orders[0]?.customerName ?? shopperUser?.name ?? "",
      shopperUser,
      newsletter: newsletter[0] ?? null,
      kpis: {
        orderCount,
        totalSpend,
        aov,
        firstOrderAt,
        lastOrderAt,
        status,
      },
      orders: ordersHydrated,
      comments,
      giftCards: gifts,
      abandonedCarts: abandoned,
      emails,
      notes,
      loyalty: {
        account: loyaltyAccount,
        ledger: loyaltyLedger,
      },
      subscriptions,
      reviews,
    });
  } catch (err) {
    logger.error({ err }, "admin_customers.detail.failed");
    res.status(500).json({ error: "Failed to load customer" });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Notes — admin-only freeform memos pinned to a customer.
// ──────────────────────────────────────────────────────────────────────────

const NoteBody = z.object({
  body: z.string().trim().min(1).max(2000),
  pinned: z.boolean().default(false),
});

router.post(
  "/admin/customers/:email/notes",
  async (req: Request, res: Response) => {
    const email = decodeEmail(String(req.params.email ?? ""));
    if (!email) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    const parsed = NoteBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }
    try {
      const [row] = await db
        .insert(customerNotesTable)
        .values({
          customerEmail: email,
          body: parsed.data.body,
          pinned: parsed.data.pinned,
        })
        .returning();
      void recordActivity({
        kind: "customer_note_added",
        actor: "admin",
        title: `Added note to customer ${email}`,
        summary: parsed.data.body.slice(0, 200),
        entityType: "customer",
        entityId: email,
      });
      res.status(201).json(row);
    } catch (err) {
      logger.error({ err }, "admin_customers.notes.create.failed");
      res.status(500).json({ error: "Failed to add note" });
    }
  },
);

router.delete(
  "/admin/customers/notes/:id",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const [row] = await db
        .delete(customerNotesTable)
        .where(eq(customerNotesTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "admin_customers.notes.delete.failed");
      res.status(500).json({ error: "Failed to delete note" });
    }
  },
);

router.patch(
  "/admin/customers/notes/:id",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const PinBody = z.object({ pinned: z.boolean() });
    const parsed = PinBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const [row] = await db
        .update(customerNotesTable)
        .set({ pinned: parsed.data.pinned })
        .where(eq(customerNotesTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    } catch (err) {
      logger.error({ err }, "admin_customers.notes.update.failed");
      res.status(500).json({ error: "Failed to update note" });
    }
  },
);

export default router;
