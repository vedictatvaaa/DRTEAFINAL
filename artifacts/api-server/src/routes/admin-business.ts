// Admin endpoints for the seller's business / GST profile.
// All fields are optional and stored in a singleton row (id=1) so the
// admin UI is one form. Used by every document generator.

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, businessSettingsTable, type BusinessSettingsRow } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin/business-settings", requireAdmin);

// Lazy-initialise the singleton row so the API works even before the
// admin has visited the page once.
async function ensureSingleton(): Promise<BusinessSettingsRow> {
  const [row] = await db
    .select()
    .from(businessSettingsTable)
    .where(eq(businessSettingsTable.id, 1))
    .limit(1);
  if (row) return row;
  const [created] = await db
    .insert(businessSettingsTable)
    .values({ id: 1 })
    .returning();
  return created;
}

router.get("/admin/business-settings", async (_req, res: Response) => {
  try {
    const row = await ensureSingleton();
    res.json({ settings: row });
  } catch (err) {
    logger.error({ err }, "business.get_failed");
    res.status(500).json({ error: "Failed to load business settings" });
  }
});

const AddressSchema = z
  .object({
    line1: z.string().trim().max(200).optional().nullable(),
    line2: z.string().trim().max(200).optional().nullable(),
    city: z.string().trim().max(80).optional().nullable(),
    state: z.string().trim().max(80).optional().nullable(),
    stateCode: z
      .string()
      .trim()
      .regex(/^\d{2}$/u, "stateCode must be a 2-digit GST state code")
      .optional()
      .nullable(),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/u, "postalCode must be 6 digits")
      .optional()
      .nullable(),
    country: z.string().trim().max(80).optional().nullable(),
  })
  .partial();

// GSTIN format: 2-digit state + 10-char PAN + 1-char entity + Z + 1-digit checksum.
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/u;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/u;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/u;

const PatchBody = z
  .object({
    legalName: z.string().trim().max(200).optional().nullable(),
    tradeName: z.string().trim().max(200).optional().nullable(),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(GSTIN_RE, "Invalid GSTIN format")
      .optional()
      .nullable(),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PAN_RE, "Invalid PAN format")
      .optional()
      .nullable(),
    fssai: z
      .string()
      .trim()
      .regex(/^\d{14}$/u, "FSSAI must be 14 digits")
      .optional()
      .nullable(),
    cin: z.string().trim().max(40).optional().nullable(),
    iec: z.string().trim().max(20).optional().nullable(),
    address: AddressSchema.optional(),
    dispatchAddress: AddressSchema.optional(),
    defaultHsnCode: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/u, "HSN must be 4-8 digits")
      .optional(),
    defaultGstRatePct: z
      .number()
      .int()
      .min(0)
      .max(28)
      .refine(
        (v) => [0, 5, 12, 18, 28].includes(v),
        "GST rate must be 0/5/12/18/28",
      )
      .optional(),
    pricesIncludeTax: z.boolean().optional(),
    invoicePrefix: z
      .string()
      .trim()
      .max(10)
      .regex(/^[A-Z0-9-]+$/u, "Prefix must be uppercase letters/digits/hyphens")
      .optional(),
    bankName: z.string().trim().max(120).optional().nullable(),
    bankAccountNumber: z.string().trim().max(40).optional().nullable(),
    bankIfsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(IFSC_RE, "Invalid IFSC format")
      .optional()
      .nullable(),
    bankBranch: z.string().trim().max(120).optional().nullable(),
    upiId: z.string().trim().max(120).optional().nullable(),
    signatureImageUrl: z.string().url().max(500).optional().nullable(),
    invoiceFooterNote: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

router.patch("/admin/business-settings", async (req: Request, res: Response) => {
  const parsed = PatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }
  try {
    await ensureSingleton();
    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      patch[k] = v;
    }
    const [updated] = await db
      .update(businessSettingsTable)
      .set(patch)
      .where(eq(businessSettingsTable.id, 1))
      .returning();
    await recordActivity({
      kind: "business_settings_updated",
      actor: "admin",
      title: "Business settings updated",
      summary: `Fields: ${Object.keys(parsed.data).join(", ")}`,
      entityType: "business_settings",
      entityId: "1",
    });
    res.json({ settings: updated });
  } catch (err) {
    logger.error({ err }, "business.patch_failed");
    res.status(500).json({ error: "Failed to update business settings" });
  }
});

export default router;
