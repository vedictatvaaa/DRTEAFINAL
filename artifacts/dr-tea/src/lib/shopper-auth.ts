import { useEffect, useState, useCallback } from "react";

export interface ShopperUser {
  id: string;
  email: string;
  name: string;
}

const API = `${import.meta.env.BASE_URL}api`;

let cached: { authenticated: boolean; user?: ShopperUser } | null = null;
const subs = new Set<() => void>();

function notify() {
  for (const s of subs) s();
}

export async function refetchShopper(): Promise<void> {
  try {
    const r = await fetch(`${API}/shopper/auth/me`, { credentials: "include" });
    cached = await r.json();
  } catch {
    cached = { authenticated: false };
  }
  notify();
}

export async function requestShopperOtp(
  email: string,
  name?: string,
): Promise<{ devCode?: string }> {
  const r = await fetch(`${API}/shopper/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, name: name ?? "" }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Failed to send code");
  }
  return r.json();
}

export async function verifyShopperOtp(
  email: string,
  code: string,
  name?: string,
): Promise<ShopperUser> {
  const r = await fetch(`${API}/shopper/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, code, name: name ?? "" }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Invalid code");
  }
  const j = (await r.json()) as { user: ShopperUser };
  cached = { authenticated: true, user: j.user };
  notify();
  return j.user;
}

export async function logoutShopper(): Promise<void> {
  await fetch(`${API}/shopper/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  cached = { authenticated: false };
  notify();
}

export function useShopper(): {
  user: ShopperUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const [, setTick] = useState(0);
  useEffect(() => {
    const sub = () => setTick((n) => n + 1);
    subs.add(sub);
    if (!cached) void refetchShopper();
    return () => {
      subs.delete(sub);
    };
  }, []);
  const refetch = useCallback(() => refetchShopper(), []);
  return {
    user: cached?.user ?? null,
    isLoading: cached === null,
    refetch,
  };
}
