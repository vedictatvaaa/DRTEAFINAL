import { useState } from "react";
import {
  useAdminAnalyticsSummary,
  useAdminAnalyticsLatestInsights,
  useAdminAnalyticsRefreshInsights,
  useAdminAnalyticsSession,
  getAdminAnalyticsLatestInsightsQueryKey,
  getAdminAnalyticsSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

function fmtINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function FunnelRow({ label, value, top }: { label: string; value: number; top: number }) {
  const pct = top === 0 ? 0 : Math.round((value / top) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value} sessions · {pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BreakdownList({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <Card className="p-4">
      <h3 className="font-medium mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.slice(0, 8).map((r) => (
            <li key={r.label} className="flex justify-between">
              <span className="truncate pr-2">{r.label}</span>
              <span className="text-muted-foreground tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SessionView({ id }: { id: string }) {
  const session = useAdminAnalyticsSession(id);
  if (session.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!session.data || session.data.events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events for this session.</p>;
  }
  return (
    <ol className="space-y-2 border-l ml-2 pl-4">
      {session.data.events.map((e) => (
        <li key={e.id} className="text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{e.type}</span>
            <span className="text-xs text-muted-foreground">{fmtDateTime(e.createdAt)}</span>
            {e.path && <span className="text-xs text-muted-foreground truncate">{e.path}</span>}
          </div>
          {(e.productId || e.value || e.referrer) && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {e.productId && <span>product: {e.productId} · </span>}
              {typeof e.value === "number" && <span>value: {fmtINR(e.value)} · </span>}
              {e.referrer && <span>ref: {e.referrer}</span>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function SessionInspector() {
  const [sessionInput, setSessionInput] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <Card className="p-4">
      <h3 className="font-medium mb-3">Customer journey replay</h3>
      <div className="flex gap-2 mb-3">
        <Input
          placeholder="Paste a session id"
          value={sessionInput}
          onChange={(e) => setSessionInput(e.target.value)}
          className="font-mono text-xs"
        />
        <Button size="sm" disabled={sessionInput.length < 8} onClick={() => setActiveId(sessionInput.trim())}>
          Inspect
        </Button>
      </div>
      {!activeId
        ? <p className="text-sm text-muted-foreground">Enter a session id to see the ordered event timeline.</p>
        : <SessionView id={activeId} />}
    </Card>
  );
}

export default function AnalyticsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const summaryQ = useAdminAnalyticsSummary({ days });
  const insightsQ = useAdminAnalyticsLatestInsights();
  const refresh = useAdminAnalyticsRefreshInsights();

  if (summaryQ.isLoading || !summaryQ.data) {
    return <div className="text-muted-foreground">Loading analytics…</div>;
  }
  const { summary, forecast } = summaryQ.data;
  const insights = insightsQ.data;

  const forecastTotalOrders = forecast.forecast.reduce((s, p) => s + p.orders, 0);
  const forecastTotalRevenue = forecast.forecast.reduce((s, p) => s + p.revenue, 0);
  const top = summary.funnel.pageViewSessions || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 items-center">
          <Label className="text-xs">Window:</Label>
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d as 7 | 30 | 90)}
            >
              {d}d
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refresh.isPending}
          onClick={async () => {
            try {
              await refresh.mutateAsync({ data: { windowDays: days } });
              await qc.invalidateQueries({ queryKey: getAdminAnalyticsLatestInsightsQueryKey() });
              await qc.invalidateQueries({ queryKey: getAdminAnalyticsSummaryQueryKey({ days }) });
              toast({ title: "Insights refreshed" });
            } catch (err) {
              toast({ title: "Refresh failed", description: String(err), variant: "destructive" });
            }
          }}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh AI insights"}
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Sessions" value={summary.totals.sessions} />
        <StatCard label="Page views" value={summary.totals.pageViews} />
        <StatCard label="Orders" value={summary.totals.orders} />
        <StatCard label="Revenue" value={fmtINR(summary.totals.revenue)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-medium mb-3">Traffic by day</h3>
          {summary.trafficByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No traffic in this window.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={summary.trafficByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sessions" stroke="#3a5a2c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pageViews" stroke="#a98e63" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="orders" stroke="#c4623d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-medium mb-3">Conversion funnel</h3>
          <div className="space-y-3">
            <FunnelRow label="Page view" value={summary.funnel.pageViewSessions} top={top} />
            <FunnelRow label="Product view" value={summary.funnel.productViewSessions} top={top} />
            <FunnelRow label="Add to cart" value={summary.funnel.addToCartSessions} top={top} />
            <FunnelRow label="Checkout start" value={summary.funnel.checkoutStartSessions} top={top} />
            <FunnelRow label="Order placed" value={summary.funnel.orderSessions} top={top} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-medium mb-3">Top pages</h3>
          {summary.topPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pages tracked.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.topPages.slice(0, 8)} layout="vertical" margin={{ left: 50 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="path" type="category" tick={{ fontSize: 10 }} width={140} />
                <Tooltip />
                <Bar dataKey="views" fill="#3a5a2c" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-medium mb-3">Top products</h3>
          {summary.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No product views tracked.</p>
          ) : (
            <ul className="text-sm divide-y">
              {summary.topProducts.map((p) => (
                <li key={p.productId} className="py-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs">{p.productId}</span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {p.views} views · {p.addToCart} carts · {p.orders} orders
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <BreakdownList title="Referrers" rows={summary.referrers.map((r) => ({ label: r.referrer, value: r.sessions }))} />
        <BreakdownList title="UTM sources" rows={summary.utmSources.map((r) => ({ label: r.source, value: r.sessions }))} />
        <BreakdownList title="Countries" rows={summary.countries.map((r) => ({ label: r.country, value: r.sessions }))} />
        <BreakdownList title="Currencies" rows={summary.currencies.map((r) => ({ label: r.currency, value: r.sessions }))} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-medium">7-day sales forecast</h3>
            <p className="text-xs text-muted-foreground">
              Weighted moving average + day-of-week seasonality over the last
              {" "}{(forecast.assumptions as { lookbackDays?: number }).lookbackDays ?? 28} days.
            </p>
          </div>
          <div className="text-right text-sm">
            <div><strong>{forecastTotalOrders}</strong> orders projected</div>
            <div className="text-muted-foreground">{fmtINR(forecastTotalRevenue)} revenue</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={[...forecast.history, ...forecast.forecast]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="orders" stroke="#3a5a2c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div>
            <h3 className="font-medium">AI insights</h3>
            <p className="text-xs text-muted-foreground">
              {insights ? `Generated for ${insights.forDate} · window: ${insights.windowDays}d` : "Not generated yet — click Refresh AI insights."}
            </p>
          </div>
        </div>
        {insights && insights.bullets.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            {insights.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No insights yet.</p>
        )}
      </Card>

      <SessionInspector />
    </div>
  );
}
