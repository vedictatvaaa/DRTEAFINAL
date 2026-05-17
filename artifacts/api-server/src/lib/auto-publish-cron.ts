import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db, contentDraftsTable, articlesTable } from "./db";
import { promoteBlogDraftToArticle } from "./promote-blog-draft";
import { postTweet, isXConfigured } from "./x-client";
import { postBlueskyPost, isBlueskyConfigured } from "./bluesky-client";
import { postThreadsPost, isThreadsConfigured } from "./threads-client";
import { canPostNow } from "../routes/admin-social";
import type { SocialChannel } from "./social-config";
import { logger } from "./logger";

/**
 * Auto-publish cron — finds approved drafts whose scheduled time has passed
 * and "publishes" them.
 *
 * - Blog: if not yet promoted, runs the promote-to-article flow with
 *   `published=true`. If already promoted, flips the existing article's
 *   `published` flag on. Either way, the draft's status moves to 'posted'.
 * - Social: there is no automated publishing path to Instagram/X/LinkedIn,
 *   so "publish" simply flips status='posted' and stamps postedAt. This
 *   gives the operator a clean audit trail of what was queued vs. sent.
 *
 * Returns the number of drafts successfully published this tick.
 */
export async function publishDueDrafts(now: Date = new Date()): Promise<{
  published: number;
  failed: number;
}> {
  const due = await db
    .select()
    .from(contentDraftsTable)
    .where(
      and(
        eq(contentDraftsTable.status, "approved"),
        isNotNull(contentDraftsTable.scheduledAt),
        lte(contentDraftsTable.scheduledAt, now),
      ),
    );
  let published = 0;
  let failed = 0;
  for (const draft of due) {
    try {
      // ── Social drafts on X / Bluesky / Threads: call the network API. ──
      if (
        draft.kind === "social" &&
        (draft.channel === "x" || draft.channel === "bluesky" || draft.channel === "threads")
      ) {
        const channel = draft.channel as SocialChannel;
        const configured =
          channel === "x"
            ? await isXConfigured()
            : channel === "bluesky"
              ? await isBlueskyConfigured()
              : await isThreadsConfigured();
        if (!configured) {
          // No creds → silently leave queued (don't churn drafts while operator sets up).
          continue;
        }
        const gate = await canPostNow(now, channel);
        if (!gate.ok) {
          // Daily cap or quiet hours — leave it for the next tick.
          continue;
        }
        // Atomic claim: flip 'approved' → 'posting' so a concurrent post-now
        // (or another worker) can't grab this same draft and double-post.
        // If the row already moved on (e.g. operator hit "Post now" between
        // SELECT and here), the WHERE fails and we skip.
        const [claimed] = await db
          .update(contentDraftsTable)
          .set({ status: "posting", updatedAt: new Date() })
          .where(
            and(
              eq(contentDraftsTable.id, draft.id),
              eq(contentDraftsTable.status, "approved"),
            ),
          )
          .returning({ id: contentDraftsTable.id });
        if (!claimed) continue;

        const r =
          channel === "x"
            ? await postTweet({ text: draft.body })
            : channel === "bluesky"
              ? await postBlueskyPost({ text: draft.body })
              : await postThreadsPost({ text: draft.body });
        if (!r.ok) {
          failed++;
          logger.warn(
            { draftId: draft.id, channel, err: r.error, rateLimited: r.rateLimited },
            "Social post failed",
          );
          // Release the lease. Rate-limit: revert to 'approved' so next tick
          // retries. Other errors: revert to 'approved' AND blank scheduledAt
          // so the publisher stops retrying until operator reschedules.
          await db
            .update(contentDraftsTable)
            .set({
              status: "approved",
              ...(r.rateLimited ? {} : { scheduledAt: null }),
              updatedAt: new Date(),
            })
            .where(eq(contentDraftsTable.id, draft.id));
          continue;
        }
        const meta: Record<string, unknown> = { url: r.url };
        if (channel === "x" && "tweetId" in r) meta["tweetId"] = r.tweetId;
        if (channel === "bluesky" && "uri" in r) meta["uri"] = r.uri;
        if (channel === "threads" && "threadId" in r) meta["threadId"] = r.threadId;
        await db
          .update(contentDraftsTable)
          .set({
            status: "posted",
            postedAt: now,
            jsonLd: meta,
            updatedAt: new Date(),
          })
          .where(eq(contentDraftsTable.id, draft.id));
        published++;
        continue;
      }

      if (draft.kind === "blog") {
        // Re-fetch right before mutating in case a manual "Promote" click
        // landed between this tick's SELECT and now (closes the manual-vs-cron
        // race that would otherwise create two articles).
        const [fresh] = await db
          .select()
          .from(contentDraftsTable)
          .where(eq(contentDraftsTable.id, draft.id))
          .limit(1);
        if (!fresh || fresh.status === "posted") continue;
        if (fresh.promotedArticleId) {
          await db
            .update(articlesTable)
            .set({ published: true, updatedAt: new Date() })
            .where(eq(articlesTable.id, fresh.promotedArticleId));
        } else {
          await promoteBlogDraftToArticle(fresh, { publish: true });
        }
      }
      if (draft.kind === "blog") {
        // Blog branch flips to 'posted' below; we keep that path scoped here
        // so non-X social drafts don't get silently marked posted just because
        // there's no automated publisher for their channel yet.
        await db
          .update(contentDraftsTable)
          .set({ status: "posted", postedAt: now, updatedAt: new Date() })
          .where(eq(contentDraftsTable.id, draft.id));
        published++;
      } else {
        // Other social channels (instagram/linkedin/etc) — leave queued.
        // Operator can either flip to "posted" manually or wait for a future
        // channel-specific publisher to be wired up.
      }
    } catch (err) {
      failed++;
      logger.error({ err, draftId: draft.id }, "Auto-publish failed for draft");
    }
  }
  return { published, failed };
}

const MINUTE_MS = 60 * 1000;

export function startAutoPublishCron(): void {
  // Guard against overlapping ticks: if a previous run is still in flight
  // (e.g. a slow batch of promotions), skip this tick. Without this, a
  // long-running tick could overlap with the next interval and pick up the
  // same drafts twice → duplicate articles.
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await publishDueDrafts();
      if (r.published || r.failed) {
        logger.info(r, "Auto-publish cron tick");
      }
    } catch (err) {
      logger.error({ err }, "Auto-publish cron failed");
    } finally {
      running = false;
    }
  };
  // Every 5 minutes. First run after 30s so we don't pile onto startup.
  setInterval(tick, 5 * MINUTE_MS).unref();
  setTimeout(() => void tick(), 30 * 1000).unref();
  logger.info("Auto-publish cron started (5m interval)");
}
