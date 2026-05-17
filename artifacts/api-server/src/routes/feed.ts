import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db, articlesTable } from "../lib/db";

const router: IRouter = Router();

const SITE = process.env["PUBLIC_SITE_URL"] || "https://drtea.in";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Publicly cacheable RSS feed of the latest 30 published Journal articles.
// Mounted at /api/feed.xml; the storefront can also reverse-proxy /feed.xml.
router.get(["/feed.xml", "/journal/feed.xml"], async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(articlesTable)
    .where(eq(articlesTable.published, true))
    .orderBy(desc(articlesTable.createdAt))
    .limit(30);

  const items = rows
    .map((r) => {
      const link = `${SITE}/journal/${r.slug}`;
      const date = r.createdAt
        ? new Date(r.createdAt).toUTCString()
        : new Date().toUTCString();
      return `
    <item>
      <title>${escape(r.title)}</title>
      <link>${escape(link)}</link>
      <guid isPermaLink="true">${escape(link)}</guid>
      <pubDate>${date}</pubDate>
      <category>${escape(r.category)}</category>
      <description><![CDATA[${r.excerpt}]]></description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Dr Tea Journal</title>
    <link>${escape(SITE)}/journal</link>
    <atom:link href="${escape(SITE)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Brewing guides, tea history, kadha rituals, and new releases from Dr Tea.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.send(xml);
});

export default router;
