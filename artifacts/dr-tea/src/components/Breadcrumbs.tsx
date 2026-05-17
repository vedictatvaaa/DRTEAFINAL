import { useEffect } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { useHomepageSeo } from '@/hooks/use-homepage-seo';

export interface Crumb {
  label: string;
  href?: string;
}

const SITE_ORIGIN = 'https://drtea.in';

function absoluteUrl(href?: string): string | undefined {
  if (!href) return undefined;
  if (/^https?:/i.test(href)) return href;
  if (typeof window !== 'undefined') {
    return new URL(href, window.location.origin).toString();
  }
  return `${SITE_ORIGIN}${href.startsWith('/') ? href : `/${href}`}`;
}

export default function Breadcrumbs({
  items,
  className = '',
}: {
  items: Crumb[];
  className?: string;
}) {
  const seo = useHomepageSeo();
  const homeLabel = seo.breadcrumbHomeLabel || 'Home';
  const jsonLdEnabled = seo.breadcrumbsJsonLdEnabled;
  useEffect(() => {
    if (!items.length) return;
    const ID = 'ld-breadcrumbs';
    // Drop any sibling we don't own (e.g. from a previous mount), then own a
    // fresh node. Cleanup removes our exact node only — so a transition where
    // the new page mounts before the old one unmounts will not strip the
    // new page's schema.
    document.head.querySelectorAll(`script#${ID}`).forEach((n) => n.remove());
    if (!jsonLdEnabled) return;

    const list = [
      { '@type': 'ListItem', position: 1, name: homeLabel, item: absoluteUrl('/') },
      ...items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: it.label,
        ...(it.href ? { item: absoluteUrl(it.href) } : {}),
      })),
    ];

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = ID;
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: list,
    });
    document.head.appendChild(script);

    return () => {
      // Remove only the exact node we created — not any newer node a
      // concurrent transition may have just attached under the same id.
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [items, homeLabel, jsonLdEnabled]);

  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={`text-[11px] uppercase tracking-widest text-muted-foreground ${className}`}>
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li>
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="w-3 h-3" />
            <span className="sr-only sm:not-sr-only">{homeLabel}</span>
          </Link>
        </li>
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
              {isLast || !it.href ? (
                <span className="text-foreground font-medium normal-case tracking-normal text-[12px]">{it.label}</span>
              ) : (
                <Link href={it.href} className="hover:text-foreground transition-colors normal-case tracking-normal text-[12px]">
                  {it.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
