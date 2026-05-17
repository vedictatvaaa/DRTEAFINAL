/**
 * Resolves the canonical public origin for the storefront. Used by sitemap
 * generation, JSON-LD URLs and search-engine pings. Configurable via
 * PUBLIC_SITE_URL (e.g. "https://drtea.in"); falls back to the Replit dev
 * domain so the sitemap remains pingable from preview environments.
 */
export function getSiteOrigin(): string {
  const explicit = process.env.PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const replitDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDomain) return `https://${replitDomain}`;
  return "http://localhost";
}

export function siteUrl(path: string): string {
  const base = getSiteOrigin();
  if (!path) return base;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function productPath(slug: string): string {
  return `/product/${slug}`;
}

export function articlePath(slug: string): string {
  return `/journal/${slug}`;
}
