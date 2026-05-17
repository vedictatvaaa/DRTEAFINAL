import { useEffect } from 'react';
import { useStore } from '@/store/use-store';
import { detectCurrency } from '@/lib/currency';

/**
 * Runs once on mount. If the user has not manually picked a currency,
 * detect it from browser locale / IP geolocation and update the store.
 */
export default function CurrencyAutoDetect() {
  const setCurrency = useStore((s) => s.setCurrency);
  const currencyAuto = useStore((s) => s.currencyAuto);
  const hasHydrated = useStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!currencyAuto) return;
    let cancelled = false;
    detectCurrency().then((code) => {
      if (cancelled) return;
      setCurrency(code, false);
    });
    return () => { cancelled = true; };
  }, [hasHydrated, currencyAuto, setCurrency]);

  return null;
}
