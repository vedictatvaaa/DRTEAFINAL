import { useEffect, useState, useCallback } from 'react';

export interface LoyaltyLedgerEntry {
  id: number;
  shopperUserId: string;
  kind: 'earn' | 'redeem' | 'adjust';
  points: number;
  orderId: number | null;
  note: string;
  createdAt: string;
}

export interface LoyaltyMeResponse {
  user: { id: string; email: string; name: string };
  account: {
    shopperUserId: string;
    pointsBalance: number;
    lifetimePoints: number;
    lifetimeSpend: number;
  };
  ledger: LoyaltyLedgerEntry[];
  config: {
    pointsPerRupeeEarn: number;
    rupeesPerPointRedeem: number;
    redeemMaxPctOfSubtotal: number;
  };
}

const API = `${import.meta.env.BASE_URL}api`;

let cached: LoyaltyMeResponse | null = null;
const subs = new Set<() => void>();
function notify() { for (const s of subs) s(); }

export async function refetchLoyalty(): Promise<LoyaltyMeResponse | null> {
  try {
    const r = await fetch(`${API}/loyalty/me`, { credentials: 'include' });
    if (!r.ok) {
      cached = null;
    } else {
      cached = (await r.json()) as LoyaltyMeResponse;
    }
  } catch {
    cached = null;
  }
  notify();
  return cached;
}

export function clearLoyaltyCache(): void {
  cached = null;
  notify();
}

export function useLoyalty(enabled: boolean): {
  data: LoyaltyMeResponse | null;
  isLoading: boolean;
  refetch: () => Promise<LoyaltyMeResponse | null>;
} {
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState<boolean>(enabled && cached === null);

  useEffect(() => {
    const sub = () => setTick((n) => n + 1);
    subs.add(sub);
    if (enabled && cached === null) {
      setLoading(true);
      void refetchLoyalty().finally(() => setLoading(false));
    }
    return () => { subs.delete(sub); };
  }, [enabled]);

  const refetch = useCallback(async () => {
    setLoading(true);
    const r = await refetchLoyalty();
    setLoading(false);
    return r;
  }, []);

  return { data: enabled ? cached : null, isLoading: loading, refetch };
}
