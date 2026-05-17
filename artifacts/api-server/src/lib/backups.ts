import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  productsTable,
  articlesTable,
  ordersTable,
  orderItemsTable,
  experiencesTable,
  snapshotsTable,
  entityVersionsTable,
  type SnapshotRow,
} from "./db";
import { objectStorageClient, ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const SNAPSHOT_VERSION = 1;
const RETENTION_COUNT = 14;
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

type MediaEntry = { publicUrl: string; bucket: string; objectName: string };

type SnapshotPayload = {
  version: number;
  createdAt: string;
  rows: {
    products: unknown[];
    articles: unknown[];
    orders: unknown[];
    orderItems: unknown[];
    experiences: unknown[];
  };
  media: { items: MediaEntry[] };
};

// Strict structural validator for incoming snapshot payloads. We don't try to
// re-validate every column shape (the DB will reject malformed inserts) but we
// guarantee the top-level structure matches what restoreSnapshot expects so
// malformed/foreign payloads fail fast with a clear 400 instead of a generic
// 500 partway through the transaction.
const SnapshotPayloadSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  createdAt: z.string(),
  rows: z.object({
    products: z.array(z.record(z.string(), z.unknown())),
    articles: z.array(z.record(z.string(), z.unknown())),
    orders: z.array(z.record(z.string(), z.unknown())),
    orderItems: z.array(z.record(z.string(), z.unknown())),
    experiences: z.array(z.record(z.string(), z.unknown())),
  }),
  media: z.object({
    items: z.array(
      z.object({
        publicUrl: z.string(),
        bucket: z.string(),
        objectName: z.string(),
      }),
    ),
  }),
});

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotValidationError";
  }
}

const MEDIA_PATH_RE = /\/api\/storage\/(public-objects|objects)\/([A-Za-z0-9_\-./]+)/g;

function toMediaEntry(
  url: string,
  match: RegExpMatchArray,
  privateBucket: string,
  privatePrefix: string,
  publicSearchPaths: string[],
): MediaEntry | null {
  const kind = match[1] ?? "";
  const tail = (match[2] ?? "").replace(/\/+$/, "");
  if (!tail) return null;
  if (kind === "objects") {
    // Private object — `tail` is "<privatePrefix>/<id>" (or just "<id>")
    const objectName = `${privatePrefix ? `${privatePrefix}/` : ""}${tail}`;
    return { publicUrl: url, bucket: privateBucket, objectName };
  }
  // Public object — first segment is the named search path; resolve to bucket+name
  const [head, ...rest] = tail.split("/");
  const restPath = rest.join("/");
  const searchRoot = publicSearchPaths.find((p) => p.endsWith(`/${head}`)) ?? publicSearchPaths[0];
  if (!searchRoot) return null;
  const trimmed = searchRoot.replace(/^\/+/, "").replace(/\/+$/, "");
  const slash = trimmed.indexOf("/");
  if (slash === -1) return null;
  const bucket = trimmed.slice(0, slash);
  const prefix = trimmed.slice(slash + 1);
  const objectName = `${prefix ? `${prefix}/` : ""}${restPath}`;
  return { publicUrl: url, bucket, objectName };
}

function collectMediaItems(...sources: unknown[]): MediaEntry[] {
  const { bucketName: privateBucket, prefix: privatePrefix } = parseBucketAndPrefix();
  const publicSearchPaths = (process.env["PUBLIC_OBJECT_SEARCH_PATHS"] ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Map<string, MediaEntry>();
  const visit = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") {
      for (const m of v.matchAll(MEDIA_PATH_RE)) {
        const url = m[0];
        if (seen.has(url)) continue;
        const entry = toMediaEntry(url, m, privateBucket, privatePrefix, publicSearchPaths);
        if (entry) seen.set(url, entry);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (typeof v === "object") {
      for (const value of Object.values(v as Record<string, unknown>)) visit(value);
    }
  };
  for (const src of sources) visit(src);
  return Array.from(seen.values()).sort((a, b) => a.publicUrl.localeCompare(b.publicUrl));
}

function parseBucketAndPrefix(): { bucketName: string; prefix: string } {
  const svc = new ObjectStorageService();
  const dir = svc.getPrivateObjectDir();
  const parts = dir.replace(/^\/+/, "").split("/").filter(Boolean);
  const bucketName = parts.shift() as string;
  const prefix = parts.join("/");
  return { bucketName, prefix };
}

async function loadSnapshotPayload(): Promise<{ payload: SnapshotPayload; rowCounts: Record<string, number> }> {
  const [products, articles, orders, orderItems, experiences] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(articlesTable),
    db.select().from(ordersTable),
    db.select().from(orderItemsTable),
    db.select().from(experiencesTable),
  ]);
  const mediaItems = collectMediaItems(products, articles, experiences);
  const payload: SnapshotPayload = {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    rows: { products, articles, orders, orderItems, experiences },
    media: { items: mediaItems },
  };
  const rowCounts = {
    products: products.length,
    articles: articles.length,
    orders: orders.length,
    orderItems: orderItems.length,
    experiences: experiences.length,
    media: mediaItems.length,
  };
  return { payload, rowCounts };
}

export async function createSnapshot(kind: "daily" | "manual" = "manual"): Promise<SnapshotRow> {
  const id = randomUUID();
  const { bucketName, prefix } = parseBucketAndPrefix();
  const objectName = `${prefix ? `${prefix}/` : ""}backups/snapshot-${id}.json`;
  const objectKey = `/${bucketName}/${objectName}`;

  try {
    const { payload, rowCounts } = await loadSnapshotPayload();
    const buf = Buffer.from(JSON.stringify(payload));
    await objectStorageClient
      .bucket(bucketName)
      .file(objectName)
      .save(buf, { contentType: "application/json", resumable: false });

    const [row] = await db
      .insert(snapshotsTable)
      .values({
        id,
        kind,
        objectKey,
        sizeBytes: buf.byteLength,
        rowCounts,
        status: "ready",
      })
      .returning();
    await pruneOldSnapshots();
    return row!;
  } catch (err) {
    logger.error({ err }, "Snapshot creation failed");
    const [row] = await db
      .insert(snapshotsTable)
      .values({
        id,
        kind,
        objectKey,
        sizeBytes: 0,
        rowCounts: {},
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .returning();
    return row!;
  }
}

export async function pruneOldSnapshots(): Promise<void> {
  const all = await db
    .select()
    .from(snapshotsTable)
    .orderBy(desc(snapshotsTable.createdAt));
  // Retain the last RETENTION_COUNT *daily* snapshots independently of manual
  // ones — frequent on-demand backups must not evict the daily history.
  const dailyReady = all.filter((s) => s.status === "ready" && s.kind === "daily");
  const staleDaily = dailyReady.slice(RETENTION_COUNT);
  const failed = all.filter((s) => s.status === "failed").slice(20);
  const toDrop = [...staleDaily, ...failed];

  for (const snap of toDrop) {
    try {
      await deleteSnapshotObject(snap.objectKey);
    } catch (err) {
      logger.warn({ err, id: snap.id }, "Failed to delete snapshot object");
    }
    await db.delete(snapshotsTable).where(eq(snapshotsTable.id, snap.id));
  }
}

async function deleteSnapshotObject(objectKey: string): Promise<void> {
  const trimmed = objectKey.replace(/^\/+/, "");
  const slash = trimmed.indexOf("/");
  if (slash === -1) return;
  const bucketName = trimmed.slice(0, slash);
  const objectName = trimmed.slice(slash + 1);
  await objectStorageClient
    .bucket(bucketName)
    .file(objectName)
    .delete({ ignoreNotFound: true });
}

export async function restoreSnapshot(id: string): Promise<{
  restored: Record<string, number>;
  snapshotId: string;
}> {
  const [snap] = await db
    .select()
    .from(snapshotsTable)
    .where(eq(snapshotsTable.id, id))
    .limit(1);
  if (!snap) throw new Error("Snapshot not found");
  if (snap.status !== "ready") throw new Error("Snapshot is not ready to restore");

  const trimmed = snap.objectKey.replace(/^\/+/, "");
  const slash = trimmed.indexOf("/");
  const bucketName = trimmed.slice(0, slash);
  const objectName = trimmed.slice(slash + 1);
  const [buf] = await objectStorageClient.bucket(bucketName).file(objectName).download();
  let raw: unknown;
  try {
    raw = JSON.parse(buf.toString("utf8"));
  } catch {
    throw new SnapshotValidationError("Snapshot payload is not valid JSON");
  }
  const validated = SnapshotPayloadSchema.safeParse(raw);
  if (!validated.success) {
    throw new SnapshotValidationError(
      `Snapshot payload failed schema validation: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const payload = validated.data as SnapshotPayload;
  // JSON.stringify converted Date columns to ISO strings; revive them so
  // node-postgres binds them as timestamps rather than text.
  const DATE_FIELDS = ["createdAt", "updatedAt"] as const;
  const reviveDates = <T extends Record<string, unknown>>(rows: T[]): T[] =>
    rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const f of DATE_FIELDS) {
        const v = out[f];
        if (typeof v === "string") out[f] = new Date(v);
      }
      return out as T;
    });
  payload.rows.products = reviveDates(payload.rows.products as Record<string, unknown>[]);
  payload.rows.articles = reviveDates(payload.rows.articles as Record<string, unknown>[]);
  payload.rows.orders = reviveDates(payload.rows.orders as Record<string, unknown>[]);
  payload.rows.experiences = reviveDates(payload.rows.experiences as Record<string, unknown>[]);

  const restored: Record<string, number> = {};
  await db.transaction(async (tx) => {
    // Order matters: dependents first, then parents — orderItems references orders, so
    // delete orderItems before orders, then re-insert orders before orderItems.
    await tx.delete(entityVersionsTable);
    await tx.delete(orderItemsTable);
    await tx.delete(ordersTable);
    await tx.delete(productsTable);
    await tx.delete(articlesTable);
    await tx.delete(experiencesTable);

    if (payload.rows.products.length) {
      await tx.insert(productsTable).values(payload.rows.products as never);
    }
    if (payload.rows.articles.length) {
      await tx.insert(articlesTable).values(payload.rows.articles as never);
    }
    if (payload.rows.experiences.length) {
      await tx.insert(experiencesTable).values(payload.rows.experiences as never);
    }
    if (payload.rows.orders.length) {
      await tx.insert(ordersTable).values(payload.rows.orders as never);
    }
    if (payload.rows.orderItems.length) {
      await tx.insert(orderItemsTable).values(payload.rows.orderItems as never);
    }
    if (payload.rows.orders.length) {
      const maxId = Math.max(
        0,
        ...(payload.rows.orders as Array<{ id: number }>).map((o) => o.id),
      );
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('orders','id'), ${maxId})`));
    }
    if (payload.rows.orderItems.length) {
      const maxId = Math.max(
        0,
        ...(payload.rows.orderItems as Array<{ id: number }>).map((i) => i.id),
      );
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('order_items','id'), ${maxId})`));
    }
    if (payload.rows.articles.length) {
      const maxId = Math.max(
        0,
        ...(payload.rows.articles as Array<{ id: number }>).map((a) => a.id),
      );
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('articles','id'), ${maxId})`));
    }

    restored.products = payload.rows.products.length;
    restored.articles = payload.rows.articles.length;
    restored.orders = payload.rows.orders.length;
    restored.orderItems = payload.rows.orderItems.length;
    restored.experiences = payload.rows.experiences.length;
  });

  return { restored, snapshotId: snap.id };
}

export async function listSnapshots(
  kind?: "daily" | "manual",
): Promise<SnapshotRow[]> {
  const base = db.select().from(snapshotsTable);
  if (kind === "daily") {
    // Daily view shows the (up to) 14 retained successful daily snapshots —
    // failed attempts are excluded so the count matches the retention promise.
    return base
      .where(and(eq(snapshotsTable.kind, "daily"), eq(snapshotsTable.status, "ready")))
      .orderBy(desc(snapshotsTable.createdAt))
      .limit(RETENTION_COUNT);
  }
  if (kind === "manual") {
    return base
      .where(eq(snapshotsTable.kind, "manual"))
      .orderBy(desc(snapshotsTable.createdAt));
  }
  return base.orderBy(desc(snapshotsTable.createdAt));
}

let cronStarted = false;
export function startBackupCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  void (async () => {
    try {
      // Only the most recent *successful daily* snapshot counts toward the
      // 24h cadence. Manual snapshots (no matter how recent) must not delay
      // a daily catch-up after restart.
      const recent = await db
        .select()
        .from(snapshotsTable)
        .where(and(eq(snapshotsTable.kind, "daily"), eq(snapshotsTable.status, "ready")))
        .orderBy(desc(snapshotsTable.createdAt))
        .limit(1);
      const last = recent[0];
      const dueNow =
        !last || Date.now() - new Date(last.createdAt).getTime() >= DAILY_INTERVAL_MS;
      if (dueNow) {
        logger.info("Starting initial daily snapshot");
        await createSnapshot("daily");
      }
    } catch (err) {
      logger.error({ err }, "Initial backup check failed");
    }
  })();

  setInterval(() => {
    void (async () => {
      try {
        await createSnapshot("daily");
      } catch (err) {
        logger.error({ err }, "Scheduled daily snapshot failed");
      }
    })();
  }, DAILY_INTERVAL_MS).unref();
}
