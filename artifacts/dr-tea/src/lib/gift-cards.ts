const API = `${import.meta.env.BASE_URL}api`;

export type GiftCardTier = "standard" | "silver" | "gold" | "obsidian";

export interface GiftCardTierProfile {
  id: GiftCardTier;
  name: string;
  tagline: string;
  threshold: number;
  loadBonusPct: number;
  foil: string;
  body: string;
  glyph: string;
  perks: string[];
}

export interface GiftCardCheck {
  ok: true;
  code: string;
  serial: string;
  tier: GiftCardTier;
  balance: number;
  initialAmount: number;
  bonusCredit: number;
  lifetimeLoaded: number;
  lifetimeRedeemed: number;
  topupCount: number;
  currency: string;
  expiresAt: string;
  status: string;
  isReloadable: boolean;
}

export interface GiftCardLoadQuote {
  bonus: number;
  tierAfter: GiftCardTier;
  tierProfile: GiftCardTierProfile;
}

export interface GiftCardTopupResult {
  code: string;
  serial: string;
  tier: GiftCardTier;
  tierPromoted: boolean;
  addedAmount: number;
  bonusCredit: number;
  balance: number;
  lifetimeLoaded: number;
  topupCount: number;
  currency: string;
  expiresAt: string;
}

export interface GiftCardConfig {
  min: number;
  max: number;
  presets: number[];
}

export interface GiftCardDesign {
  id: string;
  name: string;
  occasion: string;
  weight: number;
  tagline: string;
  story: string;
  whatsInside: string[];
  pairingTeas: string[];
  recipientHint: string;
  palette: { bg: string; accent: string; text: string };
  heroGradient: string;
  motif: string;
  badge: "limited" | "festive" | "bestseller" | "new" | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  festivalDate: string | null;
  physicalSeasonCap: number | null;
  inSeason: boolean;
  daysUntilFestival: number | null;
}

export interface GiftCardDesignDetail {
  design: GiftCardDesign;
  inSeason: boolean;
  daysUntilFestival: number | null;
  physicalSold: number;
  physicalRemaining: number | null;
}

export interface GiftCardPackaging {
  id: string;
  name: string;
  tagline: string;
  features: string[];
  fee: number;
  format: "digital" | "physical";
  leadTimeDays: number;
}

export interface GiftCardActivity {
  lastHour: number;
  last24h: number;
  last24hPhysical: number;
}

export interface GiftCardQuote {
  cardAmount: number;
  packagingFee: number;
  total: number;
  cutoff: string | null;
  leadTimeDays: number;
}

export interface GiftCardDeliveryAddress {
  fullName: string;
  phone: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark?: string;
}

export interface GiftCardPersonalization {
  recipientPhotoUrl?: string;
  calligraphyName?: string;
  signature?: string;
  occasionTag?: string;
  voiceNoteUrl?: string;
}

export interface GiftCardPurchaseResult {
  code: string;
  serial: string;
  tier: GiftCardTier;
  amount: number;
  bonusCredit: number;
  balance: number;
  currency: string;
  expiresAt: string;
  recipientEmail: string;
  format: "digital" | "physical";
  designId: string;
  packagingId: string;
  packagingFee: number;
  physicalStatus: 'na' | 'pending' | 'printed' | 'shipped' | 'delivered';
}

export async function checkGiftCard(code: string): Promise<GiftCardCheck | { ok: false; reason: string }> {
  const r = await fetch(`${API}/gift-cards/check?code=${encodeURIComponent(code)}`, {
    credentials: 'include',
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { reason?: string };
    return { ok: false, reason: j.reason ?? 'not_found' };
  }
  return (await r.json()) as GiftCardCheck;
}

export async function fetchGiftCardConfig(): Promise<GiftCardConfig> {
  const r = await fetch(`${API}/gift-cards/config`);
  return (await r.json()) as GiftCardConfig;
}

export async function fetchGiftCardDesigns(): Promise<GiftCardDesign[]> {
  const r = await fetch(`${API}/gift-cards/designs`);
  if (!r.ok) throw new Error("Could not load designs");
  const j = (await r.json()) as { designs: GiftCardDesign[] };
  return j.designs;
}

export async function fetchGiftCardDesign(id: string): Promise<GiftCardDesignDetail> {
  const r = await fetch(`${API}/gift-cards/designs/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error("Design not found");
  return (await r.json()) as GiftCardDesignDetail;
}

export async function fetchGiftCardPackaging(): Promise<GiftCardPackaging[]> {
  const r = await fetch(`${API}/gift-cards/packaging`);
  if (!r.ok) throw new Error("Could not load packaging");
  const j = (await r.json()) as { packaging: GiftCardPackaging[] };
  return j.packaging;
}

export async function fetchGiftCardActivity(): Promise<GiftCardActivity> {
  try {
    const r = await fetch(`${API}/gift-cards/activity`);
    if (!r.ok) return { lastHour: 0, last24h: 0, last24hPhysical: 0 };
    return (await r.json()) as GiftCardActivity;
  } catch {
    return { lastHour: 0, last24h: 0, last24hPhysical: 0 };
  }
}

export async function fetchGiftCardQuote(opts: {
  amount: number;
  designId: string;
  packagingId: string;
  format?: 'digital' | 'physical';
}): Promise<GiftCardQuote> {
  const params = new URLSearchParams({
    amount: String(opts.amount),
    designId: opts.designId,
    packagingId: opts.packagingId,
    ...(opts.format ? { format: opts.format } : {}),
  });
  const r = await fetch(`${API}/gift-cards/quote?${params}`);
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? 'Quote unavailable');
  }
  return (await r.json()) as GiftCardQuote;
}

export async function purchaseGiftCard(body: {
  amount: number;
  currency: string;
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  message: string;
  purchaserName: string;
  purchaserEmail: string;
  format: 'digital' | 'physical';
  designId: string;
  packagingId: string;
  personalization?: GiftCardPersonalization;
  deliveryAddress?: GiftCardDeliveryAddress;
  scheduledDeliveryAt?: string;
  payment: {
    method: 'razorpay';
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
}): Promise<GiftCardPurchaseResult> {
  const r = await fetch(`${API}/gift-cards/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? 'Could not complete the purchase.');
  }
  return (await r.json()) as GiftCardPurchaseResult;
}

export async function fetchGiftCardTiers(): Promise<GiftCardTierProfile[]> {
  const r = await fetch(`${API}/gift-cards/tiers`);
  if (!r.ok) return [];
  const j = (await r.json()) as { tiers: GiftCardTierProfile[] };
  return j.tiers;
}

export async function fetchGiftCardLoadQuote(opts: {
  amount: number;
  previousLifetimeLoaded?: number;
}): Promise<GiftCardLoadQuote | null> {
  const params = new URLSearchParams({
    amount: String(opts.amount),
    previousLifetimeLoaded: String(opts.previousLifetimeLoaded ?? 0),
  });
  const r = await fetch(`${API}/gift-cards/load-quote?${params}`);
  if (!r.ok) return null;
  return (await r.json()) as GiftCardLoadQuote;
}

export async function topupGiftCard(body: {
  code: string;
  amount: number;
  currency: string;
  payment: {
    method: 'razorpay';
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
}): Promise<GiftCardTopupResult> {
  const r = await fetch(`${API}/gift-cards/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? 'Top-up failed.');
  }
  return (await r.json()) as GiftCardTopupResult;
}
