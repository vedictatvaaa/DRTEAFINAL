import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac } from "node:crypto";
import { getProvider, isValidProviderKey } from "../lib/payments";
import { getSettings } from "../lib/payments/settings";

const router: IRouter = Router();

// Public: storefront fetches active provider, publishable key, and COD flag.
router.get("/payments/config", async (_req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    const provider = getProvider(settings.activeProvider as Parameters<typeof getProvider>[0]);
    const enabled = provider?.isConfigured() ?? false;
    res.json({
      activeProvider: settings.activeProvider,
      providerLabel: enabled ? provider.label : null,
      enabled,
      publishableKey: enabled ? provider.publishableKey() : null,
      codEnabled: settings.codEnabled,
      codLabel: settings.codLabel,
      paidLabel: settings.paidLabel,
    });
  } catch {
    res.json({
      activeProvider: "razorpay",
      providerLabel: null,
      enabled: false,
      publishableKey: null,
      codEnabled: true,
      codLabel: "Cash on Delivery",
      paidLabel: "UPI / Card / Netbanking",
    });
  }
});

// Storefront → create a provider order for the user to pay.
router.post("/payments/order", async (req: Request, res: Response) => {
  const body = req.body as {
    amount?: unknown;
    currency?: unknown;
    receipt?: unknown;
  };
  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency : "INR";
  const receipt = typeof body.receipt === "string" ? body.receipt : undefined;
  if (!Number.isFinite(amount) || amount < 100 || amount > 10_000_000) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  try {
    const settings = await getSettings();
    const providerKey = settings.activeProvider;
    if (!isValidProviderKey(providerKey)) {
      res.status(503).json({ error: "No payment provider configured" });
      return;
    }
    const provider = getProvider(providerKey);
    if (!provider.isConfigured()) {
      res.status(503).json({ enabled: false, error: "Provider keys missing" });
      return;
    }
    const order = await provider.createOrder({ amountInPaise: amount, currency, receipt });
    res.json({
      provider: provider.key,
      providerOrderId: order.providerOrderId,
      amount: order.amountInPaise,
      currency: order.currency,
      publishableKey: order.publishableKey,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Payment provider error" });
  }
});

// ── Legacy Razorpay-specific endpoints (kept so the storefront keeps working
// while the generic /payments/order + provider abstraction roll out). ──
router.get("/payments/razorpay/config", async (_req: Request, res: Response) => {
  const enabled = Boolean(process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"]);
  res.json({ enabled, keyId: enabled ? process.env["RAZORPAY_KEY_ID"] : null });
});

router.post("/payments/razorpay/order", async (req: Request, res: Response) => {
  const id = process.env["RAZORPAY_KEY_ID"];
  const secret = process.env["RAZORPAY_KEY_SECRET"];
  if (!id || !secret) {
    res.status(503).json({ enabled: false, error: "Razorpay keys missing" });
    return;
  }
  const body = req.body as { amount?: unknown; currency?: unknown; receipt?: unknown };
  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency : "INR";
  if (!Number.isFinite(amount) || amount < 100 || amount > 10_000_000) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  try {
    const provider = getProvider("razorpay");
    const order = await provider.createOrder({
      amountInPaise: amount,
      currency,
      receipt: typeof body.receipt === "string" ? body.receipt : undefined,
    });
    res.json({
      id: order.providerOrderId,
      amount: order.amountInPaise,
      currency: order.currency,
      keyId: id,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Provider error" });
  }
});

router.post("/payments/razorpay/verify", async (req: Request, res: Response) => {
  const secret = process.env["RAZORPAY_KEY_SECRET"];
  if (!secret) {
    res.status(503).json({ verified: false, error: "Razorpay keys missing" });
    return;
  }
  const body = req.body as {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
  };
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  if (!orderId || !paymentId || !signature) {
    res.status(400).json({ verified: false, error: "Missing fields" });
    return;
  }
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  res.json({ verified: expected === signature });
});

export default router;
