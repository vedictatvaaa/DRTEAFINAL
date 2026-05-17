import {
  db,
  adminActivityLogTable,
  type ActivityKind,
  type ActivityActor,
} from "./db";
import { logger } from "./logger";

export interface RecordActivityInput {
  kind: ActivityKind;
  actor?: ActivityActor;
  title: string;
  summary?: string;
  entityType?: string | null;
  entityId?: string | number | null;
  payload?: Record<string, unknown>;
}

/**
 * Persist a single admin activity row. Best-effort: every write site that
 * calls this is the *primary* mutation, so we never let a logging failure
 * break the user-facing operation. Audit consistency for high-stakes
 * actions (e.g. co-pilot agent execution) is enforced at the call site
 * with stronger guarantees — this helper is for the lighter-weight
 * "someone edited a product" feed.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    await db.insert(adminActivityLogTable).values({
      kind: input.kind,
      actor: input.actor ?? "admin",
      title: input.title.slice(0, 140),
      summary: (input.summary ?? "").slice(0, 500),
      entityType: input.entityType ?? null,
      entityId:
        input.entityId === null || input.entityId === undefined
          ? null
          : String(input.entityId),
      payload: input.payload ?? {},
    });
  } catch (err) {
    // Never throw — logging is observational. The mutation already happened.
    logger.warn({ err, kind: input.kind }, "activity_log.insert_failed");
  }
}
