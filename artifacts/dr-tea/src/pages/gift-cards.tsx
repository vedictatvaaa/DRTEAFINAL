import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  Loader2,
  Check,
  Copy,
  Sparkles,
  Heart,
  Search,
  Mail,
  Package,
  Truck,
  Flame,
  Clock,
  Image as ImageIcon,
  Camera,
  X,
  ChevronRight,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '@/store/use-store';
import { useToast } from '@/hooks/use-toast';
import { useShopper } from '@/lib/shopper-auth';
import { uploadImage } from '@/lib/upload-image';
import {
  checkGiftCard,
  fetchGiftCardConfig,
  fetchGiftCardDesigns,
  fetchGiftCardDesign,
  fetchGiftCardPackaging,
  fetchGiftCardActivity,
  fetchGiftCardQuote,
  fetchGiftCardTiers,
  fetchGiftCardLoadQuote,
  purchaseGiftCard,
  topupGiftCard,
  type GiftCardConfig,
  type GiftCardDesign,
  type GiftCardDesignDetail,
  type GiftCardPackaging,
  type GiftCardActivity,
  type GiftCardQuote,
  type GiftCardPurchaseResult,
  type GiftCardDeliveryAddress,
  type GiftCardPersonalization,
  type GiftCardTier,
  type GiftCardTierProfile,
  type GiftCardLoadQuote,
  type GiftCardCheck,
} from '@/lib/gift-cards';
import { LuxuryCard } from '@/components/gift-cards/LuxuryCard';
import Seo from '@/components/Seo';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
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

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const EMPTY_ADDRESS: GiftCardDeliveryAddress = {
  fullName: '',
  phone: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  landmark: '',
};

export default function GiftCards() {
  const currency = useStore((s) => s.currency);
  const { user } = useShopper();
  const { toast } = useToast();

  const [config, setConfig] = useState<GiftCardConfig | null>(null);
  const [designs, setDesigns] = useState<GiftCardDesign[]>([]);
  const [packaging, setPackaging] = useState<GiftCardPackaging[]>([]);
  const [activity, setActivity] = useState<GiftCardActivity>({
    lastHour: 0,
    last24h: 0,
    last24hPhysical: 0,
  });

  const [activeDesignId, setActiveDesignId] = useState<string>('classic-evergreen');
  const [activeDesignDetail, setActiveDesignDetail] = useState<GiftCardDesignDetail | null>(null);
  const [format, setFormat] = useState<'digital' | 'physical'>('digital');
  const [packagingId, setPackagingId] = useState<string>('digital');

  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState(user?.name ?? '');
  const [message, setMessage] = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState(user?.email ?? '');

  const [calligraphyName, setCalligraphyName] = useState('');
  const [signature, setSignature] = useState('');
  const [recipientPhotoUrl, setRecipientPhotoUrl] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

  const [address, setAddress] = useState<GiftCardDeliveryAddress>(EMPTY_ADDRESS);

  const [quote, setQuote] = useState<GiftCardQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GiftCardPurchaseResult | null>(null);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  // Balance-check widget — full GiftCardCheck so we can show tier + reload UX.
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState<
    | { ok: true; card: GiftCardCheck }
    | { ok: false; reason: string }
    | null
  >(null);
  const [checking, setChecking] = useState(false);

  // Tier catalog (membership ladder)
  const [tiers, setTiers] = useState<GiftCardTierProfile[]>([]);

  // Live "what bonus does this load earn" quote — drives the +₹X chip on
  // the amount step and the top-up widget.
  const [loadQuote, setLoadQuote] = useState<GiftCardLoadQuote | null>(null);

  // Top-up flow
  const [topupAmount, setTopupAmount] = useState<number>(1000);
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    void fetchGiftCardConfig().then(setConfig).catch(() => undefined);
    void fetchGiftCardDesigns().then((d) => {
      setDesigns(d);
      if (d.length > 0 && d[0]) setActiveDesignId(d[0].id);
    }).catch(() => undefined);
    void fetchGiftCardPackaging().then(setPackaging).catch(() => undefined);
    void fetchGiftCardActivity().then(setActivity).catch(() => undefined);
    void fetchGiftCardTiers().then(setTiers).catch(() => undefined);
    fetch(`${import.meta.env.BASE_URL}api/payments/razorpay/config`)
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => setRazorpayEnabled(Boolean(j.enabled)))
      .catch(() => setRazorpayEnabled(false));
  }, []);

  // Hydrate detail (with FOMO scarcity numbers) when design changes
  useEffect(() => {
    if (!activeDesignId) return;
    void fetchGiftCardDesign(activeDesignId).then(setActiveDesignDetail).catch(() => setActiveDesignDetail(null));
  }, [activeDesignId]);

  useEffect(() => {
    if (user) {
      if (!senderName) setSenderName(user.name);
      if (!purchaserEmail) setPurchaserEmail(user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // When format toggles, snap packagingId to a compatible default.
  useEffect(() => {
    if (format === 'digital') {
      setPackagingId('digital');
    } else if (packagingId === 'digital') {
      setPackagingId('envelope');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  // Refresh load-quote whenever the chosen amount changes.
  useEffect(() => {
    const amt = (() => {
      const c = Number(customAmount);
      if (customAmount && Number.isFinite(c) && c > 0) return Math.floor(c);
      return amount;
    })();
    if (!amt || amt < 100) {
      setLoadQuote(null);
      return;
    }
    let cancelled = false;
    void fetchGiftCardLoadQuote({ amount: amt, previousLifetimeLoaded: 0 }).then((q) => {
      if (!cancelled) setLoadQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [amount, customAmount]);

  const effectiveAmount = useMemo(() => {
    const fromCustom = Number(customAmount);
    if (customAmount && Number.isFinite(fromCustom) && fromCustom > 0) return Math.floor(fromCustom);
    return amount;
  }, [amount, customAmount]);

  const isValidAmount = useMemo(() => {
    if (!config) return false;
    return effectiveAmount >= config.min && effectiveAmount <= config.max;
  }, [effectiveAmount, config]);

  // Fetch quote whenever amount/design/packaging changes.
  useEffect(() => {
    if (!isValidAmount) return;
    let cancelled = false;
    void fetchGiftCardQuote({
      amount: effectiveAmount,
      designId: activeDesignId,
      packagingId,
      format,
    })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => { cancelled = true; };
  }, [effectiveAmount, activeDesignId, packagingId, isValidAmount, format]);

  const activeDesign = useMemo(
    () => designs.find((d) => d.id === activeDesignId) ?? null,
    [designs, activeDesignId],
  );
  const activePackaging = useMemo(
    () => packaging.find((p) => p.id === packagingId) ?? null,
    [packaging, packagingId],
  );

  const physicalAddressValid = useMemo(() => {
    if (format === 'digital') return true;
    return (
      address.fullName.trim().length > 1 &&
      address.phone.trim().length >= 7 &&
      address.street1.trim().length > 0 &&
      address.city.trim().length > 0 &&
      address.state.trim().length > 0 &&
      /^\d{4,12}$/.test(address.pincode.trim())
    );
  }, [format, address]);

  const canSubmit =
    isValidAmount &&
    /\S+@\S+\.\S+/.test(purchaserEmail) &&
    senderName.trim().length > 0 &&
    physicalAddressValid &&
    !submitting &&
    razorpayEnabled &&
    !!activeDesign &&
    !!activePackaging &&
    !!quote;

  // ── Balance check ──────────────────────────────────────────────────
  const handleCheck = async () => {
    const c = checkCode.trim();
    if (!c) return;
    setChecking(true);
    try {
      const r = await checkGiftCard(c);
      if (r.ok) setCheckResult({ ok: true, card: r });
      else {
        const reason =
          r.reason === 'expired'
            ? 'This gift card has expired.'
            : r.reason === 'depleted'
              ? 'This gift card has no balance left.'
              : 'Gift card not found.';
        setCheckResult({ ok: false, reason });
      }
    } finally {
      setChecking(false);
    }
  };

  // ── Top-up an existing card ────────────────────────────────────────
  const placeTopup = async () => {
    if (!checkResult || !checkResult.ok) return;
    const card = checkResult.card;
    if (topupAmount < (config?.min ?? 100) || topupAmount > (config?.max ?? 50000)) {
      toast({ title: `Top-up must be between ${inr(config?.min ?? 100)} and ${inr(config?.max ?? 50000)}`, variant: 'destructive' });
      return;
    }
    setTopupSubmitting(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast({ title: 'Could not load payment gateway', variant: 'destructive' });
        return;
      }
      const orderRes = await fetch(`${import.meta.env.BASE_URL}api/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: topupAmount * 100,
          currency,
          receipt: `gctop-${Date.now()}`,
        }),
      });
      if (!orderRes.ok) {
        toast({ title: 'Payment unavailable right now', variant: 'destructive' });
        return;
      }
      const ro = (await orderRes.json()) as { id: string; amount: number; currency: string; keyId: string };
      type RzpResp = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
      const rzpResp = await new Promise<RzpResp | null>((resolve) => {
        const rzp = new window.Razorpay!({
          key: ro.keyId,
          amount: ro.amount,
          currency: ro.currency,
          order_id: ro.id,
          name: 'Dr Tea — Card top-up',
          description: `Reload ${card.code}`,
          prefill: { email: user?.email ?? '' },
          theme: { color: '#1a2416' },
          handler: (resp: RzpResp) => resolve(resp),
          modal: { ondismiss: () => resolve(null) },
        });
        rzp.open();
      });
      if (!rzpResp) {
        toast({ title: 'Top-up cancelled' });
        return;
      }
      const updated = await topupGiftCard({
        code: card.code,
        amount: topupAmount,
        currency,
        payment: { method: 'razorpay', ...rzpResp },
      });
      // Refresh local check result with the new card state.
      setCheckResult({
        ok: true,
        card: {
          ...card,
          tier: updated.tier,
          balance: updated.balance,
          lifetimeLoaded: updated.lifetimeLoaded,
          topupCount: updated.topupCount,
          bonusCredit: card.bonusCredit + updated.bonusCredit,
        },
      });
      toast({
        title: updated.tierPromoted
          ? `Loaded ₹${updated.addedAmount} — promoted to ${updated.tier}!`
          : `Loaded ₹${updated.addedAmount}${updated.bonusCredit ? ` + ₹${updated.bonusCredit} bonus` : ''}`,
      });
    } catch (err) {
      toast({ title: 'Top-up failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setTopupSubmitting(false);
    }
  };

  // ── Photo upload ───────────────────────────────────────────────────
  const handlePhoto = async (file: File) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const objectPath = await uploadImage(file);
      setRecipientPhotoUrl(objectPath);
      toast({ title: 'Photo added — it will be hand-mounted on the card.' });
    } catch (err) {
      toast({ title: 'Photo upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Place order ────────────────────────────────────────────────────
  const placeOrder = async () => {
    if (!canSubmit || !quote) return;
    setSubmitting(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast({ title: 'Could not load payment gateway', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      const orderRes = await fetch(`${import.meta.env.BASE_URL}api/payments/razorpay/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: quote.total * 100,
          currency,
          receipt: `gc-${Date.now()}`,
        }),
      });
      if (!orderRes.ok) {
        toast({ title: 'Payment unavailable right now', description: 'Please try again later.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      const ro = (await orderRes.json()) as { id: string; amount: number; currency: string; keyId: string };
      type RzpResp = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
      const rzpResp = await new Promise<RzpResp | null>((resolve) => {
        const rzp = new window.Razorpay!({
          key: ro.keyId,
          amount: ro.amount,
          currency: ro.currency,
          order_id: ro.id,
          name: 'Dr Tea — Gift Card',
          description: `${activeDesign?.name ?? 'Gift card'} for ${recipientName || recipientEmail || 'a tea lover'}`,
          prefill: { name: senderName, email: purchaserEmail },
          theme: { color: '#1a2416' },
          handler: (resp: RzpResp) => resolve(resp),
          modal: { ondismiss: () => resolve(null) },
        });
        rzp.open();
      });
      if (!rzpResp) {
        toast({ title: 'Payment cancelled' });
        setSubmitting(false);
        return;
      }

      const personalization: GiftCardPersonalization | undefined =
        calligraphyName.trim() || signature.trim() || recipientPhotoUrl
          ? {
              calligraphyName: calligraphyName.trim() || undefined,
              signature: signature.trim() || undefined,
              recipientPhotoUrl: recipientPhotoUrl || undefined,
              occasionTag: activeDesign?.occasion,
            }
          : undefined;

      const card = await purchaseGiftCard({
        amount: effectiveAmount,
        currency,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        senderName: senderName.trim(),
        message: message.trim(),
        purchaserName: senderName.trim(),
        purchaserEmail: purchaserEmail.trim(),
        format,
        designId: activeDesignId,
        packagingId,
        personalization,
        deliveryAddress: format === 'physical' ? address : undefined,
        scheduledDeliveryAt: scheduledDate
          ? new Date(`${scheduledDate}T08:00:00+05:30`).toISOString()
          : undefined,
        payment: { method: 'razorpay', ...rzpResp },
      });
      setResult(card);
    } catch (err) {
      toast({
        title: 'Could not complete the purchase',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Copy failed', description: 'Long-press to copy manually.' });
    }
  };

  const featuredCountdown = useMemo(() => {
    return designs.find((d) => d.daysUntilFestival != null && d.daysUntilFestival <= 30) ?? null;
  }, [designs]);

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="Dr Tea Gift Cards — Premium digital & physical, festival-ready"
        description="Send a Dr Tea gift card by email or hand-couriered in a sheesham-wood trunk. Diwali, Raksha Bandhan, Holi designs. Personalised with your photo. INR. Valid one year."
        canonical="https://drtea.in/gift-cards"
      />

      {/* ── HERO with festival countdown ──────────────────────── */}
      <section className="relative bg-[#1a2416] text-white overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            background:
              activeDesign?.heroGradient ??
              'linear-gradient(135deg, #0e1810 0%, #1a2416 50%, #3a5a2c 130%)',
          }}
        />
        <div className="relative container mx-auto px-4 sm:px-6 py-14 sm:py-20 max-w-6xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold mb-3">
            Premium Gift Cards · Digital & Physical
          </p>
          <h1 className="font-serif font-bold text-4xl sm:text-5xl md:text-6xl leading-[1.05] max-w-3xl mb-5">
            Give a ritual that arrives on the right day.
          </h1>
          <p className="text-white/75 text-base sm:text-lg max-w-2xl leading-relaxed mb-6">
            Hand-illustrated for every Indian festival, hand-printed on cotton-blend cardstock,
            and — if you choose — hand-couriered in a sheesham-wood trunk.
          </p>

          {/* FOMO ticker bar */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-amber-100/90">
            {activity.lastHour > 0 && (
              <div className="inline-flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-300" />
                <span>
                  <strong className="text-white">{activity.lastHour}</strong> sent in the last hour
                </span>
              </div>
            )}
            {activity.last24hPhysical > 0 && (
              <div className="inline-flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-300" />
                <span>
                  <strong className="text-white">{activity.last24hPhysical}</strong> physical cards
                  shipped today
                </span>
              </div>
            )}
            {featuredCountdown?.daysUntilFestival != null && (
              <div className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-300" />
                <span>
                  <strong className="text-white">{featuredCountdown.daysUntilFestival} days</strong>{' '}
                  to {featuredCountdown.occasion} — order soon for delivery in time
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── MAIN GRID: design picker (left) + sticky summary (right) ─── */}
      <section className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_360px] gap-8">

          {/* ─── LEFT COLUMN ─── */}
          <div className="space-y-10 min-w-0">

            {/* Design picker */}
            <div>
              <SectionHeader
                kicker="Step 1"
                title="Pick a design"
                hint="Festive designs are limited-run. Evergreen designs ship year-round."
              />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {designs.map((d) => (
                  <DesignTile
                    key={d.id}
                    design={d}
                    active={d.id === activeDesignId}
                    onSelect={() => setActiveDesignId(d.id)}
                  />
                ))}
              </div>
            </div>

            {/* Live preview + A+ content */}
            {activeDesign && (
              <div>
                <SectionHeader
                  kicker="Preview"
                  title={`${activeDesign.name} — ${activeDesign.occasion}`}
                />
                <div className="grid md:grid-cols-[1fr_1fr] gap-5">
                  <div className="space-y-3">
                    <LuxuryCard
                      design={activeDesign}
                      tier={loadQuote?.tierAfter ?? 'standard'}
                      serial="DT/2026/000000"
                      amount={effectiveAmount}
                      recipientName={calligraphyName.trim() || recipientName.trim()}
                      senderName={senderName}
                    />
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>Front · CR80 · 350gsm coated stock</span>
                      {loadQuote && loadQuote.tierAfter !== 'standard' && (
                        <span
                          className="px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: loadQuote.tierProfile.foil + '22',
                            color: '#1a2416',
                            border: `1px solid ${loadQuote.tierProfile.foil}`,
                          }}
                        >
                          Issues at {loadQuote.tierProfile.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <APlusContent design={activeDesign} detail={activeDesignDetail} />
                </div>
              </div>
            )}

            {/* Format toggle + packaging */}
            <div>
              <SectionHeader
                kicker="Step 2"
                title="How should it arrive?"
                hint="Digital is instant. Physical adds a real card, and optional keepsake packaging."
              />
              <div className="grid grid-cols-2 gap-2 mb-4 max-w-md">
                {(['digital', 'physical'] as const).map((f) => {
                  const active = format === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`px-4 py-3 rounded-xl border-2 text-left transition ${
                        active
                          ? 'border-[#1a2416] bg-[#1a2416] text-white'
                          : 'border-stone-200 bg-white text-[#1a2416] hover:border-[#1a2416]/40'
                      }`}
                      data-testid={`format-${f}`}
                    >
                      <div className="text-[12px] uppercase tracking-wider opacity-70">
                        {f === 'digital' ? 'Instant' : 'Premium'}
                      </div>
                      <div className="font-semibold capitalize">{f}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {packaging
                  .filter((p) => p.format === format)
                  .map((p) => (
                    <PackagingTile
                      key={p.id}
                      packaging={p}
                      active={p.id === packagingId}
                      onSelect={() => setPackagingId(p.id)}
                    />
                  ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <SectionHeader kicker="Step 3" title="Amount" />
              <div className="flex flex-wrap gap-2 mb-3">
                {(config?.presets ?? [500, 1000, 2500, 5000, 10000]).map((p) => {
                  const active = !customAmount && amount === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setAmount(p);
                        setCustomAmount('');
                      }}
                      className={`px-4 h-11 rounded-full font-semibold text-[14px] transition ${
                        active
                          ? 'bg-[#1a2416] text-white'
                          : 'bg-white text-[#1a2416] border border-stone-200 hover:border-[#1a2416]/40'
                      }`}
                      data-testid={`amount-${p}`}
                    >
                      {inr(p)}
                    </button>
                  );
                })}
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Custom ₹"
                  className="px-4 h-11 rounded-full border border-stone-200 w-36 text-[14px] focus:outline-none focus:border-[#1a2416]"
                  data-testid="amount-custom"
                />
              </div>
              {!isValidAmount && config && (
                <p className="text-[12px] text-amber-700">
                  Amount must be between {inr(config.min)} and {inr(config.max)}.
                </p>
              )}

              {/* Bonus-credit hint + tier promotion preview */}
              {loadQuote && loadQuote.bonus > 0 && (
                <div
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium"
                  style={{
                    background: '#FAF8F4',
                    border: `1px solid ${loadQuote.tierProfile.foil}`,
                    color: '#1a2416',
                  }}
                  data-testid="bonus-credit-hint"
                >
                  <Sparkles className="w-4 h-4" style={{ color: loadQuote.tierProfile.foil }} />
                  <span>
                    +{inr(loadQuote.bonus)} bonus credit on this load — issued at{' '}
                    <strong>{loadQuote.tierProfile.name}</strong> ({loadQuote.tierProfile.loadBonusPct}%).
                  </span>
                </div>
              )}
            </div>

            {/* Membership tiers — status ladder */}
            {tiers.length > 0 && (
              <div>
                <SectionHeader
                  kicker="Membership"
                  title="The Dr Tea card ladder"
                  hint="Auto-promoted by lifetime load. Cards never demote — once you cross, you stay."
                />
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tiers.map((t) => {
                    const isCurrent = (loadQuote?.tierAfter ?? 'standard') === t.id;
                    // Showcase amount per tier — typical balance to make the
                    // value-loaded line feel real on each design.
                    const showcaseAmount =
                      t.id === 'obsidian'
                        ? 50000
                        : t.id === 'gold'
                          ? 10000
                          : t.id === 'silver'
                            ? 2500
                            : Math.max(1000, Number(customAmount) || 1000);
                    return (
                      <div
                        key={t.id}
                        className={`relative rounded-2xl ${
                          isCurrent ? 'ring-2 ring-offset-2 ring-amber-400 ring-offset-[#FAF8F4]' : ''
                        }`}
                        data-testid={`tier-${t.id}`}
                      >
                        <LuxuryCard
                          tier={t.id}
                          serial={`DT/2026/${(['000001', '002500', '010000', '050000'][['standard', 'silver', 'gold', 'obsidian'].indexOf(t.id)] ?? '000000')}`}
                          amount={showcaseAmount}
                          recipientName="A Tea Connoisseur"
                        />
                        <div className="mt-3 px-1">
                          <div className="flex items-center justify-between">
                            <p
                              className="font-serif text-base leading-tight text-[#1a2416]"
                            >
                              {t.name}
                            </p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                              {t.threshold === 0 ? 'Entry' : `${inr(t.threshold)}+`}
                            </p>
                          </div>
                          <p className="text-[12px] text-stone-600 mt-1 leading-snug">
                            {t.tagline}
                          </p>
                          <p
                            className="text-[12px] font-semibold mt-1.5"
                            style={{ color: '#7a5a14' }}
                          >
                            {t.loadBonusPct === 0
                              ? 'Standard rate'
                              : `+${t.loadBonusPct}% bonus on every load`}
                          </p>
                          <ul className="mt-1.5 space-y-0.5">
                            {t.perks.slice(0, 3).map((p, i) => (
                              <li key={i} className="text-[11.5px] text-stone-700 flex gap-1.5">
                                <span aria-hidden className="text-amber-700">·</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {isCurrent && (
                          <p
                            className="absolute -top-2 left-3 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-400 text-[#1a2416] shadow"
                          >
                            Your tier today
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipient + sender */}
            <div>
              <SectionHeader kicker="Step 4" title="Who is it for?" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Recipient name">
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Anya"
                    className="ftxt"
                    data-testid="input-recipient-name"
                  />
                </Field>
                <Field
                  label={
                    format === 'physical'
                      ? "Recipient email (for the digital backup copy)"
                      : "Recipient email (where we send the card)"
                  }
                >
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="anya@example.com"
                    className="ftxt"
                    data-testid="input-recipient-email"
                  />
                </Field>
                <Field label="From (your name)">
                  <input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your name"
                    className="ftxt"
                    data-testid="input-sender-name"
                  />
                </Field>
                <Field label="Your email (for the receipt)">
                  <input
                    type="email"
                    value={purchaserEmail}
                    onChange={(e) => setPurchaserEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="ftxt"
                    data-testid="input-purchaser-email"
                  />
                </Field>
                <Field label="Personal message" className="sm:col-span-2">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Printed inside the card / shown when they unwrap the digital version."
                    className="ftxt resize-none"
                    data-testid="input-message"
                  />
                </Field>
              </div>
            </div>

            {/* Personalisation */}
            <div>
              <SectionHeader
                kicker="Step 5"
                title="Personalise it"
                hint="Available on every design. Hand-applied for physical cards."
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Hand-calligraphed name (printed inside)">
                  <input
                    value={calligraphyName}
                    onChange={(e) => setCalligraphyName(e.target.value)}
                    placeholder={recipientName || 'Recipient name'}
                    className="ftxt"
                    data-testid="input-calligraphy"
                  />
                </Field>
                <Field label="Sign-off (optional)">
                  <input
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="With love, your favourite cousin"
                    className="ftxt"
                    data-testid="input-signature"
                  />
                </Field>
                <Field label="Recipient photo (we mount it on the card)" className="sm:col-span-2">
                  <PhotoField
                    url={recipientPhotoUrl}
                    uploading={photoUploading}
                    onPick={handlePhoto}
                    onClear={() => setRecipientPhotoUrl('')}
                  />
                </Field>
                {format === 'physical' && (
                  <Field label="Schedule delivery (optional — the card arrives on this day)" className="sm:col-span-2">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                      className="ftxt"
                      data-testid="input-scheduled"
                    />
                  </Field>
                )}
              </div>
            </div>

            {/* Delivery address (physical only) */}
            {format === 'physical' && (
              <div>
                <SectionHeader
                  kicker="Step 6"
                  title="Where should we ship the card?"
                  hint="We deliver pan-India through tracked courier."
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Recipient full name">
                    <input
                      value={address.fullName}
                      onChange={(e) => setAddress((a) => ({ ...a, fullName: e.target.value }))}
                      className="ftxt"
                      data-testid="addr-fullname"
                    />
                  </Field>
                  <Field label="Phone (for the courier)">
                    <input
                      value={address.phone}
                      onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
                      className="ftxt"
                      data-testid="addr-phone"
                    />
                  </Field>
                  <Field label="Street address" className="sm:col-span-2">
                    <input
                      value={address.street1}
                      onChange={(e) => setAddress((a) => ({ ...a, street1: e.target.value }))}
                      className="ftxt"
                      data-testid="addr-street1"
                    />
                  </Field>
                  <Field label="Apartment / floor / landmark (optional)" className="sm:col-span-2">
                    <input
                      value={address.street2 ?? ''}
                      onChange={(e) => setAddress((a) => ({ ...a, street2: e.target.value }))}
                      className="ftxt"
                      data-testid="addr-street2"
                    />
                  </Field>
                  <Field label="City">
                    <input
                      value={address.city}
                      onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                      className="ftxt"
                      data-testid="addr-city"
                    />
                  </Field>
                  <Field label="State">
                    <input
                      value={address.state}
                      onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                      className="ftxt"
                      data-testid="addr-state"
                    />
                  </Field>
                  <Field label="PIN code">
                    <input
                      value={address.pincode}
                      onChange={(e) =>
                        setAddress((a) => ({ ...a, pincode: e.target.value.replace(/[^0-9]/g, '') }))
                      }
                      className="ftxt"
                      data-testid="addr-pincode"
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      value={address.country}
                      onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                      className="ftxt"
                      data-testid="addr-country"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* Balance check */}
            <div>
              <SectionHeader
                kicker="Already have a card?"
                title="Check your balance"
              />
              <div className="flex flex-wrap gap-2 max-w-xl">
                <input
                  value={checkCode}
                  onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
                  placeholder="DT-XXXX-XXXX-XXXX"
                  className="ftxt flex-1 min-w-[220px] font-mono"
                  data-testid="input-check-code"
                />
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={checking || !checkCode.trim()}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-full bg-[#1a2416] text-white font-semibold text-[14px] disabled:opacity-50"
                  data-testid="button-check"
                >
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Check
                </button>
              </div>
              {checkResult && !checkResult.ok && (
                <div className="mt-3 p-3 rounded-lg text-sm bg-amber-50 text-amber-900 border border-amber-200">
                  {checkResult.reason}
                </div>
              )}
              {checkResult && checkResult.ok && (
                <div className="mt-4 grid md:grid-cols-[1.2fr_1fr] gap-4">
                  <div className="space-y-2">
                    <LuxuryCard
                      tier={checkResult.card.tier}
                      serial={checkResult.card.serial}
                      amount={checkResult.card.balance}
                      code={checkResult.card.code}
                      expiresAt={checkResult.card.expiresAt}
                    />
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>
                        Lifetime loaded {inr(checkResult.card.lifetimeLoaded)} ·{' '}
                        {checkResult.card.topupCount} reload{checkResult.card.topupCount === 1 ? '' : 's'}
                      </span>
                      <a
                        href={`${import.meta.env.BASE_URL}print-card/${checkResult.card.code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-[#1a2416]"
                        data-testid="link-print-card"
                      >
                        Print artwork →
                      </a>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700">
                        Reload this card
                      </p>
                      <p className="text-[12px] text-stone-600 mt-0.5">
                        Keep your tier &amp; serial. Bonus credit applies on every load.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(config?.presets ?? [500, 1000, 2500, 5000]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTopupAmount(p)}
                          className={`px-3 h-9 rounded-full text-[13px] font-semibold transition ${
                            topupAmount === p
                              ? 'bg-[#1a2416] text-white'
                              : 'bg-stone-100 text-[#1a2416] hover:bg-stone-200'
                          }`}
                          data-testid={`topup-amount-${p}`}
                        >
                          {inr(p)}
                        </button>
                      ))}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(topupAmount)}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/[^0-9]/g, ''));
                          setTopupAmount(Number.isFinite(n) ? n : 0);
                        }}
                        className="px-3 h-9 rounded-full border border-stone-200 w-28 text-[13px] focus:outline-none focus:border-[#1a2416]"
                        data-testid="topup-amount-custom"
                      />
                    </div>
                    {/* Live bonus quote for top-up */}
                    <TopupBonusQuote
                      amount={topupAmount}
                      previousLifetimeLoaded={checkResult.card.lifetimeLoaded}
                      currentTier={checkResult.card.tier}
                    />
                    <button
                      type="button"
                      onClick={placeTopup}
                      disabled={topupSubmitting || !razorpayEnabled || topupAmount < 100}
                      className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-full bg-[#1a2416] text-white font-semibold text-[14px] disabled:opacity-40"
                      data-testid="button-topup"
                    >
                      {topupSubmitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                      ) : (
                        <>Reload {inr(topupAmount)}</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT: STICKY SUMMARY ─── */}
          <aside className="lg:sticky lg:top-6 self-start space-y-4 min-w-0">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-3">
                Order summary
              </p>

              <div className="space-y-3 mb-4">
                {activeDesign && (
                  <div
                    className="rounded-lg p-3 text-white"
                    style={{ background: activeDesign.heroGradient }}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-80">
                      {activeDesign.occasion}
                    </div>
                    <div className="font-serif text-[18px] leading-tight">{activeDesign.name}</div>
                  </div>
                )}

                <SummaryLine label="Card amount" value={inr(effectiveAmount)} />
                <SummaryLine
                  label={activePackaging?.name ?? 'Packaging'}
                  value={(quote?.packagingFee ?? 0) === 0 ? 'Free' : inr(quote?.packagingFee ?? 0)}
                />
                <div className="border-t border-stone-200 pt-3 flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-stone-700">Total</span>
                  <span className="text-2xl font-bold text-[#1a2416]" data-testid="text-total">
                    {inr(quote?.total ?? effectiveAmount)}
                  </span>
                </div>
              </div>

              {/* Cutoff countdown — physical only */}
              {format === 'physical' && quote?.cutoff && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-900 flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Order by{' '}
                    <strong>
                      {new Date(quote.cutoff).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </strong>{' '}
                    to land in time for {activeDesign?.occasion}.
                  </span>
                </div>
              )}

              {/* Scarcity ribbon */}
              {activeDesignDetail?.physicalRemaining != null &&
                activeDesignDetail.physicalRemaining < 80 &&
                format === 'physical' && (
                  <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-900 flex items-start gap-2">
                    <Flame className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Only{' '}
                      <strong>{activeDesignDetail.physicalRemaining} cards</strong> left in this
                      season's print run.
                    </span>
                  </div>
                )}

              {!razorpayEnabled && (
                <div className="mb-3 p-2 rounded bg-amber-50 border border-amber-200 text-[12px] text-amber-900">
                  Online payment is being set up — check back soon.
                </div>
              )}

              <button
                type="button"
                onClick={placeOrder}
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-[#1a2416] text-white font-semibold text-[15px] hover:bg-[#0e1810] disabled:opacity-40 transition"
                data-testid="button-buy"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" /> Send the gift
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <ul className="mt-4 space-y-1.5 text-[11px] text-stone-500">
                <li className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Valid for one year from purchase</li>
                <li className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> Digital copy emailed instantly</li>
                {format === 'physical' && (
                  <li className="flex items-center gap-1.5"><Truck className="w-3 h-3" /> Tracked courier across India</li>
                )}
                <li className="flex items-center gap-1.5"><Heart className="w-3 h-3" /> Redeemable on any blend, kit, or ritual</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* ── SUCCESS MODAL ───────────────────────────────────────────── */}
      <AnimatePresence>
        {result && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="modal-success"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif text-2xl font-bold text-[#1a2416]">Gift sent!</h3>
              </div>
              <p className="text-stone-600 text-sm mb-3">
                {result.format === 'digital'
                  ? `An email is on its way to ${result.recipientEmail || 'the recipient'}.`
                  : `We will print and ship the card${
                      scheduledDate ? ` for delivery on ${scheduledDate}` : ' within the lead-time of your packaging tier'
                    }. A digital backup is on its way to ${result.recipientEmail || purchaserEmail}.`}
              </p>
              {/* Issued card mini-preview with serial & tier */}
              <div className="mb-4">
                <LuxuryCard
                  tier={result.tier}
                  serial={result.serial}
                  amount={result.balance}
                  code={result.code}
                  expiresAt={result.expiresAt}
                />
                <div className="flex items-center justify-between mt-2 text-[11px] text-stone-500">
                  <span>{result.serial}</span>
                  {result.bonusCredit > 0 && (
                    <span className="text-amber-700 font-semibold">
                      +{inr(result.bonusCredit)} bonus credit included
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-[#FAF8F4] rounded-lg p-3 flex items-center justify-between gap-2 mb-3">
                <code className="font-mono text-sm text-[#1a2416]" data-testid="text-result-code">
                  {result.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex items-center gap-1 px-3 h-8 rounded text-[12px] bg-white border border-stone-200 hover:border-[#1a2416]/40"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <a
                href={`${import.meta.env.BASE_URL}print-card/${result.code}`}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center h-10 rounded-full border border-[#1a2416] text-[#1a2416] font-semibold text-[13px] mb-2 hover:bg-[#1a2416]/5"
                data-testid="link-print-result"
              >
                Open print artwork
              </a>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setCustomAmount('');
                }}
                className="w-full h-11 rounded-full bg-[#1a2416] text-white font-semibold"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .ftxt {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.5rem;
          background: #fff;
          border: 1px solid #e7e5e4;
          font-size: 14px;
          color: #1a2416;
          outline: none;
          transition: border-color 0.15s;
        }
        .ftxt:focus { border-color: #1a2416; }
      `}</style>
    </div>
  );
}

// ───────────────────────── Sub-components ────────────────────────────

function SectionHeader({ kicker, title, hint }: { kicker: string; title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700 mb-1">{kicker}</p>
      <h2 className="font-serif text-2xl text-[#1a2416] leading-tight">{title}</h2>
      {hint && <p className="text-[13px] text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="block text-[12px] font-medium text-stone-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span className="text-stone-600">{label}</span>
      <span className="font-medium text-[#1a2416] tabular-nums">{value}</span>
    </div>
  );
}

function DesignTile({
  design,
  active,
  onSelect,
}: {
  design: GiftCardDesign;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-xl overflow-hidden text-left border-2 transition shadow-sm ${
        active ? 'border-[#1a2416]' : 'border-transparent hover:-translate-y-0.5'
      }`}
      data-testid={`design-${design.id}`}
    >
      <div
        className="aspect-[4/3] p-4 flex flex-col justify-between"
        style={{ background: design.heroGradient, color: design.palette.text }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">{design.occasion}</div>
            <div className="font-serif text-lg leading-tight mt-0.5">{design.name}</div>
          </div>
          {design.badge && <BadgePill kind={design.badge} />}
        </div>
        <div className="text-3xl opacity-90 select-none">{design.motif}</div>
      </div>
      <div className="bg-white p-3">
        <p className="text-[12px] text-stone-600 line-clamp-2">{design.tagline}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
          {design.inSeason && design.daysUntilFestival != null && (
            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
              <Clock className="w-3 h-3" /> {design.daysUntilFestival}d to festival
            </span>
          )}
          {design.physicalSeasonCap != null && (
            <span className="text-stone-500">Limited print</span>
          )}
        </div>
      </div>
    </button>
  );
}

function BadgePill({ kind }: { kind: 'limited' | 'festive' | 'bestseller' | 'new' }) {
  const map = {
    limited: 'bg-rose-500',
    festive: 'bg-amber-400 text-[#1a2416]',
    bestseller: 'bg-emerald-500',
    new: 'bg-sky-400',
  } as const;
  const label = { limited: 'Limited', festive: 'Festive', bestseller: 'Bestseller', new: 'New' }[kind];
  return (
    <span
      className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded text-white ${map[kind]}`}
    >
      {label}
    </span>
  );
}

function TopupBonusQuote({
  amount,
  previousLifetimeLoaded,
  currentTier,
}: {
  amount: number;
  previousLifetimeLoaded: number;
  currentTier: GiftCardTier;
}) {
  const [q, setQ] = useState<GiftCardLoadQuote | null>(null);
  useEffect(() => {
    if (amount < 100) {
      setQ(null);
      return;
    }
    let cancelled = false;
    void fetchGiftCardLoadQuote({ amount, previousLifetimeLoaded }).then((r) => {
      if (!cancelled) setQ(r);
    });
    return () => {
      cancelled = true;
    };
  }, [amount, previousLifetimeLoaded]);
  if (!q) return null;
  const promoted = q.tierAfter !== currentTier;
  if (q.bonus === 0 && !promoted) {
    return (
      <p className="text-[11.5px] text-stone-500">
        No bonus on this load — cross ₹2,500 lifetime to enter Silver Estate.
      </p>
    );
  }
  return (
    <div
      className="text-[12px] px-2.5 py-1.5 rounded-md border"
      style={{ background: '#FAF8F4', borderColor: q.tierProfile.foil, color: '#1a2416' }}
    >
      {q.bonus > 0 && (
        <span className="font-semibold">
          +₹{q.bonus.toLocaleString('en-IN')} bonus credit
        </span>
      )}
      {promoted && (
        <span className="ml-1">
          → promotes to <strong>{q.tierProfile.name}</strong>
        </span>
      )}
    </div>
  );
}

// Legacy storefront preview tile (kept for now in case any other surface
// imports it). The luxury card is the primary preview.
function PreviewCard({
  design,
  amount,
  recipientName,
  senderName,
  calligraphyName,
  photoUrl,
}: {
  design: GiftCardDesign;
  amount: number;
  recipientName: string;
  senderName: string;
  calligraphyName: string;
  photoUrl: string;
}) {
  const photoSrc = photoUrl ? `${import.meta.env.BASE_URL}api/objects/${photoUrl.replace(/^\//, '')}` : '';
  return (
    <div
      className="relative rounded-2xl p-6 aspect-[4/5] flex flex-col justify-between shadow-lg"
      style={{ background: design.heroGradient, color: design.palette.text }}
      data-testid="preview-card"
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">{design.occasion}</p>
        <p className="font-serif text-2xl mt-1">{design.name}</p>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl opacity-15 select-none">
        {design.motif}
      </div>

      {photoSrc && (
        <div className="absolute right-5 top-5 w-16 h-16 rounded-full overflow-hidden border-2 border-white/60 shadow">
          <img src={photoSrc} alt="Recipient" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="relative">
        <p className="text-[10px] uppercase tracking-wider opacity-70">For</p>
        <p className="font-serif text-xl">
          {calligraphyName.trim() || recipientName.trim() || 'Someone special'}
        </p>
        <p className="mt-3 text-3xl font-bold tabular-nums" style={{ color: design.palette.accent }}>
          {inr(amount || 0)}
        </p>
        <p className="mt-2 text-[11px] opacity-70">From {senderName.trim() || 'You'}</p>
      </div>
    </div>
  );
}

function APlusContent({
  design,
  detail,
}: {
  design: GiftCardDesign;
  detail: GiftCardDesignDetail | null;
}) {
  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-5 space-y-4">
      <p className="text-[14px] text-stone-700 leading-relaxed">{design.story}</p>

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700 mb-2">
          What's inside
        </p>
        <ul className="space-y-1.5">
          {design.whatsInside.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-[#1a2416]">
              <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700 mb-2">
          Pairs beautifully with
        </p>
        <div className="flex flex-wrap gap-1.5">
          {design.pairingTeas.map((t) => (
            <span key={t} className="text-[12px] px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
              {t}
            </span>
          ))}
        </div>
      </div>

      <p className="text-[12px] italic text-stone-500 border-t border-stone-100 pt-3">
        {design.recipientHint}
      </p>

      {detail?.physicalRemaining != null && detail.physicalRemaining > 0 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded">
          {detail.physicalSold} sold · {detail.physicalRemaining} cards remain in this season's
          print run.
        </div>
      )}
    </div>
  );
}

function PackagingTile({
  packaging,
  active,
  onSelect,
}: {
  packaging: GiftCardPackaging;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl p-4 border-2 transition bg-white ${
        active ? 'border-[#1a2416] shadow-md' : 'border-stone-200 hover:border-[#1a2416]/40'
      }`}
      data-testid={`packaging-${packaging.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-[#1a2416] text-[14px]">{packaging.name}</h3>
        <span className="text-[13px] font-bold text-[#3a5a2c]">
          {packaging.fee === 0 ? 'Free' : `+${inr(packaging.fee)}`}
        </span>
      </div>
      <p className="text-[12px] text-stone-600 mb-2">{packaging.tagline}</p>
      <ul className="space-y-1">
        {packaging.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-stone-600">
            <Check className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function PhotoField({
  url,
  uploading,
  onPick,
  onClear,
}: {
  url: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  if (url) {
    const src = `${import.meta.env.BASE_URL}api/objects/${url.replace(/^\//, '')}`;
    return (
      <div className="flex items-center gap-3">
        <img src={src} alt="Recipient" className="w-16 h-16 rounded-full object-cover border border-stone-200" />
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] text-stone-600 underline inline-flex items-center gap-1"
          data-testid="button-photo-clear"
        >
          <X className="w-3 h-3" /> Remove
        </button>
      </div>
    );
  }
  return (
    <label
      className={`flex items-center gap-2 px-4 h-11 rounded-lg border border-dashed text-[13px] cursor-pointer transition ${
        uploading ? 'border-stone-200 text-stone-400' : 'border-stone-300 text-stone-700 hover:border-[#1a2416]/40'
      }`}
    >
      {uploading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
        </>
      ) : (
        <>
          <Camera className="w-4 h-4" /> Add a photo (jpg/png, up to 10MB)
        </>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
        data-testid="input-photo"
      />
      <ImageIcon className="ml-auto w-4 h-4 text-stone-400" />
    </label>
  );
}
