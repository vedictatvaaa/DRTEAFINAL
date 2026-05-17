import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Search, BookOpen, Sparkles, TrendingUp, ArrowRight, Layers } from "lucide-react";
import { Link } from "wouter";
import { useTeapedia } from "@/lib/teapedia-data";
import EntryCard from "@/components/teapedia/EntryCard";
import Seo from "@/components/Seo";
import TrendingRail from "@/components/content/TrendingRail";

const CATEGORY_EMOJI: Record<string, string> = {
  "Tea Type": "🍵", "Origin": "🗺️", "Brewing": "⚗️", "Ingredient": "🌿",
  "History": "📜", "Wellness": "💚", "Equipment": "🫖", "Science": "🔬",
  "Culture": "🌏", "Variety": "🌱",
};

const TRENDING_TERMS = ["Darjeeling", "Matcha", "Pu-erh", "Kahwa", "Gongfu", "CTC"];

export default function Teapedia() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { items, categories, loading } = useTeapedia({ category: activeCategory, q });

  const featured = useMemo(() => items[0], [items]);
  const rest = useMemo(() => items.slice(1), [items]);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://drtea.in/" },
      { "@type": "ListItem", position: 2, name: "Teapedia", item: "https://drtea.in/teapedia" },
    ],
  };

  const definedTermSetLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Teapedia — The Dr Tea Encyclopedia of Tea",
    url: "https://drtea.in/teapedia",
    description: "A free, growing encyclopedia of tea types, origins, brewing methods, ingredients and science — curated by Dr Tea.",
    publisher: { "@type": "Organization", name: "Dr Tea", url: "https://drtea.in" },
    hasDefinedTerm: items.slice(0, 30).map((e) => ({
      "@type": "DefinedTerm",
      name: e.title,
      description: e.summary,
      url: `https://drtea.in/teapedia/${e.slug}`,
      inDefinedTermSet: "https://drtea.in/teapedia",
    })),
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="Teapedia — Look Up Any Tea, Term or Origin | Dr Tea"
        description="The Dr Tea reference library: clear definitions for every tea type, region, ingredient and brewing term. Look up Darjeeling first flush, kadha, gongfu, oolong oxidation and more — one entry, one answer."
        canonical="https://drtea.in/teapedia"
        jsonLd={[breadcrumbLd, definedTermSetLd]}
        jsonLdId="ld-teapedia"
      />

      {/* ── DARK EDITORIAL HERO ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1a2416]">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "url(https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1400&q=60&auto=format&fit=crop)",
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2416]/55 via-[#1a2416]/80 to-[#1a2416]" />

        <div className="relative container mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 max-w-4xl text-center">
          <nav aria-label="Breadcrumb" className="flex justify-center mb-5">
            <ol className="flex items-center gap-1.5 text-[11px] text-white/45">
              <li><Link href="/" className="hover:text-white/70 transition-colors">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-white/70 font-medium">Teapedia</li>
            </ol>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 border border-primary/35 text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-4">
            <Sparkles className="w-3 h-3" />
            {loading ? "Teapedia" : `${items.length} Entries`}
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-bold mb-4 leading-tight text-white">
            The Encyclopedia of Tea
          </h1>
          <p className="text-sm sm:text-base text-white/65 max-w-2xl mx-auto leading-relaxed">
            From the first leaf plucked in Yunnan to the kadhas of modern Mumbai —
            a free, growing reference of tea types, origins, brewing rituals and the
            science behind every sip.
          </p>

          {/* Search */}
          <div className="mt-7 max-w-sm sm:max-w-md mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tea types, origins, brewing terms…"
              className="w-full pl-10 pr-4 h-11 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/35 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
              aria-label="Search Teapedia entries"
            />
          </div>

          {/* Trending terms */}
          {!q && !activeCategory && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="text-[10px] text-white/35 uppercase tracking-wider flex items-center gap-1 mr-1">
                <TrendingUp className="w-3 h-3" /> Popular:
              </span>
              {TRENDING_TERMS.map((term) => (
                <button
                  key={term}
                  onClick={() => { searchRef.current?.focus(); setQ(term); }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/65 hover:bg-white/20 hover:text-white transition-colors border border-white/10"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── STICKY CATEGORY STRIP ────────────────────────────────────── */}
      <div className="sticky top-[56px] sm:top-[64px] z-20 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide -mx-1 px-1" role="group" aria-label="Filter by category">
            <CategoryChip
              active={!activeCategory}
              label="All"
              count={loading ? undefined : items.length}
              onClick={() => { setActiveCategory(undefined); setQ(""); }}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.category}
                active={activeCategory === c.category}
                label={c.category}
                count={c.count}
                emoji={CATEGORY_EMOJI[c.category]}
                onClick={() => { setActiveCategory(c.category); setQ(""); }}
              />
            ))}
          </div>
        </div>
      </div>

      <TrendingRail kind="teapedia" limit={8} title="New & trending in Teapedia" />

      {/* ── ENTRY GRID ───────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 sm:px-6 pb-6 max-w-5xl pt-6">
        {loading ? (
          <TeapediaSkeleton />
        ) : items.length === 0 ? (
          <EmptyState onReset={() => { setActiveCategory(undefined); setQ(""); }} />
        ) : (
          <>
            {featured && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <EntryCard entry={featured} />
              </motion.div>
            )}

            {/* Cross-sell strip */}
            {!q && !activeCategory && <TeapediaCrossSell />}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {rest.map((e, i) => (
                <motion.div
                  key={e.slug}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.035, 0.25) }}
                >
                  <EntryCard entry={e} />
                </motion.div>
              ))}
            </div>

            {/* Bottom CTA */}
            {!q && items.length > 8 && (
              <div className="mt-14 rounded-2xl bg-[#1a2416] p-6 sm:p-8 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-2">
                  Taste what you've learned
                </p>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mb-3">
                  From encyclopedia to cup
                </h2>
                <p className="text-sm text-white/65 max-w-md mx-auto mb-6">
                  Every tea in Teapedia is available to buy — single-estate, hand-sourced, and shipped in 24 hours from our Assam warehouse.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Shop All Teas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ── CROSS-SELL ──────────────────────────────────────────────────── */
function TeapediaCrossSell() {
  return (
    <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { icon: <span className="text-base">🍵</span>, label: "Tea Recipes", sub: "93 step-by-step tested brews", href: "/recipes" },
        { icon: <Layers className="w-4 h-4 text-primary" />, label: "Tea Culture", sub: "Regional traditions & rituals", href: "/tea-culture" },
        { icon: <span className="text-base">🛍️</span>, label: "Shop the Teas", sub: "Everything you just read about", href: "/shop" },
      ].map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-none group-hover:bg-primary/10 transition-colors">
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-foreground leading-none mb-0.5">{item.label}</p>
            <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-none opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}

/* ── CATEGORY CHIP ───────────────────────────────────────────────── */
function CategoryChip({ active, label, count, emoji, onClick }: {
  active: boolean; label: string; count?: number; emoji?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-none inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wide border whitespace-nowrap transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-foreground/75 border-border hover:bg-muted hover:text-foreground"
      }`}
    >
      {emoji && <span aria-hidden="true">{emoji}</span>}
      {label}
      {count !== undefined && (
        <span className={`text-[10px] font-normal ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

/* ── SKELETON ────────────────────────────────────────────────────── */
function TeapediaSkeleton() {
  return (
    <div>
      <div className="mb-8 rounded-2xl overflow-hidden border border-border animate-pulse h-48 bg-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-border animate-pulse">
            <div className="aspect-[4/3] bg-muted" />
            <div className="p-4 space-y-2.5">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-5 bg-muted rounded w-4/5" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-16">
      <BookOpen className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
      <p className="text-base font-semibold text-foreground/70 mb-1">No entries found</p>
      <p className="text-sm text-muted-foreground mb-5">Try a different search or browse all categories.</p>
      <button onClick={onReset} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        Browse all entries
      </button>
    </div>
  );
}
