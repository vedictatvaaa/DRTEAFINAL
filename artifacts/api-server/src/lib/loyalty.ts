import { eq, sql } from "drizzle-orm";
import {
  loyaltyAccountsTable,
  loyaltyLedgerTable,
  type LoyaltyLedgerKind,
} from "./db";

export const POINTS_PER_RUPEE_EARN = 1 / 10; // 1 point per ₹10 spent
export const RUPEES_PER_POINT_REDEEM = 0.5; // 1 point = ₹0.50 (so 100 pts = ₹50)
export const REDEEM_MAX_PCT_OF_SUBTOTAL = 0.5; // cap redemption at 50% of subtotal

export function pointsEarnedForSpend(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees <= 0) return 0;
  return Math.floor(rupees * POINTS_PER_RUPEE_EARN);
}

export function rupeesForPoints(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.floor(points * RUPEES_PER_POINT_REDEEM);
}

export function maxRedeemablePoints(opts: {
  balance: number;
  subtotal: number;
}): number {
  const subtotalCapRupees = Math.floor(opts.subtotal * REDEEM_MAX_PCT_OF_SUBTOTAL);
  const subtotalCapPoints = Math.floor(subtotalCapRupees / RUPEES_PER_POINT_REDEEM);
  return Math.max(0, Math.min(opts.balance, subtotalCapPoints));
}

type Tx = Parameters<Parameters<typeof import("./db").db.transaction>[0]>[0];

/** Ensures an account row exists for the user (idempotent, race-safe). */
export async function ensureLoyaltyAccount(
  tx: Tx,
  shopperUserId: string,
): Promise<void> {
  await tx
    .insert(loyaltyAccountsTable)
    .values({ shopperUserId })
    .onConflictDoNothing({ target: loyaltyAccountsTable.shopperUserId });
}

/**
 * Posts a ledger entry and updates the account aggregate atomically.
 * `points` is signed in caller's intent ("earn" → positive credit,
 * "redeem" → positive debit applied as a negative balance delta).
 */
export async function postLoyaltyEntry(
  tx: Tx,
  opts: {
    shopperUserId: string;
    kind: LoyaltyLedgerKind;
    points: number;
    orderId?: number | null;
    note?: string;
    spendRupees?: number;
  },
): Promise<void> {
  const points = Math.max(0, Math.floor(opts.points));
  if (points === 0 && !opts.spendRupees) return;
  await ensureLoyaltyAccount(tx, opts.shopperUserId);

  const balanceDelta =
    opts.kind === "redeem" ? -points : opts.kind === "earn" ? points : points;
  const lifetimeDelta = opts.kind === "earn" ? points : 0;
  const spendDelta = opts.kind === "earn" ? Math.max(0, opts.spendRupees ?? 0) : 0;

  await tx.insert(loyaltyLedgerTable).values({
    shopperUserId: opts.shopperUserId,
    kind: opts.kind,
    points: opts.kind === "redeem" ? -points : points,
    orderId: opts.orderId ?? null,
    note: opts.note ?? "",
  });

  await tx
    .update(loyaltyAccountsTable)
    .set({
      pointsBalance: sql`${loyaltyAccountsTable.pointsBalance} + ${balanceDelta}`,
      lifetimePoints: sql`${loyaltyAccountsTable.lifetimePoints} + ${lifetimeDelta}`,
      lifetimeSpend: sql`${loyaltyAccountsTable.lifetimeSpend} + ${spendDelta}`,
      updatedAt: sql`now()`,
    })
    .where(eq(loyaltyAccountsTable.shopperUserId, opts.shopperUserId));
}
