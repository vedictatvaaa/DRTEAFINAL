import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, PenSquare, LogOut, Search, TrendingUp, BookOpen, Rss } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { useArticles } from '@/lib/api-data';
import { useShopper, logoutShopper } from '@/lib/shopper-auth';
import { getAuthor } from '@/data/journal-authors';
import Seo from '@/components/Seo';
import { Button } from '@/components/ui/button';
import PostComposer from '@/components/journal/PostComposer';
import AuthorByline from '@/components/journal/AuthorByline';
import InlineNewsletter from '@/components/journal/InlineNewsletter';
import TrendingRail from '@/components/content/TrendingRail';

const ALL = '__all__';

const CATEGORY_EMOJI: Record<string, string> = {
  'Brewing': '🍵', 'Wellness': '🌿', 'Culture': '🌏', 'Origins': '🗺️',
  'Seasonal': '🍂', 'Reviews': '⭐', 'Recipes': '👨‍🍳', 'Business': '💼',
  'Science': '🔬', 'General': '📖',
};

const TRENDING_TOPICS = ['Masala Chai', 'Cold Brew', 'Ayurvedic Tea', 'Darjeeling', 'Matcha'];

export default function Journal() {
  const { articles, isLoading } = useArticles();
  const { user } = useShopper();
  const [composerOpen, setComposerOpen] = useState(false);
  const search = useSearch();
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      const c = (a.category ?? '').trim() || 'General';
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [articles]);

  useEffect(() => {
    const param = new URLSearchParams(search).get('category');
    if (!param) return;
    const match = categories.find((c) => c.name.toLowerCase() === param.toLowerCase());
    setActiveCategory(match ? match.name : ALL);
  }, [search, categories]);

  const filtered = useMemo(() => {
    let base = articles;
    if (activeCategory !== ALL) {
      base = base.filter((a) => ((a.category ?? '').trim() || 'General') === activeCategory);
    }
    if (q.trim()) {
      const qLower = q.toLowerCase();
      base = base.filter(
        (a) =>
          a.title.toLowerCase().includes(qLower) ||
          (a.excerpt ?? '').toLowerCase().includes(qLower) ||
          (a.category ?? '').toLowerCase().includes(qLower),
      );
    }
    return base;
  }, [articles, activeCategory, q]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://drtea.in/' },
      { '@type': 'ListItem', position: 2, name: 'Journal', item: 'https://drtea.in/journal' },
    ],
  };

  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'The Dr Tea Journal',
    url: 'https://drtea.in/journal',
    description: 'Brewing guides, ayurvedic wellness, garden histories and tea culture — from the Dr Tea team.',
    publisher: { '@type': 'Organization', name: 'Dr Tea', url: 'https://drtea.in' },
    blogPost: articles.slice(0, 20).map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: `https://drtea.in/journal/${a.slug}`,
      datePublished: a.date,
      description: a.excerpt,
      ...(a.cover ? { image: a.cover } : {}),
      author: { '@type': 'Organization', name: 'Dr Tea' },
      articleSection: a.category,
    })),
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="The Dr Tea Journal — Brewing Guides, Tea Culture & Wellness"
        description="Fresh writing from the Dr Tea team: how to brew, how to pick, what's new this season. Brewing guides, ayurvedic wellness, garden histories and tea culture — updated weekly."
        canonical="https://drtea.in/journal"
        jsonLd={[breadcrumbLd, blogLd]}
        jsonLdId="ld-journal"
      />

      {/* ── DARK EDITORIAL HERO ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1a2416]">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1400&q=60&auto=format&fit=crop)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2416]/50 via-[#1a2416]/75 to-[#1a2416]" />

        <div className="relative container mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 max-w-4xl text-center">
          <nav aria-label="Breadcrumb" className="flex justify-center mb-5">
            <ol className="flex items-center gap-1.5 text-[11px] text-white/45">
              <li><Link href="/" className="hover:text-white/70 transition-colors">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-white/70 font-medium">Journal</li>
            </ol>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 border border-primary/35 text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-4">
            <Rss className="w-3 h-3" />
            {isLoading ? 'Journal' : `${articles.length} Articles`}
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-bold mb-4 leading-tight text-white">
            Stories from the Leaf
          </h1>
          <p className="text-sm sm:text-base text-white/65 max-w-xl mx-auto leading-relaxed">
            Brewing guides, ayurvedic wellness, garden histories and tea culture —
            short reads from the Dr Tea team and our global community of tea lovers.
          </p>

          {/* Search */}
          <div className="mt-7 max-w-sm sm:max-w-md mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search articles, brewing, wellness…"
              className="w-full pl-10 pr-4 h-11 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/35 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
              aria-label="Search journal articles"
            />
          </div>

          {/* Trending topics */}
          {!q && activeCategory === ALL && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="text-[10px] text-white/35 uppercase tracking-wider flex items-center gap-1 mr-1">
                <TrendingUp className="w-3 h-3" /> Trending:
              </span>
              {TRENDING_TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => { searchRef.current?.focus(); setQ(topic); }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/65 hover:bg-white/20 hover:text-white transition-colors border border-white/10"
                >
                  {topic}
                </button>
              ))}
            </div>
          )}

          {/* Author CTA if signed in */}
          {user && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => setComposerOpen(true)} className="gap-2 bg-white text-[#1a2416] hover:bg-white/90">
                <PenSquare className="w-4 h-4" /> Write a Post
              </Button>
              <span className="text-xs text-white/50">
                Signed in as <span className="font-medium text-white/70">{user.name || user.email}</span>
              </span>
              <button
                type="button"
                onClick={() => logoutShopper()}
                className="text-xs text-white/45 hover:text-white/70 inline-flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" /> Sign out
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── STICKY CATEGORY STRIP ────────────────────────────────────── */}
      <div className="sticky top-[56px] sm:top-[64px] z-20 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide -mx-1 px-1" role="group" aria-label="Filter by category">
            <FilterChip label="All" count={articles.length} active={activeCategory === ALL} onClick={() => { setActiveCategory(ALL); setQ(''); }} />
            {categories.map((c) => (
              <FilterChip
                key={c.name}
                label={c.name}
                count={c.count}
                active={activeCategory === c.name}
                emoji={CATEGORY_EMOJI[c.name]}
                onClick={() => { setActiveCategory(c.name); setQ(''); }}
              />
            ))}
          </div>
        </div>
      </div>

      <TrendingRail kind="journal" limit={8} title="Trending in the Journal this week" />

      {/* ── ARTICLE GRID ─────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 sm:px-6 pb-10 pt-6 max-w-5xl">
        {isLoading ? (
          <JournalSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState onReset={() => { setActiveCategory(ALL); setQ(''); }} />
        ) : (
          <>
            {/* Featured hero card */}
            {featured && (
              <motion.article
                key={featured.slug}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="mb-8 sm:mb-10 grid grid-cols-1 sm:grid-cols-2 gap-0 bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all group"
              >
                <Link href={`/journal/${featured.slug}`} className="block relative aspect-[16/10] sm:aspect-auto min-h-[200px] bg-muted overflow-hidden">
                  <img
                    src={featured.cover}
                    alt={featured.title}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <span className="absolute top-3 left-3 sm:top-4 sm:left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-foreground shadow-sm">
                    {CATEGORY_EMOJI[featured.category ?? ''] ?? '📖'} {featured.category ?? 'General'}
                  </span>
                  <span className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                    Featured
                  </span>
                </Link>
                <div className="p-5 sm:p-6 lg:p-8 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {featured.readTime}</span>
                  </div>
                  <Link href={`/journal/${featured.slug}`}>
                    <h2 className="font-serif font-bold text-xl sm:text-2xl lg:text-3xl leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-3">
                      {featured.title}
                    </h2>
                  </Link>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 sm:line-clamp-3">{featured.excerpt}</p>
                  <div className="mb-4">
                    <AuthorByline author={getAuthor(featured.authorName)} />
                  </div>
                  <Link
                    href={`/journal/${featured.slug}`}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-primary group-hover:gap-2.5 transition-all self-start"
                  >
                    Read Article <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.article>
            )}

            {/* Cross-sell strip */}
            {!q && activeCategory === ALL && <JournalCrossSell />}

            {/* Grid of remaining */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {rest.map((a, i) => (
                  <motion.article
                    key={a.slug}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(i * 0.035, 0.25) }}
                    className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all group"
                  >
                    <Link href={`/journal/${a.slug}`} className="block relative aspect-[16/10] overflow-hidden bg-muted flex-none">
                      <img
                        src={a.cover}
                        alt={a.title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-foreground/90 shadow-sm">
                        {CATEGORY_EMOJI[a.category ?? ''] ?? '📖'} {a.category ?? 'General'}
                      </span>
                    </Link>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                        <Clock className="w-3 h-3" /> {a.readTime}
                      </div>
                      <Link href={`/journal/${a.slug}`}>
                        <h2 className="font-serif font-semibold text-base sm:text-lg leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">{a.title}</h2>
                      </Link>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2 flex-1">{a.excerpt}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                        <AuthorByline author={getAuthor(a.authorName)} />
                        <Link href={`/journal/${a.slug}`} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:gap-2 transition-all">
                          Read <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Newsletter */}
      <section className="container mx-auto px-4 sm:px-6 pb-16 max-w-3xl">
        <InlineNewsletter
          variant="card"
          topic={activeCategory === ALL ? 'tea' : activeCategory.toLowerCase()}
        />
      </section>

      <PostComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}

/* ── CROSS-SELL ──────────────────────────────────────────────────── */
function JournalCrossSell() {
  return (
    <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { icon: <BookOpen className="w-4 h-4 text-primary" />, label: 'Teapedia', sub: 'Look up any tea term or origin', href: '/teapedia' },
        { icon: <span className="text-base">🍵</span>, label: 'Tea Recipes', sub: '93 step-by-step tested brews', href: '/recipes' },
        { icon: <span className="text-base">🛍️</span>, label: 'Shop Teas', sub: 'Single-estate from ₹299', href: '/shop' },
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

/* ── FILTER CHIP ─────────────────────────────────────────────────── */
function FilterChip({ label, count, active, emoji, onClick }: {
  label: string; count: number; active: boolean; emoji?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-none shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-widest font-bold transition-all border whitespace-nowrap ${
        active
          ? 'bg-[#1a2416] text-white border-[#1a2416] shadow-sm'
          : 'bg-white text-foreground border-border hover:border-foreground/30 hover:bg-muted'
      }`}
    >
      {emoji && <span aria-hidden="true">{emoji}</span>}
      {label}
      <span className={`text-[10px] font-semibold ${active ? 'text-white/50' : 'text-muted-foreground'}`}>{count}</span>
    </button>
  );
}

/* ── SKELETON ────────────────────────────────────────────────────── */
function JournalSkeleton() {
  return (
    <div>
      <div className="mb-8 rounded-2xl overflow-hidden border border-border animate-pulse grid sm:grid-cols-2">
        <div className="aspect-[16/10] sm:aspect-auto min-h-[200px] bg-muted" />
        <div className="p-6 sm:p-8 space-y-3">
          <div className="h-3 bg-muted rounded w-1/4" />
          <div className="h-6 bg-muted rounded w-4/5" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-8 bg-muted rounded-full w-24 mt-4" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-border animate-pulse">
            <div className="aspect-[16/10] bg-muted" />
            <div className="p-5 space-y-2.5">
              <div className="h-3 bg-muted rounded w-1/4" />
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
      <p className="text-base font-semibold text-foreground/70 mb-1">No articles found</p>
      <p className="text-sm text-muted-foreground mb-5">Try a different search or browse all categories.</p>
      <button onClick={onReset} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        Browse all articles
      </button>
    </div>
  );
}
