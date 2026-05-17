import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq, isNull, and } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  marketingCampaignsTable,
  newsletterSubscribersTable,
  emailLogsTable,
  type EmailLogRow,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  AdminMarketingDraftBody as MarketingDraftBody,
  AdminCreateMarketingCampaignBody as MarketingCampaignBody,
  AdminSendMarketingCampaignBody as MarketingSendBody,
  NewsletterSubscribeBody as NewsletterSubscribeInput,
} from "@workspace/api-zod";
import { sendEmail, isEmailEnabled, generateTrackingToken } from "../lib/email";
import { renderNewsletter } from "../lib/email-templates";
import { chatCompletionJSON } from "../lib/openaiText";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PUBLIC_API_BASE =
  process.env["PUBLIC_API_BASE"] ?? `http://localhost:${process.env["PORT"] ?? "8080"}`;

// ── Public newsletter signup (storefront footer / popups) ────────────────
router.post("/newsletter/subscribe", async (req: Request, res: Response) => {
  const parsed = NewsletterSubscribeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const token = randomBytes(16).toString("hex");
  const [row] = await db
    .insert(newsletterSubscribersTable)
    .values({
      email: parsed.data.email,
      name: parsed.data.name ?? "",
      source: parsed.data.source ?? "storefront",
      unsubscribeToken: token,
    })
    .onConflictDoUpdate({
      target: newsletterSubscribersTable.email,
      set: { unsubscribedAt: null, name: parsed.data.name ?? "" },
    })
    .returning();
  res.status(201).json({ id: row.id, email: row.email });
});

// ── Admin: subscribers ────────────────────────────────────────────────────
router.use("/admin", requireAdmin);

router.get("/admin/newsletter/subscribers", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(newsletterSubscribersTable)
    .orderBy(desc(newsletterSubscribersTable.optedInAt));
  const active = rows.filter((r) => !r.unsubscribedAt).length;
  res.json({ total: rows.length, active, items: rows });
});

// ── Admin: campaigns ──────────────────────────────────────────────────────
router.get("/admin/marketing/campaigns", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(marketingCampaignsTable)
    .orderBy(desc(marketingCampaignsTable.createdAt));
  res.json(rows);
});

router.get("/admin/marketing/campaigns/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(marketingCampaignsTable)
    .where(eq(marketingCampaignsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const logs = await db
    .select()
    .from(emailLogsTable)
    .where(eq(emailLogsTable.campaignId, id))
    .orderBy(desc(emailLogsTable.createdAt))
    .limit(200);
  res.json({ ...row, logs });
});

router.post("/admin/marketing/campaigns", async (req: Request, res: Response) => {
  const parsed = MarketingCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .insert(marketingCampaignsTable)
    .values({ ...parsed.data, status: "draft" })
    .returning();
  res.status(201).json(row);
});

router.patch("/admin/marketing/campaigns/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = MarketingCampaignBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .update(marketingCampaignsTable)
    .set(parsed.data)
    .where(eq(marketingCampaignsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/admin/marketing/campaigns/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(marketingCampaignsTable).where(eq(marketingCampaignsTable.id, id));
  res.json({ ok: true });
});

interface DraftOutput {
  subject?: string;
  preheader?: string;
  body?: string;
  ctaLabel?: string;
}

router.post("/admin/marketing/draft", async (req: Request, res: Response) => {
  const parsed = MarketingDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const fallback = {
    subject: parsed.data.topic ? `${parsed.data.topic.slice(0, 60)}` : "A new note from Dr Tea",
    preheader: "Slow rituals. Small-batch blends. Letters from our tea garden.",
    body: parsed.data.notes
      ? parsed.data.notes
      : "Hi friend,\n\nWe wanted to share something brewing in the studio. Settle in with your favorite cup — this one's worth a slow read.",
    ctaLabel: parsed.data.ctaLabel ?? "Browse the new arrivals",
  };
  const out = await chatCompletionJSON<DraftOutput>({
    systemPrompt:
      "You write warm, literary marketing emails for Dr Tea, a small-batch tea brand. No medical claims. Voice: calm, sensory, generous. Avoid sales-y exclamations.",
    userPrompt: [
      `Topic: ${parsed.data.topic ?? "general newsletter"}`,
      parsed.data.notes ? `Author notes: ${parsed.data.notes}` : "",
      parsed.data.tone ? `Tone hint: ${parsed.data.tone}` : "",
      parsed.data.ctaLabel ? `CTA label hint: ${parsed.data.ctaLabel}` : "",
      "",
      "Return strict JSON: { subject: string, preheader: string, body: string, ctaLabel: string }.",
      "subject ≤ 60 chars. preheader ≤ 110 chars. body 120-260 words, plain text with paragraph breaks (double newlines). ctaLabel ≤ 28 chars.",
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 700,
  });
  res.json({
    subject: (out?.subject ?? fallback.subject).slice(0, 120),
    preheader: (out?.preheader ?? fallback.preheader).slice(0, 200),
    body: out?.body ?? fallback.body,
    ctaLabel: (out?.ctaLabel ?? fallback.ctaLabel).slice(0, 60),
  });
});

router.post("/admin/marketing/campaigns/:id/send", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = MarketingSendBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [campaign] = await db
    .select()
    .from(marketingCampaignsTable)
    .where(eq(marketingCampaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (campaign.status === "sending" || campaign.status === "sent") {
    res.status(409).json({ error: `Campaign already ${campaign.status}` });
    return;
  }

  // Resolve recipients: active subscribers (and optional `testEmail` only).
  let recipients: Array<{ email: string; unsubscribeToken: string }>;
  if (parsed.data.testEmail) {
    recipients = [{ email: parsed.data.testEmail, unsubscribeToken: "test" }];
  } else {
    const subs = await db
      .select({ email: newsletterSubscribersTable.email, unsubscribeToken: newsletterSubscribersTable.unsubscribeToken })
      .from(newsletterSubscribersTable)
      .where(isNull(newsletterSubscribersTable.unsubscribedAt));
    recipients = subs;
  }

  if (!recipients.length) {
    res.status(400).json({ error: "No active subscribers" });
    return;
  }

  // For non-test sends, mark as sending and run async; respond immediately.
  const isTest = Boolean(parsed.data.testEmail);
  if (!isTest) {
    await db
      .update(marketingCampaignsTable)
      .set({ status: "sending", recipientsCount: recipients.length, sentCount: 0 })
      .where(eq(marketingCampaignsTable.id, id));
  }

  const dispatch = async () => {
    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      try {
        // Reserve the tracking token *before* rendering so the embedded
        // open-pixel + every tracked CTA link match the per-recipient row.
        const trackingToken = generateTrackingToken();
        const tpl = renderNewsletter({
          subject: campaign.subject,
          preheader: campaign.preheader,
          body: campaign.body,
          ctaLabel: campaign.ctaLabel,
          ctaUrl: campaign.ctaUrl,
          trackingToken,
          unsubscribeUrl: `${PUBLIC_API_BASE}/api/email/unsubscribe?t=${r.unsubscribeToken}`,
        });
        const result = await sendEmail({
          to: r.email,
          subject: tpl.subject,
          html: tpl.html,
          kind: isTest ? "broadcast" : "newsletter",
          campaignId: isTest ? null : id,
          trackingToken,
        });
        if (result.status === "sent" || result.status === "skipped") sent += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        logger.error({ err }, "Newsletter send failed for recipient");
      }
    }
    if (!isTest) {
      await db
        .update(marketingCampaignsTable)
        .set({
          status: failed === recipients.length ? "failed" : "sent",
          sentCount: sent,
          sentAt: new Date(),
          errorMessage: failed > 0 ? `${failed} recipients failed` : null,
        })
        .where(eq(marketingCampaignsTable.id, id));
    }
    return { sent, failed };
  };

  if (isTest) {
    const r = await dispatch();
    res.json({ status: "test_sent", emailEnabled: isEmailEnabled(), ...r });
    return;
  }

  // Async fire-and-forget for the bulk send.
  void dispatch().catch((err) => logger.error({ err, campaignId: id }, "Campaign dispatch failed"));
  res.json({ status: "sending", recipients: recipients.length, emailEnabled: isEmailEnabled() });
});

router.get("/admin/marketing/email-logs", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const rows: EmailLogRow[] = await db
    .select()
    .from(emailLogsTable)
    .orderBy(desc(emailLogsTable.createdAt))
    .limit(limit);
  // Strip the (potentially huge) HTML body from the list view.
  res.json(
    rows.map((r) => ({
      id: r.id,
      toAddress: r.toAddress,
      kind: r.kind,
      subject: r.subject,
      status: r.status,
      campaignId: r.campaignId,
      orderId: r.orderId,
      openedAt: r.openedAt,
      clickedAt: r.clickedAt,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    })),
  );
});

router.get("/admin/marketing/abandoned-carts", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from((await import("../lib/db")).abandonedCartsTable)
    .orderBy(desc((await import("../lib/db")).abandonedCartsTable.createdAt))
    .limit(100);
  const open = rows.filter((r) => !r.recoveredAt).length;
  const recovered = rows.filter((r) => r.recoveredAt).length;
  const emailed = rows.filter((r) => r.emailSentAt).length;
  res.json({ total: rows.length, open, recovered, emailed, items: rows });
});

router.get("/admin/marketing/status", async (_req: Request, res: Response) => {
  res.json({
    emailEnabled: isEmailEnabled(),
    fromAddress: process.env["EMAIL_FROM"] ?? null,
    needsResendApiKey: !process.env["RESEND_API_KEY"],
    needsEmailFrom: !process.env["EMAIL_FROM"],
  });
});

export default router;
