import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Repeat,
  Pause,
  Play,
  SkipForward,
  X,
  Loader2,
  PlayCircle,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API = `${import.meta.env.BASE_URL}api`;

interface Overview {
  counts: { active: number; paused: number; cancelled: number };
  mrrPaise: number;
  dueThisWeek: number;
  dueOverdue: number;
  total: number;
}

interface Subscription {
  id: number;
  shopperUserId: string;
  shopperEmail: string | null;
  shopperName: string | null;
  productId: string;
  productName: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  frequencyWeeks: number;
  status: "active" | "paused" | "cancelled";
  nextDeliveryAt: string;
  lastOrderId: number | null;
  createdAt: string;
}

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}
async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export default function SubscriptionsTab() {
  const qc = useQueryClient();
  const overview = useQuery({
    queryKey: ["subs-overview"],
    queryFn: () => get<Overview>("/admin/subscriptions/overview"),
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "cancelled">("all");
  const [search, setSearch] = useState("");
  const list = useQuery({
    queryKey: ["subs", statusFilter],
    queryFn: () =>
      get<{ items: Subscription[] }>(
        statusFilter === "all"
          ? "/admin/subscriptions"
          : `/admin/subscriptions?status=${statusFilter}`,
      ),
  });
  const filtered = useMemo(() => {
    const items = list.data?.items ?? [];
    const q = search.toLowerCase().trim();
    return q
      ? items.filter(
          (s) =>
            s.shopperEmail?.toLowerCase().includes(q) ||
            s.shopperName?.toLowerCase().includes(q) ||
            s.productName.toLowerCase().includes(q),
        )
      : items;
  }, [list.data, search]);
  const runDue = useMutation({
    mutationFn: () => send<{ advanced: number }>("POST", "/admin/subscriptions/run-due"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subs"] });
      void qc.invalidateQueries({ queryKey: ["subs-overview"] });
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2416]">Subscriptions</h1>
          <p className="text-sm text-stone-600">
            Recurring deliveries — pause, skip, cancel and run due.
          </p>
        </div>
        <Button
          onClick={() => runDue.mutate()}
          disabled={runDue.isPending}
          className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
        >
          {runDue.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
          Run due
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Active"
          value={overview.data ? String(overview.data.counts.active) : "—"}
          icon={Repeat}
        />
        <Stat
          label="Paused"
          value={overview.data ? String(overview.data.counts.paused) : "—"}
          icon={Pause}
        />
        <Stat
          label="MRR"
          value={overview.data ? inr(overview.data.mrrPaise) : "—"}
        />
        <Stat
          label="Due this week"
          value={
            overview.data
              ? `${overview.data.dueThisWeek}${overview.data.dueOverdue > 0 ? ` (+${overview.data.dueOverdue} overdue)` : ""}`
              : "—"
          }
          icon={Calendar}
          tone={overview.data && overview.data.dueOverdue > 0 ? "warn" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "paused", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wide ${
              statusFilter === s
                ? "bg-[#3a5a2c] text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {s}
          </button>
        ))}
        <Input
          placeholder="Search shopper or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm ml-auto"
        />
      </div>

      <Card className="p-0 overflow-hidden bg-white border-stone-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 bg-stone-50">
              <tr>
                <th className="text-left p-3">Shopper</th>
                <th className="text-left">Product</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Cadence</th>
                <th className="text-right">Line</th>
                <th className="text-left">Status</th>
                <th className="text-left">Next delivery</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr><td colSpan={8} className="p-6 text-center text-stone-500">Loading…</td></tr>
              )}
              {!list.isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-stone-500">No subscriptions yet.</td></tr>
              )}
              {filtered.map((s) => {
                const linePaise = Math.round(
                  s.unitPrice * s.quantity * (1 - s.discountPct / 100),
                );
                const dueAt = new Date(s.nextDeliveryAt);
                const overdue = s.status === "active" && dueAt.getTime() < Date.now();
                return (
                  <tr key={s.id} className="border-t border-stone-100">
                    <td className="p-3">
                      <div className="font-medium text-[#1a2416]">
                        {s.shopperName || s.shopperEmail || s.shopperUserId}
                      </div>
                      <div className="text-xs text-stone-500">{s.shopperEmail}</div>
                    </td>
                    <td>
                      <div>{s.productName}</div>
                      <div className="text-xs text-stone-500">{s.variantSize}</div>
                    </td>
                    <td className="text-right font-mono">{s.quantity}</td>
                    <td className="text-right text-stone-600">every {s.frequencyWeeks}w</td>
                    <td className="text-right font-mono">{inr(linePaise)}</td>
                    <td>
                      <Badge
                        variant={
                          s.status === "active"
                            ? "default"
                            : s.status === "paused"
                            ? "outline"
                            : "destructive"
                        }
                        className="capitalize"
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td className={overdue ? "text-rose-600" : "text-stone-600"}>
                      {overdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
                      {dueAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </td>
                    <td className="text-right p-3 space-x-1 whitespace-nowrap">
                      {s.status === "active" && <ActionButtons sub={s} />}
                      {s.status === "paused" && (
                        <ResumeButton id={s.id} />
                      )}
                      {s.status !== "cancelled" && (
                        <CancelButton id={s.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="p-4 bg-[#FAF8F4] border-stone-200">
      <div className="text-xs uppercase tracking-wide text-stone-500 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div
        className={`text-2xl font-bold mt-1 ${
          tone === "warn" ? "text-amber-600" : "text-[#1a2416]"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

function ActionButtons({ sub }: { sub: Subscription }) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["subs"] });
    void qc.invalidateQueries({ queryKey: ["subs-overview"] });
  };
  const pause = useMutation({
    mutationFn: () => send("POST", `/admin/subscriptions/${sub.id}/pause`),
    onSuccess: invalidate,
  });
  const skip = useMutation({
    mutationFn: () => send("POST", `/admin/subscriptions/${sub.id}/skip`),
    onSuccess: invalidate,
  });
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => pause.mutate()}
        disabled={pause.isPending}
      >
        <Pause className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => skip.mutate()}
        disabled={skip.isPending}
      >
        <SkipForward className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}

function ResumeButton({ id }: { id: number }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => send("POST", `/admin/subscriptions/${id}/resume`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subs"] });
      void qc.invalidateQueries({ queryKey: ["subs-overview"] });
    },
  });
  return (
    <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
      <Play className="h-3.5 w-3.5" />
    </Button>
  );
}

function CancelButton({ id }: { id: number }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => send("POST", `/admin/subscriptions/${id}/cancel`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subs"] });
      void qc.invalidateQueries({ queryKey: ["subs-overview"] });
    },
  });
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        if (confirm("Cancel this subscription?")) m.mutate();
      }}
      disabled={m.isPending}
    >
      <X className="h-3.5 w-3.5 text-rose-600" />
    </Button>
  );
}
