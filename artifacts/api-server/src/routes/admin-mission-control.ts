import {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import { sql, desc, eq, and, gte, lt, inArray } from "drizzle-orm";
import {
  db,
  productsTable,
  articlesTable,
  ordersTable,
  orderItemsTable,
  analyticsEventsTable,
  marketingCampaignsTable,
  wholesaleLeadsTable,
  productReviewsTable,
  journalCommentsTable,
  shopperUsersTable,
  missionBriefingsTable,
  shipmentsTable,
  subscriptionsTable,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";
import { chatCompletionJSON } from "../lib/openaiText";

const router: IRouter = Router();
router.use("/admin/mission-control", requireAdmin);

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function startOfDayUTC(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function daysAgoUTC(n: number, ref = new Date()): Date {
  const x = startOfDayUTC(ref);
  x.setUTCDate(x.getUTCDate() - n);
  return x;
}
function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

interface RangeMetrics {
  revenue: number;
  orders: number;
  aov: number;
  sessions: number;
  conversion: number; // 0..1
  newCustomers: number;
}

async function metricsForRange(from: Date, to: Date): Promise<RangeMetrics> {
  const [revRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${ordersTable.total}),0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, from),
        lt(ordersTable.createdAt, to),
        // Only revenue-bearing orders (exclude cancelled / failed)
        inArray(ordersTable.status, [
          "pending",
          "paid",
          "processing",
          "shipped",
          "delivered",
        ]),
      ),
    );
  const [sessRow] = await db
    .select({
      sessions: sql<number>`count(distinct ${analyticsEventsTable.sessionId})::int`,
    })
    .from(analyticsEventsTable)
    .where(
      and(
        gte(analyticsEventsTable.createdAt, from),
        lt(analyticsEventsTable.createdAt, to),
      ),
    );
  const [newCustRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(shopperUsersTable)
    .where(
      and(
        gte(shopperUsersTable.createdAt, from),
        lt(shopperUsersTable.createdAt, to),
      ),
    );

  const revenue = revRow?.total ?? 0;
  const orders = revRow?.count ?? 0;
  const sessions = sessRow?.sessions ?? 0;
  return {
    revenue,
    orders,
    aov: orders ? Math.round(revenue / orders) : 0,
    sessions,
    conversion: sessions ? orders / sessions : 0,
    newCustomers: newCustRow?.c ?? 0,
  };
}

async function revenueSeries(
  days: number,
): Promise<Array<{ date: string; revenue: number; orders: number }>> {
  const from = daysAgoUTC(days - 1);
  const rows = await db.execute(sql`
    select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') as date,
           coalesce(sum(total), 0)::int as revenue,
           count(*)::int as orders
    from orders
    where created_at >= ${from}
      and status in ('pending','paid','processing','shipped','delivered')
    group by 1
    order by 1
  `);
  type R = { date: string; revenue: number; orders: number };
  const map = new Map<string, R>(
    (rows.rows as R[]).map((r) => [r.date, r]),
  );
  const out: R[] = [];
  for (let i = 0; i < days; i++) {
    const d = daysAgoUTC(days - 1 - i);
    const key = d.toISOString().slice(0, 10);
    out.push(map.get(key) ?? { date: key, revenue: 0, orders: 0 });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// GET /admin/mission-control — full snapshot
// ──────────────────────────────────────────────────────────────────────────
router.get(
  "/admin/mission-control",
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const t0 = startOfDayUTC(now);
      const t1 = new Date(t0.getTime() + 24 * 60 * 60 * 1000);
      const w0 = daysAgoUTC(6);
      const w1 = t1;
      const m0 = daysAgoUTC(29);
      const prevW0 = daysAgoUTC(13);
      const prevW1 = daysAgoUTC(6);

      const [today, week, month, prevWeek] = await Promise.all([
        metricsForRange(t0, t1),
        metricsForRange(w0, w1),
        metricsForRange(m0, w1),
        metricsForRange(prevW0, prevW1),
      ]);

      // 30-day revenue spark
      const series30 = await revenueSeries(30);

      // Inventory health
      const allProducts = await db.select().from(productsTable);
      let lowCount = 0;
      let outCount = 0;
      const lowStock: Array<{ id: string; name: string; stock: number }> = [];
      for (const p of allProducts) {
        const stock = (p.variants ?? []).reduce(
          (s, v) => s + (v?.stock ?? 0),
          0,
        );
        if (stock <= 0) outCount++;
        else if (stock < 20) {
          lowCount++;
          lowStock.push({ id: p.id, name: p.name, stock });
        }
      }
      lowStock.sort((a, b) => a.stock - b.stock);

      // Content velocity
      const [draftCount] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(articlesTable)
        .where(eq(articlesTable.published, false));
      const [pub7Row] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(articlesTable)
        .where(
          and(
            eq(articlesTable.published, true),
            gte(articlesTable.createdAt, w0),
          ),
        );

      // Marketing pulse (last 30d emails)
      const recentCampaigns = await db
        .select()
        .from(marketingCampaignsTable)
        .orderBy(desc(marketingCampaignsTable.createdAt))
        .limit(20);
      let sent = 0;
      let opens = 0;
      let clicks = 0;
      for (const c of recentCampaigns) {
        sent += c.sentCount ?? 0;
        opens += c.openCount ?? 0;
        clicks += c.clickCount ?? 0;
      }

      // Wholesale pipeline
      const wholesale = await db
        .select({
          status: wholesaleLeadsTable.status,
          c: sql<number>`count(*)::int`,
        })
        .from(wholesaleLeadsTable)
        .groupBy(wholesaleLeadsTable.status);
      const wholesalePipeline: Record<string, number> = {
        new: 0,
        contacted: 0,
        quoted: 0,
        won: 0,
        lost: 0,
      };
      for (const r of wholesale) wholesalePipeline[r.status] = r.c;

      // Moderation queue counts
      const [pendingReviewsRow] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(productReviewsTable)
        .where(eq(productReviewsTable.status, "pending"));
      const [pendingCommentsRow] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(journalCommentsTable)
        .where(eq(journalCommentsTable.status, "pending"));

      // Top products (last 30d) by units sold
      const topProductsRows = await db.execute(sql`
        select p.id, p.name, p.slug,
               coalesce(sum(oi.quantity),0)::int as units,
               coalesce(sum(oi.quantity * oi.unit_price),0)::int as revenue
        from order_items oi
        join orders o on o.id = oi.order_id
        join products p on p.id = oi.product_id
        where o.created_at >= ${m0}
          and o.status in ('pending','paid','processing','shipped','delivered')
        group by p.id, p.name, p.slug
        order by units desc
        limit 5
      `);

      function pctDelta(curr: number, prev: number): number | null {
        if (prev === 0) return curr === 0 ? 0 : null;
        return (curr - prev) / prev;
      }

      res.json({
        generatedAt: now.toISOString(),
        kpis: {
          today,
          week,
          month,
          deltas: {
            revenue: pctDelta(week.revenue, prevWeek.revenue),
            orders: pctDelta(week.orders, prevWeek.orders),
            aov: pctDelta(week.aov, prevWeek.aov),
            sessions: pctDelta(week.sessions, prevWeek.sessions),
            conversion: pctDelta(week.conversion, prevWeek.conversion),
            newCustomers: pctDelta(week.newCustomers, prevWeek.newCustomers),
          },
        },
        series30,
        inventory: {
          totalSkus: allProducts.length,
          lowCount,
          outCount,
          lowStock: lowStock.slice(0, 8),
        },
        content: {
          draftCount: draftCount?.c ?? 0,
          published7d: pub7Row?.c ?? 0,
        },
        marketing: {
          recent: sent,
          openRate: sent ? opens / sent : 0,
          clickRate: sent ? clicks / sent : 0,
          activeCampaigns: recentCampaigns.filter(
            (c) => c.status === "sending",
          ).length,
        },
        pipeline: { wholesale: wholesalePipeline },
        moderation: {
          pendingReviews: pendingReviewsRow?.c ?? 0,
          pendingComments: pendingCommentsRow?.c ?? 0,
        },
        topProducts: topProductsRows.rows as Array<{
          id: number;
          name: string;
          slug: string;
          units: number;
          revenue: number;
        }>,
      });
    } catch (err) {
      logger.error({ err }, "mission-control.snapshot.failed");
      res.status(500).json({ error: "Could not load Mission Control" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// GET /admin/mission-control/briefing — AI-generated daily briefing
// Cached per UTC day; ?refresh=1 forces regeneration.
// ──────────────────────────────────────────────────────────────────────────
interface BriefingPayload {
  headline: string;
  wins: string[];
  risks: string[];
  action: string;
}

async function generateBriefing(
  snapshot: Record<string, unknown>,
): Promise<BriefingPayload | null> {
  const result = await chatCompletionJSON<BriefingPayload>({
    systemPrompt:
      'You are the chief of staff for Dr Tea, a premium Indian tea D2C brand. ' +
      'Read the JSON snapshot and produce a punchy daily briefing for the founder. ' +
      'Be specific (use numbers from the snapshot, INR currency). No fluff. ' +
      'Output JSON: { "headline": string (≤80 chars), ' +
      '"wins": string[] (exactly 3, ≤120 chars each), ' +
      '"risks": string[] (exactly 2, ≤120 chars each), ' +
      '"action": string (single most important next move, ≤140 chars) }',
    userPrompt: `Today's snapshot:\n${JSON.stringify(snapshot)}`,
    maxTokens: 700,
  });
  if (!result) return null;
  return {
    headline: String(result.headline ?? "").slice(0, 200),
    wins: Array.isArray(result.wins)
      ? result.wins.slice(0, 3).map((s) => String(s).slice(0, 200))
      : [],
    risks: Array.isArray(result.risks)
      ? result.risks.slice(0, 2).map((s) => String(s).slice(0, 200))
      : [],
    action: String(result.action ?? "").slice(0, 240),
  };
}

router.get(
  "/admin/mission-control/briefing",
  async (req: Request, res: Response) => {
    const refresh = req.query.refresh === "1";
    const key = todayKey();
    try {
      if (!refresh) {
        const [existing] = await db
          .select()
          .from(missionBriefingsTable)
          .where(eq(missionBriefingsTable.forDate, key));
        if (existing) {
          res.json({
            forDate: existing.forDate,
            headline: existing.headline,
            wins: existing.wins,
            risks: existing.risks,
            action: existing.action,
            cached: true,
            createdAt: existing.createdAt,
          });
          return;
        }
      }

      // Build a compact snapshot for the model (subset of full Mission Control)
      const now = new Date();
      const t0 = startOfDayUTC(now);
      const t1 = new Date(t0.getTime() + 24 * 60 * 60 * 1000);
      const w0 = daysAgoUTC(6);
      const prevW0 = daysAgoUTC(13);
      const prevW1 = daysAgoUTC(6);
      const [today, week, prev] = await Promise.all([
        metricsForRange(t0, t1),
        metricsForRange(w0, t1),
        metricsForRange(prevW0, prevW1),
      ]);

      const allProducts = await db.select().from(productsTable);
      let outCount = 0;
      let lowCount = 0;
      for (const p of allProducts) {
        const stock = (p.variants ?? []).reduce(
          (s, v) => s + (v?.stock ?? 0),
          0,
        );
        if (stock <= 0) outCount++;
        else if (stock < 20) lowCount++;
      }
      const [pendingReviews] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(productReviewsTable)
        .where(eq(productReviewsTable.status, "pending"));
      const [newLeads] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(wholesaleLeadsTable)
        .where(eq(wholesaleLeadsTable.status, "new"));

      const snapshot = {
        currency: "INR",
        today,
        week,
        previousWeek: prev,
        inventory: {
          out: outCount,
          low: lowCount,
          totalSkus: allProducts.length,
        },
        moderation: { pendingReviews: pendingReviews?.c ?? 0 },
        wholesale: { newLeads: newLeads?.c ?? 0 },
      };

      const briefing = await generateBriefing(snapshot);
      if (!briefing) {
        // Deterministic fallback so the UI never breaks even without AI.
        const fallback: BriefingPayload = {
          headline: "Daily snapshot ready.",
          wins: [
            `Week revenue: ₹${week.revenue.toLocaleString("en-IN")} across ${week.orders} orders.`,
            `New customers this week: ${week.newCustomers}.`,
            `Conversion: ${(week.conversion * 100).toFixed(2)}%.`,
          ],
          risks: [
            `${outCount} SKUs out of stock, ${lowCount} running low.`,
            `${pendingReviews?.c ?? 0} reviews pending moderation.`,
          ],
          action:
            outCount + lowCount > 0
              ? "Restock low/out SKUs to protect this week's revenue."
              : "Plan next campaign to compound momentum.",
        };
        res.json({
          forDate: key,
          ...fallback,
          cached: false,
          generated: false,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      // Persist (upsert by date)
      await db
        .insert(missionBriefingsTable)
        .values({
          forDate: key,
          headline: briefing.headline,
          wins: briefing.wins,
          risks: briefing.risks,
          action: briefing.action,
          model: "gpt-5-mini",
          inputSnapshot: snapshot,
        })
        .onConflictDoUpdate({
          target: missionBriefingsTable.forDate,
          set: {
            headline: briefing.headline,
            wins: briefing.wins,
            risks: briefing.risks,
            action: briefing.action,
            model: "gpt-5-mini",
            inputSnapshot: snapshot,
          },
        });

      res.json({
        forDate: key,
        ...briefing,
        cached: false,
        generated: true,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, "mission-control.briefing.failed");
      res.status(500).json({ error: "Could not generate briefing" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// GET /admin/mission-control/intelligence — derived KPIs operators actually
// run the business on. Everything here is computed from existing tables;
// no schema changes required.
//
// Computed:
//   inventory.velocity[]   units/day per SKU over last 30d, DOH, urgency
//   inventory.deadStock[]  SKUs with stock>0 but 0 sales in 30d
//   inventory.sellThrough  pct of stocked SKUs that moved any units in 30d
//   customers.repeatRate   shoppers with ≥2 orders / shoppers with ≥1 order
//   customers.newRevenueShare / returningRevenueShare (last 30d)
//   customers.avgDaysBetweenOrders (across repeat shoppers)
//   customers.estimatedLtv = AOV30d × purchasesPerYear × repeatMultiplier
//   ops.avgPaidToShipHours (orders that *did* ship in last 30d)
//   ops.unshippedAged24h / 48h (paid/processing with no shipment)
//   ops.cancelRate30d      cancelled / (revenue-bearing + cancelled)
//   ops.openShipmentsAged7d shipments shipped >7d ago not yet delivered
//   subs.activeCount, mrr (₹/4-week period normalised), churn30d,
//        upcoming7d (count + projected revenue)
// ──────────────────────────────────────────────────────────────────────────

interface VelocityRow {
  productId: string;
  name: string;
  stock: number;
  units30d: number;
  perDay: number;
  daysOnHand: number | null; // null = no sales velocity
  urgency: "critical" | "low" | "ok" | "overstock";
}

router.get(
  "/admin/mission-control/intelligence",
  async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const t1 = new Date(startOfDayUTC(now).getTime() + 24 * 60 * 60 * 1000);
      const m0 = daysAgoUTC(29);
      const w0 = daysAgoUTC(6);
      const REVENUE_STATUSES = [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
      ] as const;

      // ── Inventory velocity ────────────────────────────────────────────
      const allProducts = await db.select().from(productsTable);
      const stockMap = new Map<string, number>();
      for (const p of allProducts) {
        const s = (p.variants ?? []).reduce(
          (acc, v) => acc + (v?.stock ?? 0),
          0,
        );
        stockMap.set(p.id, s);
      }
      const salesRows = await db.execute(sql`
        select oi.product_id as id,
               coalesce(sum(oi.quantity), 0)::int as units
        from order_items oi
        join orders o on o.id = oi.order_id
        where o.created_at >= ${m0}
          and o.status in ('pending','paid','processing','shipped','delivered')
        group by oi.product_id
      `);
      const sold30 = new Map<string, number>(
        (salesRows.rows as Array<{ id: string; units: number }>).map((r) => [
          r.id,
          r.units,
        ]),
      );

      const velocity: VelocityRow[] = [];
      const deadStock: Array<{ id: string; name: string; stock: number }> = [];
      let stockedSkus = 0;
      let movingSkus = 0;
      for (const p of allProducts) {
        const stock = stockMap.get(p.id) ?? 0;
        const units = sold30.get(p.id) ?? 0;
        if (stock > 0) stockedSkus++;
        if (units > 0) movingSkus++;
        const perDay = units / 30;
        const doh = perDay > 0 ? Math.round(stock / perDay) : null;
        let urgency: VelocityRow["urgency"];
        if (doh === null) urgency = stock > 0 ? "overstock" : "ok";
        else if (doh <= 7) urgency = "critical";
        else if (doh <= 21) urgency = "low";
        else if (doh > 120) urgency = "overstock";
        else urgency = "ok";
        velocity.push({
          productId: p.id,
          name: p.name,
          stock,
          units30d: units,
          perDay: Math.round(perDay * 100) / 100,
          daysOnHand: doh,
          urgency,
        });
        if (stock > 0 && units === 0) {
          deadStock.push({ id: p.id, name: p.name, stock });
        }
      }
      // Surface the most urgent first (lowest non-null DOH), then dead stock.
      velocity.sort((a, b) => {
        const ax = a.daysOnHand ?? Number.POSITIVE_INFINITY;
        const bx = b.daysOnHand ?? Number.POSITIVE_INFINITY;
        return ax - bx;
      });

      // ── Customer LTV & repeat behaviour ────────────────────────────────
      const customerAggRows = await db.execute(sql`
        select coalesce(shopper_user_id, lower(customer_email)) as cid,
               count(*)::int as orders,
               sum(total)::int as spend,
               min(created_at) as first_at,
               max(created_at) as last_at
        from orders
        where status in ('pending','paid','processing','shipped','delivered')
        group by 1
      `);
      type CRow = {
        cid: string;
        orders: number;
        spend: number;
        first_at: string;
        last_at: string;
      };
      const customers = customerAggRows.rows as CRow[];
      const totalCustomers = customers.length;
      const repeatCustomers = customers.filter((c) => c.orders >= 2).length;
      const repeatRate = totalCustomers ? repeatCustomers / totalCustomers : 0;

      // Avg days between orders, only for shoppers with ≥2 orders
      let gapDaysSum = 0;
      let gapCount = 0;
      for (const c of customers) {
        if (c.orders < 2) continue;
        const span =
          (new Date(c.last_at).getTime() - new Date(c.first_at).getTime()) /
          86_400_000;
        const gap = span / (c.orders - 1);
        if (Number.isFinite(gap) && gap > 0) {
          gapDaysSum += gap;
          gapCount++;
        }
      }
      const avgDaysBetweenOrders = gapCount ? gapDaysSum / gapCount : 0;

      // 30-day new vs returning split. A shopper is "new" if their *first*
      // order falls inside the window.
      const firstOrderById = new Map<string, Date>();
      for (const c of customers) firstOrderById.set(c.cid, new Date(c.first_at));
      const recentOrders = await db
        .select({
          shopperUserId: ordersTable.shopperUserId,
          customerEmail: ordersTable.customerEmail,
          total: ordersTable.total,
          createdAt: ordersTable.createdAt,
        })
        .from(ordersTable)
        .where(
          and(
            gte(ordersTable.createdAt, m0),
            inArray(ordersTable.status, REVENUE_STATUSES as unknown as string[]),
          ),
        );
      let newRev = 0;
      let returningRev = 0;
      let recentRev = 0;
      let recentOrderCount = 0;
      for (const o of recentOrders) {
        const cid = o.shopperUserId ?? o.customerEmail.toLowerCase();
        const first = firstOrderById.get(cid);
        recentRev += o.total;
        recentOrderCount++;
        if (first && first >= m0) newRev += o.total;
        else returningRev += o.total;
      }
      const aov30 = recentOrderCount ? recentRev / recentOrderCount : 0;
      // Crude LTV: AOV × estimated annual purchase frequency × (1 + repeatRate)
      // The repeat-rate multiplier nudges LTV up when we retain shoppers;
      // it's a directional KPI, not a forecast.
      const purchasesPerYear =
        avgDaysBetweenOrders > 0 ? 365 / avgDaysBetweenOrders : 1;
      const estimatedLtv = Math.round(aov30 * purchasesPerYear * (1 + repeatRate));

      // ── Operations: fulfilment SLA & cancel rate ──────────────────────
      const shippedRecent = await db.execute(sql`
        select extract(epoch from (s.shipped_at - o.created_at))/3600 as hours
        from shipments s
        join orders o on o.id = s.order_id
        where s.shipped_at is not null
          and s.shipped_at >= ${m0}
      `);
      const shipHours = (shippedRecent.rows as Array<{ hours: number | string }>)
        .map((r) => Number(r.hours))
        .filter((h) => Number.isFinite(h) && h >= 0);
      const avgPaidToShipHours = shipHours.length
        ? shipHours.reduce((s, h) => s + h, 0) / shipHours.length
        : 0;
      const medPaidToShipHours = shipHours.length
        ? [...shipHours].sort((a, b) => a - b)[Math.floor(shipHours.length / 2)]
        : 0;

      const unshippedRows = await db.execute(sql`
        select extract(epoch from (now() - o.created_at))/3600 as hours
        from orders o
        left join shipments s on s.order_id = o.id
        where o.status in ('paid','processing')
          and s.id is null
      `);
      const unshippedAges = (unshippedRows.rows as Array<{ hours: number | string }>)
        .map((r) => Number(r.hours))
        .filter((h) => Number.isFinite(h));
      const unshippedAged24h = unshippedAges.filter((h) => h >= 24).length;
      const unshippedAged48h = unshippedAges.filter((h) => h >= 48).length;
      const unshippedTotal = unshippedAges.length;

      const [cancelRow] = await db
        .select({
          cancelled: sql<number>`sum(case when status='cancelled' then 1 else 0 end)::int`,
          revenueBearing: sql<number>`sum(case when status in ('pending','paid','processing','shipped','delivered') then 1 else 0 end)::int`,
        })
        .from(ordersTable)
        .where(gte(ordersTable.createdAt, m0));
      const cancelled = cancelRow?.cancelled ?? 0;
      const revBear = cancelRow?.revenueBearing ?? 0;
      const cancelRate30d =
        cancelled + revBear > 0 ? cancelled / (cancelled + revBear) : 0;

      const stuckShipmentsRows = await db.execute(sql`
        select count(*)::int as c
        from shipments
        where shipped_at is not null
          and delivered_at is null
          and shipped_at < ${daysAgoUTC(7)}
      `);
      const openShipmentsAged7d =
        (stuckShipmentsRows.rows[0] as { c: number } | undefined)?.c ?? 0;

      // ── Subscription health ───────────────────────────────────────────
      const allSubs = await db.select().from(subscriptionsTable);
      const activeSubs = allSubs.filter((s) => s.status === "active");
      // MRR normalised to a 4-week (28-day) period for simplicity.
      let mrr = 0;
      for (const s of activeSubs) {
        const lineTotal =
          s.unitPrice * s.quantity * (1 - (s.discountPct ?? 0) / 100);
        const periodsPer28 = s.frequencyWeeks > 0 ? 4 / s.frequencyWeeks : 0;
        mrr += lineTotal * periodsPer28;
      }
      const churned30d = allSubs.filter(
        (s) =>
          s.status !== "active" &&
          s.updatedAt &&
          new Date(s.updatedAt) >= m0,
      ).length;
      const activeAtStart = activeSubs.length + churned30d;
      const churnRate30d = activeAtStart > 0 ? churned30d / activeAtStart : 0;
      const upcoming = activeSubs.filter(
        (s) => new Date(s.nextDeliveryAt) < new Date(t1.getTime() + 7 * 86_400_000),
      );
      const upcoming7dRevenue = upcoming.reduce(
        (sum, s) =>
          sum +
          Math.round(s.unitPrice * s.quantity * (1 - (s.discountPct ?? 0) / 100)),
        0,
      );

      res.json({
        generatedAt: now.toISOString(),
        inventory: {
          totalSkus: allProducts.length,
          stockedSkus,
          movingSkus,
          sellThroughRate: stockedSkus ? movingSkus / stockedSkus : 0,
          deadStockCount: deadStock.length,
          deadStock: deadStock.slice(0, 8),
          urgent: velocity.filter((v) => v.urgency === "critical").slice(0, 8),
          velocity: velocity.slice(0, 12),
        },
        customers: {
          totalCustomers,
          repeatCustomers,
          repeatRate,
          avgDaysBetweenOrders: Math.round(avgDaysBetweenOrders * 10) / 10,
          aov30: Math.round(aov30),
          estimatedLtv,
          newRevenue30d: newRev,
          returningRevenue30d: returningRev,
          newRevenueShare: recentRev ? newRev / recentRev : 0,
          returningRevenueShare: recentRev ? returningRev / recentRev : 0,
        },
        ops: {
          avgPaidToShipHours: Math.round(avgPaidToShipHours * 10) / 10,
          medianPaidToShipHours: Math.round(medPaidToShipHours * 10) / 10,
          shippedSampleSize: shipHours.length,
          unshippedTotal,
          unshippedAged24h,
          unshippedAged48h,
          cancelRate30d,
          cancelledCount30d: cancelled,
          openShipmentsAged7d,
        },
        subs: {
          activeCount: activeSubs.length,
          totalCount: allSubs.length,
          mrr: Math.round(mrr),
          churned30d,
          churnRate30d,
          upcoming7dCount: upcoming.length,
          upcoming7dRevenue,
        },
      });
    } catch (err) {
      logger.error({ err }, "mission-control.intelligence.failed");
      res.status(500).json({ error: "Could not compute intelligence" });
    }
  },
);

// Touch order_items so the import isn't unused if we tree-shake later.
void orderItemsTable;

export default router;
