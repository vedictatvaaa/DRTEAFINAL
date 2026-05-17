import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import {
  db,
  productsTable,
  articlesTable,
  ordersTable,
  orderItemsTable,
} from "../lib/db";
import { CreateOrderBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/catalog/products", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.sortOrder), asc(productsTable.name));
  res.json(rows);
});

router.get("/catalog/products/:slug", async (req: Request, res: Response) => {
  const [row] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.slug, String(req.params.slug)));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.get("/catalog/articles", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(articlesTable)
    .where(eq(articlesTable.published, true))
    .orderBy(desc(articlesTable.date));
  res.json(rows);
});

router.get("/catalog/articles/:slug", async (req: Request, res: Response) => {
  const [row] = await db
    .select()
    .from(articlesTable)
    .where(
      and(
        eq(articlesTable.slug, String(req.params.slug)),
        eq(articlesTable.published, true),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.post("/orders", async (req: Request, res: Response) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const productIds = Array.from(new Set(parsed.data.items.map((it) => it.productId)));
  const dbProducts = productIds.length
    ? await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
    : [];
  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  const resolvedItems: Array<{
    productId: string;
    productName: string;
    variantSize: string;
    quantity: number;
    unitPrice: number;
    subscription: boolean;
  }> = [];
  for (const it of parsed.data.items) {
    const product = productMap.get(it.productId);
    if (!product) {
      res.status(400).json({ error: `Unknown product: ${it.productId}` });
      return;
    }
    const variant = product.variants.find((v) => v.size === it.variantSize);
    if (!variant) {
      res.status(400).json({
        error: `Unknown variant '${it.variantSize}' for product ${product.slug}`,
      });
      return;
    }
    resolvedItems.push({
      productId: product.id,
      productName: product.name,
      variantSize: variant.size,
      quantity: it.quantity,
      unitPrice: variant.price,
      subscription: it.subscription ?? false,
    });
  }

  const subtotal = resolvedItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const total = subtotal;
  const [order] = await db
    .insert(ordersTable)
    .values({
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      shippingAddress: parsed.data.shippingAddress,
      currency: parsed.data.currency,
      subtotal,
      total,
      status: "pending",
      notes: parsed.data.notes ?? null,
    })
    .returning();
  const itemRows = resolvedItems.map((it) => ({ orderId: order.id, ...it }));
  await db.insert(orderItemsTable).values(itemRows);

  // Fire-and-forget post-order side effects (email + abandoned cart recovery
  // marker + welcome email for first-time customers). Failures are logged
  // but never block the order response.
  void (async () => {
    try {
      const { renderOrderPlaced, renderWelcome } = await import("../lib/email-templates");
      const { sendEmail } = await import("../lib/email");
      const { eq, and, isNull } = await import("drizzle-orm");
      const { abandonedCartsTable } = await import("../lib/db");

      const insertedItems = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));
      const tpl = renderOrderPlaced({ ...order, items: insertedItems });
      await sendEmail({
        to: order.customerEmail,
        subject: tpl.subject,
        html: tpl.html,
        kind: "order_placed",
        orderId: order.id,
      });

      // Mark any open abandoned-cart row for this email as recovered.
      await db
        .update(abandonedCartsTable)
        .set({ recoveredAt: new Date() })
        .where(
          and(
            eq(abandonedCartsTable.email, order.customerEmail),
            isNull(abandonedCartsTable.recoveredAt),
          ),
        );

      // Welcome email is transactional (sent once per customer's first order)
      // and stays separate from marketing list opt-in. We do NOT auto-add
      // first-time buyers to the newsletter — that requires explicit consent
      // captured via the storefront opt-in form.
      const { sql } = await import("drizzle-orm");
      const prior = await db.execute(
        sql`select count(*)::int as n from orders where customer_email = ${order.customerEmail} and id <> ${order.id}`,
      );
      const isFirst = ((prior.rows[0] as { n?: number } | undefined)?.n ?? 0) === 0;
      if (isFirst) {
        const w = renderWelcome(order.customerName);
        await sendEmail({
          to: order.customerEmail,
          subject: w.subject,
          html: w.html,
          kind: "welcome",
        });
      }
    } catch (err) {
      // best-effort; do not surface to client
      // eslint-disable-next-line no-console
      console.error("post-order email side effect failed", err);
    }
  })();

  res.status(201).json({ ...order, items: itemRows });
});

export default router;
