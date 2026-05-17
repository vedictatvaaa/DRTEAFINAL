import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  Bell,
  ShoppingCart,
  BookOpen,
  Package,
  Search as SearchIcon,
  RefreshCw,
  X,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API = `${import.meta.env.BASE_URL}api`;

type ActivityKind =
  | "copilot_plan"
  | "alert_seen"
  | "alert_dismissed"
  | "order_status_changed"
  | "order_updated"
  | "article_created"
  | "article_updated"
  | "article_published"
  | "article_unpublished"
  | "article_deleted"
  | "product_created"
  | "product_updated"
  | "product_deleted";

interface ActivityRow {
  id: number;
  kind: ActivityKind;
  actor: "admin" | "copilot" | "system";
  title: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface ActivityPage {
  items: ActivityRow[];
  hasMore: boolean;
  nextBefore: number | null;
}

interface ActivityStats {
  total: number;
  last24h: number;
  last7d: number;
}

type GroupId = "all" | "copilot" | "alerts" | "orders" | "articles" | "products";

const GROUPS: { id: GroupId; label: string; icon: typeof Activity }[] = [
  { id: "all", label: "All activity", icon: Activity },
  { id: "copilot", label: "Co-pilot", icon: Bot },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "articles", label: "Articles", icon: BookOpen },
  { id: "products", label: "Products", icon: Package },
];

const KIND_TO_GROUP: Record<ActivityKind, GroupId> = {
  copilot_plan: "copilot",
  alert_seen: "alerts",
  alert_dismissed: "alerts",
  order_status_changed: "orders",
  order_updated: "orders",
  article_created: "articles",
  article_updated: "articles",
  article_published: "articles",
  article_unpublished: "articles",
  article_deleted: "articles",
  product_created: "products",
  product_updated: "products",
  product_deleted: "products",
};

const GROUP_ICON: Record<GroupId, typeof Activity> = {
  all: Activity,
  copilot: Bot,
  alerts: Bell,
  orders: ShoppingCart,
  articles: BookOpen,
  products: Package,
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function actorClass(actor: ActivityRow["actor"]): string {
  if (actor === "copilot")
    return "bg-amber-100 text-amber-900 border border-amber-300";
  if (actor === "system")
    return "bg-slate-100 text-slate-700 border border-slate-300";
  return "bg-emerald-100 text-emerald-900 border border-emerald-300";
}

export default function ActivityTab() {
  const [group, setGroup] = useState<GroupId>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  // Debounce search to keep keystrokes from spamming the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const statsQuery = useQuery<ActivityStats>({
    queryKey: ["admin-activity-stats"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/activity/_stats`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("stats");
      return r.json();
    },
    staleTime: 30_000,
  });

  const feed = useInfiniteQuery<ActivityPage, Error>({
    queryKey: ["admin-activity", group, debouncedQ],
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (group !== "all") params.set("group", group);
      if (debouncedQ) params.set("q", debouncedQ);
      params.set("limit", "50");
      if (pageParam) params.set("before", String(pageParam));
      const r = await fetch(`${API}/admin/activity?${params.toString()}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("activity");
      return r.json();
    },
    getNextPageParam: (last) => (last.hasMore ? last.nextBefore : undefined),
  });

  const rows = useMemo<ActivityRow[]>(
    () => feed.data?.pages.flatMap((p) => p.items) ?? [],
    [feed.data],
  );

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a2416]">
            Activity & Audit Log
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Every write action across the admin surface — co-pilot plans,
            alerts, orders, articles, products — in one timeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              feed.refetch();
              statsQuery.refetch();
            }}
            disabled={feed.isFetching}
            data-testid="button-activity-refresh"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${feed.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </header>

      {/* Stat strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Total events" value={statsQuery.data?.total ?? null} />
        <StatCard
          label="Last 24 hours"
          value={statsQuery.data?.last24h ?? null}
        />
        <StatCard label="Last 7 days" value={statsQuery.data?.last7d ?? null} />
      </div>

      {/* Filters */}
      <Card className="border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {GROUPS.map((g) => {
              const Icon = g.icon;
              const active = group === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-[#1a2416] bg-[#1a2416] text-amber-100"
                      : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                  }`}
                  data-testid={`chip-activity-${g.id}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {g.label}
                </button>
              );
            })}
          </div>
          <div className="relative w-full md:w-72">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, summary, entity id…"
              className="pl-8"
              data-testid="input-activity-search"
            />
          </div>
        </div>
      </Card>

      {/* Feed */}
      <Card className="border-stone-200 bg-white">
        {feed.isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading activity…
          </div>
        ) : feed.isError ? (
          <div className="p-6 text-sm text-red-700">
            Failed to load activity. Try refresh.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-stone-500">
            No activity yet for this filter.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((row) => (
              <ActivityListItem
                key={row.id}
                row={row}
                onOpen={() => setOpenId(row.id)}
              />
            ))}
          </ul>
        )}
        {feed.hasNextPage ? (
          <div className="border-t border-stone-100 p-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
              data-testid="button-activity-load-more"
            >
              {feed.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </Card>

      {openId !== null ? (
        <ActivityDrawer id={openId} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="border-stone-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[#1a2416]">
        {value === null ? "—" : value.toLocaleString()}
      </div>
    </Card>
  );
}

function ActivityListItem({
  row,
  onOpen,
}: {
  row: ActivityRow;
  onOpen: () => void;
}) {
  const group = KIND_TO_GROUP[row.kind] ?? "all";
  const Icon = GROUP_ICON[group];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
        data-testid={`row-activity-${row.id}`}
      >
        <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-stone-100 text-stone-600">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-[#1a2416]">
              {row.title}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase ${actorClass(row.actor)}`}
            >
              {row.actor}
            </Badge>
          </span>
          {row.summary ? (
            <span className="mt-0.5 line-clamp-1 block text-xs text-stone-500">
              {row.summary}
            </span>
          ) : null}
        </span>
        <span className="flex flex-none items-center gap-2 pt-0.5 text-xs text-stone-400">
          {relativeTime(row.createdAt)}
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>
    </li>
  );
}

interface ActivityDetail {
  row: ActivityRow;
  copilotLog: {
    id: number;
    query: string;
    plan: unknown;
    results: unknown;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null;
}

function ActivityDrawer({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const detail = useQuery<ActivityDetail>({
    queryKey: ["admin-activity", id],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/activity/${id}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("detail");
      return r.json();
    },
  });

  // Close on Escape so the drawer feels native.
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
      data-testid="drawer-activity"
    >
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-stone-500">
              Activity #{id}
            </div>
            <div className="mt-0.5 text-sm font-medium text-[#1a2416]">
              {detail.data?.row.title ?? (detail.isLoading ? "Loading…" : "—")}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-activity-drawer-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {detail.isLoading ? (
            <div className="flex items-center text-sm text-stone-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : detail.isError || !detail.data ? (
            <div className="text-sm text-red-700">Failed to load.</div>
          ) : (
            <DrawerBody detail={detail.data} />
          )}
        </div>
      </div>
    </div>
  );
}

function DrawerBody({ detail }: { detail: ActivityDetail }) {
  const { row, copilotLog } = detail;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Kind" value={row.kind} />
        <Field label="Actor" value={row.actor} />
        <Field label="When" value={new Date(row.createdAt).toLocaleString()} />
        <Field
          label="Entity"
          value={
            row.entityType
              ? `${row.entityType}${row.entityId ? `:${row.entityId}` : ""}`
              : "—"
          }
        />
      </dl>
      {row.summary ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Summary
          </h3>
          <p className="text-sm text-stone-800">{row.summary}</p>
        </section>
      ) : null}
      {row.payload && Object.keys(row.payload).length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Payload
          </h3>
          <pre className="max-h-72 overflow-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">
            {JSON.stringify(row.payload, null, 2)}
          </pre>
        </section>
      ) : null}
      {copilotLog ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Co-pilot plan #{copilotLog.id} · {copilotLog.status}
          </h3>
          <p className="text-xs text-stone-600">
            Query: <span className="italic">{copilotLog.query || "—"}</span>
          </p>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">
            {JSON.stringify(
              { plan: copilotLog.plan, results: copilotLog.results },
              null,
              2,
            )}
          </pre>
          {copilotLog.errorMessage ? (
            <p className="mt-2 text-xs text-red-700">
              Error: {copilotLog.errorMessage}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-stone-900">{value}</dd>
    </div>
  );
}
