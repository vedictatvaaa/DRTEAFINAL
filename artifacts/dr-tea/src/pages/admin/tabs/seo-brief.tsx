import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Kind = "product" | "article" | "teapedia" | "recipe" | "content-hub";

interface Brief {
  workingTitle: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  intent: string;
  searchPersona: string;
  outline: Array<{ h2: string; bullets: string[] }>;
  faqs: Array<{ q: string; a: string }>;
  internalLinkAnchors: string[];
  schemaToAdd: string[];
  primaryKeyword: string;
  semanticKeywords: string[];
  estimatedWordCount: number;
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

export default function SeoBriefTab() {
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind>("article");
  const [keyword, setKeyword] = useState("");
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);

  const generate = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setBrief(null);
    try {
      const r = await apiFetch<{ brief: Brief }>("/admin/seo-pro/brief", {
        method: "POST",
        body: JSON.stringify({ focusKeyword: keyword, kind, intent: intent || undefined }),
      });
      setBrief(r.brief);
    } catch (e) {
      toast({ title: "Brief generation failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt).then(() => toast({ title: "Copied" }));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-medium">AI content brief</h2>
        <p className="text-xs text-muted-foreground">
          Give the AI a target keyword. Get back a complete brief — title, meta, outline, FAQs,
          internal-link anchors, schema, and word count — ready to hand to Content Studio.
        </p>
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label>Page kind</Label>
            <select
              className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <option value="article">Journal article</option>
              <option value="teapedia">Teapedia entry</option>
              <option value="recipe">Recipe</option>
              <option value="content-hub">Content Hub</option>
              <option value="product">Product</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Focus keyword</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. health benefits of kashmiri kahwa" />
          </div>
          <Button onClick={generate} disabled={loading || !keyword.trim()}>
            {loading ? "Thinking…" : "Generate brief ✨"}
          </Button>
        </div>
        <div>
          <Label>Search intent (optional override)</Label>
          <Input value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="informational | commercial | …" />
        </div>
      </Card>

      {brief && (
        <Card className="p-4 space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="font-medium">{brief.workingTitle}</h3>
            <span className="text-xs text-muted-foreground">Intent: {brief.intent} · ~{brief.estimatedWordCount} words</span>
          </div>

          <Field label="Meta title" value={brief.metaTitle} onCopy={copy} />
          <Field label="Meta description" value={brief.metaDescription} onCopy={copy} />
          <Field label="Slug" value={brief.slug} onCopy={copy} mono />

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Search persona</p>
            <p className="text-sm">{brief.searchPersona}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Outline</p>
            <ol className="space-y-2 text-sm list-decimal pl-5">
              {brief.outline.map((sec, i) => (
                <li key={i}>
                  <p className="font-medium">{sec.h2}</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {sec.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">FAQs</p>
            <ul className="space-y-2 text-sm">
              {brief.faqs.map((f, i) => (
                <li key={i}>
                  <p className="font-medium">{f.q}</p>
                  <p className="text-muted-foreground">{f.a}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <PillList label="Internal-link anchors" items={brief.internalLinkAnchors} />
            <PillList label="Semantic keywords" items={brief.semanticKeywords} />
            <PillList label="Schema to add" items={brief.schemaToAdd} />
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => copy(JSON.stringify(brief, null, 2))}>
              Copy full brief as JSON
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, onCopy, mono }: { label: string; value: string; onCopy: (s: string) => void; mono?: boolean }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label} <span className="lowercase">({value.length})</span></p>
        <Button size="sm" variant="ghost" onClick={() => onCopy(value)}>Copy</Button>
      </div>
      <p className={`text-sm border rounded-md p-2 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function PillList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((s, i) => (
          <span key={i} className="text-xs border rounded-full px-2 py-0.5">{s}</span>
        ))}
      </div>
    </div>
  );
}
