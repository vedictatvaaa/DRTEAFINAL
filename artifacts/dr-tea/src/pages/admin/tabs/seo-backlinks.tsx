import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Status = "live" | "lost" | "pending" | "nofollow";

interface Backlink {
  id: number;
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchor: string;
  domainAuthority: number | null;
  status: Status;
  notes: string;
  firstSeenAt: string;
  lastCheckedAt: string | null;
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

function statusColor(s: Status): string {
  if (s === "live") return "text-emerald-600";
  if (s === "lost") return "text-destructive";
  if (s === "nofollow") return "text-amber-600";
  return "text-muted-foreground";
}

export default function SeoBacklinksTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Backlink[]>([]);
  const [form, setForm] = useState({ sourceUrl: "", targetUrl: "", anchor: "", domainAuthority: "" });

  const reload = async () => {
    try {
      const d = await apiFetch<{ backlinks: Backlink[] }>("/admin/seo-pro/backlinks");
      setRows(d.backlinks);
    } catch (e) {
      toast({ title: "Failed to load backlinks", description: String(e), variant: "destructive" });
    }
  };
  useEffect(() => { reload(); }, []); // eslint-disable-line

  const create = async () => {
    if (!form.sourceUrl || !form.targetUrl) return;
    try {
      await apiFetch("/admin/seo-pro/backlinks", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: form.sourceUrl,
          targetUrl: form.targetUrl,
          anchor: form.anchor,
          domainAuthority: form.domainAuthority ? Number(form.domainAuthority) : null,
        }),
      });
      setForm({ sourceUrl: "", targetUrl: "", anchor: "", domainAuthority: "" });
      reload();
    } catch (e) {
      toast({ title: "Could not add backlink", description: String(e), variant: "destructive" });
    }
  };

  const patch = async (id: number, body: Partial<Pick<Backlink, "status" | "anchor" | "notes" | "domainAuthority">>) => {
    await apiFetch(`/admin/seo-pro/backlinks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  };
  const del = async (id: number) => {
    if (!confirm("Remove this backlink?")) return;
    await apiFetch(`/admin/seo-pro/backlinks/${id}`, { method: "DELETE" });
    reload();
  };

  const live = rows.filter((r) => r.status === "live").length;
  const avgDr = rows.filter((r) => typeof r.domainAuthority === "number").length > 0
    ? Math.round(
        rows.reduce((a, r) => a + (r.domainAuthority ?? 0), 0) /
        Math.max(1, rows.filter((r) => typeof r.domainAuthority === "number").length),
      )
    : null;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Backlink ledger</h2>
          <div className="text-xs text-muted-foreground">
            {rows.length} total · {live} live · avg DR {avgDr ?? "—"}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Track every inbound link you build or earn. Status flips help spot lost links so you can
          win them back fast.
        </p>
        <form className="grid sm:grid-cols-5 gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <Input placeholder="Source URL (https://…)" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className="sm:col-span-2" />
          <Input placeholder="Target URL on drtea.in" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} />
          <Input placeholder="Anchor text" value={form.anchor} onChange={(e) => setForm({ ...form, anchor: e.target.value })} />
          <div className="flex gap-2">
            <Input placeholder="DR" value={form.domainAuthority} onChange={(e) => setForm({ ...form, domainAuthority: e.target.value })} className="w-16" />
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backlinks logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2">Source</th>
                <th className="py-2">Target</th>
                <th className="py-2">Anchor</th>
                <th className="py-2">DR</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline">{r.sourceDomain}</a>
                  </td>
                  <td className="py-2 text-xs truncate max-w-[180px]">{r.targetUrl}</td>
                  <td className="py-2 text-xs">{r.anchor || "—"}</td>
                  <td className="py-2">{r.domainAuthority ?? "—"}</td>
                  <td className="py-2">
                    <select
                      value={r.status}
                      onChange={(e) => patch(r.id, { status: e.target.value as Status })}
                      className={`h-7 px-1 text-xs border rounded bg-background ${statusColor(r.status)}`}
                    >
                      <option value="pending">pending</option>
                      <option value="live">live</option>
                      <option value="lost">lost</option>
                      <option value="nofollow">nofollow</option>
                    </select>
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
