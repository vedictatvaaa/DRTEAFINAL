import type { CartItem } from "@/store/use-store";
import type { Product } from "@/data/products";

const JOURNAL_KEY = "dr-tea-cart-journal";

export type CartMutationKind = "add" | "remove" | "update" | "clear";

export interface CartMutation {
  kind: CartMutationKind;
  ts: number;
  productId?: string;
  variantSize?: string;
  quantity?: number;
}

export function readJournal(): CartMutation[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartMutation[]) : [];
  } catch {
    return [];
  }
}

export function appendJournal(m: CartMutation): void {
  if (typeof localStorage === "undefined") return;
  try {
    const cur = readJournal();
    cur.push(m);
    // Cap at 200 entries to avoid runaway growth.
    const trimmed = cur.length > 200 ? cur.slice(-200) : cur;
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage errors (quota, private mode)
  }
}

export function clearJournal(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(JOURNAL_KEY);
  } catch {
    // ignore
  }
}

export interface ReconcileResult {
  cart: CartItem[];
  removed: string[]; // names of items removed because the product/variant disappeared
  repriced: string[]; // names of items whose price changed
}

export function reconcileCartWithCatalog(cart: CartItem[], products: Product[]): ReconcileResult {
  const byId = new Map<string, Product>();
  for (const p of products) byId.set(p.id, p);

  const removed: string[] = [];
  const repriced: string[] = [];
  const next: CartItem[] = [];

  for (const item of cart) {
    const fresh = byId.get(item.product.id);
    if (!fresh) {
      removed.push(item.product.name);
      continue;
    }
    const variant = fresh.variants.find((v) => v.size === item.variant.size);
    if (!variant) {
      removed.push(`${item.product.name} (${item.variant.size})`);
      continue;
    }
    const priceChanged = variant.price !== item.variant.price;
    if (priceChanged) repriced.push(item.product.name);
    next.push({
      ...item,
      product: fresh,
      variant,
    });
  }
  return { cart: next, removed, repriced };
}
