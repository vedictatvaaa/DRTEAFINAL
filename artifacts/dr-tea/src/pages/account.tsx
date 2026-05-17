import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Heart,
  History,
  Settings,
  LogOut,
  Share2,
  Repeat,
  Sparkles,
  Gift,
  Download,
  Truck,
  RefreshCcw,
  ExternalLink,
  Loader2,
  Coins,
  Check,
  Search,
} from 'lucide-react';
import { useStore } from '@/store/use-store';
import { useProducts } from '@/lib/api-data';
import { formatPrice } from '@/lib/currency';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useShopper, logoutShopper } from '@/lib/shopper-auth';
import { useLoyalty } from '@/lib/loyalty';
import { checkGiftCard } from '@/lib/gift-cards';
import SubscriptionsPanel from '@/components/account/SubscriptionsPanel';
import AccountAplusContent from '@/components/account/AccountAplusContent';
import Seo from '@/components/Seo';
import {
  fetchMyOrders,
  invoiceUrl,
  type CustomerOrder,
} from '@/lib/customer-orders';

const TABS = [
  'orders',
  'subscriptions',
  'rewards',
  'gift-cards',
  'wishlist',
  'history',
  'settings',
] as const;
type Tab = (typeof TABS)[number];
const isTab = (s: string): s is Tab => (TABS as readonly string[]).includes(s);

export default function Account() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (isTab(hash)) return hash;
    }
    return 'orders';
  });

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (isTab(hash)) setActiveTab(hash);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const { user: shopper } = useShopper();
  const { wishlist, toggleWishlist, preferences, updatePreferences, hasHydrated } = useStore();
  const currency = useStore((s) => s.currency);
  const { toast } = useToast();
  const { products } = useProducts();
  const wishlistedProducts = hasHydrated ? products.filter((p) => wishlist.includes(p.slug)) : [];

  const [formName, setFormName] = useState(preferences.name);
  const [formEmail, setFormEmail] = useState(preferences.email);
  const [formMethod, setFormMethod] = useState(preferences.brewingMethod);

  const handleSavePrefs = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences({ name: formName, email: formEmail, brewingMethod: formMethod });
    toast({ title: 'Preferences saved', description: 'Your tea profile has been updated.' });
  };

  const handleLogout = async () => {
    if (!shopper) {
      toast({
        title: "You're already browsing as a guest",
        description: 'Sign in from the header to access your orders.',
      });
      return;
    }
    await logoutShopper();
    toast({ title: 'Signed out', description: 'See you again soon.' });
  };

  const handleShareWishlist = async () => {
    if (!wishlist.length) {
      toast({
        title: 'Your wishlist is empty',
        description: 'Add some teas first, then share your ritual.',
      });
      return;
    }
    const shareUrl = `${window.location.origin}/shop?w=${wishlist.join(',')}`;
    const shareData = {
      title: 'My Dr Tea Wishlist',
      text: `Check out my Dr Tea wishlist — ${wishlist.length} teas I'm loving right now.`,
      url: shareUrl,
    };
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: 'Wishlist link copied',
          description: 'Paste it anywhere to share your ritual.',
        });
      }
    } catch {
      // user cancelled — silent
    }
  };

  const navItems: Array<{ id: Tab; label: string; icon: typeof Package; count?: number }> = [
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
    { id: 'rewards', label: 'Rewards', icon: Sparkles },
    { id: 'gift-cards', label: 'Gift Cards', icon: Gift },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, count: wishlist.length },
    { id: 'history', label: 'Ritual History', icon: History },
    { id: 'settings', label: 'Preferences', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background pt-8 sm:pt-16 pb-16 sm:pb-24">
      <Seo title="My Account — Dr Tea" canonical="https://drtea.in/account" robots="noindex, follow" />
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold mb-2">
          Welcome back{shopper ? `, ${shopper.name?.split(' ')[0] || 'friend'}` : ''}
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium mb-8 sm:mb-12">
          My Rituals
        </h1>

        <div className="flex flex-col md:flex-row gap-12">
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      window.history.replaceState(null, '', `#${item.id}`);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide uppercase transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                    data-testid={`tab-${item.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {typeof item.count === 'number' && (
                      <span className="text-xs text-muted-foreground/70">({item.count})</span>
                    )}
                  </button>
                );
              })}
              <div className="h-px bg-border my-2 hidden md:block" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide uppercase text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded-sm"
              >
                <LogOut className="w-4 h-4" /> {shopper ? 'Log Out' : 'Sign In'}
              </button>
            </nav>
          </aside>

          <main className="flex-1 min-h-[400px]">
            {activeTab === 'orders' && <OrdersTab shopperId={shopper?.id ?? null} />}

            {activeTab === 'subscriptions' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-2xl font-serif font-medium mb-6">Tea Ritual Subscriptions</h2>
                <SubscriptionsPanel enabled={!!shopper} />
              </motion.div>
            )}

            {activeTab === 'rewards' && <RewardsTab shopperId={shopper?.id ?? null} />}

            {activeTab === 'gift-cards' && <GiftCardsTab />}

            {activeTab === 'wishlist' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center justify-between mb-6 gap-3">
                  <h2 className="text-2xl font-serif font-medium">Your Wishlist</h2>
                  {wishlistedProducts.length > 0 && (
                    <button
                      onClick={handleShareWishlist}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 px-3 py-2 border border-primary/30 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                      aria-label="Share wishlist"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                  )}
                </div>
                {!hasHydrated ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" aria-busy="true">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex gap-4 border border-border p-4 rounded animate-pulse"
                      >
                        <div className="w-24 h-24 rounded bg-muted" />
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="h-4 w-2/3 bg-muted rounded" />
                          <div className="h-3 w-1/3 bg-muted rounded" />
                          <div className="mt-auto h-3 w-16 bg-muted rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : wishlistedProducts.length === 0 ? (
                  <EmptyState
                    icon={Heart}
                    title="Your wishlist is empty."
                    cta={{ href: '/shop', label: 'Explore Teas' }}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {wishlistedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex gap-4 border border-border p-4 rounded"
                      >
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-24 h-24 object-cover rounded bg-muted"
                        />
                        <div className="flex-1 flex flex-col">
                          <Link
                            href={`/product/${product.slug}`}
                            className="font-serif font-medium text-lg hover:text-primary transition-colors"
                          >
                            {product.name}
                          </Link>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatPrice(product.price, currency)}
                          </p>
                          <button
                            onClick={() => toggleWishlist(product.slug)}
                            className="mt-auto text-xs uppercase tracking-wider text-destructive hover:underline text-left"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-2xl font-serif font-medium mb-6">Ritual History</h2>
                <div className="space-y-6">
                  <div className="p-6 bg-muted/30 rounded border border-border">
                    <h3 className="font-medium mb-2">Morning Focus</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      You typically enjoy Green Tea or White Tea in the mornings. We recommend
                      trying our Himalayan Spring Green Tea next.
                    </p>
                  </div>
                  <div className="p-6 bg-muted/30 rounded border border-border">
                    <h3 className="font-medium mb-2">Evening Calm</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your evening rituals heavily feature Floral Tisanes. The Ruby Hibiscus is a
                      great addition to this routine.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-2xl font-serif font-medium mb-6">Saved Preferences</h2>
                <form className="space-y-5 max-w-md" onSubmit={handleSavePrefs}>
                  <div>
                    <label htmlFor="pref-name" className="block text-sm font-medium mb-2">
                      Name
                    </label>
                    <input
                      id="pref-name"
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-4 py-3 border border-border bg-transparent rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus:border-primary text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="pref-email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="pref-email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-border bg-transparent rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus:border-primary text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="pref-method" className="block text-sm font-medium mb-2">
                      Preferred Brewing Method
                    </label>
                    <select
                      id="pref-method"
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value)}
                      className="w-full px-4 py-3 border border-border bg-transparent rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus:border-primary text-base sm:text-sm"
                    >
                      <option>Loose Leaf (Teapot)</option>
                      <option>Loose Leaf (Infuser)</option>
                      <option>Traditional Chai Boiling</option>
                      <option>Iced / Cold Brew</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-foreground text-background uppercase tracking-widest text-sm font-medium hover:bg-foreground/90 transition-colors min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2 rounded-sm"
                  >
                    Save Changes
                  </button>
                </form>
              </motion.div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Orders tab — real backend, with Track / Invoice / Re-order actions
// ─────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending payment', cls: 'bg-amber-100 text-amber-900' },
  paid: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-900' },
  processing: { label: 'Preparing', cls: 'bg-sky-100 text-sky-900' },
  shipped: { label: 'Shipped', cls: 'bg-indigo-100 text-indigo-900' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-200 text-emerald-900' },
  cancelled: { label: 'Cancelled', cls: 'bg-stone-200 text-stone-700' },
  refunded: { label: 'Refunded', cls: 'bg-stone-200 text-stone-700' },
};

function OrdersTab({ shopperId }: { shopperId: string | null }) {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currency = useStore((s) => s.currency);
  const addToCart = useStore((s) => s.addToCart);
  const { toast } = useToast();
  const { products } = useProducts();

  useEffect(() => {
    if (!shopperId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchMyOrders()
      .then((rows) => {
        if (alive) {
          setOrders(rows);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shopperId]);

  const productsBySlug = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return map;
  }, [products]);

  const handleReorder = (order: CustomerOrder) => {
    let added = 0;
    for (const item of order.items) {
      const p = productsBySlug.get(item.productId);
      if (!p) continue;
      const variant = p.variants.find((v) => v.size === item.variantSize) ?? p.variants[0];
      if (!variant) continue;
      addToCart(p, variant, item.quantity, item.subscription);
      added += item.quantity;
    }
    if (added > 0) {
      toast({
        title: `${added} item${added === 1 ? '' : 's'} added to cart`,
        description: 'Head to checkout when you are ready.',
      });
    } else {
      toast({
        title: 'Could not re-order',
        description: 'These products are no longer available.',
      });
    }
  };

  if (!shopperId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-serif font-medium mb-6">Recent Orders</h2>
        <EmptyState
          icon={Package}
          title="Sign in to see your orders."
          subtitle="Use the same email you checked out with — guest orders show up automatically."
          cta={{ href: '/shop', label: 'Continue shopping' }}
        />
      </motion.div>
    );
  }
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-serif font-medium mb-6">Recent Orders</h2>
        <div className="border border-border rounded p-10 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your orders…
        </div>
      </motion.div>
    );
  }
  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-serif font-medium mb-6">Recent Orders</h2>
        <div className="border border-rose-200 bg-rose-50 text-rose-900 rounded p-6 text-sm">
          {error}
        </div>
      </motion.div>
    );
  }
  if (!orders || orders.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-serif font-medium mb-6">Recent Orders</h2>
        <EmptyState
          icon={Package}
          title="You haven't placed any orders yet."
          cta={{ href: '/shop', label: 'Start Your Journey' }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h2 className="text-2xl font-serif font-medium mb-6">Recent Orders</h2>
      <div className="space-y-4">
        {orders.map((order) => {
          const meta = STATUS_BADGE[order.status] ?? {
            label: order.status,
            cls: 'bg-stone-200 text-stone-800',
          };
          return (
            <div
              key={order.id}
              className="border border-border rounded p-4 sm:p-5 bg-white"
              data-testid={`order-row-${order.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Order #{order.id}
                    {order.invoiceNumber && (
                      <span className="ml-2 text-emerald-700 font-mono text-[11px]">
                        {order.invoiceNumber}
                      </span>
                    )}
                  </div>
                  <div className="font-serif text-lg">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {formatPrice(order.total, currency)}
                  </div>
                </div>
                <span
                  className={`text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded ${meta.cls}`}
                >
                  {meta.label}
                </span>
              </div>

              <ul className="text-sm space-y-1 mb-3">
                {order.items.slice(0, 4).map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {it.productName}
                      <span className="text-muted-foreground"> · {it.variantSize}</span> ×{' '}
                      {it.quantity}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatPrice(it.unitPrice * it.quantity, currency)}
                    </span>
                  </li>
                ))}
                {order.items.length > 4 && (
                  <li className="text-xs text-muted-foreground">
                    + {order.items.length - 4} more item
                    {order.items.length - 4 === 1 ? '' : 's'}
                  </li>
                )}
              </ul>

              {order.shipment && (
                <div className="mb-3 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <Truck className="h-3.5 w-3.5" />
                  <span>
                    {order.shipment.courierCode}
                    {order.shipment.awb && ` · AWB ${order.shipment.awb}`}
                  </span>
                  {order.shipment.expectedDeliveryAt && !order.shipment.deliveredAt && (
                    <span>
                      · ETA{' '}
                      {new Date(order.shipment.expectedDeliveryAt).toLocaleDateString('en-IN')}
                    </span>
                  )}
                  {order.shipment.deliveredAt && (
                    <span className="text-emerald-700">
                      · Delivered{' '}
                      {new Date(order.shipment.deliveredAt).toLocaleDateString('en-IN')}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {order.shipment?.trackingUrl && (
                  <a
                    href={order.shipment.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 border border-primary/30 text-primary rounded-sm hover:bg-primary/5"
                  >
                    <ExternalLink className="h-3 w-3" /> Track
                  </a>
                )}
                <a
                  href={invoiceUrl(order.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 border border-border text-foreground rounded-sm hover:bg-muted"
                >
                  <Download className="h-3 w-3" />
                  {order.invoiceNumber ? 'Tax Invoice' : 'Order Receipt'}
                </a>
                <button
                  onClick={() => handleReorder(order)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 border border-border text-foreground rounded-sm hover:bg-muted"
                >
                  <RefreshCcw className="h-3 w-3" /> Re-order
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rewards tab — points balance + recent ledger
// ─────────────────────────────────────────────────────────────────────

function RewardsTab({ shopperId }: { shopperId: string | null }) {
  const { data, isLoading } = useLoyalty(!!shopperId);
  const currency = useStore((s) => s.currency);
  if (!shopperId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-serif font-medium mb-6">Tea Club Rewards</h2>
        <EmptyState
          icon={Sparkles}
          title="Sign in to see your points."
          subtitle="Earn 1 point for every ₹10 spent. Redeem for instant discounts at checkout."
          cta={{ href: '/rewards', label: 'How it works' }}
        />
      </motion.div>
    );
  }
  if (isLoading || !data) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-serif font-medium mb-6">Tea Club Rewards</h2>
        <div className="border border-border rounded p-10 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rewards…
        </div>
      </motion.div>
    );
  }
  const balance = data.account.pointsBalance;
  const lifetime = data.account.lifetimePoints;
  const redeemValue = Math.floor(balance * data.config.rupeesPerPointRedeem);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h2 className="text-2xl font-serif font-medium mb-6">Tea Club Rewards</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded p-5 bg-[#1a2416] text-amber-100">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80 mb-1">
            Available
          </div>
          <div className="text-3xl font-serif font-medium tabular-nums">{balance}</div>
          <div className="text-xs text-amber-200/70 mt-1">
            ≈ {formatPrice(redeemValue, currency)} off
          </div>
        </div>
        <div className="rounded p-5 border border-border">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Lifetime
          </div>
          <div className="text-3xl font-serif font-medium tabular-nums">{lifetime}</div>
        </div>
        <div className="rounded p-5 border border-border">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Earn rate
          </div>
          <div className="text-sm font-medium leading-tight">
            1 point per ₹{(1 / data.config.pointsPerRupeeEarn).toFixed(0)} spent
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Redeem at checkout — up to {Math.round(data.config.redeemMaxPctOfSubtotal * 100)}% of
            subtotal.
          </div>
        </div>
      </div>

      <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground mb-3">
        Recent activity
      </h3>
      {data.ledger.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">
          No activity yet. Place an order to start earning.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded">
          {data.ledger.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between px-4 py-3 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Coins
                  className={`h-4 w-4 flex-shrink-0 ${
                    entry.points >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm truncate">
                    {entry.note || (entry.kind === 'earn' ? 'Earned' : 'Redeemed')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {entry.orderId && ` · Order #${entry.orderId}`}
                  </div>
                </div>
              </div>
              <span
                className={`tabular-nums font-medium ${
                  entry.points >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {entry.points > 0 ? '+' : ''}
                {entry.points}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Link
          href="/rewards"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
        >
          Read full Tea Club terms <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Gift cards tab — check balance + buy CTA
// ─────────────────────────────────────────────────────────────────────

function GiftCardsTab() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<
    { ok: true; balance: number; expiresAt: string; status: string } | { ok: false; reason: string } | null
  >(null);
  const currency = useStore((s) => s.currency);
  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    try {
      const r = await checkGiftCard(code.trim());
      setResult(r);
    } finally {
      setChecking(false);
    }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h2 className="text-2xl font-serif font-medium mb-6">Gift Cards</h2>

      <div className="rounded p-5 bg-[#FAF8F4] border border-border mb-8">
        <h3 className="text-sm uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" /> Check a gift-card balance
        </h3>
        <form onSubmit={handleCheck} className="flex flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DRTEA-XXXX-XXXX"
            className="flex-1 min-w-[12rem] px-3 py-2 border border-border bg-white rounded text-sm font-mono"
          />
          <button
            type="submit"
            disabled={checking || !code.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded text-xs uppercase tracking-wider font-bold disabled:opacity-60"
          >
            {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Check
          </button>
        </form>
        {result && (
          <div className="mt-3 text-sm">
            {result.ok ? (
              <div className="rounded bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900">
                Active balance: <strong>{formatPrice(result.balance, currency)}</strong> · expires{' '}
                {new Date(result.expiresAt).toLocaleDateString('en-IN')}
                <span className="ml-2 text-xs uppercase tracking-wider opacity-75">
                  ({result.status})
                </span>
              </div>
            ) : (
              <div className="rounded bg-rose-50 border border-rose-200 px-3 py-2 text-rose-900">
                {result.reason === 'not_found'
                  ? "We couldn't find that code. Double-check the spelling."
                  : `Code unavailable: ${result.reason}`}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded p-6 bg-[#1a2416] text-amber-100 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80 mb-1">
            For tea lovers
          </div>
          <h3 className="text-xl font-serif font-medium">Send a Dr Tea Gift Card</h3>
          <p className="text-sm text-amber-200/80 mt-1 max-w-md">
            Pick any value from ₹500 to ₹10,000. Delivered instantly by email with a personal
            note.
          </p>
        </div>
        <Link
          href="/gift-cards"
          className="inline-flex items-center gap-2 px-4 py-3 bg-amber-200 text-[#1a2416] rounded-md font-bold uppercase tracking-widest text-[12px] hover:bg-amber-100 transition-colors flex-shrink-0"
        >
          <Gift className="h-4 w-4" /> Buy a card
        </Link>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  cta,
}: {
  icon: typeof Package;
  title: string;
  subtitle?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="border border-border rounded text-center py-20 px-6">
      <Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
      <p className="text-muted-foreground mb-2">{title}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground/70 mb-4 max-w-sm mx-auto">{subtitle}</p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="text-sm uppercase tracking-widest font-medium text-primary hover:underline"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
