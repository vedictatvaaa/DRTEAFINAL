import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export default function UpdatePrompt() {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<ServiceWorkerRegistration>).detail;
      if (detail) {
        setRegistration(detail);
        setDismissed(false);
      }
    };
    window.addEventListener("dr-tea:sw-update", onUpdate as EventListener);

    // Also check on mount in case the registration already has a waiting
    // worker (race: SW finished installing before this component mounted,
    // or the page was loaded with an already-waiting update).
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (cancelled || !reg) return;
        if (reg.waiting && navigator.serviceWorker.controller) {
          setRegistration(reg);
        }
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      cancelled = true;
      window.removeEventListener(
        "dr-tea:sw-update",
        onUpdate as EventListener,
      );
    };
  }, []);

  if (!registration || dismissed) return null;

  const handleRefresh = () => {
    const waiting = registration.waiting;
    try {
      sessionStorage.setItem("dr-tea:just-updated", "1");
    } catch {
      /* ignore */
    }
    if (waiting) {
      waiting.postMessage("SKIP_WAITING");
      // Fallback: if `controllerchange` doesn't fire (e.g. because the
      // SW didn't claim clients), force a reload after a short delay so
      // tapping Refresh always feels responsive. Cancel the timer when
      // controllerchange does fire to avoid a double reload.
      const timer = window.setTimeout(() => {
        window.location.reload();
      }, 1500);
      const onController = () => {
        window.clearTimeout(timer);
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onController,
        );
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onController,
      );
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:bottom-6 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#1a2416] text-white shadow-lg pl-4 pr-2 py-2 max-w-md w-full sm:w-auto">
        <RefreshCw className="w-4 h-4 shrink-0 text-amber-200" aria-hidden />
        <p className="text-[12px] sm:text-[13px] font-medium leading-snug flex-1">
          A fresh version of Dr Tea is ready.
        </p>
        <button
          onClick={handleRefresh}
          className="text-[11px] font-bold uppercase tracking-wider bg-[#3a5a2c] hover:bg-[#2e4823] text-white px-3 py-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          Refresh
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notice"
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
