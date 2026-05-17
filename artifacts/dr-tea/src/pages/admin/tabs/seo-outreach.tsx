import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Status = "prospect" | "contacted" | "replied" | "secured" | "lost";

interface Outreach {
  id: number;
  prospectDomain: string;
  contactName: string;
  contactEmail: string;
  angle: string;
  ourUrl: string;
  status: Status;
  draft: string;
  lastTouchedAt: string | null;
  createdAt: string;
}

const STAGES: Status[] = ["prospect", "contacted", "replied", "secured", "lost"];

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

export default function SeoOutreachTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Outreach[]>([]);
  const [form, setForm] = useState({ prospectDomain: "", contactName: "", contactEmail: "", angle: "", ourUrl: "" });
  const [openId, setOpenId] = useState<number | null>(null);
  const [drafting, setDrafting] = useState<number | null>(null);

  const reload = async () => {
    const d = await apiFetch<{ outreach: Outreach[] }>("/admin/seo-pro/outreach");
    setRows(d.outreach);
  };
  useEffect(() => { reload().catch((e) => toast({ title: "Load failed", description: String(e), variant: "destructive" })); }, []); // eslint-disable-line

  const create = async () => {
    if (!form.prospectDomain) return;
    try {
      await apiFetch("/admin/seo-pro/outreach", { method: "POST", body: JSON.stringify(form) });
      setForm({ prospectDomain: "", contactName: "", contactEmail: "", angle: "", ourUrl: "" });
      reload();
    } catch (e) {
      toast({ title: "Could not add", description: String(e), variant: "destructive" });
    }
  };

  const setStatus = async (id: number, status: Status) => {
    await apiFetch(`/admin/seo-pro/outreach/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    reload();
  };

  const saveDraft = async (id: number, draft: string) => {
    await apiFetch(`/admin/seo-pro/outreach/${id}`, { method: "PATCH", body: JSON.stringify({ draft }) });
    reload();
  };

  const aiDraft = async (id: number) => {
    setDrafting(id);
    try {
      const d = await apiFetch<{ subject: string; body: string }>("/admin/seo-pro/outreach/draft", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      toast({ title: "Draft generated", description: d.subject });
      reload();
    } catch (e) {
      toast({ title: "AI draft failed", description: String(e), variant: "destructive" });
    } finally {
      setDrafting(null);
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this prospect?")) return;
    await apiFetch(`/admin/seo-pro/outreach/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Outreach pipeline</h2>
        <p className="text-xs text-muted-foreground">
          Track every link-building or PR prospect from "found them" to "secured". Use the AI
          drafter to write the first email so you can hit send fast.
        </p>
        <form className="grid sm:grid-cols-5 gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <Input placeholder="domain.com" value={form.prospectDomain} onChange={(e) => setForm({ ...form, prospectDomain: e.target.value })} />
          <Input placeholder="Contact name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <Input placeholder="Email (optional)" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <Input placeholder="Angle / why we're a fit" value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} />
          <div className="flex gap-2">
            <Input placeholder="Our URL" value={form.ourUrl} onChange={(e) => setForm({ ...form, ourUrl: e.target.value })} />
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Card>

      <div className="grid lg:grid-cols-5 gap-3">
        {STAGES.map((stage) => {
          const items = rows.filter((r) => r.status === stage);
          return (
            <Card key={stage} className="p-3 space-y-2 min-h-[120px]">
              <div className="flex items-center justify-between">
                <h3 className="font-medium capitalize text-sm">{stage}</h3>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <ul className="space-y-2">
                {items.map((r) => (
                  <li key={r.id} className="border rounded-md p-2 text-xs space-y-1">
                    <div className="flex justify-between items-start gap-1">
                      <p className="font-medium">{r.prospectDomain}</p>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => del(r.id)}>×</Button>
                    </div>
                    {r.contactName && <p className="text-muted-foreground">{r.contactName}</p>}
                    {r.angle && <p className="line-clamp-2 text-muted-foreground">{r.angle}</p>}
                    <div className="flex gap-1 flex-wrap">
                      {STAGES.filter((s) => s !== stage).map((s) => (
                        <button
                          key={s}
                          className="text-[10px] underline text-muted-foreground hover:text-foreground"
                          onClick={() => setStatus(r.id, s)}
                        >
                          → {s}
                        </button>
                      ))}
                    </div>
                    <button
                      className="text-[10px] underline text-muted-foreground hover:text-foreground"
                      onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    >
                      {openId === r.id ? "hide" : "draft"}
                    </button>
                    {openId === r.id && (
                      <div className="space-y-1 mt-1">
                        <Textarea
                          rows={6}
                          value={r.draft}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRows((cur) => cur.map((x) => x.id === r.id ? { ...x, draft: v } : x));
                          }}
                          onBlur={(e) => saveDraft(r.id, e.target.value)}
                          placeholder="Subject: …&#10;&#10;Body…"
                        />
                        <Button size="sm" variant="outline" disabled={drafting === r.id} onClick={() => aiDraft(r.id)}>
                          {drafting === r.id ? "Drafting…" : "AI draft ✨"}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
