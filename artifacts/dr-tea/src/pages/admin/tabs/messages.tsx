import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Loader2,
  Mail,
  AlertCircle,
  StickyNote,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const API = `${import.meta.env.BASE_URL}api`;

interface Overview {
  counts: { open: number; pending: number; resolved: number; spam: number };
  unread: number;
  total: number;
}
interface Conversation {
  id: number;
  contactName: string;
  contactEmail: string;
  subject: string;
  channel: "web" | "email" | "whatsapp" | "instagram";
  status: "open" | "pending" | "resolved" | "spam";
  priority: "low" | "normal" | "high" | "urgent";
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  orderId: number | null;
  unreadByAdmin: boolean;
  lastMessageAt: string;
  lastMessagePreview: string;
  createdAt: string;
}
interface Message {
  id: number;
  sender: "customer" | "admin" | "system";
  senderName: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

async function get<T>(p: string): Promise<T> {
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

const STATUSES = ["all", "open", "pending", "resolved", "spam"] as const;

export default function MessagesTab() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const overview = useQuery({
    queryKey: ["msgs-overview"],
    queryFn: () => get<Overview>("/admin/messages/overview"),
  });
  const list = useQuery({
    queryKey: ["msgs", statusFilter],
    queryFn: () =>
      get<{ items: Conversation[] }>(
        statusFilter === "all"
          ? "/admin/messages"
          : `/admin/messages?status=${statusFilter}`,
      ),
  });
  const filtered = useMemo(() => {
    const items = list.data?.items ?? [];
    const q = search.toLowerCase().trim();
    return q
      ? items.filter(
          (c) =>
            c.subject.toLowerCase().includes(q) ||
            c.contactEmail.toLowerCase().includes(q) ||
            c.contactName.toLowerCase().includes(q) ||
            c.lastMessagePreview.toLowerCase().includes(q),
        )
      : items;
  }, [list.data, search]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#1a2416]">Messages</h1>
        <p className="text-sm text-stone-600">
          Unified inbox for all customer conversations.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Unread" value={overview.data?.unread ?? "—"} tone="warn" icon={AlertCircle} />
        <Stat label="Open" value={overview.data?.counts.open ?? "—"} />
        <Stat label="Pending" value={overview.data?.counts.pending ?? "—"} />
        <Stat label="Resolved" value={overview.data?.counts.resolved ?? "—"} />
        <Stat label="Total" value={overview.data?.total ?? "—"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wide ${
              statusFilter === s
                ? "bg-[#3a5a2c] text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {s}
          </button>
        ))}
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm ml-auto"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-0 overflow-hidden bg-white border-stone-200 lg:col-span-1 max-h-[70vh] overflow-y-auto">
          {list.isLoading && <div className="p-6 text-center text-stone-500">Loading…</div>}
          {!list.isLoading && filtered.length === 0 && (
            <div className="p-6 text-center text-stone-500">No conversations.</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 border-b border-stone-100 hover:bg-[#FAF8F4] ${
                selectedId === c.id ? "bg-[#FAF8F4]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-[#1a2416] truncate flex items-center gap-1">
                    {c.unreadByAdmin && (
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    )}
                    {c.subject || "(no subject)"}
                  </div>
                  <div className="text-xs text-stone-500 truncate">
                    {c.contactName} · {c.contactEmail}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize text-[10px] flex-shrink-0">
                  {c.channel}
                </Badge>
              </div>
              <div className="text-xs text-stone-600 mt-1 line-clamp-2">
                {c.lastMessagePreview}
              </div>
              <div className="text-[10px] text-stone-400 mt-1">
                {new Date(c.lastMessageAt).toLocaleString("en-IN")}
              </div>
            </button>
          ))}
        </Card>
        <div className="lg:col-span-2">
          {selectedId ? (
            <ConversationView
              id={selectedId}
              onChanged={() => {
                void list.refetch();
                void overview.refetch();
              }}
            />
          ) : (
            <Card className="p-8 text-center text-stone-500 bg-[#FAF8F4] border-stone-200">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-stone-400" />
              Select a conversation to view.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="p-4 bg-[#FAF8F4] border-stone-200">
      <div className="text-xs uppercase tracking-wide text-stone-500 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div
        className={`text-2xl font-bold mt-1 ${
          tone === "warn" && Number(value) > 0
            ? "text-amber-600"
            : "text-[#1a2416]"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

function ConversationView({
  id,
  onChanged,
}: {
  id: number;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["msg", id],
    queryFn: () =>
      get<{ conversation: Conversation; messages: Message[] }>(
        `/admin/messages/${id}`,
      ),
  });
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const sendReply = useMutation({
    mutationFn: () =>
      send("POST", `/admin/messages/${id}/reply`, {
        body: reply,
        isInternal: internal,
      }),
    onSuccess: () => {
      setReply("");
      void detail.refetch();
      onChanged();
    },
  });
  const setStatus = useMutation({
    mutationFn: (status: Conversation["status"]) =>
      send("PATCH", `/admin/messages/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["msg", id] });
      onChanged();
    },
  });
  const setPriority = useMutation({
    mutationFn: (priority: Conversation["priority"]) =>
      send("PATCH", `/admin/messages/${id}`, { priority }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["msg", id] });
      onChanged();
    },
  });

  if (detail.isLoading || !detail.data) {
    return (
      <Card className="p-6 bg-white border-stone-200 text-center text-stone-500">
        Loading…
      </Card>
    );
  }
  const c = detail.data.conversation;
  return (
    <Card className="p-0 bg-white border-stone-200 overflow-hidden">
      <div className="p-4 border-b border-stone-100 bg-[#FAF8F4]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-[#1a2416]">{c.subject || "(no subject)"}</h3>
            <div className="text-xs text-stone-600">
              {c.contactName} · <a className="underline" href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>
              {c.orderId && <> · order #{c.orderId}</>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={c.status}
              onChange={(e) => setStatus.mutate(e.target.value as Conversation["status"])}
              className="rounded border border-stone-200 px-2 py-1"
            >
              {(["open", "pending", "resolved", "spam"] as const).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={c.priority}
              onChange={(e) => setPriority.mutate(e.target.value as Conversation["priority"])}
              className="rounded border border-stone-200 px-2 py-1"
            >
              {(["low", "normal", "high", "urgent"] as const).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
        {detail.data.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-md p-3 ${
              m.isInternal
                ? "bg-amber-50 border border-amber-200"
                : m.sender === "admin"
                ? "bg-[#FAF8F4] border border-stone-200"
                : "bg-white border border-stone-200"
            }`}
          >
            <div className="text-xs text-stone-500 flex items-center gap-2 mb-1">
              {m.isInternal && <StickyNote className="h-3 w-3 text-amber-600" />}
              <span className="font-medium text-[#1a2416]">{m.senderName || m.sender}</span>
              <span>· {new Date(m.createdAt).toLocaleString("en-IN")}</span>
              {m.isInternal && <span className="text-amber-600">internal note</span>}
            </div>
            <div className="text-sm whitespace-pre-wrap text-[#1a2416]">{m.body}</div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-stone-100 space-y-2">
        <Textarea
          placeholder={internal ? "Internal note (not sent to customer)…" : "Reply to customer…"}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
        />
        {sendReply.isError && <div className="text-xs text-rose-600">{(sendReply.error as Error).message}</div>}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
            />
            Internal note
          </label>
          <Button
            onClick={() => sendReply.mutate()}
            disabled={!reply.trim() || sendReply.isPending}
            className="bg-[#3a5a2c] hover:bg-[#1a2416] text-white"
          >
            {sendReply.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : internal ? (
              <StickyNote className="h-4 w-4 mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            {internal ? "Save note" : "Send reply"}
          </Button>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50 text-xs text-stone-500 flex items-center gap-2">
        <Mail className="h-3 w-3" />
        Replies are recorded in the audit log. Email delivery to the customer requires Resend to be configured.
      </div>
    </Card>
  );
}
