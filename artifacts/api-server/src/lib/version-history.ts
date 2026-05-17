import { and, desc, eq, lt } from "drizzle-orm";
import {
  db,
  entityVersionsTable,
  productsTable,
  articlesTable,
  experiencesTable,
  type EntityVersionRow,
} from "./db";
import { logger } from "./logger";

export type VersionedEntity = "product" | "article" | "experience";
export type VersionAction = "create" | "update" | "delete" | "revert";

const KEEP_PER_ENTITY = 20;

export async function recordVersion(
  entityType: VersionedEntity,
  entityId: string | number,
  action: VersionAction,
  before: unknown,
  after: unknown,
): Promise<void> {
  // Best-effort: history failures must never break the underlying admin edit.
  // The route handler has already committed the entity change before calling us.
  const id = String(entityId);
  try {
    await db.insert(entityVersionsTable).values({
      entityType,
      entityId: id,
      action,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
    });
    const rows = await db
      .select({ id: entityVersionsTable.id })
      .from(entityVersionsTable)
      .where(
        and(
          eq(entityVersionsTable.entityType, entityType),
          eq(entityVersionsTable.entityId, id),
        ),
      )
      .orderBy(desc(entityVersionsTable.id));
    if (rows.length > KEEP_PER_ENTITY) {
      const cutoff = rows[KEEP_PER_ENTITY]!.id;
      await db
        .delete(entityVersionsTable)
        .where(
          and(
            eq(entityVersionsTable.entityType, entityType),
            eq(entityVersionsTable.entityId, id),
            lt(entityVersionsTable.id, cutoff + 1),
          ),
        );
    }
  } catch (err) {
    logger.error(
      { err, entityType, entityId: id, action },
      "recordVersion failed (entity change persisted; history was not)",
    );
  }
}

export async function listVersions(
  entityType: VersionedEntity,
  entityId: string,
): Promise<EntityVersionRow[]> {
  return db
    .select()
    .from(entityVersionsTable)
    .where(
      and(
        eq(entityVersionsTable.entityType, entityType),
        eq(entityVersionsTable.entityId, entityId),
      ),
    )
    .orderBy(desc(entityVersionsTable.id))
    .limit(KEEP_PER_ENTITY);
}

export async function listAllRecentVersions(limit = 100): Promise<EntityVersionRow[]> {
  return db
    .select()
    .from(entityVersionsTable)
    .orderBy(desc(entityVersionsTable.id))
    .limit(limit);
}

export async function revertToVersion(versionId: number): Promise<{
  entityType: VersionedEntity;
  entityId: string;
  outcome: "restored" | "deleted";
}> {
  const [row] = await db
    .select()
    .from(entityVersionsTable)
    .where(eq(entityVersionsTable.id, versionId))
    .limit(1);
  if (!row) throw new Error("Version not found");
  const entityType = row.entityType as VersionedEntity;
  const entityId = row.entityId;

  // Pick the rollback target by action:
  //   create → delete the entity (it didn't exist before)
  //   update → restore the captured "before" state
  //   delete → restore the captured "before" state (undo the deletion)
  //   revert → restore the captured "before" state (undo the prior revert)
  let target: unknown;
  if (row.action === "create") {
    target = null;
  } else {
    target = row.before ?? row.after ?? null;
  }

  // Snapshot the *current* live state so this revert is itself revertible.
  const currentState = await loadEntity(entityType, entityId);

  if (!target) {
    await deleteEntity(entityType, entityId);
    await recordVersion(entityType, entityId, "revert", currentState, null);
    return { entityType, entityId, outcome: "deleted" };
  }

  await upsertEntity(entityType, target as Record<string, unknown>);
  await recordVersion(entityType, entityId, "revert", currentState, target);
  return { entityType, entityId, outcome: "restored" };
}

async function loadEntity(entityType: VersionedEntity, entityId: string): Promise<unknown> {
  if (entityType === "product") {
    const [r] = await db.select().from(productsTable).where(eq(productsTable.id, entityId)).limit(1);
    return r ?? null;
  }
  if (entityType === "article") {
    const numId = Number(entityId);
    if (Number.isNaN(numId)) return null;
    const [r] = await db.select().from(articlesTable).where(eq(articlesTable.id, numId)).limit(1);
    return r ?? null;
  }
  const [r] = await db
    .select()
    .from(experiencesTable)
    .where(eq(experiencesTable.id, entityId))
    .limit(1);
  return r ?? null;
}

async function deleteEntity(entityType: VersionedEntity, entityId: string) {
  if (entityType === "product") {
    await db.delete(productsTable).where(eq(productsTable.id, entityId));
  } else if (entityType === "article") {
    const numId = Number(entityId);
    if (!Number.isNaN(numId)) {
      await db.delete(articlesTable).where(eq(articlesTable.id, numId));
    }
  } else if (entityType === "experience") {
    await db.delete(experiencesTable).where(eq(experiencesTable.id, entityId));
  }
}

async function upsertEntity(entityType: VersionedEntity, payload: Record<string, unknown>) {
  // Version blobs are stored as jsonb, so Date columns come back as ISO strings.
  // Revive them and let updatedAt be regenerated by the upsert.
  const sanitized: Record<string, unknown> = { ...payload };
  delete sanitized.updatedAt;
  if (typeof sanitized.createdAt === "string") {
    sanitized.createdAt = new Date(sanitized.createdAt);
  }
  if (entityType === "product") {
    const id = String(sanitized.id);
    const existing = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    const values = { ...sanitized, updatedAt: new Date() } as unknown as typeof productsTable.$inferInsert;
    if (existing.length) {
      await db.update(productsTable).set(values).where(eq(productsTable.id, id));
    } else {
      await db.insert(productsTable).values(values);
    }
  } else if (entityType === "article") {
    const id = Number(sanitized.id);
    const existing = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
    const values = { ...sanitized, updatedAt: new Date() } as unknown as typeof articlesTable.$inferInsert;
    if (existing.length) {
      await db.update(articlesTable).set(values).where(eq(articlesTable.id, id));
    } else {
      await db.insert(articlesTable).values(values);
    }
  } else if (entityType === "experience") {
    const id = String(sanitized.id);
    const existing = await db
      .select()
      .from(experiencesTable)
      .where(eq(experiencesTable.id, id))
      .limit(1);
    const values = { ...sanitized, updatedAt: new Date() } as unknown as typeof experiencesTable.$inferInsert;
    if (existing.length) {
      await db.update(experiencesTable).set(values).where(eq(experiencesTable.id, id));
    } else {
      await db.insert(experiencesTable).values(values);
    }
  }
}
