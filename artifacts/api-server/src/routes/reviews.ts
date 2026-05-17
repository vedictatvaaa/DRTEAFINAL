import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
import {
  db,
  productReviewsTable,
  reviewHelpfulVotesTable,
  ordersTable,
  orderItemsTable,
  shopperUsersTable,
  type ShopperUserRow,
  type ReviewStatus,
} from "../lib/db";
import { logger } from "../lib/logger";
import { requireShopper, getShopper } from "../lib/shopper-auth";
import { requireAdmin, getCurrentAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";

const router: IRouter = Router();

// All admin moderation endpoints below require an admin cookie.
router.use("/admin/reviews", requireAdmin);

interface ReviewSummary {
  count: number;
  average: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

interface ReviewDto {
  id: number;
  productId: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorInitials: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  isMine: boolean;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function displayName(name: string): string {
  // "Aanya Rao" -> "Aanya R." for privacy on a public list.
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[1]![0]!}.`;
}

router.get("/products/:productId/reviews", async (req: Request, res: Response) => {
  const productId = String(req.params["productId"] ?? "").trim();
  if (!productId) {
    res.status(400).json({ error: "productId is required" });
    return;
  }
  try {
    const me = await getShopper(req);
    const rows = await db
      .select({
        id: productReviewsTable.id,
        productId: productReviewsTable.productId,
        rating: productReviewsTable.rating,
        title: productReviewsTable.title,
        body: productReviewsTable.body,
        verifiedPurchase: productReviewsTable.verifiedPurchase,
        helpfulCount: productReviewsTable.helpfulCount,
        createdAt: productReviewsTable.createdAt,
        shopperUserId: productReviewsTable.shopperUserId,
        authorName: shopperUsersTable.name,
      })
      .from(productReviewsTable)
      .leftJoin(
        shopperUsersTable,
        eq(shopperUsersTable.id, productReviewsTable.shopperUserId),
      )
      .where(
        and(
          eq(productReviewsTable.productId, productId),
          eq(productReviewsTable.status, "approved"),
        ),
      )
      .orderBy(desc(productReviewsTable.createdAt));

    const summary: ReviewSummary = {
      count: rows.length,
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
    let total = 0;
    for (const r of rows) {
      total += r.rating;
      const k = Math.max(1, Math.min(5, r.rating)) as 1 | 2 | 3 | 4 | 5;
      summary.distribution[k] += 1;
    }
    summary.average = rows.length ? Math.round((total / rows.length) * 10) / 10 : 0;

    const reviews: ReviewDto[] = rows.map((r) => {
      const fullName = (r.authorName ?? "Tea lover").trim() || "Tea lover";
      return {
        id: r.id,
        productId: r.productId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: displayName(fullName),
        authorInitials: initialsOf(fullName),
        verifiedPurchase: r.verifiedPurchase,
        helpfulCount: r.helpfulCount,
        createdAt: r.createdAt.toISOString(),
        isMine: !!me && r.shopperUserId === me.id,
      };
    });

    res.json({ summary, reviews });
  } catch (err) {
    logger.error({ err, productId }, "reviews.list failed");
    res.status(500).json({ error: "Could not load reviews." });
  }
});

const createSchema = z.object({
  productId: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).default(""),
  body: z.string().trim().min(10).max(2000),
});

router.post(
  "/reviews",
  requireShopper(),
  async (req: Request, res: Response) => {
    const user = (req as Request & { shopper?: ShopperUserRow }).shopper!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid review", issues: parsed.error.issues });
      return;
    }
    const { productId, rating, title, body } = parsed.data;
    try {
      // Verified-purchase check: any past order from this shopper containing
      // an order_item with this productId. We treat any past order (not only
      // delivered) as "verified" for the badge — buyers reviewing right after
      // delivery confirmation is the most common path.
      const purchase = await db
        .select({ id: orderItemsTable.id })
        .from(orderItemsTable)
        .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
        .where(
          and(
            eq(ordersTable.shopperUserId, user.id),
            eq(orderItemsTable.productId, productId),
          ),
        )
        .limit(1);
      const verifiedPurchase = purchase.length > 0;

      const [row] = await db
        .insert(productReviewsTable)
        .values({
          productId,
          shopperUserId: user.id,
          rating,
          title,
          body,
          verifiedPurchase,
          status: "approved",
        })
        .onConflictDoUpdate({
          target: [
            productReviewsTable.shopperUserId,
            productReviewsTable.productId,
          ],
          set: {
            rating,
            title,
            body,
            verifiedPurchase,
            // Keep existing status — admins may have hidden it; resubmitting
            // shouldn't quietly republish.
          },
        })
        .returning();

      // Strip server-only fields (shopperUserId, status) from the response so
      // we don't echo PII or moderation state back to the client.
      res.status(201).json({
        review: row && {
          id: row.id,
          productId: row.productId,
          rating: row.rating,
          title: row.title,
          body: row.body,
          verifiedPurchase: row.verifiedPurchase,
          createdAt: row.createdAt.toISOString(),
        },
      });
    } catch (err) {
      logger.error({ err }, "reviews.create failed");
      res.status(500).json({ error: "Could not save review." });
    }
  },
);

router.post(
  "/reviews/:id/helpful",
  requireShopper(),
  async (req: Request, res: Response) => {
    const user = (req as Request & { shopper?: ShopperUserRow }).shopper!;
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      // Block voting on your own review.
      const [target] = await db
        .select({ shopperUserId: productReviewsTable.shopperUserId })
        .from(productReviewsTable)
        .where(eq(productReviewsTable.id, id))
        .limit(1);
      if (!target) {
        res.status(404).json({ error: "Review not found" });
        return;
      }
      if (target.shopperUserId === user.id) {
        res.status(400).json({ error: "You can't mark your own review as helpful." });
        return;
      }

      // Insert dedupe-row; if another vote from this shopper exists, the
      // unique index swallows it (onConflictDoNothing) and we don't bump
      // the counter. Returns the inserted row only on first vote.
      const inserted = await db
        .insert(reviewHelpfulVotesTable)
        .values({ reviewId: id, shopperUserId: user.id })
        .onConflictDoNothing({
          target: [reviewHelpfulVotesTable.reviewId, reviewHelpfulVotesTable.shopperUserId],
        })
        .returning({ id: reviewHelpfulVotesTable.id });

      if (inserted.length === 0) {
        // Already voted — return current count without incrementing.
        const [row] = await db
          .select({ helpfulCount: productReviewsTable.helpfulCount })
          .from(productReviewsTable)
          .where(eq(productReviewsTable.id, id))
          .limit(1);
        res.json({ helpfulCount: row?.helpfulCount ?? 0, alreadyVoted: true });
        return;
      }

      const [row] = await db
        .update(productReviewsTable)
        .set({ helpfulCount: sql`${productReviewsTable.helpfulCount} + 1` })
        .where(eq(productReviewsTable.id, id))
        .returning({ helpfulCount: productReviewsTable.helpfulCount });
      res.json({ helpfulCount: row?.helpfulCount ?? 0, alreadyVoted: false });
    } catch (err) {
      logger.error({ err, id }, "reviews.helpful failed");
      res.status(500).json({ error: "Could not record vote." });
    }
  },
);

// Bulk summary lookup so listing pages can show real ratings without N calls.
router.get("/reviews/summary", async (req: Request, res: Response) => {
  const idsRaw = String(req.query["productIds"] ?? "").trim();
  if (!idsRaw) {
    res.json({ summaries: {} });
    return;
  }
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (ids.length === 0) {
    res.json({ summaries: {} });
    return;
  }
  try {
    const rows = await db
      .select({
        productId: productReviewsTable.productId,
        count: sql<number>`count(*)::int`,
        average: sql<number>`coalesce(avg(${productReviewsTable.rating}), 0)::float`,
      })
      .from(productReviewsTable)
      .where(
        and(
          inArray(productReviewsTable.productId, ids),
          eq(productReviewsTable.status, "approved"),
        ),
      )
      .groupBy(productReviewsTable.productId);
    const summaries: Record<string, { count: number; average: number }> = {};
    for (const r of rows) {
      summaries[r.productId] = {
        count: r.count,
        average: Math.round(r.average * 10) / 10,
      };
    }
    res.json({ summaries });
  } catch (err) {
    logger.error({ err }, "reviews.summary failed");
    res.status(500).json({ error: "Could not load summaries." });
  }
});

// ─── Admin moderation ─────────────────────────────────────────────────────

router.get("/admin/reviews/overview", async (_req, res) => {
  try {
    const rows = await db
      .select({
        status: productReviewsTable.status,
        rating: productReviewsTable.rating,
      })
      .from(productReviewsTable);
    const counts = { approved: 0, pending: 0, hidden: 0 };
    let total = 0;
    let sum = 0;
    let lowStarCount = 0;
    for (const r of rows) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      total += 1;
      sum += r.rating;
      if (r.rating <= 2) lowStarCount += 1;
    }
    res.json({
      counts,
      total,
      averageRating: total ? Math.round((sum / total) * 10) / 10 : 0,
      lowStarCount,
    });
  } catch (err) {
    logger.error({ err }, "admin.reviews.overview.failed");
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/admin/reviews", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const minRating = Number(req.query.minRating);
    const maxRating = Number(req.query.maxRating);
    const where = and(
      status && ["approved", "pending", "hidden"].includes(status)
        ? eq(productReviewsTable.status, status as ReviewStatus)
        : undefined,
      Number.isFinite(minRating)
        ? sql`${productReviewsTable.rating} >= ${minRating}`
        : undefined,
      Number.isFinite(maxRating)
        ? sql`${productReviewsTable.rating} <= ${maxRating}`
        : undefined,
    );
    const items = await db
      .select({
        id: productReviewsTable.id,
        productId: productReviewsTable.productId,
        rating: productReviewsTable.rating,
        title: productReviewsTable.title,
        body: productReviewsTable.body,
        verifiedPurchase: productReviewsTable.verifiedPurchase,
        helpfulCount: productReviewsTable.helpfulCount,
        status: productReviewsTable.status,
        createdAt: productReviewsTable.createdAt,
        shopperUserId: productReviewsTable.shopperUserId,
        shopperEmail: shopperUsersTable.email,
        shopperName: shopperUsersTable.name,
      })
      .from(productReviewsTable)
      .leftJoin(
        shopperUsersTable,
        eq(shopperUsersTable.id, productReviewsTable.shopperUserId),
      )
      .where(where as ReturnType<typeof eq>)
      .orderBy(desc(productReviewsTable.createdAt))
      .limit(500);
    res.json({ items });
  } catch (err) {
    logger.error({ err }, "admin.reviews.list.failed");
    res.status(500).json({ error: "Failed" });
  }
});

const ModerateBody = z.object({
  status: z.enum(["approved", "pending", "hidden"]),
});

router.patch("/admin/reviews/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = ModerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  try {
    const [row] = await db
      .update(productReviewsTable)
      .set({ status: parsed.data.status })
      .where(eq(productReviewsTable.id, id))
      .returning({
        id: productReviewsTable.id,
        productId: productReviewsTable.productId,
      });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const admin = await getCurrentAdmin(req);
    await recordActivity({
      kind: "review_moderated",
      actor: "admin",
      title: `Review #${id} → ${parsed.data.status}`,
      entityType: "review",
      entityId: id,
      payload: {
        productId: row.productId,
        status: parsed.data.status,
        by: admin?.email,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.reviews.moderate.failed");
    res.status(500).json({ error: "Failed" });
  }
});

router.delete("/admin/reviews/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db
      .delete(productReviewsTable)
      .where(eq(productReviewsTable.id, id));
    const admin = await getCurrentAdmin(req);
    await recordActivity({
      kind: "review_moderated",
      actor: "admin",
      title: `Review #${id} deleted`,
      entityType: "review",
      entityId: id,
      payload: { deleted: true, by: admin?.email },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.reviews.delete.failed");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
