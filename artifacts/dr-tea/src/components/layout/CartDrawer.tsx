import { useMemo, useState, useEffect } from 'react';
import { useStore } from '@/store/use-store';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Minus, Plus, ShoppingBag, ArrowRight, Package, Repeat, Zap, Crown } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useProducts } from '@/lib/api-data';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatPrice } from '@/lib/currency';
import { WifiOff } from 'lucide-react';
import { track } from '@/lib/analytics';
import CartFomoStrip from '@/components/CartFomoStrip';
import { unitPriceFor, FREE_SHIPPING_THRESHOLD, SUBSCRIPTION_DISCOUNT, PREPAID_DISCOUNT_PCT } from '@/lib/cart-pricing';

const FREE_SHIPPING = FREE_SHIPPING_THRESHOLD;
const SUB_PCT_LABEL = Math.round(SUBSCRIPTION_DISCOUNT * 100);
const PREPAID_PCT_LABEL = Math.round(PREPAID_DISCOUNT_PCT * 100);

const bundles = [
  { name: 'Calm Evening Trio', items: ['chamomile-tea', 'lavender-tea', 'rose-tea'], saving: 150, price: 1199 },
  { name: 'Morning Energy Set', items: ['royal-masala-chai', 'dr-tea-kadak-chai', 'himalayan-green-tea'], saving: 200, price: 1349 },
  { name: 'Wellness Ritual Kit', items: ['ashwagandha-kadha', 'tulsi-ginger-kadha', 'chamomile-tea'], saving: 175, price: 1275 },
];

export default function CartDrawer() {
  const { isCartOpen, closeCart, cart, updateQuantity, removeFromCart, addToCart } = useStore();
  const currency = useStore((s) => s.currency);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const { products } = useProducts();
  const [, setLocation] = useLocation();

  const handleCheckout = () => {
    const subtotalNow = cart.reduce(
      (s, i) => s + unitPriceFor(i.variant.price, !!i.subscription) * i.quantity,
      0,
    );
    track({ type: "checkout_start", value: subtotalNow, currency });
    closeCart();
    setLocation('/checkout');
  };

  const handleAddBundle = () => {
    if (!suggestedBundle) return;
    let added = 0;
    suggestedBundle.items.forEach(slug => {
      const p = products.find(pr => pr.slug === slug);
      if (p && p.variants[0]) {
        addToCart(p, p.variants[0]);
        added++;
      }
    });
    toast({
      title: added > 0 ? `Added ${added} teas to your ritual` : "Bundle unavailable",
      description: added > 0
        ? `${suggestedBundle.name} — saving ${formatPrice(suggestedBundle.saving, currency)}.`
        : "We'll have this bundle back in stock soon.",
    });
  };

  const lineTotal = (item: typeof cart[number]) =>
    unitPriceFor(item.variant.price, !!item.subscription) * item.quantity;
  const subscribeSavings = useMemo(
    () =>
      cart.reduce(
        (s, i) =>
          s + (i.subscription ? 0 : i.variant.price * SUBSCRIPTION_DISCOUNT * i.quantity),
        0,
      ),
    [cart],
  );
  const hasNonSubscribed = cart.some((i) => !i.subscription);
  const subtotal = cart.reduce((acc, item) => acc + lineTotal(item), 0);
  const progress = Math.min((subtotal / FREE_SHIPPING) * 100, 100);
  const amountLeft = FREE_SHIPPING - subtotal;

  const pairingProducts = useMemo(() => {
    if (!cart.length) return [];
    const cartSlugs = new Set(cart.map(i => i.product.slug));
    const pairingCandidates: Map<string, { count: number; product: (typeof products)[0] }> = new Map();

    cart.forEach(item => {
      (item.product.pairsWith ?? []).forEach(slug => {
        if (cartSlugs.has(slug)) return;
        const p = products.find(pr => pr.slug === slug);
        if (!p) return;
        const existing = pairingCandidates.get(slug);
        pairingCandidates.set(slug, { count: (existing?.count ?? 0) + 1, product: p });
      });
    });

    return [...pairingCandidates.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(v => v.product);
  }, [cart, products]);

  const suggestedBundle = useMemo(() => {
    if (!cart.length) return null;
    const cartCategory = cart[0]?.product.category ?? '';
    if (cartCategory === 'Floral Tisane') return bundles[0];
    if (cartCategory === 'Chai') return bundles[1];
    if (cartCategory === 'Kadha') return bundles[2];
    return bundles[0];
  }, [cart]);

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[70] flex flex-col border-l border-border"
          >
            {/* Header */}
            <div className="px-5 h-14 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <h2 className="text-base font-serif font-semibold">Your Ritual</h2>
                {cart.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.reduce((a, i) => a + i.quantity, 0)}
                  </span>
                )}
              </div>
              <button onClick={closeCart} className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]" aria-label="Close cart">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Free shipping progress */}
            <div className="px-5 py-3 border-b border-border bg-[#f7f5f1] flex-shrink-0">
              <div className="flex justify-between text-[11px] mb-2 font-medium">
                <span className="text-muted-foreground">
                  {subtotal >= FREE_SHIPPING ? '🎉 Free shipping unlocked!' : `${formatPrice(amountLeft, currency)} away from free shipping`}
                </span>
                <span className="text-primary font-semibold">{formatPrice(subtotal, currency)}</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            </div>

            <CartFomoStrip itemCount={cart.length} />

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <DrawerEmptyState closeCart={closeCart} />
              ) : (
                <div className="px-5 py-4 space-y-4">
                  {/* Tea Pass — yearly unlimited for two */}
                  <Link
                    href="/tea-pass"
                    onClick={closeCart}
                    className="group block relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-amber-100/70 to-amber-50 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#1a2416] text-amber-200 flex items-center justify-center">
                        <Crown className="w-4 h-4" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9.5px] uppercase tracking-[0.22em] text-amber-800 font-bold mb-0.5">
                          New · Tea Pass for two
                        </p>
                        <p className="text-[12px] leading-snug text-[#1a2416]">
                          <span className="font-bold">Unlimited tea for a year — ₹6,000</span>
                          <span className="text-[#1a2416]/65"> · pick any 2 categories.</span>
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#1a2416]/60 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                    </div>
                  </Link>

                  {/* Subscribe & Save 50% upsell — only when at least one item isn't subscribed */}
                  {hasNonSubscribed && (
                    <Link
                      href="/subscriptions"
                      onClick={closeCart}
                      className="group block relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a2416] via-[#1a2416] to-[#0e1810] text-amber-100 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
                    >
                      <div className="absolute -right-3 -top-3 w-16 h-16 bg-amber-300/15 rounded-full blur-xl pointer-events-none" aria-hidden="true" />
                      <div className="relative flex items-center gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-300/15 ring-1 ring-amber-300/40 flex items-center justify-center">
                          <Repeat className="w-4 h-4 text-amber-200" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9.5px] uppercase tracking-[0.22em] text-amber-200/80 font-bold mb-0.5">
                            Subscribe &amp; save {SUB_PCT_LABEL}%
                          </p>
                          <p className="text-[12px] leading-snug text-white">
                            Make it a ritual —
                            {subscribeSavings > 0 ? (
                              <> save <span className="font-bold text-amber-200">{formatPrice(subscribeSavings, currency)}</span> on this cart.</>
                            ) : (
                              <> half off when you brew it monthly.</>
                            )}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-200/70 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                      </div>
                    </Link>
                  )}

                  {/* Cart items */}
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-16 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-[12px] font-semibold leading-tight line-clamp-2">{item.product.name}</h3>
                            <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0 focus-visible:outline-none focus-visible:bg-muted rounded-full -mt-1 -mr-1" aria-label={`Remove ${item.product.name}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {item.variant.size}
                            {item.subscription && (
                              <span className="ml-2 inline-block bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider text-[8px]">Subscribe · {SUB_PCT_LABEL}% off</span>
                            )}
                          </p>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center border border-border rounded-sm">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:bg-muted rounded-sm" aria-label="Decrease quantity">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-[12px] font-medium">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:bg-muted rounded-sm" aria-label="Increase quantity">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[13px] font-bold">{formatPrice(lineTotal(item), currency)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Tea pairing suggestions */}
                  {pairingProducts.length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        Pairs beautifully with
                      </p>
                      <div className="space-y-2.5">
                        {pairingProducts.map(p => (
                          <div key={p.slug} className="flex items-center gap-3 bg-[#f7f5f1] rounded-lg p-2.5">
                            <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold leading-tight line-clamp-1">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatPrice(p.price, currency)}</p>
                            </div>
                            <button
                              onClick={() => addToCart(p, p.variants[0])}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wide rounded-sm hover:bg-primary/90 transition-colors flex-shrink-0"
                            >
                              <Plus className="w-2.5 h-2.5" /> Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bundle recommendation */}
                  {suggestedBundle && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        <Package className="w-3 h-3 inline mr-1" />Bundle &amp; Save
                      </p>
                      <div className="bg-primary/6 border border-primary/15 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-[12px] font-bold text-foreground">{suggestedBundle.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{suggestedBundle.items.length} teas curated together</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-bold text-primary">{formatPrice(suggestedBundle.price, currency)}</p>
                            <p className="text-[9px] text-green-700 font-semibold">Save {formatPrice(suggestedBundle.saving, currency)}</p>
                          </div>
                        </div>
                        <button onClick={handleAddBundle} className="w-full py-2.5 border border-primary text-primary text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-primary hover:text-primary-foreground transition-all min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]">
                          Add Bundle
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Checkout footer */}
            {cart.length > 0 && (
              <div className="px-5 pt-3 pb-4 border-t border-border bg-white flex-shrink-0">
                {/* Prepaid power coupon — visible nudge, auto-applies on Razorpay */}
                <div className="mb-3 flex items-center gap-2.5 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-emerald-700" strokeWidth={2.4} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10.5px] leading-tight text-emerald-900">
                      <span className="font-bold">Pay online to save extra {PREPAID_PCT_LABEL}%</span>
                      <span className="text-emerald-800/75"> — auto-applies at checkout.</span>
                    </p>
                  </div>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-700 bg-white border border-emerald-300 px-1.5 py-0.5 rounded-sm flex-shrink-0">
                    Free
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-[12px] text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-[12px] text-muted-foreground">
                    <span>Shipping</span>
                    <span className={subtotal >= FREE_SHIPPING ? 'text-green-600 font-medium' : ''}>
                      {subtotal >= FREE_SHIPPING ? 'Free 🎉' : 'Calculated at checkout'}
                    </span>
                  </div>
                  <div className="flex justify-between font-serif font-semibold text-base pt-2.5 border-t border-border">
                    <span>Total</span>
                    <span>{formatPrice(subtotal, currency)}</span>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={!isOnline}
                  aria-disabled={!isOnline}
                  data-testid="button-checkout"
                  className="w-full bg-primary text-primary-foreground py-4 text-[12px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors rounded-sm flex items-center justify-center gap-2 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-primary"
                >
                  {isOnline ? (
                    <>Checkout <ArrowRight className="w-4 h-4" /></>
                  ) : (
                    <><WifiOff className="w-4 h-4" /> Offline — checkout unavailable</>
                  )}
                </button>
                <p className="text-center text-[9px] text-muted-foreground mt-2.5">
                  {isOnline
                    ? "Secure payments · Free 7-day returns · No questions asked"
                    : "We'll resume checkout the moment you're back online."}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const DRAWER_TIPS = [
  'Green tea loves 75 °C water — boiling makes it bitter.',
  'Store tea in an opaque tin. Light is the silent killer of aroma.',
  'A second-flush Darjeeling pairs beautifully with dark chocolate.',
  'Chai tastes best simmered, not steeped — let the spices bloom.',
  'L-theanine in tea smooths caffeine into a calmer, longer focus.',
];

function DrawerEmptyState({ closeCart }: { closeCart: () => void }) {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setTip((n) => (n + 1) % DRAWER_TIPS.length), 4500);
    return () => window.clearInterval(t);
  }, [reduce]);
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8 gap-5 bg-gradient-to-b from-white to-[#FAF8F4]">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 80 90" className="absolute inset-0 w-full h-full" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M${22 + i * 12} 35 C ${16 + i * 12} 22, ${30 + i * 12} 14, ${22 + i * 12} 2`}
              stroke="#3a5a2c"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 0.3 : 0 }}
              animate={reduce ? { opacity: 0.3 } : { pathLength: 1, opacity: [0, 0.55, 0] }}
              transition={reduce ? { duration: 0 } : { duration: 3.6, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
          <ellipse cx="40" cy="58" rx="26" ry="8" fill="#1a2416" />
          <rect x="16" y="48" width="48" height="12" rx="3" fill="#1a2416" />
          <path d="M64 53 q8 0 8 -7" stroke="#1a2416" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="40" cy="48" rx="26" ry="3.5" fill="#3a5a2c" />
        </svg>
      </div>
      <div>
        <p className="font-serif text-xl text-[#1a2416] mb-1">Your ritual awaits.</p>
        <p className="text-[12.5px] text-[#1a2416]/60 leading-relaxed max-w-[18rem]">
          Pour something worth sitting down for — explore the collection or take our 60-second quiz.
        </p>
      </div>
      <div className="flex gap-2 w-full max-w-[18rem]">
        <Link
          href="/shop"
          onClick={closeCart}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1a2416] hover:bg-[#0e1810] text-amber-100 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
        >
          Explore teas
        </Link>
        <Link
          href="/quiz"
          onClick={closeCart}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-[#1a2416]/15 hover:border-[#1a2416]/35 text-[#1a2416] px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
        >
          Take quiz
        </Link>
      </div>
      <div className="w-full max-w-[18rem] bg-[#0f1612] text-amber-100 rounded-lg px-4 py-3 mt-1" aria-live="polite" aria-atomic="true">
        <p className="text-[9px] uppercase tracking-[0.25em] text-amber-300/80 font-bold mb-1">Did you know</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={tip}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-[12px] leading-snug italic"
          >
            &ldquo;{DRAWER_TIPS[tip]}&rdquo;
          </motion.p>
        </AnimatePresence>
      </div>
      <Link
        href="/tea-pass"
        onClick={closeCart}
        className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#3a5a2c] hover:text-[#2c4422] inline-flex items-center gap-1"
      >
        Or get unlimited tea for ₹6,000/yr <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
