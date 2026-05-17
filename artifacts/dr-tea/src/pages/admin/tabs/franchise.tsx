import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Search,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

type FranchiseStatus = "new" | "contacted" | "qualified" | "rejected" | "signed";
type FranchiseFormat = "kiosk" | "cafe" | "flagship";
type FranchiseInvestment = "10-25L" | "25-50L" | "50L-1Cr" | "1Cr+";

interface Application {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  investmentRange: FranchiseInvestment;
  preferredFormat: FranchiseFormat;
  experience: string;
  message: string;
  status: FranchiseStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface Overview {
  total: number;
  newLastWeek: number;
  byStatus: { status: FranchiseStatus; count: number }[];
  byFormat: { format: FranchiseFormat; count: number }[];
  byInvestment: { investmentRange: FranchiseInvestment; count: number }[];
  recent: Application[];
}

const STATUS_META: Record<
  FranchiseStatus,
  { label: string; chip: string }
> = {
  new: { label: "New", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  contacted: { label: "Contacted", chip: "bg-blue-50 text-blue-800 border-blue-200" },
  qualified: {
    label: "Qualified",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  rejected: { label: "Rejected", chip: "bg-stone-100 text-stone-600 border-stone-200" },
  signed: { label: "Signed", chip: "bg-[#1a2416] text-white border-[#1a2416]" },
};

const FORMAT_LABEL: Record<FranchiseFormat, string> = {
  kiosk: "Kiosk",
  cafe: "Café",
  flagship: "Flagship",
};

async function getJson<T>(p: string): Promise<T> {
  const r = await fetch(`${API}${p}`, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}
async function send<T>(method: string, p: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${p}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export default function FranchiseTab() {
  const [pane, setPane] = useState<"overview" | "applications">("overview");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"all" | FranchiseStatus>("all");
  const [format, setFormat] = useState<"all" | FranchiseFormat>("all");
  const [investment, setInvestment] = useState<"all" | FranchiseInvestment>("all");
  const [open, setOpen] = useState<Application | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const overview = useQuery({
    queryKey: ["admin-franchise-overview"],
    queryFn: () => getJson<Overview>("/admin/franchise/overview"),
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (format !== "all") p.set("format", format);
    if (investment !== "all") p.set("investment", investment);
    if (debounced) p.set("q", debounced);
    return p.toString();
  }, [status, format, investment, debounced]);

  const list = useQuery({
    queryKey: ["admin-franchise", status, format, investment, debounced],
    queryFn: () =>
      getJson<{ applications: Application[] }>(
        `/admin/franchise/applications${params ? `?${params}` : ""}`,
      ),
    enabled: pane === "applications",
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#1a2416]">Franchise applications</h1>
        <p className="text-sm text-stone-600">
          Lead pipeline for partners opening Dr Tea outlets — kiosks, cafés, and
          flagships.
        </p>
      </header>

      <div className="flex gap-1 border-b border-stone-200">
        {(
          [
            ["overview", "Overview"],
            ["applications", "All applications"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPane(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              pane === k
                ? "border-[#1a2416] text-[#1a2416]"
                : "border-transparent text-stone-500 hover:text-[#1a2416]"
            }`}
            data-testid={`tab-franchise-${k}`}
          >
            {l}
          </button>
        ))}
      </div>

      {pane === "overview" ? (
        <OverviewPane overview={overview.data} loading={overview.isLoading} onOpen={setOpen} />
      ) : (
        <ApplicationsPane
          q={q}
          setQ={setQ}
          status={status}
          setStatus={setStatus}
          format={format}
          setFormat={setFormat}
          investment={investment}
          setInvestment={setInvestment}
          rows={list.data?.applications ?? []}
          loading={list.isLoading}
          onOpen={setOpen}
        />
      )}

      {open && <DetailModal application={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#1a2416]">{value}</div>
      {hint && <div className="text-[12px] text-stone-500 mt-0.5">{hint}</div>}
    </Card>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-stone-400 italic">No data yet</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <li key={r.label}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-stone-700">{r.label}</span>
                  <span className="tabular-nums text-stone-500">
                    {r.count} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-[#3a5a2c]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function OverviewPane({
  overview,
  loading,
  onOpen,
}: {
  overview: Overview | undefined;
  loading: boolean;
  onOpen: (a: Application) => void;
}) {
  if (loading || !overview) {
    return <div className="text-sm text-stone-500">Loading…</div>;
  }
  const newCount =
    overview.byStatus.find((s) => s.status === "new")?.count ?? 0;
  const signed =
    overview.byStatus.find((s) => s.status === "signed")?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total applications" value={overview.total.toLocaleString("en-IN")} />
        <StatCard
          label="New (unworked)"
          value={newCount.toLocaleString("en-IN")}
          hint={newCount > 0 ? "Need first contact" : "Inbox clear"}
        />
        <StatCard label="Last 7 days" value={overview.newLastWeek.toLocaleString("en-IN")} />
        <StatCard label="Signed" value={signed.toLocaleString("en-IN")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BreakdownCard
          title="By status"
          rows={overview.byStatus.map((r) => ({
            label: STATUS_META[r.status].label,
            count: r.count,
          }))}
        />
        <BreakdownCard
          title="By format"
          rows={overview.byFormat.map((r) => ({
            label: FORMAT_LABEL[r.format],
            count: r.count,
          }))}
        />
        <BreakdownCard
          title="By investment"
          rows={overview.byInvestment.map((r) => ({
            label: r.investmentRange,
            count: r.count,
          }))}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-[#1a2416]">
            Recent applications
          </h2>
        </div>
        {overview.recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            <Building2 className="w-8 h-8 mx-auto text-stone-300 mb-2" />
            No applications yet.
          </div>
        ) : (
          <ApplicationsTable rows={overview.recent} onOpen={onOpen} />
        )}
      </Card>
    </div>
  );
}

function ApplicationsPane({
  q,
  setQ,
  status,
  setStatus,
  format,
  setFormat,
  investment,
  setInvestment,
  rows,
  loading,
  onOpen,
}: {
  q: string;
  setQ: (v: string) => void;
  status: "all" | FranchiseStatus;
  setStatus: (v: "all" | FranchiseStatus) => void;
  format: "all" | FranchiseFormat;
  setFormat: (v: "all" | FranchiseFormat) => void;
  investment: "all" | FranchiseInvestment;
  setInvestment: (v: "all" | FranchiseInvestment) => void;
  rows: Application[];
  loading: boolean;
  onOpen: (a: Application) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone, city"
            className="pl-9"
            data-testid="input-franchise-search"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-10 px-3 rounded-md border border-stone-200 bg-white text-sm"
          data-testid="select-franchise-status"
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_META) as FranchiseStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as typeof format)}
          className="h-10 px-3 rounded-md border border-stone-200 bg-white text-sm"
          data-testid="select-franchise-format"
        >
          <option value="all">All formats</option>
          {(Object.keys(FORMAT_LABEL) as FranchiseFormat[]).map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
        <select
          value={investment}
          onChange={(e) => setInvestment(e.target.value as typeof investment)}
          className="h-10 px-3 rounded-md border border-stone-200 bg-white text-sm"
          data-testid="select-franchise-investment"
        >
          <option value="all">All investments</option>
          {(["10-25L", "25-50L", "50L-1Cr", "1Cr+"] as const).map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-stone-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 mx-auto text-stone-300 mb-2" />
            <div className="text-sm text-stone-600">
              No applications match these filters.
            </div>
          </div>
        ) : (
          <ApplicationsTable rows={rows} onOpen={onOpen} />
        )}
      </Card>
    </div>
  );
}

function ApplicationsTable({
  rows,
  onOpen,
}: {
  rows: Application[];
  onOpen: (a: Application) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
            <th className="py-2 px-3">Applicant</th>
            <th className="py-2 px-3">Location</th>
            <th className="py-2 px-3">Format</th>
            <th className="py-2 px-3">Investment</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3 text-right">Received</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer"
              onClick={() => onOpen(a)}
              data-testid={`row-franchise-${a.id}`}
            >
              <td className="py-2 px-3">
                <div className="font-medium text-[#1a2416]">{a.fullName}</div>
                <div className="text-[12px] text-stone-500">{a.email}</div>
              </td>
              <td className="py-2 px-3 text-[13px]">
                {a.city}
                {a.state ? `, ${a.state}` : ""}
              </td>
              <td className="py-2 px-3 text-[13px] capitalize">
                {FORMAT_LABEL[a.preferredFormat]}
              </td>
              <td className="py-2 px-3 text-[13px] tabular-nums">
                {a.investmentRange}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`inline-flex items-center px-2 h-6 rounded text-[11px] font-medium border ${STATUS_META[a.status].chip}`}
                >
                  {STATUS_META[a.status].label}
                </span>
              </td>
              <td className="py-2 px-3 text-right text-[12px] text-stone-500 whitespace-nowrap">
                {new Date(a.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailModal({
  application,
  onClose,
}: {
  application: Application;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<FranchiseStatus>(application.status);

  const save = useMutation({
    mutationFn: () =>
      send<{ application: Application }>(
        "PATCH",
        `/admin/franchise/applications/${application.id}`,
        { status },
      ),
    onSuccess: () => {
      toast({ title: "Status updated" });
      void qc.invalidateQueries({ queryKey: ["admin-franchise"] });
      void qc.invalidateQueries({ queryKey: ["admin-franchise-overview"] });
      onClose();
    },
    onError: (err: Error) =>
      toast({
        title: "Could not update",
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <Modal title={application.fullName} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className={`border ${STATUS_META[application.status].chip}`}
          >
            {STATUS_META[application.status].label}
          </Badge>
          <Badge variant="secondary" className="bg-stone-100 text-stone-700">
            {FORMAT_LABEL[application.preferredFormat]}
          </Badge>
          <Badge variant="secondary" className="bg-stone-100 text-stone-700">
            {application.investmentRange}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Info icon={Mail} label="Email">
            <a
              href={`mailto:${application.email}`}
              className="text-[#3a5a2c] hover:underline inline-flex items-center gap-1"
            >
              {application.email} <ExternalLink className="w-3 h-3" />
            </a>
          </Info>
          <Info icon={Phone} label="Phone">
            <a
              href={`tel:${application.phone}`}
              className="text-[#3a5a2c] hover:underline"
            >
              {application.phone}
            </a>
          </Info>
          <Info icon={MapPin} label="Location">
            {application.city}
            {application.state ? `, ${application.state}` : ""}
          </Info>
          <Info icon={Calendar} label="Received">
            {new Date(application.createdAt).toLocaleString("en-IN")}
          </Info>
        </div>

        {application.experience && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Retail / F&amp;B experience
            </div>
            <div className="bg-stone-50 rounded p-3 text-[13px] whitespace-pre-wrap text-stone-700">
              {application.experience}
            </div>
          </div>
        )}
        {application.message && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Message
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded p-3 text-[13px] whitespace-pre-wrap text-stone-800">
              {application.message}
            </div>
          </div>
        )}

        <div>
          <label className="block text-[12px] font-semibold text-stone-700 mb-1">
            Move to status
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_META) as FranchiseStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 h-8 rounded-full text-[12px] font-medium border ${
                  status === s
                    ? STATUS_META[s].chip
                    : "bg-white text-stone-600 border-stone-200 hover:border-[#1a2416]/40"
                }`}
                data-testid={`button-status-${s}`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || status === application.status}
          className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
          data-testid="button-save-franchise-status"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-0.5 flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-stone-800">{children}</div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/50"
      />
      <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl p-5 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1a2416]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-[#1a2416] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
