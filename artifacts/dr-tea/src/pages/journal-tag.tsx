import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import Seo from "@/components/Seo";

const API = `${import.meta.env.BASE_URL}api`;

interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover: string;
  date: string;
  readTime: string;
}

function prettyTag(slug: string): string {
  return slug.replace(/^#/, "").replace(/-/g, " ");
}

export default function JournalTagPage() {
  const [, params] = useRoute("/journal/tag/:tag");
  const tag = (params?.tag ?? "").toLowerCase();
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tag) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API}/journal/by-tag/${encodeURIComponent(tag)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => !cancelled && setItems(j as Article[]))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tag]);

  const label = prettyTag(tag);
  const title = `${label[0]?.toUpperCase()}${label.slice(1)}`;

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title={`${title} — Articles tagged "${label}" | The Dr Tea Journal`}
        description={`Every Dr Tea Journal article tagged "${label}". Brewing guides, wellness pieces and new releases — fresh, dated editorial from the Dr Tea team.`}
        canonical={`https://drtea.in/journal/tag/${encodeURIComponent(tag)}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Articles tagged "${label}"`,
          url: `https://drtea.in/journal/tag/${encodeURIComponent(tag)}`,
          description: `Dr Tea Journal articles tagged "${label}".`,
          publisher: { "@type": "Organization", name: "Dr Tea" },
          hasPart: items.slice(0, 25).map((a) => ({
            "@type": "BlogPosting",
            headline: a.title,
            url: `https://drtea.in/journal/${a.slug}`,
            datePublished: a.date,
            description: a.excerpt,
            image: a.cover,
          })),
        }}
        jsonLdId="ld-journal-tag"
      />

      <section className="container mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 max-w-4xl text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold mb-3">
          The Journal · Tag
        </p>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${items.length} article${items.length === 1 ? "" : "s"} tagged "${label}"`}
        </p>
      </section>

      <section className="container mx-auto px-4 sm:px-6 max-w-6xl pb-20">
        {!loading && !items.length ? (
          <p className="text-center text-muted-foreground py-20">
            Nothing yet. <Link href="/journal"><a className="underline">Browse all articles →</a></Link>
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((a) => (
              <li key={a.slug}>
                <Link href={`/journal/${a.slug}`}>
                  <a className="group block rounded-2xl overflow-hidden border border-black/5 bg-white hover:shadow-lg transition-shadow h-full">
                    {a.cover ? (
                      <div className="aspect-[16/10] bg-center bg-cover" style={{ backgroundImage: `url("${a.cover}")` }} />
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-amber-50 to-emerald-50" />
                    )}
                    <div className="p-5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold mb-2">
                        {a.category} · {a.readTime}
                      </p>
                      <h2 className="font-serif text-xl leading-snug group-hover:text-primary transition-colors">
                        {a.title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                        {a.excerpt}
                      </p>
                    </div>
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
