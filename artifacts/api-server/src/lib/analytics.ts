import { sql } from "drizzle-orm";
import { db, analyticsEventsTable } from "./db";

export interface AnalyticsSummary {
  windowDays: number;
  totals: {
    events: number;
    sessions: number;
    pageViews: number;
    productViews: number;
    addToCart: number;
    checkoutStart: number;
    orders: number;
    revenue: number;
  };
  funnel: {
    pageViewSessions: number;
    productViewSessions: number;
    addToCartSessions: number;
    checkoutStartSessions: number;
    orderSessions: number;
  };
  trafficByDay: Array<{ date: string; sessions: number; pageViews: number; orders: number }>;
  topPages: Array<{ path: string; views: number }>;
  topProducts: Array<{ productId: string; views: number; addToCart: number; orders: number }>;
  referrers: Array<{ referrer: string; sessions: number }>;
  utmSources: Array<{ source: string; sessions: number }>;
  utmCampaigns: Array<{ campaign: string; sessions: number }>;
  countries: Array<{ country: string; sessions: number }>;
  currencies: Array<{ currency: string; sessions: number }>;
}

const since = (days: number) => sql`now() - (${days}::int * interval '1 day')`;

/**
 * Compute every aggregate the dashboard needs in a single helper. Uses
 * SQL `count(distinct …) filter (where …)` so we can fan out without making
 * dozens of round-trips.
 */
export async function computeAnalyticsSummary(windowDays: number): Promise<AnalyticsSummary> {
  const days = Math.max(1, Math.min(365, Math.floor(windowDays)));

  const [totalsRow] = (await db.execute(sql`
    select
      count(*)::int as events,
      count(distinct ${analyticsEventsTable.sessionId})::int as sessions,
      count(*) filter (where ${analyticsEventsTable.type} = 'page_view')::int as page_views,
      count(*) filter (where ${analyticsEventsTable.type} = 'product_view')::int as product_views,
      count(*) filter (where ${analyticsEventsTable.type} = 'add_to_cart')::int as add_to_cart,
      count(*) filter (where ${analyticsEventsTable.type} = 'checkout_start')::int as checkout_start,
      count(*) filter (where ${analyticsEventsTable.type} = 'order_placed')::int as orders,
      coalesce(sum(${analyticsEventsTable.value}) filter (where ${analyticsEventsTable.type} = 'order_placed'), 0)::bigint as revenue
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.createdAt} >= ${since(days)}
  `)).rows as unknown as Array<{
    events: number; sessions: number; page_views: number; product_views: number;
    add_to_cart: number; checkout_start: number; orders: number; revenue: string | number;
  }>;

  const [funnelRow] = (await db.execute(sql`
    select
      count(distinct ${analyticsEventsTable.sessionId}) filter (where ${analyticsEventsTable.type} = 'page_view')::int as page_view_sessions,
      count(distinct ${analyticsEventsTable.sessionId}) filter (where ${analyticsEventsTable.type} = 'product_view')::int as product_view_sessions,
      count(distinct ${analyticsEventsTable.sessionId}) filter (where ${analyticsEventsTable.type} = 'add_to_cart')::int as add_to_cart_sessions,
      count(distinct ${analyticsEventsTable.sessionId}) filter (where ${analyticsEventsTable.type} = 'checkout_start')::int as checkout_start_sessions,
      count(distinct ${analyticsEventsTable.sessionId}) filter (where ${analyticsEventsTable.type} = 'order_placed')::int as order_sessions
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.createdAt} >= ${since(days)}
  `)).rows as unknown as Array<{
    page_view_sessions: number; product_view_sessions: number; add_to_cart_sessions: number;
    checkout_start_sessions: number; order_sessions: number;
  }>;

  const trafficRows = (await db.execute(sql`
    with days as (
      select generate_series(date_trunc('day', now()) - ((${days}::int - 1) * interval '1 day'),
                             date_trunc('day', now()),
                             interval '1 day') as d
    )
    select
      to_char(d, 'YYYY-MM-DD') as date,
      coalesce(count(distinct ${analyticsEventsTable.sessionId}), 0)::int as sessions,
      coalesce(count(*) filter (where ${analyticsEventsTable.type} = 'page_view'), 0)::int as page_views,
      coalesce(count(*) filter (where ${analyticsEventsTable.type} = 'order_placed'), 0)::int as orders
    from days
    left join ${analyticsEventsTable}
      on date_trunc('day', ${analyticsEventsTable.createdAt}) = d
    group by d
    order by d asc
  `)).rows as unknown as Array<{ date: string; sessions: number; page_views: number; orders: number }>;

  const topPagesRows = (await db.execute(sql`
    select ${analyticsEventsTable.path} as path, count(*)::int as views
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.type} = 'page_view'
      and ${analyticsEventsTable.createdAt} >= ${since(days)}
      and ${analyticsEventsTable.path} <> ''
    group by ${analyticsEventsTable.path}
    order by views desc
    limit 10
  `)).rows as unknown as Array<{ path: string; views: number }>;

  const topProductsRows = (await db.execute(sql`
    select
      ${analyticsEventsTable.productId} as product_id,
      count(*) filter (where ${analyticsEventsTable.type} = 'product_view')::int as views,
      count(*) filter (where ${analyticsEventsTable.type} = 'add_to_cart')::int as add_to_cart,
      count(*) filter (where ${analyticsEventsTable.type} = 'order_placed')::int as orders
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.productId} is not null
      and ${analyticsEventsTable.createdAt} >= ${since(days)}
    group by ${analyticsEventsTable.productId}
    order by views desc nulls last
    limit 10
  `)).rows as unknown as Array<{ product_id: string; views: number; add_to_cart: number; orders: number }>;

  const referrerRows = (await db.execute(sql`
    select coalesce(nullif(${analyticsEventsTable.referrer}, ''), '(direct)') as referrer,
           count(distinct ${analyticsEventsTable.sessionId})::int as sessions
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.createdAt} >= ${since(days)}
    group by 1 order by sessions desc limit 10
  `)).rows as unknown as Array<{ referrer: string; sessions: number }>;

  const utmSourceRows = (await db.execute(sql`
    select coalesce(nullif(${analyticsEventsTable.utmSource}, ''), '(none)') as source,
           count(distinct ${analyticsEventsTable.sessionId})::int as sessions
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.createdAt} >= ${since(days)}
    group by 1 order by sessions desc limit 10
  `)).rows as unknown as Array<{ source: string; sessions: number }>;

  const utmCampaignRows = (await db.execute(sql`
    select coalesce(nullif(${analyticsEventsTable.utmCampaign}, ''), '(none)') as campaign,
           count(distinct ${analyticsEventsTable.sessionId})::int as sessions
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.createdAt} >= ${since(days)}
    group by 1 order by sessions desc limit 10
  `)).rows as unknown as Array<{ campaign: string; sessions: number }>;

  const countryRows = (await db.execute(sql`
    select coalesce(nullif(${analyticsEventsTable.country}, ''), '(unknown)') as country,
           count(distinct ${analyticsEventsTable.sessionId})::int as sessions
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.createdAt} >= ${since(days)}
    group by 1 order by sessions desc limit 10
  `)).rows as unknown as Array<{ country: string; sessions: number }>;

  const currencyRows = (await db.execute(sql`
    select coalesce(nullif(${analyticsEventsTable.currency}, ''), '(unknown)') as currency,
           count(distinct ${analyticsEventsTable.sessionId})::int as sessions
    from ${analyticsEventsTable}
    where ${analyticsEventsTable.createdAt} >= ${since(days)}
    group by 1 order by sessions desc limit 10
  `)).rows as unknown as Array<{ currency: string; sessions: number }>;

  return {
    windowDays: days,
    totals: {
      events: totalsRow?.events ?? 0,
      sessions: totalsRow?.sessions ?? 0,
      pageViews: totalsRow?.page_views ?? 0,
      productViews: totalsRow?.product_views ?? 0,
      addToCart: totalsRow?.add_to_cart ?? 0,
      checkoutStart: totalsRow?.checkout_start ?? 0,
      orders: totalsRow?.orders ?? 0,
      revenue: Number(totalsRow?.revenue ?? 0),
    },
    funnel: {
      pageViewSessions: funnelRow?.page_view_sessions ?? 0,
      productViewSessions: funnelRow?.product_view_sessions ?? 0,
      addToCartSessions: funnelRow?.add_to_cart_sessions ?? 0,
      checkoutStartSessions: funnelRow?.checkout_start_sessions ?? 0,
      orderSessions: funnelRow?.order_sessions ?? 0,
    },
    trafficByDay: trafficRows.map((r) => ({
      date: r.date, sessions: r.sessions, pageViews: r.page_views, orders: r.orders,
    })),
    topPages: topPagesRows.map((r) => ({ path: r.path, views: r.views })),
    topProducts: topProductsRows.map((r) => ({
      productId: r.product_id, views: r.views, addToCart: r.add_to_cart, orders: r.orders,
    })),
    referrers: referrerRows,
    utmSources: utmSourceRows.map((r) => ({ source: r.source, sessions: r.sessions })),
    utmCampaigns: utmCampaignRows.map((r) => ({ campaign: r.campaign, sessions: r.sessions })),
    countries: countryRows,
    currencies: currencyRows,
  };
}

/**
 * Weighted moving average + day-of-week seasonality forecast for the next
 * `horizonDays` days. Uses the last 28 days of orders/revenue as the base
 * series. Deterministic and dependency-free so it works without AI.
 */
export interface SalesForecastPoint { date: string; orders: number; revenue: number }
export interface SalesForecast {
  horizonDays: number;
  history: SalesForecastPoint[];
  forecast: SalesForecastPoint[];
  assumptions: { lookbackDays: number; weightingHalfLifeDays: number; seasonality: "day-of-week" };
}

export async function computeSalesForecast(horizonDays = 7): Promise<SalesForecast> {
  const lookback = 28;
  const rows = (await db.execute(sql`
    with days as (
      select generate_series(date_trunc('day', now()) - (${lookback - 1}::int * interval '1 day'),
                             date_trunc('day', now()),
                             interval '1 day') as d
    )
    select
      to_char(d, 'YYYY-MM-DD') as date,
      coalesce(count(${analyticsEventsTable.id}) filter (where ${analyticsEventsTable.type} = 'order_placed'), 0)::int as orders,
      coalesce(sum(${analyticsEventsTable.value}) filter (where ${analyticsEventsTable.type} = 'order_placed'), 0)::bigint as revenue
    from days
    left join ${analyticsEventsTable}
      on date_trunc('day', ${analyticsEventsTable.createdAt}) = d
    group by d
    order by d asc
  `)).rows as unknown as Array<{ date: string; orders: number; revenue: string | number }>;

  const history: SalesForecastPoint[] = rows.map((r) => ({
    date: r.date, orders: r.orders, revenue: Number(r.revenue),
  }));

  // Weighted moving average with half-life of 7 days.
  const halfLife = 7;
  const weight = (i: number) => Math.pow(0.5, i / halfLife);

  // Day-of-week seasonality multiplier from history.
  const dowAvg: Record<number, { o: number; r: number; n: number }> = {};
  history.forEach((p) => {
    const dow = new Date(p.date).getUTCDay();
    const slot = dowAvg[dow] ?? { o: 0, r: 0, n: 0 };
    slot.o += p.orders; slot.r += p.revenue; slot.n += 1;
    dowAvg[dow] = slot;
  });
  const overallO = history.reduce((s, p) => s + p.orders, 0) / Math.max(1, history.length);
  const overallR = history.reduce((s, p) => s + p.revenue, 0) / Math.max(1, history.length);
  const dowFactor = (dow: number, kind: "o" | "r"): number => {
    const slot = dowAvg[dow];
    if (!slot || slot.n === 0) return 1;
    const overall = kind === "o" ? overallO : overallR;
    if (overall === 0) return 1;
    return ((kind === "o" ? slot.o : slot.r) / slot.n) / overall;
  };

  // Weighted base.
  let wSumO = 0, wSumR = 0, wTotal = 0;
  history.slice().reverse().forEach((p, idx) => {
    const w = weight(idx);
    wSumO += p.orders * w; wSumR += p.revenue * w; wTotal += w;
  });
  const baseO = wTotal > 0 ? wSumO / wTotal : 0;
  const baseR = wTotal > 0 ? wSumR / wTotal : 0;

  const forecast: SalesForecastPoint[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    forecast.push({
      date,
      orders: Math.max(0, Math.round(baseO * dowFactor(dow, "o"))),
      revenue: Math.max(0, Math.round(baseR * dowFactor(dow, "r"))),
    });
  }

  return {
    horizonDays,
    history,
    forecast,
    assumptions: {
      lookbackDays: lookback,
      weightingHalfLifeDays: halfLife,
      seasonality: "day-of-week",
    },
  };
}
