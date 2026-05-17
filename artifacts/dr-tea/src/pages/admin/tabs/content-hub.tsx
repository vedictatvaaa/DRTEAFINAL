import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  Trash2,
  ImagePlus,
  ExternalLink,
} from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

type Hub = "pairing" | "wellness" | "regional";

interface Entry {
  id: number;
  slug: string;
  hub: Hub;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  hero: string;
  authorType: "admin" | "ai";
  status: "approved" | "pending" | "rejected";
  published: boolean;
  viewCount: number;
  createdAt: string;
}

const HUB_LABEL: Record<Hub, { label: string; path: string; tone: string }> = {
  pairing: {
    label: "Pairings",
    path: "/pairings",
    tone: "bg-rose-100 text-rose-900",
  },
  wellness: {
    label: "Wellness",
    path: "/wellness",
    tone: "bg-emerald-100 text-emerald-900",
  },
  regional: {
    label: "Tea Culture",
    path: "/tea-culture",
    tone: "bg-amber-100 text-amber-900",
  },
};

export default function ContentHubTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hubFilter, setHubFilter] = useState<"all" | Hub>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/content-hub/list`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows((await r.json()) as Entry[]);
    } catch (err) {
      toast({
        title: "Couldn't load Content Hub",
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

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (hubFilter === "all" || r.hub === hubFilter) &&
          (statusFilter === "all" || r.status === statusFilter),
      ),
    [rows, hubFilter, statusFilter],
  );

  async function action(
    id: number,
    path: string,
    method: "POST" | "DELETE" = "POST",
    okMsg = "Done",
  ) {
    try {
      const r = await fetch(`${API}/admin/content-hub/${id}${path}`, {
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
      const r = await fetch(`${API}/admin/content-hub/generate-now`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await r.json()) as {
        ok: boolean;
        created?: number;
        skipped?: boolean;
        perHub?: Record<Hub, number>;
      };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (data.skipped) {
        toast({ title: "Daily quota already met for today" });
      } else {
        toast({
          title: `Generated ${data.created ?? 0} drafts`,
          description: data.perHub
            ? `pairing ${data.perHub.pairing} · wellness ${data.perHub.wellness} · regional ${data.perHub.regional}`
            : undefined,
        });
      }
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

  const counts = useMemo(() => {
    const c = {
      total: rows.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      byHub: { pairing: 0, wellness: 0, regional: 0 } as Record<Hub, number>,
    };
    for (const r of rows) {
      c[r.status] += 1;
      c.byHub[r.hub] += 1;
    }
    return c;
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#1a2416]">Content Hub</h2>
          <p className="text-sm text-[#1a2416]/65 mt-1 max-w-xl">
            AI drafts <strong>10 entries every day</strong> across Pairings,
            Wellness, and Tea Culture — with auto-generated hero images, viral
            social hashtags, and keyword-rich SEO meta. Approve to publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={() => void generateNow()}
            disabled={busy}
            className="bg-[#1a2416] hover:bg-[#1a2416]/90 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {busy ? "Generating…" : "Generate now"}
          </Button>
        </div>
      </header>

      {/* Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Total" value={counts.total} />
        <Stat label="Pending" value={counts.pending} tone="amber" />
        <Stat label="Pairings" value={counts.byHub.pairing} />
        <Stat label="Wellness" value={counts.byHub.wellness} />
        <Stat label="Tea Culture" value={counts.byHub.regional} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="All hubs"
          active={hubFilter === "all"}
          onClick={() => setHubFilter("all")}
        />
        {(Object.keys(HUB_LABEL) as Hub[]).map((h) => (
          <FilterChip
            key={h}
            label={HUB_LABEL[h].label}
            active={hubFilter === h}
            onClick={() => setHubFilter(h)}
          />
        ))}
        <span className="mx-2 h-5 w-px bg-[#1a2416]/15" />
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <FilterChip
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-[#1a2416]/10 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#1a2416]/55">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[#1a2416]/55">
            No entries match this filter.
          </div>
        ) : (
          <ul className="divide-y divide-[#1a2416]/8">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center"
              >
                <div className="w-24 h-16 rounded-lg overflow-hidden bg-[#1a2416]/5 flex-shrink-0">
                  {e.hero ? (
                    <img
                      src={e.hero}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#1a2416]/30 text-xs">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded ${HUB_LABEL[e.hub].tone}`}
                    >
                      {HUB_LABEL[e.hub].label}
                    </span>
                    {e.category && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#1a2416]/55">
                        {e.category}
                      </span>
                    )}
                    <StatusPill status={e.status} />
                    {e.authorType === "ai" && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-violet-700">
                        AI draft
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-[#1a2416] truncate">
                    {e.title}
                  </p>
                  <p className="text-xs text-[#1a2416]/60 line-clamp-1 mt-0.5">
                    {e.summary}
                  </p>
                  {e.tags && e.tags.length > 0 && (
                    <p className="text-[10px] text-amber-800 mt-1 truncate">
                      {e.tags.filter((t) => t.startsWith("#")).slice(0, 6).join(" ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(`${HUB_LABEL[e.hub].path}/${e.slug}`, "_blank")
                    }
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void action(
                        e.id,
                        "/regenerate-image",
                        "POST",
                        "Image regenerated",
                      )
                    }
                    title="Regenerate hero image"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                  </Button>
                  {e.status !== "approved" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        void action(e.id, "/approve", "POST", "Published")
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Publish
                    </Button>
                  )}
                  {e.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void action(e.id, "/reject", "POST", "Rejected")
                      }
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${e.title}"? This cannot be undone.`,
                        )
                      ) {
                        void action(e.id, "", "DELETE", "Deleted");
                      }
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber";
}) {
  return (
    <div className="bg-white rounded-xl border border-[#1a2416]/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#1a2416]/55">
        {label}
      </p>
      <p
        className={`text-2xl font-serif mt-1 ${tone === "amber" ? "text-amber-700" : "text-[#1a2416]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-[#1a2416] text-white border-[#1a2416]"
          : "bg-white text-[#1a2416] border-[#1a2416]/12 hover:border-[#1a2416]/35"
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({
  status,
}: {
  status: "approved" | "pending" | "rejected";
}) {
  const map = {
    approved: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-900",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded ${map[status]}`}
    >
      {status}
    </span>
  );
}
