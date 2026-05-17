import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../middlewares/admin-auth";
import { listProviders, getProvider, isValidProviderKey } from "../lib/payments";
import { getSettings, updateSettings } from "../lib/payments/settings";

const router: IRouter = Router();

router.use("/admin/payments", requireAdmin);

router.get("/admin/payments/settings", async (_req: Request, res: Response) => {
  const settings = await getSettings();
  const providers = listProviders().map((p) => ({
    key: p.key,
    label: p.label,
    configured: p.isConfigured(),
    publishableKey: p.isConfigured() ? p.publishableKey() : null,
  }));
  res.json({
    activeProvider: settings.activeProvider,
    codEnabled: settings.codEnabled,
    codLabel: settings.codLabel,
    paidLabel: settings.paidLabel,
    updatedAt: settings.updatedAt,
    providers,
  });
});

const PutBody = z.object({
  activeProvider: z.string().optional(),
  codEnabled: z.boolean().optional(),
  codLabel: z.string().min(1).max(80).optional(),
  paidLabel: z.string().min(1).max(80).optional(),
});

router.put("/admin/payments/settings", async (req: Request, res: Response) => {
  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { activeProvider, codEnabled, codLabel, paidLabel } = parsed.data;
  if (activeProvider !== undefined) {
    if (!isValidProviderKey(activeProvider)) {
      res.status(400).json({ error: "Unknown provider" });
      return;
    }
    if (!getProvider(activeProvider).isConfigured()) {
      res.status(400).json({ error: "Provider has missing env keys; cannot activate" });
      return;
    }
  }
  const updated = await updateSettings({
    activeProvider: activeProvider as Parameters<typeof updateSettings>[0]["activeProvider"],
    codEnabled,
    codLabel,
    paidLabel,
  });
  res.json({
    activeProvider: updated.activeProvider,
    codEnabled: updated.codEnabled,
    codLabel: updated.codLabel,
    paidLabel: updated.paidLabel,
    updatedAt: updated.updatedAt,
  });
});

export default router;
