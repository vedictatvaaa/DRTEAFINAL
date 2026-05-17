import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, productsTable, articlesTable } from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { generateAndStoreImage } from "../lib/campaign-image-gen";
import {
  generateProductMeta,
  generateArticleMeta,
  persistProductMeta,
  persistArticleMeta,
} from "../lib/seo-meta";
import {
  suggestRelatedForProduct,
  suggestRelatedForArticle,
  persistRelatedForProduct,
  persistRelatedForArticle,
} from "../lib/seo-related";
import { listPings, pingSearchEngines } from "../lib/seo-ping";
import { computeHealthSummary, refreshHealthSnapshot } from "../lib/seo-health";
import { getSiteOrigin } from "../lib/seo-site";

const router: IRouter = Router();
router.use("/admin/seo", requireAdmin);

router.get("/admin/seo/health", async (_req: Request, res: Response) => {
  const summary = await computeHealthSummary();
  res.json(summary);
});

router.post("/admin/seo/health/refresh", async (req: Request, res: Response) => {
  const origin = getSiteOrigin();
  const summary = await computeHealthSummary();
  // PSI on the top 10 URLs (homepage + most recently-updated products/articles).
  const topUrls = [
    `${origin}/`,
    ...summary.indexable.productUrls.slice(0, 5),
    ...summary.indexable.articleUrls.slice(0, 4),
  ];
  try {
    await refreshHealthSnapshot({ origin, cwvUrls: topUrls });
    const fresh = await computeHealthSummary();
    res.json(fresh);
  } catch (err) {
    req.log.error({ err }, "SEO health refresh failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Refresh failed" });
  }
});

router.get("/admin/seo/pings", async (_req: Request, res: Response) => {
  const rows = await listPings(50);
  res.json(rows);
});

router.post("/admin/seo/ping", async (_req: Request, res: Response) => {
  const rows = await pingSearchEngines({ trigger: "manual" });
  res.json(rows);
});

router.post("/admin/seo/meta/product/:id/generate", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const meta = await generateProductMeta(row);
  await persistProductMeta(id, meta);
  res.json(meta);
});

router.post("/admin/seo/meta/article/:id/generate", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  const meta = await generateArticleMeta(row);
  await persistArticleMeta(id, meta);
  res.json(meta);
});

router.post("/admin/seo/image/article/:id/regenerate", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  try {
    const prompt = `Subject: an editorial hero image for a journal article titled "${row.title}" (${row.category}). Capture the moment described: ${row.excerpt}`;
    const url = await generateAndStoreImage(prompt, "1536x1024", {
      // Bump the seed with a timestamp so a regenerate always picks a fresh
      // scene variation instead of reproducing the same composition.
      seed: `journal-${row.id}-${row.slug}-${Date.now()}`,
      sceneKind: "journal",
    });
    await db
      .update(articlesTable)
      .set({ cover: url, updatedAt: new Date() })
      .where(eq(articlesTable.id, id));
    res.json({ url });
  } catch (err) {
    req.log.error({ err, id }, "Article image regenerate failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Image regenerate failed" });
  }
});

const SetCoverBody = z.object({ url: z.string().min(1) });

router.post("/admin/seo/image/article/:id/cover", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SetCoverBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [row] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  await db
    .update(articlesTable)
    .set({ cover: parsed.data.url, updatedAt: new Date() })
    .where(eq(articlesTable.id, id));
  res.json({ url: parsed.data.url });
});

router.post("/admin/seo/related/product/:id/generate", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const r = await suggestRelatedForProduct(row);
  await persistRelatedForProduct(id, r);
  res.json(r);
});

router.post("/admin/seo/related/article/:id/generate", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  const r = await suggestRelatedForArticle(row);
  await persistRelatedForArticle(id, r);
  res.json(r);
});

export default router;
