import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { sql, desc, gte, eq, and } from "drizzle-orm";
import {
  db,
  productsTable,
  ordersTable,
  journalCommentsTable,
  articlesTable,
  adminAlertStateTable,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";
import { recordActivity } from "../lib/activity-log";

const router: IRouter = Router();
router.use("/admin/alerts", requireAdmin);

type AlertSeverity = "high" | "medium" | "low";
type AlertCategory =
  | "inventory"
  | "moderation"
  | "submission"
  | "order"
  | "failed_order";

interface ComputedAlert {
  key: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  body: string;
  href?: string;
  tabId?: string;
  createdAt: string;
}

const SINGLETON_ID = "singleton";

async function loadState() {
  const rows = await db
    .select()
    .from(adminAlertStateTable)
    .where(eq(adminAlertStateTable.id, SINGLETON_ID))
    .limit(1);
  if (rows[0]) return rows[0];
  // Lazily create the singleton row.
  await db
    .insert(adminAlertStateTable)
    .values({ id: SINGLETON_ID })
    .onConflictDoNothing();
  const created = await db
    .select()
    .from(adminAlertStateTable)
    .where(eq(adminAlertStateTable.id, SINGLETON_ID))
    .limit(1);
  return created[0]!;
}

async function computeAlerts(): Promise<ComputedAlert[]> {
  const out: ComputedAlert[] = [];
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1) Inventory: sum stock across variants, flag <=10 (low) and 0 (out).
  try {
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        slug: productsTable.slug,
        variants: productsTable.variants,
        updatedAt: productsTable.updatedAt,
      })
      .from(productsTable);
    for (const p of products) {
      const stock = (p.variants ?? []).reduce(
        (s: number, v) => s + (v?.stock ?? 0),
        0,
      );
      // Use the product's own updatedAt as the alert timestamp so the
      // alert isn't perpetually "new" each poll. This makes /seen actually
      // mark inventory alerts as read until inventory changes again.
      const stamp =
        p.updatedAt?.toISOString?.() ?? new Date(0).toISOString();
      if (stock <= 0) {
        out.push({
          key: `inventory:out:${p.id}`,
          category: "inventory",
          severity: "high",
          title: `${p.name} is OUT OF STOCK`,
          body: "All variants show 0 units. Restock to keep selling.",
          tabId: "products",
          createdAt: stamp,
        });
      } else if (stock <= 10) {
        out.push({
          key: `inventory:low:${p.id}`,
          category: "inventory",
          severity: "medium",
          title: `${p.name} is low`,
          body: `Only ${stock} units left across all variants.`,
          tabId: "products",
          createdAt: stamp,
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, "alerts.inventory.failed");
  }

  // 2) Pending journal comments awaiting moderation.
  try {
    const pending = await db
      .select({
        id: journalCommentsTable.id,
        articleSlug: journalCommentsTable.articleSlug,
        body: journalCommentsTable.body,
        authorName: journalCommentsTable.authorName,
        createdAt: journalCommentsTable.createdAt,
      })
      .from(journalCommentsTable)
      .where(eq(journalCommentsTable.status, "pending"))
      .orderBy(desc(journalCommentsTable.createdAt))
      .limit(20);
    for (const c of pending) {
      out.push({
        key: `moderation:comment:${c.id}`,
        category: "moderation",
        severity: "medium",
        title: `Comment from ${c.authorName || "Anonymous"} awaits review`,
        body: c.body.slice(0, 140),
        tabId: "community",
        createdAt: c.createdAt?.toISOString?.() ?? now.toISOString(),
      });
    }
  } catch (err) {
    logger.warn({ err }, "alerts.moderation.failed");
  }

  // 3) Shopper article submissions awaiting approval.
  try {
    const submissions = await db
      .select({
        id: articlesTable.id,
        title: articlesTable.title,
        authorName: articlesTable.authorName,
        createdAt: articlesTable.createdAt,
      })
      .from(articlesTable)
      .where(
        and(
          eq(articlesTable.status, "pending"),
          eq(articlesTable.authorType, "shopper"),
        ),
      )
      .orderBy(desc(articlesTable.createdAt))
      .limit(20);
    for (const s of submissions) {
      out.push({
        key: `submission:article:${s.id}`,
        category: "submission",
        severity: "medium",
        title: `New article "${s.title}" submitted`,
        body: `By ${s.authorName || "a community member"}.`,
        tabId: "community",
        createdAt: s.createdAt?.toISOString?.() ?? now.toISOString(),
      });
    }
  } catch (err) {
    logger.warn({ err }, "alerts.submissions.failed");
  }

  // 4) Failed / cancelled orders in the last 7 days.
  try {
    const failed = await db
      .select({
        id: ordersTable.id,
        customerName: ordersTable.customerName,
        total: ordersTable.total,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.createdAt, since7d),
          sql`${ordersTable.status} IN ('failed', 'cancelled')`,
        ),
      )
      .orderBy(desc(ordersTable.createdAt))
      .limit(20);
    for (const o of failed) {
      out.push({
        key: `failed_order:${o.id}`,
        category: "failed_order",
        severity: "high",
        title: `Order #${o.id} ${o.status}`,
        body: `${o.customerName} · ₹${(o.total ?? 0).toLocaleString("en-IN")}`,
        tabId: "orders",
        createdAt: o.createdAt?.toISOString?.() ?? now.toISOString(),
      });
    }
  } catch (err) {
    logger.warn({ err }, "alerts.failed_orders.failed");
  }

  // 5) New orders in the last 24h (informational, low severity).
  try {
    const newOrders = await db
      .select({
        id: ordersTable.id,
        customerName: ordersTable.customerName,
        total: ordersTable.total,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.createdAt, since24h),
          sql`${ordersTable.status} NOT IN ('failed', 'cancelled')`,
        ),
      )
      .orderBy(desc(ordersTable.createdAt))
      .limit(15);
    for (const o of newOrders) {
      out.push({
        key: `order:new:${o.id}`,
        category: "order",
        severity: "low",
        title: `New order #${o.id}`,
        body: `${o.customerName} · ₹${(o.total ?? 0).toLocaleString("en-IN")}`,
        tabId: "orders",
        createdAt: o.createdAt?.toISOString?.() ?? now.toISOString(),
      });
    }
  } catch (err) {
    logger.warn({ err }, "alerts.new_orders.failed");
  }

  // Sort newest first, severity-weighted.
  const sevWeight: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => {
    const w = sevWeight[a.severity] - sevWeight[b.severity];
    if (w !== 0) return w;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return out;
}

router.get("/admin/alerts", async (_req: Request, res: Response) => {
  try {
    const [state, alerts] = await Promise.all([loadState(), computeAlerts()]);
    const dismissed = state.dismissed ?? {};
    const lastSeenAt = state.lastSeenAt?.toISOString?.() ?? new Date(0).toISOString();
    const visible = alerts.filter((a) => !dismissed[a.key]);
    const unreadCount = visible.filter(
      (a) => new Date(a.createdAt).getTime() > new Date(lastSeenAt).getTime(),
    ).length;
    res.json({
      alerts: visible.slice(0, 60),
      lastSeenAt,
      unreadCount,
      total: visible.length,
    });
  } catch (err) {
    logger.error({ err }, "alerts.get.failed");
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

// Empty-body schema — explicitly reject any unexpected payload so the
// surface area stays narrow and consistent with /dismiss.
const SeenBody = z.object({}).strict();

router.post("/admin/alerts/seen", async (req: Request, res: Response) => {
  const parsed = SeenBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  try {
    await loadState();
    await db
      .update(adminAlertStateTable)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(adminAlertStateTable.id, SINGLETON_ID));
    void recordActivity({
      kind: "alert_seen",
      actor: "admin",
      title: "Marked admin alerts as seen",
      entityType: "alert",
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "alerts.seen.failed");
    res.status(500).json({ error: "Failed to mark seen" });
  }
});

const DismissBody = z.object({
  key: z.string().trim().min(3).max(200),
});

router.post("/admin/alerts/dismiss", async (req: Request, res: Response) => {
  const parsed = DismissBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  try {
    const state = await loadState();
    const dismissed = { ...(state.dismissed ?? {}), [parsed.data.key]: new Date().toISOString() };
    await db
      .update(adminAlertStateTable)
      .set({ dismissed, updatedAt: new Date() })
      .where(eq(adminAlertStateTable.id, SINGLETON_ID));
    void recordActivity({
      kind: "alert_dismissed",
      actor: "admin",
      title: `Dismissed alert: ${parsed.data.key}`,
      entityType: "alert",
      entityId: parsed.data.key,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "alerts.dismiss.failed");
    res.status(500).json({ error: "Failed to dismiss" });
  }
});

export default router;
