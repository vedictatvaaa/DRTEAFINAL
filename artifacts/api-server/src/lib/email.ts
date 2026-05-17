import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, emailLogsTable, type EmailKind, type EmailStatus } from "./db";
import { logger } from "./logger";

const RESEND_API_KEY = process.env["RESEND_API_KEY"] ?? "";
const EMAIL_FROM = process.env["EMAIL_FROM"] ?? "Dr Tea <onboarding@resend.dev>";
const PUBLIC_API_BASE =
  process.env["PUBLIC_API_BASE"] ?? `http://localhost:${process.env["PORT"] ?? "8080"}`;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  kind: EmailKind;
  campaignId?: number | null;
  orderId?: number | null;
  /**
   * Optional pre-generated tracking token. When provided, the caller is
   * expected to have rendered the HTML body using this exact token so that
   * embedded tracked links + the open pixel both resolve to the same row.
   */
  trackingToken?: string;
}

export function generateTrackingToken(): string {
  return newToken();
}

export interface SendEmailResult {
  id: number;
  status: EmailStatus;
  providerMessageId: string | null;
  trackingToken: string;
}

function newToken(): string {
  return randomBytes(16).toString("hex");
}

export function isEmailEnabled(): boolean {
  return Boolean(RESEND_API_KEY);
}

/**
 * Wrap an HTML template with a tracking pixel + click-tracking redirect.
 * Email links must be passed through `${trackingBase}/click?t=...&u=...`.
 */
export function decorateHtml(html: string, trackingToken: string): string {
  const pixel = `<img src="${PUBLIC_API_BASE}/api/email/track/open?t=${trackingToken}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;" />`;
  return html.includes("</body>")
    ? html.replace("</body>", `${pixel}</body>`)
    : `${html}${pixel}`;
}

export function trackedLink(token: string, url: string): string {
  const u = encodeURIComponent(url);
  return `${PUBLIC_API_BASE}/api/email/track/click?t=${token}&u=${u}`;
}

/**
 * Persist + send a single email via Resend HTTP API. If RESEND_API_KEY is
 * missing the email is recorded as `queued` so the admin can see what would
 * have been sent — the rest of the pipeline still runs end-to-end.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const trackingToken = input.trackingToken ?? newToken();
  const decoratedHtml = decorateHtml(input.html, trackingToken);
  const [row] = await db
    .insert(emailLogsTable)
    .values({
      toAddress: input.to,
      kind: input.kind,
      subject: input.subject,
      body: decoratedHtml,
      campaignId: input.campaignId ?? null,
      orderId: input.orderId ?? null,
      trackingToken,
      status: RESEND_API_KEY ? "queued" : "skipped",
    })
    .returning();

  if (!RESEND_API_KEY) {
    logger.info({ to: input.to, kind: input.kind, id: row.id }, "Email logged (RESEND_API_KEY not set)");
    return { id: row.id, status: "skipped", providerMessageId: null, trackingToken };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: decoratedHtml,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const errMsg = `Resend ${res.status}: ${text.slice(0, 500)}`;
      await db
        .update(emailLogsTable)
        .set({ status: "failed", errorMessage: errMsg })
        .where(eq(emailLogsTable.id, row.id));
      logger.error({ id: row.id, status: res.status }, "Email send failed");
      return { id: row.id, status: "failed", providerMessageId: null, trackingToken };
    }
    const json = (await res.json()) as { id?: string };
    await db
      .update(emailLogsTable)
      .set({ status: "sent", providerMessageId: json.id ?? null })
      .where(eq(emailLogsTable.id, row.id));
    return { id: row.id, status: "sent", providerMessageId: json.id ?? null, trackingToken };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(emailLogsTable)
      .set({ status: "failed", errorMessage: msg })
      .where(eq(emailLogsTable.id, row.id));
    logger.error({ err, id: row.id }, "Email send threw");
    return { id: row.id, status: "failed", providerMessageId: null, trackingToken };
  }
}
