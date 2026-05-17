import { Router, type IRouter, type Request, type Response } from "express";
import { buildGoogleMerchantXml, buildMetaCatalogCsv } from "../lib/merchant-feeds";

const router: IRouter = Router();

// Public merchant feeds. Mounted at the API root (NOT under /api) so they
// match the canonical paths feed-fetchers expect (e.g. /feeds/google-merchant.xml).
router.get("/feeds/google-merchant.xml", async (_req: Request, res: Response) => {
  const xml = await buildGoogleMerchantXml();
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600");
  res.send(xml);
});

router.get("/feeds/meta-catalog.csv", async (_req: Request, res: Response) => {
  const csv = await buildMetaCatalogCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600");
  res.setHeader("Content-Disposition", `inline; filename="meta-catalog.csv"`);
  res.send(csv);
});

export default router;
