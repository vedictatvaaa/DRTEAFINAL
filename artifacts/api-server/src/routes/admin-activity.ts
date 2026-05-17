import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  adminActivityLogTable,
  adminCopilotActionLogTable,
  type ActivityKind,
  type ActivityActor,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/activity", requireAdmin);

const ACTIVITY_KINDS: ActivityKind[] = [
  "copilot_plan",
  "alert_seen",
  "alert_dismissed",
  "order_status_changed",
  "order_updated",
  "article_created",
  "article_updated",
  "article_published",
  "article_unpublished",
  "article_deleted",
  "product_created",
  "product_updated",
  "product_deleted",
  "customer_note_added",
  "team_member_invited",
  "team_member_updated",
  "team_member_revoked",
  "shipment_created",
  "shipment_dispatched",
  "shipment_delivered",
  "shipment_returned",
  "shipment_troubleshot",
  "shipment_reassigned",
  "manifest_closed",
  "return_created",
  "return_status_changed",
];

const ACTIVITY_ACTORS: ActivityActor[] = ["admin", "copilot", "system"];

// Group of related activity kinds — gives the UI a small set of filter
// chips (Co-pilot, Alerts, Orders, Articles, Products) without enumerating
// every kind in the URL.
const KIND_GROUPS: Record<string, ActivityKind[]> = {
  copilot: ["copilot_plan"],
  alerts: ["alert_seen", "alert_dismissed"],
  orders: ["order_status_changed", "order_updated"],
  articles: [
    "article_created",
    "article_updated",
    "article_published",
    "article_unpublished",
    "article_deleted",
  ],
  products: ["product_created", "product_updated", "product_deleted"],
  customers: ["customer_note_added"],
  team: [
    "team_member_invited",
    "team_member_updated",
    "team_member_revoked",
  ],
  shipping: [
    "shipment_created",
    "shipment_dispatched",
    "shipment_delivered",
    "shipment_returned",
    "shipment_troubleshot",
    "shipment_reassigned",
    "manifest_closed",
  ],
  returns: ["return_created", "return_status_changed"],
};

const ListQuery = z.object({
  group: z
    .enum([
      "copilot",
      "alerts",
      "orders",
      "articles",
      "products",
      "customers",
      "team",
      "shipping",
      "returns",
    ])
    .optional(),
  kind: z.enum(ACTIVITY_KINDS as [ActivityKind, ...ActivityKind[]]).optional(),
  actor: z.enum(ACTIVITY_ACTORS as [ActivityActor, ...ActivityActor[]]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().positive().optional(),
});

router.get("/admin/activity", async (req: Request, res: Response) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues,
    });
    return;
  }
  const { group, kind, actor, q, since, until, limit, before } = parsed.data;

  const filters: SQL[] = [];
  if (group) {
    const kinds = KIND_GROUPS[group] ?? [];
    if (kinds.length > 0) {
      filters.push(
        sql`${adminActivityLogTable.kind} IN (${sql.join(
          kinds.map((k) => sql`${k}`),
          sql`, `,
        )})`,
      );
    }
  }
  if (kind) filters.push(eq(adminActivityLogTable.kind, kind));
  if (actor) filters.push(eq(adminActivityLogTable.actor, actor));
  if (since) filters.push(gte(adminActivityLogTable.createdAt, since));
  if (until) filters.push(lte(adminActivityLogTable.createdAt, until));
  if (q) {
    const needle = `%${q}%`;
    filters.push(
      or(
        ilike(adminActivityLogTable.title, needle),
        ilike(adminActivityLogTable.summary, needle),
        ilike(adminActivityLogTable.entityId, needle),
      )!,
    );
  }
  if (before) {
    filters.push(sql`${adminActivityLogTable.id} < ${before}`);
  }

  try {
    const rows = await db
      .select()
      .from(adminActivityLogTable)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(adminActivityLogTable.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextBefore = hasMore ? items[items.length - 1]?.id ?? null : null;
    res.json({
      items,
      hasMore,
      nextBefore,
    });
  } catch (err) {
    logger.error({ err }, "admin_activity.list.failed");
    res.status(500).json({ error: "Failed to load activity" });
  }
});

// Stats endpoint — declared BEFORE the `/:id` route so Express does not
// match the literal "_stats" against the `:id` parameter and shadow this
// handler. Small counts used in the tab header so operators can scan
// "what's been happening today" without paging through the feed.
router.get("/admin/activity/_stats", async (_req: Request, res: Response) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(adminActivityLogTable);
    const [day] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(adminActivityLogTable)
      .where(gte(adminActivityLogTable.createdAt, since24h));
    const [week] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(adminActivityLogTable)
      .where(gte(adminActivityLogTable.createdAt, since7d));
    res.json({
      total: totalRow?.c ?? 0,
      last24h: day?.c ?? 0,
      last7d: week?.c ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "admin_activity.stats.failed");
    res.status(500).json({ error: "Failed to load activity stats" });
  }
});

router.get("/admin/activity/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(adminActivityLogTable)
      .where(eq(adminActivityLogTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // For copilot_plan rows, also load the matching copilot action log so
    // the drawer can show the full per-step plan + results without a second
    // round-trip.
    let copilotLog = null;
    if (row.kind === "copilot_plan" && row.entityId) {
      const logId = Number(row.entityId);
      if (Number.isInteger(logId)) {
        const [matched] = await db
          .select()
          .from(adminCopilotActionLogTable)
          .where(eq(adminCopilotActionLogTable.id, logId))
          .limit(1);
        copilotLog = matched ?? null;
      }
    }
    res.json({ row, copilotLog });
  } catch (err) {
    logger.error({ err }, "admin_activity.get.failed");
    res.status(500).json({ error: "Failed to load activity row" });
  }
});

export default router;
