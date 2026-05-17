import { createHmac } from "node:crypto";
import { logger } from "../logger";

// Provider abstraction. Add new providers by implementing PaymentProvider and
// registering in PROVIDERS below. Sensitive keys live in env vars; the active
// provider + COD toggle is stored in the DB (paymentSettingsTable).

export type ProviderKey = "razorpay" | "stripe" | "cashfree" | "phonepe";

export interface CreateOrderInput {
  amountInPaise: number;
  currency: string;
  receipt?: string;
}
export interface CreatedOrder {
  providerOrderId: string;
  amountInPaise: number;
  currency: string;
  publishableKey: string;
}
export interface VerifyInput {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}
export interface FetchedOrder {
  providerOrderId: string;
  amountInPaise: number;
  amountPaidInPaise: number;
  currency: string;
  status: string;
}

export interface PaymentProvider {
  key: ProviderKey;
  label: string;
  /** True when the required env keys are present. */
  isConfigured(): boolean;
  /** Public key safe to send to the browser (or null). */
  publishableKey(): string | null;
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  /** Returns true if the signature is authentic. */
  verify(input: VerifyInput): Promise<boolean>;
  /** Fetch an order from the provider so we can bind the paid amount to the server total. */
  fetchOrder(providerOrderId: string): Promise<FetchedOrder>;
}

// ── Razorpay ─────────────────────────────────────────────────────────────
const razorpay: PaymentProvider = {
  key: "razorpay",
  label: "Razorpay (UPI / Card / Netbanking)",
  isConfigured() {
    return Boolean(process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"]);
  },
  publishableKey() {
    return process.env["RAZORPAY_KEY_ID"] ?? null;
  },
  async createOrder(input) {
    const id = process.env["RAZORPAY_KEY_ID"];
    const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!id || !secret) throw new Error("Razorpay not configured");
    const auth = Buffer.from(`${id}:${secret}`).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: input.amountInPaise,
        currency: input.currency,
        receipt: input.receipt,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      logger.warn({ status: r.status, body: text.slice(0, 200) }, "razorpay order failed");
      throw new Error(`Razorpay rejected the order (${r.status})`);
    }
    const order = (await r.json()) as { id?: unknown; amount?: unknown; currency?: unknown };
    if (typeof order.id !== "string" || typeof order.amount !== "number" || typeof order.currency !== "string") {
      throw new Error("Razorpay returned an unexpected payload");
    }
    return {
      providerOrderId: order.id,
      amountInPaise: order.amount,
      currency: order.currency,
      publishableKey: id,
    };
  },
  async verify(input) {
    const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!secret) return false;
    const expected = createHmac("sha256", secret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest("hex");
    return expected === input.providerSignature;
  },
  async fetchOrder(providerOrderId) {
    const id = process.env["RAZORPAY_KEY_ID"];
    const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!id || !secret) throw new Error("Razorpay not configured");
    const auth = Buffer.from(`${id}:${secret}`).toString("base64");
    const r = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(providerOrderId)}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      logger.warn({ status: r.status, body: text.slice(0, 200) }, "razorpay order fetch failed");
      throw new Error(`Razorpay order fetch failed (${r.status})`);
    }
    const o = (await r.json()) as { id?: unknown; amount?: unknown; amount_paid?: unknown; currency?: unknown; status?: unknown };
    if (
      typeof o.id !== "string" ||
      typeof o.amount !== "number" ||
      typeof o.currency !== "string" ||
      typeof o.status !== "string"
    ) {
      throw new Error("Razorpay returned an unexpected order payload");
    }
    return {
      providerOrderId: o.id,
      amountInPaise: o.amount,
      amountPaidInPaise: typeof o.amount_paid === "number" ? o.amount_paid : 0,
      currency: o.currency,
      status: o.status,
    };
  },
};

// Stub providers — implement when the merchant onboards each gateway. They
// declare themselves "not configured" so the admin UI shows them as
// unavailable and the storefront can't pick them.
const stripe: PaymentProvider = {
  key: "stripe",
  label: "Stripe (Cards / Wallets)",
  isConfigured() {
    return Boolean(process.env["STRIPE_SECRET_KEY"] && process.env["STRIPE_PUBLISHABLE_KEY"]);
  },
  publishableKey() { return process.env["STRIPE_PUBLISHABLE_KEY"] ?? null; },
  async createOrder() { throw new Error("Stripe provider not yet implemented"); },
  async verify() { return false; },
  async fetchOrder() { throw new Error("Stripe provider not yet implemented"); },
};

const cashfree: PaymentProvider = {
  key: "cashfree",
  label: "Cashfree (UPI / Card)",
  isConfigured() {
    return Boolean(process.env["CASHFREE_APP_ID"] && process.env["CASHFREE_SECRET_KEY"]);
  },
  publishableKey() { return process.env["CASHFREE_APP_ID"] ?? null; },
  async createOrder() { throw new Error("Cashfree provider not yet implemented"); },
  async verify() { return false; },
  async fetchOrder() { throw new Error("Cashfree provider not yet implemented"); },
};

const phonepe: PaymentProvider = {
  key: "phonepe",
  label: "PhonePe (UPI)",
  isConfigured() {
    return Boolean(process.env["PHONEPE_MERCHANT_ID"] && process.env["PHONEPE_SALT_KEY"]);
  },
  publishableKey() { return process.env["PHONEPE_MERCHANT_ID"] ?? null; },
  async createOrder() { throw new Error("PhonePe provider not yet implemented"); },
  async verify() { return false; },
  async fetchOrder() { throw new Error("PhonePe provider not yet implemented"); },
};

const PROVIDERS: Record<ProviderKey, PaymentProvider> = {
  razorpay,
  stripe,
  cashfree,
  phonepe,
};

export function getProvider(key: ProviderKey): PaymentProvider {
  return PROVIDERS[key];
}

export function listProviders(): PaymentProvider[] {
  return Object.values(PROVIDERS);
}

export function isValidProviderKey(v: unknown): v is ProviderKey {
  return typeof v === "string" && v in PROVIDERS;
}
