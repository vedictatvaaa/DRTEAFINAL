import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search as SearchIcon,
  Loader2,
  X,
  Pin,
  PinOff,
  Trash2,
  Mail,
  ShoppingCart,
  Gift,
  Repeat,
  Star,
  MessageSquare,
  ShoppingBag,
  Send,
  Crown,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const API = `${import.meta.env.BASE_URL}api`;

interface ListItem {
  email: string;
  displayEmail: string;
  displayName: string;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
}

interface ListResp {
  items: ListItem[];
  hasMore: boolean;
  nextOffset: number | null;
}

type CustomerStatus = "lead" | "new" | "returning" | "vip";

interface CustomerDetail {
  email: string;
  displayEmail: string;
  displayName: string;
  shopperUser: { id: string; name: string; email: string; createdAt: string } | null;
  newsletter: { optedInAt: string; unsubscribedAt: string | null } | null;
  kpis: {
    orderCount: number;
    totalSpend: number;
    aov: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    status: CustomerStatus;
  };
  orders: Array<{
    id: number;
    status: string;
    total: number;
    currency: string;
    createdAt: string;
    items: Array<{
      productName: string;
      variantSize: string;
      quantity: number;
      unitPrice: number;
    }>;
  }>;
  comments: Array<{ id: number; articleSlug: string; body: string; status: string; createdAt: string }>;
  giftCards: Array<{ id: number; code: string; balance: number; status: string; createdAt: string }>;
  abandonedCarts: Array<{ id: number; subtotal: number; lastSeenAt: string; recoveredAt: string | null }>;
  emails: Array<{ id: number; subject: string; kind: string; status: string; createdAt: string; openedAt: string | null }>;
  notes: Array<{ id: number; body: string; pinned: boolean; createdAt: string }>;
  loyalty: {
    account: { pointsBalance: number; lifetimePoints: number; lifetimeSpend: number } | null;
    ledger: Array<{ id: number; kind: string; points: number; note: string; createdAt: string }>;
  };
  subscriptions: Array<{ id: number; productName: string; variantSize: string; status: string; nextDeliveryAt: string }>;
  reviews: Array<{ id: number; productId: string; rating: number; body: string; createdAt: string }>;
}

const SORTS: { id: "lastOrder" | "totalSpend" | "orderCount" | "name"; label: string }[] = [
  { id: "lastOrder", label: "Most recent order" },
  { id: "totalSpend", label: "Highest spend" },
  { id: "orderCount", label: "Most orders" },
  { id: "name", label: "Name (A→Z)" },
];

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const days = Math.round((Date.now() - t) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusBadge(s: CustomerStatus) {
  const map: Record<CustomerStatus, { label: string; cls: string; icon: typeof Users }> = {
    lead: { label: "Lead", cls: "bg-stone-100 text-stone-700 border-stone-300", icon: Users },
    new: { label: "New", cls: "bg-blue-50 text-blue-800 border-blue-200", icon: Star },
    returning: { label: "Returning", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: Repeat },
    vip: { label: "VIP", cls: "bg-amber-100 text-amber-900 border-amber-300", icon: Crown },
  };
  const v = map[s];
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${v.cls}`}>
      <Icon className="h-3 w-3" /> {v.label}
    </Badge>
  );
}

export default function CustomersTab() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sort, setSort] = useState<typeof SORTS[number]["id"]>("lastOrder");
  const [openEmail, setOpenEmail] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const list = useInfiniteQuery<ListResp, Error>({
    queryKey: ["admin-customers", debouncedQ, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      params.set("sort", sort);
      params.set("limit", "50");
      params.set("offset", String(pageParam ?? 0));
      const r = await fetch(`${API}/admin/customers?${params.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error("customers");
      return r.json();
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
  });

  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a2416]">Customer 360</h1>
          <p className="mt-1 text-sm text-stone-600">
            Every shopper, with their orders, loyalty, gift cards, subscriptions, reviews, comments, emails and notes — in one screen.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => list.refetch()}
          disabled={list.isFetching}
          data-testid="button-customers-refresh"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <Card className="border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-8"
              data-testid="input-customers-search"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  sort === s.id
                    ? "border-[#1a2416] bg-[#1a2416] text-amber-100"
                    : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                }`}
                data-testid={`chip-sort-${s.id}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="border-stone-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading customers…
          </div>
        ) : list.isError ? (
          <div className="p-6 text-sm text-red-700">Failed to load customers.</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-stone-500">No customers match this filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Spend</th>
                <th className="px-4 py-3 font-medium">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => {
                const status: CustomerStatus =
                  row.orderCount === 0
                    ? "lead"
                    : row.orderCount === 1
                      ? "new"
                      : row.orderCount >= 5 || row.totalSpend >= 500000
                        ? "vip"
                        : "returning";
                return (
                  <tr
                    key={row.email}
                    onClick={() => setOpenEmail(row.email)}
                    className="cursor-pointer transition hover:bg-stone-50"
                    data-testid={`row-customer-${row.email}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#3a5a2c] text-sm font-semibold uppercase text-amber-100">
                          {(row.displayName || row.displayEmail).slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-[#1a2416]">
                              {row.displayName || row.displayEmail}
                            </span>
                            {statusBadge(status)}
                          </div>
                          <div className="truncate text-xs text-stone-500">{row.displayEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-stone-700">{row.orderCount}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-[#1a2416]">{inr(row.totalSpend)}</td>
                    <td className="px-4 py-3 text-stone-600">{relativeDate(row.lastOrderAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {list.hasNextPage ? (
          <div className="border-t border-stone-100 p-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
              data-testid="button-customers-load-more"
            >
              {list.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </Card>

      {openEmail ? <CustomerDrawer email={openEmail} onClose={() => setOpenEmail(null)} /> : null}
    </div>
  );
}

function CustomerDrawer({ email, onClose }: { email: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery<CustomerDetail>({
    queryKey: ["admin-customer", email],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/customers/${encodeURIComponent(email)}`, { credentials: "include" });
      if (!r.ok) throw new Error("detail");
      return r.json();
    },
  });

  const [noteBody, setNoteBody] = useState("");
  const [notePinned, setNotePinned] = useState(false);

  const addNote = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/customers/${encodeURIComponent(email)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: noteBody.trim(), pinned: notePinned }),
      });
      if (!r.ok) throw new Error("note");
      return r.json();
    },
    onSuccess: () => {
      setNoteBody("");
      setNotePinned(false);
      qc.invalidateQueries({ queryKey: ["admin-customer", email] });
    },
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) => {
      const r = await fetch(`${API}/admin/customers/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pinned }),
      });
      if (!r.ok) throw new Error("pin");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer", email] }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API}/admin/customers/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("del");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customer", email] }),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
      data-testid="drawer-customer"
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-stone-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-stone-500">Customer</div>
            <div className="mt-0.5 truncate text-base font-semibold text-[#1a2416]">
              {detail.data?.displayName || detail.data?.displayEmail || email}
            </div>
            <div className="truncate text-xs text-stone-500">{detail.data?.displayEmail ?? email}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400"
              data-testid="link-customer-email"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-customer-drawer-close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {detail.isLoading ? (
            <div className="flex items-center text-sm text-stone-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : detail.isError || !detail.data ? (
            <div className="text-sm text-red-700">Failed to load customer.</div>
          ) : (
            <DrawerBody
              data={detail.data}
              noteBody={noteBody}
              setNoteBody={setNoteBody}
              notePinned={notePinned}
              setNotePinned={setNotePinned}
              onAddNote={() => addNote.mutate()}
              addingNote={addNote.isPending}
              onTogglePin={(id, pinned) => togglePin.mutate({ id, pinned })}
              onDeleteNote={(id) => deleteNote.mutate(id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DrawerBody({
  data,
  noteBody,
  setNoteBody,
  notePinned,
  setNotePinned,
  onAddNote,
  addingNote,
  onTogglePin,
  onDeleteNote,
}: {
  data: CustomerDetail;
  noteBody: string;
  setNoteBody: (v: string) => void;
  notePinned: boolean;
  setNotePinned: (v: boolean) => void;
  onAddNote: () => void;
  addingNote: boolean;
  onTogglePin: (id: number, pinned: boolean) => void;
  onDeleteNote: (id: number) => void;
}) {
  const k = data.kpis;
  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Status" value={statusBadge(k.status)} />
        <Kpi label="Orders" value={k.orderCount} />
        <Kpi label="Lifetime spend" value={inr(k.totalSpend)} />
        <Kpi label="AOV" value={inr(k.aov)} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="First order" value={relativeDate(k.firstOrderAt)} small />
        <Kpi label="Last order" value={relativeDate(k.lastOrderAt)} small />
        <Kpi
          label="Loyalty points"
          value={data.loyalty.account ? data.loyalty.account.pointsBalance.toLocaleString() : "—"}
          small
        />
      </div>

      {/* Notes */}
      <Section icon={MessageSquare} title="Internal notes">
        <div className="space-y-2">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a private note about this customer (admin-only)…"
            rows={2}
            data-testid="input-customer-note"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={notePinned}
                onChange={(e) => setNotePinned(e.target.checked)}
                data-testid="checkbox-note-pinned"
              />
              Pin to top
            </label>
            <Button
              size="sm"
              onClick={onAddNote}
              disabled={!noteBody.trim() || addingNote}
              data-testid="button-add-note"
            >
              {addingNote ? "Adding…" : "Add note"}
            </Button>
          </div>
        </div>
        {data.notes.length === 0 ? (
          <p className="mt-3 text-xs text-stone-500">No notes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.notes.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${n.pinned ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}
              >
                <span className="flex-1 whitespace-pre-wrap text-stone-800">{n.body}</span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onTogglePin(n.id, !n.pinned)}
                    className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                    title={n.pinned ? "Unpin" : "Pin"}
                    data-testid={`button-pin-note-${n.id}`}
                  >
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(n.id)}
                    className="rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    data-testid={`button-delete-note-${n.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Orders */}
      <Section icon={ShoppingCart} title={`Orders (${data.orders.length})`}>
        {data.orders.length === 0 ? (
          <p className="text-xs text-stone-500">No orders yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.orders.map((o) => (
              <li key={o.id} className="rounded-md border border-stone-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#1a2416]">Order #{o.id}</span>
                  <span className="flex items-center gap-2 text-xs text-stone-500">
                    <Badge variant="outline" className="capitalize">{o.status}</Badge>
                    {new Date(o.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-stone-600">
                  {o.items.map((it, i) => (
                    <span key={i}>
                      {it.quantity}× {it.productName} ({it.variantSize})
                      {i < o.items.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-sm font-medium tabular-nums text-[#1a2416]">{inr(o.total)}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Loyalty */}
      <Section icon={Crown} title="Loyalty">
        {!data.loyalty.account ? (
          <p className="text-xs text-stone-500">No loyalty account (guest customer).</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="Points" value={data.loyalty.account.pointsBalance.toLocaleString()} small />
              <Kpi label="Lifetime points" value={data.loyalty.account.lifetimePoints.toLocaleString()} small />
              <Kpi label="Lifetime spend" value={inr(data.loyalty.account.lifetimeSpend)} small />
            </div>
            {data.loyalty.ledger.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs">
                {data.loyalty.ledger.slice(0, 10).map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-stone-700">
                    <span>
                      <span className="capitalize">{l.kind}</span> {l.note ? `· ${l.note}` : ""}
                    </span>
                    <span className="tabular-nums">
                      {l.points > 0 ? `+${l.points}` : l.points} pts · {relativeDate(l.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Section>

      {/* Subscriptions */}
      <Section icon={Repeat} title={`Subscriptions (${data.subscriptions.length})`}>
        {data.subscriptions.length === 0 ? (
          <p className="text-xs text-stone-500">No subscriptions.</p>
        ) : (
          <ul className="space-y-2">
            {data.subscriptions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-md border border-stone-200 bg-white p-2 text-sm">
                <span>
                  <span className="font-medium text-[#1a2416]">{s.productName}</span>{" "}
                  <span className="text-xs text-stone-500">({s.variantSize})</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-stone-600">
                  <Badge variant="outline" className="capitalize">{s.status}</Badge>
                  Next: {new Date(s.nextDeliveryAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Gift cards */}
      <Section icon={Gift} title={`Gift cards (${data.giftCards.length})`}>
        {data.giftCards.length === 0 ? (
          <p className="text-xs text-stone-500">No gift cards purchased or received.</p>
        ) : (
          <ul className="space-y-2">
            {data.giftCards.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-md border border-stone-200 bg-white p-2 text-sm">
                <span className="font-mono text-xs text-stone-700">{g.code}</span>
                <span className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="capitalize">{g.status}</Badge>
                  <span className="tabular-nums font-medium text-[#1a2416]">{inr(g.balance)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Reviews */}
      <Section icon={Star} title={`Reviews (${data.reviews.length})`}>
        {data.reviews.length === 0 ? (
          <p className="text-xs text-stone-500">No reviews submitted.</p>
        ) : (
          <ul className="space-y-2">
            {data.reviews.map((r) => (
              <li key={r.id} className="rounded-md border border-stone-200 bg-white p-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="text-amber-600">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  · {r.productId} · {relativeDate(r.createdAt)}
                </div>
                <p className="mt-1 text-stone-800">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Comments */}
      <Section icon={MessageSquare} title={`Journal comments (${data.comments.length})`}>
        {data.comments.length === 0 ? (
          <p className="text-xs text-stone-500">No comments.</p>
        ) : (
          <ul className="space-y-2">
            {data.comments.map((c) => (
              <li key={c.id} className="rounded-md border border-stone-200 bg-white p-2 text-sm">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="truncate">on /journal/{c.articleSlug}</span>
                  <Badge variant="outline" className="capitalize">{c.status}</Badge>
                </div>
                <p className="mt-1 text-stone-800">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Abandoned carts */}
      <Section icon={ShoppingBag} title={`Abandoned carts (${data.abandonedCarts.length})`}>
        {data.abandonedCarts.length === 0 ? (
          <p className="text-xs text-stone-500">No abandoned carts on record.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.abandonedCarts.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-stone-700">
                <span>{a.recoveredAt ? "Recovered" : "Abandoned"}</span>
                <span className="text-xs">
                  {inr(a.subtotal)} · {relativeDate(a.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Emails */}
      <Section icon={Send} title={`Emails (${data.emails.length})`}>
        {data.emails.length === 0 ? (
          <p className="text-xs text-stone-500">No emails sent.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.emails.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center justify-between text-stone-700">
                <span className="truncate">{e.subject}</span>
                <span className="ml-2 flex flex-none items-center gap-1 text-xs text-stone-500">
                  {e.openedAt ? <span className="text-emerald-700">opened</span> : <span>{e.status}</span>}
                  · {relativeDate(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-stone-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-700">
        <Icon className="h-4 w-4 text-[#3a5a2c]" />
        {title}
      </h3>
      {children}
    </Card>
  );
}

function Kpi({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <Card className="border-stone-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums text-[#1a2416] ${small ? "text-sm" : "text-xl"}`}>{value}</div>
    </Card>
  );
}
