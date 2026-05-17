import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Send,
  Trash2,
  Loader2,
  AlertTriangle,
  Smartphone,
  Globe,
  Sparkles,
  History,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

interface Overview {
  enabled: boolean;
  total: number;
  newLastWeek: number;
  activeLast30: number;
  stale: number;
  providers: { label: string; count: number }[];
  platforms: { label: string; count: number }[];
}

interface Subscription {
  id: number;
  host: string;
  provider: string;
  platform: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  stale: boolean;
}

interface BroadcastResult {
  sent: number;
  failed: number;
  pruned: number;
}

interface ActivityEntry {
  id: number;
  kind: string;
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

async function getJson<T>(p: string): Promise<T> {
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

export default function PushTab() {
  const [pane, setPane] = useState<"compose" | "subscribers" | "history">("compose");

  const overview = useQuery({
    queryKey: ["admin-push-overview"],
    queryFn: () => getJson<Overview>("/admin/push/overview"),
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#1a2416]">Push notifications</h1>
        <p className="text-sm text-stone-600">
          Broadcast browser/web-push alerts to subscribers — promotions, drops, and
          re-engagement.
        </p>
      </header>

      {overview.data && !overview.data.enabled && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[13px] text-amber-900">
            <strong>Push isn't configured.</strong> Set the{" "}
            <code className="px-1 py-0.5 bg-white rounded text-[11px]">VAPID_PUBLIC_KEY</code>{" "}
            and{" "}
            <code className="px-1 py-0.5 bg-white rounded text-[11px]">VAPID_PRIVATE_KEY</code>{" "}
            environment secrets, then restart. Until then, broadcasts will return 409.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total subscribers" value={overview.data?.total ?? 0} />
        <StatCard
          label="Active last 30d"
          value={overview.data?.activeLast30 ?? 0}
          hint="Seen recently"
        />
        <StatCard label="New last 7d" value={overview.data?.newLastWeek ?? 0} />
        <StatCard
          label="Stale"
          value={overview.data?.stale ?? 0}
          hint="Not seen in 30+ days"
        />
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {(
          [
            ["compose", "Compose & broadcast", Send],
            ["subscribers", "Subscribers", Smartphone],
            ["history", "Broadcast history", History],
          ] as const
        ).map(([k, l, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPane(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-1.5 ${
              pane === k
                ? "border-[#1a2416] text-[#1a2416]"
                : "border-transparent text-stone-500 hover:text-[#1a2416]"
            }`}
            data-testid={`tab-push-${k}`}
          >
            <Icon className="w-4 h-4" />
            {l}
          </button>
        ))}
      </div>

      {pane === "compose" && <ComposePane overview={overview.data} />}
      {pane === "subscribers" && <SubscribersPane />}
      {pane === "history" && <HistoryPane />}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#1a2416] tabular-nums">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </div>
      {hint && <div className="text-[12px] text-stone-500 mt-0.5">{hint}</div>}
    </Card>
  );
}

function ComposePane({ overview }: { overview: Overview | undefined }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [confirming, setConfirming] = useState(false);

  const broadcast = useMutation({
    mutationFn: () =>
      send<BroadcastResult>("POST", "/admin/push/broadcast", {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || undefined,
      }),
    onSuccess: (r) => {
      toast({
        title: "Broadcast sent",
        description: `Delivered ${r.sent} · Failed ${r.failed} · Pruned ${r.pruned}`,
      });
      setTitle("");
      setBody("");
      setUrl("");
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ["admin-push-overview"] });
      void qc.invalidateQueries({ queryKey: ["admin-push-history"] });
    },
    onError: (err: Error) => {
      setConfirming(false);
      toast({
        title: "Broadcast failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const titleLeft = 65 - title.length;
  const bodyLeft = 180 - body.length;
  const canSend = title.trim().length > 0 && body.trim().length > 0;
  const audience = overview?.activeLast30 ?? overview?.total ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#3a5a2c]" />
          <h2 className="text-sm font-semibold text-[#1a2416]">Compose</h2>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-stone-700 mb-1 flex items-center justify-between">
            <span>Title</span>
            <span
              className={`text-[11px] ${titleLeft < 0 ? "text-rose-600" : "text-stone-400"}`}
            >
              {titleLeft} left
            </span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fresh harvest landed"
            maxLength={120}
            data-testid="input-push-title"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-stone-700 mb-1 flex items-center justify-between">
            <span>Body</span>
            <span
              className={`text-[11px] ${bodyLeft < 0 ? "text-rose-600" : "text-stone-400"}`}
            >
              {bodyLeft} left
            </span>
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Spring Darjeeling first flush is here. Limited stock."
            rows={3}
            maxLength={400}
            data-testid="input-push-body"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-stone-700 mb-1">
            Click-through URL (optional)
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/shop/darjeeling-first-flush"
            data-testid="input-push-url"
          />
        </div>

        {!confirming ? (
          <Button
            onClick={() => setConfirming(true)}
            disabled={!canSend || !overview?.enabled}
            className="w-full bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
            data-testid="button-push-broadcast"
          >
            <Send className="w-4 h-4 mr-1.5" />
            Broadcast to {audience.toLocaleString("en-IN")} subscriber
            {audience === 1 ? "" : "s"}
          </Button>
        ) : (
          <div className="border border-amber-300 bg-amber-50 rounded p-3 space-y-2">
            <div className="text-[13px] text-amber-900">
              This will send the notification to all{" "}
              <strong>{(overview?.total ?? 0).toLocaleString("en-IN")}</strong> stored
              subscribers. There is no undo.
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => broadcast.mutate()}
                disabled={broadcast.isPending}
                className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
                data-testid="button-push-confirm"
              >
                {broadcast.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send now"
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-[#1a2416] mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Live preview
          </h2>
          <div className="bg-stone-100 rounded-lg p-3 max-w-md">
            <div className="bg-white rounded-md shadow-sm border border-stone-200 p-3 flex gap-3">
              <div className="w-10 h-10 rounded bg-[#1a2416] text-amber-200 flex items-center justify-center font-bold text-sm shrink-0">
                Dr
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-[13px] text-[#1a2416] truncate">
                    {title || "Notification title"}
                  </div>
                  <div className="text-[10px] text-stone-400 shrink-0">now</div>
                </div>
                <div className="text-[12px] text-stone-700 mt-0.5 line-clamp-3 whitespace-pre-wrap">
                  {body || "Notification body will appear here."}
                </div>
                <div className="text-[10px] text-stone-400 mt-1">drtea.shop</div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-stone-500">
            Real notifications adapt to each platform. Keep titles ≤ 65 chars and body ≤
            180 chars to avoid truncation.
          </p>
        </Card>

        {overview && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-[#1a2416] mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Audience breakdown
            </h2>
            <div className="grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Provider
                </div>
                <ul className="space-y-1">
                  {overview.providers.length === 0 && (
                    <li className="text-stone-400 italic">No subscribers</li>
                  )}
                  {overview.providers.map((p) => (
                    <li key={p.label} className="flex justify-between">
                      <span className="truncate text-stone-700">{p.label}</span>
                      <span className="tabular-nums text-stone-500 ml-2">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Platform
                </div>
                <ul className="space-y-1">
                  {overview.platforms.length === 0 && (
                    <li className="text-stone-400 italic">No subscribers</li>
                  )}
                  {overview.platforms.map((p) => (
                    <li key={p.label} className="flex justify-between">
                      <span className="text-stone-700">{p.label}</span>
                      <span className="tabular-nums text-stone-500 ml-2">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SubscribersPane() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "true" | "false">("all");

  const list = useQuery({
    queryKey: ["admin-push-subscriptions", filter],
    queryFn: () =>
      getJson<{ subscriptions: Subscription[] }>(
        `/admin/push/subscriptions?limit=200${filter !== "all" ? `&stale=${filter}` : ""}`,
      ),
  });

  const del = useMutation({
    mutationFn: (id: number) => send<{ ok: true }>("DELETE", `/admin/push/subscriptions/${id}`),
    onSuccess: () => {
      toast({ title: "Subscription removed" });
      void qc.invalidateQueries({ queryKey: ["admin-push-subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["admin-push-overview"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not remove", description: err.message, variant: "destructive" }),
  });

  const prune = useMutation({
    mutationFn: () => send<{ pruned: number }>("POST", "/admin/push/prune-stale"),
    onSuccess: (r) => {
      toast({
        title: "Stale subscriptions pruned",
        description: `Removed ${r.pruned} endpoints not seen in 30+ days.`,
      });
      void qc.invalidateQueries({ queryKey: ["admin-push-subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["admin-push-overview"] });
    },
    onError: (err: Error) =>
      toast({ title: "Prune failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {(["all", "false", "true"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`px-3 h-8 rounded-full text-[12px] font-medium border ${
                filter === v
                  ? "bg-[#1a2416] text-white border-[#1a2416]"
                  : "bg-white text-stone-700 border-stone-200 hover:border-[#1a2416]/40"
              }`}
              data-testid={`filter-push-${v}`}
            >
              {v === "all" ? "All" : v === "false" ? "Active" : "Stale"}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Remove all subscriptions not seen in 30+ days? This cannot be undone.")) {
              prune.mutate();
            }
          }}
          disabled={prune.isPending}
          data-testid="button-prune-stale"
        >
          {prune.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 mr-1.5" />
          )}
          Prune stale
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {list.isLoading ? (
          <div className="p-6 text-sm text-stone-500">Loading…</div>
        ) : !list.data?.subscriptions.length ? (
          <div className="p-12 text-center">
            <Smartphone className="w-10 h-10 mx-auto text-stone-300 mb-2" />
            <div className="text-sm text-stone-600">No subscriptions match this filter.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                  <th className="py-2 px-3">Provider</th>
                  <th className="py-2 px-3">Platform</th>
                  <th className="py-2 px-3">User-agent</th>
                  <th className="py-2 px-3 text-right">Subscribed</th>
                  <th className="py-2 px-3 text-right">Last seen</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.data.subscriptions.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <td className="py-2 px-3">
                      <div className="font-medium text-[#1a2416]">{s.provider}</div>
                      <div className="text-[11px] text-stone-500 font-mono truncate max-w-[200px]">
                        {s.host}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="secondary" className="bg-stone-100 text-stone-700">
                        {s.platform}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-stone-500 truncate max-w-[260px]">
                      {s.userAgent || "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-[12px] text-stone-500 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="py-2 px-3 text-right text-[12px] whitespace-nowrap">
                      {s.stale ? (
                        <span className="text-amber-700">
                          {new Date(s.lastSeenAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      ) : (
                        <span className="text-stone-500">
                          {new Date(s.lastSeenAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => del.mutate(s.id)}
                        disabled={del.isPending}
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded"
                        aria-label="Remove subscription"
                        data-testid={`button-delete-sub-${s.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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

function HistoryPane() {
  const list = useQuery({
    queryKey: ["admin-push-history"],
    queryFn: () =>
      getJson<{ items: ActivityEntry[] }>(
        "/admin/activity?kind=push_broadcast_sent&limit=50",
      ).catch(() => ({ items: [] as ActivityEntry[] })),
  });

  if (list.isLoading) {
    return <div className="text-sm text-stone-500">Loading…</div>;
  }
  if (!list.data?.items.length) {
    return (
      <Card className="p-12 text-center">
        <History className="w-10 h-10 mx-auto text-stone-300 mb-2" />
        <div className="text-sm text-stone-600">No broadcasts sent yet.</div>
        <div className="text-[12px] text-stone-500 mt-1">
          Broadcasts you send appear here with delivery counts.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {list.data.items.map((a) => {
        const p = (a.payload ?? {}) as {
          title?: string;
          body?: string;
          url?: string | null;
          sent?: number;
          failed?: number;
          pruned?: number;
        };
        return (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#1a2416]">
                  {p.title ?? a.title}
                </div>
                {p.body && (
                  <div className="text-[13px] text-stone-700 mt-1 whitespace-pre-wrap">
                    {p.body}
                  </div>
                )}
                {p.url && (
                  <div className="text-[12px] text-[#3a5a2c] mt-1 font-mono">{p.url}</div>
                )}
              </div>
              <div className="text-right text-[11px] text-stone-500 whitespace-nowrap">
                {new Date(a.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Sent {p.sent ?? 0}
              </span>
              {(p.failed ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                  Failed {p.failed}
                </span>
              )}
              {(p.pruned ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                  Pruned {p.pruned}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

