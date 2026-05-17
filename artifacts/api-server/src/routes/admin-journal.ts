import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, or } from "drizzle-orm";
import { db, articlesTable, journalCommentsTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { generateDailyJournalDrafts } from "../lib/journal-cron";
import { schedulePing } from "../lib/seo-ping";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use("/admin/journal", requireAdmin);

router.get("/admin/journal/queue", async (_req: Request, res: Response) => {
  const pendingArticles = await db
    .select()
    .from(articlesTable)
    .where(eq(articlesTable.status, "pending"))
    .orderBy(desc(articlesTable.createdAt))
    .limit(200);
  const pendingComments = await db
    .select()
    .from(journalCommentsTable)
    .where(
      or(
        eq(journalCommentsTable.status, "pending"),
        eq(journalCommentsTable.status, "rejected"),
      ),
    )
    .orderBy(desc(journalCommentsTable.createdAt))
    .limit(200);
  res.json({ pendingArticles, pendingComments });
});

router.post(
  "/admin/journal/articles/:id/approve",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .update(articlesTable)
      .set({
        status: "approved",
        published: true,
        updatedAt: new Date(),
      })
      .where(eq(articlesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    schedulePing();
    res.json({ ok: true, article: row });
  },
);

router.post(
  "/admin/journal/articles/:id/reject",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const reason =
      typeof req.body?.reason === "string"
        ? String(req.body.reason).slice(0, 240)
        : "Rejected by admin";
    const [row] = await db
      .update(articlesTable)
      .set({
        status: "rejected",
        published: false,
        moderationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(articlesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true, article: row });
  },
);

router.post(
  "/admin/journal/comments/:id/approve",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .update(journalCommentsTable)
      .set({ status: "approved" })
      .where(eq(journalCommentsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true, comment: row });
  },
);

router.post(
  "/admin/journal/comments/:id/reject",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const reason =
      typeof req.body?.reason === "string"
        ? String(req.body.reason).slice(0, 240)
        : "Rejected by admin";
    const [row] = await db
      .update(journalCommentsTable)
      .set({ status: "rejected", moderationReason: reason })
      .where(eq(journalCommentsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true, comment: row });
  },
);

router.post(
  "/admin/journal/generate-now",
  async (_req: Request, res: Response) => {
    try {
      const out = await generateDailyJournalDrafts();
      res.json({ ok: true, ...out });
    } catch (err) {
      logger.error({ err }, "Manual journal generation failed");
      res.status(500).json({ error: "Generation failed" });
    }
  },
);

export default router;
