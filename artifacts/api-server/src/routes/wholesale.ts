import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, wholesaleLeadsTable, wholesaleAccountsTable } from "../lib/db";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/admin-auth";

const router: IRouter = Router();

// In-process token bucket per IP/email. Sufficient for a single API instance;
// switch to a shared store if/when we scale horizontally.
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 5 * 60 * 1000).unref?.();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

// Admin endpoints below require a valid signed admin cookie. Mounting at
// the path prefix protects every method (GET/PATCH/...) on that subtree
// without relying on the broad `/admin` middleware in admin-marketing.
router.use("/admin/wholesale", requireAdmin);

const InquireBody = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(20),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional().default(""),
  segment: z.enum(["cafe", "hotel", "office", "gifting", "retailer", "other"]),
  monthlyVolume: z.enum([
    "under-25kg",
    "25-100kg",
    "100-500kg",
    "500kg-plus",
  ]),
  interestedIn: z.array(z.string().trim().max(80)).max(20).optional().default([]),
  message: z.string().trim().max(2000).optional().default(""),
});

router.post("/wholesale/inquire", async (req: Request, res: Response) => {
  const parsed = InquireBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  const ip = clientIp(req);
  const emailKey = data.email.toLowerCase();
  // 5 enquiries / hour per email and 20 / hour per IP.
  if (
    !rateLimit(`wholesale:email:${emailKey}`, 5, 60 * 60 * 1000) ||
    !rateLimit(`wholesale:ip:${ip}`, 20, 60 * 60 * 1000)
  ) {
    res.status(429).json({ error: "Too many enquiries. Please try again later." });
    return;
  }
  try {
    const [row] = await db
      .insert(wholesaleLeadsTable)
      .values({
        ...data,
        ipAddress: ip.slice(0, 64),
        userAgent: (req.get("user-agent") ?? "").slice(0, 400),
      })
      .returning({ id: wholesaleLeadsTable.id });
    res.status(201).json({ ok: true, id: row?.id });
  } catch (err) {
    logger.error({ err }, "wholesale.inquire.failed");
    res.status(500).json({ error: "Could not record enquiry" });
  }
});

router.get("/admin/wholesale/leads", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(wholesaleLeadsTable)
      .orderBy(desc(wholesaleLeadsTable.createdAt))
      .limit(500);
    res.json({ leads: rows });
  } catch (err) {
    logger.error({ err }, "wholesale.list.failed");
    res.status(500).json({ error: "Could not list leads" });
  }
});

router.patch("/admin/wholesale/leads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const StatusBody = z.object({
    status: z.enum(["new", "contacted", "quoted", "won", "lost"]),
  });
  const parsed = StatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  try {
    const result = await db
      .update(wholesaleLeadsTable)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(wholesaleLeadsTable.id, id))
      .returning({ id: wholesaleLeadsTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "wholesale.update.failed");
    res.status(500).json({ error: "Could not update lead" });
  }
});

// ─── Accounts (approved B2B) ──────────────────────────────────────────────

router.get("/admin/wholesale/accounts", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(wholesaleAccountsTable)
      .orderBy(desc(wholesaleAccountsTable.createdAt));
    res.json({ items });
  } catch (err) {
    logger.error({ err }, "wholesale.accounts.list.failed");
    res.status(500).json({ error: "Could not list accounts" });
  }
});

const AccountBody = z.object({
  leadId: z.number().int().positive().optional().nullable(),
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(20),
  gstin: z.string().trim().max(20).optional().nullable(),
  billingAddress: z
    .object({
      line1: z.string().trim().min(2).max(200),
      line2: z.string().trim().max(200).optional(),
      city: z.string().trim().min(2).max(80),
      state: z.string().trim().max(80).optional(),
      postalCode: z.string().trim().min(3).max(12),
      country: z.string().trim().max(80),
    })
    .optional()
    .nullable(),
  tier: z.enum(["bronze", "silver", "gold", "platinum"]).default("bronze"),
  discountPct: z.number().int().min(0).max(80).default(15),
  paymentTerms: z
    .enum(["prepaid", "net15", "net30", "net45"])
    .default("prepaid"),
  creditLimitPaise: z.number().int().min(0).max(100_000_000).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
});

router.post("/admin/wholesale/accounts", async (req, res) => {
  const parsed = AccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  try {
    const [row] = await db
      .insert(wholesaleAccountsTable)
      .values({
        ...parsed.data,
        gstin: parsed.data.gstin ?? null,
        notes: parsed.data.notes ?? null,
        billingAddress: parsed.data.billingAddress ?? null,
      })
      .returning();
    // If this account was promoted from a lead, mark the lead as won so it
    // disappears from the active pipeline view.
    if (parsed.data.leadId) {
      await db
        .update(wholesaleLeadsTable)
        .set({ status: "won", updatedAt: new Date() })
        .where(eq(wholesaleLeadsTable.id, parsed.data.leadId));
    }
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "wholesale.accounts.create.failed");
    res.status(500).json({ error: "Could not create account (email already used?)" });
  }
});

router.patch("/admin/wholesale/accounts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AccountBody.partial()
    .extend({
      status: z.enum(["active", "suspended", "closed"]).optional(),
      outstandingPaise: z.number().int().min(0).max(100_000_000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of [
      "companyName",
      "contactName",
      "email",
      "phone",
      "gstin",
      "billingAddress",
      "tier",
      "discountPct",
      "paymentTerms",
      "creditLimitPaise",
      "outstandingPaise",
      "status",
      "notes",
    ] as const) {
      if (parsed.data[k as keyof typeof parsed.data] !== undefined) {
        patch[k] = parsed.data[k as keyof typeof parsed.data];
      }
    }
    const [row] = await db
      .update(wholesaleAccountsTable)
      .set(patch)
      .where(eq(wholesaleAccountsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "wholesale.accounts.update.failed");
    res.status(500).json({ error: "Could not update account" });
  }
});

router.delete("/admin/wholesale/accounts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db
      .delete(wholesaleAccountsTable)
      .where(eq(wholesaleAccountsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "wholesale.accounts.delete.failed");
    res.status(500).json({ error: "Could not delete account" });
  }
});

export default router;
