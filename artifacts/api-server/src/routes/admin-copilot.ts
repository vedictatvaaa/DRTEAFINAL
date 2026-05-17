import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { sql, desc, gte, eq } from "drizzle-orm";
import {
  db,
  productsTable,
  ordersTable,
  marketingCampaignsTable,
  shopperUsersTable,
  adminCopilotActionLogTable,
  type CopilotToolCall,
  type CopilotToolResult,
  type CopilotPlanStatus,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";
import { chatCompletionJSON } from "../lib/openaiText";
import {
  TOOL_NAMES,
  executeTool,
  summarizeToolCall,
  toolCatalogPrompt,
} from "../lib/copilot-tools";
import { recordActivity } from "../lib/activity-log";

const router: IRouter = Router();
router.use("/admin/copilot", requireAdmin);

// Tool plan shape — emitted by the LLM (or fallback) and confirmed by the
// operator before /execute runs anything.
const ToolCallSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

// Tab IDs that exist in the admin UI. Keep in sync with TAB_RENDERERS in
// artifacts/dr-tea/src/pages/admin/index.tsx.
const TAB_IDS = [
  "overview",
  "products",
  "articles",
  "teapedia",
  "orders",
  "payments",
  "backup",
  "seo",
  "marketing",
  "campaigns",
  "analytics",
  "community",
  "content",
  "experience",
] as const;

const ENTITY_KINDS = ["products", "orders", "customers", "articles", "campaigns"] as const;

const IntentSchema = z.object({
  kind: z.enum(["navigate", "search", "answer", "action", "plan", "error"]),
  title: z.string().max(140).optional().default(""),
  reason: z.string().max(280).optional().default(""),
  // navigate
  tabId: z.enum(TAB_IDS).optional(),
  // search
  entity: z.enum(ENTITY_KINDS).optional(),
  query: z.string().max(140).optional(),
  // answer
  answer: z.string().max(1200).optional(),
  bullets: z.array(z.string().max(220)).max(6).optional(),
  metric: z
    .object({
      label: z.string().max(60),
      value: z.string().max(60),
    })
    .optional(),
  // action (non-executing — we describe what we WOULD do and route the user)
  description: z.string().max(600).optional(),
  confirmHint: z.string().max(200).optional(),
  suggestedTab: z.enum(TAB_IDS).optional(),
  // plan (executable — operator confirms before /execute is called)
  plan: z.array(ToolCallSchema).max(8).optional(),
});
type Intent = z.infer<typeof IntentSchema>;

const BodySchema = z.object({
  query: z.string().trim().min(2).max(400),
});

// ─────────────────────────────────────────────────────────────────────────
// Lightweight store context — gives the AI just enough numbers to answer
// "how is the store doing" without expensive aggregates.
// ─────────────────────────────────────────────────────────────────────────

async function getStoreSnapshot() {
  const since30 = new Date();
  since30.setUTCDate(since30.getUTCDate() - 30);
  const since7 = new Date();
  since7.setUTCDate(since7.getUTCDate() - 7);

  try {
    const [productCountRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(productsTable);
    const [customerCountRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(shopperUsersTable);
    const [campaignCountRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(marketingCampaignsTable);

    const [orders30Row] = await db
      .select({
        orders: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)::int`,
      })
      .from(ordersTable)
      .where(gte(ordersTable.createdAt, since30));

    const [orders7Row] = await db
      .select({
        orders: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)::int`,
      })
      .from(ordersTable)
      .where(gte(ordersTable.createdAt, since7));

    // Low-stock detection: stock lives inside variants jsonb. Compute in JS.
    const allProductsForStock = await db
      .select({
        name: productsTable.name,
        variants: productsTable.variants,
      })
      .from(productsTable);
    const lowStock = allProductsForStock
      .map((p) => ({
        name: p.name,
        stock: (p.variants ?? []).reduce(
          (s: number, v) => s + (v?.stock ?? 0),
          0,
        ),
      }))
      .filter((p) => p.stock <= 10)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);

    const recentOrders = await db
      .select({
        id: ordersTable.id,
        total: ordersTable.total,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(3);

    return {
      counts: {
        products: productCountRow?.c ?? 0,
        customers: customerCountRow?.c ?? 0,
        campaigns: campaignCountRow?.c ?? 0,
      },
      last30Days: {
        orders: orders30Row?.orders ?? 0,
        revenueINR: orders30Row?.revenue ?? 0,
      },
      last7Days: {
        orders: orders7Row?.orders ?? 0,
        revenueINR: orders7Row?.revenue ?? 0,
      },
      lowStock,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt?.toISOString?.() ?? null,
      })),
    };
  } catch (err) {
    logger.warn({ err }, "copilot.snapshot.failed");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic fallback — keyword router used when the AI is unavailable.
// ─────────────────────────────────────────────────────────────────────────

function fallbackIntent(query: string, snapshot: Awaited<ReturnType<typeof getStoreSnapshot>>): Intent {
  const q = query.toLowerCase();

  // Action-verb plan heuristics — match BEFORE any answer/nav patterns so a
  // command like "mark order 1234 as shipped" doesn't get routed to the
  // orders tab. Each pattern produces a single-step plan that the operator
  // still has to confirm before /execute runs anything.
  const orderStatusMatch = q.match(
    /\b(?:mark|set|change)\b.*?\border\s*#?(\d{1,7})\b.*?\b(pending|paid|packed|shipped|delivered|cancelled|failed|refunded)\b/,
  );
  if (orderStatusMatch) {
    const [, idStr, status] = orderStatusMatch;
    return {
      kind: "plan",
      title: `Set order #${idStr} to ${status}`,
      reason: "Matched an order-status command.",
      plan: [
        {
          name: "update_order_status",
          description: `Set order #${idStr} status to "${status}".`,
          params: { orderId: Number(idStr), status },
        },
      ],
    };
  }
  if (
    /\b(mark|clear|dismiss)\b.*\b(all\s+)?alerts?\b.*\b(seen|read)\b/.test(q) ||
    /\b(mark all alerts (?:as )?(?:seen|read))\b/.test(q)
  ) {
    return {
      kind: "plan",
      title: "Mark all admin alerts as read",
      reason: "Matched a dismiss-alerts command.",
      plan: [
        {
          name: "mark_alerts_seen",
          description: "Mark every current admin alert as read.",
          params: {},
        },
      ],
    };
  }
  const publishMatch = q.match(
    /\b(publish|release|go\s*live)\b.*?\barticle\s*#?(\d{1,6})\b/,
  );
  if (publishMatch) {
    const id = Number(publishMatch[2]);
    return {
      kind: "plan",
      title: `Publish article #${id}`,
      reason: "Matched a publish-article command.",
      plan: [
        {
          name: "publish_article",
          description: `Publish article #${id} to the journal.`,
          params: { articleId: id },
        },
      ],
    };
  }

  // Quick numeric / answer questions FIRST — these are easily hijacked by
  // broad nav regexes (e.g. "low stock products" → products tab) so they
  // must take priority over navigation matching.
  if (snapshot) {
    if (/(low stock|out of stock|running out|stock left)/.test(q)) {
      return {
        kind: "answer",
        title: "Low stock SKUs",
        reason: "Matched a low-stock question.",
        answer:
          snapshot.lowStock.length === 0
            ? "All SKUs are well stocked."
            : `You have ${snapshot.lowStock.length} SKUs at or below 10 units.`,
        bullets: snapshot.lowStock.map((p) => `${p.name} — ${p.stock} left`),
      };
    }
    if (/(how much|revenue|sales|earnings|made|grossed)/.test(q) && /(7|week)/.test(q)) {
      return {
        kind: "answer",
        title: "Revenue · last 7 days",
        reason: "Matched a 7-day revenue question.",
        answer: `Your store made ₹${snapshot.last7Days.revenueINR.toLocaleString("en-IN")} across ${snapshot.last7Days.orders} orders in the last 7 days.`,
        metric: {
          label: "7-day revenue",
          value: `₹${snapshot.last7Days.revenueINR.toLocaleString("en-IN")}`,
        },
      };
    }
    if (/(how much|revenue|sales|earnings|made|grossed)/.test(q) && /(30|month)/.test(q)) {
      return {
        kind: "answer",
        title: "Revenue · last 30 days",
        reason: "Matched a 30-day revenue question.",
        answer: `Your store made ₹${snapshot.last30Days.revenueINR.toLocaleString("en-IN")} across ${snapshot.last30Days.orders} orders in the last 30 days.`,
        metric: {
          label: "30-day revenue",
          value: `₹${snapshot.last30Days.revenueINR.toLocaleString("en-IN")}`,
        },
      };
    }
    if (/(how many|count).*(product|sku)/.test(q)) {
      return {
        kind: "answer",
        title: "Catalogue size",
        reason: "Matched a product-count question.",
        answer: `You have ${snapshot.counts.products} products in the catalogue.`,
        metric: { label: "Total products", value: String(snapshot.counts.products) },
      };
    }
    if (/(how many|count).*(customer|user|subscriber)/.test(q)) {
      return {
        kind: "answer",
        title: "Customer count",
        reason: "Matched a customer-count question.",
        answer: `You have ${snapshot.counts.customers} registered customers.`,
        metric: { label: "Total customers", value: String(snapshot.counts.customers) },
      };
    }
  }

  // Navigation rules — only after specific answer patterns have been ruled out.
  const navMap: Array<[RegExp, (typeof TAB_IDS)[number], string]> = [
    [/\b(dashboard|home|overview|mission)\b/, "overview", "Mission Control"],
    [/\b(product|sku|inventory|stock)\b/, "products", "Products"],
    [/\b(order|fulfil|shipment)\b/, "orders", "Orders"],
    [/\b(article|blog|journal|post)\b/, "articles", "Journal"],
    [/\b(teapedia|encyclopedia|wiki)\b/, "teapedia", "Teapedia"],
    [/\b(payment|payout|refund|invoice)\b/, "payments", "Payments"],
    [/\b(backup|export|download)\b/, "backup", "Backup"],
    [/\b(seo|meta|sitemap|keyword)\b/, "seo", "SEO"],
    [/\b(market|email|push|notif)\b/, "marketing", "Marketing"],
    [/\b(campaign|broadcast)\b/, "campaigns", "Campaigns"],
    [/\b(analytic|report|funnel|conversion)\b/, "analytics", "Analytics"],
    [/\b(community|review|comment|customer)\b/, "community", "Community"],
    [/\b(content studio|generate|write|copy)\b/, "content", "Content Studio"],
    [/\b(experience|theme|design|brand)\b/, "experience", "Experience"],
  ];
  for (const [re, tabId, label] of navMap) {
    if (re.test(q)) {
      return {
        kind: "navigate",
        tabId,
        title: `Open ${label}`,
        reason: `Matched "${re.source}" — opening ${label}.`,
      };
    }
  }

  return {
    kind: "error",
    title: "I didn't catch that",
    reason:
      "Try things like: 'open campaigns', 'revenue last 7 days', 'how many products', 'low stock', 'go to orders'.",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────

router.post("/admin/copilot/intent", async (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { query } = parsed.data;

  const snapshot = await getStoreSnapshot();

  // Try AI first
  const aiSystem = `You are Dr Tea's admin co-pilot. The merchant types a natural-language command; you route it to one of SIX intents:

1) "navigate" — opens an admin tab. Pick the right tabId from: ${TAB_IDS.join(", ")}.
2) "search"   — searches an entity. entity ∈ {${ENTITY_KINDS.join(", ")}}; populate "query" with what to search.
3) "answer"   — answers a question about the store using the snapshot below. Provide a short "answer" (under 600 chars), optional "bullets" (max 6), and optional "metric" {label, value}.
4) "plan"     — the merchant asked for an action that maps to one of your tools. Emit a "plan" array of tool calls. The operator will see and confirm before anything runs. Each plan step is { "name": "<tool name>", "description": "<what this step does>", "params": { ... } }. PREFER plan over "action" whenever a tool fits.
5) "action"   — the merchant wants to do something for which NO tool exists yet. Describe what would happen in "description", give a short "confirmHint", set "suggestedTab" to the tab where they can do it.
6) "error"    — only if the request makes no sense. Put a friendly nudge in "reason".

AVAILABLE TOOLS (only use these names in plan steps):
${toolCatalogPrompt()}

When emitting a "plan", ONLY include tool names from the list above and only include params keys you are confident the tool needs (e.g. update_order_status takes { "orderId": <int>, "status": "shipped"|"packed"|...}; restock_variant takes { "productId": <string>, "size": <string>, "stock": <int> }; publish_article takes { "articleId": <int> }; mark_alerts_seen takes {}; dismiss_admin_alert takes { "key": <string> }). If the merchant did not give you the IDs you need, fall back to "action" with a suggestedTab so they can do it manually.

ALWAYS include a short "title" (under 80 chars) and "reason" (under 200 chars) explaining your routing choice. All currency is INR (₹). Output ONLY valid JSON matching the agreed schema — no commentary, no markdown.

STORE SNAPSHOT (use for "answer" intents):
${JSON.stringify(snapshot, null, 2)}`;

  const aiUser = `Merchant query: """${query}"""

Return JSON with shape:
{
  "kind": "navigate" | "search" | "answer" | "plan" | "action" | "error",
  "title": "short title",
  "reason": "why you chose this routing",
  "tabId": "<one of the tab ids — only for navigate/action>",
  "entity": "<one of products|orders|customers|articles|campaigns — only for search>",
  "query": "<search query — only for search>",
  "answer": "<full answer text — only for answer>",
  "bullets": ["..."],
  "metric": { "label": "...", "value": "..." },
  "description": "<what would happen — only for action>",
  "confirmHint": "<short confirm copy — only for action>",
  "suggestedTab": "<tab id — only for action>",
  "plan": [ { "name": "<tool name>", "description": "<step summary>", "params": { ... } } ]
}`;

  const aiResult = await chatCompletionJSON<unknown>({
    systemPrompt: aiSystem,
    userPrompt: aiUser,
    maxTokens: 700,
    timeoutMs: 25_000,
  });

  let intent: Intent | null = null;
  let usedFallback = false;
  if (aiResult) {
    const parsedIntent = IntentSchema.safeParse(aiResult);
    if (parsedIntent.success) {
      intent = parsedIntent.data;
      // Sanity guard: if the model claims a plan but every step references an
      // unknown tool, reject the intent and fall back. Otherwise the UI
      // would render a confirmation card the operator can never run.
      if (intent.kind === "plan") {
        const steps = intent.plan ?? [];
        const allKnown =
          steps.length > 0 &&
          steps.every((s) => (TOOL_NAMES as string[]).includes(s.name));
        if (!allKnown) {
          logger.warn(
            { steps },
            "copilot.intent.plan.unknown_tools — falling back",
          );
          intent = null;
        }
      }
    } else {
      logger.warn({ err: parsedIntent.error.issues }, "copilot.intent.invalid_ai_shape");
    }
  }

  if (!intent) {
    intent = fallbackIntent(query, snapshot);
    usedFallback = true;
  }

  res.json({ intent, usedFallback });
});

// ─────────────────────────────────────────────────────────────────────────
// Execute a confirmed plan. The frontend posts the same plan it just
// showed the operator. We validate every step, run them sequentially,
// capture per-step results, and persist the whole transaction to
// admin_copilot_action_log for an auditable trail.
// ─────────────────────────────────────────────────────────────────────────

const ExecuteBody = z.object({
  query: z.string().trim().min(0).max(400).default(""),
  plan: z.array(ToolCallSchema).min(1).max(8),
});

router.post("/admin/copilot/execute", async (req: Request, res: Response) => {
  const parsed = ExecuteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { query, plan } = parsed.data;

  // Reject up front if any step references a tool we don't know — better
  // than running a half-valid plan and partially mutating the store.
  const unknown = plan.filter((s) => !(TOOL_NAMES as string[]).includes(s.name));
  if (unknown.length > 0) {
    res.status(400).json({
      error: "Unknown tool(s) in plan",
      tools: unknown.map((s) => s.name),
    });
    return;
  }

  // Insert the audit row first. This is FAIL-CLOSED: if we cannot persist
  // the audit trail, we refuse to execute the plan. Otherwise a successful
  // execute could mutate the store with no record of what was done.
  let logId: number;
  try {
    const inserted = await db
      .insert(adminCopilotActionLogTable)
      .values({
        query,
        plan: plan as CopilotToolCall[],
        results: [],
        status: "running",
      })
      .returning({ id: adminCopilotActionLogTable.id });
    const id = inserted[0]?.id;
    if (typeof id !== "number") {
      throw new Error("audit log insert returned no id");
    }
    logId = id;
  } catch (err) {
    logger.error({ err }, "copilot.execute.log_insert_failed");
    res.status(500).json({
      error:
        "Could not record the action plan for auditing — refusing to execute.",
    });
    return;
  }

  const results: CopilotToolResult[] = [];
  let okCount = 0;
  let failCount = 0;
  for (const step of plan) {
    const r = await executeTool(step.name, step.params);
    results.push(r);
    if (r.ok) okCount += 1;
    else failCount += 1;
  }

  let status: CopilotPlanStatus = "success";
  if (failCount > 0 && okCount === 0) status = "failed";
  else if (failCount > 0) status = "partial";

  // Persist terminal state. Retry once before giving up; if it ultimately
  // fails, surface that to the client so they don't believe the audit trail
  // is intact when it isn't (the row is still stuck in "running").
  let logPersisted = false;
  for (let attempt = 0; attempt < 2 && !logPersisted; attempt += 1) {
    try {
      await db
        .update(adminCopilotActionLogTable)
        .set({
          results,
          status,
          completedAt: new Date(),
          errorMessage:
            failCount > 0
              ? results
                  .filter((r) => !r.ok)
                  .map((r) => `${r.name}: ${r.message ?? "failed"}`)
                  .join("; ")
                  .slice(0, 1000)
              : null,
        })
        .where(eq(adminCopilotActionLogTable.id, logId));
      logPersisted = true;
    } catch (err) {
      logger.error(
        { err, logId, attempt },
        "copilot.execute.log_update_failed",
      );
    }
  }

  // Mirror the executed plan into the unified activity feed so operators
  // see co-pilot agent runs alongside everything else without having to
  // open the dedicated co-pilot history view.
  const stepSummaries = planSummary(plan);
  await recordActivity({
    kind: "copilot_plan",
    actor: "copilot",
    title:
      query.trim().length > 0
        ? `Co-pilot ran: "${query.trim().slice(0, 100)}"`
        : `Co-pilot ran a ${plan.length}-step plan`,
    summary: stepSummaries.join(" · ").slice(0, 480),
    entityType: "copilot_plan",
    entityId: logId,
    payload: { status, stepCount: plan.length, results },
  });

  res.json({
    results,
    status,
    logId,
    summary: stepSummaries,
    auditPersisted: logPersisted,
  });
});

function planSummary(plan: z.infer<typeof ToolCallSchema>[]): string[] {
  return plan.map((s) => summarizeToolCall(s.name, s.params));
}

export default router;
