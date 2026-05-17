import type { AdCreative } from "./db";

const SITE_BASE = process.env["PUBLIC_SITE_BASE"]
  ?? process.env["PUBLIC_API_BASE"]
  ?? `http://localhost:${process.env["PORT"] ?? "8080"}`;

export interface AdExportInput {
  campaignId: number;
  campaignName: string;
  finalUrlPath: string; // e.g. "/shop" or "/products/<slug>"
  creatives: AdCreative[];
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = SITE_BASE.replace(/\/+$/, "");
  return path.startsWith("/") ? base + path : `${base}/${path}`;
}

// Truncate respecting Google Ads / Meta Ads platform limits without breaking
// mid-word when avoidable. Hard-clamps to keep the import file valid.
function clamp(s: string, max: number): string {
  if (!s) return "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

function deriveAdGroupName(name: string): string {
  return clamp(name.replace(/[^\w\s-]/g, "").trim() || "Default", 80);
}

/**
 * Google Ads Editor "Responsive Search Ad" bulk-import CSV.
 *
 * One row per ad. Up to 15 headlines and 4 descriptions get distributed
 * across each campaign's creatives — Google Ads stitches them at serve
 * time via Smart Bidding. Headlines are clamped to 30 chars, descriptions
 * to 90 chars (Google's hard ceilings). The import file works in Google
 * Ads Editor → File → Import → Paste text.
 *
 * Reference: https://support.google.com/google-ads/editor/answer/30104
 */
export function buildGoogleAdsRsaCsv(input: AdExportInput): string {
  const finalUrl = absoluteUrl(input.finalUrlPath);
  const campaign = clamp(input.campaignName, 120);
  const adGroup = deriveAdGroupName(input.campaignName);

  const headlines = input.creatives
    .map((c) => clamp(c.headline ?? "", 30))
    .filter(Boolean)
    .slice(0, 15);
  const descriptions = input.creatives
    .map((c) => clamp(c.description ?? "", 90))
    .filter(Boolean)
    .slice(0, 4);

  // Pad to at least the Google Ads minimums (3 headlines, 2 descriptions)
  // by reusing existing items so the file imports without warnings.
  while (headlines.length > 0 && headlines.length < 3) headlines.push(headlines[0]!);
  while (descriptions.length > 0 && descriptions.length < 2) descriptions.push(descriptions[0]!);

  const headers: string[] = [
    "Campaign",
    "Ad group",
    "Ad type",
    "Final URL",
    ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`),
    ...Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`),
    "Path 1",
    "Path 2",
    "Status",
  ];

  const row: (string | number)[] = [
    campaign,
    adGroup,
    "Responsive search ad",
    finalUrl,
    ...Array.from({ length: 15 }, (_, i) => headlines[i] ?? ""),
    ...Array.from({ length: 4 }, (_, i) => descriptions[i] ?? ""),
    clamp(adGroup.toLowerCase().replace(/\s+/g, "-"), 15),
    "tea",
    "Paused",
  ];

  return [headers.map(csvEscape).join(","), row.map(csvEscape).join(",")].join("\r\n");
}

/**
 * Meta Ads Manager bulk-import CSV (single-image link ads).
 *
 * Each creative becomes its own ad row inside one ad set, ready to paste
 * into Ads Manager → "Import multiple ads" or to be consumed by the
 * Marketing API uploader. Status is left as PAUSED so nothing spends until
 * an operator reviews it inside Ads Manager.
 *
 * Reference column names are taken from the Meta bulk-import spec:
 * https://www.facebook.com/business/help/313488089391645
 */
export function buildMetaAdsCsv(input: AdExportInput): string {
  const link = absoluteUrl(input.finalUrlPath);
  const campaignName = clamp(input.campaignName, 120);
  const adSetName = `${clamp(input.campaignName, 80)} — Ad set 1`;

  const headers = [
    "Campaign Name",
    "Campaign Objective",
    "Campaign Status",
    "Ad Set Name",
    "Ad Set Status",
    "Ad Name",
    "Ad Status",
    "Title",
    "Body",
    "Link",
    "Display Link",
    "Image URL",
    "Call to Action",
  ];

  const lines: string[] = [headers.join(",")];
  let displayLink: string;
  try {
    displayLink = new URL(link).hostname;
  } catch {
    displayLink = "";
  }

  input.creatives.forEach((c, i) => {
    if (!c.headline && !c.description) return;
    const adName = `${clamp(input.campaignName, 60)} — Ad ${i + 1}`;
    const row = [
      campaignName,
      "LINK_CLICKS",
      "PAUSED",
      adSetName,
      "PAUSED",
      adName,
      "PAUSED",
      // Meta truncates titles at 40 chars in feed, body at 125 — go a touch
      // longer because Ads Manager will accept up to 255/500 in the import.
      clamp(c.headline ?? "", 40),
      clamp(c.description ?? "", 125),
      link,
      displayLink,
      c.imageUrl ?? "",
      "SHOP_NOW",
    ];
    lines.push(row.map(csvEscape).join(","));
  });

  return lines.join("\r\n");
}
