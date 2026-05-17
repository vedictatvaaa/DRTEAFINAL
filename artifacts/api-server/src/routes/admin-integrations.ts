import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../middlewares/admin-auth";
import {
  INTEGRATION_KEYS,
  listIntegrationStatus,
  setIntegrationKey,
  clearIntegrationKey,
} from "../lib/integration-keys";
import { verifyXCredentials } from "../lib/x-client";
import { verifyBlueskyCredentials } from "../lib/bluesky-client";
import { verifyThreadsCredentials } from "../lib/threads-client";

const router: IRouter = Router();
router.use("/admin/integrations", requireAdmin);

const KNOWN_KEYS = new Set(INTEGRATION_KEYS.map((k) => k.key));

router.get("/admin/integrations", async (_req: Request, res: Response) => {
  res.json({ keys: await listIntegrationStatus() });
});

router.put("/admin/integrations/:key", async (req: Request, res: Response) => {
  const key = req.params["key"]!;
  if (!KNOWN_KEYS.has(key)) return res.status(404).json({ error: "Unknown key" });
  const Body = z.object({ value: z.string().max(2000) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setIntegrationKey(key, parsed.data.value);
  res.json({ ok: true });
});

router.delete("/admin/integrations/:key", async (req: Request, res: Response) => {
  const key = req.params["key"]!;
  if (!KNOWN_KEYS.has(key)) return res.status(404).json({ error: "Unknown key" });
  await clearIntegrationKey(key);
  res.json({ ok: true });
});

router.post("/admin/integrations/test/:group", async (req: Request, res: Response) => {
  const group = req.params["group"];
  if (group === "x") return res.json(await verifyXCredentials());
  if (group === "bluesky") return res.json(await verifyBlueskyCredentials());
  if (group === "threads") return res.json(await verifyThreadsCredentials());
  return res.status(400).json({ error: "No test for this group yet" });
});

export default router;
