import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useStore } from '@/store/use-store';
import { CURRENCIES, type CurrencyCode } from '@/lib/currency';

const ORDER: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD', 'JPY'];

interface Props {
  compact?: boolean;
}

export default function CurrencySwitcher({ compact = false }: Props) {
  const currency = useStore((s) => s.currency);
  const setCurrency = useStore((s) => s.setCurrency);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${
          compact
            ? 'h-8 px-2 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:text-white'
            : 'h-9 px-2.5 text-[11px] font-semibold text-foreground/80 hover:text-foreground'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${currency}`}
      >
        <Globe className="w-3.5 h-3.5" strokeWidth={1.8} />
        <span>{currency}</span>
        <ChevronDown className="w-3 h-3" strokeWidth={1.8} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 z-50 w-44 max-h-72 overflow-auto rounded-md border border-border bg-white shadow-lg py-1"
        >
          {ORDER.map((code) => {
            const meta = CURRENCIES[code];
            const active = code === currency;
            return (
              <button
                key={code}
                role="option"
                aria-selected={active}
                onClick={() => { setCurrency(code, true); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-muted ${
                  active ? 'bg-primary/5 text-primary font-bold' : 'text-foreground'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 text-center font-mono">{meta.symbol}</span>
                  <span>{meta.name}</span>
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
