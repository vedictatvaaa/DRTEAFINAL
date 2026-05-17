import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Search,
  ArrowRight,
  Loader2,
  X,
  Command,
  Lightbulb,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Play,
  Wrench,
  XCircle,
} from "lucide-react";

export type CopilotTabId =
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

interface CopilotToolCall {
  name: string;
  description?: string;
  params: Record<string, unknown>;
}

interface CopilotToolResult {
  name: string;
  ok: boolean;
  message?: string;
  data?: unknown;
}

type ExecuteStepState = "pending" | "running" | "done" | "failed";

interface CopilotIntent {
  kind: "navigate" | "search" | "answer" | "action" | "plan" | "error";
  title?: string;
  reason?: string;
  tabId?: CopilotTabId;
  entity?: "products" | "orders" | "customers" | "articles" | "campaigns";
  query?: string;
  answer?: string;
  bullets?: string[];
  metric?: { label: string; value: string };
  description?: string;
  confirmHint?: string;
  suggestedTab?: CopilotTabId;
  plan?: CopilotToolCall[];
}

interface CopilotResult {
  intent: CopilotIntent;
  usedFallback: boolean;
}

const SUGGESTIONS = [
  "Revenue last 7 days",
  "Low stock products",
  "How many customers do I have",
  "Open marketing",
  "Mark order 1234 as shipped",
  "Mark all alerts as read",
];

const RECENT_KEY = "drtea.copilot.recent";

interface CopilotPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tabId: CopilotTabId) => void;
}

export default function CopilotPalette({ open, onClose, onNavigate }: CopilotPaletteProps) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [result, setResult] = useState<CopilotResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Load recent on open + remember caller's focus for restoration.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setRecent(Array.isArray(parsed) ? parsed.slice(0, 6) : []);
    } catch {
      setRecent([]);
    }
    setQuery("");
    setResult(null);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      // Restore focus to the trigger when the palette closes.
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Esc to close + Tab focus trap inside the modal.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ask = useMutation<CopilotResult, Error, string>({
    mutationFn: async (q: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/copilot/intent`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Co-pilot failed (${res.status})`);
      }
      return (await res.json()) as CopilotResult;
    },
    onSuccess: (data, q) => {
      setResult(data);
      setExecResults(null);
      try {
        const next = [q, ...recent.filter((r) => r !== q)].slice(0, 6);
        setRecent(next);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    },
  });

  const [execResults, setExecResults] = useState<CopilotToolResult[] | null>(
    null,
  );
  const [execStatus, setExecStatus] = useState<
    "success" | "partial" | "failed" | null
  >(null);

  const execute = useMutation<
    { results: CopilotToolResult[]; status: "success" | "partial" | "failed" },
    Error,
    { plan: CopilotToolCall[]; query: string }
  >({
    mutationFn: async (input) => {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/copilot/execute`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Execute failed (${res.status})`);
      }
      return (await res.json()) as {
        results: CopilotToolResult[];
        status: "success" | "partial" | "failed";
      };
    },
    onSuccess: (data) => {
      setExecResults(data.results);
      setExecStatus(data.status);
    },
  });

  function submit(q?: string) {
    const value = (q ?? query).trim();
    if (!value) return;
    setQuery(value);
    setResult(null);
    setExecResults(null);
    setExecStatus(null);
    execute.reset();
    ask.mutate(value);
  }

  function runPlan(plan: CopilotToolCall[]) {
    setExecResults(null);
    setExecStatus(null);
    execute.mutate({ plan, query });
  }

  function executeIntent(intent: CopilotIntent) {
    if (intent.kind === "navigate" && intent.tabId) {
      onNavigate(intent.tabId);
      onClose();
      return;
    }
    if (intent.kind === "search" && intent.tabId) {
      onNavigate(intent.tabId);
      onClose();
      return;
    }
    if (intent.kind === "search" && !intent.tabId && intent.entity) {
      const map: Record<string, CopilotTabId> = {
        products: "products",
        orders: "orders",
        customers: "community",
        articles: "articles",
        campaigns: "campaigns",
      };
      onNavigate(map[intent.entity] ?? "overview");
      onClose();
      return;
    }
    if (intent.kind === "action" && intent.suggestedTab) {
      onNavigate(intent.suggestedTab);
      onClose();
      return;
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 sm:px-6 pt-16 sm:pt-24"
      onMouseDown={(e) => {
        // close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Admin co-pilot"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1a2416]/55 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl rounded-2xl bg-white border border-black/10 shadow-2xl overflow-hidden"
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-black/8">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask anything — e.g. 'revenue this week' or 'open campaigns'"
            className="flex-1 bg-transparent text-[14px] text-[#1a2416] placeholder:text-[#1a2416]/40 focus:outline-none"
            data-testid="copilot-input"
          />
          {ask.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#3a5a2c]" />
          ) : (
            <button
              type="button"
              onClick={() => submit()}
              disabled={!query.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#1a2416] text-amber-200 text-[11px] font-semibold uppercase tracking-wider hover:bg-[#1a2416]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Ask <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#1a2416]/55 hover:bg-black/5 hover:text-[#1a2416]"
            aria-label="Close co-pilot"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Result */}
          {result && (
            <ResultCard
              intent={result.intent}
              usedFallback={result.usedFallback}
              onExecute={executeIntent}
              onRunPlan={runPlan}
              isRunning={execute.isPending}
              execResults={execResults}
              execStatus={execStatus}
              execError={
                execute.isError ? (execute.error as Error)?.message : null
              }
              onClose={onClose}
            />
          )}

          {/* Error */}
          {ask.isError && (
            <div className="px-5 py-4 text-[13px] text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{(ask.error as Error)?.message ?? "Something went wrong."}</span>
            </div>
          )}

          {/* Empty state — suggestions + recent */}
          {!result && !ask.isPending && !ask.isError && (
            <div className="px-4 sm:px-5 py-4 space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#1a2416]/45 mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3" /> Try asking
                </p>
                <ul className="space-y-1">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => submit(s)}
                        className="w-full text-left px-3 py-2 rounded-md text-[13px] text-[#1a2416]/85 hover:bg-[#1a2416]/[0.04] hover:text-[#1a2416] flex items-center gap-2 group"
                      >
                        <Search className="w-3.5 h-3.5 text-[#1a2416]/35 group-hover:text-[#3a5a2c]" />
                        <span className="flex-1">{s}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#1a2416]/25 group-hover:text-[#1a2416]/55 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {recent.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#1a2416]/45 mb-2">
                    Recent
                  </p>
                  <ul className="space-y-1">
                    {recent.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => submit(s)}
                          className="w-full text-left px-3 py-2 rounded-md text-[13px] text-[#1a2416]/70 hover:bg-[#1a2416]/[0.04] hover:text-[#1a2416] truncate"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-black/8 bg-[#FAF8F4] flex items-center justify-between text-[10.5px] text-[#1a2416]/55">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Co-pilot — beta
          </span>
          <span className="flex items-center gap-2">
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-black/10 font-mono text-[10px]">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
            to open ·
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-black/10 font-mono text-[10px]">
              Esc
            </kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Result card — renders one of five intent kinds
// ─────────────────────────────────────────────────────────────────────────

function ResultCard({
  intent,
  usedFallback,
  onExecute,
  onRunPlan,
  isRunning,
  execResults,
  execStatus,
  execError,
  onClose,
}: {
  intent: CopilotIntent;
  usedFallback: boolean;
  onExecute: (i: CopilotIntent) => void;
  onRunPlan: (plan: CopilotToolCall[]) => void;
  isRunning: boolean;
  execResults: CopilotToolResult[] | null;
  execStatus: "success" | "partial" | "failed" | null;
  execError: string | null;
  onClose: () => void;
}) {
  const kindStyles: Record<CopilotIntent["kind"], string> = {
    navigate: "bg-emerald-50 text-emerald-900 border-emerald-200",
    search: "bg-blue-50 text-blue-900 border-blue-200",
    answer: "bg-[#FAF8F4] text-[#1a2416] border-[#1a2416]/10",
    action: "bg-amber-50 text-amber-900 border-amber-200",
    plan: "bg-[#1a2416]/[0.04] text-[#1a2416] border-[#3a5a2c]/30",
    error: "bg-red-50 text-red-900 border-red-200",
  };
  const kindLabel: Record<CopilotIntent["kind"], string> = {
    navigate: "Navigate",
    search: "Search",
    answer: "Answer",
    action: "Action",
    plan: "Action plan",
    error: "Couldn't understand",
  };

  const showCta =
    (intent.kind === "navigate" && !!intent.tabId) ||
    (intent.kind === "search" && (!!intent.tabId || !!intent.entity)) ||
    (intent.kind === "action" && !!intent.suggestedTab);

  return (
    <div className={`m-3 sm:m-4 rounded-xl border p-4 sm:p-5 ${kindStyles[intent.kind]}`}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold opacity-60">
            {kindLabel[intent.kind]}
          </span>
          {usedFallback && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 border border-current/15 opacity-70">
              local match
            </span>
          )}
        </div>
        {intent.kind !== "error" && (
          <span className="inline-flex items-center gap-1 text-[10px] opacity-60">
            <CheckCircle2 className="w-3 h-3" /> Routed
          </span>
        )}
      </div>

      {intent.title && (
        <h3 className="font-serif text-[18px] leading-tight mb-1">{intent.title}</h3>
      )}

      {intent.metric && (
        <div className="mt-3 mb-2 flex items-baseline gap-2 flex-wrap">
          <span className="font-serif text-[28px] font-bold tabular-nums leading-none">
            {intent.metric.value}
          </span>
          <span className="text-[11px] uppercase tracking-wider opacity-60">
            {intent.metric.label}
          </span>
        </div>
      )}

      {intent.answer && (
        <p className="text-[13px] leading-relaxed opacity-85 mt-2">{intent.answer}</p>
      )}

      {intent.description && (
        <p className="text-[13px] leading-relaxed opacity-85 mt-2">{intent.description}</p>
      )}

      {intent.bullets && intent.bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[12.5px] opacity-85">
          {intent.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="opacity-50">·</span>
              <span className="flex-1">{b}</span>
            </li>
          ))}
        </ul>
      )}

      {intent.confirmHint && (
        <p className="text-[11.5px] mt-3 opacity-70 italic">
          {intent.confirmHint}
        </p>
      )}

      {intent.reason && (
        <p className="text-[11px] mt-3 opacity-55">{intent.reason}</p>
      )}

      {showCta && (
        <div className="mt-4 pt-3 border-t border-current/10">
          <button
            type="button"
            onClick={() => onExecute(intent)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1a2416] text-amber-200 text-[11px] font-semibold uppercase tracking-wider hover:bg-[#1a2416]/90 transition-colors"
            data-testid="copilot-execute"
          >
            {intent.kind === "navigate"
              ? "Open"
              : intent.kind === "search"
              ? "Open & search"
              : "Take me there"}{" "}
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {intent.kind === "plan" && intent.plan && intent.plan.length > 0 && (
        <PlanRunner
          plan={intent.plan}
          onRun={() => onRunPlan(intent.plan!)}
          isRunning={isRunning}
          results={execResults}
          status={execStatus}
          error={execError}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PlanRunner — confirmation card for the "plan" intent. Lists each tool
// call with its summary, lets the operator run or cancel, and renders
// per-step status icons + a final success/partial/failed banner once the
// /execute call returns.
// ─────────────────────────────────────────────────────────────────────────

function prettyParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      const val =
        typeof v === "string" || typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join(" · ");
}

function stateIcon(state: ExecuteStepState) {
  switch (state) {
    case "done":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case "failed":
      return <XCircle className="w-3.5 h-3.5 text-red-600" />;
    case "running":
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3a5a2c]" />;
    default:
      return <Wrench className="w-3.5 h-3.5 text-[#1a2416]/35" />;
  }
}

function PlanRunner({
  plan,
  onRun,
  isRunning,
  results,
  status,
  error,
  onClose,
}: {
  plan: CopilotToolCall[];
  onRun: () => void;
  isRunning: boolean;
  results: CopilotToolResult[] | null;
  status: "success" | "partial" | "failed" | null;
  error: string | null;
  onClose: () => void;
}) {
  // The backend runs steps sequentially but returns all results in one go,
  // so we can't show real-time per-step progress without streaming. Instead,
  // every step shows "running" while the request is in-flight, then maps to
  // the matching result.ok once the response lands.
  const stepStates: ExecuteStepState[] = plan.map((_, i) => {
    if (results) {
      const r = results[i];
      if (!r) return "pending";
      return r.ok ? "done" : "failed";
    }
    if (isRunning) return "running";
    return "pending";
  });

  const banner =
    status === "success"
      ? { tone: "bg-emerald-50 text-emerald-900 border-emerald-200", text: "All steps completed." }
      : status === "partial"
      ? { tone: "bg-amber-50 text-amber-900 border-amber-200", text: "Some steps failed — see details below." }
      : status === "failed"
      ? { tone: "bg-red-50 text-red-900 border-red-200", text: "Plan failed." }
      : null;

  return (
    <div className="mt-4 pt-3 border-t border-current/10">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold opacity-55 mb-2 flex items-center gap-1.5">
        <Wrench className="w-3 h-3" /> Steps · {plan.length}
      </p>
      <ol className="space-y-1.5">
        {plan.map((step, i) => {
          const result = results?.[i];
          return (
            <li
              key={`${step.name}-${i}`}
              className="rounded-md border border-current/10 bg-white/60 px-3 py-2"
              data-testid={`copilot-plan-step-${i}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5">{stateIcon(stepStates[i])}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium leading-snug">
                    {step.description ?? step.name}
                  </p>
                  <p className="text-[10.5px] mt-0.5 font-mono opacity-55 truncate">
                    {step.name}
                    {prettyParams(step.params) ? ` · ${prettyParams(step.params)}` : ""}
                  </p>
                  {result && (
                    <p
                      className={`text-[11.5px] mt-1 ${
                        result.ok ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {result.message ?? (result.ok ? "Done." : "Failed.")}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {banner && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${banner.tone}`}
          data-testid="copilot-plan-banner"
        >
          {banner.text}
        </div>
      )}

      {error && !banner && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 text-red-900 px-3 py-2 text-[12px] flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {!results ? (
          <>
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1a2416] text-amber-200 text-[11px] font-semibold uppercase tracking-wider hover:bg-[#1a2416]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="copilot-plan-run"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> Running…
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" /> Run plan
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider text-[#1a2416]/65 hover:bg-black/[0.04] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1a2416] text-amber-200 text-[11px] font-semibold uppercase tracking-wider hover:bg-[#1a2416]/90 transition-colors"
            data-testid="copilot-plan-done"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
