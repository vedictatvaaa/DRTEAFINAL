import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  conversationsTable,
  conversationMessagesTable,
  adminUsersTable,
  type ConversationStatus,
  type ConversationPriority,
  type ConversationChannel,
} from "../lib/db";
import { logger } from "../lib/logger";
import { requireAdmin, getCurrentAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";

const router: IRouter = Router();

// ─── Public: contact form ─────────────────────────────────────────────────

// Mirror the wholesale rate limiter shape for symmetry, though spam here is
// usually less severe — 10 contacts/hr per email.
const contactBuckets = new Map<string, { c: number; r: number }>();
function rl(key: string, max: number, win: number): boolean {
  const now = Date.now();
  const b = contactBuckets.get(key);
  if (!b || b.r < now) {
    contactBuckets.set(key, { c: 1, r: now + win });
    return true;
  }
  if (b.c >= max) return false;
  b.c += 1;
  return true;
}

const ContactBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(2).max(5000),
  orderId: z.number().int().positive().optional(),
  channel: z
    .enum(["web", "email", "whatsapp", "instagram"])
    .optional()
    .default("web"),
});

router.post("/support/contact", async (req: Request, res: Response) => {
  const parsed = ContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const { name, email, subject, message, orderId, channel } = parsed.data;
  if (!rl(`contact:${email.toLowerCase()}`, 10, 60 * 60 * 1000)) {
    res.status(429).json({ error: "Too many messages. Try later." });
    return;
  }
  try {
    const now = new Date();
    const preview = message.slice(0, 200);
    const [convo] = await db
      .insert(conversationsTable)
      .values({
        contactName: name,
        contactEmail: email,
        subject,
        channel: channel as ConversationChannel,
        orderId: orderId ?? null,
        lastMessageAt: now,
        lastMessagePreview: preview,
      })
      .returning({ id: conversationsTable.id });
    if (!convo) throw new Error("Failed to create conversation");
    await db.insert(conversationMessagesTable).values({
      conversationId: convo.id,
      sender: "customer",
      senderName: name,
      body: message,
    });
    res.status(201).json({ ok: true, conversationId: convo.id });
  } catch (err) {
    logger.error({ err }, "support.contact.failed");
    res.status(500).json({ error: "Could not send message" });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────

router.use("/admin/messages", requireAdmin);

router.get("/admin/messages/overview", async (_req, res) => {
  try {
    const rows = await db
      .select({
        status: conversationsTable.status,
        unreadByAdmin: conversationsTable.unreadByAdmin,
      })
      .from(conversationsTable);
    const counts = { open: 0, pending: 0, resolved: 0, spam: 0 };
    let unread = 0;
    for (const r of rows) {
      counts[r.status as ConversationStatus] += 1;
      if (r.unreadByAdmin && r.status !== "spam") unread += 1;
    }
    res.json({ counts, unread, total: rows.length });
  } catch (err) {
    logger.error({ err }, "messages.overview.failed");
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/admin/messages", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const where =
      status && ["open", "pending", "resolved", "spam"].includes(status)
        ? eq(conversationsTable.status, status as ConversationStatus)
        : undefined;
    const items = await db
      .select({
        id: conversationsTable.id,
        contactName: conversationsTable.contactName,
        contactEmail: conversationsTable.contactEmail,
        subject: conversationsTable.subject,
        channel: conversationsTable.channel,
        status: conversationsTable.status,
        priority: conversationsTable.priority,
        assignedAdminId: conversationsTable.assignedAdminId,
        assignedAdminName: adminUsersTable.name,
        orderId: conversationsTable.orderId,
        unreadByAdmin: conversationsTable.unreadByAdmin,
        lastMessageAt: conversationsTable.lastMessageAt,
        lastMessagePreview: conversationsTable.lastMessagePreview,
        createdAt: conversationsTable.createdAt,
      })
      .from(conversationsTable)
      .leftJoin(
        adminUsersTable,
        eq(adminUsersTable.id, conversationsTable.assignedAdminId),
      )
      .where(where as ReturnType<typeof eq>)
      .orderBy(desc(conversationsTable.lastMessageAt))
      .limit(300);
    res.json({ items });
  } catch (err) {
    logger.error({ err }, "messages.list.failed");
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/admin/messages/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [convo] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .limit(1);
    if (!convo) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const messages = await db
      .select()
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, id))
      .orderBy(conversationMessagesTable.createdAt);
    // Mark read on view (admin opened it).
    if (convo.unreadByAdmin) {
      await db
        .update(conversationsTable)
        .set({ unreadByAdmin: false, updatedAt: new Date() })
        .where(eq(conversationsTable.id, id));
    }
    res.json({ conversation: convo, messages });
  } catch (err) {
    logger.error({ err }, "messages.get.failed");
    res.status(500).json({ error: "Failed" });
  }
});

const ReplyBody = z.object({
  body: z.string().trim().min(1).max(10000),
  isInternal: z.boolean().optional().default(false),
});

router.post("/admin/messages/:id/reply", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = ReplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const admin = await getCurrentAdmin(req);
  if (!admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const now = new Date();
    await db.insert(conversationMessagesTable).values({
      conversationId: id,
      sender: "admin",
      senderName: admin.name || admin.email,
      adminUserId: admin.id,
      body: parsed.data.body,
      isInternal: parsed.data.isInternal,
    });
    // Internal notes don't bump the customer-facing preview/status;
    // only public replies do.
    const patch: Record<string, unknown> = { updatedAt: now };
    if (!parsed.data.isInternal) {
      patch.lastMessageAt = now;
      patch.lastMessagePreview = parsed.data.body.slice(0, 200);
      // Awaiting customer reply now.
      patch.status = "pending";
    }
    await db
      .update(conversationsTable)
      .set(patch)
      .where(eq(conversationsTable.id, id));
    await recordActivity({
      kind: "conversation_replied",
      actor: "admin",
      title: `Replied to conversation #${id}`,
      summary: parsed.data.body.slice(0, 200),
      entityType: "conversation",
      entityId: id,
      payload: { internal: parsed.data.isInternal, by: admin.email },
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "messages.reply.failed");
    res.status(500).json({ error: "Failed" });
  }
});

const PatchBody = z.object({
  status: z.enum(["open", "pending", "resolved", "spam"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedAdminId: z.number().int().positive().nullable().optional(),
});

router.patch("/admin/messages/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const admin = await getCurrentAdmin(req);
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.priority !== undefined)
      patch.priority = parsed.data.priority;
    if (parsed.data.assignedAdminId !== undefined)
      patch.assignedAdminId = parsed.data.assignedAdminId;
    await db
      .update(conversationsTable)
      .set(patch)
      .where(eq(conversationsTable.id, id));
    if (parsed.data.status && admin) {
      await recordActivity({
        kind: "conversation_status_changed",
        actor: "admin",
        title: `Conversation #${id} → ${parsed.data.status}`,
        entityType: "conversation",
        entityId: id,
        payload: { status: parsed.data.status, by: admin.email },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "messages.patch.failed");
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/admin/messages/:id/mark-unread", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .update(conversationsTable)
    .set({ unreadByAdmin: true, updatedAt: new Date() })
    .where(eq(conversationsTable.id, id));
  res.json({ ok: true });
});

// Avoid an unused-import lint error for `and`/`sql` until needed.
void and;
void sql;

export default router;
