import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, giftCardsTable, type GiftCardRow } from "./db";

// 24-char base32-ish code (no I/O/0/1 to avoid confusion), grouped DT-XXXX-XXXX-XXXX.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGiftCardCode(): string {
  const chunk = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");
  return `DT-${chunk(4)}-${chunk(4)}-${chunk(4)}`;
}

export function normalizeGiftCardCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** Allocate a unique code, retrying on the (extremely unlikely) collision. */
export async function mintUniqueGiftCardCode(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateGiftCardCode();
    const [existing] = await db
      .select({ id: giftCardsTable.id })
      .from(giftCardsTable)
      .where(eq(giftCardsTable.code, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not mint a unique gift card code");
}

/** One year from now — used as the default expiry. */
export function defaultGiftCardExpiry(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export type GiftCardLookup =
  | { ok: true; card: GiftCardRow }
  | { ok: false; reason: "not_found" | "expired" | "depleted" | "cancelled" };

export async function lookupGiftCardByCode(rawCode: string): Promise<GiftCardLookup> {
  const code = normalizeGiftCardCode(rawCode);
  if (!code) return { ok: false, reason: "not_found" };
  const [card] = await db
    .select()
    .from(giftCardsTable)
    .where(eq(giftCardsTable.code, code))
    .limit(1);
  if (!card) return { ok: false, reason: "not_found" };
  if (card.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (card.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (card.balance <= 0) return { ok: false, reason: "depleted" };
  return { ok: true, card };
}

/** Allowed top-up amounts (rupees). Custom amounts must fit MIN..MAX. */
export const GIFT_CARD_MIN = 100;
export const GIFT_CARD_MAX = 50_000;
export const GIFT_CARD_PRESETS = [500, 1000, 2500, 5000, 10_000];
