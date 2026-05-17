import { randomBytes } from "node:crypto";
import { and, isNull, lt, gt, sql } from "drizzle-orm";
import { db, abandonedCartsTable } from "./db";
import { sendEmail } from "./email";
import { renderAbandonedCart } from "./email-templates";
import { logger } from "./logger";

const FIVE_MIN = 5 * 60 * 1000;
const RECOVERY_DELAY_MS = 60 * 60 * 1000; // wait 1h since last activity
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // give up after 7 days

let timer: NodeJS.Timeout | null = null;
let inflight = false;

export async function processAbandonedCarts(): Promise<{ sent: number }> {
  if (inflight) return { sent: 0 };
  inflight = true;
  try {
    const now = Date.now();
    const cutoff = new Date(now - RECOVERY_DELAY_MS);
    const tooOld = new Date(now - STALE_AFTER_MS);
    const candidates = await db
      .select()
      .from(abandonedCartsTable)
      .where(
        and(
          isNull(abandonedCartsTable.recoveredAt),
          isNull(abandonedCartsTable.emailSentAt),
          lt(abandonedCartsTable.lastSeenAt, cutoff),
          gt(abandonedCartsTable.lastSeenAt, tooOld),
        ),
      );
    let sent = 0;
    for (const cart of candidates) {
      if (!cart.email || !cart.items.length) continue;
      // Back-fill a resume token if this row predates the column.
      const resumeToken = cart.resumeToken || randomBytes(18).toString("hex");
      if (!cart.resumeToken) {
        await db
          .update(abandonedCartsTable)
          .set({ resumeToken })
          .where(sql`${abandonedCartsTable.id} = ${cart.id}`);
      }
      const { subject, html } = renderAbandonedCart({ ...cart, resumeToken }, resumeToken);
      await sendEmail({ to: cart.email, subject, html, kind: "abandoned_cart" });
      await db
        .update(abandonedCartsTable)
        .set({ emailSentAt: new Date() })
        .where(sql`${abandonedCartsTable.id} = ${cart.id}`);
      sent += 1;
    }
    if (sent > 0) logger.info({ sent }, "Abandoned-cart recovery emails dispatched");
    return { sent };
  } finally {
    inflight = false;
  }
}

export function startAbandonedCartCron(): void {
  if (timer) return;
  // First run after 30s, then every 5 minutes.
  setTimeout(() => {
    void processAbandonedCarts().catch((err) => logger.error({ err }, "Abandoned cart cron failed"));
  }, 30_000);
  timer = setInterval(() => {
    void processAbandonedCarts().catch((err) => logger.error({ err }, "Abandoned cart cron failed"));
  }, FIVE_MIN);
}
