import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Star,
  Check,
  EyeOff,
  Trash2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API = `${import.meta.env.BASE_URL}api`;

interface Overview {
  counts: { approved: number; pending: number; hidden: number };
  total: number;
  averageRating: number;
  lowStarCount: number;
}
interface Review {
  id: number;
  productId: string;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  status: "approved" | "pending" | "hidden";
  createdAt: string;
  shopperUserId: string;
  shopperEmail: string | null;
  shopperName: string | null;
}

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

const STATUSES = ["all", "approved", "pending", "hidden"] as const;
const RATING_FILTERS = [
  { id: "all", label: "All", min: 0, max: 5 },
  { id: "low", label: "Low (1–2★)", min: 1, max: 2 },
  { id: "mid", label: "3★", min: 3, max: 3 },
  { id: "high", label: "4–5★", min: 4, max: 5 },
] as const;

export default function ReviewsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("all");
  const [ratingFilter, setRatingFilter] =
    useState<(typeof RATING_FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");

  const overview = useQuery({
    queryKey: ["reviews-overview"],
    queryFn: () => get<Overview>("/admin/reviews/overview"),
  });
  const list = useQuery({
    queryKey: ["reviews", statusFilter, ratingFilter],
    queryFn: () => {
      const r = RATING_FILTERS.find((x) => x.id === ratingFilter)!;
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (ratingFilter !== "all") {
        params.set("minRating", String(r.min));
        params.set("maxRating", String(r.max));
      }
      const qs = params.toString();
      return get<{ items: Review[] }>(
        `/admin/reviews${qs ? `?${qs}` : ""}`,
      );
    },
  });

  const filtered = useMemo(() => {
    const items = list.data?.items ?? [];
    const q = search.toLowerCase().trim();
    return q
      ? items.filter(
          (r) =>
            r.productId.toLowerCase().includes(q) ||
            r.body.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.shopperEmail?.toLowerCase().includes(q),
        )
      : items;
  }, [list.data, search]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["reviews"] });
    void qc.invalidateQueries({ queryKey: ["reviews-overview"] });
  };
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Review["status"] }) =>
      send("PATCH", `/admin/reviews/${id}`, { status }),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (id: number) => send("DELETE", `/admin/reviews/${id}`),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#1a2416]">Reviews</h1>
        <p className="text-sm text-stone-600">
          Moderate customer reviews and user-generated content.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat
          label="Avg rating"
          value={
            overview.data
              ? `${overview.data.averageRating.toFixed(1)} ★`
              : "—"
          }
        />
        <Stat label="Approved" value={overview.data?.counts.approved ?? "—"} icon={ShieldCheck} />
        <Stat label="Pending" value={overview.data?.counts.pending ?? "—"} />
        <Stat label="Hidden" value={overview.data?.counts.hidden ?? "—"} icon={EyeOff} />
        <Stat
          label="1–2★"
          value={overview.data?.lowStarCount ?? "—"}
          tone={overview.data && overview.data.lowStarCount > 0 ? "warn" : "default"}
          icon={AlertTriangle}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
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
        <span className="w-px h-5 bg-stone-300 mx-1" />
        {RATING_FILTERS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRatingFilter(r.id)}
            className={`px-3 py-1.5 rounded-full text-xs ${
              ratingFilter === r.id
                ? "bg-amber-200 text-[#1a2416]"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {r.label}
          </button>
        ))}
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm ml-auto"
        />
      </div>

      <div className="space-y-3">
        {list.isLoading && (
          <Card className="p-6 text-center text-stone-500 bg-white border-stone-200">
            Loading…
          </Card>
        )}
        {!list.isLoading && filtered.length === 0 && (
          <Card className="p-6 text-center text-stone-500 bg-white border-stone-200">
            No reviews match.
          </Card>
        )}
        {filtered.map((r) => (
          <Card key={r.id} className="p-4 bg-white border-stone-200">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Stars n={r.rating} />
                  <span className="font-medium text-[#1a2416]">
                    {r.title || "(no title)"}
                  </span>
                  {r.verifiedPurchase && (
                    <Badge variant="outline" className="text-[10px]">
                      Verified
                    </Badge>
                  )}
                  <Badge
                    variant={
                      r.status === "approved"
                        ? "default"
                        : r.status === "pending"
                        ? "outline"
                        : "destructive"
                    }
                    className="capitalize text-[10px]"
                  >
                    {r.status}
                  </Badge>
                </div>
                <div className="text-xs text-stone-500 mb-2">
                  {r.shopperName || r.shopperEmail || r.shopperUserId} ·{" "}
                  product <code className="text-[10px]">{r.productId}</code> ·{" "}
                  {new Date(r.createdAt).toLocaleDateString("en-IN")} ·{" "}
                  {r.helpfulCount} helpful
                </div>
                <p className="text-sm text-[#1a2416] whitespace-pre-wrap">{r.body}</p>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                {r.status !== "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderate.mutate({ id: r.id, status: "approved" })}
                  >
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Approve
                  </Button>
                )}
                {r.status !== "hidden" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderate.mutate({ id: r.id, status: "hidden" })}
                  >
                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                    Hide
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm("Delete this review permanently?")) del.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < n ? "fill-amber-400 text-amber-500" : "text-stone-300"
          }`}
        />
      ))}
    </span>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="p-4 bg-[#FAF8F4] border-stone-200">
      <div className="text-xs uppercase tracking-wide text-stone-500 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div
        className={`text-2xl font-bold mt-1 ${
          tone === "warn" && Number(value) > 0
            ? "text-amber-600"
            : "text-[#1a2416]"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}
