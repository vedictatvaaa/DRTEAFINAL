import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Copy, Check } from "lucide-react";
import { useStore } from "@/store/use-store";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/currency";
import { unitPriceFor } from "@/lib/cart-pricing";

const PROMO_CODE = "COMEBACK5";
const SESSION_KEY = "drtea-abandon-popup-fired-v1";
const IDLE_MS = 25_000;

export default function AbandonedCartPopup() {
  const [location] = useLocation();
  const cart = useStore((s) => s.cart);
  const currency = useStore((s) => s.currency);
  const appliedCode = useStore((s) => s.appliedDiscountCode);
  const setAppliedDiscountCode = useStore((s) => s.setAppliedDiscountCode);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const eligible =
    cart.length > 0 &&
    appliedCode !== PROMO_CODE &&
    (location === "/checkout" || location.startsWith("/checkout") || location === "/cart");

  useEffect(() => {
    if (!eligible) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;

    const fire = () => {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
    };

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire();
    };

    let idle: number | undefined = window.setTimeout(fire, IDLE_MS);
    const resetIdle = () => {
      if (idle) window.clearTimeout(idle);
      idle = window.setTimeout(fire, IDLE_MS);
    };

    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("scroll", resetIdle, { passive: true });
    document.addEventListener("touchstart", resetIdle, { passive: true });

    return () => {
      if (idle) window.clearTimeout(idle);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("scroll", resetIdle);
      document.removeEventListener("touchstart", resetIdle);
    };
  }, [eligible]);

  const subtotal = cart.reduce(
    (s, i) => s + unitPriceFor(i.variant.price, !!i.subscription) * i.quantity,
    0,
  );
  const projectedSavings = Math.round(subtotal * 0.05);

  const close = () => setOpen(false);

  const apply = () => {
    setAppliedDiscountCode(PROMO_CODE);
    toast({
      title: "Code applied",
      description: `${PROMO_CODE} — you'll save ${formatPrice(projectedSavings, currency)} at checkout.`,
    });
    setOpen(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — user can still type the code manually
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          data-testid="abandon-popup-backdrop"
        >
          <motion.div
            role="dialog"
            aria-labelledby="abandon-popup-title"
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              data-testid="abandon-popup-close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="bg-gradient-to-br from-[#1a2416] via-[#1a2416] to-[#0e1810] text-white px-6 pt-7 pb-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40 mb-3">
                <Sparkles className="w-5 h-5 text-emerald-300" />
              </div>
              <h2
                id="abandon-popup-title"
                className="font-serif text-2xl leading-tight"
              >
                Wait — here's a 5% thank-you
              </h2>
              <p className="text-[12.5px] text-white/65 mt-1.5">
                Use code below before you finish your order
                {subtotal > 0 && (
                  <>
                    {" "}— save{" "}
                    <span className="text-emerald-300 font-semibold">
                      {formatPrice(projectedSavings, currency)}
                    </span>{" "}
                    on this cart.
                  </>
                )}
              </p>
            </div>

            <div className="px-6 -mt-5 relative">
              <div className="bg-white border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 shadow-md">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">Promo code</p>
                  <p className="font-mono text-lg font-bold tracking-[0.18em] text-[#1a2416]" data-testid="abandon-popup-code">
                    {PROMO_CODE}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#1a2416] border border-[#1a2416]/15 px-3 py-2 rounded-md hover:bg-[#1a2416]/5"
                  data-testid="abandon-popup-copy"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="px-6 pt-5 pb-6 space-y-2">
              <button
                type="button"
                onClick={apply}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold uppercase tracking-widest py-3.5 rounded-md transition-colors"
                data-testid="abandon-popup-apply"
              >
                Apply &amp; continue
              </button>
              <button
                type="button"
                onClick={close}
                className="w-full text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground py-2"
              >
                No thanks
              </button>
              <p className="text-[10px] text-center text-muted-foreground pt-1">
                Stacks with prepaid discount · single use per session
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
