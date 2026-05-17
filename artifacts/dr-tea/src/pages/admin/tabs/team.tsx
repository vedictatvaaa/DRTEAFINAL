import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  Eye,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API = `${import.meta.env.BASE_URL}api`;

type Role = "owner" | "admin" | "staff";
type Status = "active" | "invited" | "revoked";

interface Member {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: Status;
  invitedByEmail: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  inviteExpiresAt: string | null;
}

interface MeResp {
  email: string;
  role: Role;
  isOwner: boolean;
}

const ROLE_META: Record<Role, { icon: typeof Crown; label: string; cls: string }> = {
  owner: { icon: Crown, label: "Owner", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  admin: { icon: Shield, label: "Admin", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  staff: { icon: Eye, label: "Staff", cls: "bg-stone-100 text-stone-700 border-stone-300" },
};

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  invited: { label: "Invited", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  revoked: { label: "Revoked", cls: "bg-stone-100 text-stone-500 border-stone-300" },
};

function relative(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

export default function TeamTab() {
  const qc = useQueryClient();
  const me = useQuery<MeResp>({
    queryKey: ["admin-team-me"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/team/me`, { credentials: "include" });
      if (!r.ok) throw new Error("me");
      return r.json();
    },
  });
  const list = useQuery<{ items: Member[] }>({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/team`, { credentials: "include" });
      if (!r.ok) throw new Error("list");
      return r.json();
    },
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    role: Role;
    token: string;
  } | null>(null);

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: Role }) => {
      const r = await fetch(`${API}/admin/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "update failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-team"] }),
  });

  const revoke = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API}/admin/team/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "revoke failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-team"] }),
  });

  const isOwner = me.data?.isOwner ?? false;
  const isStaff = me.data?.role === "staff";

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a2416]">Team & roles</h1>
          <p className="mt-1 text-sm text-stone-600">
            Multiple operators, role-based access, attributed audit trail. The store owner can always log in with the master password.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => list.refetch()}
            disabled={list.isFetching}
            data-testid="button-team-refresh"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {!isStaff ? (
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              data-testid="button-team-invite-open"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite member
            </Button>
          ) : null}
        </div>
      </header>

      {me.data ? (
        <Card className="border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-500">Signed in as</div>
              <div className="text-sm font-medium text-[#1a2416]">{me.data.email}</div>
            </div>
            <RoleBadge role={me.data.role} />
          </div>
        </Card>
      ) : null}

      <Card className="border-stone-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading team…
          </div>
        ) : list.isError ? (
          <div className="p-6 text-sm text-red-700">Failed to load team.</div>
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-sm text-stone-500">
            <Users className="mx-auto mb-2 h-8 w-8 text-stone-300" />
            No team members yet. Invite your first operator.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.data!.items.map((m) => (
                <tr key={m.id} data-testid={`row-team-${m.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#3a5a2c] text-sm font-semibold uppercase text-amber-100">
                        {(m.name || m.email).slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[#1a2416]">
                          {m.name || "—"}
                        </div>
                        <div className="truncate text-xs text-stone-500">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!isStaff && m.status === "active" ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          updateRole.mutate({ id: m.id, role: e.target.value as Role })
                        }
                        disabled={
                          updateRole.isPending ||
                          (m.role === "owner" && !isOwner)
                        }
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
                        data-testid={`select-role-${m.id}`}
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        <option value="owner" disabled={!isOwner}>
                          Owner
                        </option>
                      </select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_META[m.status].cls}>
                      {STATUS_META[m.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">
                    {relative(m.lastSeenAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isStaff && m.status !== "revoked" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Revoke ${m.email}?`)) revoke.mutate(m.id);
                        }}
                        disabled={revoke.isPending || (m.role === "owner" && !isOwner)}
                        className="text-stone-500 hover:text-red-700"
                        data-testid={`button-revoke-${m.id}`}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {lastInvite ? (
        <InviteSuccess invite={lastInvite} onClose={() => setLastInvite(null)} />
      ) : null}
      {inviteOpen ? (
        <InviteModal
          isOwner={isOwner}
          onClose={() => setInviteOpen(false)}
          onSent={(invite) => {
            setInviteOpen(false);
            setLastInvite(invite);
            qc.invalidateQueries({ queryKey: ["admin-team"] });
          }}
        />
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const v = ROLE_META[role];
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${v.cls}`}>
      <Icon className="h-3 w-3" />
      {v.label}
    </Badge>
  );
}

function InviteModal({
  isOwner,
  onClose,
  onSent,
}: {
  isOwner: boolean;
  onClose: () => void;
  onSent: (i: { email: string; role: Role; token: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/team/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim(), role }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Invite failed");
      }
      return r.json() as Promise<{ user: Member; inviteToken: string }>;
    },
    onSuccess: (data) => {
      onSent({ email: data.user.email, role: data.user.role, token: data.inviteToken });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md border-stone-200 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1a2416]">Invite team member</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@brand.com"
              data-testid="input-invite-email"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Name (optional)</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asha Rao"
              data-testid="input-invite-name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(["staff", "admin", "owner"] as Role[]).map((r) => {
                const meta = ROLE_META[r];
                const Icon = meta.icon;
                const disabled = r === "owner" && !isOwner;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={disabled}
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition ${
                      role === r
                        ? "border-[#1a2416] bg-stone-50"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    } ${disabled ? "opacity-40" : ""}`}
                    data-testid={`button-role-${r}`}
                  >
                    <Icon className="h-4 w-4 text-[#3a5a2c]" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!email.trim() || send.isPending}
              onClick={() => {
                setError(null);
                send.mutate();
              }}
              data-testid="button-invite-send"
            >
              {send.isPending ? "Inviting…" : "Send invite"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InviteSuccess({
  invite,
  onClose,
}: {
  invite: { email: string; role: Role; token: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${import.meta.env.BASE_URL}admin/accept-invite?token=${invite.token}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg border-amber-300 bg-amber-50 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1a2416]">Invite ready to share</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-stone-700">
          Send this one-time link to <span className="font-medium">{invite.email}</span> as a{" "}
          <span className="font-medium">{ROLE_META[invite.role].label}</span>. They'll choose their own password. The link expires in 7 days.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-stone-200 bg-white p-2">
          <code className="flex-1 truncate font-mono text-xs text-stone-700">{link}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            data-testid="button-copy-invite"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
}
