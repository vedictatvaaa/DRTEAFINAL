import { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  text: string;
}

export function makeTocItems(
  body: Array<{ heading?: string; paragraphs: string[] }> | undefined,
): TocItem[] {
  if (!body) return [];
  const items: TocItem[] = [];
  for (const section of body) {
    const h = section.heading?.trim();
    if (!h) continue;
    items.push({ id: slugifyHeading(h), text: h });
  }
  return items;
}

export function slugifyHeading(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export default function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    );
    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <nav aria-label="Table of contents" className="hidden lg:block sticky top-24 self-start">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-3">
        On this page
      </p>
      <ul className="space-y-2 border-l border-border">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setActive(it.id);
              }}
              className={`block pl-3 -ml-px border-l-2 text-[12.5px] leading-snug transition-colors py-0.5 ${
                active === it.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
