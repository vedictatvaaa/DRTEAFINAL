import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Rocket, CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown,
  ChevronUp, Terminal, Globe, GitBranch, Shield, Cpu, Database,
  Zap, AlertTriangle, Copy, FileText, Wand2, Undo2, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface EnvVar { key: string; set: boolean; required: boolean }
interface Readiness {
  ready: boolean; required: EnvVar[]; optional: EnvVar[];
  nodeVersion: string; uptime: number; memoryMb: number;
}
interface DeployRecord {
  id: string; triggeredAt: string; triggeredBy: string;
  status: "pending" | "triggered" | "success" | "failed" | "rolled-back";
  method: string; message?: string; durationMs?: number;
  action?: "deploy" | "rollback"; commit?: string;
}
interface DeployLogs {
  id: string; status: string; action?: string; commit?: string;
  triggeredAt: string; triggeredBy: string; durationMs?: number;
  message?: string; logs: string[];
}
interface DeployStatus {
  current: DeployRecord | null; lastSuccess: DeployRecord | null;
  rollbackReady?: boolean; rollbackTargetCommit?: string | null;
  webhookConfigured: boolean; githubConfigured: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    pending:   { icon: <RefreshCw className="w-3 h-3 animate-spin" />, label: "Deploying…",    cls: "bg-amber-100 text-amber-800 border-amber-200" },
    triggered: { icon: <RefreshCw className="w-3 h-3 animate-spin" />, label: "Building…",     cls: "bg-blue-100 text-blue-800 border-blue-200" },
    success:   { icon: <CheckCircle2 className="w-3 h-3" />,           label: "Live",          cls: "bg-green-100 text-green-800 border-green-200" },
    failed:    { icon: <XCircle className="w-3 h-3" />,                label: "Failed",        cls: "bg-red-100 text-red-800 border-red-200" },
    idle:      { icon: <Clock className="w-3 h-3" />,                  label: "Never deployed",cls: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status] ?? map.idle!;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.icon} {s.label}</span>;
}

function EnvRow({ item }: { item: EnvVar }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="font-mono text-xs text-foreground/80">{item.key}</span>
      {item.set
        ? <span className="flex items-center gap-1 text-[11px] text-green-700 font-medium"><CheckCircle2 className="w-3 h-3" /> Set</span>
        : <span className="flex items-center gap-1 text-[11px] text-red-600 font-medium"><XCircle className="w-3 h-3" /> {item.required ? "Missing!" : "Not set"}</span>}
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const { toast } = useToast();
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <button type="button" onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Copied to clipboard" }); }} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
      <pre className="bg-[#0e1810] text-green-300 text-[11px] rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

export default function DeployTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [method, setMethod] = useState<"webhook" | "github">("webhook");
  const [confirming, setConfirming] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showEnv, setShowEnv] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [openLogsId, setOpenLogsId] = useState<string | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState(false);

  const statusQ = useQuery<DeployStatus>({
    queryKey: ["deploy-status"],
    queryFn: () => apiFetch("/admin/deploy/status"),
    refetchInterval: (q) => {
      const d = q.state.data as DeployStatus | undefined;
      const s = d?.current?.status;
      return s === "pending" || s === "triggered" ? 3000 : 15000;
    },
  });
  const readinessQ = useQuery<Readiness>({ queryKey: ["deploy-readiness"], queryFn: () => apiFetch("/admin/deploy/readiness"), staleTime: 30_000 });
  const historyQ = useQuery<DeployRecord[]>({ queryKey: ["deploy-history"], queryFn: () => apiFetch("/admin/deploy/history"), staleTime: 10_000 });
  const envTemplateQ = useQuery<string>({ queryKey: ["deploy-env-template"], queryFn: async () => {
    const res = await fetch(`${BASE}/admin/deploy/env-template`, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }});
  const bootstrapQ = useQuery<{ commands: string[]; seeders: string[]; note: string }>({
    queryKey: ["deploy-bootstrap"],
    queryFn: () => apiFetch("/admin/deploy/bootstrap"),
    staleTime: 60_000,
  });

  const triggerMut = useMutation({
    mutationFn: () => apiFetch<{ success: boolean; deploy: DeployRecord }>("/admin/deploy/trigger", {
      method: "POST",
      body: JSON.stringify({ method }),
    }),
    onSuccess: () => {
      toast({ title: "Deploy triggered!", description: "Your VPS is pulling the latest build." });
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ["deploy-status"] });
      void qc.invalidateQueries({ queryKey: ["deploy-history"] });
    },
    onError: (err: Error) => {
      toast({ title: "Deploy failed", description: err.message, variant: "destructive" });
      setConfirming(false);
    },
  });

  const rollbackMut = useMutation({
    mutationFn: () => apiFetch<{ success: boolean; deploy: DeployRecord }>("/admin/deploy/rollback", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast({ title: "Rollback triggered", description: "Reverting VPS to the previous successful deploy." });
      setRollbackConfirm(false);
      void qc.invalidateQueries({ queryKey: ["deploy-status"] });
      void qc.invalidateQueries({ queryKey: ["deploy-history"] });
    },
    onError: (err: Error) => {
      toast({ title: "Rollback failed", description: err.message, variant: "destructive" });
      setRollbackConfirm(false);
    },
  });

  const logsQ = useQuery<DeployLogs>({
    queryKey: ["deploy-logs", openLogsId],
    queryFn: () => apiFetch(`/admin/deploy/logs/${openLogsId}`),
    enabled: !!openLogsId,
    refetchInterval: (q) => {
      const d = q.state.data as DeployLogs | undefined;
      return d?.status === "pending" || d?.status === "triggered" ? 2000 : false;
    },
  });

  const bootstrapMut = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean; seeded: boolean; message: string }>("/admin/deploy/bootstrap", { method: "POST", body: JSON.stringify({ dryRun: false }) }),
    onSuccess: (data) => {
      toast({ title: "Bootstrap complete", description: data.message });
      void qc.invalidateQueries({ queryKey: ["deploy-bootstrap"] });
    },
    onError: (err: Error) => toast({ title: "Bootstrap failed", description: err.message, variant: "destructive" }),
  });

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const status = statusQ.data;
  const readiness = readinessQ.data;
  const history = historyQ.data ?? [];
  const isDeploying = status?.current?.status === "pending" || status?.current?.status === "triggered";
  const canDeploy = method === "webhook" ? !!status?.webhookConfigured : !!status?.githubConfigured;
  const formatDate = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const uptime = readiness?.uptime ?? 0;
  const uptimeStr = uptime > 3600 ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m` : `${Math.floor(uptime / 60)}m`;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#1a2416]">VPS Deployment</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Push your latest build to production with one click.</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={isDeploying ? (status?.current?.status ?? "idle") : status?.lastSuccess ? "success" : "idle"} />
          <button type="button" onClick={() => { void qc.invalidateQueries({ queryKey: ["deploy-status"] }); void qc.invalidateQueries({ queryKey: ["deploy-readiness"] }); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Refresh status">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isDeploying && (
        <Card className="border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-none">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">Deploy in progress</p>
              <p className="text-xs text-blue-700 mt-0.5">{status?.current?.message ?? "Waiting for VPS to respond…"} &nbsp;·&nbsp; Triggered {status?.current?.triggeredAt ? formatDate(status.current.triggeredAt) : "just now"}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-blue-200 overflow-hidden"><div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" /></div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-[#1a2416] mb-4 flex items-center gap-2"><Rocket className="w-4 h-4 text-primary" /> Deploy Method</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { id: "webhook" as const, label: "Custom webhook", sub: "Any deploy webhook URL", icon: <Globe className="w-4 h-4" />, ok: status?.webhookConfigured },
                { id: "github" as const, label: "GitHub Actions", sub: "repository_dispatch", icon: <GitBranch className="w-4 h-4" />, ok: status?.githubConfigured },
              ].map((m) => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${method === m.id ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30 hover:bg-muted/50"}`}>
                  <div className="flex items-center gap-2 w-full"><span className={method === m.id ? "text-primary" : "text-muted-foreground"}>{m.icon}</span><span className="text-[13px] font-semibold">{m.label}</span>{m.ok ? <CheckCircle2 className="w-3 h-3 text-green-600 ml-auto" /> : <AlertTriangle className="w-3 h-3 text-amber-500 ml-auto" />}</div>
                  <span className="text-[11px] text-muted-foreground pl-6">{m.sub}</span>
                </button>
              ))}
            </div>

            {!canDeploy && <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs"><AlertTriangle className="w-4 h-4 flex-none mt-0.5" /> <div>{method === "webhook" ? <><strong>DEPLOY_WEBHOOK_URL</strong> is not set. Add it to your Replit environment secrets, then paste your VPS deploy webhook URL.</> : <><strong>GITHUB_TOKEN</strong> and <strong>GITHUB_REPO</strong> are not set. Add them to your Replit environment secrets.</>}</div></div>}

            {!confirming ? (
              <Button onClick={() => setConfirming(true)} disabled={isDeploying || !canDeploy} className="w-full gap-2 h-11"><Rocket className="w-4 h-4" /> {isDeploying ? "Deploying…" : "Push to Production"}</Button>
            ) : (
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-3">
                <p className="text-sm font-semibold text-amber-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Confirm production deploy</p>
                <p className="text-xs text-amber-800">This will push your latest commit to the live VPS and restart the server. Active shoppers may see a brief interruption.</p>
                <div className="flex gap-2">
                  <Button onClick={() => triggerMut.mutate()} disabled={triggerMut.isPending} size="sm" className="gap-1.5"><Rocket className="w-3.5 h-3.5" /> {triggerMut.isPending ? "Triggering…" : "Yes, deploy now"}</Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {status?.lastSuccess && <p className="mt-3 text-center text-[11px] text-muted-foreground">Last successful deploy: {formatDate(status.lastSuccess.triggeredAt)} by {status.lastSuccess.triggeredBy}</p>}

            <div className="mt-4 pt-4 border-t border-border/60">
              {!rollbackConfirm ? (
                <>
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setRollbackConfirm(true)} disabled={isDeploying || !status?.rollbackReady}>
                    <Undo2 className="w-3.5 h-3.5" /> Roll back to previous deploy
                  </Button>
                  {!status?.rollbackReady && (
                    <p className="mt-2 text-[10px] text-muted-foreground text-center">No rollback target yet — needs at least one successful deploy with a captured commit SHA.</p>
                  )}
                </>
              ) : (
                <div className="p-3 rounded-xl border border-red-300 bg-red-50 space-y-2">
                  <p className="text-xs font-semibold text-red-900 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> Confirm rollback</p>
                  <p className="text-[11px] text-red-800">VPS will revert to commit <span className="font-mono">{status?.rollbackTargetCommit?.slice(0, 7) ?? "previous"}</span>. Database changes are NOT reverted.</p>
                  <div className="flex gap-2">
                    <Button onClick={() => rollbackMut.mutate()} disabled={rollbackMut.isPending} size="sm" variant="destructive" className="gap-1.5">
                      <Undo2 className="w-3.5 h-3.5" /> {rollbackMut.isPending ? "Rolling back…" : "Yes, roll back"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRollbackConfirm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-[#1a2416] mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Deploy History</h3>
            {history.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No deploys yet this session.</p> : <div className="space-y-2">{history.map((d) => (
              <div key={d.id} className="rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3 p-2.5">
                  <div className="mt-0.5 flex-none">{d.status === "success" || d.status === "rolled-back" || d.status === "triggered" ? <CheckCircle2 className={`w-4 h-4 ${d.status === "rolled-back" ? "text-amber-600" : "text-green-600"}`} /> : d.status === "failed" ? <XCircle className="w-4 h-4 text-red-500" /> : <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold capitalize">{d.status}</span>
                      {d.action === "rollback" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">rollback</span>}
                      <span className="text-[10px] text-muted-foreground">via {d.method}</span>
                      {d.durationMs && <span className="text-[10px] text-muted-foreground">{d.durationMs}ms</span>}
                      {d.commit && <span className="text-[10px] font-mono text-muted-foreground">{d.commit.slice(0, 7)}</span>}
                    </div>
                    {d.message && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{d.message}</p>}
                  </div>
                  <button type="button" onClick={() => setOpenLogsId(openLogsId === d.id ? null : d.id)} className="flex-none text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted">
                    <ScrollText className="w-3 h-3" /> Logs
                  </button>
                  <span className="text-[10px] text-muted-foreground flex-none">{formatDate(d.triggeredAt)}</span>
                </div>
                {openLogsId === d.id && (
                  <div className="mx-2.5 mb-2.5">
                    <pre className="bg-[#0e1810] text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {logsQ.isLoading ? "Loading logs…" : (logsQ.data?.logs ?? []).join("\n") || "No log entries yet."}
                    </pre>
                  </div>
                )}
              </div>
            ))}</div>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-[#1a2416] mb-3 flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-primary" /> Production Readiness</h3>
            {readinessQ.isLoading ? <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}</div> : readiness ? <>
              <div className={`mb-3 flex items-center gap-2 p-2 rounded-lg text-xs font-semibold ${readiness.ready ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>{readiness.ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{readiness.ready ? "All systems go" : "Action needed"}</div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Required</p>
              {readiness.required.map((e) => <EnvRow key={e.key} item={e} />)}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-3">Optional</p>
              {readiness.optional.map((e) => <EnvRow key={e.key} item={e} />)}
            </> : null}
          </Card>

          <Card className="p-4">
            <h3 className="text-xs font-semibold text-[#1a2416] mb-3 flex items-center gap-2"><Cpu className="w-3.5 h-3.5 text-primary" /> Server Info</h3>
            {readiness && (
              <div className="space-y-2 text-xs">
                {[
                  { label: "Node", value: readiness.nodeVersion },
                  { label: "Uptime", value: uptimeStr },
                  { label: "Heap used", value: `${readiness.memoryMb} MB` },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-mono font-medium">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { key: "setup", icon: <Terminal className="w-4 h-4" />, label: "VPS Setup Guide", sub: "Fresh install: Node, PM2, Nginx, SSL", open: showSetup, toggle: setShowSetup, content: <CodeBlock code={`# 1. install Node + pnpm\ncurl -fsSL https://fnm.vercel.app/install | bash\nfnm install 20 && fnm use 20\nnpm install -g pnpm pm2\n\n# 2. clone & install\ngit clone https://github.com/vedictatvaaa/DRTEAFINAL.git /opt/drtea\ncd /opt/drtea && pnpm install\n\n# 3. env\ncp .env.example .env\n# set DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD, PORT, DEPLOY_WEBHOOK_URL\n\n# 4. migrate\npnpm --filter @workspace/api-server db:migrate\n\n# 5. build\npnpm --filter @workspace/dr-tea build\n\n# 6. run\npm2 start ecosystem.config.cjs\npm2 save && pm2 startup`} label="Copy for VPS bootstrap" /> },
          { key: "env", icon: <FileText className="w-4 h-4" />, label: "One-click Env Template", sub: "Generate a safe .env starter file", open: showEnv, toggle: setShowEnv, content: <>
            <div className="flex gap-2 mb-3"><Button size="sm" variant="outline" onClick={() => envTemplateQ.data && download(envTemplateQ.data, ".env.template")}>Download template</Button><Button size="sm" variant="outline" onClick={() => envTemplateQ.data && navigator.clipboard.writeText(envTemplateQ.data)}>Copy template</Button></div>
            <CodeBlock code={envTemplateQ.data ?? "Loading…"} label="Template (placeholders only)" />
          </> },
          { key: "bootstrap", icon: <Wand2 className="w-4 h-4" />, label: "DB Migrate + Seed", sub: "Run database setup after a fresh install", open: showBootstrap, toggle: setShowBootstrap, content: <>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button size="sm" onClick={() => bootstrapMut.mutate()} disabled={bootstrapMut.isPending}>Run seed now</Button>
              <Button size="sm" variant="outline" onClick={() => download((bootstrapQ.data?.commands ?? []).join("\n"), "bootstrap-commands.txt")}>Download commands</Button>
            </div>
            <CodeBlock code={(bootstrapQ.data?.commands ?? []).join("\n")} label={`Commands${bootstrapQ.data?.seeders?.length ? ` · seeds: ${bootstrapQ.data.seeders.join(", ")}` : ""}`} />
            {bootstrapQ.data?.note && <p className="mt-2 text-xs text-muted-foreground">{bootstrapQ.data.note}</p>}
          </> },
        ].map((s) => (
          <Card key={s.key} className="overflow-hidden">
            <button type="button" onClick={() => s.toggle(!s.open)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3"><span className="text-primary">{s.icon}</span><div className="text-left"><p className="text-sm font-semibold text-[#1a2416]">{s.label}</p><p className="text-xs text-muted-foreground">{s.sub}</p></div></div>
              {s.open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {s.open && <div className="px-4 pb-4">{s.content}</div>}
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[#1a2416] mb-3 flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Environment Variables Quick Reference</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {[
            { key: "DATABASE_URL", desc: "PostgreSQL connection string" },
            { key: "SESSION_SECRET", desc: "Long random string for cookies" },
            { key: "PORT", desc: "API server port (default 3000)" },
            { key: "ADMIN_PASSWORD", desc: "Admin login passcode on the VPS" },
            { key: "DEPLOY_WEBHOOK_URL", desc: "Custom deploy webhook URL" },
            { key: "DEPLOY_WEBHOOK_SECRET", desc: "Optional secret for webhook auth" },
            { key: "GITHUB_TOKEN", desc: "PAT with repo scope for GH Actions" },
            { key: "GITHUB_REPO", desc: "Format: owner/repo" },
            { key: "OPENAI_API_KEY", desc: "For AI content features" },
            { key: "RAZORPAY_KEY_ID", desc: "Payments integration" },
            { key: "RAZORPAY_KEY_SECRET", desc: "Payments integration" },
            { key: "SHIPROCKET_EMAIL", desc: "Shipping integration" },
            { key: "SHIPROCKET_PASSWORD", desc: "Shipping integration" },
          ].map((e) => <div key={e.key} className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0"><code className="text-[11px] font-mono text-primary bg-primary/8 px-1.5 py-0.5 rounded flex-none">{e.key}</code><span className="text-[11px] text-muted-foreground">{e.desc}</span></div>)}
        </div>
      </Card>
    </div>
  );
}
