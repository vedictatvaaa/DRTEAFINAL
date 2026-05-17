import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import Seo from '@/components/Seo';

export default function PolicyLayout({
  title,
  description,
  lastUpdated,
  slug,
  children,
}: {
  title: string;
  description: string;
  lastUpdated: string;
  slug: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-[#f9f7f3] min-h-screen pb-20">
      <Seo
        title={`${title} | Dr Tea`}
        description={description}
        canonical={`https://drtea.in/${slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://drtea.in/' },
            { '@type': 'ListItem', position: 2, name: title, item: `https://drtea.in/${slug}` },
          ],
        }}
        jsonLdId={`ld-policy-${slug}`}
      />
      <nav aria-label="Breadcrumb" className="max-w-3xl mx-auto px-5 sm:px-6 pt-6 text-[11px] uppercase tracking-widest text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li><ChevronRight className="w-3 h-3" /></li>
          <li className="text-foreground font-medium">{title}</li>
        </ol>
      </nav>
      <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-6">
        <header className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight">{title}</h1>
          <p className="text-[12px] text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
        </header>
        <article className="prose prose-sm sm:prose-base max-w-none policy-prose">
          {children}
        </article>
        <footer className="mt-12 pt-6 border-t border-border text-[12px] text-muted-foreground">
          <p>
            Questions? Reach our care team at{' '}
            <a href="mailto:care@drtea.in" className="text-foreground underline">care@drtea.in</a>{' '}
            or browse our other policies in the footer.
          </p>
        </footer>
      </div>
    </div>
  );
}
