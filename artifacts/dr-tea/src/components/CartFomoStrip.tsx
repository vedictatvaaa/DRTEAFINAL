import { useEffect, useState } from 'react';
import { Eye, Clock } from 'lucide-react';

const HOLD_MS = 10 * 60 * 1000;
const HOLD_KEY = 'drtea-cart-hold-until';
const VIEWERS_KEY = 'drtea-cart-viewers';

function getOrInitHoldUntil(): number {
  if (typeof window === 'undefined') return Date.now() + HOLD_MS;
  const existing = Number(sessionStorage.getItem(HOLD_KEY));
  if (existing && existing > Date.now()) return existing;
  const next = Date.now() + HOLD_MS;
  sessionStorage.setItem(HOLD_KEY, String(next));
  return next;
}

function getOrInitViewers(): number {
  if (typeof window === 'undefined') return 14;
  const existing = Number(sessionStorage.getItem(VIEWERS_KEY));
  if (existing && existing >= 8) return existing;
  const next = 9 + Math.floor(Math.random() * 14);
  sessionStorage.setItem(VIEWERS_KEY, String(next));
  return next;
}

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CartFomoStrip({ itemCount }: { itemCount: number }) {
  const [holdUntil, setHoldUntil] = useState<number | null>(null);
  const [viewers, setViewers] = useState<number>(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (itemCount === 0) return;
    setHoldUntil(getOrInitHoldUntil());
    setViewers(getOrInitViewers());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);

    const drift = window.setInterval(() => {
      setViewers((v) => {
        const delta = Math.random() < 0.5 ? -1 : 1;
        const next = Math.max(8, Math.min(28, v + delta));
        sessionStorage.setItem(VIEWERS_KEY, String(next));
        return next;
      });
    }, 9000);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(drift);
    };
  }, [itemCount]);

  if (itemCount === 0 || holdUntil === null) return null;

  const remaining = holdUntil - now;
  const expired = remaining <= 0;

  return (
    <div className="px-5 py-2 border-b border-border bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 flex-shrink-0">
      <div className="flex items-center justify-between gap-3 text-[10.5px]">
        <div className="flex items-center gap-1.5 text-[#3a5a2c] font-semibold tracking-wide">
          <Eye className="w-3 h-3" strokeWidth={2.2} />
          <span>
            <span className="font-bold tabular-nums">{viewers}</span> brewing this now
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 font-bold tabular-nums ${
            expired ? 'text-rose-700' : 'text-[#1a2416]'
          }`}
          aria-live="polite"
        >
          <Clock className="w-3 h-3" strokeWidth={2.2} />
          {expired ? (
            <span className="uppercase tracking-wider text-[9.5px]">Hold released</span>
          ) : (
            <>
              <span className="text-[#1a2416]/55 font-medium uppercase tracking-wider text-[9.5px] mr-0.5">
                Held for
              </span>
              <span>{format(remaining)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
