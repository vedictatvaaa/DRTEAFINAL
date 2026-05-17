import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RotateCcw,
  Search,
  Loader2,
  Plus,
  PackageCheck,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

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
  shipmentId: number | null;
  reason: string;
  notes: string | null;
  status: ReturnStatus;
  refundAmount: number;
  pickupAwb: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: number;
    customerName: string | null;
    customerEmail: string | null;
    total: number;
  } | null;
}

interface ListResponse {
  items: ReturnRow[];
  hasMore: boolean;
  nextOffset: number | null;
}

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const STATUS_FILTERS: Array<{ value: ReturnStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "in_transit", label: "In transit" },
  { value: "received", label: "Received" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_META: Record<
  ReturnStatus,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  requested: { label: "Requested", tone: "bg-amber-100 text-amber-900", icon: Clock },
  approved: { label: "Approved", tone: "bg-blue-100 text-blue-900", icon: CheckCircle2 },
  in_transit: { label: "In transit", tone: "bg-indigo-100 text-indigo-900", icon: Truck },
  received: { label: "Received", tone: "bg-purple-100 text-purple-900", icon: PackageCheck },
  refunded: { label: "Refunded", tone: "bg-emerald-100 text-emerald-900", icon: IndianRupee },
  rejected: { label: "Rejected", tone: "bg-red-100 text-red-900", icon: XCircle },
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}
async function send<T>(
  path: string,
  method: "POST" | "PATCH",
  body?: unknown,
): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

export default function ReturnsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<ReturnStatus | "all">("all");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery({
    queryKey: ["admin-returns", status, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "100");
      return get<ListResponse>(`/admin/returns?${params.toString()}`);
    },
  });

  const stats = useMemo(() => {
    const items = list.data?.items ?? [];
    const counts: Record<ReturnStatus, number> = {
      requested: 0,
      approved: 0,
      in_transit: 0,
      received: 0,
      refunded: 0,
      rejected: 0,
    };
    let pendingRefundPaise = 0;
    let refundedPaise = 0;
    for (const r of items) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (r.status === "refunded") refundedPaise += r.refundAmount;
      else if (r.status !== "rejected") pendingRefundPaise += r.refundAmount;
    }
    return { counts, pendingRefundPaise, refundedPaise, total: items.length };
  }, [list.data]);

  const patchMutation = useMutation({
    mutationFn: (args: {
      id: number;
      patch: Partial<{
        status: ReturnStatus;
        notes: string;
        refundAmount: number;
        pickupAwb: string;
      }>;
    }) => send(`/admin/returns/${args.id}`, "PATCH", args.patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-returns"] });
    },
    onError: (err) => {
      toast({
        title: "Update failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif font-semibold inline-flex items-center gap-2">
            <RotateCcw className="w-6 h-6" /> Returns &amp; refunds
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Track every customer return from request through pickup, receipt
            and refund. Refunds aren't issued automatically — set the amount
            and mark <em>Refunded</em> once payment goes back.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New return
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Open requests" value={stats.counts.requested} />
        <StatCard label="In transit" value={stats.counts.in_transit} />
        <StatCard label="Received" value={stats.counts.received} />
        <StatCard
          label="Pending refunds"
          value={inr(stats.pendingRefundPaise)}
          tone="text-amber-700"
        />
        <StatCard
          label="Refunded (shown)"
          value={inr(stats.refundedPaise)}
          tone="text-emerald-700"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              status === f.value
                ? "bg-[#1a2416] text-white border-[#1a2416]"
                : "bg-white text-[#1a2416] border-black/10 hover:bg-black/5"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or order #"
            className="pl-9"
          />
        </div>
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : list.data?.items.length ? (
        <div className="space-y-3">
          {list.data.items.map((r) => (
            <ReturnCard
              key={r.id}
              row={r}
              onPatch={(patch) =>
                patchMutation.mutate({ id: r.id, patch })
              }
              busy={
                patchMutation.isPending && patchMutation.variables?.id === r.id
              }
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No returns match the current filters.
        </Card>
      )}

      {createOpen && (
        <CreateReturnModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void qc.invalidateQueries({ queryKey: ["admin-returns"] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>
        {value}
      </div>
    </Card>
  );
}

function ReturnCard({
  row,
  onPatch,
  busy,
}: {
  row: ReturnRow;
  onPatch: (patch: {
    status?: ReturnStatus;
    notes?: string;
    refundAmount?: number;
    pickupAwb?: string;
  }) => void;
  busy: boolean;
}) {
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  const [refundRupees, setRefundRupees] = useState(
    String(Math.round(row.refundAmount / 100)),
  );
  const [awb, setAwb] = useState(row.pickupAwb ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const orderTotal = row.order?.total ?? 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${meta.tone} border-0 inline-flex items-center gap-1`}>
              <Icon className="w-3 h-3" /> {meta.label}
            </Badge>
            <span className="text-sm font-semibold">Return #{row.id}</span>
            <span className="text-xs text-muted-foreground">
              for order #{row.orderId}
            </span>
            {row.order?.customerEmail && (
              <span className="text-xs text-muted-foreground">
                · {row.order.customerEmail}
              </span>
            )}
          </div>
          <div className="text-sm mt-2 max-w-2xl">
            <span className="font-medium">Reason:</span> {row.reason}
          </div>
          {orderTotal > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Order total {inr(orderTotal)} · created{" "}
              {new Date(row.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Refund</div>
          <div className="text-lg font-semibold">{inr(row.refundAmount)}</div>
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Refund amount (₹)
          </label>
          <div className="flex gap-2 mt-1">
            <Input
              type="number"
              min={0}
              value={refundRupees}
              onChange={(e) => setRefundRupees(e.target.value)}
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                const n = Number(refundRupees);
                if (!Number.isFinite(n) || n < 0) return;
                onPatch({ refundAmount: Math.round(n * 100) });
              }}
            >
              Save
            </Button>
          </div>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Pickup AWB
          </label>
          <div className="flex gap-2 mt-1">
            <Input
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              placeholder="Tracking #"
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onPatch({ pickupAwb: awb.trim() })}
            >
              Save
            </Button>
          </div>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Internal notes
          </label>
          <div className="flex gap-2 mt-1">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visible to admins only"
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onPatch({ notes })}
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {row.status === "requested" && (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onPatch({ status: "approved" })}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onPatch({ status: "rejected" })}
            >
              <XCircle className="w-3 h-3 mr-1" /> Reject
            </Button>
          </>
        )}
        {row.status === "approved" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onPatch({ status: "in_transit" })}
          >
            <Truck className="w-3 h-3 mr-1" /> Mark picked up
          </Button>
        )}
        {row.status === "in_transit" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onPatch({ status: "received" })}
          >
            <PackageCheck className="w-3 h-3 mr-1" /> Mark received
          </Button>
        )}
        {row.status === "received" && (
          <Button
            size="sm"
            disabled={busy || row.refundAmount <= 0}
            onClick={() => onPatch({ status: "refunded" })}
          >
            <IndianRupee className="w-3 h-3 mr-1" />
            {row.refundAmount > 0
              ? `Mark refunded (${inr(row.refundAmount)})`
              : "Set refund amount first"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function CreateReturnModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refundRupees, setRefundRupees] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const oid = Number(orderId);
    if (!Number.isInteger(oid) || oid <= 0) {
      toast({ title: "Enter a valid order #", variant: "destructive" });
      return;
    }
    if (reason.trim().length < 2) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const refundN = Number(refundRupees);
      await send("/admin/returns", "POST", {
        orderId: oid,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        refundAmount:
          Number.isFinite(refundN) && refundN > 0
            ? Math.round(refundN * 100)
            : undefined,
      });
      toast({ title: `Return logged for order #${oid}` });
      onCreated();
    } catch (err) {
      toast({
        title: "Failed to create return",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-serif text-lg font-semibold">Log a return</h3>
          <p className="text-sm text-muted-foreground">
            Use this when a customer reaches out off-platform. The return is
            created in <em>Requested</em> state.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium">Order #</label>
          <Input
            type="number"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. 1042"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Reason</label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Damaged in transit / wrong size / etc."
          />
        </div>
        <div>
          <label className="text-xs font-medium">Refund amount (₹, optional)</label>
          <Input
            type="number"
            min={0}
            value={refundRupees}
            onChange={(e) => setRefundRupees(e.target.value)}
            placeholder="Leave blank if refund TBD"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Internal notes</label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the warehouse / support team should know"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create return"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
