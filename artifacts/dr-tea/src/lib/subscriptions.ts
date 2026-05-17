import { useEffect, useState, useCallback } from 'react';

const API = `${import.meta.env.BASE_URL}api`;

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: number;
  productId: string;
  productName: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  frequencyWeeks: number;
  discountPct: number;
  status: SubscriptionStatus;
  nextDeliveryAt: string;
  lastOrderId: number | null;
  createdAt: string;
}

export interface SubscriptionConfig {
  frequencies: number[];
  defaultFrequencyWeeks: number;
  discountPct: number;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: 'include', ...init });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? 'Request failed');
  return j;
}

export function fetchMySubscriptions(): Promise<{ subscriptions: Subscription[] }> {
  return jsonFetch<{ subscriptions: Subscription[] }>('/subscriptions/mine');
}

export function fetchSubscriptionConfig(): Promise<SubscriptionConfig> {
  return jsonFetch<SubscriptionConfig>('/subscriptions/config');
}

export function pauseSubscription(id: number) {
  return jsonFetch<{ ok: true }>(`/subscriptions/${id}/pause`, { method: 'POST' });
}
export function resumeSubscription(id: number) {
  return jsonFetch<{ ok: true }>(`/subscriptions/${id}/resume`, { method: 'POST' });
}
export function skipSubscription(id: number) {
  return jsonFetch<{ ok: true; nextDeliveryAt: string }>(`/subscriptions/${id}/skip`, { method: 'POST' });
}
export function cancelSubscription(id: number) {
  return jsonFetch<{ ok: true }>(`/subscriptions/${id}/cancel`, { method: 'POST' });
}
export function updateSubscriptionFrequency(id: number, frequencyWeeks: number) {
  return jsonFetch<{ ok: true; nextDeliveryAt: string }>(`/subscriptions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frequencyWeeks }),
  });
}

export function useMySubscriptions(enabled = true) {
  const [data, setData] = useState<Subscription[] | null>(null);
  const [config, setConfig] = useState<SubscriptionConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [{ subscriptions }, cfg] = await Promise.all([
        fetchMySubscriptions(),
        fetchSubscriptionConfig(),
      ]);
      setData(subscriptions);
      setConfig(cfg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, config, loading, error, refetch };
}
