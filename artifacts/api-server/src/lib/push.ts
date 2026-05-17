import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "./db";
import { logger } from "./logger";

const VAPID_PUBLIC = process.env["VAPID_PUBLIC_KEY"] ?? "";
const VAPID_PRIVATE = process.env["VAPID_PRIVATE_KEY"] ?? "";
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] ?? "mailto:hello@drtea.shop";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
    return true;
  } catch (err) {
    logger.error({ err }, "VAPID setup failed");
    return false;
  }
}

export function isPushEnabled(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Broadcast a notification to all stored subscriptions. Subscriptions that
 * return 404/410 are pruned. Returns counts for caller reporting.
 */
export async function broadcastPush(payload: PushPayload): Promise<{ sent: number; failed: number; pruned: number }> {
  if (!configure()) return { sent: 0, failed: 0, pruned: 0 };
  const subs = await db.select().from(pushSubscriptionsTable);
  let sent = 0;
  let failed = 0;
  let pruned = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.authKey } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, s.endpoint));
          pruned += 1;
        } else {
          failed += 1;
          logger.warn({ err, endpoint: s.endpoint.slice(0, 50) }, "Push send failed");
        }
      }
    }),
  );
  return { sent, failed, pruned };
}
