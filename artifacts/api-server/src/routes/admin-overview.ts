import { Router, type IRouter, type Request, type Response } from "express";
import { sql, desc, eq, asc } from "drizzle-orm";
import { db, productsTable, articlesTable, ordersTable, orderItemsTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";

const router: IRouter = Router();

router.use("/admin/overview", requireAdmin);

router.get("/admin/overview", async (_req: Request, res: Response) => {
  const [productCountRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(productsTable);
  const [articleCountRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(articlesTable);
  const [draftArticleRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(articlesTable)
    .where(eq(articlesTable.published, false));
  const [orderCountRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ordersTable);
  const [pendingRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "pending"));
  const [revenueRow] = await db
    .select({ s: sql<number>`coalesce(sum(total),0)::int` })
    .from(ordersTable);

  const recentOrderRows = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);
  const recentOrders = await Promise.all(
    recentOrderRows.map(async (o) => {
      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, o.id));
      return { ...o, items };
    }),
  );

  const products = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.name));
  const lowStockProducts = products
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      totalStock: (p.variants ?? []).reduce(
        (sum, v) => sum + (v?.stock ?? 0),
        0,
      ),
    }))
    .filter((p) => p.totalStock < 20)
    .slice(0, 10);

  res.json({
    productCount: productCountRow?.c ?? 0,
    articleCount: articleCountRow?.c ?? 0,
    draftArticleCount: draftArticleRow?.c ?? 0,
    orderCount: orderCountRow?.c ?? 0,
    pendingOrderCount: pendingRow?.c ?? 0,
    revenueTotal: revenueRow?.s ?? 0,
    recentOrders,
    lowStockProducts,
  });
});

export default router;
