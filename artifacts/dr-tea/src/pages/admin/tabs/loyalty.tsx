import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Plus,
  Minus,
  Loader2,
  Search,
  Crown,
  TrendingUp,
  Wallet,
  History,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

const inr = (paise: number) =>
  `₹${Math.round(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

interface OverviewStats {
  members: number;
  outstanding: number;
  lifetimePoints: number;
  lifetimeSpend: number;
}
interface TopMember {
  shopperUserId: string;
  pointsBalance: number;
  lifetimePoints: number;
  lifetimeSpend: number;
  email: string;
  name: string;
}
interface OverviewResp {
  stats: OverviewStats;
  topMembers: TopMember[];
}
interface Account {
  shopperUserId: string;
  pointsBalance: number;
  lifetimePoints: number;
  lifetimeSpend: number;
  updatedAt: string;
  email: string;
  name: string;
}
interface LedgerEntry {
  id: number;
  shopperUserId: string;
  kind: "earn" | "redeem" | "adjust";
  points: number;
  orderId: number | null;
  note: string;
  createdAt: string;
  email: string;
  name: string;
}

async function getJson<T>(p: string): Promise<T> {
  const r = await fetch(`${API}${p}`, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}
async function postJson<T>(p: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${p}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

type Pane = "overview" | "members" | "ledger";

export default function LoyaltyTab() {
  const [pane, setPane] = useState<Pane>("overview");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#1a2416]">Loyalty</h1>
        <p className="text-sm text-stone-600">
          Points balances, top members, and manual credits/debits.
        </p>
      </header>

      <div className="flex gap-1.5 border-b border-stone-200">
        {(
          [
            { id: "overview", label: "Overview", icon: Award },
            { id: "members", label: "Members", icon: Crown },
            { id: "ledger", label: "Ledger", icon: History },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = pane === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPane(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 h-9 -mb-px text-[13px] font-medium border-b-2 transition-colors ${
                active
                  ? "border-[#1a2416] text-[#1a2416]"
                  : "border-transparent text-stone-500 hover:text-[#1a2416]"
              }`}
              data-testid={`tab-loyalty-${t.id}`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {pane === "overview" && <OverviewPane />}
      {pane === "members" && <MembersPane />}
      {pane === "ledger" && <LedgerPane />}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#1a2416]">{value}</div>
    </Card>
  );
}

function OverviewPane() {
  const q = useQuery({
    queryKey: ["admin-loyalty-overview"],
    queryFn: () => getJson<OverviewResp>("/admin/loyalty/overview"),
  });

  return (
    <div className="space-y-4">
      <AdjustForm />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Members"
          value={(q.data?.stats.members ?? 0).toLocaleString("en-IN")}
          icon={Award}
        />
        <StatCard
          label="Pts outstanding"
          value={(q.data?.stats.outstanding ?? 0).toLocaleString("en-IN")}
          icon={Wallet}
        />
        <StatCard
          label="Lifetime pts earned"
          value={(q.data?.stats.lifetimePoints ?? 0).toLocaleString("en-IN")}
          icon={TrendingUp}
        />
        <StatCard
          label="Lifetime spend"
          value={inr((q.data?.stats.lifetimeSpend ?? 0) * 100)}
          icon={TrendingUp}
        />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-[#1a2416] mb-3 flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-amber-500" /> Top members
        </h3>
        {q.isLoading ? (
          <div className="text-sm text-stone-500">Loading…</div>
        ) : !q.data?.topMembers.length ? (
          <div className="text-sm text-stone-500">No members yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <th className="py-2 pr-3">Member</th>
                  <th className="py-2 pr-3 text-right">Balance</th>
                  <th className="py-2 pr-3 text-right">Lifetime pts</th>
                  <th className="py-2 pr-3 text-right">Lifetime spend</th>
                </tr>
              </thead>
              <tbody>
                {q.data.topMembers.map((m) => (
                  <tr
                    key={m.shopperUserId}
                    className="border-b border-stone-100 last:border-0"
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium text-[#1a2416]">
                        {m.name || m.email}
                      </div>
                      <div className="text-[12px] text-stone-500">{m.email}</div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {m.pointsBalance.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {m.lifetimePoints.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {inr(m.lifetimeSpend * 100)}
                    </td>
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

function MembersPane() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useMemo(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const query = useQuery({
    queryKey: ["admin-loyalty-accounts", debounced],
    queryFn: () =>
      getJson<{ accounts: Account[] }>(
        `/admin/loyalty/accounts${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`,
      ),
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
          data-testid="input-loyalty-search"
        />
      </div>
      <Card className="p-0 overflow-hidden">
        {query.isLoading ? (
          <div className="p-6 text-sm text-stone-500">Loading…</div>
        ) : !query.data?.accounts.length ? (
          <div className="p-6 text-sm text-stone-500">No members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                  <th className="py-2 px-3">Member</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                  <th className="py-2 px-3 text-right">Lifetime pts</th>
                  <th className="py-2 px-3 text-right">Lifetime spend</th>
                  <th className="py-2 px-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {query.data.accounts.map((a) => (
                  <tr
                    key={a.shopperUserId}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="py-2 px-3">
                      <div className="font-medium text-[#1a2416]">
                        {a.name || a.email}
                      </div>
                      <div className="text-[12px] text-stone-500">{a.email}</div>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-[#3a5a2c]">
                      {a.pointsBalance.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {a.lifetimePoints.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {inr(a.lifetimeSpend * 100)}
                    </td>
                    <td className="py-2 px-3 text-right text-[12px] text-stone-500">
                      {new Date(a.updatedAt).toLocaleDateString("en-IN")}
                    </td>
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

function LedgerPane() {
  const [kind, setKind] = useState<"all" | "earn" | "redeem" | "adjust">("all");
  const query = useQuery({
    queryKey: ["admin-loyalty-ledger", kind],
    queryFn: () =>
      getJson<{ entries: LedgerEntry[] }>(
        `/admin/loyalty/ledger${kind === "all" ? "" : `?kind=${kind}`}`,
      ),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["all", "earn", "redeem", "adjust"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 h-8 rounded-full text-[12px] font-medium border transition-colors ${
              kind === k
                ? "bg-[#1a2416] text-white border-[#1a2416]"
                : "bg-white text-stone-700 border-stone-200 hover:border-[#1a2416]/40"
            }`}
            data-testid={`filter-ledger-${k}`}
          >
            {k === "all" ? "All" : k[0]!.toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        {query.isLoading ? (
          <div className="p-6 text-sm text-stone-500">Loading…</div>
        ) : !query.data?.entries.length ? (
          <div className="p-6 text-sm text-stone-500">No entries.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                  <th className="py-2 px-3">When</th>
                  <th className="py-2 px-3">Member</th>
                  <th className="py-2 px-3">Kind</th>
                  <th className="py-2 px-3 text-right">Points</th>
                  <th className="py-2 px-3">Order</th>
                  <th className="py-2 px-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {query.data.entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-stone-100 last:border-0"
                  >
                    <td className="py-2 px-3 text-[12px] text-stone-500 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-[#1a2416]">
                        {e.name || e.email}
                      </div>
                      <div className="text-[11px] text-stone-500">{e.email}</div>
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        variant="secondary"
                        className={
                          e.kind === "earn"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : e.kind === "redeem"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-stone-100 text-stone-700 border border-stone-200"
                        }
                      >
                        {e.kind}
                      </Badge>
                    </td>
                    <td
                      className={`py-2 px-3 text-right tabular-nums font-semibold ${
                        e.points >= 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {e.points >= 0 ? "+" : ""}
                      {e.points.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-[12px] text-stone-500">
                      {e.orderId ? `#${e.orderId}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-[12px] text-stone-600 max-w-[280px] truncate">
                      {e.note || "—"}
                    </td>
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

function AdjustForm() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: () => {
      const n = parseInt(points, 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error("Enter a positive whole number of points.");
      }
      return postJson<{ ok: boolean }>("/admin/loyalty/adjust", {
        email: email.trim(),
        points: direction === "credit" ? n : -n,
        note: note.trim(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Adjustment posted",
        description: `${direction === "credit" ? "+" : "-"}${points} pts → ${email}`,
      });
      setEmail("");
      setPoints("");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin-loyalty-overview"] });
      void qc.invalidateQueries({ queryKey: ["admin-loyalty-accounts"] });
      void qc.invalidateQueries({ queryKey: ["admin-loyalty-ledger"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not adjust",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="p-4 border-amber-200 bg-amber-50/40">
      <h3 className="text-sm font-semibold text-[#1a2416] flex items-center gap-1.5">
        <Award className="w-4 h-4 text-amber-600" /> Manual adjustment
      </h3>
      <p className="text-[12px] text-stone-600 mt-0.5">
        Credit or debit a member's points balance. A note is required for the audit log.
      </p>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          type="email"
          className="md:col-span-4"
          data-testid="input-adjust-email"
        />
        <div className="md:col-span-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => setDirection("credit")}
            className={`flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-md text-[12px] font-medium border ${
              direction === "credit"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-stone-700 border-stone-200"
            }`}
            data-testid="button-adjust-credit"
          >
            <Plus className="w-3.5 h-3.5" /> Credit
          </button>
          <button
            type="button"
            onClick={() => setDirection("debit")}
            className={`flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-md text-[12px] font-medium border ${
              direction === "debit"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-stone-700 border-stone-200"
            }`}
            data-testid="button-adjust-debit"
          >
            <Minus className="w-3.5 h-3.5" /> Debit
          </button>
        </div>
        <Input
          value={points}
          onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Points"
          inputMode="numeric"
          className="md:col-span-2"
          data-testid="input-adjust-points"
        />
        <Button
          onClick={() => m.mutate()}
          disabled={
            m.isPending || !email.trim() || !points || !note.trim()
          }
          className="md:col-span-3 bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
          data-testid="button-adjust-submit"
        >
          {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason / context (audit log)"
        rows={2}
        className="mt-2"
        data-testid="input-adjust-note"
      />
    </Card>
  );
}
