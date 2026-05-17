import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const BASE_URL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
const API_KEY = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const CartItemSchema = z.object({
  productName: z.string().max(200),
  variantSize: z.string().max(60).optional().default(""),
  quantity: z.number().int().min(1).max(99),
  unitPrice: z.number().int().min(0),
});

const Body = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
  cart: z.array(CartItemSchema).max(30).optional().default([]),
  subtotal: z.number().int().min(0).optional().default(0),
  currency: z.string().max(8).optional().default("INR"),
  customerName: z.string().max(120).optional().default(""),
});

// Lightweight in-memory rate limit: 30 messages / min / IP. To prevent
// unbounded growth on long-running servers we (a) sweep expired buckets every
// 5 minutes and (b) hard-cap the map at MAX_BUCKETS (drops the oldest if
// exceeded).
const MAX_BUCKETS = 10_000;
type Bucket = { n: number; resetAt: number; lastTouchedAt: number };
const buckets = new Map<string, Bucket>();
const sweepHandle = setInterval(() => {
  const now = Date.now();
  for (const [ip, slot] of buckets) {
    if (slot.resetAt <= now) buckets.delete(ip);
  }
}, 5 * 60_000);
if (typeof sweepHandle === "object" && sweepHandle && "unref" in sweepHandle) {
  (sweepHandle as { unref: () => void }).unref();
}

// Evict the bucket whose lastTouchedAt is the smallest. O(n) but only triggers
// when we hit MAX_BUCKETS, which means the sweep already failed to keep up.
function evictOldest(): void {
  let oldestKey: string | undefined;
  let oldestTs = Infinity;
  for (const [ip, slot] of buckets) {
    if (slot.lastTouchedAt < oldestTs) {
      oldestTs = slot.lastTouchedAt;
      oldestKey = ip;
    }
  }
  if (oldestKey !== undefined) buckets.delete(oldestKey);
}

function limited(ip: string): boolean {
  const now = Date.now();
  const slot = buckets.get(ip);
  if (!slot || slot.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) evictOldest();
    buckets.set(ip, { n: 1, resetAt: now + 60_000, lastTouchedAt: now });
    return false;
  }
  if (slot.n >= 30) {
    slot.lastTouchedAt = now;
    return true;
  }
  slot.n += 1;
  slot.lastTouchedAt = now;
  return false;
}

const SYSTEM_PROMPT = `You are the Dr Tea Ritual Concierge — a warm, concise pre-purchase tea expert.
Audience: shoppers about to check out on drtea.in (premium Indian teas, tisanes, chai, kadhas, teaware).
Style: 1-3 short sentences, direct, no fluff, no emojis unless the user uses one.
Capabilities: answer caffeine, brewing time, allergens, gifting, pairing, shelf life, "what fits my mood".
If the user asks about delivery, returns, or order status: say standard delivery is 3-5 working days, free over ₹999, 7-day returns; for status, point them to "My Account → Orders".
If you don't know, say so honestly and suggest emailing care@drtea.in.
Never invent prices. Never make medical claims. Never recommend competing brands.`;

router.post("/ai/concierge", async (req: Request, res: Response) => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "0.0.0.0").toString();
  if (limited(ip)) {
    res.status(429).json({ error: "Too many messages — please slow down a moment." });
    return;
  }
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  if (!BASE_URL || !API_KEY) {
    res.json({
      reply:
        "The Concierge is offline right now. For quick help: most teas brew best at 80-95°C for 3-5 min, and our Floral Tisanes are caffeine-free. Email care@drtea.in for anything specific.",
      degraded: true,
    });
    return;
  }

  const { messages, cart, subtotal, currency, customerName } = parsed.data;

  const cartLine = cart.length
    ? `Customer's current cart: ${cart
        .map((i) => `${i.quantity}× ${i.productName}${i.variantSize ? ` (${i.variantSize})` : ""}`)
        .join(", ")}. Subtotal: ${currency} ${subtotal}.`
    : "Customer's cart is empty.";
  const greetingHint = customerName && customerName !== "Guest User"
    ? `Customer name: ${customerName}.`
    : "";

  try {
    const url = `${BASE_URL.replace(/\/+$/, "")}/chat/completions`;
    const payload = {
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${greetingHint}\n${cartLine}` },
        ...messages,
      ],
      max_completion_tokens: 220,
    };
    const ai = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!ai.ok) {
      const text = await ai.text().catch(() => "");
      logger.warn({ status: ai.status, text: text.slice(0, 200) }, "concierge upstream non-ok");
      res.json({
        reply:
          "I'm having a small hiccup — try again in a moment, or email care@drtea.in for instant help.",
        degraded: true,
      });
      return;
    }
    const json = (await ai.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content?.trim() || "Sorry — I didn't catch that. Could you rephrase?";
    res.json({ reply });
  } catch (err) {
    logger.warn({ err }, "concierge failed");
    res.json({
      reply:
        "I'm having trouble reaching the brew kitchen right now. Try again shortly.",
      degraded: true,
    });
  }
});

export default router;
