import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Package,
  Undo2,
  RefreshCw,
  Search as SearchIcon,
  Loader2,
  X,
  AlertTriangle,
  Zap,
  PrinterIcon,
  Repeat,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  PackageOpen,
  Settings,
  ArrowUp,
  ArrowDown,
  Trash2,
  PlayCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const API = `${import.meta.env.BASE_URL}api`;

type ShipStatus =
  | "pending"
  | "manifested"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delayed"
  | "undelivered"
  | "returned"
  | "lost";

interface Courier {
  code: string;
  name: string;
  hub: string;
  baseSlaDays: number;
  costPerGramPaise: number;
}

interface Shipment {
  id: number;
  orderId: number;
  courierCode: string;
  awb: string | null;
  status: ShipStatus;
  weightGrams: number;
  declaredValue: number;
  labelUrl: string | null;
  trackingUrl: string | null;
  manifestId: number | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  expectedDeliveryAt: string | null;
  lastEventAt: string | null;
  notes: string | null;
  createdAt: string;
  order?: {
    id: number;
    customerName: string;
    customerEmail: string;
    total: number;
    shippingAddress?: { city: string; postalCode: string };
  } | null;
}

interface Manifest {
  id: number;
  courierCode: string;
  status: "open" | "closed";
  shipmentCount: number;
  createdAt: string;
  closedAt: string | null;
}

type ReturnStatus =
  | "requested"
  | "approved"
  | "in_transit"
  | "received"
  | "refunded"
  | "rejected";

interface ReturnRow {
  id: number;
  orderId: number;
  reason: string;
  notes: string | null;
  status: ReturnStatus;
  refundAmount: number;
  pickupAwb: string | null;
  createdAt: string;
  order?: {
    id: number;
    customerName: string;
    customerEmail: string;
    total: number;
  } | null;
}

const STATUS_META: Record<ShipStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-stone-100 text-stone-700 border-stone-300" },
  manifested: { label: "Manifested", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  in_transit: { label: "In transit", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  delivered: { label: "Delivered", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  delayed: { label: "Delayed", cls: "bg-orange-50 text-orange-800 border-orange-300" },
  undelivered: { label: "Undelivered", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  returned: { label: "Returned", cls: "bg-violet-50 text-violet-800 border-violet-200" },
  lost: { label: "Lost", cls: "bg-red-100 text-red-900 border-red-300" },
};

const RETURN_META: Record<ReturnStatus, { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-stone-100 text-stone-700 border-stone-300" },
  approved: { label: "Approved", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  in_transit: { label: "In transit", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  received: { label: "Received", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  refunded: { label: "Refunded", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-800 border-rose-200" },
};

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const days = Math.round((Date.now() - t) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (Math.abs(days) < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type Sub = "shipments" | "manifests" | "returns" | "settings";

export default function ShippingTab() {
  const [sub, setSub] = useState<Sub>("shipments");

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a2416]">Shipping & fulfilment</h1>
          <p className="mt-1 text-sm text-stone-600">
            Dispatch, track, troubleshoot. Couriers, manifests, labels, returns — one screen.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
          {(
            [
              { id: "shipments" as const, label: "Shipments", icon: Truck },
              { id: "manifests" as const, label: "Manifests", icon: ClipboardList },
              { id: "returns" as const, label: "Returns", icon: Undo2 },
              { id: "settings" as const, label: "Auto-dispatch", icon: Settings },
            ]
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSub(t.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  sub === t.id
                    ? "bg-[#1a2416] text-amber-100"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
                data-testid={`subtab-${t.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {sub === "shipments" ? <ShipmentsView /> : null}
      {sub === "manifests" ? <ManifestsView /> : null}
      {sub === "returns" ? <ReturnsView /> : null}
      {sub === "settings" ? <DispatchSettingsView /> : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Auto-dispatch settings
// ────────────────────────────────────────────────────────────────────────

interface DispatchSettings {
  id: number;
  enabled: boolean;
  courierPriority: string[];
  maxWeightGrams: number;
  onlyOrderStatus: "paid" | "pending" | "any";
  runEveryMinutes: number;
  lastRunAt: string | null;
  lastRunCount: number;
  lastRunError: string | null;
}

interface DispatchRun {
  id: number;
  trigger: string;
  shipmentsCreated: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

function DispatchSettingsView() {
  const qc = useQueryClient();
  const settingsQ = useQuery<{
    settings: DispatchSettings;
    shiprocketConfigured: boolean;
  }>({
    queryKey: ["dispatch-settings"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/shipping/dispatch-settings`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });
  const couriersQ = useQuery<{ items: Courier[] }>({
    queryKey: ["couriers"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/shipping/couriers`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load couriers");
      return r.json();
    },
  });
  const runsQ = useQuery<{ items: DispatchRun[] }>({
    queryKey: ["dispatch-runs"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/shipping/dispatch-runs`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load runs");
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const [draft, setDraft] = useState<DispatchSettings | null>(null);
  useEffect(() => {
    if (settingsQ.data) setDraft(settingsQ.data.settings);
  }, [settingsQ.data]);

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<DispatchSettings>) => {
      const r = await fetch(`${API}/admin/shipping/dispatch-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispatch-settings"] }),
  });

  const triggerMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/shipments/auto-dispatch`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Trigger failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispatch-runs"] });
      qc.invalidateQueries({ queryKey: ["shipments"] });
    },
  });

  if (!draft || !settingsQ.data) {
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
      </Card>
    );
  }

  const allCouriers = couriersQ.data?.items ?? [];
  const inPriority = draft.courierPriority;
  const notInPriority = allCouriers
    .filter((c) => !inPriority.includes(c.code))
    .map((c) => c.code);

  function move(idx: number, dir: -1 | 1) {
    if (!draft) return;
    const next = [...draft.courierPriority];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setDraft({ ...draft, courierPriority: next });
  }
  function removeAt(idx: number) {
    if (!draft) return;
    const next = draft.courierPriority.filter((_, i) => i !== idx);
    setDraft({ ...draft, courierPriority: next });
  }
  function addCourier(code: string) {
    if (!draft || draft.courierPriority.includes(code)) return;
    setDraft({ ...draft, courierPriority: [...draft.courierPriority, code] });
  }

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(settingsQ.data.settings);

  return (
    <div className="space-y-6">
      {/* Shiprocket status banner */}
      <Card
        className={`p-4 ${
          settingsQ.data.shiprocketConfigured
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-start gap-3">
          {settingsQ.data.shiprocketConfigured ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-700" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          )}
          <div className="flex-1 text-sm">
            <p className="font-medium text-[#1a2416]">
              Shiprocket integration:{" "}
              {settingsQ.data.shiprocketConfigured ? "Connected" : "Not configured"}
            </p>
            <p className="mt-1 text-stone-600">
              {settingsQ.data.shiprocketConfigured
                ? 'When the "shiprocket" courier is selected (manually or via priority), real AWBs are issued through Shiprocket\'s API. Tracking auto-syncs from their network.'
                : "Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to enable real AWB generation. Until then, all shipments use the built-in mock provider for testing."}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Settings form */}
        <Card className="space-y-5 p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1a2416]">
                Automated dispatch
              </h2>
              <p className="mt-1 text-xs text-stone-600">
                When enabled, the system periodically picks up eligible orders
                and creates shipments using your courier priority below.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
                className="h-4 w-4 accent-[#3a5a2c]"
                data-testid="toggle-autodispatch"
              />
              <span className="font-medium text-[#1a2416]">
                {draft.enabled ? "Enabled" : "Paused"}
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-stone-700">
              Run every (min)
              <Input
                type="number"
                min={5}
                max={720}
                value={draft.runEveryMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    runEveryMinutes: Math.max(
                      5,
                      Math.min(720, Number(e.target.value) || 15),
                    ),
                  })
                }
                data-testid="input-run-every"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-stone-700">
              Max weight (g)
              <Input
                type="number"
                min={50}
                max={50000}
                value={draft.maxWeightGrams}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    maxWeightGrams: Math.max(
                      50,
                      Math.min(50000, Number(e.target.value) || 10000),
                    ),
                  })
                }
                data-testid="input-max-weight"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-stone-700">
              Order status filter
              <select
                value={draft.onlyOrderStatus}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    onlyOrderStatus: e.target.value as DispatchSettings["onlyOrderStatus"],
                  })
                }
                className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
                data-testid="select-order-status"
              >
                <option value="paid">Paid only (recommended)</option>
                <option value="pending">Pending</option>
                <option value="any">Any status</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[#1a2416]">
              Courier priority
            </h3>
            <p className="text-xs text-stone-600">
              First match wins. Drag-equivalent reorder with arrows. Remove a
              courier to skip it during auto-dispatch.
            </p>
            <ul className="space-y-1.5">
              {inPriority.map((code, idx) => {
                const c = allCouriers.find((x) => x.code === code);
                return (
                  <li
                    key={code}
                    className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                    data-testid={`priority-${code}`}
                  >
                    <span className="w-5 text-xs font-mono text-stone-400">
                      {idx + 1}.
                    </span>
                    <span className="flex-1 font-medium text-[#1a2416]">
                      {c?.name ?? code}
                    </span>
                    {c ? (
                      <span className="text-xs text-stone-500">
                        SLA {c.baseSlaDays}d · ₹{(c.costPerGramPaise / 100).toFixed(2)}/g
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === inPriority.length - 1}
                      className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(idx)}
                      className="rounded p-1 text-rose-500 hover:bg-rose-50"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {notInPriority.length ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-stone-500">Add:</span>
                {notInPriority.map((code) => {
                  const c = allCouriers.find((x) => x.code === code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => addCourier(code)}
                      className="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs text-stone-700 hover:border-[#3a5a2c] hover:text-[#3a5a2c]"
                      data-testid={`add-courier-${code}`}
                    >
                      + {c?.name ?? code}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-stone-200 pt-4">
            <div className="text-xs text-stone-500">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => triggerMut.mutate()}
                disabled={triggerMut.isPending}
                data-testid="btn-run-now"
              >
                {triggerMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Run now
              </Button>
              <Button
                onClick={() =>
                  saveMut.mutate({
                    enabled: draft.enabled,
                    courierPriority: draft.courierPriority,
                    maxWeightGrams: draft.maxWeightGrams,
                    onlyOrderStatus: draft.onlyOrderStatus,
                    runEveryMinutes: draft.runEveryMinutes,
                  })
                }
                disabled={!dirty || saveMut.isPending}
                className="bg-[#1a2416] text-amber-100 hover:bg-[#1a2416]/90"
                data-testid="btn-save-settings"
              >
                {saveMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save settings
              </Button>
            </div>
          </div>
        </Card>

        {/* Status panel */}
        <Card className="space-y-3 p-5">
          <h3 className="text-sm font-semibold text-[#1a2416]">Last run</h3>
          {settingsQ.data.settings.lastRunAt ? (
            <>
              <p className="text-2xl font-semibold text-[#1a2416]">
                {settingsQ.data.settings.lastRunCount}
              </p>
              <p className="text-xs text-stone-500">
                shipments created ·{" "}
                {new Date(settingsQ.data.settings.lastRunAt).toLocaleString()}
              </p>
              {settingsQ.data.settings.lastRunError ? (
                <p className="mt-2 rounded-md bg-rose-50 p-2 text-xs text-rose-700">
                  {settingsQ.data.settings.lastRunError}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-stone-500">Never run yet.</p>
          )}
        </Card>
      </div>

      {/* Run history */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1a2416]">Run history</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["dispatch-runs"] })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {runsQ.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Trigger</th>
                  <th className="py-2 pr-4">Shipments</th>
                  <th className="py-2 pr-4">Result</th>
                </tr>
              </thead>
              <tbody>
                {runsQ.data.items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-stone-100"
                    data-testid={`run-${r.id}`}
                  >
                    <td className="py-2 pr-4 text-xs text-stone-600">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="text-xs">
                        {r.trigger}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {r.shipmentsCreated}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {r.errorMessage ? (
                        <span className="text-rose-600">{r.errorMessage}</span>
                      ) : (
                        <span className="text-green-700">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-stone-500">No runs yet.</p>
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Shipments view
// ────────────────────────────────────────────────────────────────────────

function ShipmentsView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipStatus | "">("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const stats = useQuery<{ stats: Record<string, number> }>({
    queryKey: ["ship-stats"],
    queryFn: async () => (await fetch(`${API}/admin/shipments/_stats`, { credentials: "include" })).json(),
  });

  const list = useQuery<{ items: Shipment[] }>({
    queryKey: ["shipments", debouncedQ, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (debouncedQ) p.set("q", debouncedQ);
      if (statusFilter) p.set("status", statusFilter);
      p.set("limit", "100");
      const r = await fetch(`${API}/admin/shipments?${p.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error("list");
      return r.json();
    },
  });

  const autoDispatch = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/shipments/auto-dispatch`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("auto");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["ship-stats"] });
    },
  });

  const STATUS_FILTERS: (ShipStatus | "")[] = [
    "",
    "manifested",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "delayed",
    "undelivered",
    "returned",
    "lost",
  ];

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["manifested", "in_transit", "delivered", "delayed", "returned"] as ShipStatus[]).map(
          (s) => (
            <Card key={s} className="border-stone-200 bg-white p-3">
              <div className="text-[10px] uppercase tracking-wide text-stone-500">
                {STATUS_META[s].label}
              </div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums text-[#1a2416]">
                {stats.data?.stats[s] ?? 0}
              </div>
            </Card>
          ),
        )}
      </div>

      <Card className="border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by AWB or order #…"
              className="pl-8"
              data-testid="input-shipments-search"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => autoDispatch.mutate()}
              disabled={autoDispatch.isPending}
              data-testid="button-auto-dispatch"
            >
              <Zap className={`mr-1.5 h-4 w-4 ${autoDispatch.isPending ? "animate-pulse" : ""}`} />
              Auto-dispatch paid orders
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-shipment">
              <Truck className="mr-1.5 h-4 w-4" />
              Ship an order
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                statusFilter === s
                  ? "border-[#1a2416] bg-[#1a2416] text-amber-100"
                  : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
              }`}
              data-testid={`filter-status-${s || "all"}`}
            >
              {s ? STATUS_META[s].label : "All"}
            </button>
          ))}
        </div>
      </Card>

      <Card className="border-stone-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading shipments…
          </div>
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-sm text-stone-500">
            <Truck className="mx-auto mb-2 h-8 w-8 text-stone-300" />
            No shipments yet. Click <span className="font-medium">Ship an order</span> or{" "}
            <span className="font-medium">Auto-dispatch</span> to start.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order / AWB</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Courier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">ETA</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.data!.items.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="cursor-pointer transition hover:bg-stone-50"
                  data-testid={`row-shipment-${s.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1a2416]">#{s.orderId}</div>
                    <div className="font-mono text-xs text-stone-500">{s.awb ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[#1a2416]">{s.order?.customerName ?? "—"}</div>
                    <div className="text-xs text-stone-500">
                      {s.order?.shippingAddress?.city ?? ""}{" "}
                      {s.order?.shippingAddress?.postalCode ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">
                      {s.courierCode}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_META[s.status].cls}>
                      {STATUS_META[s.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">
                    {s.expectedDeliveryAt ? new Date(s.expectedDeliveryAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-400">
                    <ChevronRight className="inline h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {createOpen ? <CreateShipmentModal onClose={() => setCreateOpen(false)} /> : null}
      {openId !== null ? (
        <ShipmentDrawer id={openId} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function CreateShipmentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [courier, setCourier] = useState("delhivery");
  const [weight, setWeight] = useState("500");
  const [error, setError] = useState<string | null>(null);

  const couriers = useQuery<{ items: Courier[] }>({
    queryKey: ["couriers"],
    queryFn: async () => (await fetch(`${API}/admin/shipping/couriers`, { credentials: "include" })).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: Number(orderId),
          courierCode: courier,
          weightGrams: Number(weight) || 500,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "create failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["ship-stats"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md border-stone-200 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1a2416]">Create shipment</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Order #</label>
            <Input
              type="number"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="42"
              data-testid="input-create-order"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Courier</label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              data-testid="select-create-courier"
            >
              {couriers.data?.items.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} · ~{c.baseSlaDays}d
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Weight (g)</label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              data-testid="input-create-weight"
            />
          </div>
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                create.mutate();
              }}
              disabled={!orderId || create.isPending}
              data-testid="button-create-submit"
            >
              {create.isPending ? "Creating…" : "Create shipment"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ShipmentDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery<{
    shipment: Shipment;
    order: {
      id: number;
      customerName: string;
      customerEmail: string;
      total: number;
      shippingAddress: { line1: string; line2?: string; city: string; region?: string; postalCode: string; country: string };
    } | null;
    events: Array<{ id: number; kind: string; status: string | null; message: string; location: string | null; source: string; createdAt: string }>;
  }>({
    queryKey: ["shipment", id],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/shipments/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("detail");
      return r.json();
    },
  });
  const couriers = useQuery<{ items: Courier[] }>({
    queryKey: ["couriers"],
    queryFn: async () => (await fetch(`${API}/admin/shipping/couriers`, { credentials: "include" })).json(),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shipment", id] });
    qc.invalidateQueries({ queryKey: ["shipments"] });
    qc.invalidateQueries({ queryKey: ["ship-stats"] });
  };

  const tracking = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/shipments/${id}/refresh-tracking`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("track");
      return r.json();
    },
    onSuccess: refresh,
  });

  const setStatus = useMutation({
    mutationFn: async (status: ShipStatus) => {
      const r = await fetch(`${API}/admin/shipments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("status");
      return r.json();
    },
    onSuccess: refresh,
  });

  const reassign = useMutation({
    mutationFn: async ({ courierCode, reason }: { courierCode: string; reason: string }) => {
      const r = await fetch(`${API}/admin/shipments/${id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ courierCode, reason }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "reassign");
      return r.json();
    },
    onSuccess: refresh,
  });

  const troubleshoot = useMutation({
    mutationFn: async ({ issue, notes }: { issue: "delayed" | "undelivered" | "lost"; notes: string }) => {
      const r = await fetch(`${API}/admin/shipments/${id}/troubleshoot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ issue, notes }),
      });
      if (!r.ok) throw new Error("trouble");
      return r.json();
    },
    onSuccess: refresh,
  });

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const [reassignTo, setReassignTo] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [tIssue, setTIssue] = useState<"delayed" | "undelivered" | "lost">("delayed");
  const [tNotes, setTNotes] = useState("");

  const s = detail.data?.shipment;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
      data-testid="drawer-shipment"
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-stone-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-stone-500">Shipment</div>
            <div className="mt-0.5 truncate font-mono text-sm font-semibold text-[#1a2416]">
              {s?.awb ?? `#${id}`}
            </div>
            {s ? (
              <div className="mt-0.5">
                <Badge variant="outline" className={STATUS_META[s.status].cls}>
                  {STATUS_META[s.status].label}
                </Badge>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {s?.labelUrl ? (
              <a
                href={s.labelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400"
                data-testid="link-print-label"
              >
                <PrinterIcon className="h-3.5 w-3.5" /> Label
              </a>
            ) : null}
            {s?.trackingUrl ? (
              <a
                href={s.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400"
                data-testid="link-tracking"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Track
              </a>
            ) : null}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {detail.isLoading || !s ? (
            <div className="flex items-center text-sm text-stone-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* Order summary */}
              <Card className="border-stone-200 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-stone-500">Order #{s.orderId}</div>
                <div className="mt-1 text-sm text-[#1a2416]">
                  {detail.data?.order?.customerName} · {detail.data?.order?.customerEmail}
                </div>
                {detail.data?.order?.shippingAddress ? (
                  <div className="mt-2 text-xs text-stone-600">
                    {detail.data.order.shippingAddress.line1}
                    {detail.data.order.shippingAddress.line2 ? `, ${detail.data.order.shippingAddress.line2}` : ""}
                    <br />
                    {detail.data.order.shippingAddress.city}
                    {detail.data.order.shippingAddress.region ? `, ${detail.data.order.shippingAddress.region}` : ""}{" "}
                    {detail.data.order.shippingAddress.postalCode} ·{" "}
                    {detail.data.order.shippingAddress.country}
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <Kpi label="Courier" value={s.courierCode} />
                  <Kpi label="Weight" value={`${s.weightGrams}g`} />
                  <Kpi label="Value" value={inr(s.declaredValue)} />
                  <Kpi label="Shipped" value={relative(s.shippedAt)} />
                  <Kpi label="ETA" value={s.expectedDeliveryAt ? new Date(s.expectedDeliveryAt).toLocaleDateString() : "—"} />
                  <Kpi label="Delivered" value={relative(s.deliveredAt)} />
                </div>
              </Card>

              {/* Status actions */}
              <Card className="border-stone-200 bg-white p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Quick status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "in_transit",
                      "out_for_delivery",
                      "delivered",
                      "undelivered",
                      "returned",
                    ] as ShipStatus[]
                  ).map((st) => (
                    <Button
                      key={st}
                      variant="outline"
                      size="sm"
                      disabled={s.status === st || setStatus.isPending}
                      onClick={() => setStatus.mutate(st)}
                      data-testid={`button-set-status-${st}`}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      {STATUS_META[st].label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => tracking.mutate()}
                    disabled={tracking.isPending}
                    data-testid="button-refresh-tracking"
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${tracking.isPending ? "animate-spin" : ""}`} />
                    Refresh tracking
                  </Button>
                </div>
              </Card>

              {/* Troubleshoot */}
              <Card className="border-stone-200 bg-white p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-600" /> Troubleshoot
                </h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(["delayed", "undelivered", "lost"] as const).map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTIssue(i)}
                        className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition ${
                          tIssue === i
                            ? "border-[#1a2416] bg-stone-50"
                            : "border-stone-200 bg-white hover:border-stone-300"
                        }`}
                        data-testid={`button-troubleshoot-${i}`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    rows={2}
                    value={tNotes}
                    onChange={(e) => setTNotes(e.target.value)}
                    placeholder="What happened? (visible in shipment events)"
                    data-testid="input-troubleshoot-notes"
                  />
                  <Button
                    size="sm"
                    onClick={() => troubleshoot.mutate({ issue: tIssue, notes: tNotes })}
                    disabled={!tNotes.trim() || troubleshoot.isPending}
                    data-testid="button-troubleshoot-submit"
                  >
                    Flag {tIssue}
                  </Button>
                </div>
              </Card>

              {/* Reassign courier */}
              <Card className="border-stone-200 bg-white p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <Repeat className="h-3.5 w-3.5 text-[#3a5a2c]" /> Reassign courier
                </h3>
                <div className="space-y-2">
                  <select
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                    data-testid="select-reassign-courier"
                  >
                    <option value="">Choose new courier…</option>
                    {couriers.data?.items
                      .filter((c) => c.code !== s.courierCode)
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} · ~{c.baseSlaDays}d
                        </option>
                      ))}
                  </select>
                  <Input
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="Reason (optional)"
                    data-testid="input-reassign-reason"
                  />
                  <Button
                    size="sm"
                    disabled={!reassignTo || reassign.isPending}
                    onClick={() => reassign.mutate({ courierCode: reassignTo, reason: reassignReason })}
                    data-testid="button-reassign-submit"
                  >
                    Reassign & generate new AWB
                  </Button>
                </div>
              </Card>

              {/* Events timeline */}
              <Card className="border-stone-200 bg-white p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Tracking events ({detail.data?.events.length ?? 0})
                </h3>
                {(detail.data?.events.length ?? 0) === 0 ? (
                  <p className="text-xs text-stone-500">No events yet.</p>
                ) : (
                  <ol className="space-y-2 border-l-2 border-stone-200 pl-4">
                    {detail.data!.events.map((e) => (
                      <li key={e.id} className="-ml-[19px]">
                        <div className="flex items-start gap-2">
                          <span className="mt-1.5 inline-block h-2.5 w-2.5 flex-none rounded-full bg-[#3a5a2c]" />
                          <div className="flex-1">
                            <div className="text-xs text-stone-500">
                              {new Date(e.createdAt).toLocaleString()} · {e.source}
                              {e.location ? ` · ${e.location}` : ""}
                            </div>
                            <div className="text-sm text-[#1a2416]">{e.message}</div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-2">
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-[#1a2416]">{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Manifests view
// ────────────────────────────────────────────────────────────────────────

function ManifestsView() {
  const qc = useQueryClient();
  const list = useQuery<{ items: Manifest[] }>({
    queryKey: ["manifests"],
    queryFn: async () => (await fetch(`${API}/admin/manifests`, { credentials: "include" })).json(),
  });

  const closeM = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API}/admin/manifests/${id}/close`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("close");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manifests"] }),
  });

  return (
    <Card className="border-stone-200 bg-white">
      {list.isLoading ? (
        <div className="flex items-center justify-center p-12 text-sm text-stone-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading manifests…
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="p-12 text-center text-sm text-stone-500">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-stone-300" />
          No manifests yet. Manifests group same-courier shipments for pickup.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Courier</th>
              <th className="px-4 py-3 font-medium">Shipments</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {list.data!.items.map((m) => (
              <tr key={m.id} data-testid={`row-manifest-${m.id}`}>
                <td className="px-4 py-3 font-medium tabular-nums text-[#1a2416]">#{m.id}</td>
                <td className="px-4 py-3 capitalize">{m.courierCode}</td>
                <td className="px-4 py-3 tabular-nums">{m.shipmentCount}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={
                      m.status === "open"
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : "bg-stone-100 text-stone-700 border-stone-300"
                    }
                  >
                    {m.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-stone-600">
                  {relative(m.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.status === "open" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeM.mutate(m.id)}
                      disabled={closeM.isPending}
                      data-testid={`button-close-manifest-${m.id}`}
                    >
                      <PackageOpen className="mr-1 h-3.5 w-3.5" />
                      Close & print
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Returns view
// ────────────────────────────────────────────────────────────────────────

function ReturnsView() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery<{ items: ReturnRow[] }>({
    queryKey: ["returns", statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (statusFilter) p.set("status", statusFilter);
      p.set("limit", "100");
      const r = await fetch(`${API}/admin/returns?${p.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error("returns");
      return r.json();
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ReturnStatus }) => {
      const r = await fetch(`${API}/admin/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("update");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["returns"] }),
  });

  const FILTERS: (ReturnStatus | "")[] = [
    "",
    "requested",
    "approved",
    "in_transit",
    "received",
    "refunded",
    "rejected",
  ];

  return (
    <div className="space-y-4">
      <Card className="border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                  statusFilter === s
                    ? "border-[#1a2416] bg-[#1a2416] text-amber-100"
                    : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                }`}
                data-testid={`filter-return-${s || "all"}`}
              >
                {s ? RETURN_META[s].label : "All"}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-return">
            <Undo2 className="mr-1.5 h-4 w-4" />
            Log a return
          </Button>
        </div>
      </Card>

      <Card className="border-stone-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading returns…
          </div>
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-sm text-stone-500">
            <Package className="mx-auto mb-2 h-8 w-8 text-stone-300" />
            No returns on record.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Refund</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.data!.items.map((r) => (
                <tr key={r.id} data-testid={`row-return-${r.id}`}>
                  <td className="px-4 py-3 font-medium text-[#1a2416]">#{r.orderId}</td>
                  <td className="px-4 py-3">
                    <div className="text-[#1a2416]">{r.order?.customerName ?? "—"}</div>
                    <div className="text-xs text-stone-500">{r.order?.customerEmail ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-700">{r.reason}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-[#1a2416]">{inr(r.refundAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={RETURN_META[r.status].cls}>
                      {RETURN_META[r.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">{relative(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={r.status}
                      onChange={(e) =>
                        update.mutate({ id: r.id, status: e.target.value as ReturnStatus })
                      }
                      disabled={update.isPending}
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
                      data-testid={`select-return-status-${r.id}`}
                    >
                      {(
                        [
                          "requested",
                          "approved",
                          "in_transit",
                          "received",
                          "refunded",
                          "rejected",
                        ] as ReturnStatus[]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {RETURN_META[s].label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {createOpen ? <CreateReturnModal onClose={() => setCreateOpen(false)} /> : null}
    </div>
  );
}

function CreateReturnModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refund, setRefund] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: Number(orderId),
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          refundAmount: refund ? Number(refund) : undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "create failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md border-stone-200 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1a2416]">Log a return</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Order #</label>
            <Input
              type="number"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="42"
              data-testid="input-return-order"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Damaged in transit"
              data-testid="input-return-reason"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Notes</label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-return-notes"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Refund (₹) — leave blank for full</label>
            <Input
              type="number"
              value={refund}
              onChange={(e) => setRefund(e.target.value)}
              data-testid="input-return-refund"
            />
          </div>
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!orderId || !reason.trim() || create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
              data-testid="button-return-submit"
            >
              {create.isPending ? "Logging…" : "Log return"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
