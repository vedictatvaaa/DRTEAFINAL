import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Kind = "product" | "article" | "teapedia" | "recipe" | "content-hub";

interface EntityOption {
  ref: string;
  label: string;
  slug: string;
}

interface Analysis {
  kind: Kind;
  ref: string;
  url: string | null;
  title: string;
  score: number;
  breakdown: Record<string, number>;
  issues: Array<{ code: string; severity: "info" | "warn" | "error"; message: string; fix?: string }>;
  quickFixes: Array<{ label: string; field: string; after: string }>;
  raw: {
    metaTitle: string;
    metaDescription: string;
    bodyWordCount: number;
    imageCount: number;
    imageMissingAlt: number;
    hasJsonLd: boolean;
    internalLinkCount: number;
    keywords: string[];
  };
}

interface Suggestion {
  text: string;
  rationale: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${r.status} ${txt}`);
  }
  return r.json();
}

const KIND_LABELS: Record<Kind, string> = {
  product: "Product",
  article: "Journal article",
  teapedia: "Teapedia entry",
  recipe: "Recipe",
  "content-hub": "Content Hub",
};

function scoreColor(s: number): string {
  if (s >= 85) return "text-emerald-600";
  if (s >= 65) return "text-amber-600";
  return "text-destructive";
}

function severityColor(sev: string): string {
  if (sev === "error") return "text-destructive";
  if (sev === "warn") return "text-amber-600";
  return "text-muted-foreground";
}

export default function SeoEditorTab() {
  const { toast } = useToast();
  const [entities, setEntities] = useState<Record<Kind, EntityOption[]> | null>(null);
  const [kind, setKind] = useState<Kind>("article");
  const [ref, setRef] = useState<string>("");
  const [focusKw, setFocusKw] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [linkPicks, setLinkPicks] = useState<Array<{ anchor: string; url: string; reason: string }> | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");

  useEffect(() => {
    apiFetch<Record<Kind, EntityOption[]>>("/admin/seo-pro/entities")
      .then((d) => {
        setEntities(d);
        // Honour deep-link from dashboard "Open editor" buttons.
        let pickedKind: Kind | null = null;
        let pickedRef: string | null = null;
        try {
          const k = sessionStorage.getItem("seoEditor:kind");
          const r = sessionStorage.getItem("seoEditor:ref");
          if (k && r && k in d) {
            pickedKind = k as Kind;
            pickedRef = r;
            sessionStorage.removeItem("seoEditor:kind");
            sessionStorage.removeItem("seoEditor:ref");
          }
        } catch { /* ignore */ }
        if (pickedKind && pickedRef) {
          setKind(pickedKind);
          setRef(pickedRef);
        } else {
          const firstList = d[kind] ?? [];
          if (firstList[0]) setRef(firstList[0].ref);
        }
      })
      .catch((e) => toast({ title: "Failed to load entities", description: String(e), variant: "destructive" }));
  }, []); // eslint-disable-line

  useEffect(() => {
    setAnalysis(null);
    setSuggestions({});
    setLinkPicks(null);
    setDraftTitle("");
    setDraftDesc("");
  }, [kind, ref]);

  const options = useMemo(() => entities?.[kind] ?? [], [entities, kind]);

  const analyze = async () => {
    if (!ref) return;
    setLoading(true);
    try {
      const a = await apiFetch<Analysis>("/admin/seo-pro/analyze", {
        method: "POST",
        body: JSON.stringify({ kind, ref, persist: true }),
      });
      setAnalysis(a);
      setDraftTitle(a.raw.metaTitle);
      setDraftDesc(a.raw.metaDescription);
    } catch (e) {
      toast({ title: "Analyze failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const suggest = async (field: "metaTitle" | "metaDescription" | "slug" | "h1" | "intro") => {
    if (!ref) return;
    setSuggesting(field);
    try {
      const r = await apiFetch<{ suggestions: Suggestion[] }>("/admin/seo-pro/suggest", {
        method: "POST",
        body: JSON.stringify({ kind, ref, field, focusKeyword: focusKw || undefined }),
      });
      setSuggestions((s) => ({ ...s, [field]: r.suggestions }));
    } catch (e) {
      toast({ title: "AI suggest failed", description: String(e), variant: "destructive" });
    } finally {
      setSuggesting(null);
    }
  };

  const apply = async () => {
    if (!analysis) return;
    try {
      await apiFetch("/admin/seo-pro/apply", {
        method: "POST",
        body: JSON.stringify({
          kind,
          ref,
          patch: { metaTitle: draftTitle, metaDescription: draftDesc },
        }),
      });
      toast({ title: "Saved" });
      await analyze();
    } catch (e) {
      toast({ title: "Save failed", description: String(e), variant: "destructive" });
    }
  };

  const loadLinks = async () => {
    try {
      const r = await apiFetch<{ picks: Array<{ anchor: string; url: string; reason: string }> }>(
        "/admin/seo-pro/internal-links",
        { method: "POST", body: JSON.stringify({ kind, ref }) },
      );
      setLinkPicks(r.picks);
    } catch (e) {
      toast({ title: "Link suggestion failed", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Per-page SEO editor</h2>
        <p className="text-xs text-muted-foreground">
          Pick any content item; see its live score with breakdown, get AI rewrites for each
          field, and apply with one click. Every analysis is logged for change-over-time tracking.
        </p>
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label>Kind</Label>
            <select
              className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              value={kind}
              onChange={(e) => {
                const k = e.target.value as Kind;
                setKind(k);
                const list = entities?.[k] ?? [];
                setRef(list[0]?.ref ?? "");
              }}
            >
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Item</Label>
            <select
              className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.ref} value={o.ref}>{o.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={analyze} disabled={loading || !ref}>
            {loading ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
        <div>
          <Label>Focus keyword (optional, sharpens AI suggestions)</Label>
          <Input
            value={focusKw}
            onChange={(e) => setFocusKw(e.target.value)}
            placeholder="e.g. assam masala chai online"
          />
        </div>
      </Card>

      {analysis && (
        <>
          <Card className="p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="font-medium">{analysis.title}</h3>
                {analysis.url && (
                  <a href={analysis.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">
                    {analysis.url}
                  </a>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className={`text-3xl font-medium ${scoreColor(analysis.score)}`}>{analysis.score}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 text-center">
              {Object.entries(analysis.breakdown).map(([k, v]) => (
                <div key={k} className="border rounded-md p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                  <p className={`text-sm font-medium ${scoreColor(v)}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Words" value={analysis.raw.bodyWordCount} />
              <Stat label="Images" value={`${analysis.raw.imageCount}${analysis.raw.imageMissingAlt ? ` (${analysis.raw.imageMissingAlt} no-alt)` : ""}`} />
              <Stat label="JSON-LD" value={analysis.raw.hasJsonLd ? "yes" : "no"} />
              <Stat label="Internal links" value={analysis.raw.internalLinkCount} />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-medium">Issues ({analysis.issues.length})</h3>
            {analysis.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues. ✓</p>
            ) : (
              <ul className="divide-y text-sm">
                {analysis.issues.map((i, idx) => (
                  <li key={idx} className="py-2 flex items-start justify-between gap-3">
                    <div>
                      <p className={severityColor(i.severity)}>
                        <span className="uppercase text-[10px] tracking-wide mr-2">{i.severity}</span>
                        {i.message}
                      </p>
                      {i.fix && <p className="text-xs text-muted-foreground mt-0.5">Fix: {i.fix}</p>}
                    </div>
                    <code className="text-[10px] text-muted-foreground">{i.code}</code>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="font-medium">Edit meta with AI guidance</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Meta title <span className="text-xs text-muted-foreground">({draftTitle.length} chars)</span></Label>
                <Button size="sm" variant="outline" disabled={suggesting === "metaTitle"} onClick={() => suggest("metaTitle")}>
                  {suggesting === "metaTitle" ? "Thinking…" : "AI rewrite ✨"}
                </Button>
              </div>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
              {suggestions.metaTitle && (
                <ul className="text-xs space-y-1 mt-1">
                  {suggestions.metaTitle.map((s, i) => (
                    <li key={i} className="border rounded-md p-2 flex justify-between gap-2">
                      <div>
                        <p>{s.text} <span className="text-muted-foreground">({s.text.length})</span></p>
                        {s.rationale && <p className="text-muted-foreground italic">{s.rationale}</p>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setDraftTitle(s.text)}>Use</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Meta description <span className="text-xs text-muted-foreground">({draftDesc.length} chars)</span></Label>
                <Button size="sm" variant="outline" disabled={suggesting === "metaDescription"} onClick={() => suggest("metaDescription")}>
                  {suggesting === "metaDescription" ? "Thinking…" : "AI rewrite ✨"}
                </Button>
              </div>
              <Textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} rows={3} />
              {suggestions.metaDescription && (
                <ul className="text-xs space-y-1 mt-1">
                  {suggestions.metaDescription.map((s, i) => (
                    <li key={i} className="border rounded-md p-2 flex justify-between gap-2">
                      <div>
                        <p>{s.text} <span className="text-muted-foreground">({s.text.length})</span></p>
                        {s.rationale && <p className="text-muted-foreground italic">{s.rationale}</p>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setDraftDesc(s.text)}>Use</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={apply}>Save changes</Button>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">AI internal link suggestions</h3>
              <Button size="sm" variant="outline" onClick={loadLinks}>Generate</Button>
            </div>
            {linkPicks && linkPicks.length === 0 && (
              <p className="text-sm text-muted-foreground">No suggestions returned.</p>
            )}
            {linkPicks && linkPicks.length > 0 && (
              <ul className="text-sm space-y-2">
                {linkPicks.map((p, i) => (
                  <li key={i} className="border rounded-md p-2">
                    <p className="font-medium">{p.anchor} → <a className="underline" href={p.url} target="_blank" rel="noreferrer">{p.url}</a></p>
                    <p className="text-xs text-muted-foreground">{p.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded-md p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
