import { useCallback, useEffect, useState } from "react";
import {
  Flame,
  RefreshCw,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

type Kind = "rss" | "reddit" | "google_trends" | "youtube" | "serpapi" | "twitter";

interface Source {
  id: number;
  kind: Kind;
  name: string;
  url: string;
  filterKeywords: string;
  weight: number;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string;
  itemsLastRun: number;
  runnable: boolean;
  scaffoldOnly: boolean;
}

interface Topic {
  id: number;
  topic: string;
  topicKey: string;
  sourceName: string;
  sourceKind: Kind;
  rawUrl: string;
  summary: string;
  tags: string[];
  hashtags: string[];
  score: number;
  used: boolean;
  dismissed: boolean;
  fetchedAt: string;
}

interface Stats { total: number; fresh: number; used: number; dismissed: number }
interface Config { autoPublish: boolean; topNPerCron: number; ingestIntervalHours: number }

const KIND_HELP: Record<Kind, { url: string; example: string }> = {
  rss: { url: "Feed URL", example: "https://www.worldteanews.com/feed" },
  reddit: { url: "subreddit[:sort[:period]]", example: "tea:top:week" },
  google_trends: { url: "Geo code", example: "IN" },
  youtube: { url: "Search query (needs YOUTUBE_API_KEY)", example: "tea brewing" },
  serpapi: { url: "Query (disabled — needs SERPAPI_KEY)", example: "indian tea" },
  twitter: { url: "X search query (disabled — needs TWITTER_BEARER_TOKEN)", example: "tea OR matcha" },
};

export default function TrendsTab() {
  const { toast } = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [topicTab, setTopicTab] = useState<"fresh" | "used" | "dismissed">("fresh");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<{ kind: Kind; name: string; url: string; filterKeywords: string; weight: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, st, c] = await Promise.all([
        fetch(`${API}/admin/trends/sources`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/admin/trends/topics?status=${topicTab}`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/admin/trends/stats`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/admin/trends/config`, { credentials: "include" }).then((r) => r.json()),
      ]);
      setSources(s);
      setTopics(t);
      setStats(st);
      setCfg(c);
    } catch (err) {
      toast({ title: "Couldn't load trends", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, topicTab]);

  useEffect(() => { void load(); }, [load]);

  async function runIngest(sourceId?: number) {
    setRunning(true);
    try {
      const r = await fetch(`${API}/admin/trends/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      const j = (await r.json()) as { runs: number; inserted: number };
      toast({ title: "Ingest done", description: `Ran ${j.runs} source${j.runs === 1 ? "" : "s"}, inserted ${j.inserted} topics.` });
      void load();
    } catch (err) {
      toast({ title: "Ingest failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  async function patchSource(id: number, patch: Partial<Source>) {
    await fetch(`${API}/admin/trends/sources/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load();
  }

  async function deleteSource(id: number) {
    if (!confirm("Delete this trend source?")) return;
    await fetch(`${API}/admin/trends/sources/${id}`, { method: "DELETE", credentials: "include" });
    void load();
  }

  async function createSource() {
    if (!creating) return;
    const r = await fetch(`${API}/admin/trends/sources`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creating),
    });
    if (!r.ok) {
      toast({ title: "Couldn't create source", variant: "destructive" });
      return;
    }
    setCreating(null);
    void load();
  }

  async function topicAction(id: number, action: "dismiss" | "restore") {
    await fetch(`${API}/admin/trends/topics/${id}/${action}`, { method: "POST", credentials: "include" });
    void load();
  }

  async function patchConfig(patch: Partial<Config>) {
    const r = await fetch(`${API}/admin/trends/config`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      const j = (await r.json()) as Config;
      setCfg(j);
      toast({ title: "Config saved" });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-600" /> Trend pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pulls real-world tea signal from RSS, Reddit, Google Trends &amp; more — feeds the AI content crons.
          </p>
        </div>
        <Button onClick={() => runIngest()} disabled={running}>
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Run all sources now
        </Button>
      </header>

      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Topics in bank" value={stats.total} />
          <StatCard label="Fresh (queued)" value={stats.fresh} accent="text-orange-600" />
          <StatCard label="Used by AI" value={stats.used} accent="text-emerald-600" />
          <StatCard label="Dismissed" value={stats.dismissed} accent="text-muted-foreground" />
        </div>
      ) : null}

      {/* Config */}
      {cfg ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4" /> Pipeline config
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="block font-medium mb-1">Auto-publish AI content</span>
              <select
                className="w-full border rounded-md px-3 py-2 bg-white"
                value={cfg.autoPublish ? "1" : "0"}
                onChange={(e) => patchConfig({ autoPublish: e.target.value === "1" })}
              >
                <option value="1">On — auto publish</option>
                <option value="0">Off — review queue</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block font-medium mb-1">Topics fed per cron</span>
              <Input
                type="number" min={1} max={20}
                value={cfg.topNPerCron}
                onChange={(e) => setCfg({ ...cfg, topNPerCron: Number(e.target.value) })}
                onBlur={() => patchConfig({ topNPerCron: cfg.topNPerCron })}
              />
            </label>
            <label className="text-sm">
              <span className="block font-medium mb-1">Ingest every (hours)</span>
              <Input
                type="number" min={1} max={168}
                value={cfg.ingestIntervalHours}
                onChange={(e) => setCfg({ ...cfg, ingestIntervalHours: Number(e.target.value) })}
                onBlur={() => patchConfig({ ingestIntervalHours: cfg.ingestIntervalHours })}
              />
            </label>
          </div>
        </Card>
      ) : null}

      {/* Sources */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sources</h2>
          <Button variant="outline" size="sm" onClick={() =>
            setCreating({ kind: "rss", name: "", url: "", filterKeywords: "", weight: 5 })
          }>
            <Plus className="w-4 h-4 mr-1" /> Add source
          </Button>
        </div>

        {creating ? (
          <div className="border rounded-lg p-4 mb-4 bg-amber-50/40">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block font-medium mb-1">Kind</span>
                <select
                  className="w-full border rounded-md px-3 py-2 bg-white"
                  value={creating.kind}
                  onChange={(e) => setCreating({ ...creating, kind: e.target.value as Kind })}
                >
                  <option value="rss">RSS feed</option>
                  <option value="reddit">Reddit subreddit</option>
                  <option value="google_trends">Google Trends (geo)</option>
                  <option value="youtube">YouTube search</option>
                  <option value="serpapi">SerpAPI Google News (disabled)</option>
                  <option value="twitter">X / Twitter search (disabled)</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block font-medium mb-1">Display name</span>
                <Input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="e.g. World Tea News" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="block font-medium mb-1">{KIND_HELP[creating.kind].url}</span>
                <Input value={creating.url} onChange={(e) => setCreating({ ...creating, url: e.target.value })} placeholder={KIND_HELP[creating.kind].example} />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="block font-medium mb-1">Filter keywords (optional, comma-separated)</span>
                <Input value={creating.filterKeywords} onChange={(e) => setCreating({ ...creating, filterKeywords: e.target.value })} placeholder="tea, chai, matcha" />
              </label>
              <label className="text-sm">
                <span className="block font-medium mb-1">Weight (0–10)</span>
                <Input type="number" min={0} max={10} value={creating.weight} onChange={(e) => setCreating({ ...creating, weight: Number(e.target.value) })} />
              </label>
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setCreating(null)}>Cancel</Button>
              <Button size="sm" onClick={() => void createSource()} disabled={!creating.name || !creating.url}>Create</Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">URL / target</th>
                  <th className="py-2 pr-3">Wt</th>
                  <th className="py-2 pr-3">Last run</th>
                  <th className="py-2 pr-3">On</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">{s.kind.replace("_", " ")}</Badge>
                        <span className="font-medium">{s.name}</span>
                        {s.scaffoldOnly ? (
                          <Badge variant="outline" className="text-[10px] text-amber-700">scaffold</Badge>
                        ) : null}
                        {!s.runnable && !s.scaffoldOnly ? (
                          <Badge variant="outline" className="text-[10px] text-amber-700">needs key</Badge>
                        ) : null}
                      </div>
                      {s.lastError ? (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {s.lastError.slice(0, 100)}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 max-w-xs">
                      <code className="text-xs text-muted-foreground break-all">{s.url}</code>
                      {s.filterKeywords ? (
                        <div className="text-xs text-muted-foreground mt-1">filter: {s.filterKeywords}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <Input
                        type="number" min={0} max={10}
                        value={s.weight}
                        onChange={(e) => patchSource(s.id, { weight: Number(e.target.value) })}
                        className="h-8 w-16"
                      />
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      {s.lastFetchedAt ? `${new Date(s.lastFetchedAt).toLocaleString()} · ${s.itemsLastRun} items` : "never"}
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => patchSource(s.id, { enabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => runIngest(s.id)} disabled={running || !s.enabled}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteSource(s.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Topic bank */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold">Topic bank</h2>
          <div className="flex gap-1 text-xs">
            {(["fresh", "used", "dismissed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTopicTab(t)}
                className={`px-3 py-1.5 rounded-md transition ${topicTab === t ? "bg-primary text-white" : "bg-black/5 hover:bg-black/10"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {topicTab} topics yet. {topicTab === "fresh" ? "Run an ingest above." : ""}</p>
        ) : (
          <ul className="divide-y">
            {topics.map((t) => (
              <li key={t.id} className="py-3 flex items-start gap-3">
                <span className="mt-0.5 text-xs font-mono w-12 shrink-0 text-orange-700">{t.score.toFixed(2)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {t.rawUrl ? (
                      <a href={t.rawUrl} target="_blank" rel="noreferrer" className="hover:underline">{t.topic}</a>
                    ) : (
                      t.topic
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.sourceName} · {new Date(t.fetchedAt).toLocaleDateString()}
                    {t.tags.length ? ` · ${t.tags.slice(0, 3).join(", ")}` : ""}
                  </p>
                  {t.hashtags && t.hashtags.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.hashtags.slice(0, 8).map((h) => (
                        <span
                          key={h}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-700"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-1 shrink-0">
                  {t.dismissed ? (
                    <Button variant="ghost" size="sm" onClick={() => topicAction(t.id, "restore")} title="Restore">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => topicAction(t.id, "dismiss")} title="Dismiss">
                      <XCircle className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-serif font-bold mt-1 ${accent ?? ""}`}>{value}</p>
    </Card>
  );
}
