import { useMemo } from 'react';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, Clock, ArrowRight } from 'lucide-react';
import { useArticle, useArticles } from '@/lib/api-data';
import Seo from '@/components/Seo';
import NotFound from '@/pages/not-found';
import CommentThread from '@/components/journal/CommentThread';
import ShareButtons from '@/components/journal/ShareButtons';
import ReadingProgress from '@/components/journal/ReadingProgress';
import AuthorByline from '@/components/journal/AuthorByline';
import TableOfContents, { makeTocItems, slugifyHeading } from '@/components/journal/TableOfContents';
import InlineNewsletter from '@/components/journal/InlineNewsletter';
import { getAuthor } from '@/data/journal-authors';

export default function JournalArticle() {
  const [, params] = useRoute('/journal/:slug');
  const slug = params?.slug;
  const { article, isLoading } = useArticle(slug);
  const { articles } = useArticles();

  const tocItems = useMemo(() => makeTocItems(article?.body), [article?.body]);

  if (isLoading) return <div className="min-h-screen pt-32 text-center text-muted-foreground">Loading...</div>;
  if (!article) return <NotFound />;

  const author = getAuthor(article.authorName);
  const curatedSlugs = article.relatedArticleSlugs ?? [];
  const curated = curatedSlugs
    .map((s) => articles.find((a) => a.slug === s))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const sameCategory = articles.filter(
    (a) => a.slug !== article.slug && a.category === article.category,
  );
  const otherArticles = (curated.length > 0 ? curated : sameCategory).slice(0, 3);
  // Pad with any remaining if we need more variety
  if (otherArticles.length < 3) {
    for (const a of articles) {
      if (otherArticles.length >= 3) break;
      if (a.slug === article.slug) continue;
      if (otherArticles.some((o) => o.slug === a.slug)) continue;
      otherArticles.push(a);
    }
  }

  const fallbackJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.excerpt,
    image: article.cover,
    datePublished: article.date,
    dateModified: article.date,
    author: { '@type': 'Person', name: author.name },
    publisher: {
      '@type': 'Organization',
      name: 'Dr Tea',
      logo: { '@type': 'ImageObject', url: 'https://drtea.in/favicon.svg' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://drtea.in/journal/${article.slug}` },
    articleSection: article.category,
  };
  const jsonLd = article.jsonLd ?? fallbackJsonLd;
  const seoTitle = article.metaTitle ?? `${article.title} | Dr Tea Journal`;
  const seoDesc = article.metaDescription ?? article.excerpt;
  const shareUrl = `https://drtea.in/journal/${article.slug}`;
  const hashtags = article.hashtags ?? [];
  const seoKeywords = article.seoKeywords ?? [];
  const formattedDate = new Date(article.date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Insert inline newsletter after ~50% of body sections (>=3 sections only)
  const inlineNewsletterIndex = article.body.length >= 3 ? Math.floor(article.body.length / 2) : -1;
  const newsletterTopic = (article.category || 'tea').toLowerCase();

  return (
    <article className="min-h-screen bg-[#FAF8F4]">
      <ReadingProgress />
      <Seo
        title={seoTitle}
        description={seoDesc}
        canonical={shareUrl}
        ogImage={article.cover}
        keywords={seoKeywords.length ? seoKeywords : undefined}
        jsonLd={jsonLd}
        jsonLdId="ld-article"
      />

      <header className="container mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 max-w-3xl">
        <Link href="/journal" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3 h-3" /> The Journal
        </Link>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground mb-4">
          <Link
            href={`/journal?category=${encodeURIComponent(article.category)}`}
            className="text-primary font-bold hover:underline"
          >
            {article.category}
          </Link>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {article.readTime}</span>
          <span>{formattedDate}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold leading-tight mb-5">{article.title}</h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-5">{article.excerpt}</p>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
          <AuthorByline author={author} date={formattedDate} />
          <ShareButtons url={shareUrl} title={article.title} />
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 pb-8 max-w-3xl">
        <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-muted mb-10">
          <img src={article.cover} alt={article.title} className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Body with sticky TOC sidebar on desktop */}
      <div className="container mx-auto px-4 sm:px-6 pb-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_220px] gap-8 lg:gap-10">
          <TableOfContents items={tocItems} />
          <div className="prose prose-sm sm:prose-base max-w-none lg:max-w-[680px] mx-auto w-full">
            {article.body.map((section, i) => {
              const headingId = section.heading ? slugifyHeading(section.heading) : undefined;
              return (
                <div key={i}>
                  <div className="mb-8">
                    {section.heading && headingId && (
                      <h2
                        id={headingId}
                        className="text-xl sm:text-2xl font-serif font-semibold mb-3 mt-6 scroll-mt-24"
                      >
                        {section.heading}
                      </h2>
                    )}
                    {section.paragraphs.map((p, j) => (
                      <p key={j} className="text-[15px] leading-[1.7] text-foreground/85 mb-4">{p}</p>
                    ))}
                  </div>
                  {i === inlineNewsletterIndex && (
                    <InlineNewsletter topic={newsletterTopic} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="hidden xl:block" />
        </div>
      </div>

      {hashtags.length > 0 && (
        <div className="container mx-auto px-4 sm:px-6 pb-8 max-w-3xl">
          <div className="pt-6 border-t border-border">
            <div className="flex flex-wrap gap-2" aria-label="Article hashtags">
              {hashtags.map((tag: string) => (
                <a
                  key={tag}
                  href={`https://www.instagram.com/explore/tags/${encodeURIComponent(tag.replace(/^#/, ''))}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                >
                  {tag}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Author card */}
      <section className="container mx-auto px-4 sm:px-6 pb-12 max-w-3xl">
        <AuthorByline author={author} variant="full" />
      </section>

      <CommentThread slug={article.slug} />

      {otherArticles.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 pb-16 pt-6 max-w-5xl border-t border-border">
          <h3 className="text-xl font-serif font-semibold mb-5 mt-10">More from the Journal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {otherArticles.map(a => (
              <Link key={a.slug} href={`/journal/${a.slug}`} className="group">
                <div className="aspect-[16/10] overflow-hidden rounded-xl bg-muted mb-3">
                  <img src={a.cover} alt={a.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-1">{a.category}</p>
                <h4 className="font-serif font-semibold text-base leading-snug group-hover:text-primary transition-colors">{a.title}</h4>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/journal" className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary hover:gap-3 transition-all">
              All articles <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>
      )}
    </article>
  );
}
