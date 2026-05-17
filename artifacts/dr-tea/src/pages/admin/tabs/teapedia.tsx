import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  Trash2,
  Link2,
  BookOpen,
  ImageIcon,
  ImagePlus,
} from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

interface Entry {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  hero: string;
  authorType: "admin" | "ai";
  status: "approved" | "pending" | "rejected";
  published: boolean;
  viewCount: number;
  relatedProductIds: string[];
  createdAt: string;
}

export default function TeapediaTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/teapedia/list`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows((await r.json()) as Entry[]);
    } catch (err) {
      toast({
        title: "Couldn't load Teapedia",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(
    id: number,
    path: string,
    method: "POST" | "DELETE" = "POST",
    okMsg = "Done",
  ) {
    try {
      const r = await fetch(`${API}/admin/teapedia/${id}${path}`, {
        method,
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: okMsg });
      void load();
    } catch (err) {
      toast({
        title: "Action failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  }

  async function generateNow() {
    setBusy(true);
    try {
      const r = await fetch(`${API}/admin/teapedia/generate-now`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as {
        created?: number;
        skipped?: boolean;
      };
      toast({
        title: j.skipped
          ? "Today's quota already full"
          : `Generated ${j.created ?? 0} new entries`,
      });
      void load();
    } catch (err) {
      toast({
        title: "Generation failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function backfillImages() {
    setBusy(true);
    try {
      const r = await fetch(`${API}/admin/teapedia/backfill-images`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        processed?: number;
        succeeded?: number;
        failed?: number;
      };
      toast({
        title: `Generated ${j.succeeded ?? 0} hero images`,
        description:
          j.failed
            ? `${j.failed} failed — try again to retry.`
            : `${j.processed ?? 0} entries processed.`,
      });
      void load();
    } catch (err) {
      toast({
        title: "Image backfill failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function regenerateImage(id: number) {
    try {
      const r = await fetch(
        `${API}/admin/teapedia/${id}/regenerate-image`,
        { method: "POST", credentials: "include" },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: "New hero image generated" });
      void load();
    } catch (err) {
      toast({
        title: "Image generation failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  }

  async function relink() {
    setBusy(true);
    try {
      const r = await fetch(`${API}/admin/teapedia/relink`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { updated?: number };
      toast({ title: `Refreshed product links on ${j.updated ?? 0} entries` });
      void load();
    } catch (err) {
      toast({
        title: "Relink failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const rejected = rows.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif font-semibold inline-flex items-center gap-2">
            <BookOpen className="w-6 h-6" /> Teapedia — SEO growth engine
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Daily AI-generated tea encyclopedia entries that auto-link to your
            product catalog, included in sitemap.xml and pinged to Google/Bing.
            One-click publish from here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </Button>
          <Button variant="outline" onClick={relink} disabled={busy}>
            <Link2 className="w-4 h-4 mr-2" /> Refresh product links
          </Button>
          <Button variant="outline" onClick={backfillImages} disabled={busy}>
            <ImagePlus className="w-4 h-4 mr-2" />
            {busy ? "Generating…" : "Generate missing images"}
          </Button>
          <Button onClick={generateNow} disabled={busy}>
            <Sparkles className="w-4 h-4 mr-2" />
            {busy ? "Generating…" : "Generate 5 new entries"}
          </Button>
        </div>
      </div>

      <Section title={`Pending review (${pending.length})`} empty="No pending entries.">
        {pending.map((e) => (
          <EntryRow key={e.id} entry={e} onAction={action} onRegenerateImage={regenerateImage} />
        ))}
      </Section>
      <Section title={`Published (${approved.length})`} empty="No published entries yet.">
        {approved.map((e) => (
          <EntryRow key={e.id} entry={e} onAction={action} onRegenerateImage={regenerateImage} />
        ))}
      </Section>
      {rejected.length > 0 && (
        <Section title={`Rejected (${rejected.length})`} empty="">
          {rejected.map((e) => (
            <EntryRow key={e.id} entry={e} onAction={action} onRegenerateImage={regenerateImage} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const hasItems = arr.filter(Boolean).length > 0;
  return (
    <section>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {hasItems ? (
        <div className="grid gap-3">{children}</div>
      ) : empty ? (
        <p className="text-sm text-muted-foreground italic">{empty}</p>
      ) : null}
    </section>
  );
}

function EntryRow({
  entry,
  onAction,
  onRegenerateImage,
}: {
  entry: Entry;
  onAction: (
    id: number,
    path: string,
    method?: "POST" | "DELETE",
    okMsg?: string,
  ) => void;
  onRegenerateImage: (id: number) => void;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card flex flex-wrap items-start justify-between gap-3">
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
        {entry.hero ? (
          <img
            src={entry.hero}
            alt={entry.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
            {entry.category}
          </span>
          <span className="text-[10px] uppercase text-muted-foreground">
            {entry.authorType === "ai" ? "AI draft" : "Admin"}
          </span>
          {entry.published && (
            <span className="text-[10px] uppercase text-emerald-700">Published</span>
          )}
          {entry.relatedProductIds?.length ? (
            <span className="text-[10px] uppercase text-amber-700">
              {entry.relatedProductIds.length} product link
              {entry.relatedProductIds.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {entry.viewCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {entry.viewCount} views
            </span>
          )}
        </div>
        <h4 className="font-serif font-semibold text-base leading-snug">
          {entry.title}
        </h4>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {entry.summary}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRegenerateImage(entry.id)}
          title={entry.hero ? "Regenerate hero image" : "Generate hero image"}
        >
          <ImagePlus className="w-3 h-3 mr-1" />
          {entry.hero ? "New image" : "Add image"}
        </Button>
        {entry.published && (
          <a
            href={`/teapedia/${entry.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline self-center text-muted-foreground"
          >
            View
          </a>
        )}
        {entry.status !== "approved" && (
          <Button size="sm" onClick={() => onAction(entry.id, "/approve", "POST", "Published")}>
            <CheckCircle2 className="w-3 h-3 mr-1" /> Publish
          </Button>
        )}
        {entry.status !== "rejected" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(entry.id, "/reject", "POST", "Rejected")}
          >
            <XCircle className="w-3 h-3 mr-1" /> Reject
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (confirm(`Delete "${entry.title}"?`)) {
              onAction(entry.id, "", "DELETE", "Deleted");
            }
          }}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
