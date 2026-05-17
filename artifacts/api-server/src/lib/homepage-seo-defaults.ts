// Defaults for the singleton homepage SEO row.
//
// Mirror the hard-coded copy currently in artifacts/dr-tea/src/pages/home.tsx
// and artifacts/dr-tea/index.html so the admin sees the live values on first
// load and the public response is always populated even before the operator
// touches anything.

import type { HomepageSeoSettingsRow } from "./db";

export const DEFAULT_H1_VISIBLE = "Buy Premium\nIndian Tea Online";

export const DEFAULT_H1_SR_ONLY =
  "Buy Premium Indian Tea Online — Shop Masala Chai, CTC Tea, Black Tea, Darjeeling, Assam, Green Tea, Ayurvedic Kadha & Herbal Tisanes at Dr Tea. Single-estate, hand-blended, free shipping above ₹999 across India.";

export const DEFAULT_H1_SUBLINE =
  "Masala Chai · CTC · Black Tea · Darjeeling · Green · Kadha";

export const DEFAULT_HERO_EYEBROW = "Single-estate Indian tea";

export const DEFAULT_HERO_SUBCOPY =
  "Single-estate Darjeeling, Assam gold & royal masala chai — hand-blended in small batches, shipped from Assam in 24 hours.";

export const DEFAULT_META_KEYWORDS: string[] = [
  "buy tea online India",
  "Dr Tea",
  "masala chai",
  "ayurvedic kadha",
  "Darjeeling tea",
  "Assam tea",
  "single estate tea",
  "loose leaf tea",
  "premium Indian tea",
  "floral tisane",
];

export const DEFAULT_BREADCRUMB_HOME_LABEL = "Home";

export interface HomepageSeoPublic {
  h1Visible: string;
  h1SrOnly: string;
  h1Subline: string;
  heroEyebrow: string;
  heroSubcopy: string;
  metaKeywords: string[];
  breadcrumbHomeLabel: string;
  breadcrumbsJsonLdEnabled: boolean;
}

/**
 * Project a (possibly partially-empty) DB row into a fully-populated public
 * shape. Empty strings are treated as "use default" so the admin can clear a
 * field to revert without needing a separate "reset" button.
 */
export function projectHomepageSeo(
  row: HomepageSeoSettingsRow | undefined | null,
): HomepageSeoPublic {
  const r = row ?? null;
  const trim = (v: string | null | undefined, fallback: string): string => {
    const s = (v ?? "").trim();
    return s ? s : fallback;
  };
  const kws = (r?.metaKeywords ?? []).filter((k) => typeof k === "string" && k.trim().length > 0);
  return {
    h1Visible: trim(r?.h1Visible, DEFAULT_H1_VISIBLE),
    h1SrOnly: trim(r?.h1SrOnly, DEFAULT_H1_SR_ONLY),
    h1Subline: trim(r?.h1Subline, DEFAULT_H1_SUBLINE),
    heroEyebrow: trim(r?.heroEyebrow, DEFAULT_HERO_EYEBROW),
    heroSubcopy: trim(r?.heroSubcopy, DEFAULT_HERO_SUBCOPY),
    metaKeywords: kws.length > 0 ? kws : DEFAULT_META_KEYWORDS,
    breadcrumbHomeLabel: trim(r?.breadcrumbHomeLabel, DEFAULT_BREADCRUMB_HOME_LABEL),
    breadcrumbsJsonLdEnabled: r?.breadcrumbsJsonLdEnabled ?? true,
  };
}
