import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowUpRight, Search, Tag } from "lucide-react";
import Seo from "@/components/Seo";
import {
  fetchContentHubCategories,
  fetchContentHubList,
  HUB_COPY,
  HUB_PATH,
  type ContentHubCard,
  type ContentHubKind,
} from "@/lib/content-hub";

interface Props {
  hub: ContentHubKind;
}

const FALLBACK_HEROES: Record<ContentHubKind, string> = {
  pairing:
    "https://images.unsplash.com/photo-1521305916504-4a1121188589?w=1600&q=80&auto=format&fit=crop",
  wellness:
    "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1600&q=80&auto=format&fit=crop",
  regional:
    "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=1600&q=80&auto=format&fit=crop",
};

export default function ContentHubListPage({ hub }: Props) {
  const copy = HUB_COPY[hub];
  const [items, setItems] = useState<ContentHubCard[]>([]);
  const [cats, setCats] = useState<Array<{ category: string; count: number }>>(
    [],
  );
  const [activeCat, setActiveCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchContentHubList(hub, {
        category: activeCat === "All" ? undefined : activeCat,
        q: q.trim() || undefined,
        limit: 60,
      }),
      fetchContentHubCategories(hub),
    ])
      .then(([list, c]) => {
        if (cancelled) return;
        setItems(list);
        setCats(c.filter((x) => x.category));
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setCats([]);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hub, activeCat, q]);

  const featured = useMemo(() => items[0] ?? null, [items]);
  const rest = useMemo(() => items.slice(1), [items]);

  useEffect(() => {
    const orig = document.title;
    document.title = `${copy.title} · Dr Tea`;
    return () => {
      document.title = orig;
    };
  }, [copy.title]);

  return (
    <div className="bg-[#FAF8F4] min-h-screen">
      <Seo
        title={copy.metaTitle}
        description={copy.metaDescription}
        canonical={copy.canonical}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: copy.metaTitle,
          url: copy.canonical,
          description: copy.metaDescription,
          publisher: { "@type": "Organization", name: "Dr Tea" },
          hasPart: items.slice(0, 25).map((it) => ({
            "@type": "Article",
            headline: it.title,
            url: `${copy.canonical}/${it.slug}`,
            description: it.summary,
            image: it.hero || undefined,
            articleSection: it.category,
          })),
        }}
        jsonLdId={`ld-hub-${hub}`}
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#1a2416] text-white">
        <div
          className="absolute inset-0 opacity-25 bg-center bg-cover"
          style={{
            backgroundImage: `url("${featured?.hero || FALLBACK_HEROES[hub]}")`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2416]/85 via-[#1a2416]/70 to-[#1a2416]" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200/85">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl sm:text-6xl leading-tight max-w-3xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-2xl text-white/75 text-base sm:text-lg leading-relaxed">
            {copy.tagline}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  hub === "pairing"
                    ? "Try 'chocolate', 'samosa', 'cheese'…"
                    : hub === "wellness"
                      ? "Try 'sleep', 'immunity', 'caffeine-free'…"
                      : "Try 'kashmiri', 'kolkata', 'matcha'…"
                }
                className="w-full bg-white/10 border border-white/20 rounded-full pl-10 pr-4 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:border-amber-200/60"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {cats.length > 0 && (
        <section className="border-b border-[#1a2416]/10 bg-white/50 sticky top-0 z-10 backdrop-blur">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-none">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#1a2416]/55 mr-2 whitespace-nowrap">
                {copy.categoriesLabel}
              </span>
              <CategoryChip
                label="All"
                active={activeCat === "All"}
                onClick={() => setActiveCat("All")}
              />
              {cats.map((c) => (
                <CategoryChip
                  key={c.category}
                  label={c.category}
                  count={c.count}
                  active={activeCat === c.category}
                  onClick={() => setActiveCat(c.category)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#1a2416]/5 aspect-[4/5] animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-[#1a2416]/55">
            No entries published yet — fresh stories arrive daily.
          </div>
        ) : (
          <>
            {featured && (
              <Link href={`${HUB_PATH[hub]}/${featured.slug}`}>
                <a className="group block mb-12">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="grid lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-10 items-stretch"
                  >
                    <div className="relative overflow-hidden rounded-2xl aspect-[16/10] bg-[#1a2416]/10">
                      <img
                        src={featured.hero || FALLBACK_HEROES[hub]}
                        alt={featured.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700">
                        Featured · {featured.category || copy.eyebrow}
                      </p>
                      <h2 className="mt-3 font-serif text-3xl sm:text-4xl leading-tight text-[#1a2416] group-hover:text-amber-800 transition-colors">
                        {featured.title}
                      </h2>
                      <p className="mt-4 text-[#1a2416]/70 leading-relaxed">
                        {featured.summary}
                      </p>
                      <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#1a2416]">
                        Read the guide{" "}
                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                </a>
              </Link>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((it, idx) => (
                <motion.div
                  key={it.slug}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(idx * 0.04, 0.3) }}
                >
                  <Link href={`${HUB_PATH[hub]}/${it.slug}`}>
                    <a className="group block bg-white rounded-2xl overflow-hidden border border-[#1a2416]/8 hover:border-amber-300/60 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                      <div className="aspect-[4/3] bg-[#1a2416]/10 overflow-hidden">
                        <img
                          src={it.hero || FALLBACK_HEROES[hub]}
                          alt={it.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                      <div className="p-5">
                        {it.category && (
                          <p className="text-[10px] uppercase tracking-[0.24em] text-amber-700">
                            {it.category}
                          </p>
                        )}
                        <h3 className="mt-2 font-serif text-xl leading-snug text-[#1a2416] group-hover:text-amber-800 transition-colors line-clamp-2">
                          {it.title}
                        </h3>
                        <p className="mt-2 text-sm text-[#1a2416]/65 line-clamp-3">
                          {it.summary}
                        </p>
                        {it.tags && it.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {it.tags
                              .filter((t) => !t.startsWith("#"))
                              .slice(0, 3)
                              .map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1a2416]/5 text-[#1a2416]/65"
                                >
                                  <Tag className="w-2.5 h-2.5" /> {t}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </a>
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap text-xs px-3.5 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-[#1a2416] text-white border-[#1a2416]"
          : "bg-white text-[#1a2416] border-[#1a2416]/12 hover:border-[#1a2416]/35"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span className={`ml-1.5 ${active ? "text-white/60" : "text-[#1a2416]/45"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
