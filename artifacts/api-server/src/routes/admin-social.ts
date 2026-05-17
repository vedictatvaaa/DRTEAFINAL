import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, contentDraftsTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  getSocialConfig,
  setSocialConfig,
  ALL_SOCIAL_CHANNELS,
  type SocialChannel,
} from "../lib/social-config";
import { generateOneTweet } from "../lib/social-tweet-cron";
import { postTweet, verifyXCredentials, isXConfigured } from "../lib/x-client";
import { postBlueskyPost, isBlueskyConfigured } from "../lib/bluesky-client";
import { postThreadsPost, isThreadsConfigured } from "../lib/threads-client";

const router: IRouter = Router();
router.use("/admin/social", requireAdmin);

async function networksStatus() {
  const [x, bluesky, threads] = await Promise.all([
    isXConfigured(),
    isBlueskyConfigured(),
    isThreadsConfigured(),
  ]);
  return { x, bluesky, threads };
}

router.get("/admin/social/config", async (_req: Request, res: Response) => {
  res.json({
    config: await getSocialConfig(),
    networks: await networksStatus(),
    // Back-compat for any older clients still reading xConfigured.
    xConfigured: (await networksStatus()).x,
  });
});

router.put("/admin/social/config", async (req: Request, res: Response) => {
  const Patch = z.object({
    enabled: z.boolean().optional(),
    autoApprove: z.boolean().optional(),
    dailyPostCap: z.number().int().min(1).max(100).optional(),
    maxQueue: z.number().int().min(1).max(500).optional(),
    minDelayMinutes: z.number().int().min(5).max(1440).optional(),
    quietHours: z.array(z.number().int().min(0).max(23)).optional(),
    enabledChannels: z.array(z.enum(["x", "bluesky", "threads"])).optional(),
  });
  const parsed = Patch.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json({ config: await setSocialConfig(parsed.data) });
});

router.get("/admin/social/drafts", async (req: Request, res: Response) => {
  const status = String(req.query["status"] ?? "");
  const channelParam = String(req.query["channel"] ?? "");
  const channelFilter =
    channelParam === "x" || channelParam === "bluesky" || channelParam === "threads"
      ? eq(contentDraftsTable.channel, channelParam)
      : sql`${contentDraftsTable.channel} in ('x','bluesky','threads')`;
  const where = and(
    eq(contentDraftsTable.kind, "social"),
    channelFilter,
    status ? eq(contentDraftsTable.status, status as "draft" | "approved" | "scheduled" | "posted") : sql`true`,
  );
  const rows = await db
    .select()
    .from(contentDraftsTable)
    .where(where)
    .orderBy(desc(contentDraftsTable.createdAt))
    .limit(300);
  res.json({ drafts: rows });
});

router.get("/admin/social/stats", async (_req: Request, res: Response) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      channel: contentDraftsTable.channel,
      drafts: sql<number>`count(*) filter (where status = 'draft')::int`,
      approved: sql<number>`count(*) filter (where status = 'approved')::int`,
      postedToday: sql<number>`count(*) filter (where status = 'posted' and posted_at >= ${since24h})::int`,
      postedWeek: sql<number>`count(*) filter (where status = 'posted' and posted_at >= ${since7d})::int`,
    })
    .from(contentDraftsTable)
    .where(
      and(
        eq(contentDraftsTable.kind, "social"),
        sql`${contentDraftsTable.channel} in ('x','bluesky','threads')`,
      ),
    )
    .groupBy(contentDraftsTable.channel);
  const byChannel: Record<string, { drafts: number; approved: number; postedToday: number; postedWeek: number }> = {};
  for (const ch of ALL_SOCIAL_CHANNELS) {
    byChannel[ch] = { drafts: 0, approved: 0, postedToday: 0, postedWeek: 0 };
  }
  for (const r of rows) {
    byChannel[r.channel] = {
      drafts: r.drafts,
      approved: r.approved,
      postedToday: r.postedToday,
      postedWeek: r.postedWeek,
    };
  }
  // Totals across channels for the legacy header tiles.
  const totals = Object.values(byChannel).reduce(
    (acc, v) => ({
      drafts: acc.drafts + v.drafts,
      approved: acc.approved + v.approved,
      postedToday: acc.postedToday + v.postedToday,
      postedWeek: acc.postedWeek + v.postedWeek,
    }),
    { drafts: 0, approved: 0, postedToday: 0, postedWeek: 0 },
  );
  res.json({ ...totals, byChannel, networks: await networksStatus() });
});

router.post("/admin/social/generate-now", async (_req: Request, res: Response) => {
  const r = await generateOneTweet();
  res.json(r);
});

router.post("/admin/social/verify", async (_req: Request, res: Response) => {
  res.json(await verifyXCredentials());
});

router.put("/admin/social/drafts/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const Patch = z.object({
    body: z.string().max(280).optional(),
    status: z.enum(["draft", "approved", "rejected"]).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
  });
  const parsed = Patch.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.body !== undefined) {
    patch["body"] = parsed.data.body;
    patch["hashtags"] = parsed.data.body.match(/#\w+/g) ?? [];
  }
  if (parsed.data.status !== undefined) {
    // Map our UI's "rejected" onto the existing posted-or-discard cleanup;
    // we use 'draft' status with a sentinel scheduledAt=null + rejection by deletion.
    if (parsed.data.status === "rejected") {
      await db.delete(contentDraftsTable).where(eq(contentDraftsTable.id, id));
      return res.json({ ok: true, deleted: true });
    }
    patch["status"] = parsed.data.status;
    if (parsed.data.status === "approved" && parsed.data.scheduledAt === undefined) {
      const cfg = await getSocialConfig();
      patch["scheduledAt"] = new Date(Date.now() + cfg.minDelayMinutes * 60 * 1000);
    }
  }
  if (parsed.data.scheduledAt !== undefined) {
    patch["scheduledAt"] = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  }
  const [row] = await db
    .update(contentDraftsTable)
    .set(patch)
    .where(eq(contentDraftsTable.id, id))
    .returning();
  res.json({ draft: row });
});

router.post("/admin/social/drafts/:id/post-now", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  const [draft] = await db.select().from(contentDraftsTable).where(eq(contentDraftsTable.id, id)).limit(1);
  if (!draft) return res.status(404).json({ error: "Not found" });
  if (draft.status === "posted") return res.status(400).json({ error: "Already posted" });
  if (draft.status === "posting") return res.status(409).json({ error: "Already being posted by the publisher" });
  const channel = draft.channel as SocialChannel;
  if (channel !== "x" && channel !== "bluesky" && channel !== "threads") {
    return res.status(400).json({ error: `Unsupported channel: ${channel}` });
  }
  // Atomic claim: only proceed if status hasn't changed since our SELECT.
  // Stops the auto-publish cron from racing us on the same row.
  const originalStatus = draft.status;
  const [claimed] = await db
    .update(contentDraftsTable)
    .set({ status: "posting", updatedAt: new Date() })
    .where(and(eq(contentDraftsTable.id, id), eq(contentDraftsTable.status, originalStatus)))
    .returning({ id: contentDraftsTable.id });
  if (!claimed) {
    return res.status(409).json({ error: "Draft state changed — refresh and try again" });
  }

  const r =
    channel === "x"
      ? await postTweet({ text: draft.body })
      : channel === "bluesky"
        ? await postBlueskyPost({ text: draft.body })
        : await postThreadsPost({ text: draft.body });

  if (!r.ok) {
    // Release the lease back to whatever it was before we claimed.
    await db
      .update(contentDraftsTable)
      .set({ status: originalStatus, updatedAt: new Date() })
      .where(eq(contentDraftsTable.id, id));
    return res
      .status(502)
      .json({ error: r.error, rateLimited: "rateLimited" in r ? r.rateLimited : false });
  }
  const meta: Record<string, unknown> = { url: r.url };
  if (channel === "x" && "tweetId" in r) meta["tweetId"] = r.tweetId;
  if (channel === "bluesky" && "uri" in r) meta["uri"] = r.uri;
  if (channel === "threads" && "threadId" in r) meta["threadId"] = r.threadId;
  await db
    .update(contentDraftsTable)
    .set({
      status: "posted",
      postedAt: new Date(),
      jsonLd: meta,
      updatedAt: new Date(),
    })
    .where(eq(contentDraftsTable.id, id));
  res.json({ ok: true, channel, ...meta });
});

router.delete("/admin/social/drafts/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });
  await db.delete(contentDraftsTable).where(eq(contentDraftsTable.id, id));
  res.json({ ok: true });
});

export default router;

// Helper exposed for the auto-publish cron to share the daily-cap & quiet-hours
// logic without importing this whole router. Daily cap is per-channel so each
// network has its own budget (X free tier is 17/day, Bluesky is much higher,
// Threads is 250/day).
export async function canPostNow(
  now: Date = new Date(),
  channel: SocialChannel = "x",
): Promise<{ ok: boolean; reason?: string }> {
  const cfg = await getSocialConfig();
  if (!cfg.enabled) return { ok: false, reason: "disabled" };
  if (!cfg.enabledChannels.includes(channel)) return { ok: false, reason: `${channel} not enabled` };
  if (cfg.quietHours.includes(now.getHours())) return { ok: false, reason: "quiet hours" };
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [{ posted = 0 } = { posted: 0 }] = await db
    .select({ posted: sql<number>`count(*)::int` })
    .from(contentDraftsTable)
    .where(
      and(
        eq(contentDraftsTable.kind, "social"),
        eq(contentDraftsTable.channel, channel),
        eq(contentDraftsTable.status, "posted"),
        gte(contentDraftsTable.postedAt, since),
      ),
    );
  if (Number(posted) >= cfg.dailyPostCap) {
    return { ok: false, reason: `${channel} daily cap (${posted}/${cfg.dailyPostCap})` };
  }
  return { ok: true };
}
