import { eq } from "drizzle-orm";
import { db, trendConfigTable } from "./db";

/**
 * Social-posting configuration, stored as a single JSON row in trend_config
 * (reusing the same key/value bag as the trend pipeline).
 */
export type SocialChannel = "x" | "bluesky" | "threads";
export const ALL_SOCIAL_CHANNELS: SocialChannel[] = ["x", "bluesky", "threads"];

export interface SocialConfig {
  /** Master enable for the tweet generator + posting cron. */
  enabled: boolean;
  /** If true, generated drafts go straight to status='approved' (auto-post). */
  autoApprove: boolean;
  /** Hard cap on posts (per channel) in any rolling 24h window. */
  dailyPostCap: number;
  /** Max queued (draft+approved) per channel before generator stops producing. */
  maxQueue: number;
  /** Minimum minutes between posts on a given channel (anti-spam pacing). */
  minDelayMinutes: number;
  /** "Quiet hours" — server-local hours when posting is paused (24h, e.g. [0,1,2,3,4,5]). */
  quietHours: number[];
  /** Which networks to fan out generated content to. */
  enabledChannels: SocialChannel[];
}

export const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  enabled: true,
  autoApprove: false,
  dailyPostCap: 12,
  maxQueue: 30,
  minDelayMinutes: 75,
  quietHours: [1, 2, 3, 4, 5],
  enabledChannels: ["x"],
};

const KEY = "social_x";

export async function getSocialConfig(): Promise<SocialConfig> {
  try {
    const [row] = await db
      .select()
      .from(trendConfigTable)
      .where(eq(trendConfigTable.key, KEY))
      .limit(1);
    if (!row) return DEFAULT_SOCIAL_CONFIG;
    const merged = { ...DEFAULT_SOCIAL_CONFIG, ...(row.value as Partial<SocialConfig>) };
    // Defensive: filter to known channels in case an old config has stale values.
    merged.enabledChannels = (merged.enabledChannels ?? ["x"]).filter((c) =>
      ALL_SOCIAL_CHANNELS.includes(c),
    );
    if (merged.enabledChannels.length === 0) merged.enabledChannels = ["x"];
    return merged;
  } catch {
    return DEFAULT_SOCIAL_CONFIG;
  }
}

export async function setSocialConfig(patch: Partial<SocialConfig>): Promise<SocialConfig> {
  const next = { ...(await getSocialConfig()), ...patch };
  await db
    .insert(trendConfigTable)
    .values({ key: KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: trendConfigTable.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}
