import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, franchiseApplicationsTable } from "../lib/db";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";

const router: IRouter = Router();

const STATUS_VALUES = ["new", "contacted", "qualified", "rejected", "signed"] as const;
type FranchiseStatus = (typeof STATUS_VALUES)[number];

const ApplyBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(20),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional().default(""),
  investmentRange: z.enum(["10-25L", "25-50L", "50L-1Cr", "1Cr+"]),
  preferredFormat: z.enum(["kiosk", "cafe", "flagship"]).default("kiosk"),
  experience: z.string().trim().max(2000).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

router.post("/franchise/apply", async (req: Request, res: Response) => {
  const parsed = ApplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  try {
    const [row] = await db
      .insert(franchiseApplicationsTable)
      .values({
        ...data,
        ipAddress: (req.ip ?? "").toString().slice(0, 64),
        userAgent: (req.get("user-agent") ?? "").slice(0, 400),
      })
      .returning({ id: franchiseApplicationsTable.id });
    if (row) {
      void recordActivity({
        kind: "franchise_application_received",
        actor: "system",
        title: `Franchise enquiry: ${data.fullName} (${data.city})`,
        summary: `${data.investmentRange} • ${data.preferredFormat}`,
        entityType: "franchise_application",
        entityId: row.id,
      });
    }
    res.status(201).json({ ok: true, id: row?.id });
  } catch (err) {
    logger.error({ err }, "franchise.apply.failed");
    res.status(500).json({ error: "Could not record application" });
  }
});

// ── Admin ────────────────────────────────────────────────────────────────
router.use("/admin/franchise", requireAdmin);

router.get("/admin/franchise/overview", async (_req: Request, res: Response) => {
  try {
    const [total] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(franchiseApplicationsTable);

    const byStatus = await db
      .select({
        status: franchiseApplicationsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(franchiseApplicationsTable)
      .groupBy(franchiseApplicationsTable.status);

    const byFormat = await db
      .select({
        format: franchiseApplicationsTable.preferredFormat,
        count: sql<number>`count(*)::int`,
      })
      .from(franchiseApplicationsTable)
      .groupBy(franchiseApplicationsTable.preferredFormat);

    const byInvestment = await db
      .select({
        investmentRange: franchiseApplicationsTable.investmentRange,
        count: sql<number>`count(*)::int`,
      })
      .from(franchiseApplicationsTable)
      .groupBy(franchiseApplicationsTable.investmentRange);

    const [recentWeek] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(franchiseApplicationsTable)
      .where(sql`${franchiseApplicationsTable.createdAt} >= now() - interval '7 days'`);

    const recent = await db
      .select()
      .from(franchiseApplicationsTable)
      .orderBy(desc(franchiseApplicationsTable.createdAt))
      .limit(5);

    res.json({
      total: total?.count ?? 0,
      newLastWeek: recentWeek?.count ?? 0,
      byStatus,
      byFormat,
      byInvestment,
      recent,
    });
  } catch (err) {
    logger.error({ err }, "franchise.overview.failed");
    res.status(500).json({ error: "Could not load overview" });
  }
});

const ListQuery = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  format: z.enum(["kiosk", "cafe", "flagship"]).optional(),
  investment: z.enum(["10-25L", "25-50L", "50L-1Cr", "1Cr+"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

router.get("/admin/franchise/applications", async (req: Request, res: Response) => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  try {
    const filters: SQL[] = [];
    if (parsed.data.status) {
      filters.push(eq(franchiseApplicationsTable.status, parsed.data.status));
    }
    if (parsed.data.format) {
      filters.push(eq(franchiseApplicationsTable.preferredFormat, parsed.data.format));
    }
    if (parsed.data.investment) {
      filters.push(eq(franchiseApplicationsTable.investmentRange, parsed.data.investment));
    }
    if (parsed.data.q) {
      const like = `%${parsed.data.q}%`;
      const cond = or(
        ilike(franchiseApplicationsTable.fullName, like),
        ilike(franchiseApplicationsTable.email, like),
        ilike(franchiseApplicationsTable.phone, like),
        ilike(franchiseApplicationsTable.city, like),
      );
      if (cond) filters.push(cond);
    }
    const rows = await db
      .select()
      .from(franchiseApplicationsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(franchiseApplicationsTable.createdAt))
      .limit(parsed.data.limit);
    res.json({ applications: rows });
  } catch (err) {
    logger.error({ err }, "franchise.list.failed");
    res.status(500).json({ error: "Could not list applications" });
  }
});

router.get("/admin/franchise/applications/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(franchiseApplicationsTable)
      .where(eq(franchiseApplicationsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ application: row });
  } catch (err) {
    logger.error({ err }, "franchise.get.failed");
    res.status(500).json({ error: "Could not load application" });
  }
});

const StatusBody = z.object({
  status: z.enum(STATUS_VALUES),
});

router.patch("/admin/franchise/applications/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = StatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  try {
    const [before] = await db
      .select()
      .from(franchiseApplicationsTable)
      .where(eq(franchiseApplicationsTable.id, id))
      .limit(1);
    if (!before) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const next: FranchiseStatus = parsed.data.status;
    if (before.status === next) {
      res.json({ application: before });
      return;
    }
    const [row] = await db
      .update(franchiseApplicationsTable)
      .set({ status: next, updatedAt: new Date() })
      .where(eq(franchiseApplicationsTable.id, id))
      .returning();
    void recordActivity({
      kind: "franchise_status_changed",
      actor: "admin",
      title: `Franchise: ${before.fullName} → ${next}`,
      summary: `${before.status} → ${next}`,
      entityType: "franchise_application",
      entityId: id,
      payload: { from: before.status, to: next },
    });
    res.json({ application: row });
  } catch (err) {
    logger.error({ err }, "franchise.update.failed");
    res.status(500).json({ error: "Could not update application" });
  }
});

export default router;
