import { useRoute, Link } from "wouter";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useTeapediaEntry } from "@/lib/teapedia-data";
import Seo from "@/components/Seo";
import NotFound from "@/pages/not-found";
import RelatedProductsCard from "@/components/teapedia/RelatedProductsCard";
import ShareButtons from "@/components/journal/ShareButtons";

const HERO_FALLBACK =
  "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1600&q=80&auto=format&fit=crop";

export default function TeapediaEntry() {
  const [, params] = useRoute("/teapedia/:slug");
  const slug = params?.slug;
  const { data, loading, notFound } = useTeapediaEntry(slug);

  if (loading)
    return (
      <div className="min-h-screen pt-32 text-center text-muted-foreground">
        Loading…
      </div>
    );
  if (notFound || !data) return <NotFound />;

  const { entry, relatedProducts, relatedEntries } = data;
  const url = `https://drtea.in/teapedia/${entry.slug}`;
  const seoTitle = entry.metaTitle || `${entry.title} | Dr Tea Teapedia`;
  const seoDesc = entry.metaDescription || entry.summary;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: entry.title,
    description: seoDesc,
    image: entry.hero || HERO_FALLBACK,
    dateModified: entry.updatedAt,
    author: { "@type": "Organization", name: "Dr Tea" },
    publisher: {
      "@type": "Organization",
      name: "Dr Tea",
      logo: {
        "@type": "ImageObject",
        url: "https://drtea.in/favicon.svg",
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: entry.category,
    keywords: (entry.tags ?? []).join(", "),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://drtea.in/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Teapedia",
        item: "https://drtea.in/teapedia",
      },
      { "@type": "ListItem", position: 3, name: entry.title, item: url },
    ],
  };

  return (
    <article className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title={seoTitle}
        description={seoDesc}
        canonical={url}
        jsonLd={[articleLd, breadcrumbLd]}
        jsonLdId="ld-teapedia-entry"
      />

      <header className="container mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 max-w-3xl">
        <Link
          href="/teapedia"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-3 h-3" /> Teapedia
        </Link>
        <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-3 inline-flex items-center gap-2">
          <BookOpen className="w-3 h-3" /> {entry.category}
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold leading-tight mb-5">
          {entry.title}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-5">
          {entry.summary}
        </p>
        {entry.tags?.length ? (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-muted text-foreground/70"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <ShareButtons url={url} title={entry.title} />
      </header>

      <div className="container mx-auto px-4 sm:px-6 pb-8 max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="max-w-3xl">
          {(entry.hero || HERO_FALLBACK) && (
            <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-muted mb-10">
              <img
                src={entry.hero || HERO_FALLBACK}
                alt={entry.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="prose prose-sm sm:prose-base max-w-none">
            {entry.body.map((section, i) => (
              <div key={i} className="mb-8">
                {section.heading && (
                  <h2 className="text-xl sm:text-2xl font-serif font-semibold mb-3 mt-6">
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs.map((p, j) => (
                  <p
                    key={j}
                    className="text-[15px] leading-[1.7] text-foreground/85 mb-4"
                  >
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>

          {relatedEntries.length > 0 && (
            <section className="border-t border-border pt-6 mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Related entries
              </h3>
              <ul className="space-y-2">
                {relatedEntries.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/teapedia/${r.slug}`}
                      className="block group"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
                        {r.category}
                      </p>
                      <p className="font-serif font-semibold group-hover:text-primary transition-colors">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {r.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="pt-6 border-t border-border mt-8">
            <ShareButtons url={url} title={entry.title} />
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <RelatedProductsCard products={relatedProducts} />
          {entry.relatedCategorySlugs?.length ? (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-3">
                Browse the catalog
              </h3>
              <ul className="space-y-1.5">
                {entry.relatedCategorySlugs.map((c) => (
                  <li key={c}>
                    <Link
                      href={`/shop/${c}`}
                      className="text-sm font-medium hover:text-primary transition-colors capitalize"
                    >
                      {c.replace(/-/g, " ")} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
