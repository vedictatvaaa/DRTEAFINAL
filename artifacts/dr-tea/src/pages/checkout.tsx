import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, Gift, Loader2, Lock, Sparkles, Truck, Shield, RotateCcw, Leaf,
  Plus, Minus, Trash2, Tag, X as XIcon, Zap,
} from 'lucide-react';
import { useStore } from '@/store/use-store';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/currency';
import { checkoutIntent } from '@workspace/api-client-react';
import { track, getSessionId } from '@/lib/analytics';
import RitualConcierge from '@/components/checkout/RitualConcierge';
import AbandonedCartPopup from '@/components/AbandonedCartPopup';
import Seo from '@/components/Seo';
import AccountAplusContent from '@/components/account/AccountAplusContent';
import EmptyCartCinematic from '@/components/cart/EmptyCartCinematic';
import { unitPriceFor, SUBSCRIPTION_DISCOUNT } from '@/lib/cart-pricing';
import { useShopper } from '@/lib/shopper-auth';
import { useLoyalty, refetchLoyalty } from '@/lib/loyalty';
import { checkGiftCard } from '@/lib/gift-cards';
import { Coins } from 'lucide-react';

const FREE_SHIPPING = 999;
const SHIPPING_FEE = 99;
const GIFT_WRAP_FEE = 49;
const COD_SURCHARGE = 40;
const PREPAID_DISCOUNT_PCT = 0.05;
const ADDRESS_KEY = 'dr-tea-shipping-v1';
/** Promo codes recognised client-side. Backend re-validates the same set. */
const PROMO_CODES: Record<string, { type: 'percent'; value: number; label: string }> = {
  COMEBACK5: { type: 'percent', value: 0.05, label: '5% off your cart' },
};

type Address = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function formatEta(): string {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date();
  end.setDate(end.getDate() + 5);
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { cart, clearCart, updateQuantity, removeFromCart } = useStore();
  const currency = useStore((s) => s.currency);
  const preferences = useStore((s) => s.preferences);
  const appliedDiscountCode = useStore((s) => s.appliedDiscountCode);
  const setAppliedDiscountCode = useStore((s) => s.setAppliedDiscountCode);
  const { toast } = useToast();
  const [codeInput, setCodeInput] = useState('');

  // ── Personalised prefill ────────────────────────────────────────────────
  const savedAddress: Address | null = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(ADDRESS_KEY);
      return raw ? (JSON.parse(raw) as Address) : null;
    } catch {
      return null;
    }
  }, []);

  const [name, setName] = useState(
    preferences.name && preferences.name !== 'Guest User' ? preferences.name : '',
  );
  const [email, setEmail] = useState(
    preferences.email && preferences.email !== 'guest@example.com' ? preferences.email : '',
  );
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<Address>(
    savedAddress ?? {
      line1: '', line2: '', city: '', region: '', postalCode: '', country: 'IN',
    },
  );

  const [giftWrap, setGiftWrap] = useState(false);
  const [giftNote, setGiftNote] = useState('');
  const [includeBrewCard, setIncludeBrewCard] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState<'doorstep' | 'office' | 'pickup'>('doorstep');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Empty cart guard: render an A+ recovery page (no auto-redirect) ──
  // Previously this auto-bounced to /shop after 1.2s, which hurt SEO + UX.

  // ── Razorpay availability + analytics ───────────────────────────────────
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/payments/razorpay/config`)
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => {
        const on = Boolean(j.enabled);
        setRazorpayEnabled(on);
        if (!on) setPaymentMethod('cod');
      })
      .catch(() => {
        setRazorpayEnabled(false);
        setPaymentMethod('cod');
      });
  }, []);

  useEffect(() => {
    if (cart.length > 0) {
      const subtotalNow = cart.reduce(
        (s, i) =>
          s + unitPriceFor(i.variant.price, !!i.subscription) * i.quantity,
        0,
      );
      track({ type: 'checkout_start', value: subtotalNow, currency });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loyalty (Tea Club) ─────────────────────────────────────────────────
  const { user: shopper } = useShopper();
  const { data: loyalty } = useLoyalty(!!shopper);
  const balance = loyalty?.account.pointsBalance ?? 0;
  const rupeesPerPoint = loyalty?.config.rupeesPerPointRedeem ?? 0.5;
  const maxPctOfSubtotal = loyalty?.config.redeemMaxPctOfSubtotal ?? 0.5;
  const [redeemPoints, setRedeemPoints] = useState(0);
  // Reset whenever shopper changes (signed out, switched account, etc.)
  useEffect(() => {
    setRedeemPoints(0);
  }, [shopper?.id]);

  // ── Gift card ──────────────────────────────────────────────────────────
  const [giftCardInput, setGiftCardInput] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState<{ code: string; balance: number } | null>(null);
  const [giftCardChecking, setGiftCardChecking] = useState(false);
  const applyGiftCard = async () => {
    const raw = giftCardInput.trim();
    if (!raw) return;
    setGiftCardChecking(true);
    try {
      const r = await checkGiftCard(raw);
      if (r.ok) {
        setAppliedGiftCard({ code: r.code, balance: r.balance });
        setGiftCardInput('');
        toast({ title: 'Gift card applied', description: `${formatPrice(r.balance, currency)} available.` });
      } else {
        const reason =
          r.reason === 'expired' ? 'This gift card has expired.'
          : r.reason === 'depleted' ? 'This gift card has no balance left.'
          : 'Gift card not found.';
        toast({ title: "Couldn't apply card", description: reason, variant: 'destructive' });
      }
    } finally {
      setGiftCardChecking(false);
    }
  };
  const removeGiftCard = () => setAppliedGiftCard(null);

  // ── Pricing ─────────────────────────────────────────────────────────────
  const subtotal = cart.reduce(
    (s, i) => s + unitPriceFor(i.variant.price, !!i.subscription) * i.quantity,
    0,
  );
  const shipping = subtotal >= FREE_SHIPPING || subtotal === 0 ? 0 : SHIPPING_FEE;
  const giftWrapCost = giftWrap ? GIFT_WRAP_FEE : 0;
  const isPrepaid = paymentMethod === 'razorpay';
  const prepaidDiscount = isPrepaid ? Math.round(subtotal * PREPAID_DISCOUNT_PCT) : 0;
  const codSurcharge = paymentMethod === 'cod' ? COD_SURCHARGE : 0;
  const promo = appliedDiscountCode ? PROMO_CODES[appliedDiscountCode] : null;
  const codeDiscount = promo ? Math.round(subtotal * promo.value) : 0;

  // Mirror server-side cap so the client total matches what the API will charge
  const maxRedeemPoints = useMemo(() => {
    if (!shopper) return 0;
    const subtotalCapRupees = Math.floor(subtotal * maxPctOfSubtotal);
    const subtotalCapPoints = Math.floor(subtotalCapRupees / rupeesPerPoint);
    return Math.max(0, Math.min(balance, subtotalCapPoints));
  }, [shopper, subtotal, balance, rupeesPerPoint, maxPctOfSubtotal]);
  const effectiveRedeemPoints = Math.max(0, Math.min(redeemPoints, maxRedeemPoints));
  const loyaltyDiscount = Math.floor(effectiveRedeemPoints * rupeesPerPoint);

  const payableBeforeGift = Math.max(0, subtotal + shipping + giftWrapCost + codSurcharge - prepaidDiscount - codeDiscount - loyaltyDiscount);
  const giftCardDiscount = appliedGiftCard ? Math.min(appliedGiftCard.balance, payableBeforeGift) : 0;
  const total = Math.max(0, payableBeforeGift - giftCardDiscount);
  const progress = Math.min((subtotal / FREE_SHIPPING) * 100, 100);
  const amountLeft = FREE_SHIPPING - subtotal;
  const eta = useMemo(formatEta, []);

  const applyDiscountCode = () => {
    const raw = codeInput.trim().toUpperCase();
    if (!raw) return;
    if (!PROMO_CODES[raw]) {
      toast({ title: 'Invalid code', description: "That code isn't recognised.", variant: 'destructive' });
      return;
    }
    setAppliedDiscountCode(raw);
    setCodeInput('');
    toast({ title: 'Code applied', description: `${raw} — ${PROMO_CODES[raw]!.label}.` });
  };
  const removeDiscountCode = () => {
    setAppliedDiscountCode(null);
    toast({ title: 'Code removed' });
  };

  const isReturning =
    preferences.name && preferences.name !== 'Guest User' && Boolean(savedAddress);

  // ── Validation ─────────────────────────────────────────────────────────
  const requiredFilled =
    name.trim() && /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 7 &&
    address.line1.trim() && address.city.trim() && address.postalCode.trim();

  const captureIntent = (e: string) => {
    if (!e || !cart.length) return;
    void checkoutIntent({
      sessionId: getSessionId(),
      email: e,
      currency,
      items: cart.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        variantSize: item.variant.size,
        quantity: item.quantity,
        unitPrice: unitPriceFor(item.variant.price, !!item.subscription),
      })),
    }).catch(() => {});
  };

  const placeOrder = async () => {
    if (!requiredFilled || submitting || cart.length === 0) return;
    setSubmitting(true);
    try {
      // Persist address for next time
      try { window.localStorage.setItem(ADDRESS_KEY, JSON.stringify(address)); } catch {}

      // Razorpay tokens (re-verified server-side in /checkout/place).
      type RzpResp = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
      let rzpPayload: RzpResp | null = null;
      if (paymentMethod === 'razorpay' && razorpayEnabled) {
        const ok = await loadRazorpayScript();
        if (!ok) {
          toast({ title: 'Could not load payment gateway', description: 'Please try Cash on Delivery.', variant: 'destructive' });
          setSubmitting(false);
          return;
        }
        const orderRes = await fetch(`${import.meta.env.BASE_URL}api/payments/razorpay/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: total * 100, currency, receipt: `dt-${Date.now()}` }),
        });
        if (!orderRes.ok) {
          toast({ title: 'Payment unavailable right now', description: 'Try again or pick Cash on Delivery.', variant: 'destructive' });
          setSubmitting(false);
          return;
        }
        const ro = (await orderRes.json()) as { id: string; amount: number; currency: string; keyId: string };
        rzpPayload = await new Promise<RzpResp | null>((resolve) => {
          const rzp = new window.Razorpay!({
            key: ro.keyId,
            amount: ro.amount,
            currency: ro.currency,
            order_id: ro.id,
            name: 'Dr Tea',
            description: 'Crafted Tea Order',
            prefill: { name, email, contact: phone },
            theme: { color: '#1a2416' },
            handler: (resp: RzpResp) => resolve(resp),
            modal: { ondismiss: () => resolve(null) },
          });
          rzp.open();
        });
        if (!rzpPayload) {
          toast({ title: 'Payment cancelled', description: 'Your cart is saved — try again when ready.' });
          setSubmitting(false);
          return;
        }
      }

      // Server-authoritative checkout. The API re-prices from the DB and (for
      // Razorpay) verifies the HMAC signature before inserting the order.
      const placeRes = await fetch(`${import.meta.env.BASE_URL}api/checkout/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          phone,
          currency,
          shippingAddress: {
            line1: address.line1,
            line2: address.line2 || undefined,
            city: address.city,
            region: address.region || undefined,
            postalCode: address.postalCode,
            country: address.country,
          },
          giftWrap,
          giftNote: giftNote.trim(),
          includeBrewCard,
          deliveryMethod,
          discountCode: appliedDiscountCode ?? undefined,
          redeemPoints: effectiveRedeemPoints,
          giftCardCode: appliedGiftCard?.code,
          items: cart.map((item) => ({
            productId: item.product.id,
            variantSize: item.variant.size,
            quantity: item.quantity,
            subscription: item.subscription,
          })),
          payment: rzpPayload
            ? { method: 'razorpay', ...rzpPayload }
            : { method: 'cod' },
        }),
      });
      const placeJson = (await placeRes.json()) as { id?: number; total?: number; error?: string };
      if (!placeRes.ok || typeof placeJson.id !== 'number') {
        toast({
          title: 'Could not place order',
          description: placeJson.error ?? 'Please try again.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      track({
        type: 'order_placed',
        value: placeJson.total ?? total,
        currency,
        orderId: placeJson.id,
      });

      const orderId = placeJson.id;
      try {
        window.sessionStorage.setItem(
          `dr-tea-order-${orderId}`,
          JSON.stringify({
            id: orderId,
            customerName: name,
            customerEmail: email,
            currency,
            subtotal,
            shipping,
            giftWrapCost,
            prepaidDiscount,
            codSurcharge,
            codeDiscount,
            appliedCode: appliedDiscountCode,
            total,
            eta,
            items: cart.map((i) => ({
              productName: i.product.name,
              variantSize: i.variant.size,
              quantity: i.quantity,
              unitPrice: unitPriceFor(i.variant.price, !!i.subscription),
              slug: i.product.slug,
              imageUrl: i.product.imageUrl,
            })),
            paymentMethod,
            placedAt: new Date().toISOString(),
          }),
        );
      } catch {}

      clearCart();
      // Refresh the shopper's points balance for the next session/page load.
      if (shopper) void refetchLoyalty();
      setLocation(`/order-confirmed/${orderId}`);
    } catch {
      toast({ title: 'Could not place order', description: 'Please try again in a moment.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="bg-[#FAF8F4]">
        <Seo title="Your cart is empty — Dr Tea" canonical="https://drtea.in/checkout" robots="noindex, follow" />
        <EmptyCartCinematic />
      </div>
    );
  }

  return (
    <div className="bg-[#f9f7f3] min-h-screen">
      <Seo title="Checkout — Dr Tea" canonical="https://drtea.in/checkout" robots="noindex, follow" />
      {/* Slim crumb */}
      <div className="px-4 sm:px-8 max-w-7xl mx-auto pt-4">
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" /> Continue shopping
        </Link>
      </div>

      <div className="px-4 sm:px-8 max-w-7xl mx-auto py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:gap-10">
        {/* ── LEFT: form ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight">Checkout</h1>
            {isReturning ? (
              <p className="text-[13px] text-muted-foreground mt-1">
                Welcome back, <span className="text-foreground font-medium">{preferences.name.split(' ')[0]}</span> — finishing your ritual?
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground mt-1">A few details and your tea is on its way.</p>
            )}
          </div>

          {/* Contact */}
          <Card title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full name" value={name} onChange={setName} placeholder="Riya Sharma" autoComplete="name" />
              <Field label="Email" type="email" value={email} onChange={setEmail} onBlur={() => captureIntent(email)} placeholder="you@example.com" autoComplete="email" />
              <Field label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="+91 98765 43210" autoComplete="tel" />
            </div>
          </Card>

          {/* Shipping */}
          <Card title="Shipping address" rightHint={savedAddress ? 'Pre-filled from your last order' : undefined}>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Address line 1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} placeholder="House / flat / street" autoComplete="address-line1" />
              <Field label="Address line 2 (optional)" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} placeholder="Landmark, area" autoComplete="address-line2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} autoComplete="address-level2" />
                <Field label="State" value={address.region} onChange={(v) => setAddress({ ...address, region: v })} autoComplete="address-level1" />
                <Field label="PIN code" value={address.postalCode} onChange={(v) => setAddress({ ...address, postalCode: v })} autoComplete="postal-code" />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Delivery preference</p>
              <div className="grid grid-cols-3 gap-2">
                {(['doorstep', 'office', 'pickup'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDeliveryMethod(m)}
                    aria-pressed={deliveryMethod === m}
                    className={`text-[11px] py-2.5 rounded-md border transition-colors capitalize ${
                      deliveryMethod === m
                        ? 'border-[#1a2416] bg-[#1a2416] text-white'
                        : 'border-border bg-white hover:border-foreground/30'
                    }`}
                  >
                    {m === 'doorstep' ? 'Doorstep' : m === 'office' ? 'Office hours' : 'Pickup point'}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Gift + extras */}
          <Card title="Gift & extras">
            <div className="space-y-3">
              <Toggle
                checked={giftWrap}
                onChange={setGiftWrap}
                title="Gift wrap"
                desc={`Hand-tied jute & seal — ${formatPrice(GIFT_WRAP_FEE, currency)}`}
                icon={<Gift className="w-4 h-4 text-[#1a2416]" />}
              />
              {giftWrap && (
                <div>
                  <textarea
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value.slice(0, 160))}
                    placeholder="Add a handwritten note (optional)…"
                    rows={2}
                    className="w-full text-[13px] px-3 py-2.5 border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] resize-none"
                  />
                  <p className="text-[10px] text-right text-muted-foreground mt-0.5">{giftNote.length}/160</p>
                </div>
              )}
              <Toggle
                checked={includeBrewCard}
                onChange={setIncludeBrewCard}
                title="Include brewing guide card"
                desc="Pretty letterpress brew instructions — free"
                icon={<Leaf className="w-4 h-4 text-[#3a5a2c]" />}
              />
            </div>
          </Card>

          {/* Payment */}
          <Card title="Payment">
            <div className="space-y-2">
              <PaymentChoice
                selected={paymentMethod === 'razorpay'}
                disabled={!razorpayEnabled}
                onClick={() => razorpayEnabled && setPaymentMethod('razorpay')}
                title="UPI / Card / Netbanking"
                desc={razorpayEnabled
                  ? 'Save 5% + faster express dispatch · powered by Razorpay'
                  : 'Coming soon — choose Cash on Delivery for now'}
                badge="Save 5%"
                badgeTone="emerald"
                accent={
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <Zap className="w-3 h-3" /> Express dispatch
                  </span>
                }
              />
              <PaymentChoice
                selected={paymentMethod === 'cod'}
                onClick={() => setPaymentMethod('cod')}
                title="Cash on Delivery"
                desc={`Pay in cash when your tea arrives · +${formatPrice(COD_SURCHARGE, currency)} handling`}
                badge={`+${formatPrice(COD_SURCHARGE, currency)}`}
                badgeTone="amber"
              />
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-3">
              <Lock className="w-3 h-3" /> Your data is secured with bank-grade encryption.
            </p>
          </Card>
        </div>

        {/* ── RIGHT: order summary ────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 self-start space-y-4">
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-serif font-semibold text-[16px]">Your ritual</h2>
              <span className="text-[11px] text-muted-foreground">{cart.reduce((a, i) => a + i.quantity, 0)} items</span>
            </div>

            {/* Items — editable qty + remove */}
            <ul className="px-4 sm:px-5 py-3 space-y-3 max-h-[300px] overflow-y-auto">
              {cart.map((item) => {
                const unit = unitPriceFor(item.variant.price, !!item.subscription);
                return (
                  <li key={item.id} className="flex gap-3 items-start">
                    <div className="relative w-14 h-16 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold leading-tight line-clamp-2">{item.product.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {item.variant.size}
                            {item.subscription && (
                              <span className="ml-1.5 text-primary font-semibold">· Subscribe & save {Math.round(SUBSCRIPTION_DISCOUNT * 100)}%</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${item.product.name}`}
                          data-testid={`button-remove-${item.id}`}
                          className="w-7 h-7 -mt-1 -mr-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label="Decrease quantity"
                            data-testid={`button-qty-decrease-${item.id}`}
                            className="w-7 h-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span
                            className="min-w-[28px] text-center text-[12px] font-semibold tabular-nums select-none"
                            data-testid={`text-qty-${item.id}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label="Increase quantity"
                            data-testid={`button-qty-increase-${item.id}`}
                            className="w-7 h-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[12.5px] font-semibold tabular-nums">
                          {formatPrice(unit * item.quantity, currency)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Discount code */}
            <div className="px-5 py-3 border-t border-border bg-[#fafaf6]">
              {appliedDiscountCode && promo ? (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <Tag className="w-3.5 h-3.5" />
                    {appliedDiscountCode} · {promo.label}
                  </span>
                  <button
                    type="button"
                    onClick={removeDiscountCode}
                    aria-label="Remove discount code"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-600"
                    data-testid="button-remove-discount"
                  >
                    <XIcon className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyDiscountCode(); } }}
                      placeholder="Promo code"
                      data-testid="input-discount-code"
                      className="w-full pl-8 pr-3 py-2 text-[12px] tracking-wider uppercase border border-border rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyDiscountCode}
                    disabled={!codeInput.trim()}
                    data-testid="button-apply-discount"
                    className="text-[11px] uppercase tracking-widest font-bold px-3 py-2 rounded-md bg-[#1a2416] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#243320]"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Tea Club rewards — redeem points */}
            {shopper && balance > 0 && maxRedeemPoints > 0 && (
              <div className="px-5 py-3 border-t border-border bg-amber-50/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1a2416]">
                    <Coins className="w-3.5 h-3.5 text-amber-700" />
                    Tea Club points
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Balance <span className="font-semibold text-foreground">{balance.toLocaleString('en-IN')}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={maxRedeemPoints}
                    step={10}
                    value={effectiveRedeemPoints}
                    onChange={(e) => setRedeemPoints(Number(e.target.value))}
                    aria-label="Redeem Tea Club points"
                    data-testid="input-redeem-points"
                    className="flex-1 accent-[#3a5a2c]"
                  />
                  <button
                    type="button"
                    onClick={() => setRedeemPoints(maxRedeemPoints)}
                    className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-[#1a2416] text-white hover:bg-[#243320]"
                    data-testid="button-redeem-max"
                  >
                    Max
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center justify-between">
                  <span>
                    Redeeming{' '}
                    <span className="font-semibold text-foreground">
                      {effectiveRedeemPoints.toLocaleString('en-IN')} pts
                    </span>{' '}
                    for{' '}
                    <span className="font-semibold text-emerald-700">
                      − {formatPrice(loyaltyDiscount, currency)}
                    </span>
                  </span>
                  {effectiveRedeemPoints > 0 && (
                    <button
                      type="button"
                      onClick={() => setRedeemPoints(0)}
                      className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </p>
              </div>
            )}
            {!shopper && (
              <div className="px-5 py-3 border-t border-border bg-amber-50/40 text-[11.5px] text-muted-foreground flex items-center gap-2">
                <Coins className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  <Link href="/rewards" className="text-[#1a2416] font-semibold underline">
                    Sign in to Tea Club
                  </Link>{' '}
                  to earn 1 point per ₹10 on this order.
                </span>
              </div>
            )}

            {/* Gift card */}
            <div className="px-5 py-4 border-t border-border">
              <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" /> Gift card
              </p>
              {appliedGiftCard ? (
                <div className="flex items-center justify-between text-[12.5px] bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  <span className="text-emerald-800">
                    <span className="font-mono font-semibold">{appliedGiftCard.code}</span>{' '}
                    <span className="text-emerald-700/70">
                      · {formatPrice(appliedGiftCard.balance, currency)} balance
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={removeGiftCard}
                    className="text-[11px] uppercase tracking-widest font-bold text-emerald-800 hover:text-emerald-900"
                    data-testid="button-remove-gift-card"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={giftCardInput}
                    onChange={(e) => setGiftCardInput(e.target.value.toUpperCase())}
                    placeholder="DT-XXXX-XXXX-XXXX"
                    className="flex-1 px-3 py-2 text-[13px] font-mono tracking-wider border border-border rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                    data-testid="input-gift-card"
                  />
                  <button
                    type="button"
                    onClick={applyGiftCard}
                    disabled={!giftCardInput.trim() || giftCardChecking}
                    className="px-4 py-2 rounded-md bg-[#1a2416] text-white text-[11px] uppercase tracking-widest font-bold disabled:opacity-40 hover:bg-[#243320]"
                    data-testid="button-apply-gift-card"
                  >
                    {giftCardChecking ? '…' : 'Apply'}
                  </button>
                </div>
              )}
            </div>

            {/* Free-ship progress */}
            <div className="px-5 py-3 bg-[#f7f5f1] border-y border-border">
              <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                <span className="text-muted-foreground">
                  {subtotal >= FREE_SHIPPING ? '🎉 Free shipping unlocked' : `${formatPrice(amountLeft, currency)} away from free shipping`}
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-[#3a5a2c] rounded-full"
                />
              </div>
            </div>

            {/* Totals */}
            <div className="px-5 py-4 space-y-2 text-[12px]">
              <Row label="Subtotal" value={formatPrice(subtotal, currency)} />
              <Row label="Shipping" value={shipping === 0 ? 'Free' : formatPrice(shipping, currency)} highlight={shipping === 0} />
              {giftWrap && <Row label="Gift wrap" value={formatPrice(GIFT_WRAP_FEE, currency)} />}
              {prepaidDiscount > 0 && (
                <Row label="Prepaid discount (5%)" value={`− ${formatPrice(prepaidDiscount, currency)}`} highlight />
              )}
              {codSurcharge > 0 && (
                <Row label="COD handling fee" value={`+ ${formatPrice(codSurcharge, currency)}`} />
              )}
              {codeDiscount > 0 && (
                <Row label={`Code · ${appliedDiscountCode}`} value={`− ${formatPrice(codeDiscount, currency)}`} highlight />
              )}
              {loyaltyDiscount > 0 && (
                <Row
                  label={`Tea Club · ${effectiveRedeemPoints} pts`}
                  value={`− ${formatPrice(loyaltyDiscount, currency)}`}
                  highlight
                />
              )}
              {giftCardDiscount > 0 && appliedGiftCard && (
                <Row
                  label={`Gift card · ${appliedGiftCard.code.slice(-4)}`}
                  value={`− ${formatPrice(giftCardDiscount, currency)}`}
                  highlight
                />
              )}
              <div className="pt-2.5 mt-2 border-t border-border flex justify-between font-serif font-bold text-[18px]">
                <span>Total</span>
                <motion.span
                  key={total}
                  initial={{ opacity: 0.4, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {formatPrice(total, currency)}
                </motion.span>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                <Truck className="w-3 h-3" /> Estimated delivery: <span className="text-foreground font-medium">{eta}</span>
              </p>
            </div>

            <button
              onClick={placeOrder}
              disabled={!requiredFilled || submitting}
              data-testid="button-place-order"
              className="w-full bg-[#1a2416] text-white py-4 text-[12px] font-bold uppercase tracking-widest hover:bg-[#243320] transition-colors flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-inset"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Placing…</>
              ) : (
                <><Lock className="w-3.5 h-3.5" /> Place Order · {formatPrice(total, currency)}</>
              )}
            </button>
          </div>

          {/* Trust strip */}
          <div className="bg-white rounded-2xl border border-border p-4 grid grid-cols-3 gap-2 text-center">
            <Trust icon={<Shield className="w-3.5 h-3.5" />} label="256-bit SSL" />
            <Trust icon={<RotateCcw className="w-3.5 h-3.5" />} label="Free 7-day returns" />
            <Trust icon={<Sparkles className="w-3.5 h-3.5" />} label="Crafted in India" />
          </div>
        </aside>
      </div>

      <RitualConcierge />
      <AbandonedCartPopup />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Card({ title, rightHint, children }: { title: string; rightHint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif font-semibold text-[16px]">{title}</h2>
        {rightHint && <span className="text-[10px] uppercase tracking-widest text-[#3a5a2c] font-semibold">{rightHint}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text', autoComplete, onBlur,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoComplete?: string; onBlur?: () => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full text-[13px] px-3 py-2.5 border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus:border-foreground/30"
      />
    </label>
  );
}

function Toggle({
  checked, onChange, title, desc, icon,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  title: string; desc: string; icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        checked ? 'border-[#1a2416] bg-[#f7f5f1]' : 'border-border bg-white hover:border-foreground/30'
      }`}
    >
      <span className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-[#1a2416] bg-[#1a2416]' : 'border-border'}`}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </span>
    </button>
  );
}

function PaymentChoice({
  selected, disabled, onClick, title, desc, badge, badgeTone = 'amber', accent,
}: {
  selected: boolean; disabled?: boolean; onClick: () => void;
  title: string; desc: string; badge?: string;
  badgeTone?: 'amber' | 'emerald';
  accent?: React.ReactNode;
}) {
  const badgeClass = badgeTone === 'emerald'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${
        disabled
          ? 'border-border bg-muted/40 cursor-not-allowed opacity-70'
          : selected
            ? 'border-[#1a2416] bg-[#f7f5f1]'
            : 'border-border bg-white hover:border-foreground/30'
      }`}
    >
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#1a2416]' : 'border-border'}`}>
        {selected && <span className="w-2 h-2 rounded-full bg-[#1a2416]" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
        {accent && <span className="block mt-0.5">{accent}</span>}
      </span>
      {badge && <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeClass}`}>{badge}</span>}
    </button>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'text-green-700 font-semibold' : ''}>{value}</span>
    </div>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
      <span className="text-foreground">{icon}</span>
      <span className="uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}
