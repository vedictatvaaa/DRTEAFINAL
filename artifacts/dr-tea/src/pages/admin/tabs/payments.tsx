import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ProviderInfo {
  key: string;
  label: string;
  configured: boolean;
  publishableKey: string | null;
}
interface SettingsResponse {
  activeProvider: string;
  codEnabled: boolean;
  codLabel: string;
  paidLabel: string;
  updatedAt: string;
  providers: ProviderInfo[];
}

const API = `${import.meta.env.BASE_URL}api/admin/payments/settings`;

export default function PaymentsTab() {
  const { toast } = useToast();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeProvider, setActiveProvider] = useState("razorpay");
  const [codEnabled, setCodEnabled] = useState(true);
  const [codLabel, setCodLabel] = useState("Cash on Delivery");
  const [paidLabel, setPaidLabel] = useState("UPI / Card / Netbanking");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      const j = (await r.json()) as SettingsResponse;
      setData(j);
      setActiveProvider(j.activeProvider);
      setCodEnabled(j.codEnabled);
      setCodLabel(j.codLabel);
      setPaidLabel(j.paidLabel);
    } catch {
      toast({ title: "Couldn't load payment settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider, codEnabled, codLabel, paidLabel }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast({ title: "Save failed", description: j?.error ?? "Try again", variant: "destructive" });
      } else {
        toast({ title: "Payment settings updated" });
        await load();
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading payment settings…
      </div>
    );
  }

  const activeInfo = data.providers.find((p) => p.key === activeProvider);
  const activeConfigured = activeInfo?.configured ?? false;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-serif text-xl font-semibold">Payment gateways</h2>
        <p className="text-[12px] text-muted-foreground mt-1">
          Pick the active payment provider customers see at checkout. Sensitive API keys live in environment
          variables — providers without keys appear disabled here.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Available providers</h3>
          <div className="space-y-2">
            {data.providers.map((p) => (
              <label
                key={p.key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  activeProvider === p.key ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30"
                } ${p.configured ? "" : "opacity-60 cursor-not-allowed"}`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.key}
                  checked={activeProvider === p.key}
                  onChange={() => p.configured && setActiveProvider(p.key)}
                  disabled={!p.configured}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[14px]">{p.label}</span>
                    {p.configured ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" /> Missing keys
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Provider key: <code className="px-1 py-0.5 bg-muted rounded">{p.key}</code>
                    {p.publishableKey && (
                      <> · Publishable: <code className="px-1 py-0.5 bg-muted rounded">{p.publishableKey.slice(0, 12)}…</code></>
                    )}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {!activeConfigured && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mt-3">
              The selected provider is missing its API keys. Add the relevant env secrets and restart the API server
              before activating it on the storefront.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider">Cash on Delivery</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} />
          <span className="text-[13px]">Allow customers to pay cash on delivery</span>
        </label>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider">Storefront labels</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Online payment label</span>
            <input
              value={paidLabel}
              onChange={(e) => setPaidLabel(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">COD label</span>
            <input
              value={codLabel}
              onChange={(e) => setCodLabel(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
            />
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : "Save changes"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Active: <span className="font-medium text-foreground">{data.activeProvider}</span>
          {" · "}Last updated: {new Date(data.updatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
