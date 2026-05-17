import { useEffect } from 'react';

interface SeoProps {
  title?: string;
  description?: string;
  canonical?: string;
  /** Absolute URL to the social-share image. Falls back to the site default. */
  ogImage?: string;
  /** Comma-separated SEO keywords (or array). Rendered as <meta name="keywords">. */
  keywords?: string | string[];
  /** Override the robots meta — e.g. "noindex, follow" for cart/checkout/account. */
  robots?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  jsonLdId?: string;
}

const ensureMeta = (selector: string, attrs: Record<string, string>) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => {
      if (k !== 'content') el!.setAttribute(k, v);
    });
    document.head.appendChild(el);
  }
  if (attrs.content !== undefined) el.setAttribute('content', attrs.content);
};

const ensureLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const DEFAULT_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

export default function Seo({ title, description, canonical, ogImage, keywords, robots, jsonLd, jsonLdId }: SeoProps) {
  useEffect(() => {
    if (title) document.title = title;
    // Always reset robots so a noindex page doesn't leak into the next route
    ensureMeta('meta[name="robots"]', { name: 'robots', content: robots ?? DEFAULT_ROBOTS });
    if (description) {
      ensureMeta('meta[name="description"]', { name: 'description', content: description });
      ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description });
      ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    }
    const keywordsContent = Array.isArray(keywords)
      ? keywords.filter(Boolean).join(', ')
      : (keywords ?? '').trim();
    if (keywordsContent) {
      ensureMeta('meta[name="keywords"]', { name: 'keywords', content: keywordsContent });
    } else {
      // Avoid leaking keywords across SPA navigations (e.g. article -> product page).
      const stale = document.head.querySelector('meta[name="keywords"]');
      if (stale) stale.remove();
    }
    if (title) {
      ensureMeta('meta[property="og:title"]', { property: 'og:title', content: title });
      ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    }
    if (canonical) {
      ensureLink('canonical', canonical);
      ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    }
    if (ogImage) {
      // Resolve relative URLs against the canonical (or current origin).
      const absolute = /^https?:/i.test(ogImage)
        ? ogImage
        : new URL(ogImage, canonical || window.location.origin).toString();
      ensureMeta('meta[property="og:image"]', { property: 'og:image', content: absolute });
      ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: absolute });
      ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    }

    if (jsonLd && jsonLdId) {
      const existing = document.getElementById(jsonLdId);
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = jsonLdId;
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
      return () => {
        const el = document.getElementById(jsonLdId);
        if (el) el.remove();
      };
    }
    return undefined;
  }, [title, description, canonical, ogImage, JSON.stringify(keywords ?? null), JSON.stringify(jsonLd), jsonLdId]);

  return null;
}
