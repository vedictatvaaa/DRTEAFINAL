// Floating witty-nudge popup. Bottom-right toast on desktop, bottom sheet
// on mobile. Auto-dismisses after 14s, can be closed manually, primary CTA
// routes to the catalog (or checkout for cart_idle).

import { useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { useNudgeEngine } from "@/hooks/use-nudge-engine";

const TONE_STYLES: Record<string, { ring: string; chip: string; label: string }> = {
  witty:         { ring: "ring-amber-300/40",  chip: "bg-amber-300/15 text-amber-200",  label: "Witty" },
  sarcastic:     { ring: "ring-rose-300/40",   chip: "bg-rose-300/15 text-rose-200",    label: "Sarcastic" },
  romcom:        { ring: "ring-pink-300/40",   chip: "bg-pink-300/15 text-pink-200",    label: "Rom-com" },
  inspirational: { ring: "ring-emerald-300/40",chip: "bg-emerald-300/15 text-emerald-200", label: "Inspiring" },
  hilarious:     { ring: "ring-fuchsia-300/40",chip: "bg-fuchsia-300/15 text-fuchsia-200", label: "Hilarious" },
};

function ctaHref(trigger: string): string {
  if (trigger === "cart_idle") return "/checkout";
  if (trigger === "product_dwell") return "#"; // stays on page
  return "/shop";
}

export default function NudgePopup() {
  const { nudge, dismiss, convert } = useNudgeEngine();
  const reduce = useReducedMotion();

  // Auto-dismiss after 14s.
  useEffect(() => {
    if (!nudge) return;
    const t = window.setTimeout(() => dismiss(), 14000);
    return () => window.clearTimeout(t);
  }, [nudge, dismiss]);

  return (
    <AnimatePresence>
      {nudge && (
        <motion.div
          key={nudge.message.id + nudge.shownAt}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          role="status"
          aria-live="polite"
          className="fixed z-[60] left-3 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-sm"
        >
          <div
            className={`relative rounded-2xl bg-[#0f1612] text-white shadow-2xl ring-1 ${TONE_STYLES[nudge.message.tone]?.ring ?? "ring-white/10"} overflow-hidden`}
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-300/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[9px] uppercase tracking-[0.22em] font-bold px-1.5 py-0.5 rounded ${TONE_STYLES[nudge.message.tone]?.chip ?? "bg-white/10 text-white/70"}`}
                    >
                      {TONE_STYLES[nudge.message.tone]?.label ?? nudge.message.tone}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.22em] text-white/40 font-semibold">
                      A note from Dr Tea
                    </span>
                  </div>
                  <p className="font-serif text-[15px] sm:text-base leading-snug text-white">
                    {nudge.message.text}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {nudge.message.trigger === "product_dwell" ? (
                      <button
                        type="button"
                        onClick={convert}
                        className="inline-flex items-center text-[11px] uppercase tracking-[0.2em] font-bold bg-amber-300 text-[#1a2416] px-3 py-1.5 rounded-md hover:bg-amber-200 transition"
                      >
                        {nudge.message.cta ?? "Got it"}
                      </button>
                    ) : (
                      <Link
                        href={ctaHref(nudge.message.trigger)}
                        onClick={convert}
                        className="inline-flex items-center text-[11px] uppercase tracking-[0.2em] font-bold bg-amber-300 text-[#1a2416] px-3 py-1.5 rounded-md hover:bg-amber-200 transition"
                      >
                        {nudge.message.cta ?? "Take me there"}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={dismiss}
                      className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/50 hover:text-white/80 px-2 py-1.5"
                    >
                      Not now
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss"
                  className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
