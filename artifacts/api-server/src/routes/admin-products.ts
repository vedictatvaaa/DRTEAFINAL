import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, productsTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { AdminCreateProductBody, AdminUpdateProductBody } from "@workspace/api-zod";
import { recordVersion } from "../lib/version-history";
import { backfillProductMeta } from "../lib/seo-meta";
import { backfillRelatedForProduct } from "../lib/seo-related";
import { schedulePing } from "../lib/seo-ping";
import { recordActivity } from "../lib/activity-log";

const ReorderBody = z.object({
  order: z.array(z.string().min(1)).min(1),
});

const router: IRouter = Router();

router.use("/admin/products", requireAdmin);

router.get("/admin/products", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.sortOrder), asc(productsTable.name));
  res.json(rows);
});

router.post("/admin/products", async (req: Request, res: Response) => {
  const parsed = AdminCreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .insert(productsTable)
    .values(parsed.data as typeof productsTable.$inferInsert)
    .returning();
  if (row) {
    await recordVersion("product", row.id, "create", null, row);
    backfillProductMeta(row);
    backfillRelatedForProduct(row);
    schedulePing();
    void recordActivity({
      kind: "product_created",
      actor: "admin",
      title: `Created product: ${row.name ?? row.slug ?? row.id}`,
      entityType: "product",
      entityId: row.id,
    });
  }
  res.status(201).json(row);
});

router.patch("/admin/products/:id", async (req: Request, res: Response) => {
  const parsed = AdminUpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const id = String(req.params.id);
  const [before] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  // Stock lives inside the variants jsonb but is the canonical source of
  // truth for inventory. The admin product editor must NOT clobber stock —
  // any stock change has to flow through /admin/inventory/adjust so we get
  // a stock_movement audit row. So if the incoming patch includes
  // variants, we re-merge stock from the row currently in the DB by size.
  const patch = { ...(parsed.data as Partial<typeof productsTable.$inferInsert>) };
  if (Array.isArray(patch.variants) && before) {
    const currentStockBySize = new Map(
      before.variants.map((v) => [v.size, v.stock]),
    );
    patch.variants = patch.variants.map((v) => ({
      ...v,
      // Existing variant: keep its current stock. New variant: trust the
      // payload (admin is adding a new size with seed inventory).
      stock: currentStockBySize.has(v.size) ? currentStockBySize.get(v.size)! : v.stock,
    }));
  }
  const [row] = await db
    .update(productsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(productsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await recordVersion("product", id, "update", before ?? null, row);
  // Admin-override semantics: if the admin's PATCH body explicitly set any of
  // the SEO fields, treat the new values as the override and do NOT regenerate.
  // Otherwise: only fill in missing meta/related (no force-overwrite). Use the
  // dedicated POST /admin/seo/{meta,related}/product/:id/generate endpoints to
  // explicitly regenerate.
  const body = parsed.data as Record<string, unknown>;
  const adminEditedMeta =
    "metaTitle" in body || "metaDescription" in body || "jsonLd" in body;
  const adminEditedRelated =
    "relatedProductIds" in body || "relatedArticleSlugs" in body;
  const slugChanged = before?.slug !== row.slug;
  const categoryChanged = before?.category !== row.category;

  void recordActivity({
    kind: "product_updated",
    actor: "admin",
    title: `Updated product: ${row.name ?? row.slug ?? row.id}`,
    summary: Object.keys(parsed.data as Record<string, unknown>).join(", "),
    entityType: "product",
    entityId: row.id,
  });
  if (!adminEditedMeta) backfillProductMeta(row);
  if (!adminEditedRelated) backfillRelatedForProduct(row);
  // Slug or category changes affect URL routing / navigation surfaces that
  // search engines crawl — re-ping search engines so they refetch the sitemap.
  if (slugChanged || categoryChanged) schedulePing();
  res.json(row);
});

router.delete("/admin/products/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const [before] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  if (before) {
    await recordVersion("product", id, "delete", before, null);
    schedulePing();
    void recordActivity({
      kind: "product_deleted",
      actor: "admin",
      title: `Deleted product: ${before.name ?? before.slug ?? id}`,
      entityType: "product",
      entityId: id,
    });
  }
  res.json({ ok: true });
});

router.post("/admin/products/reorder", async (req: Request, res: Response) => {
  const parsed = ReorderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const before = await db.select().from(productsTable);
  const beforeById = new Map(before.map((r) => [r.id, r]));
  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.order.length; i++) {
      const id = parsed.data.order[i]!;
      await tx
        .update(productsTable)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(productsTable.id, id));
    }
  });
  // Capture sortOrder reorders as version history per affected product.
  const after = await db.select().from(productsTable);
  for (const row of after) {
    const prev = beforeById.get(row.id);
    if (prev && prev.sortOrder !== row.sortOrder) {
      await recordVersion("product", row.id, "update", prev, row);
    }
  }
  res.json({ ok: true });
});

export default router;
