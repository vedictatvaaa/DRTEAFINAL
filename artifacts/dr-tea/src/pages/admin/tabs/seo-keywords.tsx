import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface KeywordRow {
  id: number;
  term: string;
  market: string;
  createdAt: string;
  latest: { position: number | null; url: string; checkedAt: string } | null;
  targets: Array<{ id: number; entityKind: string; entityRef: string; intent: string; priority: number }>;
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

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

export default function SeoKeywordsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState("");
  const [posInput, setPosInput] = useState<Record<number, string>>({});

  const reload = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ keywords: KeywordRow[] }>("/admin/seo-pro/keywords");
      setRows(d.keywords);
    } catch (e) {
      toast({ title: "Failed to load keywords", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line

  const create = async () => {
    if (!term.trim()) return;
    try {
      await apiFetch("/admin/seo-pro/keywords", { method: "POST", body: JSON.stringify({ term }) });
      setTerm("");
      reload();
    } catch (e) {
      toast({ title: "Could not add keyword", description: String(e), variant: "destructive" });
    }
  };

  const del = async (id: number) => {
    if (!confirm("Remove this keyword and all of its tracked ranks?")) return;
    await apiFetch(`/admin/seo-pro/keywords/${id}`, { method: "DELETE" });
    reload();
  };

  const logRank = async (id: number) => {
    const raw = posInput[id];
    if (!raw) return;
    const n = raw.toLowerCase() === "n/a" ? null : Number(raw);
    if (raw && n !== null && (Number.isNaN(n) || n < 1 || n > 200)) {
      toast({ title: "Invalid position (1-200 or n/a)", variant: "destructive" });
      return;
    }
    try {
      await apiFetch("/admin/seo-pro/keywords/rank", {
        method: "POST",
        body: JSON.stringify({ keywordId: id, position: n, source: "manual" }),
      });
      setPosInput((s) => ({ ...s, [id]: "" }));
      reload();
    } catch (e) {
      toast({ title: "Could not log rank", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Target keyword tracker</h2>
        <p className="text-xs text-muted-foreground">
          Add the keywords you care about ranking for. Log positions manually (or wire up a
          SERP API in the Integrations tab). Map each keyword to the page that should rank for it.
        </p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. best masala chai online india" />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <Card className="p-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {rows.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No keywords tracked yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2">Keyword</th>
                <th className="py-2">Market</th>
                <th className="py-2">Latest position</th>
                <th className="py-2">Checked</th>
                <th className="py-2">Targets</th>
                <th className="py-2">Log rank</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="py-2 font-medium">{r.term}</td>
                  <td className="py-2">{r.market}</td>
                  <td className="py-2">{r.latest?.position ?? <span className="text-muted-foreground">n/a</span>}</td>
                  <td className="py-2 text-xs text-muted-foreground">{fmtDate(r.latest?.checkedAt)}</td>
                  <td className="py-2 text-xs">
                    {r.targets.length === 0
                      ? <span className="text-muted-foreground">—</span>
                      : r.targets.map((t) => `${t.entityKind}#${t.entityRef}`).join(", ")}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      <Input
                        className="h-8 w-20"
                        value={posInput[r.id] ?? ""}
                        onChange={(e) => setPosInput((s) => ({ ...s, [r.id]: e.target.value }))}
                        placeholder="1-200"
                      />
                      <Button size="sm" variant="outline" onClick={() => logRank(r.id)}>Log</Button>
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => del(r.id)}>Remove</Button>
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
