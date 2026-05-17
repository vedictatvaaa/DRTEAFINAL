import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  productsTable,
  ordersTable,
  articlesTable,
  adminAlertStateTable,
} from "./db";
import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────────────
// Co-pilot tool registry
//
// A small, deliberately-scoped catalog of admin actions the AI co-pilot
// is allowed to execute on the operator's behalf. Every tool is:
//   - Idempotent or trivially reversible
//   - Validated with Zod
//   - Logged through admin_copilot_action_log (caller's responsibility)
//
// Adding a tool: define paramsSchema (zod), description, and execute().
// Returning ok=false from execute() is the only failure mode — never
// throw; callers rely on a structured ToolResult per step.
// ─────────────────────────────────────────────────────────────────────────

export interface ToolResult {
  name: string;
  ok: boolean;
  message?: string;
  data?: unknown;
}

export interface CopilotTool<TParams = unknown> {
  name: string;
  description: string;
  paramsSchema: z.ZodType<TParams>;
  // A short, human-readable formatter used in the confirmation card.
  summarize: (params: TParams) => string;
  execute: (params: TParams) => Promise<ToolResult>;
}

const ORDER_STATUSES = [
  "pending",
  "paid",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "failed",
  "refunded",
] as const;

// ─────────────────────────────────────────────────────────────────────────
// update_order_status
// ─────────────────────────────────────────────────────────────────────────
const UpdateOrderStatusParams = z.object({
  orderId: z.number().int().positive(),
  status: z.enum(ORDER_STATUSES),
});
type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusParams>;

const updateOrderStatusTool: CopilotTool<UpdateOrderStatusInput> = {
  name: "update_order_status",
  description: "Change the fulfilment status of a single order.",
  paramsSchema: UpdateOrderStatusParams,
  summarize: (p) => `Set order #${p.orderId} status to "${p.status}"`,
  execute: async (params) => {
    try {
      const updated = await db
        .update(ordersTable)
        .set({ status: params.status, updatedAt: new Date() })
        .where(eq(ordersTable.id, params.orderId))
        .returning({ id: ordersTable.id, status: ordersTable.status });
      if (updated.length === 0) {
        return {
          name: updateOrderStatusTool.name,
          ok: false,
          message: `Order #${params.orderId} was not found.`,
        };
      }
      return {
        name: updateOrderStatusTool.name,
        ok: true,
        message: `Order #${params.orderId} is now "${params.status}".`,
        data: updated[0],
      };
    } catch (err) {
      logger.error({ err, params }, "copilot.tool.update_order_status.failed");
      return {
        name: updateOrderStatusTool.name,
        ok: false,
        message: "Database error while updating the order.",
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// restock_variant — patches the variants jsonb to set a new stock value
// for the matching size SKU.
// ─────────────────────────────────────────────────────────────────────────
const RestockVariantParams = z.object({
  productId: z.string().min(1).max(120),
  size: z.string().min(1).max(40),
  stock: z.number().int().min(0).max(100000),
});
type RestockVariantInput = z.infer<typeof RestockVariantParams>;

const restockVariantTool: CopilotTool<RestockVariantInput> = {
  name: "restock_variant",
  description: "Set the on-hand stock for a single product variant by size.",
  paramsSchema: RestockVariantParams,
  summarize: (p) =>
    `Set ${p.productId} (${p.size}) stock to ${p.stock} units`,
  execute: async (params) => {
    try {
      const rows = await db
        .select({
          id: productsTable.id,
          variants: productsTable.variants,
        })
        .from(productsTable)
        .where(eq(productsTable.id, params.productId));
      if (rows.length === 0) {
        return {
          name: restockVariantTool.name,
          ok: false,
          message: `Product "${params.productId}" was not found.`,
        };
      }
      const variants = rows[0].variants ?? [];
      const idx = variants.findIndex(
        (v) => v.size?.toLowerCase() === params.size.toLowerCase(),
      );
      if (idx < 0) {
        return {
          name: restockVariantTool.name,
          ok: false,
          message: `No "${params.size}" variant on product "${params.productId}".`,
        };
      }
      const next = variants.map((v, i) =>
        i === idx ? { ...v, stock: params.stock } : v,
      );
      await db
        .update(productsTable)
        .set({ variants: next, updatedAt: new Date() })
        .where(eq(productsTable.id, params.productId));
      return {
        name: restockVariantTool.name,
        ok: true,
        message: `${params.productId} (${params.size}) is now ${params.stock} units.`,
        data: { productId: params.productId, size: params.size, stock: params.stock },
      };
    } catch (err) {
      logger.error({ err, params }, "copilot.tool.restock_variant.failed");
      return {
        name: restockVariantTool.name,
        ok: false,
        message: "Database error while updating stock.",
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// publish_article — flip published=true on a journal article.
// ─────────────────────────────────────────────────────────────────────────
const PublishArticleParams = z.object({
  articleId: z.number().int().positive(),
});
type PublishArticleInput = z.infer<typeof PublishArticleParams>;

const publishArticleTool: CopilotTool<PublishArticleInput> = {
  name: "publish_article",
  description: "Mark a journal article as published so it appears on the storefront.",
  paramsSchema: PublishArticleParams,
  summarize: (p) => `Publish article #${p.articleId}`,
  execute: async (params) => {
    try {
      const updated = await db
        .update(articlesTable)
        .set({ published: true, updatedAt: new Date() })
        .where(eq(articlesTable.id, params.articleId))
        .returning({ id: articlesTable.id, title: articlesTable.title });
      if (updated.length === 0) {
        return {
          name: publishArticleTool.name,
          ok: false,
          message: `Article #${params.articleId} was not found.`,
        };
      }
      return {
        name: publishArticleTool.name,
        ok: true,
        message: `"${updated[0].title}" is now live on the journal.`,
        data: updated[0],
      };
    } catch (err) {
      logger.error({ err, params }, "copilot.tool.publish_article.failed");
      return {
        name: publishArticleTool.name,
        ok: false,
        message: "Database error while publishing the article.",
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// mark_alerts_seen — touch the alerts singleton's lastSeenAt.
// ─────────────────────────────────────────────────────────────────────────
const MarkAlertsSeenParams = z.object({}).strict();
type MarkAlertsSeenInput = z.infer<typeof MarkAlertsSeenParams>;

const markAlertsSeenTool: CopilotTool<MarkAlertsSeenInput> = {
  name: "mark_alerts_seen",
  description: "Mark every current admin alert as read.",
  paramsSchema: MarkAlertsSeenParams,
  summarize: () => "Mark all admin alerts as read",
  execute: async () => {
    try {
      await db
        .insert(adminAlertStateTable)
        .values({ id: "singleton", lastSeenAt: new Date(), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: adminAlertStateTable.id,
          set: { lastSeenAt: new Date(), updatedAt: new Date() },
        });
      return {
        name: markAlertsSeenTool.name,
        ok: true,
        message: "All current alerts are now marked as seen.",
      };
    } catch (err) {
      logger.error({ err }, "copilot.tool.mark_alerts_seen.failed");
      return {
        name: markAlertsSeenTool.name,
        ok: false,
        message: "Database error while marking alerts as seen.",
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// dismiss_admin_alert — add a key to the dismissed map.
// ─────────────────────────────────────────────────────────────────────────
const DismissAdminAlertParams = z.object({
  key: z.string().trim().min(3).max(200),
});
type DismissAdminAlertInput = z.infer<typeof DismissAdminAlertParams>;

const dismissAdminAlertTool: CopilotTool<DismissAdminAlertInput> = {
  name: "dismiss_admin_alert",
  description: "Permanently dismiss a single admin alert by its key.",
  paramsSchema: DismissAdminAlertParams,
  summarize: (p) => `Dismiss admin alert "${p.key}"`,
  execute: async (params) => {
    try {
      const nowIso = new Date().toISOString();
      // Read-modify-write the dismissed jsonb map. Singleton row guaranteed
      // to exist by /admin/alerts loadState() the first time alerts are read,
      // but we upsert here defensively.
      const rows = await db
        .select({ dismissed: adminAlertStateTable.dismissed })
        .from(adminAlertStateTable)
        .where(eq(adminAlertStateTable.id, "singleton"));
      const current = rows[0]?.dismissed ?? {};
      const next = { ...current, [params.key]: nowIso };
      await db
        .insert(adminAlertStateTable)
        .values({
          id: "singleton",
          dismissed: next,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: adminAlertStateTable.id,
          set: { dismissed: next, updatedAt: new Date() },
        });
      return {
        name: dismissAdminAlertTool.name,
        ok: true,
        message: `Alert "${params.key}" dismissed.`,
        data: { key: params.key },
      };
    } catch (err) {
      logger.error({ err, params }, "copilot.tool.dismiss_admin_alert.failed");
      return {
        name: dismissAdminAlertTool.name,
        ok: false,
        message: "Database error while dismissing the alert.",
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────

// Loosely typed map for runtime dispatch. Each tool keeps its own zod
// schema and validates inputs in executeTool() before invoking execute().
const TOOL_REGISTRY: Record<string, CopilotTool<any>> = {
  [updateOrderStatusTool.name]: updateOrderStatusTool,
  [restockVariantTool.name]: restockVariantTool,
  [publishArticleTool.name]: publishArticleTool,
  [markAlertsSeenTool.name]: markAlertsSeenTool,
  [dismissAdminAlertTool.name]: dismissAdminAlertTool,
};

export const TOOL_NAMES = Object.keys(TOOL_REGISTRY) as Array<
  keyof typeof TOOL_REGISTRY
>;

// Exposed catalog used by the LLM prompt + the UI confirmation card.
export const TOOL_CATALOG = Object.values(TOOL_REGISTRY).map((t) => ({
  name: t.name,
  description: t.description,
}));

export function getTool(name: string): CopilotTool | undefined {
  return TOOL_REGISTRY[name];
}

export function summarizeToolCall(
  name: string,
  params: Record<string, unknown>,
): string {
  const tool = getTool(name);
  if (!tool) return `${name}(${JSON.stringify(params)})`;
  const parsed = tool.paramsSchema.safeParse(params);
  if (!parsed.success) return `${name} (invalid params)`;
  try {
    return tool.summarize(parsed.data);
  } catch {
    return tool.name;
  }
}

export async function executeTool(
  name: string,
  params: unknown,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return { name, ok: false, message: `Unknown tool "${name}".` };
  }
  const parsed = tool.paramsSchema.safeParse(params ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      name,
      ok: false,
      message: `Invalid parameters: ${issue?.path?.join(".") ?? "?"} — ${issue?.message ?? "validation failed"}`,
    };
  }
  return tool.execute(parsed.data);
}

// Used by the planning endpoint to embed the catalog into the LLM prompt
// so the model knows what it's allowed to call. Avoids dumping the whole
// zod schema — descriptions are enough for the model to pick a tool.
export function toolCatalogPrompt(): string {
  return TOOL_NAMES.map((n) => {
    const t = TOOL_REGISTRY[n];
    return `- ${t.name}: ${t.description}`;
  }).join("\n");
}
