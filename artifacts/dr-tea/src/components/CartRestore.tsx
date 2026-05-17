import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/store/use-store";
import { products } from "@/data/products";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? "/api"
).replace(/\/$/, "");

interface RestoreResponse {
  id: number;
  items: Array<{
    productId: string;
    productName: string;
    variantSize: string;
    quantity: number;
    unitPrice: number;
  }>;
  recovered?: boolean;
}

export default function CartRestore(): null {
  const [, setLocation] = useLocation();
  const addToCart = useStore((s) => s.addToCart);
  const openCart = useStore((s) => s.openCart);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const { toast } = useToast();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !hasHydrated) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("restore");
    if (!token) return;
    ranRef.current = true;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/checkout/intent/restore?t=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          if (res.status === 404) {
            toast({ title: "Cart link expired", description: "We couldn't find that saved cart." });
          }
          return;
        }
        const data = (await res.json()) as RestoreResponse;
        let added = 0;
        for (const it of data.items) {
          const product = products.find((p) => p.id === it.productId);
          if (!product) continue;
          const variant =
            product.variants.find((v) => v.size === it.variantSize) ?? product.variants[0];
          if (!variant) continue;
          addToCart(product, variant, it.quantity, false);
          added += 1;
        }
        if (added > 0) {
          toast({ title: "Cart restored", description: `${added} item${added === 1 ? "" : "s"} added back to your cart.` });
          openCart();
        }
      } catch {
        // best-effort — silently ignore
      } finally {
        // Strip ?restore= from the URL so a refresh doesn't re-add items.
        params.delete("restore");
        const search = params.toString();
        const next = window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
        setLocation(next.replace(import.meta.env.BASE_URL.replace(/\/$/, ""), "") || "/", {
          replace: true,
        });
      }
    })();
  }, [hasHydrated, addToCart, openCart, setLocation, toast]);

  return null;
}
