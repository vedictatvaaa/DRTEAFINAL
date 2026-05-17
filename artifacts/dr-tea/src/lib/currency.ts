export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'AUD' | 'CAD' | 'SGD' | 'JPY';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  ratePerInr: number;
  decimals: number;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  INR: { code: 'INR', symbol: '₹',  name: 'Indian Rupee',     ratePerInr: 1,        decimals: 0, locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$',  name: 'US Dollar',        ratePerInr: 0.012,    decimals: 2, locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€',  name: 'Euro',             ratePerInr: 0.011,    decimals: 2, locale: 'en-IE' },
  GBP: { code: 'GBP', symbol: '£',  name: 'British Pound',    ratePerInr: 0.0094,   decimals: 2, locale: 'en-GB' },
  AED: { code: 'AED', symbol: 'AED',name: 'UAE Dirham',       ratePerInr: 0.044,    decimals: 2, locale: 'en-AE' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar',ratePerInr: 0.018,    decimals: 2, locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar',  ratePerInr: 0.016,    decimals: 2, locale: 'en-CA' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', ratePerInr: 0.016,    decimals: 2, locale: 'en-SG' },
  JPY: { code: 'JPY', symbol: '¥',  name: 'Japanese Yen',     ratePerInr: 1.85,     decimals: 0, locale: 'ja-JP' },
};

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  IN: 'INR',
  US: 'USD',
  GB: 'GBP', UK: 'GBP',
  AE: 'AED',
  AU: 'AUD',
  CA: 'CAD',
  SG: 'SGD',
  JP: 'JPY',
  // Eurozone
  AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR', HR: 'EUR',
};

export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  if (!country) return 'INR';
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] ?? 'INR';
}

function localeCountry(): string | null {
  if (typeof navigator === 'undefined') return null;
  const langs = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  for (const l of langs) {
    const parts = l.split('-');
    if (parts.length >= 2) return parts[1]!.toUpperCase();
  }
  return null;
}

/**
 * Detect the user's currency. We prefer IP-based geo over `navigator.language`
 * because Indian shoppers frequently use devices set to `en-US` locale, which
 * would otherwise mis-default the storefront to USD. Order of precedence:
 *   1. IP geo (ipapi) — only if it returns a clearly non-Indian location
 *   2. Browser locale country — only if IP geo is unavailable AND the locale
 *      country has a currency we actually support
 *   3. INR (safe default for an India-first brand)
 */
export async function detectCurrency(timeoutMs = 2500): Promise<CurrencyCode> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data: { country_code?: string; currency?: string } = await res.json();
      const cc = (data.country_code ?? '').toUpperCase();
      if (cc === 'IN') return 'INR';
      if (data.currency && data.currency in CURRENCIES) return data.currency as CurrencyCode;
      const fromCountry = currencyForCountry(cc);
      if (fromCountry !== 'INR' || cc === 'IN') return fromCountry;
    }
  } catch {
    // fall through to locale-based guess
  }
  // No reliable IP geo — try the locale, but only trust non-INR results
  // when the locale's country is one we actually support.
  const localeCC = localeCountry();
  if (localeCC && localeCC !== 'IN' && localeCC in COUNTRY_TO_CURRENCY) {
    return COUNTRY_TO_CURRENCY[localeCC]!;
  }
  return 'INR';
}

export function convertFromInr(amountInr: number, code: CurrencyCode): number {
  return amountInr * CURRENCIES[code].ratePerInr;
}

export function formatPrice(amountInr: number, code: CurrencyCode = 'INR'): string {
  const meta = CURRENCIES[code];
  const value = convertFromInr(amountInr, code);
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(value);
  } catch {
    const rounded = meta.decimals === 0 ? Math.round(value) : value.toFixed(meta.decimals);
    return `${meta.symbol}${rounded}`;
  }
}
