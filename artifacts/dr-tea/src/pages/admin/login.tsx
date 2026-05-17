import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAdminLogin, useAdminMe, getAdminMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Logo from "@/components/brand/Logo";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();
  const me = useAdminMe();
  const login = useAdminLogin();
  const API = `${import.meta.env.BASE_URL}api`;

  useEffect(() => {
    if (me.data?.authenticated) {
      setLocation("/admin");
    }
  }, [me.data?.authenticated, setLocation]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0e1810] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, rgba(58,90,44,0.55) 0%, rgba(14,24,16,0) 60%), radial-gradient(45% 40% at 100% 100%, rgba(178,142,75,0.30) 0%, rgba(14,24,16,0) 60%)",
        }}
      />
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="px-5 pt-5 sm:px-8 sm:pt-7">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/60 hover:text-white transition-colors"
            data-testid="link-back-store"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to store
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-[420px]">
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-7 sm:p-9">
              <div className="flex justify-center mb-6">
                <div className="bg-white rounded-lg px-3 py-2">
                  <Logo className="h-8 w-auto" />
                </div>
              </div>
              <div className="text-center space-y-1.5 mb-7">
                <h1 className="text-[22px] font-serif tracking-tight">Admin Console</h1>
                <p className="text-[13px] text-white/55">
                  Sign in with the operator passcode to manage the store.
                </p>
              </div>
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSubmitting(true);
                  try {
                    if (email.trim()) {
                      // Team-member login goes through the same endpoint with
                      // an email + password body.
                      const r = await fetch(`${API}/admin/auth/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          email: email.trim().toLowerCase(),
                          password,
                        }),
                      });
                      if (!r.ok) throw new Error("bad");
                    } else {
                      await login.mutateAsync({ data: { password } });
                    }
                    await qc.invalidateQueries({ queryKey: getAdminMeQueryKey() });
                    setLocation("/admin");
                  } catch {
                    setError("Invalid credentials — please try again.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55"
                  >
                    Team email <span className="text-white/30 normal-case">(leave blank for owner passcode)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    className="bg-white/[0.06] border-white/15 text-white placeholder:text-white/30 h-11 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400/40"
                    placeholder="operator@brand.com"
                    data-testid="input-admin-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55"
                  >
                    Operator passcode
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <Input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="current-password"
                      className="bg-white/[0.06] border-white/15 text-white placeholder:text-white/30 pl-9 pr-10 h-11 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400/40"
                      placeholder="••••••••"
                      data-testid="input-admin-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/5 transition-colors"
                      aria-label={showPwd ? "Hide passcode" : "Show passcode"}
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="text-[12.5px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={submitting || login.isPending}
                  className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-[#0e1810] font-semibold tracking-wide focus-visible:ring-emerald-400/60"
                  data-testid="button-admin-signin"
                >
                  {submitting || login.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
              <p className="mt-6 text-center text-[11px] text-white/35">
                Single-operator console · session is browser-bound
              </p>
            </div>
            <p className="text-center text-[11px] text-white/35 mt-5">
              © Dr Tea — Crafted Tea &amp; Teaware
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
