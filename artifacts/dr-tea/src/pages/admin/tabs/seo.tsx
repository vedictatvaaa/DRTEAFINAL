import { useState } from "react";
import {
  useAdminSeoHealth,
  useAdminSeoHealthRefresh,
  useAdminSeoListPings,
  useAdminSeoPing,
  useAdminSeoGenerateProductMeta,
  useAdminSeoGenerateArticleMeta,
  useAdminSeoGenerateProductRelated,
  useAdminSeoGenerateArticleRelated,
  getAdminSeoHealthQueryKey,
  getAdminSeoListPingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import HomepageSeoSection from "./HomepageSeoSection";

function fmtMs(v?: number | null): string {
  if (v == null) return "—";
  if (v < 1000) return `${Math.round(v)}ms`;
  return `${(v / 1000).toFixed(2)}s`;
}

function fmtScore(v?: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}`;
}

function fmtDate(s?: string | null): string {
  if (!s) return "never";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function SeoTab() {
  const qc = useQueryClient();
  const health = useAdminSeoHealth();
  const pings = useAdminSeoListPings();
  const refresh = useAdminSeoHealthRefresh();
  const manualPing = useAdminSeoPing();
  const genProductMeta = useAdminSeoGenerateProductMeta();
  const genArticleMeta = useAdminSeoGenerateArticleMeta();
  const genProductRel = useAdminSeoGenerateProductRelated();
  const genArticleRel = useAdminSeoGenerateArticleRelated();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: getAdminSeoHealthQueryKey() });
    qc.invalidateQueries({ queryKey: getAdminSeoListPingsQueryKey() });
  };

  const h = health.data;

  return (
    <div className="space-y-6">
      <HomepageSeoSection />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">SEO Health</h2>
          <p className="text-xs text-muted-foreground">
            Last crawl: {fmtDate(h?.crawledAt)} · Last CWV fetch: {fmtDate(h?.cwvFetchedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={manualPing.isPending}
            onClick={async () => {
              const rows = await manualPing.mutateAsync();
              const ok = rows.filter((r) => r.status === "success").length;
              toast({ title: `Pinged search engines`, description: `${ok}/${rows.length} succeeded.` });
              qc.invalidateQueries({ queryKey: getAdminSeoListPingsQueryKey() });
            }}
          >
            Ping search engines
          </Button>
          <Button
            disabled={refresh.isPending}
            onClick={async () => {
              await refresh.mutateAsync();
              refreshAll();
              toast({ title: "Refreshed crawl & Core Web Vitals" });
            }}
          >
            {refresh.isPending ? "Refreshing…" : "Refresh health"}
          </Button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Products" value={h?.catalog.productCount ?? "—"} />
        <Stat label="Published articles" value={h?.catalog.articleCount ?? "—"} />
        <Stat
          label="Missing meta"
          value={
            (h?.catalog.productMissingMeta.length ?? 0) +
            (h?.catalog.articleMissingMeta.length ?? 0)
          }
          tone={
            (h?.catalog.productMissingMeta.length ?? 0) +
              (h?.catalog.articleMissingMeta.length ?? 0) >
            0
              ? "warn"
              : "ok"
          }
        />
        <Stat
          label="Broken links"
          value={h?.brokenLinks.length ?? "—"}
          tone={(h?.brokenLinks.length ?? 0) > 0 ? "warn" : "ok"}
        />
      </div>

      {/* Indexed-vs-unindexed proxy counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat
          label="Sitemap URLs"
          value={h?.indexable.totalUrls ?? "—"}
        />
        <Stat
          label="Indexable (has full meta)"
          value={h?.indexable.indexedCount ?? "—"}
          tone="ok"
        />
        <Stat
          label="Unindexable (missing meta)"
          value={h?.indexable.unindexedCount ?? "—"}
          tone={(h?.indexable.unindexedCount ?? 0) > 0 ? "warn" : "ok"}
        />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Indexable counts are local proxies — items appear in the sitemap and
        have meta + JSON-LD. Cross-check live indexing in Google Search Console.
      </p>

      {/* Missing meta — products */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Products missing meta or JSON-LD</h3>
          <span className="text-xs text-muted-foreground">
            {h?.catalog.productMissingMeta.length ?? 0} item(s)
          </span>
        </div>
        {h?.catalog.productMissingMeta.length === 0 ? (
          <p className="text-sm text-muted-foreground">All products have AI meta. ✓</p>
        ) : (
          <ul className="divide-y text-sm">
            {h?.catalog.productMissingMeta.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between">
                <span>
                  {p.name} <span className="text-muted-foreground">/{p.slug}</span>
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === `p:${p.id}`}
                    onClick={async () => {
                      setBusyId(`p:${p.id}`);
                      try {
                        await genProductMeta.mutateAsync({ id: p.id });
                        await genProductRel.mutateAsync({ id: p.id });
                        refreshAll();
                        toast({ title: `Meta + related generated for ${p.name}` });
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {busyId === `p:${p.id}` ? "Generating…" : "Generate"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Missing meta — articles */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Articles missing meta or JSON-LD</h3>
          <span className="text-xs text-muted-foreground">
            {h?.catalog.articleMissingMeta.length ?? 0} item(s)
          </span>
        </div>
        {h?.catalog.articleMissingMeta.length === 0 ? (
          <p className="text-sm text-muted-foreground">All articles have AI meta. ✓</p>
        ) : (
          <ul className="divide-y text-sm">
            {h?.catalog.articleMissingMeta.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between">
                <span>
                  {a.title} <span className="text-muted-foreground">/{a.slug}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === `a:${a.id}`}
                  onClick={async () => {
                    setBusyId(`a:${a.id}`);
                    try {
                      await genArticleMeta.mutateAsync({ id: a.id });
                      await genArticleRel.mutateAsync({ id: a.id });
                      refreshAll();
                      toast({ title: `Meta + related generated for "${a.title}"` });
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {busyId === `a:${a.id}` ? "Generating…" : "Generate"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Duplicate titles */}
      {((h?.catalog.duplicateProductTitles.length ?? 0) > 0 ||
        (h?.catalog.duplicateArticleTitles.length ?? 0) > 0) && (
        <Card className="p-4 space-y-3">
          <h3 className="font-medium">Duplicate titles</h3>
          <ul className="text-sm space-y-1">
            {h?.catalog.duplicateProductTitles.map((d) => (
              <li key={`p-${d.title}`}>
                <strong>{d.title}</strong> — products: {d.ids.join(", ")}
              </li>
            ))}
            {h?.catalog.duplicateArticleTitles.map((d) => (
              <li key={`a-${d.title}`}>
                <strong>{d.title}</strong> — articles: {d.ids.join(", ")}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Broken links */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Broken internal links</h3>
          <span className="text-xs text-muted-foreground">
            Crawled {h?.crawledUrlCount ?? 0} pages
          </span>
        </div>
        {(h?.brokenLinks.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {h?.crawledAt ? "No broken links found. ✓" : 'Click "Refresh health" to crawl.'}
          </p>
        ) : (
          <ul className="text-sm divide-y">
            {h?.brokenLinks.map((b, i) => (
              <li key={i} className="py-2 flex justify-between gap-3">
                <span className="truncate">{b.to}</span>
                <span className="text-destructive font-mono text-xs">{b.status || "ERR"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Core Web Vitals */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium">Core Web Vitals (mobile, via PageSpeed Insights)</h3>
        {(h?.cwv.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {h?.cwvFetchedAt
              ? "No CWV data yet."
              : 'Click "Refresh health" to fetch CWV for top URLs.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">URL</th>
                <th className="py-1">Perf</th>
                <th className="py-1">LCP</th>
                <th className="py-1">CLS</th>
                <th className="py-1">INP</th>
              </tr>
            </thead>
            <tbody>
              {h?.cwv.map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 truncate max-w-[300px]">{c.url}</td>
                  <td className="py-1">{fmtScore(c.performance)}</td>
                  <td className="py-1">{fmtMs(c.lcp)}</td>
                  <td className="py-1">{c.cls?.toFixed(3) ?? "—"}</td>
                  <td className="py-1">{fmtMs(c.inp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Ping log */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium">Search-engine ping log</h3>
        {(pings.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No pings recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">When</th>
                <th className="py-1">Target</th>
                <th className="py-1">Status</th>
                <th className="py-1">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {pings.data?.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="py-1">{fmtDate(row.createdAt)}</td>
                  <td className="py-1 capitalize">{row.target}</td>
                  <td className="py-1">
                    <span
                      className={
                        row.status === "success" ? "text-emerald-600" : "text-destructive"
                      }
                    >
                      {row.status}
                      {row.statusCode ? ` (${row.statusCode})` : ""}
                    </span>
                    {row.error ? (
                      <span className="ml-2 text-xs text-muted-foreground">{row.error}</span>
                    ) : null}
                  </td>
                  <td className="py-1">{row.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const color =
    tone === "warn"
      ? "text-amber-600"
      : tone === "ok"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-medium ${color}`}>{value}</p>
    </Card>
  );
}
