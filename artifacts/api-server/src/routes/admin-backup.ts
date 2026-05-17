import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  SnapshotValidationError,
} from "../lib/backups";
import {
  listVersions,
  listAllRecentVersions,
  revertToVersion,
  type VersionedEntity,
} from "../lib/version-history";

const router: IRouter = Router();

router.use("/admin/backups", requireAdmin);
router.use("/admin/versions", requireAdmin);

router.get("/admin/backups", async (req: Request, res: Response) => {
  const kindParam = req.query["kind"];
  const kind =
    kindParam === "daily" || kindParam === "manual" ? kindParam : undefined;
  const rows = await listSnapshots(kind);
  res.json(rows);
});

router.post("/admin/backups", async (req: Request, res: Response) => {
  try {
    const row = await createSnapshot("manual");
    // createSnapshot persists a row even on failure (status="failed") so
    // operators have a record of attempts. Surface that as an HTTP error so
    // the UI shows a real failure toast instead of "created".
    if (row.status !== "ready") {
      req.log.error({ row }, "Manual snapshot persisted as failed");
      res.status(500).json({
        error: row.errorMessage ?? "Snapshot failed",
        snapshotId: row.id,
      });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Manual snapshot failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Snapshot failed" });
  }
});

const RestoreBody = z.object({ confirm: z.string().min(1) });

router.post("/admin/backups/:id/restore", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = RestoreBody.safeParse(req.body);
  if (!parsed.success || parsed.data.confirm !== id) {
    res.status(400).json({ error: "Confirmation must equal the snapshot id" });
    return;
  }
  try {
    const result = await restoreSnapshot(id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Restore failed");
    if (err instanceof SnapshotValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : "Restore failed" });
  }
});

const ENTITY_TYPES = new Set<VersionedEntity>(["product", "article", "experience"]);

router.get("/admin/versions/recent", async (_req: Request, res: Response) => {
  const rows = await listAllRecentVersions(100);
  res.json(rows);
});

router.get("/admin/versions/:entityType/:entityId", async (req: Request, res: Response) => {
  const entityType = String(req.params.entityType) as VersionedEntity;
  if (!ENTITY_TYPES.has(entityType)) {
    res.status(400).json({ error: "Unsupported entity type" });
    return;
  }
  const rows = await listVersions(entityType, String(req.params.entityId));
  res.json(rows);
});

router.post("/admin/versions/:id/revert", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const result = await revertToVersion(id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Revert failed");
    if (err instanceof Error && /not found/i.test(err.message)) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof Error && /invalid|unsupported/i.test(err.message)) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : "Revert failed" });
  }
});

export default router;
