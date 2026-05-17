import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Megaphone,
  Briefcase,
  MessageSquare,
  RefreshCw,
  ArrowRight,
  Zap,
  Activity,
  Users,
  Truck,
  Repeat,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = `${import.meta.env.BASE_URL}api`;

// ──────────────────────────────────────────────────────────────────────────
// Types (mirror /api/admin/mission-control payload)
// ──────────────────────────────────────────────────────────────────────────
interface RangeMetrics {
  revenue: number;
  orders: number;
  aov: number;
  sessions: number;
  conversion: number;
  newCustomers: number;
}
interface MissionPayload {
  generatedAt: string;
  kpis: {
    today: RangeMetrics;
    week: RangeMetrics;
    month: RangeMetrics;
    deltas: Record<keyof RangeMetrics, number | null>;
  };
  series30: Array<{ date: string; revenue: number; orders: number }>;
  inventory: {
    totalSkus: number;
    lowCount: number;
    outCount: number;
    lowStock: Array<{ id: string; name: string; stock: number }>;
  };
  content: { draftCount: number; published7d: number };
  marketing: {
    recent: number;
    openRate: number;
    clickRate: number;
    activeCampaigns: number;
  };
  pipeline: { wholesale: Record<string, number> };
  moderation: { pendingReviews: number; pendingComments: number };
  topProducts: Array<{
    id: string;
    name: string;
    slug: string;
    units: number;
    revenue: number;
  }>;
}
interface IntelligencePayload {
  generatedAt: string;
  inventory: {
    totalSkus: number;
    stockedSkus: number;
    movingSkus: number;
    sellThroughRate: number;
    deadStockCount: number;
    deadStock: Array<{ id: string; name: string; stock: number }>;
    urgent: Array<{
      productId: string;
      name: string;
      stock: number;
      units30d: number;
      perDay: number;
      daysOnHand: number | null;
      urgency: "critical" | "low" | "ok" | "overstock";
    }>;
    velocity: IntelligencePayload["inventory"]["urgent"];
  };
  customers: {
    totalCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    avgDaysBetweenOrders: number;
    aov30: number;
    estimatedLtv: number;
    newRevenue30d: number;
    returningRevenue30d: number;
    newRevenueShare: number;
    returningRevenueShare: number;
  };
  ops: {
    avgPaidToShipHours: number;
    medianPaidToShipHours: number;
    shippedSampleSize: number;
    unshippedTotal: number;
    unshippedAged24h: number;
    unshippedAged48h: number;
    cancelRate30d: number;
    cancelledCount30d: number;
    openShipmentsAged7d: number;
  };
  subs: {
    activeCount: number;
    totalCount: number;
    mrr: number;
    churned30d: number;
    churnRate30d: number;
    upcoming7dCount: number;
    upcoming7dRevenue: number;
  };
}

interface BriefingPayload {
  forDate: string;
  headline: string;
  wins: string[];
  risks: string[];
  action: string;
  cached: boolean;
  generated?: boolean;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function formatINR(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function formatPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
function formatNum(n: number): string {
  return n.toLocaleString("en-IN");
}
function formatDelta(d: number | null): {
  text: string;
  positive: boolean;
  neutral: boolean;
} {
  if (d === null || !Number.isFinite(d))
    return { text: "—", positive: false, neutral: true };
  if (d === 0) return { text: "0%", positive: false, neutral: true };
  const text = `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%`;
  return { text, positive: d > 0, neutral: false };
}

function navigateTab(id: string) {
  if (typeof window === "undefined") return;
  window.location.hash = id;
}

// ──────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────
type RangeKey = "today" | "week" | "month";

export default function MissionControlTab() {
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("week");

  const snapshot = useQuery<MissionPayload>({
    queryKey: ["mission-control"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/mission-control`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Could not load Mission Control");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const intel = useQuery<IntelligencePayload>({
    queryKey: ["mission-control", "intelligence"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/mission-control/intelligence`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Could not load intelligence");
      return r.json();
    },
    refetchInterval: 120_000,
  });

  const briefing = useQuery<BriefingPayload>({
    queryKey: ["mission-control", "briefing"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/mission-control/briefing`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Could not load briefing");
      return r.json();
    },
  });

  const refreshBriefing = useMutation({
    mutationFn: async () => {
      const r = await fetch(
        `${API}/admin/mission-control/briefing?refresh=1`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Could not refresh");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mission-control", "briefing"] });
    },
  });

  if (snapshot.isError) {
    return (
      <Card className="p-6 border-red-200 bg-red-50 text-red-800">
        <p className="font-semibold mb-1">Couldn't load Mission Control</p>
        <p className="text-sm opacity-80">
          {(snapshot.error as Error)?.message ?? "Unknown error"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => snapshot.refetch()}
        >
          Retry
        </Button>
      </Card>
    );
  }
  if (snapshot.isLoading || !snapshot.data) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-black/5 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-black/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const data = snapshot.data;
  const m = data.kpis[range];
  const deltas = data.kpis.deltas; // deltas always describe week vs prev-week
  const showDelta = range === "week";

  return (
    <div className="space-y-5">
      {/* AI Briefing card */}
      <BriefingCard
        briefing={briefing.data}
        loading={briefing.isLoading}
        refreshing={refreshBriefing.isPending}
        onRefresh={() => refreshBriefing.mutate()}
      />

      {/* Range toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex bg-black/5 rounded-md p-0.5 text-[12px] font-semibold">
          {(["today", "week", "month"] as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`px-3 h-8 rounded transition-colors ${
                range === k
                  ? "bg-white text-[#1a2416] shadow-sm"
                  : "text-[#1a2416]/55 hover:text-[#1a2416]"
              }`}
            >
              {k === "today" ? "Today" : k === "week" ? "Last 7d" : "Last 30d"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#1a2416]/45">
          Updated {new Date(data.generatedAt).toLocaleTimeString()} · auto-refreshes every minute
        </p>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Revenue" value={formatINR(m.revenue)} delta={showDelta ? deltas.revenue : null} />
        <Kpi label="Orders" value={formatNum(m.orders)} delta={showDelta ? deltas.orders : null} />
        <Kpi label="AOV" value={m.aov ? formatINR(m.aov) : "—"} delta={showDelta ? deltas.aov : null} />
        <Kpi label="Sessions" value={formatNum(m.sessions)} delta={showDelta ? deltas.sessions : null} />
        <Kpi label="Conversion" value={m.sessions ? formatPct(m.conversion, 2) : "—"} delta={showDelta ? deltas.conversion : null} />
        <Kpi label="New customers" value={formatNum(m.newCustomers)} delta={showDelta ? deltas.newCustomers : null} />
      </div>

      {/* Revenue spark + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[13px] font-semibold text-[#1a2416]">Revenue · last 30 days</h3>
              <p className="text-[11px] text-[#1a2416]/50 mt-0.5">
                Total {formatINR(data.series30.reduce((s, r) => s + r.revenue, 0))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTab("analytics")}
              className="text-[11px] font-semibold text-[#3a5a2c] hover:underline inline-flex items-center gap-1"
            >
              Analytics <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <Sparkline series={data.series30} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-[#1a2416]">Top products · 30d</h3>
            <button
              type="button"
              onClick={() => navigateTab("products")}
              className="text-[11px] font-semibold text-[#3a5a2c] hover:underline inline-flex items-center gap-1"
            >
              All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {data.topProducts.length === 0 ? (
            <p className="text-[12px] text-[#1a2416]/50">No sales yet in the last 30 days.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.topProducts.map((p, i) => (
                <li key={String(p.id)} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-5 text-[10px] font-bold text-[#1a2416]/40 tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate font-medium text-[#1a2416]">{p.name}</span>
                  <span className="tabular-nums text-[#1a2416]/65">{p.units}u</span>
                  <span className="tabular-nums text-[#1a2416] font-semibold w-16 text-right">{formatINR(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Intelligence pane (derived KPIs) */}
      <IntelligencePane data={intel.data} loading={intel.isLoading} />

      {/* Operational rails */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <RailCard
          icon={Package}
          title="Inventory health"
          stats={[
            { label: "SKUs", value: formatNum(data.inventory.totalSkus) },
            { label: "Out", value: formatNum(data.inventory.outCount), tone: data.inventory.outCount > 0 ? "danger" : "ok" },
            { label: "Low", value: formatNum(data.inventory.lowCount), tone: data.inventory.lowCount > 0 ? "warn" : "ok" },
          ]}
          ctaLabel="Open products"
          onCta={() => navigateTab("products")}
          rows={data.inventory.lowStock.map((p) => ({
            label: p.name,
            value: `${p.stock} left`,
            tone: (p.stock <= 5 ? "danger" : "warn") as Tone,
          }))}
          emptyText="All SKUs are well stocked."
        />

        <RailCard
          icon={Megaphone}
          title="Marketing pulse"
          stats={[
            { label: "Sent (30d)", value: formatNum(data.marketing.recent) },
            { label: "Open", value: data.marketing.recent ? formatPct(data.marketing.openRate) : "—" },
            { label: "Click", value: data.marketing.recent ? formatPct(data.marketing.clickRate) : "—" },
          ]}
          ctaLabel="Open marketing"
          onCta={() => navigateTab("marketing")}
          rows={[
            {
              label: "Active campaigns",
              value: formatNum(data.marketing.activeCampaigns),
              tone: data.marketing.activeCampaigns > 0 ? "ok" : "neutral",
            },
            {
              label: "Drafts in journal",
              value: formatNum(data.content.draftCount),
              tone: data.content.draftCount > 0 ? "warn" : "neutral",
            },
            {
              label: "Published last 7d",
              value: formatNum(data.content.published7d),
              tone: "neutral",
            },
          ]}
        />

        <RailCard
          icon={Briefcase}
          title="Wholesale pipeline"
          stats={Object.entries(data.pipeline.wholesale)
            .filter(([k]) => k === "new" || k === "contacted" || k === "won")
            .map(([k, v]) => ({
              label: k.charAt(0).toUpperCase() + k.slice(1),
              value: formatNum(v),
              tone: k === "new" && v > 0 ? "warn" : "neutral",
            }))}
          ctaLabel="View leads"
          onCta={() => navigateTab("community")}
          rows={Object.entries(data.pipeline.wholesale).map(([k, v]) => ({
            label: k.charAt(0).toUpperCase() + k.slice(1),
            value: formatNum(v),
            tone: "neutral",
          }))}
        />

        <RailCard
          icon={MessageSquare}
          title="Moderation queue"
          stats={[
            {
              label: "Reviews",
              value: formatNum(data.moderation.pendingReviews),
              tone: data.moderation.pendingReviews > 0 ? "warn" : "ok",
            },
            {
              label: "Comments",
              value: formatNum(data.moderation.pendingComments),
              tone: data.moderation.pendingComments > 0 ? "warn" : "ok",
            },
          ]}
          ctaLabel="Open community"
          onCta={() => navigateTab("community")}
          rows={[
            {
              label: "Total awaiting action",
              value: formatNum(
                data.moderation.pendingReviews + data.moderation.pendingComments,
              ),
              tone:
                data.moderation.pendingReviews + data.moderation.pendingComments >
                0
                  ? "warn"
                  : "ok",
            },
          ]}
          emptyText="Queue is clear."
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function IntelligencePane({
  data,
  loading,
}: {
  data: IntelligencePayload | undefined;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-black/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const inv = data.inventory;
  const cust = data.customers;
  const ops = data.ops;
  const subs = data.subs;
  const newShare = Math.round(cust.newRevenueShare * 100);
  const retShare = 100 - newShare;

  const slaTone: Tone =
    ops.avgPaidToShipHours === 0
      ? "neutral"
      : ops.avgPaidToShipHours <= 24
        ? "ok"
        : ops.avgPaidToShipHours <= 48
          ? "warn"
          : "danger";
  const cancelTone: Tone =
    ops.cancelRate30d <= 0.02 ? "ok" : ops.cancelRate30d <= 0.05 ? "warn" : "danger";
  const churnTone: Tone =
    subs.churnRate30d <= 0.05 ? "ok" : subs.churnRate30d <= 0.1 ? "warn" : "danger";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-[#3a5a2c]" />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#1a2416]/65">
          Intelligence
        </h2>
        <span className="text-[10.5px] text-[#1a2416]/40">
          derived KPIs · refreshes every 2 min
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inventory velocity */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[#3a5a2c]/10 text-[#3a5a2c] flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[13px] font-semibold text-[#1a2416]">Inventory velocity</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Sell-through" value={`${Math.round(inv.sellThroughRate * 100)}%`} />
            <Stat label="Dead SKUs" value={formatNum(inv.deadStockCount)} tone={inv.deadStockCount > 0 ? "warn" : "ok"} />
            <Stat label="Critical" value={formatNum(inv.urgent.length)} tone={inv.urgent.length > 0 ? "danger" : "ok"} />
          </div>
          {inv.urgent.length === 0 && inv.deadStock.length === 0 ? (
            <p className="text-[12px] text-[#1a2416]/50">No urgent restocks. Catalogue is healthy.</p>
          ) : (
            <ul className="space-y-1.5">
              {inv.urgent.slice(0, 4).map((v) => (
                <li key={v.productId} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-[#1a2416] font-medium">{v.name}</span>
                  <span className="tabular-nums text-rose-700 font-semibold whitespace-nowrap">
                    {v.daysOnHand !== null ? `${v.daysOnHand}d left` : "—"}
                  </span>
                </li>
              ))}
              {inv.urgent.length === 0 && inv.deadStock.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-[#1a2416]/70">{d.name}</span>
                  <span className="tabular-nums text-amber-700 whitespace-nowrap">{d.stock} idle</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Customer LTV */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[#3a5a2c]/10 text-[#3a5a2c] flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[13px] font-semibold text-[#1a2416]">Customer LTV</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Repeat rate" value={formatPct(cust.repeatRate)} tone={cust.repeatRate >= 0.2 ? "ok" : "warn"} />
            <Stat label="AOV (30d)" value={cust.aov30 ? formatINR(cust.aov30) : "—"} />
            <Stat label="Est. LTV" value={cust.estimatedLtv ? formatINR(cust.estimatedLtv) : "—"} />
          </div>
          <div className="text-[11px] text-[#1a2416]/55 mb-1.5">
            Revenue mix · last 30d
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-black/5">
            <div className="bg-[#3a5a2c] h-full" style={{ width: `${retShare}%` }} title={`Returning ${retShare}%`} />
            <div className="bg-amber-400 h-full" style={{ width: `${newShare}%` }} title={`New ${newShare}%`} />
          </div>
          <div className="flex justify-between text-[10.5px] text-[#1a2416]/55 mt-1.5">
            <span>Returning {retShare}%</span>
            <span>{cust.avgDaysBetweenOrders > 0 ? `~${cust.avgDaysBetweenOrders}d cadence` : "—"}</span>
            <span>New {newShare}%</span>
          </div>
        </Card>

        {/* Operational SLA */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[#3a5a2c]/10 text-[#3a5a2c] flex items-center justify-center">
              <Truck className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[13px] font-semibold text-[#1a2416]">Fulfilment SLA</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat
              label="Avg ship"
              value={ops.shippedSampleSize ? `${Math.round(ops.avgPaidToShipHours)}h` : "—"}
              tone={slaTone}
            />
            <Stat
              label="48h+ stuck"
              value={formatNum(ops.unshippedAged48h)}
              tone={ops.unshippedAged48h > 0 ? "danger" : "ok"}
            />
            <Stat label="Cancel rate" value={formatPct(ops.cancelRate30d, 1)} tone={cancelTone} />
          </div>
          <ul className="space-y-1.5 text-[12px]">
            <li className="flex justify-between">
              <span className="text-[#1a2416]/65">Unshipped (paid/processing)</span>
              <span className="tabular-nums font-semibold">{formatNum(ops.unshippedTotal)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#1a2416]/65">In-transit &gt; 7d</span>
              <span className={`tabular-nums font-semibold ${ops.openShipmentsAged7d > 0 ? "text-amber-700" : ""}`}>
                {formatNum(ops.openShipmentsAged7d)}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#1a2416]/65">Median ship time</span>
              <span className="tabular-nums">
                {ops.shippedSampleSize ? `${ops.medianPaidToShipHours}h` : "—"}
              </span>
            </li>
          </ul>
        </Card>

        {/* Subscriptions */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[#3a5a2c]/10 text-[#3a5a2c] flex items-center justify-center">
              <Repeat className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[13px] font-semibold text-[#1a2416]">Subscriptions</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Active" value={formatNum(subs.activeCount)} />
            <Stat label="MRR" value={subs.mrr ? formatINR(subs.mrr) : "—"} />
            <Stat label="Churn 30d" value={formatPct(subs.churnRate30d, 1)} tone={churnTone} />
          </div>
          <ul className="space-y-1.5 text-[12px]">
            <li className="flex justify-between">
              <span className="text-[#1a2416]/65">Deliveries next 7d</span>
              <span className="tabular-nums font-semibold">{formatNum(subs.upcoming7dCount)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#1a2416]/65">Projected revenue 7d</span>
              <span className="tabular-nums font-semibold text-[#3a5a2c]">
                {subs.upcoming7dRevenue ? formatINR(subs.upcoming7dRevenue) : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#1a2416]/65">Cancelled 30d</span>
              <span className="tabular-nums">{formatNum(subs.churned30d)}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  const toneCls =
    tone === "danger"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-[#1a2416]";
  return (
    <div className="rounded-md bg-black/[0.025] px-2 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-[#1a2416]/50 font-semibold">
        {label}
      </div>
      <div className={`text-[13px] font-bold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function BriefingCard({
  briefing,
  loading,
  refreshing,
  onRefresh,
}: {
  briefing: BriefingPayload | undefined;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card className="relative overflow-hidden border-[#1a2416]/10 bg-gradient-to-br from-[#0e1810] via-[#152119] to-[#1a2416] text-white p-5 sm:p-6">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-20 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-200 flex items-center justify-center">
              <Sparkles className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 font-semibold">
                Daily briefing · AI
              </p>
              <p className="text-[12px] text-white/70 font-medium">
                {briefing?.forDate ?? "—"}
                {briefing?.cached ? " · cached" : briefing?.generated ? " · fresh" : ""}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={refreshing}
            onClick={onRefresh}
            className="h-8 px-2.5 text-white/70 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {refreshing ? "Thinking" : "Regenerate"}
            </span>
          </Button>
        </div>

        {loading || !briefing ? (
          <div className="space-y-2">
            <div className="h-5 w-2/3 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-white/5 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <h2 className="font-serif text-[20px] sm:text-[22px] leading-snug text-white mb-4 max-w-3xl">
              {briefing.headline || "All systems steady."}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12.5px]">
              <BriefingColumn
                title="Wins"
                items={briefing.wins}
                accent="text-emerald-200"
                bg="bg-emerald-500/10 border-emerald-400/20"
                Icon={TrendingUp}
              />
              <BriefingColumn
                title="Risks"
                items={briefing.risks}
                accent="text-amber-200"
                bg="bg-amber-500/10 border-amber-400/20"
                Icon={AlertTriangle}
              />
              <div className="rounded-lg bg-white/[0.06] border border-white/15 p-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-200" />
                  <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-white/55">
                    Action
                  </span>
                </div>
                <p className="text-white/90 leading-snug">
                  {briefing.action || "No action recommended."}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function BriefingColumn({
  title,
  items,
  accent,
  bg,
  Icon,
}: {
  title: string;
  items: string[];
  accent: string;
  bg: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`rounded-lg border p-3.5 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <span className={`text-[10px] uppercase tracking-[0.22em] font-semibold text-white/55`}>
          {title}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-white/45 text-[12px]">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-white/85 leading-snug flex gap-2">
              <span className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${accent.replace("text-", "bg-")}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number | null;
}) {
  const d = formatDelta(delta);
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#1a2416]/45 font-semibold">
        {label}
      </p>
      <p className="text-[22px] font-serif font-semibold mt-1.5 text-[#1a2416] tabular-nums">
        {value}
      </p>
      {delta !== null && !d.neutral && (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
            d.positive ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {d.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {d.text}
          <span className="text-[#1a2416]/40 font-normal">vs prev</span>
        </p>
      )}
      {delta !== null && d.neutral && (
        <p className="mt-1 text-[11px] text-[#1a2416]/40">
          {d.text} <span>vs prev</span>
        </p>
      )}
    </Card>
  );
}

type Tone = "ok" | "warn" | "danger" | "neutral";

function toneClass(t: Tone): string {
  switch (t) {
    case "danger":
      return "text-red-700 bg-red-50 border-red-200";
    case "warn":
      return "text-amber-800 bg-amber-50 border-amber-200";
    case "ok":
      return "text-emerald-800 bg-emerald-50 border-emerald-200";
    default:
      return "text-[#1a2416]/65 bg-black/[0.03] border-black/5";
  }
}

function RailCard({
  icon: Icon,
  title,
  stats,
  rows,
  ctaLabel,
  onCta,
  emptyText,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  stats: Array<{ label: string; value: string; tone?: Tone }>;
  rows: Array<{ label: string; value: string; tone?: Tone }>;
  ctaLabel: string;
  onCta: () => void;
  emptyText?: string;
}) {
  return (
    <Card className="p-5 flex flex-col h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-md bg-[#1a2416]/[0.06] text-[#1a2416] flex items-center justify-center">
          <Icon className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <h3 className="text-[13px] font-semibold text-[#1a2416]">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-md border px-2 py-2 ${toneClass(s.tone ?? "neutral")}`}
          >
            <p className="text-[9px] uppercase tracking-[0.16em] font-semibold opacity-70">
              {s.label}
            </p>
            <p className="text-[15px] font-semibold tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {rows.length === 0 && emptyText ? (
          <p className="text-[12px] text-[#1a2416]/45">{emptyText}</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.slice(0, 6).map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-[12px] py-1.5 border-b border-black/5 last:border-0"
              >
                <span className="text-[#1a2416]/75 truncate pr-2">{r.label}</span>
                <Badge
                  variant="outline"
                  className={`text-[10.5px] font-semibold tabular-nums ${
                    r.tone === "danger"
                      ? "border-red-200 text-red-700 bg-red-50"
                      : r.tone === "warn"
                      ? "border-amber-200 text-amber-800 bg-amber-50"
                      : r.tone === "ok"
                      ? "border-emerald-200 text-emerald-800 bg-emerald-50"
                      : "border-black/10 text-[#1a2416]/65"
                  }`}
                >
                  {r.value}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onCta}
        className="mt-3 inline-flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3a5a2c] hover:text-[#1a2416] transition-colors"
      >
        {ctaLabel}
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </Card>
  );
}

function Sparkline({
  series,
}: {
  series: Array<{ date: string; revenue: number; orders: number }>;
}) {
  const { path, area, max, points } = useMemo(() => {
    const w = 600;
    const h = 120;
    const pad = 6;
    const max = Math.max(1, ...series.map((s) => s.revenue));
    const stepX = (w - pad * 2) / Math.max(1, series.length - 1);
    const pts = series.map((s, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (s.revenue / max) * (h - pad * 2);
      return { x, y, ...s };
    });
    const path = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    const area = `${path} L${pts[pts.length - 1]!.x.toFixed(1)},${h - pad} L${pts[0]!.x.toFixed(1)},${h - pad} Z`;
    return { path, area, max, points: pts };
  }, [series]);

  return (
    <div className="relative">
      <svg viewBox="0 0 600 120" className="w-full h-28" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3a5a2c" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3a5a2c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-fill)" />
        <path d={path} fill="none" stroke="#1a2416" strokeWidth="1.5" />
        {points
          .filter((_, i) => i === points.length - 1 || i % 5 === 0)
          .map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2} fill="#1a2416" />
          ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[#1a2416]/45 mt-1 tabular-nums">
        <span>{series[0]?.date.slice(5)}</span>
        <span>peak {formatINR(max)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
