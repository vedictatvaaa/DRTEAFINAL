import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db, emailLogsTable, marketingCampaignsTable, newsletterSubscribersTable } from "../lib/db";

const router: IRouter = Router();

const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

router.get("/email/track/open", async (req: Request, res: Response) => {
  const t = String(req.query.t ?? "");
  if (t) {
    try {
      const [row] = await db
        .update(emailLogsTable)
        .set({ openedAt: new Date() })
        .where(and(eq(emailLogsTable.trackingToken, t), isNull(emailLogsTable.openedAt)))
        .returning();
      if (row?.campaignId) {
        await db
          .update(marketingCampaignsTable)
          .set({ openCount: sql`${marketingCampaignsTable.openCount} + 1` })
          .where(eq(marketingCampaignsTable.id, row.campaignId));
      }
    } catch {
      // ignore — tracking is best-effort
    }
  }
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).send(TRANSPARENT_PIXEL);
});

router.get("/email/track/click", async (req: Request, res: Response) => {
  const t = String(req.query.t ?? "");
  const u = String(req.query.u ?? "");
  if (t) {
    try {
      const [row] = await db
        .update(emailLogsTable)
        .set({ clickedAt: new Date() })
        .where(eq(emailLogsTable.trackingToken, t))
        .returning();
      if (row?.campaignId) {
        await db
          .update(marketingCampaignsTable)
          .set({ clickCount: sql`${marketingCampaignsTable.clickCount} + 1` })
          .where(eq(marketingCampaignsTable.id, row.campaignId));
      }
    } catch {
      // ignore
    }
  }
  res.redirect(302, safeRedirectTarget(u));
});

const STORE_BASE = process.env["PUBLIC_STORE_BASE"] ?? "https://dr-tea.example.com";
const ALLOWED_HOSTS = new Set<string>();
try {
  ALLOWED_HOSTS.add(new URL(STORE_BASE).host);
} catch {
  // ignore malformed env
}
if (process.env["REPLIT_DEV_DOMAIN"]) ALLOWED_HOSTS.add(process.env["REPLIT_DEV_DOMAIN"]);
if (process.env["REPLIT_DOMAINS"]) {
  for (const d of process.env["REPLIT_DOMAINS"].split(",")) {
    const t = d.trim();
    if (t) ALLOWED_HOSTS.add(t);
  }
}

function safeRedirectTarget(raw: string): string {
  if (!raw) return STORE_BASE;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return STORE_BASE;
    if (!ALLOWED_HOSTS.has(parsed.host)) return STORE_BASE;
    return parsed.toString();
  } catch {
    return STORE_BASE;
  }
}

router.get("/email/unsubscribe", async (req: Request, res: Response) => {
  const t = String(req.query.t ?? "");
  if (t) {
    await db
      .update(newsletterSubscribersTable)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribersTable.unsubscribeToken, t));
  }
  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:Georgia,serif;background:#f6f3ee;color:#1d1a16;padding:48px;text-align:center;">
<h1>You're unsubscribed.</h1>
<p>You won't receive marketing emails from Dr Tea. You'll still get receipts for any orders you place.</p>
</body></html>`,
    );
});

export default router;
