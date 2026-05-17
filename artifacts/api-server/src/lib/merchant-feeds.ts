import { db, productsTable } from "./db";
import { asc } from "drizzle-orm";

const SITE_BASE = process.env["PUBLIC_SITE_BASE"]
  ?? process.env["PUBLIC_API_BASE"]
  ?? `http://localhost:${process.env["PORT"] ?? "8080"}`;

const BRAND = "Dr Tea";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function inStock(variants: Array<{ stock: number }>): "in stock" | "out of stock" {
  return variants.some((v) => (v.stock ?? 0) > 0) ? "in stock" : "out of stock";
}

function lowestPrice(variants: Array<{ price: number }>, fallback: number): number {
  if (!variants.length) return fallback;
  return variants.reduce((m, v) => Math.min(m, v.price), Number.POSITIVE_INFINITY);
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = SITE_BASE.replace(/\/+$/, "");
  return path.startsWith("/") ? base + path : `${base}/${path}`;
}

export async function buildGoogleMerchantXml(): Promise<string> {
  const rows = await db.select().from(productsTable).orderBy(asc(productsTable.sortOrder));
  const items = rows.map((p) => {
    const link = absoluteUrl(`/products/${p.slug}`);
    const image = absoluteUrl(p.imageUrl || (p.images?.[0]?.url ?? ""));
    const price = lowestPrice(p.variants ?? [], p.price);
    const availability = inStock(p.variants ?? []);
    return [
      "    <item>",
      `      <g:id>${escXml(p.id)}</g:id>`,
      `      <g:title>${escXml(p.name)}</g:title>`,
      `      <g:description>${escXml(p.shortDescription || p.description.slice(0, 500))}</g:description>`,
      `      <g:link>${escXml(link)}</g:link>`,
      `      <g:image_link>${escXml(image)}</g:image_link>`,
      `      <g:availability>${availability}</g:availability>`,
      `      <g:price>${(price / 100).toFixed(2)} INR</g:price>`,
      `      <g:brand>${escXml(BRAND)}</g:brand>`,
      `      <g:condition>new</g:condition>`,
      `      <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Beverages &gt; Tea &amp; Infusions</g:google_product_category>`,
      `      <g:product_type>${escXml(p.category)}</g:product_type>`,
      `      <g:identifier_exists>no</g:identifier_exists>`,
      "    </item>",
    ].join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
    `  <channel>`,
    `    <title>${escXml(BRAND)} — Product Feed</title>`,
    `    <link>${escXml(absoluteUrl("/"))}</link>`,
    `    <description>${escXml(BRAND)} catalog feed for Google Merchant Center</description>`,
    items.join("\n"),
    `  </channel>`,
    `</rss>`,
  ].join("\n");
}

const META_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "google_product_category",
  "product_type",
];

export async function buildMetaCatalogCsv(): Promise<string> {
  const rows = await db.select().from(productsTable).orderBy(asc(productsTable.sortOrder));
  const lines = [META_HEADERS.join(",")];
  for (const p of rows) {
    const price = lowestPrice(p.variants ?? [], p.price);
    lines.push([
      p.id,
      p.name,
      p.shortDescription || p.description.slice(0, 500),
      inStock(p.variants ?? []),
      "new",
      `${(price / 100).toFixed(2)} INR`,
      absoluteUrl(`/products/${p.slug}`),
      absoluteUrl(p.imageUrl || (p.images?.[0]?.url ?? "")),
      BRAND,
      "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
      p.category,
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}
