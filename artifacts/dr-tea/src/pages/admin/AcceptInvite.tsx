import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/brand/Logo";

const API = `${import.meta.env.BASE_URL}api`;

interface InvitePeek {
  email: string;
  name: string;
  role: "owner" | "admin" | "staff";
  invitedByEmail: string | null;
  expiresAt: string | null;
}

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>("");
  const [peek, setPeek] = useState<InvitePeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") ?? "";
    setToken(t);
    if (!t) {
      setError("Missing invite token");
      setLoading(false);
      return;
    }
    fetch(`${API}/admin/team/invite/${encodeURIComponent(t)}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? "Invite not found");
        }
        return r.json();
      })
      .then((data: InvitePeek) => {
        setPeek(data);
        setName(data.name || "");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API}/admin/team/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to accept invite");
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] p-6">
      <Card className="w-full max-w-md border-stone-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <Logo />
          <span className="text-sm uppercase tracking-wide text-stone-500">Team invite</span>
        </div>

        {loading ? (
          <div className="flex items-center text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating invite…
          </div>
        ) : error && !peek ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : done ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <Check className="h-4 w-4" /> Account ready.
            </div>
            <p className="text-stone-600">
              You can now sign in with <span className="font-medium">{peek?.email}</span> and your new password.
            </p>
            <Button
              className="mt-2 w-full"
              onClick={() => setLocation("/admin")}
              data-testid="button-go-login"
            >
              Go to admin login
            </Button>
          </div>
        ) : peek ? (
          <div className="space-y-3 text-sm">
            <p className="text-stone-700">
              Hi! You've been invited as a{" "}
              <span className="font-medium capitalize">{peek.role}</span>{" "}
              {peek.invitedByEmail ? (
                <>by <span className="font-medium">{peek.invitedByEmail}</span></>
              ) : null}
              .
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Email</label>
              <Input value={peek.email} disabled />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Your name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha Rao"
                data-testid="input-accept-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Choose a password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                data-testid="input-accept-password"
              />
            </div>
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
            <Button
              className="w-full"
              disabled={submitting || !name.trim() || password.length < 8}
              onClick={submit}
              data-testid="button-accept-submit"
            >
              {submitting ? "Setting up…" : "Activate account"}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
