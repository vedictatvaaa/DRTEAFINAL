import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductsQueryKey, useListProducts } from "@workspace/api-client-react";
import type { Product } from "@/data/products";
import { useStore } from "@/store/use-store";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { reconcileCartWithCatalog, readJournal, clearJournal } from "@/lib/cart-sync";

type SyncTrigger = "initial" | "reconnect";

export function useCartSync(): void {
  const isOnline = useOnlineStatus();
  const hasHydrated = useStore((s) => s.hasHydrated);
  const qc = useQueryClient();
  const { data: products } = useListProducts();
  const { toast } = useToast();

  const wasOffline = useRef<boolean>(!isOnline);
  const initialDone = useRef<boolean>(false);
  const inFlight = useRef<boolean>(false);

  const runSync = useRef<(trigger: SyncTrigger) => Promise<void>>(async () => {});
  runSync.current = async (trigger: SyncTrigger) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      let catalog: Product[] | undefined = products;
      if (trigger === "reconnect") {
        await qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        catalog = qc.getQueryData<Product[]>(getListProductsQueryKey()) ?? products;
      }
      if (!catalog || catalog.length === 0) return;

      const cart = useStore.getState().cart;
      const journal = readJournal();
      if (cart.length === 0 && journal.length === 0) {
        clearJournal();
        return;
      }

      const { cart: nextCart, removed, repriced } = reconcileCartWithCatalog(cart, catalog);
      if (nextCart.length !== cart.length || removed.length || repriced.length) {
        useStore.setState({ cart: nextCart });
      }
      const queued = journal.length;
      clearJournal();

      const parts: string[] = [];
      if (queued > 0) parts.push(`${queued} offline change${queued === 1 ? "" : "s"} synced`);
      if (removed.length) parts.push(`${removed.length} item${removed.length === 1 ? "" : "s"} no longer available`);
      if (repriced.length) parts.push(`${repriced.length} price${repriced.length === 1 ? "" : "s"} updated`);

      if (parts.length === 0) return;
      const title = trigger === "reconnect" ? "Back online — cart synced" : queued > 0 ? "Cart synced" : "Cart updated";
      toast({ title, description: parts.join(" · ") });
    } finally {
      inFlight.current = false;
    }
  };

  // Initial reconcile (covers app-start with leftover cart/journal from a previous session).
  useEffect(() => {
    if (!hasHydrated || !isOnline || !products || products.length === 0) return;
    if (initialDone.current) return;
    initialDone.current = true;
    void runSync.current("initial");
  }, [hasHydrated, isOnline, products]);

  // Reconcile on offline -> online transitions during the session.
  useEffect(() => {
    if (!hasHydrated) return;
    if (isOnline && wasOffline.current) {
      wasOffline.current = false;
      // Skip if the initial sync hasn't run yet — it will pick this up.
      if (!initialDone.current) return;
      void runSync.current("reconnect");
    } else if (!isOnline) {
      wasOffline.current = true;
    }
  }, [hasHydrated, isOnline]);
}
