import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  AlertTriangle,
  Boxes,
  History,
  Truck,
  Settings2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const API = `${import.meta.env.BASE_URL}api`;

type SubTab = "overview" | "stock" | "movements" | "suppliers" | "rules";

interface VariantStock {
  productId: string;
  productName: string;
  variantSize: string;
  stock: number;
  unitPrice: number;
  minStock: number | null;
  reorderQty: number | null;
  lowStock: boolean;
}

interface Overview {
  totals: {
    totalUnits: number;
    totalValuePaise: number;
    productCount: number;
    variantCount: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  lowStock: VariantStock[];
  outOfStock: VariantStock[];
}

interface Movement {
  id: number;
  productId: string;
  productName: string | null;
  variantSize: string;
  delta: number;
  kind: "receive" | "adjust" | "sale" | "return" | "reserve" | "release";
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdBy: string;
  createdAt: string;
}

interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  leadTimeDays: number;
  notes: string | null;
  createdAt: string;
}

interface ReorderRule {
  id: number;
  productId: string;
  variantSize: string;
  minStock: number;
  reorderQty: number;
  supplierId: number | null;
  enabled: boolean;
  productName: string | null;
  supplierName: string | null;
  updatedAt: string;
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

export default function InventoryTab() {
  const [sub, setSub] = useState<SubTab>("overview");
  const tabs: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "overview", label: "Overview", icon: Boxes },
    { id: "stock", label: "Stock", icon: Package },
    { id: "movements", label: "Movements", icon: History },
    { id: "suppliers", label: "Suppliers", icon: Truck },
    { id: "rules", label: "Reorder rules", icon: Settings2 },
  ];
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#1a2416]">Inventory</h1>
        <p className="text-sm text-stone-600">
          Stock levels, movements, suppliers and reorder rules.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-stone-200 pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition ${
              sub === id
                ? "bg-[#FAF8F4] text-[#1a2416] font-semibold border-b-2 border-amber-300"
                : "text-stone-600 hover:text-[#1a2416]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {sub === "overview" && <OverviewPane onJump={setSub} />}
      {sub === "stock" && <StockPane />}
      {sub === "movements" && <MovementsPane />}
      {sub === "suppliers" && <SuppliersPane />}
      {sub === "rules" && <RulesPane />}
    </div>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────────

function OverviewPane({ onJump }: { onJump: (s: SubTab) => void }) {
  const overview = useQuery({
    queryKey: ["inventory-overview"],
    queryFn: () => get<Overview>("/admin/inventory/overview"),
  });
  if (overview.isLoading)
    return <div className="text-sm text-stone-500">Loading…</div>;
  const o = overview.data;
  if (!o) return <div className="text-sm text-rose-600">Failed to load.</div>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Units in stock" value={o.totals.totalUnits.toLocaleString("en-IN")} />
        <Stat label="Stock value" value={inr(o.totals.totalValuePaise)} />
        <Stat
          label="Low stock"
          value={String(o.totals.lowStockCount)}
          tone={o.totals.lowStockCount > 0 ? "warn" : "ok"}
        />
        <Stat
          label="Out of stock"
          value={String(o.totals.outOfStockCount)}
          tone={o.totals.outOfStockCount > 0 ? "danger" : "ok"}
        />
      </div>
      <Card className="p-5 bg-white border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold text-[#1a2416]">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Low stock alerts
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onJump("rules")}
          >
            Manage rules
          </Button>
        </div>
        {o.lowStock.length === 0 ? (
          <div className="text-sm text-stone-500 py-6 text-center">
            All variants above their reorder threshold.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-stone-500">
                <tr>
                  <th className="text-left py-2">Product</th>
                  <th className="text-left">Variant</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Min</th>
                  <th className="text-right">Reorder qty</th>
                </tr>
              </thead>
              <tbody>
                {o.lowStock.map((v) => (
                  <tr key={`${v.productId}-${v.variantSize}`} className="border-t border-stone-100">
                    <td className="py-2">{v.productName}</td>
                    <td>{v.variantSize}</td>
                    <td className="text-right font-mono text-rose-600">{v.stock}</td>
                    <td className="text-right font-mono">{v.minStock}</td>
                    <td className="text-right font-mono">{v.reorderQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-600"
      : tone === "danger"
      ? "text-rose-600"
      : tone === "ok"
      ? "text-emerald-600"
      : "text-[#1a2416]";
  return (
    <Card className="p-4 bg-[#FAF8F4] border-stone-200">
      <div className="text-xs uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
    </Card>
  );
}

// ─── Stock list + adjust ───────────────────────────────────────────────────

function StockPane() {
  const stock = useQuery({
    queryKey: ["inventory-stock"],
    queryFn: () => get<{ items: VariantStock[] }>("/admin/inventory/stock"),
  });
  const [filter, setFilter] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<VariantStock | null>(null);

  const filtered = useMemo(() => {
    const items = stock.data?.items ?? [];
    const q = filter.toLowerCase().trim();
    return q
      ? items.filter(
          (v) =>
            v.productName.toLowerCase().includes(q) ||
            v.variantSize.toLowerCase().includes(q),
        )
      : items;
  }, [stock.data, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search product or size…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-xs text-stone-500">
          {filtered.length} variants
        </div>
      </div>
      <Card className="p-0 overflow-hidden bg-white border-stone-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 bg-stone-50">
              <tr>
                <th className="text-left p-3">Product</th>
                <th className="text-left">Variant</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Min</th>
                <th className="text-right">Unit price</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {stock.isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-stone-500">Loading…</td></tr>
              )}
              {!stock.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-stone-500">No variants.</td></tr>
              )}
              {filtered.map((v) => (
                <tr
                  key={`${v.productId}-${v.variantSize}`}
                  className={`border-t border-stone-100 ${v.lowStock ? "bg-amber-50/40" : ""}`}
                >
                  <td className="p-3">{v.productName}</td>
                  <td>{v.variantSize}</td>
                  <td className="text-right font-mono">
                    {v.stock <= 0 ? (
                      <Badge variant="destructive">0</Badge>
                    ) : v.lowStock ? (
                      <span className="text-amber-700">{v.stock}</span>
                    ) : (
                      v.stock
                    )}
                  </td>
                  <td className="text-right font-mono text-stone-500">
                    {v.minStock ?? "—"}
                  </td>
                  <td className="text-right font-mono">{inr(v.unitPrice)}</td>
                  <td className="text-right p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAdjustTarget(v)}
                    >
                      Adjust
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adjustTarget && (
        <AdjustModal
          target={adjustTarget}
          onClose={() => setAdjustTarget(null)}
        />
      )}
    </div>
  );
}

function AdjustModal({
  target,
  onClose,
}: {
  target: VariantStock;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"receive" | "adjust" | "return">("adjust");
  const m = useMutation({
    mutationFn: () =>
      send("POST", "/admin/inventory/adjust", {
        productId: target.productId,
        variantSize: target.variantSize,
        delta,
        reason,
        kind,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory-stock"] });
      void qc.invalidateQueries({ queryKey: ["inventory-overview"] });
      void qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="p-5 w-full max-w-md bg-white">
        <h3 className="font-semibold text-[#1a2416] mb-1">
          Adjust stock — {target.productName}
        </h3>
        <p className="text-xs text-stone-500 mb-4">
          {target.variantSize} · current stock {target.stock}
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase text-stone-500">Kind</label>
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "receive" | "adjust" | "return")
              }
              className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="receive">Receive (stock in)</option>
              <option value="adjust">Adjust (cycle count, damage)</option>
              <option value="return">Return (customer return)</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-stone-500">
              Delta (use negative for write-offs)
            </label>
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value) || 0)}
            />
            <p className="text-xs text-stone-500 mt-1">
              New stock will be {target.stock + delta}.
            </p>
          </div>
          <div>
            <label className="text-xs uppercase text-stone-500">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Cycle count Apr 24 — found 6 extra packs"
              rows={3}
            />
          </div>
          {m.isError && (
            <div className="text-sm text-rose-600">
              {(m.error as Error).message}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={delta === 0 || reason.trim().length < 2 || m.isPending}
            className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
          >
            {m.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Movements ─────────────────────────────────────────────────────────────

function MovementsPane() {
  const m = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => get<{ items: Movement[] }>("/admin/inventory/movements"),
  });
  return (
    <Card className="p-0 overflow-hidden bg-white border-stone-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-stone-500 bg-stone-50">
            <tr>
              <th className="text-left p-3">When</th>
              <th className="text-left">Product</th>
              <th className="text-left">Variant</th>
              <th className="text-right">Δ</th>
              <th className="text-left">Kind</th>
              <th className="text-left">Reason / ref</th>
              <th className="text-left p-3">By</th>
            </tr>
          </thead>
          <tbody>
            {m.isLoading && (
              <tr><td colSpan={7} className="p-6 text-center text-stone-500">Loading…</td></tr>
            )}
            {!m.isLoading && (m.data?.items ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-stone-500">No movements yet.</td></tr>
            )}
            {(m.data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-t border-stone-100">
                <td className="p-3 whitespace-nowrap text-stone-500">
                  {new Date(row.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td>{row.productName ?? row.productId}</td>
                <td>{row.variantSize}</td>
                <td
                  className={`text-right font-mono ${
                    row.delta >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {row.delta > 0 ? "+" : ""}
                  {row.delta}
                </td>
                <td>
                  <Badge variant="outline" className="capitalize">{row.kind}</Badge>
                </td>
                <td className="text-stone-600">
                  {row.reason ?? (row.refType ? `${row.refType} ${row.refId}` : "—")}
                </td>
                <td className="p-3 text-stone-500">{row.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Suppliers ─────────────────────────────────────────────────────────────

function SuppliersPane() {
  const qc = useQueryClient();
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => get<{ items: Supplier[] }>("/admin/suppliers"),
  });
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const del = useMutation({
    mutationFn: (id: number) => send("DELETE", `/admin/suppliers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setEditing("new")}
          className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
        >
          <Plus className="h-4 w-4 mr-1" /> Add supplier
        </Button>
      </div>
      <Card className="p-0 overflow-hidden bg-white border-stone-200">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-stone-500 bg-stone-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left">Contact</th>
              <th className="text-left">Email</th>
              <th className="text-left">Phone</th>
              <th className="text-right">Lead time</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-stone-500">Loading…</td></tr>
            )}
            {!suppliers.isLoading && (suppliers.data?.items ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-stone-500">No suppliers yet.</td></tr>
            )}
            {(suppliers.data?.items ?? []).map((s) => (
              <tr key={s.id} className="border-t border-stone-100">
                <td className="p-3 font-medium text-[#1a2416]">{s.name}</td>
                <td>{s.contactName ?? "—"}</td>
                <td className="text-stone-600">{s.email ?? "—"}</td>
                <td className="text-stone-600">{s.phone ?? "—"}</td>
                <td className="text-right font-mono">{s.leadTimeDays}d</td>
                <td className="text-right p-3 space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Delete supplier ${s.name}?`)) del.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && (
        <SupplierModal
          supplier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SupplierModal({
  supplier,
  onClose,
}: {
  supplier: Supplier | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contactName: supplier?.contactName ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    leadTimeDays: supplier?.leadTimeDays ?? 7,
    notes: supplier?.notes ?? "",
  });
  const m = useMutation({
    mutationFn: () =>
      supplier
        ? send("PATCH", `/admin/suppliers/${supplier.id}`, form)
        : send("POST", "/admin/suppliers", form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="p-5 w-full max-w-md bg-white">
        <h3 className="font-semibold text-[#1a2416] mb-4">
          {supplier ? `Edit ${supplier.name}` : "New supplier"}
        </h3>
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Contact name">
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Lead time (days)">
            <Input
              type="number"
              value={form.leadTimeDays}
              onChange={(e) => setForm({ ...form, leadTimeDays: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </Field>
          {m.isError && <div className="text-sm text-rose-600">{(m.error as Error).message}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={form.name.trim().length < 2 || m.isPending}
            className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
          >
            {m.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase text-stone-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ─── Reorder rules ─────────────────────────────────────────────────────────

function RulesPane() {
  const qc = useQueryClient();
  const rules = useQuery({
    queryKey: ["reorder-rules"],
    queryFn: () => get<{ items: ReorderRule[] }>("/admin/reorder-rules"),
  });
  const stock = useQuery({
    queryKey: ["inventory-stock"],
    queryFn: () => get<{ items: VariantStock[] }>("/admin/inventory/stock"),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => get<{ items: Supplier[] }>("/admin/suppliers"),
  });
  const [editing, setEditing] = useState<ReorderRule | "new" | null>(null);
  const del = useMutation({
    mutationFn: (id: number) => send("DELETE", `/admin/reorder-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reorder-rules"] }),
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setEditing("new")}
          className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
        >
          <Plus className="h-4 w-4 mr-1" /> Add rule
        </Button>
      </div>
      <Card className="p-0 overflow-hidden bg-white border-stone-200">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-stone-500 bg-stone-50">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-left">Variant</th>
              <th className="text-right">Min</th>
              <th className="text-right">Reorder qty</th>
              <th className="text-left">Supplier</th>
              <th className="text-left">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.isLoading && (
              <tr><td colSpan={7} className="p-6 text-center text-stone-500">Loading…</td></tr>
            )}
            {!rules.isLoading && (rules.data?.items ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-stone-500">No rules yet.</td></tr>
            )}
            {(rules.data?.items ?? []).map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="p-3">{r.productName ?? r.productId}</td>
                <td>{r.variantSize}</td>
                <td className="text-right font-mono">{r.minStock}</td>
                <td className="text-right font-mono">{r.reorderQty}</td>
                <td>{r.supplierName ?? "—"}</td>
                <td>
                  <Badge variant={r.enabled ? "default" : "outline"}>
                    {r.enabled ? "Active" : "Disabled"}
                  </Badge>
                </td>
                <td className="text-right p-3 space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Delete this rule?")) del.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && (
        <RuleModal
          rule={editing === "new" ? null : editing}
          variants={stock.data?.items ?? []}
          suppliers={suppliers.data?.items ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RuleModal({
  rule,
  variants,
  suppliers,
  onClose,
}: {
  rule: ReorderRule | null;
  variants: VariantStock[];
  suppliers: Supplier[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    productId: rule?.productId ?? variants[0]?.productId ?? "",
    variantSize: rule?.variantSize ?? variants[0]?.variantSize ?? "",
    minStock: rule?.minStock ?? 10,
    reorderQty: rule?.reorderQty ?? 50,
    supplierId: rule?.supplierId ?? null,
    enabled: rule?.enabled ?? true,
  });
  const productOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sizes: string[] }>();
    for (const v of variants) {
      const existing = map.get(v.productId);
      if (existing) existing.sizes.push(v.variantSize);
      else map.set(v.productId, { id: v.productId, name: v.productName, sizes: [v.variantSize] });
    }
    return Array.from(map.values());
  }, [variants]);
  const sizes = productOptions.find((p) => p.id === form.productId)?.sizes ?? [];
  const m = useMutation({
    mutationFn: () =>
      rule
        ? send("PATCH", `/admin/reorder-rules/${rule.id}`, {
            minStock: form.minStock,
            reorderQty: form.reorderQty,
            supplierId: form.supplierId,
            enabled: form.enabled,
          })
        : send("POST", "/admin/reorder-rules", form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reorder-rules"] });
      void qc.invalidateQueries({ queryKey: ["inventory-overview"] });
      void qc.invalidateQueries({ queryKey: ["inventory-stock"] });
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="p-5 w-full max-w-md bg-white">
        <h3 className="font-semibold text-[#1a2416] mb-4">
          {rule ? "Edit reorder rule" : "New reorder rule"}
        </h3>
        <div className="space-y-3">
          {!rule && (
            <>
              <Field label="Product">
                <select
                  value={form.productId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const p = productOptions.find((x) => x.id === pid);
                    setForm({ ...form, productId: pid, variantSize: p?.sizes[0] ?? "" });
                  }}
                  className="w-full rounded border border-stone-200 px-3 py-2 text-sm"
                >
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Variant">
                <select
                  value={form.variantSize}
                  onChange={(e) => setForm({ ...form, variantSize: e.target.value })}
                  className="w-full rounded border border-stone-200 px-3 py-2 text-sm"
                >
                  {sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min stock">
              <Input
                type="number"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Reorder qty">
              <Input
                type="number"
                value={form.reorderQty}
                onChange={(e) => setForm({ ...form, reorderQty: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <Field label="Supplier">
            <select
              value={form.supplierId ?? ""}
              onChange={(e) =>
                setForm({ ...form, supplierId: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Enabled
          </label>
          {m.isError && <div className="text-sm text-rose-600">{(m.error as Error).message}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={!form.productId || !form.variantSize || m.isPending}
            className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
          >
            {m.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
