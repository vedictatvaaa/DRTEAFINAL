import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../middlewares/admin-auth";
import { logger } from "../lib/logger";
import { seedExperiences } from "../lib/seed-experiences";

const router: IRouter = Router();
router.use("/admin/deploy", requireAdmin);

interface DeployRecord {
  id: string;
  triggeredAt: string;
  triggeredBy: string;
  status: "pending" | "triggered" | "success" | "failed" | "rolled-back";
  method: string;
  message?: string;
  durationMs?: number;
  action?: "deploy" | "rollback";
  commit?: string;
  logs?: string[];
}

const deployHistory: DeployRecord[] = [];
let currentDeploy: DeployRecord | null = null;

function shortId(): string {
  return Math.random().toString(36).slice(2, 9);
}

const REQUIRED_ENV = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "PORT",
];

const OPTIONAL_ENV = [
  "DEPLOY_WEBHOOK_URL",
  "DEPLOY_WEBHOOK_SECRET",
  "GITHUB_TOKEN",
  "GITHUB_REPO",
  "SMTP_HOST",
  "RAZORPAY_KEY_ID",
  "SHIPROCKET_EMAIL",
  "OPENAI_API_KEY",
];

const DEPLOY_ENV = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "PORT",
  "ADMIN_PASSWORD",
  "DEPLOY_WEBHOOK_URL",
  "DEPLOY_WEBHOOK_SECRET",
  "GITHUB_TOKEN",
  "GITHUB_REPO",
  "OPENAI_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "SHIPROCKET_EMAIL",
  "SHIPROCKET_PASSWORD",
  "PRIVATE_OBJECT_DIR",
  "PUBLIC_OBJECT_DIR",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
];

router.get("/admin/deploy/status", (req: Request, res: Response) => {
  const lastSuccess = deployHistory.find((d) => d.status === "success" && d.action !== "rollback") ?? null;
  const rollbackTarget = deployHistory.find((d) => d.status === "success" && d.action !== "rollback" && !!d.commit) ?? null;
  res.json({
    current: currentDeploy,
    lastSuccess,
    rollbackReady: !!rollbackTarget,
    rollbackTargetCommit: rollbackTarget?.commit ?? null,
    webhookConfigured: !!process.env["DEPLOY_WEBHOOK_URL"],
    githubConfigured: !!(process.env["GITHUB_TOKEN"] && process.env["GITHUB_REPO"]),
  });
});

router.get("/admin/deploy/history", (req: Request, res: Response) => {
  res.json(deployHistory.slice(0, 20));
});

router.get("/admin/deploy/readiness", (req: Request, res: Response) => {
  const required = REQUIRED_ENV.map((key) => ({
    key,
    set: !!process.env[key],
    required: true,
  }));
  const optional = OPTIONAL_ENV.map((key) => ({
    key,
    set: !!process.env[key],
    required: false,
  }));
  const allRequiredMet = required.every((e) => e.set);
  res.json({
    ready: allRequiredMet,
    required,
    optional,
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
});

router.get("/admin/deploy/env-template", (req: Request, res: Response) => {
  res.type("text/plain").send(
    DEPLOY_ENV.map((key) => `${key}=`).join("\n") + "\n",
  );
});

router.get("/admin/deploy/bootstrap", (req: Request, res: Response) => {
  res.json({
    commands: [
      "pnpm --filter @workspace/api-server db:migrate",
      "pnpm --filter @workspace/api-server db:seed",
      "pnpm --filter @workspace/dr-tea build",
      "pm2 reload ecosystem.config.cjs",
    ],
    seeders: ["experiences"],
    note: "Run migrations first, then seed only on a fresh VPS install or after a reset.",
  });
});

router.post("/admin/deploy/bootstrap", async (req: Request, res: Response) => {
  const dryRun = Boolean((req.body as { dryRun?: boolean } | undefined)?.dryRun);
  if (dryRun) {
    res.json({ ok: true, seeded: false, message: "Dry run only. No data changed." });
    return;
  }

  try {
    await seedExperiences();
    res.json({ ok: true, seeded: true, message: "Experiences seeded successfully." });
  } catch (err) {
    logger.error({ err }, "Bootstrap seed failed");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Bootstrap failed",
    });
  }
});

router.post("/admin/deploy/trigger", async (req: Request, res: Response) => {
  if (currentDeploy?.status === "pending" || currentDeploy?.status === "triggered") {
    res.status(409).json({ error: "A deploy is already in progress." });
    return;
  }

  const body = req.body as { method?: string; commit?: string; action?: "deploy" | "rollback" } | undefined;
  const method = body?.method ?? "webhook";
  const action = body?.action ?? "deploy";
  const commit = body?.commit;
  const adminEmail = (req as Request & { admin?: { email?: string } }).admin?.email ?? "admin";

  const record: DeployRecord = {
    id: shortId(),
    triggeredAt: new Date().toISOString(),
    triggeredBy: adminEmail,
    status: "pending",
    method,
    action,
    commit,
    logs: [`[${new Date().toISOString()}] ${action === "rollback" ? "Rollback" : "Deploy"} requested by ${adminEmail} via ${method}${commit ? ` (target: ${commit})` : ""}`],
  };

  currentDeploy = record;
  deployHistory.unshift(record);

  try {
    if (method === "github") {
      await triggerGitHubActions(record);
    } else {
      await triggerWebhook(record);
    }
    res.json({ success: true, deploy: record });
  } catch (err) {
    record.status = "failed";
    record.message = err instanceof Error ? err.message : "Unknown error";
    record.logs?.push(`[${new Date().toISOString()}] ERROR: ${record.message}`);
    currentDeploy = null;
    logger.error({ err }, "Deploy trigger failed");
    res.status(500).json({ error: record.message, deploy: record });
  }
});

router.post("/admin/deploy/rollback", async (req: Request, res: Response) => {
  if (currentDeploy?.status === "pending" || currentDeploy?.status === "triggered") {
    res.status(409).json({ error: "A deploy is in progress. Wait for it to finish first." });
    return;
  }

  const lastSuccess = deployHistory.find((d) => d.status === "success" && d.action !== "rollback");
  const target = (req.body as { commit?: string } | undefined)?.commit ?? lastSuccess?.commit;

  if (!target) {
    res.status(400).json({ error: "No previous successful deploy commit found. Provide a commit SHA to roll back to." });
    return;
  }

  const adminEmail = (req as Request & { admin?: { email?: string } }).admin?.email ?? "admin";
  const record: DeployRecord = {
    id: shortId(),
    triggeredAt: new Date().toISOString(),
    triggeredBy: adminEmail,
    status: "pending",
    method: "webhook",
    action: "rollback",
    commit: target,
    logs: [`[${new Date().toISOString()}] Rollback to ${target.slice(0, 7)} requested by ${adminEmail}`],
  };

  currentDeploy = record;
  deployHistory.unshift(record);

  try {
    await triggerWebhook(record);
    res.json({ success: true, deploy: record });
  } catch (err) {
    record.status = "failed";
    record.message = err instanceof Error ? err.message : "Unknown error";
    record.logs?.push(`[${new Date().toISOString()}] ERROR: ${record.message}`);
    currentDeploy = null;
    res.status(500).json({ error: record.message, deploy: record });
  }
});

router.get("/admin/deploy/logs/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = deployHistory.find((d) => d.id === id);
  if (!record) {
    res.status(404).json({ error: "Deploy not found" });
    return;
  }
  res.json({
    id: record.id,
    status: record.status,
    action: record.action,
    commit: record.commit,
    triggeredAt: record.triggeredAt,
    triggeredBy: record.triggeredBy,
    durationMs: record.durationMs,
    message: record.message,
    logs: record.logs ?? [],
  });
});

async function triggerWebhook(record: DeployRecord): Promise<void> {
  const url = process.env["DEPLOY_WEBHOOK_URL"];
  if (!url) {
    record.status = "failed";
    record.message = "DEPLOY_WEBHOOK_URL environment variable is not set.";
    currentDeploy = null;
    throw new Error(record.message);
  }

  const secret = process.env["DEPLOY_WEBHOOK_SECRET"];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Deploy-Secret"] = secret;

  const start = Date.now();
  record.logs?.push(`[${new Date().toISOString()}] POST ${url}`);
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "dr-tea-admin",
      deployId: record.id,
      ts: record.triggeredAt,
      action: record.action ?? "deploy",
      commit: record.commit,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  record.durationMs = Date.now() - start;
  record.logs?.push(`[${new Date().toISOString()}] HTTP ${resp.status} (${record.durationMs}ms)`);

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    record.status = "failed";
    record.message = `Webhook returned HTTP ${resp.status}: ${body.slice(0, 200)}`;
    record.logs?.push(`[${new Date().toISOString()}] ERROR body: ${body.slice(0, 500)}`);
    currentDeploy = null;
    throw new Error(record.message);
  }

  record.status = "triggered";
  record.message = record.action === "rollback"
    ? `Rollback webhook delivered — VPS reverting to ${record.commit?.slice(0, 7)}.`
    : "Webhook delivered — VPS is building.";
  record.logs?.push(`[${new Date().toISOString()}] ${record.message}`);
  setTimeout(() => {
    if (record.status === "triggered") {
      record.status = record.action === "rollback" ? "rolled-back" : "success";
      record.logs?.push(`[${new Date().toISOString()}] Marked ${record.status} (no failure reported within 60s).`);
      currentDeploy = null;
    }
  }, 60_000);

  logger.info({ deployId: record.id, url, action: record.action }, "Deploy webhook triggered");
}

async function triggerGitHubActions(record: DeployRecord): Promise<void> {
  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];

  if (!token || !repo) {
    record.status = "failed";
    record.message = "GITHUB_TOKEN and GITHUB_REPO environment variables are required for GitHub Actions deploys.";
    currentDeploy = null;
    throw new Error(record.message);
  }

  const start = Date.now();
  const eventType = record.action === "rollback" ? "rollback" : "deploy";
  record.logs?.push(`[${new Date().toISOString()}] POST github.com/${repo}/dispatches (${eventType})`);
  const resp = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: { deployId: record.id, commit: record.commit },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  record.durationMs = Date.now() - start;
  record.logs?.push(`[${new Date().toISOString()}] HTTP ${resp.status} (${record.durationMs}ms)`);

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    record.status = "failed";
    record.message = `GitHub API returned HTTP ${resp.status}: ${body.slice(0, 200)}`;
    record.logs?.push(`[${new Date().toISOString()}] ERROR body: ${body.slice(0, 500)}`);
    currentDeploy = null;
    throw new Error(record.message);
  }

  record.status = "triggered";
  record.message = `GitHub Actions ${eventType} workflow dispatched.`;
  record.logs?.push(`[${new Date().toISOString()}] ${record.message}`);
  setTimeout(() => {
    if (record.status === "triggered") {
      record.status = record.action === "rollback" ? "rolled-back" : "success";
      record.logs?.push(`[${new Date().toISOString()}] Marked ${record.status}.`);
      currentDeploy = null;
    }
  }, 120_000);

  logger.info({ deployId: record.id, repo, action: record.action }, "GitHub Actions deploy dispatched");
}

export default router;
