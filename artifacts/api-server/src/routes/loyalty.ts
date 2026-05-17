import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  loyaltyAccountsTable,
  loyaltyLedgerTable,
  type ShopperUserRow,
} from "../lib/db";
import { requireShopper } from "../lib/shopper-auth";
import {
  POINTS_PER_RUPEE_EARN,
  RUPEES_PER_POINT_REDEEM,
  REDEEM_MAX_PCT_OF_SUBTOTAL,
  ensureLoyaltyAccount,
} from "../lib/loyalty";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get(
  "/loyalty/me",
  requireShopper(),
  async (req: Request, res: Response) => {
    const user = (req as Request & { shopper?: ShopperUserRow }).shopper!;
    try {
      // Ensure account exists outside a transaction (single statement).
      await db
        .insert(loyaltyAccountsTable)
        .values({ shopperUserId: user.id })
        .onConflictDoNothing({ target: loyaltyAccountsTable.shopperUserId });

      const [account] = await db
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.shopperUserId, user.id))
        .limit(1);

      const ledger = await db
        .select()
        .from(loyaltyLedgerTable)
        .where(eq(loyaltyLedgerTable.shopperUserId, user.id))
        .orderBy(desc(loyaltyLedgerTable.createdAt))
        .limit(20);

      res.json({
        user: { id: user.id, email: user.email, name: user.name },
        account: account ?? {
          shopperUserId: user.id,
          pointsBalance: 0,
          lifetimePoints: 0,
          lifetimeSpend: 0,
        },
        ledger,
        config: {
          pointsPerRupeeEarn: POINTS_PER_RUPEE_EARN,
          rupeesPerPointRedeem: RUPEES_PER_POINT_REDEEM,
          redeemMaxPctOfSubtotal: REDEEM_MAX_PCT_OF_SUBTOTAL,
        },
      });
    } catch (err) {
      logger.error({ err }, "loyalty.me failed");
      res.status(500).json({ error: "Could not load rewards." });
    }
  },
);

// Suppress unused-import warnings — ensureLoyaltyAccount is exposed for the
// checkout-place transaction in the same package.
void ensureLoyaltyAccount;

export default router;
