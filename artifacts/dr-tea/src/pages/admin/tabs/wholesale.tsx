import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Inbox,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const API = `${import.meta.env.BASE_URL}api`;

type Pane = "leads" | "accounts";

interface Lead {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  segment: string;
  monthlyVolume: string;
  message: string;
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  createdAt: string;
}

interface Account {
  id: number;
  leadId: number | null;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  gstin: string | null;
  tier: "bronze" | "silver" | "gold" | "platinum";
  discountPct: number;
  paymentTerms: "prepaid" | "net15" | "net30" | "net45";
  creditLimitPaise: number;
  outstandingPaise: number;
  status: "active" | "suspended" | "closed";
  notes: string | null;
  createdAt: string;
}

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

async function get<T>(p: string): Promise<T> {
  const r = await fetch(`${API}${p}`, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}
async function send<T>(method: string, p: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${p}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export default function WholesaleTab() {
  const [pane, setPane] = useState<Pane>("leads");
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#1a2416]">Wholesale / B2B</h1>
        <p className="text-sm text-stone-600">
          Inbound leads and approved B2B accounts.
        </p>
      </header>

      <div className="flex gap-1.5 border-b border-stone-200">
        {(
          [
            { id: "leads", label: "Leads", icon: Inbox },
            { id: "accounts", label: "Accounts", icon: Building2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPane(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md ${
              pane === id
                ? "bg-[#FAF8F4] text-[#1a2416] font-semibold border-b-2 border-amber-300"
                : "text-stone-600 hover:text-[#1a2416]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {pane === "leads" && <LeadsPane onPromoted={() => setPane("accounts")} />}
      {pane === "accounts" && <AccountsPane />}
    </div>
  );
}

function LeadsPane({ onPromoted }: { onPromoted: () => void }) {
  const qc = useQueryClient();
  const leads = useQuery({
    queryKey: ["wholesale-leads"],
    queryFn: () => get<{ leads: Lead[] }>("/admin/wholesale/leads"),
  });
  const [promote, setPromote] = useState<Lead | null>(null);
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Lead["status"] }) =>
      send("PATCH", `/admin/wholesale/leads/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wholesale-leads"] }),
  });
  return (
    <div className="space-y-3">
      <Card className="p-0 overflow-hidden bg-white border-stone-200">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-stone-500 bg-stone-50">
            <tr>
              <th className="text-left p-3">Company</th>
              <th className="text-left">Contact</th>
              <th className="text-left">Segment</th>
              <th className="text-left">Volume</th>
              <th className="text-left">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-stone-500">Loading…</td></tr>
            )}
            {!leads.isLoading && (leads.data?.leads ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-stone-500">No leads yet.</td></tr>
            )}
            {(leads.data?.leads ?? []).map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="p-3">
                  <div className="font-medium text-[#1a2416]">{l.companyName}</div>
                  <div className="text-xs text-stone-500">{l.city}{l.state ? `, ${l.state}` : ""}</div>
                </td>
                <td>
                  <div>{l.contactName}</div>
                  <div className="text-xs text-stone-500">{l.email}</div>
                </td>
                <td className="capitalize">{l.segment}</td>
                <td>{l.monthlyVolume}</td>
                <td>
                  <select
                    value={l.status}
                    onChange={(e) =>
                      setStatus.mutate({ id: l.id, status: e.target.value as Lead["status"] })
                    }
                    className="rounded border border-stone-200 px-2 py-1 text-xs"
                  >
                    {(["new", "contacted", "quoted", "won", "lost"] as const).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="text-right p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPromote(l)}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    Promote
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {promote && (
        <AccountModal
          lead={promote}
          onClose={() => setPromote(null)}
          onSaved={() => {
            setPromote(null);
            void qc.invalidateQueries({ queryKey: ["wholesale-leads"] });
            onPromoted();
          }}
        />
      )}
    </div>
  );
}

function AccountsPane() {
  const qc = useQueryClient();
  const accounts = useQuery({
    queryKey: ["wholesale-accounts"],
    queryFn: () => get<{ items: Account[] }>("/admin/wholesale/accounts"),
  });
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const items = accounts.data?.items ?? [];
    const q = filter.toLowerCase().trim();
    return q
      ? items.filter(
          (a) =>
            a.companyName.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q),
        )
      : items;
  }, [accounts.data, filter]);
  const del = useMutation({
    mutationFn: (id: number) => send("DELETE", `/admin/wholesale/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wholesale-accounts"] }),
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search accounts…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button
          onClick={() => setEditing("new")}
          className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
        >
          <Plus className="h-4 w-4 mr-1" /> Add account
        </Button>
      </div>
      <Card className="p-0 overflow-hidden bg-white border-stone-200">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-stone-500 bg-stone-50">
            <tr>
              <th className="text-left p-3">Company</th>
              <th className="text-left">Tier</th>
              <th className="text-right">Discount</th>
              <th className="text-left">Terms</th>
              <th className="text-right">Credit</th>
              <th className="text-right">Outstanding</th>
              <th className="text-left">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.isLoading && (
              <tr><td colSpan={8} className="p-6 text-center text-stone-500">Loading…</td></tr>
            )}
            {!accounts.isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-stone-500">No accounts yet.</td></tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-stone-100">
                <td className="p-3">
                  <div className="font-medium text-[#1a2416]">{a.companyName}</div>
                  <div className="text-xs text-stone-500">{a.email}</div>
                </td>
                <td>
                  <Badge variant="outline" className="capitalize">{a.tier}</Badge>
                </td>
                <td className="text-right font-mono">{a.discountPct}%</td>
                <td className="uppercase text-xs">{a.paymentTerms}</td>
                <td className="text-right font-mono">{inr(a.creditLimitPaise)}</td>
                <td
                  className={`text-right font-mono ${
                    a.outstandingPaise > a.creditLimitPaise ? "text-rose-600" : ""
                  }`}
                >
                  {inr(a.outstandingPaise)}
                </td>
                <td>
                  <Badge
                    variant={
                      a.status === "active"
                        ? "default"
                        : a.status === "suspended"
                        ? "outline"
                        : "destructive"
                    }
                    className="capitalize"
                  >
                    {a.status}
                  </Badge>
                </td>
                <td className="text-right p-3 space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Delete ${a.companyName}?`)) del.mutate(a.id);
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
        <AccountModal
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["wholesale-accounts"] });
          }}
        />
      )}
    </div>
  );
}

function AccountModal({
  account,
  lead,
  onClose,
  onSaved,
}: {
  account?: Account | null;
  lead?: Lead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(account);
  const [form, setForm] = useState({
    companyName: account?.companyName ?? lead?.companyName ?? "",
    contactName: account?.contactName ?? lead?.contactName ?? "",
    email: account?.email ?? lead?.email ?? "",
    phone: account?.phone ?? lead?.phone ?? "",
    gstin: account?.gstin ?? "",
    tier: account?.tier ?? ("bronze" as const),
    discountPct: account?.discountPct ?? 15,
    paymentTerms: account?.paymentTerms ?? ("prepaid" as const),
    creditLimitPaise: account?.creditLimitPaise ?? 0,
    notes: account?.notes ?? "",
  });
  const m = useMutation({
    mutationFn: () =>
      isEdit
        ? send("PATCH", `/admin/wholesale/accounts/${account!.id}`, form)
        : send("POST", "/admin/wholesale/accounts", {
            ...form,
            leadId: lead?.id ?? null,
          }),
    onSuccess: onSaved,
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="p-5 w-full max-w-xl bg-white max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-[#1a2416] mb-4">
          {isEdit ? `Edit ${account!.companyName}` : "New wholesale account"}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </Field>
            <Field label="GSTIN">
              <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact"><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tier">
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value as typeof form.tier })}
                className="w-full rounded border border-stone-200 px-3 py-2 text-sm capitalize"
              >
                {(["bronze", "silver", "gold", "platinum"] as const).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Discount %">
              <Input type="number" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Terms">
              <select
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value as typeof form.paymentTerms })}
                className="w-full rounded border border-stone-200 px-3 py-2 text-sm uppercase"
              >
                {(["prepaid", "net15", "net30", "net45"] as const).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Credit limit (₹)">
            <Input
              type="number"
              value={form.creditLimitPaise / 100}
              onChange={(e) =>
                setForm({ ...form, creditLimitPaise: Math.round((Number(e.target.value) || 0) * 100) })
              }
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
            disabled={
              !form.companyName.trim() ||
              !form.email.trim() ||
              !form.contactName.trim() ||
              !form.phone.trim() ||
              m.isPending
            }
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
