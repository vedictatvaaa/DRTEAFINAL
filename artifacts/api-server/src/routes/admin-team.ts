import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  adminUsersTable,
  type AdminRole,
  type AdminUserRow,
} from "../lib/db";
import {
  requireAdmin,
  getCurrentAdmin,
  invalidateAdminAuthCache,
} from "../middlewares/admin-auth";
import {
  hashPassword,
  generateInviteToken,
} from "../lib/admin-passwords";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All /admin/team endpoints require admin auth. Role-based gating (e.g.
// only owners can promote to owner) is enforced inside each handler.
router.use("/admin/team", requireAdmin);

// Public accept-invite endpoint must NOT require auth — it's how a brand
// new team member sets their password from the invite link they got.
//
// Safety: we sanitise rows before sending them out (never leak password
// hashes or invite tokens).

function sanitize(u: AdminUserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    invitedByEmail: u.invitedByEmail,
    lastSeenAt: u.lastSeenAt,
    createdAt: u.createdAt,
    inviteExpiresAt: u.status === "invited" ? u.inviteExpiresAt : null,
  };
}

async function actorContext(req: Request): Promise<{
  email: string;
  role: AdminRole;
  isOwner: boolean;
}> {
  const u = await getCurrentAdmin(req);
  if (u) return { email: u.email, role: u.role, isOwner: u.role === "owner" };
  // Legacy ADMIN_PASSWORD login: treat as implicit owner.
  return { email: "owner@local", role: "owner", isOwner: true };
}

router.get("/admin/team", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(adminUsersTable)
      .orderBy(desc(adminUsersTable.createdAt));
    res.json({ items: rows.map(sanitize) });
  } catch (err) {
    logger.error({ err }, "admin_team.list.failed");
    res.status(500).json({ error: "Failed to load team" });
  }
});

router.get("/admin/team/me", async (req: Request, res: Response) => {
  const ctx = await actorContext(req);
  res.json({ email: ctx.email, role: ctx.role, isOwner: ctx.isOwner });
});

const InviteBody = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().max(120).default(""),
  role: z.enum(["owner", "admin", "staff"]).default("staff"),
  // Re-inviting an existing active member resets their password — require
  // the caller to opt in so a typo can't silently lock someone out.
  force: z.boolean().default(false),
});

router.post("/admin/team/invite", async (req: Request, res: Response) => {
  const parsed = InviteBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const ctx = await actorContext(req);
  if (parsed.data.role === "owner" && !ctx.isOwner) {
    res.status(403).json({ error: "Only owners can invite owners" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, parsed.data.email))
      .limit(1);
    if (existing && existing.status === "active" && !parsed.data.force) {
      res.status(409).json({
        error:
          "An active member with this email already exists. Pass force=true to reset and re-invite.",
        existingId: existing.id,
      });
      return;
    }
    const token = generateInviteToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(adminUsersTable)
      .values({
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        status: "invited",
        inviteToken: token,
        inviteExpiresAt: expires,
        invitedByEmail: ctx.email,
      })
      .onConflictDoUpdate({
        target: adminUsersTable.email,
        set: {
          name: parsed.data.name,
          role: parsed.data.role,
          status: "invited",
          inviteToken: token,
          inviteExpiresAt: expires,
          invitedByEmail: ctx.email,
          passwordHash: null,
        },
      })
      .returning();
    void recordActivity({
      kind: "team_member_invited",
      actor: "admin",
      title: `Invited ${parsed.data.email} as ${parsed.data.role}`,
      summary: `Invite expires ${expires.toISOString()}`,
      entityType: "admin_user",
      entityId: String(row.id),
    });
    res.status(201).json({ user: sanitize(row), inviteToken: token });
  } catch (err) {
    logger.error({ err }, "admin_team.invite.failed");
    res.status(500).json({ error: "Failed to invite member" });
  }
});

const PatchBody = z.object({
  role: z.enum(["owner", "admin", "staff"]).optional(),
  status: z.enum(["active", "invited", "revoked"]).optional(),
  name: z.string().trim().max(120).optional(),
});

router.patch("/admin/team/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const ctx = await actorContext(req);
  try {
    const [target] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, id))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Only owners may change owner-related rows.
    if (
      (target.role === "owner" || parsed.data.role === "owner") &&
      !ctx.isOwner
    ) {
      res.status(403).json({ error: "Only owners can manage owner accounts" });
      return;
    }
    const [row] = await db
      .update(adminUsersTable)
      .set({
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      })
      .where(eq(adminUsersTable.id, id))
      .returning();
    // Status change must immediately invalidate the auth cache so a
    // suspended/revoked user can't continue calling admin endpoints with
    // their existing cookie until the cache TTL expires.
    if (parsed.data.status) invalidateAdminAuthCache(id);
    void recordActivity({
      kind: "team_member_updated",
      actor: "admin",
      title: `Updated ${row.email}`,
      summary: `role=${row.role} status=${row.status}`,
      entityType: "admin_user",
      entityId: String(row.id),
    });
    res.json(sanitize(row));
  } catch (err) {
    logger.error({ err }, "admin_team.patch.failed");
    res.status(500).json({ error: "Failed to update member" });
  }
});

router.delete("/admin/team/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const ctx = await actorContext(req);
  try {
    const [target] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, id))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (target.role === "owner" && !ctx.isOwner) {
      res.status(403).json({ error: "Only owners can revoke owners" });
      return;
    }
    // Soft-revoke: keep the row so audit history (lastSeenAt etc.) is
    // preserved, but block login by clearing password + marking revoked.
    await db
      .update(adminUsersTable)
      .set({ status: "revoked", passwordHash: null, inviteToken: null })
      .where(eq(adminUsersTable.id, id));
    invalidateAdminAuthCache(id);
    void recordActivity({
      kind: "team_member_revoked",
      actor: "admin",
      title: `Revoked ${target.email}`,
      summary: `Was ${target.role}`,
      entityType: "admin_user",
      entityId: String(id),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin_team.delete.failed");
    res.status(500).json({ error: "Failed to revoke member" });
  }
});

// ─── Public invite-acceptance ─────────────────────────────────────────────
// Mounted on a separate router below /admin/team so we can exempt it from
// requireAdmin without restructuring the file.

const acceptRouter: IRouter = Router();

const AcceptBody = z.object({
  token: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
});

acceptRouter.get(
  "/admin/team/invite/:token",
  async (req: Request, res: Response) => {
    const token = String(req.params.token ?? "");
    if (!token) {
      res.status(400).json({ error: "Invalid token" });
      return;
    }
    try {
      const [row] = await db
        .select()
        .from(adminUsersTable)
        .where(
          and(
            eq(adminUsersTable.inviteToken, token),
            eq(adminUsersTable.status, "invited"),
          ),
        )
        .limit(1);
      if (!row) {
        res.status(404).json({ error: "Invite not found or already used" });
        return;
      }
      if (row.inviteExpiresAt && row.inviteExpiresAt < new Date()) {
        res.status(410).json({ error: "Invite expired" });
        return;
      }
      res.json({
        email: row.email,
        name: row.name,
        role: row.role,
        invitedByEmail: row.invitedByEmail,
        expiresAt: row.inviteExpiresAt,
      });
    } catch (err) {
      logger.error({ err }, "admin_team.invite.peek.failed");
      res.status(500).json({ error: "Failed to load invite" });
    }
  },
);

acceptRouter.post(
  "/admin/team/accept",
  async (req: Request, res: Response) => {
    const parsed = AcceptBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }
    try {
      const [row] = await db
        .select()
        .from(adminUsersTable)
        .where(
          and(
            eq(adminUsersTable.inviteToken, parsed.data.token),
            eq(adminUsersTable.status, "invited"),
          ),
        )
        .limit(1);
      if (!row) {
        res.status(404).json({ error: "Invite not found or already used" });
        return;
      }
      if (row.inviteExpiresAt && row.inviteExpiresAt < new Date()) {
        res.status(410).json({ error: "Invite expired" });
        return;
      }
      const hash = await hashPassword(parsed.data.password);
      await db
        .update(adminUsersTable)
        .set({
          name: parsed.data.name,
          passwordHash: hash,
          status: "active",
          inviteToken: null,
          inviteExpiresAt: null,
          lastSeenAt: sql`now()`,
        })
        .where(eq(adminUsersTable.id, row.id));
      res.json({ ok: true, email: row.email });
    } catch (err) {
      logger.error({ err }, "admin_team.accept.failed");
      res.status(500).json({ error: "Failed to accept invite" });
    }
  },
);

export { acceptRouter };
export default router;
