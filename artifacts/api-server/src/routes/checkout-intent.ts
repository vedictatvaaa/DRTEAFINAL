import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, abandonedCartsTable } from "../lib/db";
import { CheckoutIntentBody } from "@workspace/api-zod";

const router: IRouter = Router();

function newResumeToken(): string {
  return randomBytes(18).toString("hex");
}

router.post("/checkout/intent", async (req: Request, res: Response) => {
  const parsed = CheckoutIntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { sessionId, email, customerName, items, currency } = parsed.data;
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

  // Upsert by (sessionId,email) — keep the latest snapshot. We dedupe so a
  // single shopper doesn't get spammed across many half-typed checkouts.
  const [existing] = await db
    .select()
    .from(abandonedCartsTable)
    .where(
      and(
        eq(abandonedCartsTable.sessionId, sessionId),
        eq(abandonedCartsTable.email, email),
        isNull(abandonedCartsTable.recoveredAt),
      ),
    )
    .orderBy(desc(abandonedCartsTable.createdAt))
    .limit(1);

  if (existing) {
    await db
      .update(abandonedCartsTable)
      .set({
        customerName: customerName ?? existing.customerName,
        items,
        subtotal,
        currency,
        lastSeenAt: new Date(),
        // Cart contents changed — clear the recovery-sent marker so the cron
        // can email again about the new state. Mint a token if missing
        // (back-fills rows created before the column existed).
        emailSentAt: null,
        resumeToken: existing.resumeToken || newResumeToken(),
      })
      .where(eq(abandonedCartsTable.id, existing.id));
    res.json({ id: existing.id, status: "updated" });
    return;
  }

  const [row] = await db
    .insert(abandonedCartsTable)
    .values({
      sessionId,
      email,
      customerName: customerName ?? "",
      items,
      subtotal,
      currency,
      resumeToken: newResumeToken(),
    })
    .returning();
  res.status(201).json({ id: row.id, status: "created" });
});

router.get("/checkout/intent/restore", async (req: Request, res: Response) => {
  const token = String(req.query["t"] ?? "");
  if (!token || token.length < 16) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  const [row] = await db
    .select({
      id: abandonedCartsTable.id,
      items: abandonedCartsTable.items,
      currency: abandonedCartsTable.currency,
      customerName: abandonedCartsTable.customerName,
      email: abandonedCartsTable.email,
      recoveredAt: abandonedCartsTable.recoveredAt,
    })
    .from(abandonedCartsTable)
    .where(eq(abandonedCartsTable.resumeToken, token))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Cart not found" });
    return;
  }
  res.json({
    id: row.id,
    items: row.items,
    currency: row.currency,
    customerName: row.customerName,
    email: row.email,
    recovered: Boolean(row.recoveredAt),
  });
});

export default router;
