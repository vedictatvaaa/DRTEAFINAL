import { useEffect, useState, useCallback } from 'react';

const API = `${import.meta.env.BASE_URL}api`;

export interface Review {
  id: number;
  productId: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorInitials: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  isMine: boolean;
}

export interface ReviewSummary {
  count: number;
  average: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

interface ReviewListResponse {
  summary: ReviewSummary;
  reviews: Review[];
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: 'include', ...init });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? 'Request failed');
  return j;
}

export function fetchProductReviews(productId: string): Promise<ReviewListResponse> {
  return jsonFetch<ReviewListResponse>(`/products/${encodeURIComponent(productId)}/reviews`);
}

export function submitReview(input: {
  productId: string;
  rating: number;
  title: string;
  body: string;
}): Promise<{ review: unknown }> {
  return jsonFetch<{ review: unknown }>(`/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function markReviewHelpful(id: number): Promise<{ helpfulCount: number }> {
  return jsonFetch<{ helpfulCount: number }>(`/reviews/${id}/helpful`, { method: 'POST' });
}

const HELPFUL_KEY = 'drtea-helpful-votes';
export function loadHelpfulVotes(): Set<number> {
  try {
    const raw = localStorage.getItem(HELPFUL_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}
export function saveHelpfulVote(id: number): void {
  try {
    const set = loadHelpfulVotes();
    set.add(id);
    localStorage.setItem(HELPFUL_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export function useProductReviews(productId: string | undefined): {
  data: ReviewListResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<ReviewListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchProductReviews(productId);
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
