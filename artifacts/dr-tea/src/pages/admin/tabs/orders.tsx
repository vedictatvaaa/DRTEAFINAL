import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useAdminListOrders,
  useAdminUpdateOrderStatus,
  getAdminListOrdersQueryKey,
  type Order,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Truck,
  PackageCheck,
  RefreshCw,
  ExternalLink,
  Printer,
  Copy as CopyIcon,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardList,
  ScrollText,
  CheckCheck,
} from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;
const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

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
  shippedAt: string | null;
  deliveredAt: string | null;
  expectedDeliveryAt: string | null;
  lastEventAt: string | null;
  createdAt: string;
}

interface Courier {
  code: string;
  name: string;
  hub: string;
  baseSlaDays: number;
}

interface SrStatus {
  configured: boolean;
  tokenRefreshedAt: string | null;
  tokenExpiresAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string;
  totalCalls: number;
  totalFailures: number;
}

const SHIP_META: Record<ShipStatus, { label: string; cls: string }> = {
  pending: { label: "Not shipped", cls: "bg-stone-100 text-stone-700 border-stone-300" },
  manifested: { label: "Manifested", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  in_transit: { label: "In transit", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  delivered: { label: "Delivered", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  delayed: { label: "Delayed", cls: "bg-orange-50 text-orange-800 border-orange-300" },
  undelivered: { label: "Undelivered", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  returned: { label: "Returned", cls: "bg-violet-50 text-violet-800 border-violet-200" },
  lost: { label: "Lost", cls: "bg-red-100 text-red-900 border-red-300" },
};

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function rel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

export default function OrdersTab() {
  const qc = useQueryClient();
  const list = useAdminListOrders();
  const updateStatus = useAdminUpdateOrderStatus();

  // Hydrate shipments only for the orders we have on screen — avoids
  // the previous bug where the most-recent-200 cap could hide shipments
  // for older orders. Backend supports up to 500 ids per request.
  const orderIdsCsv = useMemo(() => {
    const ids = (list.data ?? []).map((o) => o.id).slice(0, 500);
    return ids.join(",");
  }, [list.data]);
  const shipmentsQ = useQuery({
    queryKey: ["admin-shipments-by-order", orderIdsCsv],
    queryFn: () =>
      api<{ items: Shipment[] }>(
        `/admin/shipments?limit=500${orderIdsCsv ? `&orderIds=${encodeURIComponent(orderIdsCsv)}` : ""}`,
      ),
    enabled: orderIdsCsv.length > 0,
    refetchInterval: 60_000,
  });
  const couriersQ = useQuery({
    queryKey: ["admin-couriers"],
    queryFn: () => api<{ items: Courier[] }>("/admin/shipping/couriers"),
    staleTime: 5 * 60_000,
  });
  const srQ = useQuery({
    queryKey: ["admin-shiprocket-status"],
    queryFn: () => api<SrStatus>("/admin/shipping/shiprocket/status"),
    refetchInterval: 60_000,
  });

  const orders = list.data ?? [];
  const shipmentByOrder = useMemo(() => {
    const m = new Map<number, Shipment>();
    for (const s of shipmentsQ.data?.items ?? []) m.set(s.orderId, s);
    return m;
  }, [shipmentsQ.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getAdminListOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: ["admin-shipments-by-order"] });
  };

  // ── Filters ─────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [shipFilter, setShipFilter] = useState<"all" | "unshipped" | "in_flight" | "delivered" | "stuck">(
    "all",
  );
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      const ship = shipmentByOrder.get(o.id);
      if (shipFilter === "unshipped") {
        if (ship && ship.status !== "pending") return false;
      } else if (shipFilter === "in_flight") {
        if (!ship || !["manifested", "in_transit", "out_for_delivery"].includes(ship.status))
          return false;
      } else if (shipFilter === "delivered") {
        if (!ship || ship.status !== "delivered") return false;
      } else if (shipFilter === "stuck") {
        if (!ship || !["delayed", "undelivered", "lost", "returned"].includes(ship.status))
          return false;
      }
      return true;
    });
  }, [orders, statusFilter, shipFilter, shipmentByOrder]);

  // ── Counts for chips ────────────────────────────────────────────────
  const counts = useMemo(() => {
    let unshipped = 0,
      inFlight = 0,
      delivered = 0,
      stuck = 0;
    for (const o of orders) {
      const s = shipmentByOrder.get(o.id);
      if (!s || s.status === "pending") unshipped += 1;
      else if (["manifested", "in_transit", "out_for_delivery"].includes(s.status)) inFlight += 1;
      else if (s.status === "delivered") delivered += 1;
      else if (["delayed", "undelivered", "lost", "returned"].includes(s.status)) stuck += 1;
    }
    return { total: orders.length, unshipped, inFlight, delivered, stuck };
  }, [orders, shipmentByOrder]);

  return (
    <div className="space-y-4">
      <ShiprocketBanner sr={srQ.data ?? null} loading={srQ.isLoading} />

      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium text-[#1a2416]">
          {counts.total} orders · {counts.unshipped} unshipped · {counts.inFlight} in flight ·{" "}
          {counts.delivered} delivered{counts.stuck ? ` · ${counts.stuck} stuck` : ""}
        </h2>
        <div className="ml-auto flex flex-wrap gap-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "unshipped", label: `Unshipped (${counts.unshipped})` },
              { id: "in_flight", label: `In flight (${counts.inFlight})` },
              { id: "delivered", label: `Delivered (${counts.delivered})` },
              { id: "stuck", label: `Stuck (${counts.stuck})` },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setShipFilter(c.id)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                shipFilter === c.id
                  ? "border-[#1a2416] bg-[#1a2416] text-amber-100"
                  : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
              data-testid={`chip-${c.id}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All order statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={refresh}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Fulfilment</th>
              <th className="w-32 px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-stone-500">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {filtered.map((o) => {
              const ship = shipmentByOrder.get(o.id);
              const isOpen = openId === o.id;
              return (
                <Fragment key={o.id}>
                  <tr className="border-t align-top">
                    <td className="px-4 py-2 font-medium">
                      #{o.id}
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {o.customerName}
                      <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                    </td>
                    <td className="px-4 py-2">{inr(o.total)}</td>
                    <td className="px-4 py-2">
                      <Select
                        value={o.status}
                        onValueChange={async (v) => {
                          await updateStatus.mutateAsync({
                            id: o.id,
                            data: { status: v as OrderStatus },
                          });
                          refresh();
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <FulfilmentCell shipment={ship} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenId(isOpen ? null : o.id)}
                      >
                        {isOpen ? "Hide" : "View"}
                      </Button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t bg-muted/20">
                      <td colSpan={6} className="px-4 py-3">
                        <OrderDetail
                          order={o}
                          shipment={ship}
                          couriers={couriersQ.data?.items ?? []}
                          srConfigured={srQ.data?.configured ?? false}
                          onChanged={refresh}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ShiprocketBanner({ sr, loading }: { sr: SrStatus | null; loading: boolean }) {
  if (loading || !sr) return null;
  if (!sr.configured) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex-1">
          <div className="font-medium">Shiprocket not connected</div>
          <div className="text-xs">
            Set <code className="rounded bg-amber-100 px-1">SHIPROCKET_EMAIL</code> &{" "}
            <code className="rounded bg-amber-100 px-1">SHIPROCKET_PASSWORD</code> to enable
            one-click dispatch with real AWBs and labels. Webhook receiver is live at{" "}
            <code className="rounded bg-amber-100 px-1">/api/webhooks/shiprocket</code>.
          </div>
        </div>
      </div>
    );
  }
  const failing = sr.lastFailureAt && (!sr.lastSuccessAt || sr.lastFailureAt > sr.lastSuccessAt);
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
        failing
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {failing ? (
        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
      )}
      <div className="flex-1">
        <div className="font-medium">
          Shiprocket connected
          {sr.lastSuccessAt ? ` · last call ${rel(sr.lastSuccessAt)}` : ""}
          {sr.tokenRefreshedAt ? ` · token ${rel(sr.tokenRefreshedAt)}` : ""}
        </div>
        <div className="text-xs">
          {sr.totalCalls} API calls{sr.totalFailures ? ` · ${sr.totalFailures} failed` : ""}.
          Webhook live at <code className="rounded bg-white/60 px-1">/api/webhooks/shiprocket</code>{" "}
          (set <code className="rounded bg-white/60 px-1">SHIPROCKET_WEBHOOK_TOKEN</code> for auth).
          {failing && sr.lastFailureMessage && ` Last error: ${sr.lastFailureMessage}`}
        </div>
      </div>
    </div>
  );
}

function FulfilmentCell({ shipment }: { shipment: Shipment | undefined }) {
  if (!shipment) {
    return <span className="text-xs text-stone-500">— not shipped —</span>;
  }
  const meta = SHIP_META[shipment.status];
  return (
    <div className="space-y-1">
      <Badge variant="outline" className={`${meta.cls} text-[11px]`}>
        {meta.label}
      </Badge>
      <div className="text-xs text-muted-foreground">
        {shipment.courierCode}
        {shipment.awb ? ` · ${shipment.awb}` : ""}
      </div>
      {shipment.expectedDeliveryAt && shipment.status !== "delivered" && (
        <div className="text-xs text-muted-foreground">
          ETA {new Date(shipment.expectedDeliveryAt).toLocaleDateString()}
        </div>
      )}
      {shipment.deliveredAt && (
        <div className="text-xs text-emerald-700">
          Delivered {new Date(shipment.deliveredAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function OrderDetail({
  order,
  shipment,
  couriers,
  srConfigured,
  onChanged,
}: {
  order: Order;
  shipment: Shipment | undefined;
  couriers: Courier[];
  srConfigured: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickedCourier, setPickedCourier] = useState<string>("shiprocket");

  const create = useMutation({
    mutationFn: (courierCode: string) =>
      api<Shipment>("/admin/shipments", {
        method: "POST",
        body: JSON.stringify({ orderId: order.id, courierCode }),
      }),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (e: Error) => setError(e.message),
  });

  const refresh = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; fetched: number }>(`/admin/shipments/${shipment!.id}/refresh-tracking`, {
        method: "POST",
      }),
    onSuccess: () => onChanged(),
  });

  const oneClickShip = async () => {
    setBusy("ship");
    try {
      await create.mutateAsync(srConfigured ? "shiprocket" : pickedCourier);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Items ({order.items.length})
        </h3>
        <ul className="space-y-1 text-sm">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">
                {it.productName}
                <span className="text-xs text-stone-500"> ({it.variantSize})</span> × {it.quantity}
              </span>
              <span className="flex-shrink-0 tabular-nums">{inr(it.unitPrice * it.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Ship to
        </h3>
        <div className="text-sm text-stone-700">
          {order.shippingAddress.line1}
          <br />
          {order.shippingAddress.line2 && (
            <>
              {order.shippingAddress.line2}
              <br />
            </>
          )}
          {order.shippingAddress.city}
          {order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ""}{" "}
          {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.country}
        </div>
        {order.notes && <p className="mt-2 text-xs italic text-stone-600">{order.notes}</p>}
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Fulfilment
        </h3>
        {shipment ? (
          <div className="space-y-2 text-sm">
            <div className="text-stone-700">
              <span className="font-medium">{shipment.courierCode}</span>
              {shipment.awb && (
                <>
                  {" · "}
                  <span className="font-mono text-xs">{shipment.awb}</span>
                </>
              )}
            </div>
            <div className="text-xs text-stone-500">
              {shipment.weightGrams}g · {inr(shipment.declaredValue)} declared
              {shipment.lastEventAt ? ` · last event ${rel(shipment.lastEventAt)}` : ""}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shipment.trackingUrl && (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                >
                  <ExternalLink className="h-3 w-3" /> Track
                </a>
              )}
              {shipment.labelUrl && (
                <a
                  href={shipment.labelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                >
                  <Printer className="h-3 w-3" /> Label
                </a>
              )}
              {shipment.awb && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(shipment.awb!)}
                  className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                >
                  <CopyIcon className="h-3 w-3" /> Copy AWB
                </button>
              )}
              <button
                type="button"
                disabled={refresh.isPending}
                onClick={() => refresh.mutate()}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
                Refresh tracking
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-stone-500">
              No shipment yet. Weight & items will be auto-computed from order_items.
            </div>
            {srConfigured ? (
              <Button
                size="sm"
                onClick={oneClickShip}
                disabled={busy === "ship" || create.isPending}
                className="w-full bg-[#1a2416] text-amber-100 hover:bg-[#243218]"
              >
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                {create.isPending ? "Creating…" : "Ship via Shiprocket"}
              </Button>
            ) : (
              <div className="space-y-1.5">
                <Select value={pickedCourier} onValueChange={setPickedCourier}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {couriers
                      .filter((c) => c.code !== "shiprocket")
                      .map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={oneClickShip}
                  disabled={busy === "ship" || create.isPending}
                  className="w-full"
                  variant="outline"
                >
                  <Truck className="mr-1.5 h-3.5 w-3.5" />
                  {create.isPending ? "Creating…" : "Create shipment"}
                </Button>
              </div>
            )}
            {error && (
              <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800">
                {error}
              </div>
            )}
          </div>
        )}
        {shipment && shipment.status === "delivered" && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
            <PackageCheck className="h-3 w-3" /> Delivered cleanly
          </div>
        )}
      </div>

      <DocumentsBlock order={order} onChanged={onChanged} />
    </div>
  );
}

// ── Documents (Invoice / Packing Slip / E-way Bill / GST issue) ──────
// Grouped panel that spans the full row so all the print actions live in
// one obvious place. Uses the new /admin/orders/:id/* HTML endpoints.

function DocumentsBlock({
  order,
  onChanged,
}: {
  order: Order & { invoiceNumber?: string | null; invoiceIssuedAt?: string | null };
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const issue = useMutation({
    mutationFn: () =>
      api<{
        invoiceNumber: string;
        invoiceIssuedAt: string;
        alreadyIssued: boolean;
      }>(`/admin/orders/${order.id}/issue-invoice`, { method: "POST" }),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (e: Error) => setError(e.message),
  });

  // Open the printable HTML in a new tab — `#print` triggers auto-print.
  const open = (path: string) => window.open(`${API}${path}`, "_blank", "noopener");
  const issued = !!order.invoiceNumber;

  return (
    <div className="md:col-span-3 mt-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-600 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Documents
        </h3>
        <div className="text-xs text-stone-500">
          {issued ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCheck className="h-3 w-3" /> Tax invoice{" "}
              <span className="font-mono text-[11px]">{order.invoiceNumber}</span>{" "}
              issued{order.invoiceIssuedAt ? ` ${rel(order.invoiceIssuedAt)}` : ""}
            </span>
          ) : (
            <span className="text-amber-700">Proforma — not yet a tax invoice</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => open(`/admin/orders/${order.id}/invoice`)}
          className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs hover:bg-stone-100"
        >
          <FileText className="h-3 w-3" />
          {issued ? "Tax invoice (customer)" : "Proforma invoice"}
        </button>
        <button
          type="button"
          onClick={() => open(`/admin/orders/${order.id}/invoice?variant=admin`)}
          className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs hover:bg-stone-100"
        >
          <FileText className="h-3 w-3" /> Admin copy
        </button>
        <button
          type="button"
          onClick={() => open(`/admin/orders/${order.id}/packing-slip`)}
          className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs hover:bg-stone-100"
        >
          <ClipboardList className="h-3 w-3" /> Packing slip
        </button>
        <button
          type="button"
          onClick={() => open(`/admin/orders/${order.id}/eway-bill`)}
          className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs hover:bg-stone-100"
        >
          <ScrollText className="h-3 w-3" /> E-way bill worksheet
        </button>
        {!issued && (
          <button
            type="button"
            disabled={issue.isPending}
            onClick={() => issue.mutate()}
            className="inline-flex items-center gap-1 rounded-md border border-[#1a2416] bg-[#1a2416] px-2.5 py-1 text-xs text-amber-100 hover:bg-[#243218] disabled:opacity-60"
          >
            <CheckCheck className="h-3 w-3" />
            {issue.isPending ? "Issuing…" : "Issue invoice number"}
          </button>
        )}
      </div>
      {error && (
        <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}
