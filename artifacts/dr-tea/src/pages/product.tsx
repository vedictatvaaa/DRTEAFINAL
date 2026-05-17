import { useState, useMemo, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Star, Leaf, Heart, ArrowRight, Check, Droplets, Clock, Minus, Plus, Sparkles,
  MapPin, Flame, AlertCircle, Package, Award, Sprout, Hand, Factory, BookOpen,
  Coffee, Moon, Sun, ShieldCheck, Wind, Quote,
} from 'lucide-react';
import { type Product } from '@/data/products';
import { useProducts, useProduct } from '@/lib/api-data';
import { useStore } from '@/store/use-store';
import { unitPriceFor, SUBSCRIPTION_DISCOUNT } from '@/lib/cart-pricing';
import { useShopper } from '@/lib/shopper-auth';
import { useToast } from '@/hooks/use-toast';
import {
  useProductReviews,
  submitReview,
  markReviewHelpful,
  loadHelpfulVotes,
  saveHelpfulVote,
} from '@/lib/reviews';
import { track } from '@/lib/analytics';
import Seo from '@/components/Seo';
import Breadcrumbs from '@/components/Breadcrumbs';
import PdpTrustBar from '@/components/product/PdpTrustBar';
import { GENERIC_PLACEHOLDER_URLS } from '@/components/product/ProductImage';
import { formatPrice } from '@/lib/currency';
import {
  usePdpTheme, configForCategory, getIngredientSpotlights,
  gramsFromSize, estimatedDuration, splitNotes, pickFomo,
  type FomoMessage,
} from '@/lib/pdp-theme';

const FOMO_ICONS = { flame: Flame, sprout: Sprout, package: Package, award: Award, sparkles: Sparkles, heart: Heart } as const;

function FomoBadge({ msg, themePrimary, variant }: { msg: FomoMessage; themePrimary: string; variant: 'hero' | 'inline' }) {
  const Icon = FOMO_ICONS[msg.iconKey];
  const solid = `hsl(${themePrimary})`;
  if (variant === 'hero') {
    return (
      <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold rounded-full shadow-sm" style={{ color: solid }}>
        <Icon className="w-3 h-3" /> {msg.text}
      </div>
    );
  }
  return (
    <div className="mb-5 inline-flex items-center gap-2 self-start px-3 py-2 rounded-full text-[11px] font-medium border" style={{ borderColor: `hsl(${themePrimary} / 0.25)`, color: solid, background: `hsl(${themePrimary} / 0.05)` }}>
      <Icon className="w-3.5 h-3.5" /> {msg.text}
    </div>
  );
}

function useRestockCountdown(stock: number) {
  const target = useMemo(() => Date.now() + (12 + (stock % 6)) * 60 * 60 * 1000, [stock]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, target - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { h, m, s };
}

function RestockCountdown({ stock }: { stock: number }) {
  const { h, m, s } = useRestockCountdown(stock);
  if (stock >= 20) return null;
  const pct = Math.min(100, Math.max(8, (stock / 20) * 100));
  return (
    <div className="mb-5 p-3.5 rounded-lg border border-amber-200 bg-amber-50/70">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-amber-800">
          <Flame className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Only {stock} left in this batch</span>
        </div>
        <div className="flex items-center gap-1 text-amber-900 font-mono text-[11px] font-bold tabular-nums">
          <AlertCircle className="w-3 h-3" />
          <span>{String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s</span>
        </div>
      </div>
      <div className="w-full h-1 bg-amber-100 rounded-full overflow-hidden mb-1.5">
        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 motion-safe:transition-all motion-safe:duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-amber-800/70 leading-snug">Next harvest restock in the timer above. Reserve now to lock in this season.</p>
    </div>
  );
}

interface ProductForReviews {
  id: string;
  slug: string;
  name: string;
  rating: number;
  reviewCount: number;
  category: string;
  tastingNotes: string[];
}

function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Stable-but-living live-activity signals derived from the product slug so
// every visitor sees the same baseline; numbers drift gently over time so the
// badges feel real-time without faking a backend.
function useLiveActivity(slug: string, totalStock: number) {
  const seed = useMemo(() => hashSlug(slug), [slug]);
  const baseViewers = 8 + (seed % 23); // 8–30
  const soldToday = 4 + (seed % 17);   // 4–20
  const lastBoughtMin = 1 + (seed % 27);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 7000);
    return () => clearInterval(id);
  }, []);
  const drift = ((seed >> 3) + tick * 3) % 7; // gentle ±3 wobble
  const viewers = Math.max(3, baseViewers + (drift - 3));
  const lowStock = totalStock > 0 && totalStock < 25;
  return { viewers, soldToday, lastBoughtMin, lowStock };
}

function ProductGallery({
  product,
  themeColor,
  themePrimary,
  fomo,
  isWishlisted,
  onWishlistToggle,
}: {
  product: Product;
  themeColor: string;
  themePrimary: string;
  fomo: FomoMessage | null;
  isWishlisted: boolean;
  onWishlistToggle: () => void;
}) {
  const gallery = useMemo(() => {
    // Treat the shared generic stock images as "missing" so the branded
    // placeholder shows instead of a duplicate, identity-less photo. The
    // list is owned by <ProductImage> to keep behaviour in one place.
    if (product.images && product.images.length > 0) {
      const filtered = product.images.filter((im) => !GENERIC_PLACEHOLDER_URLS.has(im.url));
      if (filtered.length > 0) return filtered;
    }
    if (product.imageUrl && !GENERIC_PLACEHOLDER_URLS.has(product.imageUrl)) {
      return [{ url: product.imageUrl, kind: 'studio' as const }];
    }
    return [];
  }, [product.images, product.imageUrl]);

  const defaultIdx = useMemo(() => {
    const heroIdx = gallery.findIndex((g) => g.kind === 'hero');
    return heroIdx >= 0 ? heroIdx : 0;
  }, [gallery]);

  const [activeIdx, setActiveIdx] = useState(defaultIdx);
  useEffect(() => { setActiveIdx(defaultIdx); }, [product.id, defaultIdx]);
  const active = gallery[activeIdx] ?? gallery[0];

  // Hover/touch zoom — origin tracks the cursor.
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gallery.length < 2) return;
      if (e.key === 'ArrowLeft') setActiveIdx((i) => (i - 1 + gallery.length) % gallery.length);
      else if (e.key === 'ArrowRight') setActiveIdx((i) => (i + 1) % gallery.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gallery.length]);

  const totalStock = useMemo(
    () => (product.variants ?? []).reduce((s, v) => s + (v.stock ?? 0), 0),
    [product.variants],
  );
  const { viewers, soldToday, lastBoughtMin, lowStock } = useLiveActivity(product.slug, totalStock);

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-muted shadow-sm group cursor-zoom-in"
        onMouseMove={onMove}
        onMouseLeave={() => setZoomOrigin(null)}
      >
        {active ? (
          <img
            key={active.url}
            src={active.url}
            alt={active.alt ?? product.name}
            onError={(e) => {
              // Fall back to branded placeholder on broken URL by hiding the
              // <img> and revealing the sibling placeholder beneath it.
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const ph = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (ph) ph.style.display = 'flex';
            }}
            className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-300"
            style={zoomOrigin ? {
              transform: 'scale(1.6)',
              transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
            } : undefined}
          />
        ) : null}
        {/* Branded placeholder — visible when there's no image, or revealed
            by the <img>'s onError handler when the URL fails. */}
        <div
          style={{ display: active ? 'none' : 'flex', background: `linear-gradient(140deg, #1a2416 0%, ${themeColor})` }}
          className="absolute inset-0 flex-col items-center justify-center text-white"
          aria-hidden={active ? 'true' : 'false'}
        >
          <span className="font-serif italic text-5xl sm:text-6xl tracking-tight text-white/90 drop-shadow-sm select-none">
            {product.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          </span>
          <span className="mt-2 px-4 text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/70 text-center max-w-[80%]">
            {product.name}
          </span>
          <span className="absolute bottom-3 inset-x-0 text-center text-[8px] tracking-[0.32em] text-white/40 uppercase font-serif">
            Dr Tea
          </span>
        </div>
        <div
          className="absolute inset-0 mix-blend-multiply opacity-15 pointer-events-none"
          style={{ background: `linear-gradient(160deg, transparent 40%, ${themeColor})` }}
          aria-hidden="true"
        />

        {/* Live viewers — top-right column, stacks above wishlist */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 bg-black/65 backdrop-blur text-white px-2.5 py-1 rounded-full text-[10px] font-semibold tabular-nums">
            <span className="relative flex h-1.5 w-1.5">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            {viewers} viewing now
          </div>
          <button
            onClick={onWishlistToggle}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className="pointer-events-auto w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-md motion-safe:hover:scale-105 motion-safe:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
          >
            <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
          </button>
        </div>

        {fomo && <FomoBadge msg={fomo} themePrimary={themePrimary} variant="hero" />}

        {/* Low-stock pulse ribbon — bottom-left */}
        {lowStock && (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-amber-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md motion-safe:animate-pulse">
            <Flame className="w-3 h-3" /> Only {totalStock} left
          </div>
        )}

        {/* Image counter + kind tag — bottom-right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 pointer-events-none">
          {active?.kind === 'hero' && (
            <span className="bg-white/90 text-foreground px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold">
              Lifestyle
            </span>
          )}
          {gallery.length > 1 && (
            <span className="bg-black/55 text-white px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums">
              {activeIdx + 1} / {gallery.length}
            </span>
          )}
        </div>
      </div>

      {/* Live social-proof ticker */}
      <div className="flex items-center justify-between gap-3 px-1 text-[11px]">
        <div className="inline-flex items-center gap-1.5 text-emerald-700">
          <Sparkles className="w-3 h-3" />
          <span><span className="font-semibold tabular-nums">{soldToday}</span> ordered today</span>
        </div>
        <div className="text-muted-foreground tabular-nums">
          Last bought <span className="font-medium text-foreground">{lastBoughtMin} min ago</span>
        </div>
      </div>

      {gallery.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {gallery.slice(0, 5).map((im, i) => (
            <button
              key={`${im.url}-${i}`}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === activeIdx}
              className={`relative aspect-square rounded-md overflow-hidden border bg-white motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${
                i === activeIdx ? 'border-foreground/50 ring-1 ring-foreground/20 scale-[1.02]' : 'border-border hover:border-foreground/30 opacity-80 hover:opacity-100'
              }`}
            >
              <img src={im.url} alt={`${product.name} — ${im.kind === 'hero' ? 'lifestyle' : 'product'} view ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              {im.kind === 'hero' && (
                <span className="absolute bottom-0 left-0 right-0 text-[8px] uppercase tracking-wider font-semibold bg-black/55 text-white text-center py-0.5">
                  Lifestyle
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10.5px] italic text-muted-foreground/80 leading-snug px-0.5">
        * Pack designs and formats may change periodically.
        <span className="hidden md:inline"> Hover the image to zoom.</span>
        <span className="md:hidden"> Tap thumbnails to explore.</span>
      </p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  return `${Math.round(mo / 12)} year ago`;
}

function ReviewStars({ rating, size = 'w-3.5 h-3.5' }: { rating: number; size?: string }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

function ProductReviews({ product }: { product: ProductForReviews }) {
  const { user } = useShopper();
  const { data, loading, error, refetch } = useProductReviews(product.id);
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ rating: 5, title: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState<Set<number>>(new Set());
  const [helpfulBusyId, setHelpfulBusyId] = useState<number | null>(null);

  useEffect(() => { setHelpfulVotes(loadHelpfulVotes()); }, []);

  const reviews = data?.reviews ?? [];
  const realCount = data?.summary.count ?? 0;
  // Display rating: prefer real DB average once we have any reviews. Fall
  // back to the catalog's editorial rating so brand-new products still have
  // a believable star line above the empty list.
  const displayRating = realCount > 0 ? data!.summary.average : product.rating;
  const userAlreadyReviewed = !!user && reviews.some((r) => r.isMine);
  const visibleReviews = expanded ? reviews : reviews.slice(0, 4);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Sign in to post a review', description: 'Reviews are tied to your account so we can verify purchases.' });
      return;
    }
    if (draft.body.trim().length < 10) {
      toast({ title: 'Add a little more detail', description: 'Reviews need at least 10 characters.' });
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({ productId: product.id, rating: draft.rating, title: draft.title.trim(), body: draft.body.trim() });
      toast({ title: userAlreadyReviewed ? 'Review updated' : 'Review posted', description: 'Thank you for sharing your experience.' });
      setDraft({ rating: 5, title: '', body: '' });
      setShowForm(false);
      await refetch();
    } catch (err) {
      toast({ title: 'Could not post review', description: err instanceof Error ? err.message : 'Try again in a moment.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function onHelpful(id: number) {
    if (helpfulVotes.has(id) || helpfulBusyId === id) return;
    setHelpfulBusyId(id);
    try {
      await markReviewHelpful(id);
      saveHelpfulVote(id);
      setHelpfulVotes((prev) => new Set(prev).add(id));
      await refetch();
    } catch {
      toast({ title: 'Could not record vote', variant: 'destructive' });
    } finally {
      setHelpfulBusyId(null);
    }
  }

  return (
    <section className="container mx-auto px-4 sm:px-6 mb-10" id="reviews">
      <div className="border-t border-border pt-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Customer Reviews</p>
            <h2 className="text-2xl sm:text-3xl font-serif font-semibold">What our community says</h2>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-bold">{displayRating.toFixed(1)}</span>
                <ReviewStars rating={Math.round(displayRating)} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {realCount > 0
                  ? `Based on ${realCount} customer review${realCount === 1 ? '' : 's'}`
                  : `Editorial rating · be the first to review`}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-[12px] text-destructive mb-4">Could not load reviews. <button onClick={() => void refetch()} className="underline">Retry</button></p>
        )}

        {loading && reviews.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center">
            <Star className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[13px] font-medium mb-1">No reviews yet</p>
            <p className="text-[11px] text-muted-foreground">Tried this tea? Share what you thought — your words help fellow tea lovers choose with confidence.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {visibleReviews.map((r) => {
              const voted = helpfulVotes.has(r.id);
              return (
                <article key={r.id} className={`border rounded-xl p-4 ${r.isMine ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
                  <header className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${r.isMine ? 'bg-primary/15' : 'bg-primary/10'} text-primary flex items-center justify-center text-xs font-bold`}>
                        {r.authorInitials}
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold leading-tight">{r.authorName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.isMine ? 'Your review · ' : ''}{timeAgo(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    {r.isMine ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">Your review</span>
                    ) : r.verifiedPurchase ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">✓ Verified</span>
                    ) : null}
                  </header>
                  <div className="mb-2"><ReviewStars rating={r.rating} /></div>
                  {r.title && <p className="text-[12.5px] font-semibold mb-1">{r.title}</p>}
                  <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">{r.body}</p>
                  <button
                    onClick={() => void onHelpful(r.id)}
                    disabled={voted || r.isMine || helpfulBusyId === r.id}
                    className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {voted ? '✓ Helpful' : 'Helpful'} {r.helpfulCount > 0 && `(${r.helpfulCount})`}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {!expanded && reviews.length > 4 && (
          <div className="text-center mt-5">
            <button onClick={() => setExpanded(true)} className="text-[11px] font-bold uppercase tracking-wider text-primary underline">
              Read all {realCount} reviews
            </button>
          </div>
        )}

        <div className="mt-8 border-t border-border pt-6">
          {!user ? (
            <div className="text-center">
              <p className="text-[12px] text-muted-foreground mb-3">Sign in to share your experience with this tea.</p>
              <Link href="/account" className="inline-flex items-center gap-2 px-5 py-3 border-2 border-primary text-primary text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-primary hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]">
                Sign in to write a review
              </Link>
            </div>
          ) : !showForm ? (
            <div className="text-center">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-5 py-3 border-2 border-primary text-primary text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-primary hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
              >
                {userAlreadyReviewed ? 'Update your review' : 'Write a review'}
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="max-w-lg mx-auto bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Your rating</label>
                <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={draft.rating === n}
                      aria-label={`${n} star${n === 1 ? '' : 's'}`}
                      onClick={() => setDraft(d => ({ ...d, rating: n }))}
                      className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                    >
                      <Star className={`w-6 h-6 motion-safe:transition-colors ${n <= draft.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1" aria-live="polite">{draft.rating} star{draft.rating === 1 ? '' : 's'} selected</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Headline (optional)</label>
                <input
                  type="text" maxLength={120} value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                  placeholder="Sum it up in a few words"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Your review</label>
                <textarea
                  required rows={4} minLength={10} maxLength={2000} value={draft.body}
                  onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                  placeholder="What did you think of this tea?"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-primary/90 disabled:opacity-50">
                  {submitting ? 'Posting…' : userAlreadyReviewed ? 'Update review' : 'Post review'}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Posting as {user.name || user.email}. {userAlreadyReviewed && 'This will replace your existing review.'}</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const [, params] = useRoute('/product/:slug');
  const slug = params?.slug;
  const { product, isLoading: productLoading } = useProduct(slug);
  const { products } = useProducts();
  const reduceMotion = useReducedMotion();

  const { addToCart, toggleWishlist, wishlist } = useStore();
  const currency = useStore((s) => s.currency);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [subscribe, setSubscribe] = useState(false);
  const addBtnRef = useRef<HTMLDivElement>(null);

  // Always call hooks unconditionally; theme falls back to default for unknown categories.
  const cfg = usePdpTheme(product?.category ?? '');

  useEffect(() => {
    setSelectedVariantIdx(0);
    setQuantity(1);
    setIsAdded(false);
    setSubscribe(false);
  }, [slug]);

  useEffect(() => {
    if (product?.id) {
      track({ type: "product_view", productId: product.id });
    }
  }, [product?.id]);

  useEffect(() => {
    if (!addBtnRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(addBtnRef.current);
    return () => observer.disconnect();
  }, [product]);

  if (productLoading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">Product not found</p>
          <Link href="/shop" className="text-primary underline">Browse all teas</Link>
        </div>
      </div>
    );
  }

  const selectedVariant = product.variants[selectedVariantIdx]!;
  const isWishlisted = wishlist.includes(product.slug);

  const handleAddToCart = () => {
    addToCart(product, selectedVariant, quantity, subscribe);
    track({
      type: "add_to_cart",
      productId: product.id,
      value: selectedVariant.price * quantity,
      currency,
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const siblings: Product[] = (() => {
    const explicit = product.pairsWith
      .map(s => products.find(p => p.slug === s))
      .filter((p): p is Product => !!p && p.slug !== product.slug && p.category === product.category);
    const same = products.filter(p => p.category === product.category && p.slug !== product.slug);
    const merged: Product[] = [];
    for (const p of [...explicit, ...same]) {
      if (!merged.find(m => m.slug === p.slug)) merged.push(p);
      if (merged.length >= 3) break;
    }
    return merged;
  })();

  // Prefer admin/AI-curated related teas when present; fall back to same-category.
  const curatedRelatedIds = product.relatedProductIds ?? [];
  const curatedRelated = curatedRelatedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p);
  const relatedProducts = (
    curatedRelated.length > 0
      ? curatedRelated
      : products.filter((p) => p.category === product.category && p.slug !== product.slug)
  ).slice(0, 4);

  const themePrimary = product.categoryTheme.primary;
  const themeBgRaw = product.categoryTheme.bg;
  const themeColor = `hsl(${themePrimary})`;
  const themeBg = `hsl(${themeBgRaw})`;
  const ta = (a: number) => `hsl(${themePrimary} / ${a})`;
  const ba = (a: number) => `hsl(${themeBgRaw} / ${a})`;

  const fomo = pickFomo(product, selectedVariant.stock);
  const showRestock = selectedVariant.stock < 20;
  // FOMO budget: at most one signal in the hero, and at most one near the variant picker.
  // The hero badge always wins for fomo. The variant area shows the restock countdown when
  // stock is low; otherwise it surfaces the soft FOMO chip there instead.
  const showInlineFomo = !!fomo && !showRestock;

  const duration = estimatedDuration(gramsFromSize(selectedVariant.size), cfg.dailyCups);
  const notes = splitNotes(product.tastingNotes);
  const ingredientCards = getIngredientSpotlights(product.category, product.ingredients);

  const processSteps: Array<{ Icon: typeof Sprout; title: string; body: string }> = [
    { Icon: Sprout,  title: 'Cultivation', body: `Grown in ${product.origin}, where climate, altitude, and seasonal rainfall shape the leaf's character.` },
    { Icon: Hand,    title: 'Harvest',     body: `Hand-selected at the ${product.harvestSeason.toLowerCase()} peak to preserve aroma, colour, and natural sweetness.` },
    { Icon: Factory, title: 'Processing',  body: 'Crafted in small batches under controlled conditions to protect the freshness of every leaf, flower, and root.' },
    { Icon: Package, title: 'Packaging',   body: 'Hygienically sealed in freshness-locked packaging the day it is packed — garden to cup, intact.' },
  ];

  const brewLabels = product.category === 'Chai' || product.category === 'Kadha'
    ? { water: 'Water + Milk', amount: 'Tea per cup', steep: 'Simmer time', best: 'Best enjoyed' }
    : { water: 'Water temp', amount: 'Tea per cup', steep: 'Steep time', best: 'Best enjoyed' };
  const bestEnjoyed: Record<string, string> = {
    morning: 'In the morning, with a quiet ten minutes',
    evening: 'In the evening, before bed',
    ceremonial: 'On a slow Sunday or a special tasting',
    everyday: 'Anytime you need a small ritual',
  };

  // Render bare benefit titles for visual cleanliness; the regulatory
  // framing ("Traditionally supports …") is consolidated into a single
  // footnote under the section instead of being repeated on every card.
  // Pre-existing non-claim phrasings ("Rich in …", "Naturally …") stay
  // verbatim because they're not health-claim adjacent.
  const compliantBenefit = (b: string) => {
    const lower = b.toLowerCase();
    if (lower.startsWith('rich in') || lower.startsWith('high ') || lower.startsWith('naturally')) return b;
    return b.charAt(0).toUpperCase() + b.slice(1);
  };

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://drtea.in/' },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://drtea.in/shop' },
          { '@type': 'ListItem', position: 3, name: product.category, item: `https://drtea.in/shop/${product.category.toLowerCase().replace(/ /g, '-')}` },
          { '@type': 'ListItem', position: 4, name: product.name, item: `https://drtea.in/product/${product.slug}` },
        ],
      },
      {
        '@type': 'Product',
        name: product.name,
        sku: product.id,
        image: (product.images && product.images.length > 0
          ? product.images.map((i) => i.url)
          : [product.imageUrl]),
        description: product.description,
        category: product.category,
        brand: { '@type': 'Brand', name: 'Dr Tea' },
        aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount, bestRating: 5, worstRating: 1 },
        offers: product.variants.map(v => ({
          '@type': 'Offer', priceCurrency: 'INR', price: v.price,
          sku: `${product.id}-${v.size}`,
          availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `https://drtea.in/product/${product.slug}`,
          seller: { '@type': 'Organization', name: 'Dr Tea' },
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: v.price >= 999 ? 0 : 49, currency: 'INR' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
          },
        })),
      },
    ],
  };
  // Prefer admin/AI-curated SEO meta + JSON-LD from the API; fall back to legacy
  // hardcoded values when the catalog hasn't been backfilled yet.
  const fallbackSeoTitle = `${product.name} — ${product.category} | Dr Tea`;
  const fallbackSeoDesc = `${product.description.slice(0, 150)}… ₹${product.price}. Single-origin ${product.category.toLowerCase()} from Dr Tea. ${product.tastingNotes.slice(0, 3).join(', ')}.`;
  const seoTitle = product.metaTitle ?? fallbackSeoTitle;
  const seoDesc = product.metaDescription ?? fallbackSeoDesc;
  const effectiveJsonLd = product.jsonLd ?? productJsonLd;

  const ugcImages = ['/images/community-1.webp', '/images/community-2.webp', '/images/community-3.webp', '/images/community-4.webp'];

  return (
    <div className="min-h-screen bg-background pt-4 sm:pt-8 lg:pt-12 pb-20 sm:pb-12">
      <Seo
        title={seoTitle}
        description={seoDesc}
        canonical={`https://drtea.in/product/${product.slug}`}
        ogImage={product.imageUrl}
        jsonLd={effectiveJsonLd}
        jsonLdId="ld-product"
      />

      {/* Hero */}
      <section className="relative">
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{ background: cfg.heroGradient }}
          aria-hidden="true"
        />
        <div className="container mx-auto px-4 sm:px-6 py-6 md:py-12">
          <Breadcrumbs
            className="mb-4"
            items={[
              { label: 'Shop', href: '/shop' },
              { label: product.category, href: `/shop/${product.category.toLowerCase().replace(/ /g, '-')}` },
              { label: product.name },
            ]}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

            <ProductGallery
              product={product}
              themeColor={themeColor}
              themePrimary={themePrimary}
              fomo={fomo}
              isWishlisted={isWishlisted}
              onWishlistToggle={() => toggleWishlist(product.slug)}
            />


            <div className="flex flex-col">
              <p className="text-[11px] uppercase tracking-[0.25em] mb-2 font-semibold" style={{ color: themeColor }}>
                {cfg.eyebrow} · {product.category}
              </p>
              <h1 className={`text-3xl sm:text-4xl lg:text-[2.75rem] font-serif font-semibold leading-tight mb-3 ${cfg.serifAccent}`}>
                {product.name}
              </h1>
              <div className="flex items-center gap-3 text-sm mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                  ))}
                  <span className="ml-1 font-medium text-xs">{product.rating}</span>
                </div>
                <a href="#reviews" className="text-muted-foreground text-xs underline">{product.reviewCount} reviews</a>
              </div>
              <p className="text-sm text-muted-foreground font-light leading-relaxed mb-5">{product.description}</p>

              <div className="flex flex-wrap gap-2 mb-6">
                {cfg.badges.map(b => (
                  <span key={b} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-white/80 border border-border text-foreground/80">
                    <Check className="w-3 h-3" style={{ color: themeColor }} /> {b}
                  </span>
                ))}
              </div>

              <div className="mb-5 p-4 bg-card rounded-lg border border-border">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Select Size</h3>
                  <span className="text-3xl sm:text-[32px] font-serif font-bold tabular-nums leading-none" style={{ color: themeColor }}>
                    {formatPrice(selectedVariant.price, currency)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {product.variants.map((v, idx) => (
                    <button
                      key={v.size}
                      onClick={() => setSelectedVariantIdx(idx)}
                      className={`py-2.5 text-sm font-medium motion-safe:transition-colors border rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${
                        selectedVariantIdx === idx ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:border-primary/40'
                      }`}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                    <Coffee className="w-3 h-3" /> Estimated to last
                  </p>
                  <p className="text-[11px] font-semibold" style={{ color: themeColor }}>
                    {duration} <span className="text-muted-foreground font-normal">at {cfg.dailyCups} cups/day</span>
                  </p>
                </div>
              </div>

              {/* Variant-area FOMO: low-stock countdown OR soft chip — never both. */}
              {showRestock
                ? <RestockCountdown stock={selectedVariant.stock} />
                : showInlineFomo && fomo && <FomoBadge msg={fomo} themePrimary={themePrimary} variant="inline" />}

              <button
                type="button"
                onClick={() => setSubscribe(s => !s)}
                className={`mb-5 w-full flex items-center justify-between gap-3 p-4 rounded-lg border-2 text-left motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${
                  subscribe ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                }`}
                aria-pressed={subscribe}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${subscribe ? 'border-primary bg-primary' : 'border-border'}`}>
                    {subscribe && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wider">Subscribe &amp; Save {Math.round(SUBSCRIPTION_DISCOUNT * 100)}%</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Delivered every 30 days. Pause or cancel anytime.</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-primary whitespace-nowrap">{formatPrice(unitPriceFor(selectedVariant.price, true), currency)}</span>
              </button>

              <div ref={addBtnRef} className="flex items-stretch gap-3 mb-4">
                <div className="flex items-center border border-border rounded-sm h-12 w-28">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity" className="flex-1 flex items-center justify-center text-muted-foreground hover:text-foreground h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-inset">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-sm w-8 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity" className="flex-1 flex items-center justify-center text-muted-foreground hover:text-foreground h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-inset">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className={`flex-1 h-12 uppercase tracking-wider text-xs font-bold rounded-sm motion-safe:transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${
                    isAdded ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {isAdded ? (<><Check className="w-4 h-4" /> Added to Ritual</>) :
                    subscribe ? `Subscribe · ${formatPrice(unitPriceFor(selectedVariant.price, true) * quantity, currency)}/mo`
                              : `Add to Cart · ${formatPrice(selectedVariant.price * quantity, currency)}`}
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground py-3 border-y border-border flex-wrap">
                <span className="flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5" />{product.caffeineLevel} caffeine</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{product.harvestSeason} harvest</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{product.origin.split(',')[0]}</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />FSSAI · Export Quality</span>
              </div>

              <PdpTrustBar />
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: themeColor }}>The Dr Tea Way</p>
          <h2 className={`text-3xl sm:text-4xl font-serif font-semibold leading-tight mb-5 ${cfg.serifAccent}`}>{cfg.storyHeadline}</h2>
          <p className="text-base text-muted-foreground leading-relaxed">{cfg.storyBody}</p>
        </div>
      </section>

      {/* Ingredient spotlight */}
      <section className="py-10 sm:py-14" style={{ background: ba(0.45) }}>
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: themeColor }}>Ingredient Intelligence</p>
            <h2 className="text-2xl sm:text-3xl font-serif font-semibold">What's actually in your cup</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ingredientCards.map((s, idx) => (
              <article key={idx} className="bg-white rounded-xl border border-border p-5 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ta(0.12), color: themeColor }}>
                    <Leaf className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-serif font-semibold leading-tight">{s.name}</h3>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-[12px]">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Origin</dt>
                    <dd className="text-foreground/80">{s.origin}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Flavor</dt>
                    <dd className="text-foreground/80">{s.flavor}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Traditional use</dt>
                    <dd className="text-foreground/80 leading-relaxed">{s.traditionalUse}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: themeColor }}>Why You'll Love It</p>
          <h2 className="text-2xl sm:text-3xl font-serif font-semibold">{cfg.benefitsHeadline}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {product.wellnessBenefits.slice(0, 4).map((b, i) => {
            const Icons = [Sun, Wind, Moon, ShieldCheck];
            const Icon = Icons[i % Icons.length]!;
            return (
              <div key={b} className="rounded-xl border border-border bg-card p-4 sm:p-5 text-center">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-3" style={{ background: ta(0.1), color: themeColor }}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-[12px] sm:text-[13px] font-medium leading-snug">{compliantBenefit(b)}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground/80 text-center mt-5 max-w-2xl mx-auto leading-relaxed">
          Reflects traditional Ayurvedic use of these botanicals. Not intended to diagnose, treat, cure, or prevent any disease.
        </p>
      </section>

      {/* Plantation to packaging */}
      <section className="py-12 sm:py-16" style={{ background: `linear-gradient(180deg, ${ba(0.2)}, transparent)` }}>
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: themeColor }}>From Garden to Cup</p>
            <h2 className="text-2xl sm:text-3xl font-serif font-semibold">From Plantation to Packaging</h2>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-4 gap-5 sm:gap-3 max-w-5xl mx-auto relative">
            <div className="hidden sm:block absolute top-6 left-[12.5%] right-[12.5%] h-px" style={{ background: ta(0.2) }} aria-hidden="true" />
            {processSteps.map((step, i) => (
              <li key={step.title} className="relative flex sm:flex-col gap-4 sm:gap-3 sm:text-center">
                <div className="relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center sm:mx-auto bg-white border-2 z-10" style={{ borderColor: themeColor, color: themeColor }}>
                  <step.Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: themeColor }}>Step {i + 1}</p>
                  <h3 className="text-base font-serif font-semibold mb-1.5">{step.title}</h3>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Brewing + Tasting */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: themeColor }}>Brewing Ritual</p>
            <h3 className="text-xl sm:text-2xl font-serif font-semibold mb-2">How to brew {product.name.split(' ').slice(0, 2).join(' ')}</h3>
            <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">{cfg.brewIntro}</p>
            <dl className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 rounded-lg" style={{ background: ta(0.06) }}>
                <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1"><Droplets className="w-3 h-3" /> {brewLabels.water}</dt>
                <dd className="text-sm font-semibold">{product.brewingGuide.temperature}</dd>
              </div>
              <div className="p-3 rounded-lg" style={{ background: ta(0.06) }}>
                <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1"><Leaf className="w-3 h-3" /> {brewLabels.amount}</dt>
                <dd className="text-sm font-semibold">{product.brewingGuide.teaAmount} per {product.brewingGuide.cupSize}</dd>
              </div>
              <div className="p-3 rounded-lg" style={{ background: ta(0.06) }}>
                <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1"><Clock className="w-3 h-3" /> {brewLabels.steep}</dt>
                <dd className="text-sm font-semibold">{product.brewingGuide.steepTime}</dd>
              </div>
              <div className="p-3 rounded-lg" style={{ background: ta(0.06) }}>
                <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1"><BookOpen className="w-3 h-3" /> {brewLabels.best}</dt>
                <dd className="text-sm font-semibold">{bestEnjoyed[product.ritualStyle] ?? 'Anytime'}</dd>
              </div>
            </dl>
            <ol className="space-y-2">
              {product.brewingGuide.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold flex-shrink-0" style={{ color: themeColor }}>{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: themeColor }}>Tasting Notes</p>
            <h3 className="text-xl sm:text-2xl font-serif font-semibold mb-5">A flavor profile, decoded</h3>
            <div className="space-y-4 mb-6">
              {(['top', 'mid', 'finish'] as const).map((stage, idx) => {
                const arr = notes[stage];
                if (arr.length === 0) return null;
                const labels = { top: 'Top notes', mid: 'Mid notes', finish: 'Finish' } as const;
                const subs = { top: 'First aroma off the cup', mid: 'The body', finish: 'How it lingers' } as const;
                return (
                  <div key={stage} className="flex items-start gap-3 pb-4 border-b border-border last:border-b-0 last:pb-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider tabular-nums w-6 mt-1" style={{ color: themeColor }}>0{idx + 1}</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider mb-0.5">{labels[stage]}</p>
                      <p className="text-[10px] text-muted-foreground mb-2">{subs[stage]}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {arr.map(n => (
                          <span key={n} className="px-2.5 py-1 text-[11px] rounded-full font-medium" style={{ background: ta(0.1), color: themeColor }}>{n}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                Tea Strength
                <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
                  ({['Light', 'Balanced', 'Strong', 'Kadak'][cfg.strength - 1]})
                </span>
              </p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="h-2.5 flex-1 rounded-full"
                    style={{ background: i <= cfg.strength ? themeColor : ta(0.15) }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 mt-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                <span>Light</span><span className="text-center">Balanced</span><span className="text-center">Strong</span><span className="text-right">Kadak</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Perfect for */}
      <section className="container mx-auto px-4 sm:px-6 pb-10 sm:pb-14">
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: ba(0.35) }}>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: themeColor }}>Perfect For</p>
              <h2 className="text-xl sm:text-2xl font-serif font-semibold">A cup for the moment, not the menu</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {cfg.occasions.map(o => (
              <span key={o} className="px-3.5 py-2 bg-white/80 border border-border rounded-full text-[12px] font-medium">{o}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      {siblings.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2" style={{ color: themeColor }}>Compare</p>
            <h2 className="text-2xl sm:text-3xl font-serif font-semibold">How it sits in the {product.category.toLowerCase()} family</h2>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[640px] text-sm border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-3 pr-4 font-semibold">Tea</th>
                  <th className="text-left py-3 px-4 font-semibold">Best for</th>
                  <th className="text-left py-3 px-4 font-semibold">Caffeine</th>
                  <th className="text-left py-3 px-4 font-semibold">Flavor</th>
                </tr>
              </thead>
              <tbody>
                {[product, ...siblings].map((p) => {
                  const c = configForCategory(p.category);
                  const isCurrent = p.slug === product.slug;
                  return (
                    <tr key={p.slug} className={`border-t border-border ${isCurrent ? 'bg-primary/5' : ''}`}>
                      <td className="py-3 pr-4 align-top">
                        <div className="flex items-center gap-2">
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full" style={{ background: themeColor }} aria-hidden="true" />}
                          <Link href={`/product/${p.slug}`} className={`font-semibold ${isCurrent ? 'text-primary' : 'hover:underline'}`}>{p.name}</Link>
                        </div>
                        {isCurrent && <p className="text-[10px] text-muted-foreground mt-0.5">You're viewing</p>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground align-top">{c.comparison.bestFor}</td>
                      <td className="py-3 px-4 text-muted-foreground align-top capitalize">{p.caffeineLevel === 'none' ? 'None' : p.caffeineLevel}</td>
                      <td className="py-3 px-4 text-muted-foreground align-top">{p.tastingNotes.slice(0, 2).join(', ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Social proof */}
      <section className="container mx-auto px-4 sm:px-6 pb-12">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr]">
            <div className="p-6 sm:p-8 flex flex-col justify-center" style={{ background: ba(0.4) }}>
              <Quote className="w-7 h-7 mb-3" style={{ color: themeColor }} />
              <p className="text-2xl font-serif font-semibold leading-tight mb-2">1,200+ rituals brewed this month</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">Tag <span className="font-semibold">#DrTeaRitual</span> to be featured.</p>
            </div>
            <div className="grid grid-cols-4 gap-px bg-border">
              {ugcImages.map((src, i) => (
                <div key={i} className="aspect-square bg-muted overflow-hidden">
                  <img src={src} alt={`Customer ritual ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover motion-safe:hover:scale-105 motion-safe:transition-transform motion-safe:duration-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ProductReviews product={product} />

      {relatedProducts.length > 0 && (
        <div className="container mx-auto px-4 sm:px-6 mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-serif font-semibold">You May Also Love</h2>
            <Link href={`/shop/${product.category.toLowerCase().replace(/ /g, '-')}`} className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-3">
            {relatedProducts.map(related => (
              <Link key={related.id} href={`/product/${related.slug}`} className="flex-shrink-0 w-40 sm:w-44">
                <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm">
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img src={related.imageUrl} alt={related.name} loading="lazy" decoding="async" className="w-full h-full object-cover motion-safe:hover:scale-105 motion-safe:transition-transform motion-safe:duration-500" />
                  </div>
                  <div className="p-3">
                    <h4 className="text-xs font-semibold leading-tight line-clamp-2 mb-1">{related.name}</h4>
                    <p className="text-sm font-bold">{formatPrice(related.price, currency)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={reduceMotion ? false : { y: 100 }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: 100 }}
            transition={{ type: 'spring', damping: 24, stiffness: 200 }}
            className="fixed bottom-14 sm:bottom-0 left-0 right-0 z-30 bg-white border-t border-border shadow-2xl px-4 py-3 flex items-center gap-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{product.name}</p>
              <p className="text-xs text-muted-foreground">{selectedVariant.size} · {formatPrice(selectedVariant.price, currency)}</p>
            </div>
            <button
              onClick={handleAddToCart}
              className={`px-5 py-3 rounded-sm text-xs font-bold uppercase tracking-wide flex-shrink-0 motion-safe:transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${
                isAdded ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'
              }`}
            >
              {isAdded ? '✓ Added' : 'Add to Cart'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
