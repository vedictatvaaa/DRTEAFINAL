import { useCallback, useEffect, useState } from "react";
import {
  Twitter,
  RefreshCw,
  Send,
  CheckCircle2,
  Loader2,
  Trash2,
  Settings as SettingsIcon,
  ExternalLink,
  AlertCircle,
  Cloud,
  AtSign,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

type Channel = "x" | "bluesky" | "threads";
const ALL_CHANNELS: Channel[] = ["x", "bluesky", "threads"];

const CHANNEL_META: Record<Channel, { label: string; icon: typeof Twitter; verb: string; charLimit: number }> = {
  x: { label: "X", icon: Twitter, verb: "tweet", charLimit: 280 },
  bluesky: { label: "Bluesky", icon: Cloud, verb: "post", charLimit: 300 },
  threads: { label: "Threads", icon: AtSign, verb: "post", charLimit: 500 },
};

interface Draft {
  id: number;
  body: string;
  hashtags: string[];
  topic: string;
  title: string;
  channel: Channel;
  status: "draft" | "approved" | "scheduled" | "posted";
  scheduledAt: string | null;
  postedAt: string | null;
  createdAt: string;
  jsonLd?: { tweetId?: string; uri?: string; threadId?: string; url?: string } | null;
}

interface SocialConfig {
  enabled: boolean;
  autoApprove: boolean;
  dailyPostCap: number;
  maxQueue: number;
  minDelayMinutes: number;
  quietHours: number[];
  enabledChannels: Channel[];
}

interface PerChannelCounts {
  drafts: number;
  approved: number;
  postedToday: number;
  postedWeek: number;
}
interface Stats {
  drafts: number;
  approved: number;
  postedToday: number;
  postedWeek: number;
  byChannel: Record<Channel, PerChannelCounts>;
  networks: Record<Channel, boolean>;
}

export default function SocialTab() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"draft" | "approved" | "posted">("draft");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [config, setConfig] = useState<SocialConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ status: tab });
    if (channelFilter !== "all") qs.set("channel", channelFilter);
    const [d, s, c] = await Promise.all([
      fetch(`${API}/admin/social/drafts?${qs}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/admin/social/stats`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/admin/social/config`, { credentials: "include" }).then((r) => r.json()),
    ]);
    setDrafts(d.drafts ?? []);
    setStats(s);
    setConfig(c.config);
    setLoading(false);
  }, [tab, channelFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const generateNow = async () => {
    setBusy(true);
    const r = await fetch(`${API}/admin/social/generate-now`, { method: "POST", credentials: "include" }).then((x) => x.json());
    setBusy(false);
    toast({
      title: r.inserted ? "Drafts created" : "Skipped",
      description: r.inserted
        ? `Drafted on: ${(r.channels ?? []).join(", ")}`
        : r.reason ?? "No draft created",
    });
    await load();
  };

  const updateDraft = async (id: number, patch: Partial<Draft>) => {
    const r = await fetch(`${API}/admin/social/drafts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    }).then((x) => x.json());
    if (r.error) {
      toast({ title: "Update failed", description: JSON.stringify(r.error), variant: "destructive" });
      return;
    }
    await load();
  };

  const postNow = async (id: number) => {
    setBusy(true);
    const r = await fetch(`${API}/admin/social/drafts/${id}/post-now`, { method: "POST", credentials: "include" }).then((x) => x.json());
    setBusy(false);
    if (r.ok) {
      toast({ title: `Posted to ${CHANNEL_META[r.channel as Channel]?.label ?? r.channel}`, description: r.url });
    } else {
      toast({ title: "Post failed", description: r.error, variant: "destructive" });
    }
    await load();
  };

  const remove = async (id: number) => {
    await fetch(`${API}/admin/social/drafts/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  };

  const saveConfig = async (patch: Partial<SocialConfig>) => {
    const r = await fetch(`${API}/admin/social/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    }).then((x) => x.json());
    setConfig(r.config);
    toast({ title: "Saved" });
  };

  const toggleChannel = (ch: Channel) => {
    if (!config) return;
    const next = config.enabledChannels.includes(ch)
      ? config.enabledChannels.filter((c) => c !== ch)
      : [...config.enabledChannels, ch];
    if (next.length === 0) {
      toast({ title: "Keep at least one channel", variant: "destructive" });
      return;
    }
    void saveConfig({ enabledChannels: next });
  };

  const unconfiguredEnabled =
    config && stats
      ? config.enabledChannels.filter((c) => !stats.networks[c])
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Send className="w-5 h-5" /> Auto-Social
          </h2>
          <p className="text-sm text-muted-foreground">
            One generated tweet, fanned out to every enabled network. Approve before posting (or flip auto-approve).
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={generateNow} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Generate now
          </Button>
        </div>
      </div>

      {unconfiguredEnabled.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>{unconfiguredEnabled.map((c) => CHANNEL_META[c].label).join(", ")} not configured.</strong>{" "}
            Drafts will queue but won't post until you add credentials in the <em>Integrations</em> tab.
          </div>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Drafts waiting" value={stats.drafts} />
          <StatCard label="Approved / queued" value={stats.approved} />
          <StatCard label="Posted (24h)" value={stats.postedToday} />
          <StatCard label="Posted (7d)" value={stats.postedWeek} />
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ALL_CHANNELS.map((ch) => {
            const meta = CHANNEL_META[ch];
            const counts = stats.byChannel[ch] ?? { drafts: 0, approved: 0, postedToday: 0, postedWeek: 0 };
            const Icon = meta.icon;
            const isEnabled = config?.enabledChannels.includes(ch) ?? false;
            const isConfigured = stats.networks[ch];
            return (
              <Card key={ch} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Icon className="w-4 h-4" /> {meta.label}
                    {isConfigured ? (
                      <Badge variant="secondary" className="text-[10px]">connected</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                        no creds
                      </Badge>
                    )}
                  </div>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={isEnabled} onChange={() => toggleChannel(ch)} />
                    fan out
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div><div className="font-semibold">{counts.drafts}</div><div className="text-muted-foreground">draft</div></div>
                  <div><div className="font-semibold">{counts.approved}</div><div className="text-muted-foreground">queue</div></div>
                  <div><div className="font-semibold">{counts.postedToday}</div><div className="text-muted-foreground">24h</div></div>
                  <div><div className="font-semibold">{counts.postedWeek}</div><div className="text-muted-foreground">7d</div></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {config && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium">
            <SettingsIcon className="w-4 h-4" /> Posting rules
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <ToggleRow label="Pipeline enabled" value={config.enabled} onChange={(v) => saveConfig({ enabled: v })} />
            <ToggleRow label="Auto-approve drafts" value={config.autoApprove} onChange={(v) => saveConfig({ autoApprove: v })} />
            <NumberRow label="Daily cap (per network)" value={config.dailyPostCap} min={1} max={50} onSave={(v) => saveConfig({ dailyPostCap: v })} />
            <NumberRow label="Max queue per network" value={config.maxQueue} min={1} max={200} onSave={(v) => saveConfig({ maxQueue: v })} />
            <NumberRow label="Min minutes between posts" value={config.minDelayMinutes} min={5} max={720} onSave={(v) => saveConfig({ minDelayMinutes: v })} />
            <div className="text-xs text-muted-foreground self-center">
              Quiet hours: {config.quietHours.length ? config.quietHours.join(", ") : "none"} (server time)
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 border-b">
        <div className="flex gap-2">
          {(["draft", "approved", "posted"] as const).map((t) => (
            <button
              key={t}
              className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 pb-1">
          <ChipBtn active={channelFilter === "all"} onClick={() => setChannelFilter("all")}>All</ChipBtn>
          {ALL_CHANNELS.map((ch) => (
            <ChipBtn key={ch} active={channelFilter === ch} onClick={() => setChannelFilter(ch)}>
              {CHANNEL_META[ch].label}
            </ChipBtn>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No posts in this lane.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => {
            const text = editing[d.id] ?? d.body;
            const dirty = editing[d.id] !== undefined && editing[d.id] !== d.body;
            const meta = CHANNEL_META[d.channel] ?? CHANNEL_META.x;
            const Icon = meta.icon;
            const canPostThisChannel = stats?.networks[d.channel];
            return (
              <Card key={d.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="default" className="flex items-center gap-1">
                    <Icon className="w-3 h-3" /> {meta.label}
                  </Badge>
                  <Badge variant="outline">{d.title || "post"}</Badge>
                  {d.topic && d.topic !== "evergreen" && <Badge variant="secondary">trend: {d.topic.slice(0, 40)}</Badge>}
                  <Badge>{d.status}</Badge>
                  {d.scheduledAt && <span>scheduled {new Date(d.scheduledAt).toLocaleString()}</span>}
                  {d.jsonLd?.url && (
                    <a href={d.jsonLd.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                      view on {meta.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <Textarea
                  value={text}
                  onChange={(e) => setEditing({ ...editing, [d.id]: e.target.value })}
                  rows={3}
                  className="text-sm"
                  disabled={d.status === "posted"}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{text.length}/{meta.charLimit}</span>
                  <div className="flex gap-2">
                    {dirty && (
                      <Button size="sm" variant="outline" onClick={() => updateDraft(d.id, { body: text })}>
                        Save edit
                      </Button>
                    )}
                    {d.status === "draft" && (
                      <Button size="sm" onClick={() => updateDraft(d.id, { status: "approved" })}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    )}
                    {d.status !== "posted" && canPostThisChannel && (
                      <Button size="sm" variant="default" onClick={() => postNow(d.id)} disabled={busy}>
                        <Send className="w-4 h-4 mr-1" /> Post now
                      </Button>
                    )}
                    {d.status !== "posted" && (
                      <Button size="sm" variant="ghost" onClick={() => remove(d.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 p-2 rounded border bg-card">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function NumberRow({ label, value, min, max, onSave }: { label: string; value: number; min: number; max: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div className="flex items-center justify-between gap-3 p-2 rounded border bg-card">
      <span>{label}</span>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          value={v}
          min={min}
          max={max}
          onChange={(e) => setV(e.target.value)}
          className="w-20 h-8"
        />
        {v !== String(value) && (
          <Button size="sm" variant="outline" onClick={() => onSave(Number(v))}>
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
