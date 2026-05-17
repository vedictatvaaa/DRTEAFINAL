import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  suppliersTable,
  reorderRulesTable,
  stockMovementsTable,
  productsTable,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  recordStockChange,
  listVariantStock,
} from "../lib/inventory";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(
  ["/admin/inventory", "/admin/suppliers", "/admin/reorder-rules"],
  requireAdmin,
);

// ──────────────────────────────────────────────────────────────────────────
// Overview
// ──────────────────────────────────────────────────────────────────────────

router.get(
  "/admin/inventory/overview",
  async (_req: Request, res: Response) => {
    try {
      const variants = await listVariantStock();
      const totalUnits = variants.reduce((s, v) => s + v.stock, 0);
      const totalValuePaise = variants.reduce(
        (s, v) => s + v.stock * v.unitPrice,
        0,
      );
      const lowStock = variants.filter((v) => v.lowStock);
      const outOfStock = variants.filter((v) => v.stock <= 0);
      const productCount = new Set(variants.map((v) => v.productId)).size;
      const variantCount = variants.length;
      res.json({
        totals: {
          totalUnits,
          totalValuePaise,
          productCount,
          variantCount,
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length,
        },
        lowStock: lowStock.slice(0, 25),
        outOfStock: outOfStock.slice(0, 25),
      });
    } catch (err) {
      logger.error({ err }, "inventory.overview.failed");
      res.status(500).json({ error: "Failed to load overview" });
    }
  },
);

router.get(
  "/admin/inventory/stock",
  async (_req: Request, res: Response) => {
    try {
      const items = await listVariantStock();
      res.json({ items });
    } catch (err) {
      logger.error({ err }, "inventory.stock.failed");
      res.status(500).json({ error: "Failed to list stock" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Movements (audit log)
// ──────────────────────────────────────────────────────────────────────────

router.get(
  "/admin/inventory/movements",
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const productId = (req.query.productId as string) || null;
      const where = productId
        ? eq(stockMovementsTable.productId, productId)
        : undefined;
      const items = await db
        .select({
          id: stockMovementsTable.id,
          productId: stockMovementsTable.productId,
          variantSize: stockMovementsTable.variantSize,
          delta: stockMovementsTable.delta,
          kind: stockMovementsTable.kind,
          reason: stockMovementsTable.reason,
          refType: stockMovementsTable.refType,
          refId: stockMovementsTable.refId,
          createdBy: stockMovementsTable.createdBy,
          createdAt: stockMovementsTable.createdAt,
          productName: productsTable.name,
        })
        .from(stockMovementsTable)
        .leftJoin(
          productsTable,
          eq(productsTable.id, stockMovementsTable.productId),
        )
        .where(where as ReturnType<typeof eq>)
        .orderBy(desc(stockMovementsTable.createdAt))
        .limit(limit);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, "inventory.movements.failed");
      res.status(500).json({ error: "Failed to list movements" });
    }
  },
);

const AdjustBody = z.object({
  productId: z.string().min(1),
  variantSize: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().min(2).max(280),
  kind: z.enum(["receive", "adjust", "return"]).default("adjust"),
});

router.post(
  "/admin/inventory/adjust",
  async (req: Request, res: Response) => {
    const parsed = AdjustBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const result = await recordStockChange({
        productId: parsed.data.productId,
        variantSize: parsed.data.variantSize,
        delta: parsed.data.delta,
        kind: parsed.data.kind,
        reason: parsed.data.reason,
        createdBy: "admin",
        // Manual adjusts can write off damaged stock; allow going to zero
        // but not below.
        allowNegative: false,
      });
      void recordActivity({
        kind: "stock_adjusted",
        actor: "admin",
        title: `Stock ${parsed.data.delta >= 0 ? "+" : ""}${parsed.data.delta} on ${parsed.data.productId} (${parsed.data.variantSize})`,
        summary: parsed.data.reason,
        entityType: "product",
        entityId: parsed.data.productId,
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      logger.warn({ err }, "inventory.adjust.failed");
      res.status(400).json({ error: msg });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Suppliers (CRUD)
// ──────────────────────────────────────────────────────────────────────────

router.get(
  "/admin/suppliers",
  async (_req: Request, res: Response) => {
    try {
      const items = await db
        .select()
        .from(suppliersTable)
        .orderBy(desc(suppliersTable.createdAt));
      res.json({ items });
    } catch (err) {
      logger.error({ err }, "suppliers.list.failed");
      res.status(500).json({ error: "Failed to list suppliers" });
    }
  },
);

const SupplierBody = z.object({
  name: z.string().min(2).max(120),
  contactName: z.string().max(120).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  leadTimeDays: z.number().int().min(0).max(180).default(7),
  notes: z.string().max(2000).optional().nullable(),
});

router.post(
  "/admin/suppliers",
  async (req: Request, res: Response) => {
    const parsed = SupplierBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const [row] = await db
        .insert(suppliersTable)
        .values({
          name: parsed.data.name,
          contactName: parsed.data.contactName ?? null,
          email: parsed.data.email || null,
          phone: parsed.data.phone ?? null,
          leadTimeDays: parsed.data.leadTimeDays,
          notes: parsed.data.notes ?? null,
        })
        .returning();
      res.json(row);
    } catch (err) {
      logger.error({ err }, "suppliers.create.failed");
      res.status(500).json({ error: "Failed to create supplier" });
    }
  },
);

router.patch(
  "/admin/suppliers/:id",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = SupplierBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const patch: Record<string, unknown> = { updatedAt: sql`now()` };
      for (const k of [
        "name",
        "contactName",
        "email",
        "phone",
        "leadTimeDays",
        "notes",
      ] as const) {
        if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
      }
      const [row] = await db
        .update(suppliersTable)
        .set(patch)
        .where(eq(suppliersTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    } catch (err) {
      logger.error({ err }, "suppliers.update.failed");
      res.status(500).json({ error: "Failed to update supplier" });
    }
  },
);

router.delete(
  "/admin/suppliers/:id",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "suppliers.delete.failed");
      res.status(500).json({ error: "Failed to delete supplier" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Reorder rules (CRUD)
// ──────────────────────────────────────────────────────────────────────────

router.get(
  "/admin/reorder-rules",
  async (_req: Request, res: Response) => {
    try {
      const items = await db
        .select({
          id: reorderRulesTable.id,
          productId: reorderRulesTable.productId,
          variantSize: reorderRulesTable.variantSize,
          minStock: reorderRulesTable.minStock,
          reorderQty: reorderRulesTable.reorderQty,
          supplierId: reorderRulesTable.supplierId,
          enabled: reorderRulesTable.enabled,
          createdAt: reorderRulesTable.createdAt,
          updatedAt: reorderRulesTable.updatedAt,
          productName: productsTable.name,
          supplierName: suppliersTable.name,
        })
        .from(reorderRulesTable)
        .leftJoin(
          productsTable,
          eq(productsTable.id, reorderRulesTable.productId),
        )
        .leftJoin(
          suppliersTable,
          eq(suppliersTable.id, reorderRulesTable.supplierId),
        )
        .orderBy(desc(reorderRulesTable.updatedAt));
      res.json({ items });
    } catch (err) {
      logger.error({ err }, "rules.list.failed");
      res.status(500).json({ error: "Failed to list rules" });
    }
  },
);

const RuleBody = z.object({
  productId: z.string().min(1),
  variantSize: z.string().min(1),
  minStock: z.number().int().min(0).max(100_000).default(10),
  reorderQty: z.number().int().min(1).max(100_000).default(50),
  supplierId: z.number().int().nullable().optional(),
  enabled: z.boolean().optional(),
});

router.post(
  "/admin/reorder-rules",
  async (req: Request, res: Response) => {
    const parsed = RuleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      // Validate product + variant exist.
      const [product] = await db
        .select({ id: productsTable.id, variants: productsTable.variants })
        .from(productsTable)
        .where(eq(productsTable.id, parsed.data.productId))
        .limit(1);
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      if (!product.variants.some((v) => v.size === parsed.data.variantSize)) {
        res.status(400).json({ error: "Variant not found on product" });
        return;
      }
      // Upsert against the unique (productId, variantSize) index.
      const [row] = await db
        .insert(reorderRulesTable)
        .values({
          productId: parsed.data.productId,
          variantSize: parsed.data.variantSize,
          minStock: parsed.data.minStock,
          reorderQty: parsed.data.reorderQty,
          supplierId: parsed.data.supplierId ?? null,
          enabled: parsed.data.enabled ?? true,
        })
        .onConflictDoUpdate({
          target: [reorderRulesTable.productId, reorderRulesTable.variantSize],
          set: {
            minStock: parsed.data.minStock,
            reorderQty: parsed.data.reorderQty,
            supplierId: parsed.data.supplierId ?? null,
            enabled: parsed.data.enabled ?? true,
            updatedAt: sql`now()`,
          },
        })
        .returning();
      res.json(row);
    } catch (err) {
      logger.error({ err }, "rules.create.failed");
      res.status(500).json({ error: "Failed to save rule" });
    }
  },
);

router.patch(
  "/admin/reorder-rules/:id",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = RuleBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }
    try {
      const patch: Record<string, unknown> = { updatedAt: sql`now()` };
      for (const k of ["minStock", "reorderQty", "supplierId", "enabled"] as const) {
        if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
      }
      const [row] = await db
        .update(reorderRulesTable)
        .set(patch)
        .where(eq(reorderRulesTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    } catch (err) {
      logger.error({ err }, "rules.update.failed");
      res.status(500).json({ error: "Failed to update rule" });
    }
  },
);

router.delete(
  "/admin/reorder-rules/:id",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      await db.delete(reorderRulesTable).where(eq(reorderRulesTable.id, id));
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "rules.delete.failed");
      res.status(500).json({ error: "Failed to delete rule" });
    }
  },
);

export default router;
