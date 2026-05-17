import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Dashboard {
  counts: { products: number; articles: number; backlinks: number; outreach: number; keywords: number };
  avgScore: number;
  opportunities: Array<{ kind: string; ref: string; title: string; score: number; topIssue: string }>;
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

function scoreColor(s: number): string {
  if (s >= 85) return "text-emerald-600";
  if (s >= 65) return "text-amber-600";
  return "text-destructive";
}

export default function SeoDashboardTab() {
  const { toast } = useToast();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<Dashboard>("/admin/seo-pro/dashboard");
      setData(d);
    } catch (e) {
      toast({ title: "Dashboard load failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const bulk = async (scope: "products" | "articles") => {
    setBusy(scope);
    try {
      const r = await apiFetch<{ done: number; failed: number }>("/admin/seo-pro/bulk", {
        method: "POST",
        body: JSON.stringify({ scope, action: "fill-missing-meta", limit: 25 }),
      });
      toast({ title: `Bulk fix: ${scope}`, description: `${r.done} fixed, ${r.failed} failed` });
      await load();
    } catch (e) {
      toast({ title: "Bulk fix failed", description: String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-medium">SEO command center</h2>
            <p className="text-xs text-muted-foreground">
              Site-wide on-page + off-page health at a glance. Open per-page editor, keywords,
              backlinks, outreach, or brief from the sidebar.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </Button>
        </div>
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-2">
            <Stat label="Avg page score" value={data.avgScore} score />
            <Stat label="Products" value={data.counts.products} />
            <Stat label="Articles" value={data.counts.articles} />
            <Stat label="Keywords tracked" value={data.counts.keywords} />
            <Stat label="Backlinks" value={data.counts.backlinks} />
            <Stat label="Outreach" value={data.counts.outreach} />
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-medium">One-click bulk fixes</h3>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" disabled={busy === "products"} onClick={() => bulk("products")}>
            {busy === "products" ? "Fixing…" : "Fill missing meta on products (25)"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy === "articles"} onClick={() => bulk("articles")}>
            {busy === "articles" ? "Fixing…" : "Fill missing meta on articles (25)"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-medium">Top opportunities (lowest-scoring pages)</h3>
        {!data || data.opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No improvement opportunities — every page scores ≥ 95. ✓</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2">Page</th>
                <th className="py-2">Kind</th>
                <th className="py-2">Score</th>
                <th className="py-2">Top issue</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.opportunities.map((o) => (
                <tr key={`${o.kind}:${o.ref}`} className="border-b last:border-0">
                  <td className="py-2 truncate max-w-[260px]">{o.title}</td>
                  <td className="py-2 text-xs text-muted-foreground">{o.kind}</td>
                  <td className={`py-2 font-medium ${scoreColor(o.score)}`}>{o.score}</td>
                  <td className="py-2 text-xs text-muted-foreground">{o.topIssue}</td>
                  <td className="py-2 text-right">
                    <a
                      href={`#seo-editor`}
                      className="text-xs underline"
                      onClick={() => {
                        try {
                          sessionStorage.setItem("seoEditor:kind", o.kind);
                          sessionStorage.setItem("seoEditor:ref", o.ref);
                        } catch { /* ignore */ }
                      }}
                    >
                      Open editor →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, score }: { label: string; value: number | string; score?: boolean }) {
  const cls = score && typeof value === "number" ? scoreColor(value) : "text-foreground";
  return (
    <div className="border rounded-md p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-2xl font-medium ${cls}`}>{value}</p>
    </div>
  );
}
