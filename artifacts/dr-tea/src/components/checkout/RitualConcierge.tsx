import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { useStore } from '@/store/use-store';
import { unitPriceFor } from '@/lib/cart-pricing';

type Msg = { role: 'user' | 'assistant'; content: string };

const STARTERS = [
  'Caffeine in this order?',
  'Best brew time?',
  'Which is best as a gift?',
  'What pairs well with these?',
];

export default function RitualConcierge() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "Hi — I'm your Ritual Concierge. Ask me anything about your tea, brewing, or gifting.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const cart = useStore((s) => s.cart);
  const currency = useStore((s) => s.currency);
  const preferences = useStore((s) => s.preferences);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const subtotal = cart.reduce(
        (s, i) =>
          s + unitPriceFor(i.variant.price, !!i.subscription) * i.quantity,
        0,
      );
      const r = await fetch(`${import.meta.env.BASE_URL}api/ai/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          cart: cart.map((i) => ({
            productName: i.product.name,
            variantSize: i.variant.size,
            quantity: i.quantity,
            unitPrice: unitPriceFor(i.variant.price, !!i.subscription),
          })),
          subtotal,
          currency,
          customerName: preferences.name,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { reply?: string };
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.reply || "Sorry — I didn't catch that." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: "I'm having trouble right now. Try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Ritual Concierge"
        aria-expanded={open}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 h-12 px-4 rounded-full bg-[#1a2416] text-white shadow-lg hover:shadow-xl flex items-center gap-2 text-[12px] font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 transition-shadow"
      >
        <Sparkles className="w-4 h-4 text-amber-200" />
        Concierge
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/30 z-40 sm:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              role="dialog"
              aria-label="Ritual Concierge chat"
              className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden
                         inset-x-3 bottom-3 top-16
                         sm:inset-auto sm:bottom-24 sm:right-6 sm:top-auto sm:w-[380px] sm:h-[520px]"
            >
              <div className="px-4 h-12 border-b border-border bg-[#1a2416] text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span className="font-serif font-semibold text-[14px]">Ritual Concierge</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close concierge"
                  className="w-8 h-8 -mr-1 rounded-full hover:bg-white/10 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#f9f7f3]">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[85%] text-[13px] leading-relaxed rounded-2xl px-3.5 py-2.5 ${
                      m.role === 'user'
                        ? 'ml-auto bg-[#1a2416] text-white rounded-br-sm'
                        : 'mr-auto bg-white border border-border text-foreground rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {busy && (
                  <div className="mr-auto bg-white border border-border rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {messages.length <= 1 && (
                <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 flex-shrink-0">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-white hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="p-3 border-t border-border flex gap-2 flex-shrink-0 bg-white"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your tea…"
                  aria-label="Ask the concierge"
                  className="flex-1 min-w-0 text-[13px] px-3 py-2.5 border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="w-10 h-10 rounded-md bg-[#1a2416] text-white flex items-center justify-center disabled:opacity-50 hover:bg-[#243320] transition-colors"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
