import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { pushPublicKey, pushSubscribe } from "@workspace/api-client-react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

const DISMISS_KEY = "drtea_push_optin_dismissed_at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export default function PushOptIn() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) {
      setDismissed(true);
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let cancelled = false;
    (async () => {
      try {
        const meta = await pushPublicKey();
        if (cancelled) return;
        if (!meta.enabled || !meta.publicKey) return;
        setEnabled(true);
        setPublicKey(meta.publicKey);
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) setSubscribed(true);
        else setDismissed(false);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast({ title: "Notifications blocked", description: "You can re-enable them in your browser settings." });
        setDismissed(true);
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await pushSubscribe({
        endpoint: json.endpoint ?? sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      setSubscribed(true);
      toast({ title: "You're on the list", description: "We'll only ping you when something special is brewing." });
    } catch {
      toast({ title: "Couldn't enable notifications", description: "Try again from your browser settings." });
    } finally {
      setBusy(false);
    }
  };

  if (!enabled || subscribed || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40 max-w-xs rounded-lg border bg-background shadow-lg p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-100 p-2 text-amber-700">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Letters from the tea garden</div>
          <p className="mt-1 text-xs text-muted-foreground">
            A gentle ping when new small-batch arrivals drop. Two or three a month, never more.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={subscribe} disabled={busy}>{busy ? "Asking…" : "Enable"}</Button>
            <Button size="sm" variant="ghost" onClick={() => {
              localStorage.setItem(DISMISS_KEY, String(Date.now()));
              setDismissed(true);
            }}>Not now</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
