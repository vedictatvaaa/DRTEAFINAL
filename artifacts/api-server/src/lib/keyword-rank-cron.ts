import {
  db,
  keywordsTable,
  keywordRanksTable,
  keywordRankProviderTable,
} from "./db";
import { eq, desc, and, gte } from "drizzle-orm";
import { chatCompletionJSON } from "./openaiText";
import { logger } from "./logger";

const TARGET_DOMAIN = process.env["PUBLIC_SITE_DOMAIN"] ?? "drtea";

// ──────────────────────────────────────────────────────────────────────────
// Provider registry — each adapter knows its own env var, free-tier link,
// and how to query its API. Adding a new provider = one entry.
// ──────────────────────────────────────────────────────────────────────────

export type ProviderId = "serpapi" | "serper" | "searchapi" | "valueserp";
export const PROVIDER_IDS: readonly ProviderId[] = [
  "serpapi",
  "serper",
  "searchapi",
  "valueserp",
] as const;

interface SerpResult {
  position: number | null;
  url: string;
}

interface ProviderAdapter {
  id: ProviderId;
  label: string;
  envKey: string;
  signupUrl: string;
  freeTierNote: string;
  query(term: string, market: string, apiKey: string): Promise<SerpResult>;
}

function pickHit(
  organic: Array<{ position?: number; link?: string }>,
): SerpResult {
  const hit = organic.find(
    (r) => typeof r.link === "string" && r.link.toLowerCase().includes(TARGET_DOMAIN.toLowerCase()),
  );
  if (!hit) return { position: null, url: "" };
  return { position: hit.position ?? null, url: hit.link ?? "" };
}

const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  serpapi: {
    id: "serpapi",
    label: "SerpAPI",
    envKey: "SERPAPI_KEY",
    signupUrl: "https://serpapi.com/users/sign_up",
    freeTierNote: "100 searches/month free",
    async query(term, market, apiKey) {
      const params = new URLSearchParams({
        engine: "google",
        q: term,
        gl: market.toLowerCase(),
        num: "20",
        api_key: apiKey,
      });
      const res = await fetch(`https://serpapi.com/search?${params.toString()}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { position: null, url: "" };
      const json = (await res.json()) as { organic_results?: Array<{ position?: number; link?: string }> };
      return pickHit(json.organic_results ?? []);
    },
  },
  serper: {
    id: "serper",
    label: "Serper.dev",
    envKey: "SERPER_API_KEY",
    signupUrl: "https://serper.dev/signup",
    freeTierNote: "2,500 free searches on signup",
    async query(term, market, apiKey) {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: term, gl: market.toLowerCase(), num: 20 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { position: null, url: "" };
      const json = (await res.json()) as { organic?: Array<{ position?: number; link?: string }> };
      return pickHit(json.organic ?? []);
    },
  },
  searchapi: {
    id: "searchapi",
    label: "SearchAPI.io",
    envKey: "SEARCHAPI_API_KEY",
    signupUrl: "https://www.searchapi.io/",
    freeTierNote: "100 searches/month free",
    async query(term, market, apiKey) {
      const params = new URLSearchParams({
        engine: "google",
        q: term,
        gl: market.toLowerCase(),
        num: "20",
        api_key: apiKey,
      });
      const res = await fetch(`https://www.searchapi.io/api/v1/search?${params.toString()}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { position: null, url: "" };
      const json = (await res.json()) as { organic_results?: Array<{ position?: number; link?: string }> };
      return pickHit(json.organic_results ?? []);
    },
  },
  valueserp: {
    id: "valueserp",
    label: "ValueSERP",
    envKey: "VALUESERP_API_KEY",
    signupUrl: "https://app.valueserp.com/signup",
    freeTierNote: "100 searches/month free",
    async query(term, market, apiKey) {
      const params = new URLSearchParams({
        api_key: apiKey,
        q: term,
        gl: market.toLowerCase(),
        num: "20",
      });
      const res = await fetch(`https://api.valueserp.com/search?${params.toString()}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { position: null, url: "" };
      const json = (await res.json()) as { organic_results?: Array<{ position?: number; link?: string }> };
      return pickHit(json.organic_results ?? []);
    },
  },
};

/** Public catalog used by the admin status endpoint. Never leaks key values. */
export function listProviders(): Array<{
  id: ProviderId;
  label: string;
  envKey: string;
  signupUrl: string;
  freeTierNote: string;
  configured: boolean;
}> {
  return PROVIDER_IDS.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    envKey: PROVIDERS[id].envKey,
    signupUrl: PROVIDERS[id].signupUrl,
    freeTierNote: PROVIDERS[id].freeTierNote,
    configured: !!process.env[PROVIDERS[id].envKey],
  }));
}

/** Reads the singleton provider row, creating it on first read. */
export async function getActiveProvider(): Promise<ProviderId> {
  const [row] = await db.select().from(keywordRankProviderTable).limit(1);
  if (row && PROVIDER_IDS.includes(row.provider as ProviderId)) {
    return row.provider as ProviderId;
  }
  // Seed default row.
  const [seeded] = await db
    .insert(keywordRankProviderTable)
    .values({ provider: "serpapi" })
    .returning();
  return (seeded?.provider ?? "serpapi") as ProviderId;
}

export async function setActiveProvider(provider: ProviderId): Promise<void> {
  // Upsert via "delete + insert" on a singleton — simpler than a real upsert
  // since we always want exactly one row.
  await db.delete(keywordRankProviderTable);
  await db.insert(keywordRankProviderTable).values({ provider, updatedAt: new Date() });
}

async function querySerp(term: string, market: string, provider: ProviderId): Promise<SerpResult> {
  const adapter = PROVIDERS[provider];
  const apiKey = process.env[adapter.envKey];
  if (!apiKey) {
    // Shadow mode — record the check but with no position.
    return { position: null, url: "" };
  }
  try {
    return await adapter.query(term, market, apiKey);
  } catch (err) {
    logger.warn({ err, term, provider }, "SERP query failed");
    return { position: null, url: "" };
  }
}

export async function refreshKeywordRanks(): Promise<{
  checked: number;
  tracked: number;
  source: "shadow" | ProviderId;
}> {
  const provider = await getActiveProvider();
  const apiKey = process.env[PROVIDERS[provider].envKey];
  const source = apiKey ? provider : "shadow";
  const terms = await db.select().from(keywordsTable);
  let tracked = 0;
  for (const k of terms) {
    const r = await querySerp(k.term, k.market, provider);
    await db.insert(keywordRanksTable).values({
      keywordId: k.id,
      position: r.position,
      url: r.url,
      source,
    });
    if (r.position != null) tracked++;
  }
  return { checked: terms.length, tracked, source };
}

export async function summarizeKeywordMovement(): Promise<{ updated: number }> {
  const terms = await db.select().from(keywordsTable);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let updated = 0;
  for (const k of terms) {
    const recent = await db
      .select()
      .from(keywordRanksTable)
      .where(and(eq(keywordRanksTable.keywordId, k.id), gte(keywordRanksTable.checkedAt, since)))
      .orderBy(desc(keywordRanksTable.checkedAt))
      .limit(7);
    if (!recent.length) continue;
    const series = recent.map((r) => `${r.checkedAt.toISOString().slice(0, 10)}: ${r.position ?? "—"}`).join(", ");
    const out = await chatCompletionJSON<{ summary?: string }>({
      systemPrompt: "You are a concise SEO analyst for the Dr Tea brand. 1-2 sentences max.",
      userPrompt: `Term: ${k.term}\nRecent positions (newest first): ${series}\nReturn JSON {summary} explaining the trend in plain English.`,
      maxTokens: 200,
      timeoutMs: 30_000,
    });
    const summary = (out?.summary ?? "").trim();
    if (summary) {
      await db
        .update(keywordsTable)
        .set({ lastSummary: summary, lastSummaryAt: new Date() })
        .where(eq(keywordsTable.id, k.id));
      updated++;
    }
  }
  return { updated };
}

/**
 * Compact movement digest fed into the campaign orchestrator prompt so
 * AI suggestions are grounded in the latest organic-search trend.
 */
export async function getKeywordDigest(limit = 12): Promise<Array<{ term: string; summary: string }>> {
  const rows = await db.select().from(keywordsTable);
  const out: Array<{ term: string; summary: string }> = [];
  for (const k of rows) {
    if (k.lastSummary) out.push({ term: k.term, summary: k.lastSummary });
    if (out.length >= limit) break;
  }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startKeywordRankCron(): void {
  const tick = async () => {
    try {
      const r = await refreshKeywordRanks();
      logger.info(r, "Keyword rank cron tick");
      // Once a day is enough; weekly summaries on Sundays.
      if (new Date().getDay() === 0) {
        const s = await summarizeKeywordMovement();
        logger.info(s, "Keyword weekly summary");
      }
    } catch (err) {
      logger.error({ err }, "Keyword rank cron failed");
    }
  };
  setInterval(tick, DAY_MS).unref();
  // Defer first run to avoid spiking startup.
  setTimeout(() => void tick(), 60_000).unref();
}
