import { useCallback, useEffect, useState } from "react";
import { Key, Loader2, Save, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

type Group = "x" | "bluesky" | "threads" | "youtube" | "serpapi" | "email" | "push" | "shiprocket";

interface KeyStatus {
  key: string;
  group: Group;
  label: string;
  secret: boolean;
  hint?: string;
  set: boolean;
  source: "db" | "env" | "";
  preview: string;
  updatedAt: string | null;
}

const GROUP_META: Record<Group, { title: string; blurb: string; testable?: boolean }> = {
  x: {
    title: "X (Twitter) — Auto-Tweet",
    blurb: "OAuth 1.0a user-context credentials. Required to actually post tweets to your account.",
    testable: true,
  },
  bluesky: {
    title: "Bluesky — Auto-Post",
    blurb: "Handle + app-password (NOT your main password). Generate one at bsky.app → Settings → App passwords.",
    testable: true,
  },
  threads: {
    title: "Threads (Meta) — Auto-Post",
    blurb: "Numeric Threads user id + long-lived (60-day) access token from developers.facebook.com → Threads API.",
    testable: true,
  },
  youtube: {
    title: "YouTube",
    blurb: "Optional API key — enables the YouTube trending adapter for the trend pipeline.",
  },
  serpapi: {
    title: "SerpAPI",
    blurb: "Optional — enables the SerpAPI trending adapter (Google search trends).",
  },
  email: {
    title: "Email (Resend)",
    blurb: "Used for transactional emails (order confirmations, newsletters).",
  },
  push: {
    title: "Web Push (VAPID)",
    blurb: "Generate a VAPID keypair on web-push-codelab.glitch.me and paste both halves here.",
  },
  shiprocket: {
    title: "Shiprocket",
    blurb: "Shipment label generation + tracking webhooks.",
  },
};

export default function IntegrationsTab() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/admin/integrations`, { credentials: "include" }).then((x) => x.json());
    setKeys(r.keys ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (key: string) => {
    const value = drafts[key] ?? "";
    setBusy((b) => ({ ...b, [key]: true }));
    const r = await fetch(`${API}/admin/integrations/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ value }),
    }).then((x) => x.json());
    setBusy((b) => ({ ...b, [key]: false }));
    if (r.ok) {
      toast({ title: `${key} saved` });
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      await load();
    } else {
      toast({ title: "Save failed", description: JSON.stringify(r.error), variant: "destructive" });
    }
  };

  const clear = async (key: string) => {
    setBusy((b) => ({ ...b, [key]: true }));
    await fetch(`${API}/admin/integrations/${key}`, { method: "DELETE", credentials: "include" });
    setBusy((b) => ({ ...b, [key]: false }));
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
    toast({ title: `${key} cleared` });
    await load();
  };

  const test = async (group: Group) => {
    const r = await fetch(`${API}/admin/integrations/test/${group}`, {
      method: "POST",
      credentials: "include",
    }).then((x) => x.json());
    toast({
      title: r.ok ? `Connected as @${r.username ?? "ok"}` : "Test failed",
      description: r.ok ? "Credentials valid" : r.error,
      variant: r.ok ? "default" : "destructive",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const groups = Object.keys(GROUP_META) as Group[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Key className="w-5 h-5" /> Integrations
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Manage all third-party API keys and credentials in one place. Values stored here override anything in environment secrets and survive across deploys.
        </p>
      </div>

      {groups.map((g) => {
        const meta = GROUP_META[g];
        const groupKeys = keys.filter((k) => k.group === g);
        if (!groupKeys.length) return null;
        return (
          <Card key={g} className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{meta.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.blurb}</p>
              </div>
              {meta.testable && (
                <Button size="sm" variant="outline" onClick={() => test(g)}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Test
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {groupKeys.map((k) => {
                const draft = drafts[k.key];
                const dirty = draft !== undefined;
                const showReveal = reveal[k.key];
                return (
                  <div key={k.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        {k.label}
                        <code className="text-[10px] text-muted-foreground font-normal">{k.key}</code>
                        {k.set ? (
                          <Badge variant={k.source === "db" ? "default" : "secondary"} className="text-[10px]">
                            {k.source === "db" ? "saved" : "from env"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                            <AlertCircle className="w-3 h-3 mr-1" /> not set
                          </Badge>
                        )}
                      </label>
                      <div className="flex gap-1">
                        {k.secret && k.set && (
                          <Button size="icon" variant="ghost" onClick={() => setReveal((r) => ({ ...r, [k.key]: !r[k.key] }))}>
                            {showReveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        {k.set && (
                          <Button size="icon" variant="ghost" onClick={() => clear(k.key)} disabled={busy[k.key]}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type={k.secret && !showReveal ? "password" : "text"}
                        value={dirty ? draft : ""}
                        placeholder={k.set ? (showReveal ? k.preview : "•".repeat(12)) : "Enter value…"}
                        onChange={(e) => setDrafts((d) => ({ ...d, [k.key]: e.target.value }))}
                        className="font-mono text-sm"
                      />
                      {dirty && (
                        <Button size="sm" onClick={() => save(k.key)} disabled={busy[k.key]}>
                          {busy[k.key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                          Save
                        </Button>
                      )}
                    </div>
                    {k.hint && <p className="text-xs text-muted-foreground">{k.hint}</p>}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
