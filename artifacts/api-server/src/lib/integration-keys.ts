import { eq } from "drizzle-orm";
import { db, integrationCredentialsTable } from "./db";
import { logger } from "./logger";

/**
 * Centralised resolver for third-party API keys. Order of precedence:
 *   1. value in `integration_credentials` table (admin UI)
 *   2. process.env (Replit Secrets / shell)
 *   3. empty string
 *
 * In-memory cache, invalidated on setKey/clearKey, so hot-path callers
 * (X auth signing, every cron tick) don't pay a DB round-trip.
 */

export type IntegrationGroup =
  | "x"
  | "bluesky"
  | "threads"
  | "youtube"
  | "serpapi"
  | "email"
  | "push"
  | "shiprocket";

export interface IntegrationKeyMeta {
  key: string;
  group: IntegrationGroup;
  label: string;
  /** True for high-sensitivity values; values are always masked on read either way. */
  secret: boolean;
  /** Short helper text for the admin UI. */
  hint?: string;
}

export const INTEGRATION_KEYS: IntegrationKeyMeta[] = [
  // X / Twitter
  { key: "X_API_KEY", group: "x", label: "API Key", secret: true, hint: "Consumer key from developer.x.com" },
  { key: "X_API_SECRET", group: "x", label: "API Secret", secret: true },
  { key: "X_ACCESS_TOKEN", group: "x", label: "Access Token", secret: true, hint: "User-context token (OAuth 1.0a)" },
  { key: "X_ACCESS_TOKEN_SECRET", group: "x", label: "Access Token Secret", secret: true },
  // Bluesky (AT Protocol)
  { key: "BLUESKY_HANDLE", group: "bluesky", label: "Handle", secret: false, hint: "e.g. drteawellness.bsky.social" },
  { key: "BLUESKY_APP_PASSWORD", group: "bluesky", label: "App Password", secret: true, hint: "Generate at bsky.app → Settings → App passwords (NOT your main password)" },
  // Threads (Meta)
  { key: "THREADS_USER_ID", group: "threads", label: "User ID", secret: false, hint: "Numeric Threads user id from Graph API Explorer" },
  { key: "THREADS_ACCESS_TOKEN", group: "threads", label: "Access Token", secret: true, hint: "Long-lived (60d) token from developers.facebook.com" },
  // YouTube
  { key: "YOUTUBE_API_KEY", group: "youtube", label: "API Key", secret: true, hint: "Optional — enables the YouTube trend adapter" },
  // SerpAPI (scaffolded, off by default)
  { key: "SERPAPI_KEY", group: "serpapi", label: "API Key", secret: true, hint: "Optional — enables the SerpAPI trend adapter" },
  // Email (Resend)
  { key: "RESEND_API_KEY", group: "email", label: "Resend API Key", secret: true },
  { key: "EMAIL_FROM", group: "email", label: "From address", secret: false, hint: "e.g. hello@drtea.shop" },
  // Web push (VAPID)
  { key: "VAPID_PUBLIC_KEY", group: "push", label: "VAPID Public Key", secret: false },
  { key: "VAPID_PRIVATE_KEY", group: "push", label: "VAPID Private Key", secret: true },
  { key: "VAPID_SUBJECT", group: "push", label: "VAPID Subject", secret: false, hint: "mailto: address" },
  // Shiprocket
  { key: "SHIPROCKET_EMAIL", group: "shiprocket", label: "Account Email", secret: false },
  { key: "SHIPROCKET_PASSWORD", group: "shiprocket", label: "Password", secret: true },
  { key: "SHIPROCKET_WEBHOOK_TOKEN", group: "shiprocket", label: "Webhook Token", secret: true },
];

const KNOWN = new Set(INTEGRATION_KEYS.map((k) => k.key));

const cache = new Map<string, string>();
let primed = false;

async function prime(): Promise<void> {
  if (primed) return;
  try {
    const rows = await db.select().from(integrationCredentialsTable);
    for (const r of rows) {
      if (r.value) cache.set(r.key, r.value);
    }
  } catch (err) {
    logger.warn({ err }, "Integration credential cache prime failed");
  }
  primed = true;
}

/** Resolve a key from DB cache or process.env. Returns "" if neither set. */
export async function getIntegrationKey(name: string): Promise<string> {
  await prime();
  return cache.get(name) || process.env[name] || "";
}

export async function getIntegrationKeySync(name: string): Promise<string> {
  return getIntegrationKey(name);
}

/** Persist a key to DB and update the cache. Empty value clears it. */
export async function setIntegrationKey(name: string, value: string): Promise<void> {
  if (!KNOWN.has(name)) throw new Error(`Unknown integration key: ${name}`);
  const v = value.trim();
  await prime();
  if (!v) {
    await db.delete(integrationCredentialsTable).where(eq(integrationCredentialsTable.key, name));
    cache.delete(name);
    return;
  }
  await db
    .insert(integrationCredentialsTable)
    .values({ key: name, value: v, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: integrationCredentialsTable.key,
      set: { value: v, updatedAt: new Date() },
    });
  cache.set(name, v);
}

export async function clearIntegrationKey(name: string): Promise<void> {
  return setIntegrationKey(name, "");
}

/** Mask a value for safe display: show last 4 chars only. */
export function maskValue(v: string): string {
  if (!v) return "";
  if (v.length <= 4) return "•".repeat(v.length);
  return "•".repeat(Math.min(8, v.length - 4)) + v.slice(-4);
}

export interface IntegrationKeyStatus extends IntegrationKeyMeta {
  set: boolean;
  /** "db" | "env" | "" — where the value comes from. */
  source: "db" | "env" | "";
  preview: string;
  updatedAt: string | null;
}

/** Build the masked, source-annotated list for the admin UI. */
export async function listIntegrationStatus(): Promise<IntegrationKeyStatus[]> {
  await prime();
  let dbRows: Array<{ key: string; updatedAt: Date }> = [];
  try {
    dbRows = await db
      .select({ key: integrationCredentialsTable.key, updatedAt: integrationCredentialsTable.updatedAt })
      .from(integrationCredentialsTable);
  } catch {
    /* table may not exist before push */
  }
  const dbStamp = new Map(dbRows.map((r) => [r.key, r.updatedAt]));
  return INTEGRATION_KEYS.map((meta) => {
    const dbVal = cache.get(meta.key) || "";
    const envVal = process.env[meta.key] || "";
    const value = dbVal || envVal;
    const source: "db" | "env" | "" = dbVal ? "db" : envVal ? "env" : "";
    return {
      ...meta,
      set: Boolean(value),
      source,
      preview: meta.secret ? maskValue(value) : value,
      updatedAt: dbStamp.get(meta.key)?.toISOString() ?? null,
    };
  });
}
