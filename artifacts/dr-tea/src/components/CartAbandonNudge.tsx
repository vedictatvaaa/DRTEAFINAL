import { useEffect, useRef } from 'react';
import { useStore } from '@/store/use-store';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/currency';
import { unitPriceFor } from '@/lib/cart-pricing';

export default function CartAbandonNudge() {
  const cart = useStore((s) => s.cart);
  const isCartOpen = useStore((s) => s.isCartOpen);
  const currency = useStore((s) => s.currency);
  const { toast } = useToast();
  const firedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('drtea-nudge-fired') === '1') {
      firedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (firedRef.current) return;
    if (isCartOpen) return;
    if (cart.length === 0) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (firedRef.current || isCartOpen) return;
      firedRef.current = true;
      sessionStorage.setItem('drtea-nudge-fired', '1');
      const subtotal = cart.reduce((a, i) => a + unitPriceFor(i.variant.price, !!i.subscription) * i.quantity, 0);
      toast({
        title: 'Your ritual is waiting',
        description: subtotal < 999
          ? `You're ${formatPrice(999 - subtotal, currency)} away from free shipping — open the cart when you're ready.`
          : 'Free shipping unlocked — open the cart when you\'re ready.',
      });
    }, 45_000);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [cart, isCartOpen, toast, currency]);

  return null;
}
