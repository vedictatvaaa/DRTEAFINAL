import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { storeImageBuffer } from "../lib/campaign-image-gen";
import { generateImageBuffer, type ImageSize } from "../lib/openaiImage";
import { AdminGenerateProductImageBody } from "@workspace/api-zod";
import { recordVersion } from "../lib/version-history";

const router: IRouter = Router();

router.use("/admin/products", requireAdmin);

router.post(
  "/admin/products/:id/generate-image",
  async (req: Request, res: Response) => {
    const parsed = AdminGenerateProductImageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }
    const { kind, prompt, size, alt } = parsed.data;
    const id = String(req.params.id);

    const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = await generateImageBuffer(prompt, (size as ImageSize) ?? "1024x1024");
    } catch (err) {
      req.log.error({ err }, "AI image generation failed");
      res.status(502).json({ error: err instanceof Error ? err.message : "AI generation failed" });
      return;
    }

    let publicPath: string;
    try {
      publicPath = await storeImageBuffer(buffer);
    } catch (err) {
      req.log.error({ err }, "Image storage failed");
      res.status(500).json({ error: "Failed to store generated image" });
      return;
    }

    const nextImages = [
      ...(existing.images ?? []),
      { url: publicPath, kind, alt: alt ?? undefined, isAi: true },
    ];

    const patch: Partial<typeof productsTable.$inferInsert> = {
      images: nextImages,
      updatedAt: new Date(),
    };
    if (!existing.imageUrl && kind === "hero") {
      patch.imageUrl = publicPath;
    }

    const [row] = await db
      .update(productsTable)
      .set(patch)
      .where(eq(productsTable.id, id))
      .returning();
    if (row) await recordVersion("product", id, "update", existing, row);
    res.json(row);
  },
);

export default router;
