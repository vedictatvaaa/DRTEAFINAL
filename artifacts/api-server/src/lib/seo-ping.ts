import { db, seoPingsTable, type SeoPingRow } from "./db";
import { desc } from "drizzle-orm";
import { siteUrl } from "./seo-site";
import { logger } from "./logger";

export const PING_TARGETS = ["google", "bing"] as const;
export type PingTarget = (typeof PING_TARGETS)[number];

function pingUrl(target: PingTarget, sitemap: string): string {
  const encoded = encodeURIComponent(sitemap);
  return target === "google"
    ? `https://www.google.com/ping?sitemap=${encoded}`
    : `https://www.bing.com/ping?sitemap=${encoded}`;
}

export async function pingSearchEngines(opts: {
  trigger?: "auto" | "manual";
  sitemapUrl?: string;
} = {}): Promise<SeoPingRow[]> {
  const trigger = opts.trigger ?? "auto";
  const sitemapUrl = opts.sitemapUrl ?? siteUrl("/sitemap.xml");
  const rows: SeoPingRow[] = [];
  for (const target of PING_TARGETS) {
    const row = await pingOne(target, sitemapUrl, trigger);
    rows.push(row);
  }
  return rows;
}

async function pingOne(
  target: PingTarget,
  sitemapUrl: string,
  trigger: string,
): Promise<SeoPingRow> {
  const url = pingUrl(target, sitemapUrl);
  let status: "success" | "failed" = "failed";
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    });
    statusCode = res.status;
    status = res.ok ? "success" : "failed";
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  try {
    const [row] = await db
      .insert(seoPingsTable)
      .values({ target, sitemapUrl, status, statusCode, error, trigger })
      .returning();
    return row!;
  } catch (err) {
    logger.error({ err }, "Failed to record SEO ping");
    return {
      id: 0,
      target,
      sitemapUrl,
      status,
      statusCode,
      error,
      trigger,
      createdAt: new Date(),
    } as SeoPingRow;
  }
}

let pingDebounce: NodeJS.Timeout | null = null;
/**
 * Debounced auto-ping triggered from catalog writes. Coalesces bursts of
 * edits into a single ping per ~30 s window.
 */
export function schedulePing(): void {
  if (pingDebounce) clearTimeout(pingDebounce);
  pingDebounce = setTimeout(() => {
    pingDebounce = null;
    void pingSearchEngines({ trigger: "auto" }).catch((err) =>
      logger.error({ err }, "Scheduled SEO ping failed"),
    );
  }, 30_000);
  pingDebounce.unref?.();
}

export async function listPings(limit = 50): Promise<SeoPingRow[]> {
  return db.select().from(seoPingsTable).orderBy(desc(seoPingsTable.createdAt)).limit(limit);
}
