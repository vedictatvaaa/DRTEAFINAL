import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Gift,
  Plus,
  Search,
  Loader2,
  XCircle,
  CalendarClock,
  Copy,
  Check,
  AlertTriangle,
  History,
  Truck,
  Package,
  Printer,
  PackageCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

const inr = (rupees: number) =>
  `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

interface OverviewStats {
  total: number;
  active: number;
  outstanding: number;
  issuedTotal: number;
  redeemedTotal: number;
  expiringSoon: number;
}
interface GiftCard {
  id: number;
  code: string;
  initialAmount: number;
  balance: number;
  currency: string;
  status: "active" | "redeemed" | "cancelled" | "expired";
  purchaserUserId: string | null;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  message: string;
  purchaseOrderId: number | null;
  paymentRef: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}
interface OverviewResp {
  stats: OverviewStats;
  recent: GiftCard[];
}
interface Redemption {
  id: number;
  giftCardId: number;
  orderId: number;
  amount: number;
  createdAt: string;
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
async function patchJson<T>(p: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${p}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

type Pane = "overview" | "cards" | "fulfillment";

type PhysicalStatus = "pending" | "printed" | "shipped" | "delivered";

interface PhysicalGiftCard extends GiftCard {
  format: "digital" | "physical";
  designId: string;
  packagingId: string;
  packagingFee: number;
  physicalStatus: PhysicalStatus | "na";
  physicalCourier: string;
  physicalAwb: string;
  physicalTrackingUrl: string;
  physicalNotes: string;
  scheduledDeliveryAt: string | null;
  deliveryAddress: {
    fullName: string;
    phone: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    landmark?: string;
  } | null;
  personalization: {
    recipientPhotoUrl?: string;
    calligraphyName?: string;
    signature?: string;
    occasionTag?: string;
  } | null;
}

export default function GiftCardsTab() {
  const [pane, setPane] = useState<Pane>("overview");
  const [issueOpen, setIssueOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<GiftCard | null>(null);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2416]">Gift cards</h1>
          <p className="text-sm text-stone-600">
            Issue, lookup, cancel, or extend the expiry on any gift card.
          </p>
        </div>
        <Button
          onClick={() => setIssueOpen(true)}
          className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
          data-testid="button-issue-gift-card"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Issue card
        </Button>
      </header>

      <div className="flex gap-1.5 border-b border-stone-200">
        {(
          [
            { id: "overview", label: "Overview", icon: Gift },
            { id: "cards", label: "All cards", icon: Search },
            { id: "fulfillment", label: "Physical fulfilment", icon: Truck },
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
              data-testid={`tab-giftcards-${t.id}`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {pane === "overview" && <OverviewPane onSelect={setActiveCard} />}
      {pane === "cards" && <CardsPane onSelect={setActiveCard} />}
      {pane === "fulfillment" && <FulfillmentPane />}

      {issueOpen && (
        <IssueModal
          onClose={() => setIssueOpen(false)}
          onIssued={(card) => {
            setIssueOpen(false);
            setActiveCard(card);
          }}
        />
      )}
      {activeCard && (
        <CardDetailModal
          card={activeCard}
          onClose={() => setActiveCard(null)}
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
  value: string;
  tone?: "amber" | "emerald" | "default";
}) {
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50/40"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/40"
      : "";
  return (
    <Card className={`p-4 ${cls}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#1a2416]">{value}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: GiftCard["status"] }) {
  const map: Record<GiftCard["status"], string> = {
    active: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    redeemed: "bg-stone-100 text-stone-700 border border-stone-200",
    cancelled: "bg-rose-50 text-rose-800 border border-rose-200",
    expired: "bg-amber-50 text-amber-800 border border-amber-200",
  };
  return (
    <Badge variant="secondary" className={map[status]}>
      {status}
    </Badge>
  );
}

function CardRow({ card, onSelect }: { card: GiftCard; onSelect: (c: GiftCard) => void }) {
  return (
    <tr
      className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer"
      onClick={() => onSelect(card)}
      data-testid={`row-giftcard-${card.id}`}
    >
      <td className="py-2 px-3 font-mono text-[12px] text-[#1a2416]">{card.code}</td>
      <td className="py-2 px-3">
        <StatusBadge status={card.status} />
      </td>
      <td className="py-2 px-3 text-right tabular-nums font-semibold text-[#3a5a2c]">
        {inr(card.balance)}
      </td>
      <td className="py-2 px-3 text-right tabular-nums text-stone-500">
        {inr(card.initialAmount)}
      </td>
      <td className="py-2 px-3 text-[12px] text-stone-600">
        {card.recipientEmail || card.purchaserEmail || "—"}
      </td>
      <td className="py-2 px-3 text-[12px] text-stone-500 whitespace-nowrap">
        {new Date(card.expiresAt).toLocaleDateString("en-IN")}
      </td>
    </tr>
  );
}

function OverviewPane({ onSelect }: { onSelect: (c: GiftCard) => void }) {
  const q = useQuery({
    queryKey: ["admin-gift-cards-overview"],
    queryFn: () => getJson<OverviewResp>("/admin/gift-cards/overview"),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active cards"
          value={(q.data?.stats.active ?? 0).toLocaleString("en-IN")}
        />
        <StatCard
          label="Outstanding"
          value={inr(q.data?.stats.outstanding ?? 0)}
          tone="amber"
        />
        <StatCard
          label="Lifetime issued"
          value={inr(q.data?.stats.issuedTotal ?? 0)}
        />
        <StatCard
          label="Lifetime redeemed"
          value={inr(q.data?.stats.redeemedTotal ?? 0)}
          tone="emerald"
        />
      </div>

      {(q.data?.stats.expiringSoon ?? 0) > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/60 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-sm text-amber-900">
            <strong>{q.data!.stats.expiringSoon}</strong> active card
            {q.data!.stats.expiringSoon === 1 ? "" : "s"} with a balance
            {q.data!.stats.expiringSoon === 1 ? " is" : " are"} expiring in the
            next 30 days.
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-[#1a2416] mb-3 flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-amber-500" /> Recently issued
        </h3>
        {q.isLoading ? (
          <div className="text-sm text-stone-500">Loading…</div>
        ) : !q.data?.recent.length ? (
          <div className="text-sm text-stone-500">No cards yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                  <th className="py-2 px-3 text-right">Initial</th>
                  <th className="py-2 px-3">Recipient</th>
                  <th className="py-2 px-3">Expires</th>
                </tr>
              </thead>
              <tbody>
                {q.data.recent.map((c) => (
                  <CardRow key={c.id} card={c} onSelect={onSelect} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CardsPane({ onSelect }: { onSelect: (c: GiftCard) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"all" | GiftCard["status"]>("all");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (debounced) p.set("q", debounced);
    return p.toString();
  }, [status, debounced]);

  const query = useQuery({
    queryKey: ["admin-gift-cards-list", status, debounced],
    queryFn: () =>
      getJson<{ cards: GiftCard[] }>(
        `/admin/gift-cards${params ? `?${params}` : ""}`,
      ),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, purchaser or recipient email"
            className="pl-9"
            data-testid="input-giftcards-search"
          />
        </div>
        {(["all", "active", "redeemed", "cancelled", "expired"] as const).map(
          (s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 h-8 rounded-full text-[12px] font-medium border transition-colors ${
                status === s
                  ? "bg-[#1a2416] text-white border-[#1a2416]"
                  : "bg-white text-stone-700 border-stone-200 hover:border-[#1a2416]/40"
              }`}
              data-testid={`filter-giftcards-${s}`}
            >
              {s === "all" ? "All" : s[0]!.toUpperCase() + s.slice(1)}
            </button>
          ),
        )}
      </div>
      <Card className="p-0 overflow-hidden">
        {query.isLoading ? (
          <div className="p-6 text-sm text-stone-500">Loading…</div>
        ) : !query.data?.cards.length ? (
          <div className="p-6 text-sm text-stone-500">No cards match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                  <th className="py-2 px-3 text-right">Initial</th>
                  <th className="py-2 px-3">Recipient / purchaser</th>
                  <th className="py-2 px-3">Expires</th>
                </tr>
              </thead>
              <tbody>
                {query.data.cards.map((c) => (
                  <CardRow key={c.id} card={c} onSelect={onSelect} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function IssueModal({
  onClose,
  onIssued,
}: {
  onClose: () => void;
  onIssued: (card: GiftCard) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("1000");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  const m = useMutation({
    mutationFn: () => {
      const n = parseInt(amount, 10);
      if (!Number.isFinite(n) || n < 100 || n > 50_000) {
        throw new Error("Amount must be between ₹100 and ₹50,000.");
      }
      if (!reason.trim()) throw new Error("A reason is required for the audit log.");
      return postJson<{ card: GiftCard }>("/admin/gift-cards/issue", {
        amount: n,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
        message: message.trim(),
        reason: reason.trim(),
      });
    },
    onSuccess: (resp) => {
      toast({
        title: "Gift card issued",
        description: `${resp.card.code} — ${inr(resp.card.initialAmount)}`,
      });
      void qc.invalidateQueries({ queryKey: ["admin-gift-cards-overview"] });
      void qc.invalidateQueries({ queryKey: ["admin-gift-cards-list"] });
      onIssued(resp.card);
    },
    onError: (err: Error) =>
      toast({ title: "Could not issue", description: err.message, variant: "destructive" }),
  });

  return (
    <Modal title="Issue complimentary gift card" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-[12px] font-medium text-stone-700 mb-1">
            Amount (₹)
          </label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            data-testid="input-issue-amount"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {[500, 1000, 2500, 5000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="px-2 py-0.5 rounded-full text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700"
              >
                {inr(v)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[12px] font-medium text-stone-700 mb-1">
              Recipient name
            </label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              data-testid="input-issue-recipient-name"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-stone-700 mb-1">
              Recipient email
            </label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="optional"
              data-testid="input-issue-recipient-email"
            />
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-stone-700 mb-1">
            Message
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="optional — printed inside the card"
            data-testid="input-issue-message"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-stone-700 mb-1">
            Reason (audit log) <span className="text-rose-600">*</span>
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. compensation for delayed order #1234"
            data-testid="input-issue-reason"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => m.mutate()}
          disabled={m.isPending || !amount || !reason.trim()}
          className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
          data-testid="button-issue-confirm"
        >
          {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Issue"}
        </Button>
      </div>
    </Modal>
  );
}

function CardDetailModal({
  card,
  onClose,
}: {
  card: GiftCard;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [newExpiry, setNewExpiry] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [showExtend, setShowExtend] = useState(false);

  const reds = useQuery({
    queryKey: ["admin-gift-card-redemptions", card.id],
    queryFn: () =>
      getJson<{ redemptions: Redemption[] }>(
        `/admin/gift-cards/${card.id}/redemptions`,
      ),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-gift-cards-overview"] });
    void qc.invalidateQueries({ queryKey: ["admin-gift-cards-list"] });
  };

  const cancelM = useMutation({
    mutationFn: () =>
      postJson<{ card: GiftCard }>(`/admin/gift-cards/${card.id}/cancel`, {
        reason: cancelReason.trim(),
      }),
    onSuccess: () => {
      toast({ title: "Card cancelled" });
      invalidate();
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Could not cancel", description: err.message, variant: "destructive" }),
  });

  const extendM = useMutation({
    mutationFn: () =>
      postJson<{ card: GiftCard }>(`/admin/gift-cards/${card.id}/extend`, {
        expiresAt: new Date(`${newExpiry}T23:59:59Z`).toISOString(),
      }),
    onSuccess: () => {
      toast({ title: "Expiry extended" });
      invalidate();
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Could not extend", description: err.message, variant: "destructive" }),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(card.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal title={`Gift card ${card.code}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <code className="font-mono text-[15px] bg-stone-100 px-3 py-1.5 rounded">
            {card.code}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 h-8 px-2 text-[12px] rounded border border-stone-200 hover:bg-stone-50"
            data-testid="button-copy-code"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <div className="ml-auto"><StatusBadge status={card.status} /></div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Balance</div>
            <div className="text-xl font-bold text-[#3a5a2c]">{inr(card.balance)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Initial</div>
            <div className="text-xl font-bold text-[#1a2416]">{inr(card.initialAmount)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Recipient</div>
            <div className="text-[#1a2416]">{card.recipientName || "—"}</div>
            <div className="text-[12px] text-stone-500">{card.recipientEmail || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Purchaser</div>
            <div className="text-[12px] text-stone-500">{card.purchaserEmail || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Expires</div>
            <div className="text-[#1a2416]">
              {new Date(card.expiresAt).toLocaleDateString("en-IN")}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Issued</div>
            <div className="text-[#1a2416]">
              {new Date(card.createdAt).toLocaleDateString("en-IN")}
            </div>
          </div>
        </div>

        {card.message && (
          <div className="text-sm bg-amber-50 border border-amber-200 rounded p-2 italic text-stone-700">
            “{card.message}”
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-[#1a2416] mb-2 flex items-center gap-1.5">
            <History className="w-4 h-4" /> Redemptions
          </h4>
          {reds.isLoading ? (
            <div className="text-sm text-stone-500">Loading…</div>
          ) : !reds.data?.redemptions.length ? (
            <div className="text-sm text-stone-500">No redemptions yet.</div>
          ) : (
            <div className="border border-stone-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-[11px] uppercase text-stone-500">
                  <tr>
                    <th className="text-left py-1.5 px-2">When</th>
                    <th className="text-left py-1.5 px-2">Order</th>
                    <th className="text-right py-1.5 px-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reds.data.redemptions.map((r) => (
                    <tr key={r.id} className="border-t border-stone-100">
                      <td className="py-1.5 px-2 text-[12px] text-stone-500">
                        {new Date(r.createdAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-1.5 px-2 text-[12px]">#{r.orderId}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                        {inr(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {card.status === "active" && (
          <div className="border-t border-stone-200 pt-3 space-y-2">
            {!showCancel && !showExtend && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowExtend(true)}
                  data-testid="button-show-extend"
                >
                  <CalendarClock className="w-4 h-4 mr-1.5" /> Extend expiry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCancel(true)}
                  className="text-rose-700 border-rose-200 hover:bg-rose-50"
                  data-testid="button-show-cancel"
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Cancel card
                </Button>
              </div>
            )}
            {showExtend && (
              <div className="space-y-2 bg-stone-50 p-3 rounded">
                <label className="block text-[12px] font-medium text-stone-700">
                  New expiry date
                </label>
                <Input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  data-testid="input-extend-date"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowExtend(false)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => extendM.mutate()}
                    disabled={extendM.isPending}
                    className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
                    data-testid="button-extend-confirm"
                  >
                    {extendM.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Extend"
                    )}
                  </Button>
                </div>
              </div>
            )}
            {showCancel && (
              <div className="space-y-2 bg-rose-50/50 border border-rose-200 p-3 rounded">
                <label className="block text-[12px] font-medium text-stone-700">
                  Reason (audit log) <span className="text-rose-600">*</span>
                </label>
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  data-testid="input-cancel-reason"
                />
                <div className="text-[12px] text-rose-700">
                  This voids the remaining {inr(card.balance)} balance and cannot be
                  reversed.
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCancel(false)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => cancelM.mutate()}
                    disabled={cancelM.isPending || !cancelReason.trim()}
                    className="bg-rose-600 text-white hover:bg-rose-700"
                    data-testid="button-cancel-confirm"
                  >
                    {cancelM.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirm cancel"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1a2416]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-[#1a2416] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Fulfillment pane ──────────────────────────────────────────────

function FulfillmentPane() {
  const [status, setStatus] = useState<"pending" | "printed" | "shipped" | "delivered" | "all">("pending");
  const [active, setActive] = useState<PhysicalGiftCard | null>(null);

  const q = useQuery({
    queryKey: ["admin-gift-cards-queue", status],
    queryFn: () =>
      getJson<{ cards: PhysicalGiftCard[]; counts: Record<string, number> }>(
        `/admin/gift-cards/queue?status=${status}`,
      ),
    refetchInterval: 30_000,
  });

  const counts = q.data?.counts ?? { pending: 0, printed: 0, shipped: 0, delivered: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusTile
          label="Pending"
          value={counts.pending ?? 0}
          icon={Package}
          tone="amber"
          active={status === "pending"}
          onClick={() => setStatus("pending")}
        />
        <StatusTile
          label="Printed"
          value={counts.printed ?? 0}
          icon={Printer}
          tone="default"
          active={status === "printed"}
          onClick={() => setStatus("printed")}
        />
        <StatusTile
          label="Shipped"
          value={counts.shipped ?? 0}
          icon={Truck}
          tone="default"
          active={status === "shipped"}
          onClick={() => setStatus("shipped")}
        />
        <StatusTile
          label="Delivered"
          value={counts.delivered ?? 0}
          icon={PackageCheck}
          tone="emerald"
          active={status === "delivered"}
          onClick={() => setStatus("delivered")}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-stone-500">Show</span>
        {(["pending", "printed", "shipped", "delivered", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 h-8 rounded-full text-[12px] font-medium border transition-colors ${
              status === s
                ? "bg-[#1a2416] text-white border-[#1a2416]"
                : "bg-white text-stone-700 border-stone-200 hover:border-[#1a2416]/40"
            }`}
            data-testid={`queue-filter-${s}`}
          >
            {s === "all" ? "All physical" : s[0]!.toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {q.isLoading ? (
          <div className="p-6 text-sm text-stone-500">Loading queue…</div>
        ) : !q.data?.cards.length ? (
          <div className="p-6 text-sm text-stone-500">Nothing in {status} right now.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Design</th>
                  <th className="py-2 px-3">Recipient</th>
                  <th className="py-2 px-3">Ship to</th>
                  <th className="py-2 px-3">Scheduled</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">AWB</th>
                </tr>
              </thead>
              <tbody>
                {q.data.cards.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setActive(c)}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer"
                    data-testid={`queue-row-${c.id}`}
                  >
                    <td className="py-2 px-3 font-mono text-[12px] text-[#1a2416]">{c.code}</td>
                    <td className="py-2 px-3 text-[12px] text-stone-700">
                      <div className="font-medium">{c.designId}</div>
                      <div className="text-[11px] text-stone-500">{c.packagingId}</div>
                    </td>
                    <td className="py-2 px-3 text-[12px] text-stone-700">
                      {c.recipientName || c.deliveryAddress?.fullName || "—"}
                    </td>
                    <td className="py-2 px-3 text-[12px] text-stone-700">
                      {c.deliveryAddress
                        ? `${c.deliveryAddress.city}, ${c.deliveryAddress.state} ${c.deliveryAddress.pincode}`
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-[12px] text-stone-600 whitespace-nowrap">
                      {c.scheduledDeliveryAt
                        ? new Date(c.scheduledDeliveryAt).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <PhysicalStatusBadge status={c.physicalStatus} />
                    </td>
                    <td className="py-2 px-3 text-[12px] font-mono text-stone-600">
                      {c.physicalAwb || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {active && (
        <FulfillmentModal card={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

function StatusTile({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  tone: "amber" | "emerald" | "default";
  active: boolean;
  onClick: () => void;
}) {
  const ring =
    tone === "amber"
      ? "border-amber-200 bg-amber-50/60"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/60"
      : "border-stone-200 bg-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition ${ring} ${
        active ? "ring-2 ring-[#1a2416]/70" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#1a2416]">{value}</div>
    </button>
  );
}

function PhysicalStatusBadge({ status }: { status: PhysicalStatus | "na" }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 border border-amber-200",
    printed: "bg-sky-50 text-sky-800 border border-sky-200",
    shipped: "bg-indigo-50 text-indigo-800 border border-indigo-200",
    delivered: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    na: "bg-stone-100 text-stone-600 border border-stone-200",
  };
  return (
    <Badge variant="secondary" className={map[status] ?? map.na!}>
      {status}
    </Badge>
  );
}

function FulfillmentModal({
  card,
  onClose,
}: {
  card: PhysicalGiftCard;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<PhysicalStatus>(
    card.physicalStatus === "na" ? "pending" : card.physicalStatus,
  );
  const [courier, setCourier] = useState(card.physicalCourier);
  const [awb, setAwb] = useState(card.physicalAwb);
  const [trackingUrl, setTrackingUrl] = useState(card.physicalTrackingUrl);
  const [notes, setNotes] = useState(card.physicalNotes);

  const m = useMutation({
    mutationFn: () =>
      patchJson<{ card: PhysicalGiftCard }>(
        `/admin/gift-cards/${card.id}/physical`,
        {
          physicalStatus: status,
          physicalCourier: courier.trim(),
          physicalAwb: awb.trim(),
          physicalTrackingUrl: trackingUrl.trim(),
          physicalNotes: notes.trim(),
        },
      ),
    onSuccess: () => {
      toast({ title: `Card ${card.code} → ${status}` });
      void qc.invalidateQueries({ queryKey: ["admin-gift-cards-queue"] });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Modal title={`Fulfilment — ${card.code}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Design</div>
            <div className="text-[#1a2416]">{card.designId}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-stone-500">Packaging</div>
            <div className="text-[#1a2416]">
              {card.packagingId} · {inr(card.packagingFee)}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] font-semibold uppercase text-stone-500">Ship to</div>
            {card.deliveryAddress ? (
              <div className="text-[13px] text-[#1a2416] leading-relaxed">
                <div className="font-medium">{card.deliveryAddress.fullName}</div>
                <div>{card.deliveryAddress.street1}</div>
                {card.deliveryAddress.street2 && <div>{card.deliveryAddress.street2}</div>}
                <div>
                  {card.deliveryAddress.city}, {card.deliveryAddress.state}{" "}
                  {card.deliveryAddress.pincode}
                </div>
                <div className="text-stone-500">📞 {card.deliveryAddress.phone}</div>
              </div>
            ) : (
              <div className="text-stone-500">No address on file.</div>
            )}
          </div>
          {card.personalization && (card.personalization.calligraphyName || card.personalization.recipientPhotoUrl) && (
            <div className="col-span-2 p-2 rounded bg-amber-50 border border-amber-200 text-[12px] text-amber-900">
              {card.personalization.calligraphyName && (
                <div>Calligraphy: <strong>{card.personalization.calligraphyName}</strong></div>
              )}
              {card.personalization.recipientPhotoUrl && <div>Photo to mount: yes</div>}
              {card.personalization.signature && (
                <div>Sign-off: {card.personalization.signature}</div>
              )}
            </div>
          )}
          {card.scheduledDeliveryAt && (
            <div className="col-span-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              Scheduled to land on{" "}
              <strong>
                {new Date(card.scheduledDeliveryAt).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </strong>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-stone-700 mb-1">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {(["pending", "printed", "shipped", "delivered"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 h-8 rounded-full text-[12px] font-medium border ${
                  status === s
                    ? "bg-[#1a2416] text-white border-[#1a2416]"
                    : "bg-white text-stone-700 border-stone-200"
                }`}
                data-testid={`set-status-${s}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[12px] font-medium text-stone-700 mb-1">Courier</label>
            <Input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="e.g. Bluedart"
              data-testid="input-courier"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-stone-700 mb-1">AWB / Tracking #</label>
            <Input
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              data-testid="input-awb"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-stone-700 mb-1">Tracking URL</label>
            <Input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://"
              data-testid="input-tracking"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-stone-700 mb-1">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="input-notes"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
          data-testid="button-save-fulfilment"
        >
          {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
