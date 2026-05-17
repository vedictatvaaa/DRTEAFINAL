import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  AlertTriangle,
  Package,
  MessageSquare,
  ShoppingBag,
  XCircle,
  X,
  ArrowRight,
  Check,
} from "lucide-react";

export type AlertTabId =
  | "overview"
  | "products"
  | "articles"
  | "teapedia"
  | "orders"
  | "payments"
  | "backup"
  | "seo"
  | "marketing"
  | "campaigns"
  | "analytics"
  | "community"
  | "content"
  | "experience";

interface AdminAlert {
  key: string;
  category: "inventory" | "moderation" | "submission" | "order" | "failed_order";
  severity: "high" | "medium" | "low";
  title: string;
  body: string;
  tabId?: AlertTabId;
  createdAt: string;
}

interface AlertsResponse {
  alerts: AdminAlert[];
  lastSeenAt: string;
  unreadCount: number;
  total: number;
}

interface AlertsBellProps {
  onNavigate: (tabId: AlertTabId) => void;
}

const ALERTS_URL = `${import.meta.env.BASE_URL}api/admin/alerts`;

const CATEGORY_ICON: Record<AdminAlert["category"], typeof Bell> = {
  inventory: Package,
  moderation: MessageSquare,
  submission: MessageSquare,
  order: ShoppingBag,
  failed_order: XCircle,
};

const SEVERITY_TONE: Record<
  AdminAlert["severity"],
  { dot: string; chip: string }
> = {
  high: { dot: "bg-red-500", chip: "bg-red-50 text-red-700 border-red-200" },
  medium: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  low: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AlertsBell({ onNavigate }: AlertsBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<AlertsResponse>({
    queryKey: ["admin-alerts"],
    queryFn: async () => {
      const res = await fetch(ALERTS_URL, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load alerts");
      return res.json();
    },
    refetchInterval: 45_000,
    staleTime: 20_000,
  });

  const unreadCount = data?.unreadCount ?? 0;
  const alerts = data?.alerts ?? [];

  const seen = useMutation({
    mutationFn: async () => {
      await fetch(`${ALERTS_URL}/seen`, {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-alerts"] });
    },
  });

  const dismiss = useMutation({
    mutationFn: async (key: string) => {
      await fetch(`${ALERTS_URL}/dismiss`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-alerts"] });
    },
  });

  // When opening, mark all as seen (after a beat so the badge briefly registers).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (unreadCount > 0) seen.mutate();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click + Esc + Tab focus trap.
  // Also restores focus to the bell trigger when the panel closes.
  useEffect(() => {
    if (!open) return;
    // Move initial focus into the panel for keyboard users.
    requestAnimationFrame(() => closeBtnRef.current?.focus());

    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      // Restore focus to the bell button when the panel closes.
      buttonRef.current?.focus?.();
    };
  }, [open]);

  function handleClick(a: AdminAlert) {
    if (a.tabId) {
      onNavigate(a.tabId);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-md text-[#1a2416]/70 hover:text-[#1a2416] hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
        aria-label={
          unreadCount > 0
            ? `Open alerts — ${unreadCount} unread`
            : "Open alerts"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="button-open-alerts"
      >
        <Bell className="w-4 h-4" strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none flex items-center justify-center ring-2 ring-[#FAF8F4]"
            data-testid="badge-alerts-unread"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Alerts"
          className="absolute right-0 top-full mt-2 w-[360px] sm:w-[400px] max-h-[min(70vh,560px)] rounded-xl bg-white border border-black/10 shadow-2xl overflow-hidden flex flex-col z-[90]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-[#1a2416]/65" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1a2416]/75">
                Alerts
              </p>
              <span className="text-[11px] text-[#1a2416]/45">
                {data?.total ?? 0} active
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => refetch()}
                className="text-[11px] text-[#1a2416]/55 hover:text-[#1a2416] px-2 py-1 rounded hover:bg-black/5"
              >
                Refresh
              </button>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded text-[#1a2416]/55 hover:text-[#1a2416] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                aria-label="Close alerts"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-8 text-center text-[12px] text-[#1a2416]/50">
                Loading alerts…
              </div>
            )}
            {!isLoading && alerts.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Check className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                <p className="text-[13px] text-[#1a2416]/75 font-medium">
                  All clear
                </p>
                <p className="text-[11px] text-[#1a2416]/45 mt-1">
                  No alerts need your attention right now.
                </p>
              </div>
            )}
            {alerts.map((a) => {
              const Icon = CATEGORY_ICON[a.category] ?? AlertTriangle;
              const tone = SEVERITY_TONE[a.severity];
              return (
                <div
                  key={a.key}
                  className="group relative px-4 py-3 border-b border-black/5 hover:bg-[#1a2416]/[0.03] transition-colors"
                  data-testid={`alert-${a.key}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-[#1a2416]/65" />
                      <span
                        className={`absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full ring-2 ring-white ${tone.dot}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleClick(a)}
                          disabled={!a.tabId}
                          className="text-left text-[12.5px] font-medium text-[#1a2416] leading-snug hover:underline decoration-[#3a5a2c] underline-offset-2 disabled:no-underline disabled:cursor-default"
                        >
                          {a.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss.mutate(a.key)}
                          className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 rounded text-[#1a2416]/55 hover:text-[#1a2416] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                          aria-label={`Dismiss ${a.title}`}
                          data-testid={`button-dismiss-${a.key}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11.5px] text-[#1a2416]/60 mt-0.5 line-clamp-2">
                        {a.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${tone.chip}`}
                        >
                          {a.severity}
                        </span>
                        <span className="text-[10px] text-[#1a2416]/40">
                          {timeAgo(a.createdAt)}
                        </span>
                        {a.tabId && (
                          <button
                            type="button"
                            onClick={() => handleClick(a)}
                            className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#3a5a2c] hover:underline"
                          >
                            Open <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
