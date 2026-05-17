import { eq, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  stockMovementsTable,
  type StockMovementKind,
} from "./db";
import { logger } from "./logger";

// Centralised inventory writes. All stock changes go through
// recordStockChange so we have a single audit trail and a single place to
// enforce non-negative stock + variant existence.

export interface RecordStockChangeInput {
  productId: string;
  variantSize: string;
  delta: number; // +ve = received, -ve = removed
  kind: StockMovementKind;
  reason?: string;
  refType?: string;
  refId?: string;
  createdBy?: string;
  // If true, allow stock to go negative (e.g. emergency adjust). Defaults
  // to false so a buggy caller can't oversell silently.
  allowNegative?: boolean;
}

export interface StockChangeResult {
  movementId: number;
  newStock: number;
}

export async function recordStockChange(
  input: RecordStockChangeInput,
): Promise<StockChangeResult> {
  return db.transaction(async (tx) => {
    // Lock the product row while we patch the variants jsonb so concurrent
    // sales / receipts don't race past each other.
    const rows = await tx
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, input.productId))
      .for("update");
    const product = rows[0];
    if (!product) throw new Error(`Product ${input.productId} not found`);
    const variants = product.variants;
    const idx = variants.findIndex((v) => v.size === input.variantSize);
    if (idx < 0) {
      throw new Error(
        `Variant ${input.variantSize} not found on product ${input.productId}`,
      );
    }
    const current = variants[idx].stock;
    const next = current + input.delta;
    if (next < 0 && !input.allowNegative) {
      throw new Error(
        `Insufficient stock: ${input.productId}/${input.variantSize} has ${current}, requested ${-input.delta}`,
      );
    }
    const updatedVariants = variants.map((v, i) =>
      i === idx ? { ...v, stock: next } : v,
    );
    await tx
      .update(productsTable)
      .set({ variants: updatedVariants })
      .where(eq(productsTable.id, input.productId));
    const [mv] = await tx
      .insert(stockMovementsTable)
      .values({
        productId: input.productId,
        variantSize: input.variantSize,
        delta: input.delta,
        kind: input.kind,
        reason: input.reason ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        createdBy: input.createdBy ?? "system",
      })
      .returning();
    return { movementId: mv.id, newStock: next };
  });
}

// Best-effort logger for cases where the caller has already updated stock
// (e.g. checkout-place's existing transaction). Records the movement
// without touching products.variants.
export async function logStockMovement(
  input: Omit<RecordStockChangeInput, "allowNegative">,
): Promise<void> {
  try {
    await db.insert(stockMovementsTable).values({
      productId: input.productId,
      variantSize: input.variantSize,
      delta: input.delta,
      kind: input.kind,
      reason: input.reason ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      createdBy: input.createdBy ?? "system",
    });
  } catch (err) {
    logger.warn({ err }, "inventory.movement.log_failed");
  }
}

// Aggregate count of movements per (productId, variantSize) for the
// inventory overview page.
export interface VariantStockSummary {
  productId: string;
  productName: string;
  variantSize: string;
  stock: number;
  unitPrice: number;
  // Optional rule-derived fields.
  minStock: number | null;
  reorderQty: number | null;
  lowStock: boolean;
}

export async function listVariantStock(): Promise<VariantStockSummary[]> {
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      variants: productsTable.variants,
    })
    .from(productsTable);
  // Pull rules in one query.
  const rulesRows = await db.execute<{
    product_id: string;
    variant_size: string;
    min_stock: number;
    reorder_qty: number;
  }>(
    sql`SELECT product_id, variant_size, min_stock, reorder_qty FROM reorder_rules WHERE enabled = true`,
  );
  const ruleByKey = new Map<
    string,
    { minStock: number; reorderQty: number }
  >();
  for (const r of rulesRows.rows) {
    ruleByKey.set(`${r.product_id}::${r.variant_size}`, {
      minStock: r.min_stock,
      reorderQty: r.reorder_qty,
    });
  }
  const out: VariantStockSummary[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      const rule = ruleByKey.get(`${p.id}::${v.size}`);
      out.push({
        productId: p.id,
        productName: p.name,
        variantSize: v.size,
        stock: v.stock,
        unitPrice: v.price,
        minStock: rule?.minStock ?? null,
        reorderQty: rule?.reorderQty ?? null,
        lowStock: rule ? v.stock <= rule.minStock : false,
      });
    }
  }
  return out;
}
