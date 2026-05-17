import { db, paymentSettingsTable, type PaymentSettingsRow } from "@workspace/db";
import { isValidProviderKey, type ProviderKey } from "./index";

let cache: PaymentSettingsRow | null = null;
let cacheAt = 0;
const TTL_MS = 5_000;

export async function getSettings(): Promise<PaymentSettingsRow> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;
  const rows = await db.select().from(paymentSettingsTable).limit(1);
  if (rows.length > 0) {
    cache = rows[0];
    cacheAt = now;
    return cache;
  }
  // Bootstrap a default row on first read so the rest of the app can rely
  // on it existing.
  const [created] = await db
    .insert(paymentSettingsTable)
    .values({ activeProvider: "razorpay", codEnabled: true })
    .returning();
  cache = created;
  cacheAt = now;
  return cache;
}

export async function updateSettings(patch: {
  activeProvider?: ProviderKey;
  codEnabled?: boolean;
  codLabel?: string;
  paidLabel?: string;
}): Promise<PaymentSettingsRow> {
  const current = await getSettings();
  if (patch.activeProvider !== undefined && !isValidProviderKey(patch.activeProvider)) {
    throw new Error("Invalid provider");
  }
  const [updated] = await db
    .update(paymentSettingsTable)
    .set({
      activeProvider: patch.activeProvider ?? current.activeProvider,
      codEnabled: patch.codEnabled ?? current.codEnabled,
      codLabel: patch.codLabel ?? current.codLabel,
      paidLabel: patch.paidLabel ?? current.paidLabel,
      updatedAt: new Date(),
    })
    .returning();
  cache = updated;
  cacheAt = Date.now();
  return updated;
}

export function bustCache(): void {
  cache = null;
  cacheAt = 0;
}
