import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import Seo from "@/components/Seo";

const API = `${import.meta.env.BASE_URL}api`;

interface Entry {
  slug: string;
  title: string;
  summary: string;
  category: string;
  hero: string;
  tags: string[];
}

function prettyTag(slug: string): string {
  return slug.replace(/^#/, "").replace(/-/g, " ");
}

export default function TeapediaTagPage() {
  const [, params] = useRoute("/teapedia/tag/:tag");
  const tag = (params?.tag ?? "").toLowerCase();
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tag) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API}/teapedia/by-tag/${encodeURIComponent(tag)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => !cancelled && setItems(j as Entry[]))
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
        title={`${title} — Teapedia entries tagged "${label}" | Dr Tea`}
        description={`Every Dr Tea Teapedia reference entry tagged "${label}". Definitions, origins, brewing guides — clear, encyclopedic answers.`}
        canonical={`https://drtea.in/teapedia/tag/${encodeURIComponent(tag)}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Teapedia entries tagged "${label}"`,
          url: `https://drtea.in/teapedia/tag/${encodeURIComponent(tag)}`,
          publisher: { "@type": "Organization", name: "Dr Tea" },
          hasPart: items.slice(0, 25).map((e) => ({
            "@type": "Article",
            headline: e.title,
            url: `https://drtea.in/teapedia/${e.slug}`,
            description: e.summary,
            image: e.hero || undefined,
          })),
        }}
        jsonLdId="ld-teapedia-tag"
      />

      <section className="container mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 max-w-4xl text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold mb-3">
          Teapedia · Tag
        </p>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${items.length} entr${items.length === 1 ? "y" : "ies"} tagged "${label}"`}
        </p>
      </section>

      <section className="container mx-auto px-4 sm:px-6 max-w-6xl pb-20">
        {!loading && !items.length ? (
          <p className="text-center text-muted-foreground py-20">
            Nothing yet. <Link href="/teapedia"><a className="underline">Browse the encyclopedia →</a></Link>
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((e) => (
              <li key={e.slug}>
                <Link href={`/teapedia/${e.slug}`}>
                  <a className="group block rounded-2xl overflow-hidden border border-black/5 bg-white hover:shadow-lg transition-shadow h-full">
                    {e.hero ? (
                      <div className="aspect-[16/10] bg-center bg-cover" style={{ backgroundImage: `url("${e.hero}")` }} />
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-amber-50 to-emerald-50" />
                    )}
                    <div className="p-5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold mb-2">
                        {e.category}
                      </p>
                      <h2 className="font-serif text-xl leading-snug group-hover:text-primary transition-colors">
                        {e.title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                        {e.summary}
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
