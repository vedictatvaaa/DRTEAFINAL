import { useEffect, useMemo, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { motion } from 'framer-motion';
import { Check, Package, Truck, Share2, ArrowRight, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/currency';
import type { CurrencyCode } from '@/lib/currency';
import Seo from '@/components/Seo';

type StoredOrder = {
  id: number;
  customerName: string;
  customerEmail: string;
  currency: CurrencyCode;
  subtotal: number;
  shipping: number;
  giftWrapCost: number;
  total: number;
  eta: string;
  items: Array<{
    productName: string;
    variantSize: string;
    quantity: number;
    unitPrice: number;
    slug: string;
    imageUrl: string;
  }>;
  paymentMethod: 'razorpay' | 'cod';
  placedAt: string;
};

export default function OrderConfirmed() {
  const [, params] = useRoute<{ id: string }>('/order-confirmed/:id');
  const id = params?.id ?? '';
  const [order, setOrder] = useState<StoredOrder | null>(null);

  useEffect(() => {
    if (!id) return;
    try {
      const raw = window.sessionStorage.getItem(`dr-tea-order-${id}`);
      if (raw) setOrder(JSON.parse(raw) as StoredOrder);
    } catch {}
  }, [id]);

  const shareText = useMemo(() => {
    if (!order) return '';
    return `Just placed my Dr Tea ritual order #${order.id}. Brewing premium Indian teas — drtea.in`;
  }, [order]);

  const onShareWhatsApp = () => {
    if (!order) return;
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="bg-[#f9f7f3] min-h-screen">
      <Seo title="Order Confirmed — Dr Tea" robots="noindex, follow" />
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl border border-border p-8 sm:p-10 text-center shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-[#3a5a2c] text-white mx-auto mb-5 flex items-center justify-center">
            <Check className="w-8 h-8" strokeWidth={3} />
          </div>
          <h1 className="font-serif font-bold text-[28px] sm:text-[34px] leading-tight mb-2">
            Your ritual is on its way
          </h1>
          {order ? (
            <>
              <p className="text-[13px] text-muted-foreground mb-1">
                Thank you, <span className="text-foreground font-medium">{order.customerName.split(' ')[0]}</span> — order
                <span className="font-mono text-foreground"> #{order.id}</span> confirmed.
              </p>
              <p className="text-[12px] text-muted-foreground">
                A confirmation email is on its way to <span className="text-foreground">{order.customerEmail}</span>.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Order #{id} confirmed. Check your email for a copy.</p>
          )}

          {/* ETA pill */}
          {order && (
            <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full bg-[#f7f5f1] border border-border text-[12px]">
              <Truck className="w-3.5 h-3.5 text-[#3a5a2c]" />
              <span className="text-muted-foreground">Arriving</span>
              <span className="font-semibold">{order.eta}</span>
            </div>
          )}
        </motion.div>

        {/* Order details */}
        {order && (
          <div className="mt-5 bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center gap-2">
              <Package className="w-4 h-4 text-[#1a2416]" />
              <h2 className="font-serif font-semibold text-[15px]">Your order</h2>
            </div>
            <div className="px-5 sm:px-6 py-4 space-y-3">
              {order.items.map((it, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-12 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0">
                    <img src={it.imageUrl} alt={it.productName} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${it.slug}`}
                      className="text-[13px] font-semibold leading-tight line-clamp-2 hover:underline"
                    >
                      {it.productName}
                    </Link>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {it.variantSize} · qty {it.quantity}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold flex-shrink-0">
                    {formatPrice(it.unitPrice * it.quantity, order.currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 sm:px-6 py-4 border-t border-border bg-[#f7f5f1] space-y-1.5 text-[12px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal, order.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping, order.currency)}</span></div>
              {order.giftWrapCost > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Gift wrap</span><span>{formatPrice(order.giftWrapCost, order.currency)}</span></div>
              )}
              <div className="flex justify-between font-serif font-bold text-[16px] pt-2 border-t border-border mt-2">
                <span>Total ({order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid'})</span>
                <span>{formatPrice(order.total, order.currency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Brewing tip + actions */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#1a2416] text-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-200" />
              <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80">While you wait</p>
            </div>
            <p className="font-serif text-[18px] leading-snug mb-2">Brew like a connoisseur</p>
            <p className="text-[12px] text-white/70 leading-relaxed mb-4">
              Most teas brew best at 80-95°C for 3-5 minutes. Explore guides for each tea in your order.
            </p>
            <Link
              href="/journal"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200 hover:text-white"
            >
              Read brewing guides <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-border p-5 flex flex-col">
            <p className="font-serif text-[18px] leading-snug mb-2">Share the ritual</p>
            <p className="text-[12px] text-muted-foreground mb-4 flex-1">
              Tell a friend — earn a thank-you discount on your next order.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onShareWhatsApp}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-2.5 rounded-md border border-border hover:bg-muted transition-colors"
              >
                <Share2 className="w-3 h-3" /> WhatsApp
              </button>
              <Link
                href="/shop"
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-2.5 rounded-md bg-[#1a2416] text-white hover:bg-[#243320] transition-colors"
              >
                Shop more
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-8">
          Need help? Email <a href="mailto:care@drtea.in" className="text-foreground underline">care@drtea.in</a>
        </p>
      </div>
    </div>
  );
}
