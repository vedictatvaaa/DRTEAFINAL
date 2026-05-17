import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, ChevronRight, Hash } from "lucide-react";
import {
  fetchContentHubEntry,
  recordContentHubView,
  HUB_COPY,
  HUB_PATH,
  type ContentHubDetailResponse,
  type ContentHubKind,
} from "@/lib/content-hub";

const FALLBACK_HERO =
  "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1600&q=80&auto=format&fit=crop";

interface Props {
  hub: ContentHubKind;
}

export default function ContentEntryPage({ hub }: Props) {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const [data, setData] = useState<ContentHubDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchContentHubEntry(hub, slug)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        recordContentHubView(hub, slug);
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hub, slug]);

  useEffect(() => {
    if (!data) return;
    const orig = document.title;
    document.title = `${data.entry.metaTitle || data.entry.title} · Dr Tea`;
    return () => {
      document.title = orig;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-[#FAF8F4] min-h-screen">
        <div className="max-w-3xl mx-auto px-5 py-24 animate-pulse space-y-6">
          <div className="h-3 w-32 bg-[#1a2416]/10 rounded" />
          <div className="h-12 w-full bg-[#1a2416]/10 rounded" />
          <div className="h-72 w-full bg-[#1a2416]/10 rounded-2xl" />
          <div className="h-4 w-full bg-[#1a2416]/10 rounded" />
          <div className="h-4 w-5/6 bg-[#1a2416]/10 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#FAF8F4] min-h-screen flex items-center justify-center px-6 py-24 text-center">
        <div className="max-w-md">
          <p className="text-[#1a2416]/60 mb-4">
            {error ?? "We couldn't find that piece."}
          </p>
          <Link href={HUB_PATH[hub]}>
            <a className="text-amber-800 underline-offset-4 hover:underline">
              Back to {HUB_COPY[hub].eyebrow}
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const entry = data.entry;
  const tags = entry.tags ?? [];
  const hashtags = tags.filter((t) => t.startsWith("#"));
  const plainTags = tags.filter((t) => !t.startsWith("#"));
  const facets = entry.facets ?? null;

  return (
    <div className="bg-[#FAF8F4] min-h-screen">
      {/* Hero */}
      <section className="relative bg-[#1a2416] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-50 bg-center bg-cover"
          style={{ backgroundImage: `url("${entry.hero || FALLBACK_HERO}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2416]/40 via-[#1a2416]/65 to-[#1a2416]" />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <Link href={HUB_PATH[hub]}>
            <a className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-amber-200/85 hover:text-amber-100">
              <ArrowLeft className="w-3.5 h-3.5" />
              {HUB_COPY[hub].eyebrow}
            </a>
          </Link>
          {entry.category && (
            <p className="mt-6 text-[11px] uppercase tracking-[0.32em] text-white/65">
              {entry.category}
            </p>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-3 font-serif text-3xl sm:text-5xl leading-tight max-w-3xl"
          >
            {entry.title}
          </motion.h1>
          <p className="mt-4 max-w-2xl text-white/80 text-base sm:text-lg leading-relaxed">
            {entry.summary}
          </p>
        </div>
      </section>

      {/* Body */}
      <article className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        {/* Facet card (hub-specific quick info) */}
        {facets && Object.keys(facets).length > 0 && (
          <FacetCard hub={hub} facets={facets} />
        )}

        <div className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-[#1a2416] prose-p:text-[#1a2416]/85 prose-p:leading-relaxed">
          {(entry.body ?? []).map((section, i) => (
            <div key={i}>
              {section.heading && <h2>{section.heading}</h2>}
              {section.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          ))}
        </div>

        {/* FAQs */}
        {entry.faqs && entry.faqs.length > 0 && (
          <section className="mt-14 border-t border-[#1a2416]/10 pt-10">
            <h2 className="font-serif text-2xl text-[#1a2416] mb-6">
              People also ask
            </h2>
            <div className="space-y-4">
              {entry.faqs.map((f, i) => (
                <details
                  key={i}
                  className="group bg-white rounded-xl border border-[#1a2416]/10 px-5 py-4"
                >
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-4 font-medium text-[#1a2416]">
                    <span>{f.q}</span>
                    <ChevronRight className="w-4 h-4 mt-1 transition-transform group-open:rotate-90 text-[#1a2416]/45" />
                  </summary>
                  <p className="mt-3 text-[#1a2416]/75 leading-relaxed">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Hashtags / SEO tags footer */}
        {(hashtags.length > 0 || plainTags.length > 0) && (
          <section className="mt-14 border-t border-[#1a2416]/10 pt-8">
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {hashtags.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-amber-100/80 text-amber-900"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
            {plainTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {plainTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#1a2416]/6 text-[#1a2416]/65"
                  >
                    <Hash className="w-3 h-3" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
      </article>

      {/* Related products */}
      {data.relatedProducts.length > 0 && (
        <section className="border-t border-[#1a2416]/10 bg-white/50">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
            <h2 className="font-serif text-2xl text-[#1a2416] mb-6">
              Brews mentioned in this piece
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {data.relatedProducts.slice(0, 4).map((p) => {
                const img = Array.isArray(p.images) ? p.images[0] : undefined;
                return (
                  <Link key={p.id} href={`/product/${p.slug}`}>
                    <a className="group block bg-white rounded-xl overflow-hidden border border-[#1a2416]/10 hover:shadow-md transition">
                      <div className="aspect-square bg-[#1a2416]/5">
                        {img && (
                          <img
                            src={img}
                            alt={p.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-[#1a2416] line-clamp-2">
                          {p.name}
                        </p>
                      </div>
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Related recipes + entries */}
      {(data.relatedRecipes.length > 0 || data.relatedEntries.length > 0) && (
        <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
          {data.relatedRecipes.length > 0 && (
            <>
              <h2 className="font-serif text-2xl text-[#1a2416] mb-6">
                Recipes you'll love alongside
              </h2>
              <div className="grid sm:grid-cols-3 gap-5 mb-12">
                {data.relatedRecipes.map((r) => (
                  <Link key={r.slug} href={`/recipes/${r.slug}`}>
                    <a className="group block">
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#1a2416]/5 mb-3">
                        {r.hero && (
                          <img
                            src={r.hero}
                            alt={r.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                      </div>
                      <p className="font-medium text-[#1a2416] group-hover:text-amber-800 transition">
                        {r.title}
                      </p>
                    </a>
                  </Link>
                ))}
              </div>
            </>
          )}
          {data.relatedEntries.length > 0 && (
            <>
              <h2 className="font-serif text-2xl text-[#1a2416] mb-6">
                Read next
              </h2>
              <div className="grid sm:grid-cols-3 gap-5">
                {data.relatedEntries.map((e) => (
                  <Link key={e.slug} href={`${HUB_PATH[e.hub]}/${e.slug}`}>
                    <a className="group block bg-white rounded-xl overflow-hidden border border-[#1a2416]/10 hover:shadow-md transition">
                      <div className="aspect-[4/3] bg-[#1a2416]/5">
                        {e.hero && (
                          <img
                            src={e.hero}
                            alt={e.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700">
                          {HUB_COPY[e.hub].eyebrow}
                        </p>
                        <p className="mt-2 font-medium text-[#1a2416] line-clamp-2 group-hover:text-amber-800 transition">
                          {e.title}
                        </p>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Footer back link */}
      <div className="max-w-4xl mx-auto px-5 sm:px-8 pb-20">
        <Link href={HUB_PATH[hub]}>
          <a className="inline-flex items-center gap-2 text-sm text-[#1a2416] hover:text-amber-800 transition">
            More from {HUB_COPY[hub].eyebrow}
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </Link>
      </div>
    </div>
  );
}

function FacetCard({
  hub,
  facets,
}: {
  hub: ContentHubKind;
  facets: Record<string, unknown>;
}) {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, raw: unknown) => {
    if (raw === undefined || raw === null) return;
    if (Array.isArray(raw)) {
      const v = raw.filter(Boolean).join(", ");
      if (v) rows.push({ label, value: v });
    } else if (typeof raw === "string" && raw.trim()) {
      rows.push({ label, value: raw });
    } else if (typeof raw === "number") {
      rows.push({ label, value: String(raw) });
    }
  };
  if (hub === "pairing") {
    push("Pair with", facets.pairsWith);
    push("Try these teas", facets.teas);
    push("Mood", facets.moodTags);
  } else if (hub === "wellness") {
    push("Traditionally used for", facets.useFor);
    push("Caffeine", facets.caffeine);
    push("Brew time", facets.brewMinutes ? `${facets.brewMinutes} min` : null);
    push("Dosha", facets.dosha);
  } else {
    push("Region", facets.region);
    push("Country", facets.country);
    push("Practiced since", facets.since);
    push("Brewed with", facets.brewedWith);
  }
  if (!rows.length) return null;
  return (
    <div className="not-prose mb-10 rounded-2xl border border-[#1a2416]/10 bg-white p-5 sm:p-6 grid sm:grid-cols-2 gap-x-8 gap-y-3">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[#1a2416]/55">
            {r.label}
          </span>
          <span className="mt-1 text-sm text-[#1a2416]">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
