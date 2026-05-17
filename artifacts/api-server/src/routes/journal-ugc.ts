import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  articlesTable,
  journalCommentsTable,
  type ShopperUserRow,
} from "../lib/db";
import { requireShopper } from "../lib/shopper-auth";
import { moderateContent } from "../lib/ai-moderation";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PostBody = z.object({
  title: z.string().min(6).max(200),
  excerpt: z.string().min(20).max(400),
  category: z.string().min(2).max(60).default("Community"),
  readTime: z.string().max(30).optional().default("5 min read"),
  cover: z.string().url().max(800).optional().default(""),
  body: z
    .array(
      z.object({
        heading: z.string().max(200).optional(),
        paragraphs: z.array(z.string().min(1).max(3000)).min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
});

const CommentBody = z.object({
  body: z.string().min(2).max(2000),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || `post-${Date.now()}`;
  let n = 1;
  while (true) {
    const [existing] = await db
      .select({ id: articlesTable.id })
      .from(articlesTable)
      .where(eq(articlesTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
    if (n > 50) return `${base}-${Date.now()}`;
  }
}

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=1600&q=80&auto=format&fit=crop";

router.post(
  "/journal/posts",
  requireShopper(),
  async (req: Request, res: Response) => {
    const user = (req as Request & { shopper?: ShopperUserRow }).shopper!;
    const parsed = PostBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }
    const { title, excerpt, category, readTime, cover, body } = parsed.data;

    // Concatenate everything that should be moderated.
    const combined = [
      title,
      excerpt,
      ...body.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
    ].join("\n\n");
    const verdict = await moderateContent(combined, "post");
    if (verdict.decision === "reject") {
      res.status(400).json({
        error: "Your post couldn't be published.",
        reason: verdict.reason,
      });
      return;
    }

    const baseSlug = slugify(title) || `post-${Date.now()}`;
    let slug = await uniqueSlug(baseSlug);
    // Race-safe insert: retry on unique-violation up to 5 times before giving up.
    let row: { id: number } | undefined;
    let attempt = 0;
    while (attempt < 5) {
      try {
        const inserted = await db
          .insert(articlesTable)
          .values({
            slug,
            title,
            excerpt,
            category,
            readTime,
            date: new Date().toISOString().slice(0, 10),
            cover: cover || FALLBACK_COVER,
            body,
            published: false,
            status: "pending",
            authorType: "shopper",
            authorUserId: user.id,
            authorName: user.name || user.email.split("@")[0],
            moderationReason: verdict.reason,
          })
          .returning({ id: articlesTable.id });
        row = inserted[0];
        break;
      } catch (err) {
        const msg = (err as { code?: string; message?: string }).message ?? "";
        const code = (err as { code?: string }).code;
        if (code === "23505" || /duplicate key|unique/i.test(msg)) {
          attempt += 1;
          slug = `${baseSlug}-${Date.now()}-${attempt}`;
          continue;
        }
        throw err;
      }
    }
    if (!row) {
      res.status(500).json({ error: "Could not save your post — please try again." });
      return;
    }
    logger.info({ id: row.id, userId: user.id, degraded: verdict.degraded }, "Shopper post submitted");
    res.status(201).json({
      ok: true,
      slug,
      status: "pending",
      message: "Thanks! Your post is in our moderation queue and will appear once approved.",
    });
  },
);

router.get(
  "/journal/articles/:slug/comments",
  async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const rows = await db
      .select()
      .from(journalCommentsTable)
      .where(
        and(
          eq(journalCommentsTable.articleSlug, slug),
          eq(journalCommentsTable.status, "approved"),
        ),
      )
      .orderBy(desc(journalCommentsTable.createdAt))
      .limit(200);
    res.json(
      rows.map((r) => ({
        id: r.id,
        authorName: r.authorName || "Tea Lover",
        body: r.body,
        createdAt: r.createdAt,
      })),
    );
  },
);

router.post(
  "/journal/articles/:slug/comments",
  requireShopper(),
  async (req: Request, res: Response) => {
    const user = (req as Request & { shopper?: ShopperUserRow }).shopper!;
    const slug = String(req.params.slug);
    const parsed = CommentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    // Confirm article exists + is published.
    const [article] = await db
      .select({ id: articlesTable.id })
      .from(articlesTable)
      .where(
        and(eq(articlesTable.slug, slug), eq(articlesTable.published, true)),
      )
      .limit(1);
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const verdict = await moderateContent(parsed.data.body, "comment");
    const status: "pending" | "rejected" =
      verdict.decision === "reject" ? "rejected" : "pending";
    const [row] = await db
      .insert(journalCommentsTable)
      .values({
        articleSlug: slug,
        shopperUserId: user.id,
        authorName: user.name || user.email.split("@")[0],
        authorEmail: user.email,
        body: parsed.data.body,
        status,
        moderationReason: verdict.reason,
      })
      .returning();

    if (verdict.decision === "reject") {
      res.status(400).json({
        error: "Your comment couldn't be posted.",
        reason: verdict.reason,
      });
      return;
    }
    logger.info({ id: row?.id, slug, userId: user.id, degraded: verdict.degraded }, "Comment submitted");
    res.status(201).json({
      ok: true,
      status,
      message: "Thanks — your comment will appear once approved.",
    });
  },
);

export default router;
