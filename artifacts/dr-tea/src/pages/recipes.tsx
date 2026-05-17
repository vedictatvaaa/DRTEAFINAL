import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useSearch } from "wouter";
import {
  Search, ChefHat, Clock, Users, Sparkles, MapPin,
  ArrowRight, Flame, Leaf, TrendingUp, Star,
} from "lucide-react";
import { useRecipes, type RecipeListItem } from "@/lib/recipes-data";
import { Input } from "@/components/ui/input";
import Seo from "@/components/Seo";

const HERO_FALLBACK =
  "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1200&q=80&auto=format&fit=crop";

const CATEGORY_META: Record<string, {
  emoji: string;
  h2: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  color: string;
}> = {
  "Chai": {
    emoji: "☕",
    h2: "Best Chai Recipes from Dr Tea",
    description: "Kadak adrak, kesar saffron, Kashmiri noon chai, tandoori, irani and more tested Indian chai recipes — from tapri-style to royal Mughal blends.",
    metaTitle: "Chai Recipes — Masala Chai, Noon Chai, Saffron Chai & More | Dr Tea",
    metaDescription: "Tested chai recipes — classic masala, saffron kesar, Kashmiri pink noon chai, tandoori, Hyderabadi irani, Punjab doodh patti and more.",
    color: "bg-amber-50 border-amber-200 text-amber-900",
  },
  "Wellness": {
    emoji: "🌿",
    h2: "Wellness & Ayurvedic Tea Recipes",
    description: "Ayurvedic kadha, ashwagandha chai latte, moringa, giloy, brahmi and more immunity and healing brews rooted in Indian traditional medicine.",
    metaTitle: "Wellness Tea Recipes — Ashwagandha, Giloy, Moringa & Kadha | Dr Tea",
    metaDescription: "Ayurvedic and wellness tea recipes — golden turmeric, ashwagandha chai latte, giloy kadha, brahmi, mulethi, neem honey and more.",
    color: "bg-green-50 border-green-200 text-green-900",
  },
  "International": {
    emoji: "🌍",
    h2: "International Tea Recipes from Around the World",
    description: "Moroccan mint tea, Turkish çay, Japanese matcha latte, Malaysian teh tarik, Egyptian karkadeh and more global tea traditions made at home.",
    metaTitle: "International Tea Recipes — Japanese, Moroccan, Turkish & More | Dr Tea",
    metaDescription: "Global tea recipes — Moroccan mint, Japanese matcha latte, Turkish çay, teh tarik, Hong Kong milk tea, Egyptian karkadeh and more.",
    color: "bg-blue-50 border-blue-200 text-blue-900",
  },
  "Iced Tea": {
    emoji: "🧊",
    h2: "Iced Tea Recipes — Cold, Fruity & Refreshing",
    description: "Alphonso mango iced tea, peach green, lychee, watermelon mint, pomegranate hibiscus and more cooling cold teas perfect for every Indian summer.",
    metaTitle: "Iced Tea Recipes — Mango, Peach, Lychee & More Cold Teas | Dr Tea",
    metaDescription: "Refreshing iced tea recipes — Alphonso mango, peach green, lychee, watermelon mint, pomegranate hibiscus and more.",
    color: "bg-sky-50 border-sky-200 text-sky-900",
  },
  "Regional": {
    emoji: "🗺️",
    h2: "Regional Indian Tea Recipes",
    description: "Kashmiri kahwa, Assam estate brew, Kerala sulaimani, Ladakhi butter tea, Hyderabadi dum chai and more authentic regional classics.",
    metaTitle: "Regional Indian Tea Recipes — Kashmiri, Assam, Kerala & More | Dr Tea",
    metaDescription: "Authentic regional Indian tea recipes — Kashmiri kahwa, Assam estate brew, Hyderabadi dum chai, Ladakhi po cha and more.",
    color: "bg-orange-50 border-orange-200 text-orange-900",
  },
  "Dessert Tea": {
    emoji: "🌸",
    h2: "Dessert Tea & Indulgent Tea Recipes",
    description: "Rose milk tea, kesar pista chai, lavender earl grey latte, salted caramel milk tea and more sweet and indulgent tea-based drinks.",
    metaTitle: "Dessert Tea Recipes — Rose Milk Tea, Kesar Pista, Caramel | Dr Tea",
    metaDescription: "Indulgent dessert tea recipes — rose milk tea, saffron pistachio chai, lavender earl grey latte, pumpkin spice chai and more.",
    color: "bg-rose-50 border-rose-200 text-rose-900",
  },
  "Specialty": {
    emoji: "⭐",
    h2: "Specialty & Artisan Tea Recipes",
    description: "Gongfu oolong ceremony, silver needle white tea, jasmine pearls, aged pu-erh and more rare artisan brews for the serious tea enthusiast.",
    metaTitle: "Specialty Tea Recipes — Oolong, White Tea, Pu-erh & Jasmine | Dr Tea",
    metaDescription: "Artisan specialty tea recipes — gongfu oolong, rose oolong, jasmine pearl, silver needle white tea, aged pu-erh and more.",
    color: "bg-yellow-50 border-yellow-200 text-yellow-900",
  },
  "Cold Brew": {
    emoji: "🫙",
    h2: "Cold Brew Tea Recipes — Slow Steep, Big Flavour",
    description: "Darjeeling, jasmine green, hibiscus, high mountain oolong and cardamom black — cold steeped 8–12 hours for a smooth, naturally sweet cup.",
    metaTitle: "Cold Brew Tea Recipes — Darjeeling, Jasmine, Hibiscus | Dr Tea",
    metaDescription: "Cold brew tea recipes — Darjeeling cold brew, jasmine green, hibiscus, high mountain oolong and cardamom black. No heat needed.",
    color: "bg-teal-50 border-teal-200 text-teal-900",
  },
  "Fermented Tea": {
    emoji: "🧪",
    h2: "Fermented Tea & Probiotic Brew Recipes",
    description: "Jun green tea kombucha, fermented ginger beer chai, kefir chai smoothie, tepache pineapple brew and lacto-fermented ginger lemon tea.",
    metaTitle: "Fermented Tea Recipes — Jun Kombucha, Kefir Chai, Tepache | Dr Tea",
    metaDescription: "Probiotic fermented tea recipes — jun green tea kombucha, ginger beer chai, kefir chai, tepache pineapple brew and more.",
    color: "bg-purple-50 border-purple-200 text-purple-900",
  },
};

const TRENDING_TAGS = ["Masala Chai", "Cold Brew", "Matcha Latte", "Kahwa", "Immunity Kadha"];

export default function Recipes() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const categoryFromUrl = params.get("category") ?? undefined;

  const [activeCategory, setActiveCategory] = useState<string | undefined>(categoryFromUrl);
  const [q, setQ] = useState("");
  const { items, categories, loading } = useRecipes({ category: activeCategory, q });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setActiveCategory(categoryFromUrl); }, [categoryFromUrl]);

  const featured = useMemo(() => items[0], [items]);
  const rest = useMemo(() => items.slice(1), [items]);
  const catMeta = activeCategory ? CATEGORY_META[activeCategory] : null;

  const seoTitle = catMeta?.metaTitle
    ?? "Tea Recipes — Chai, Kahwa, Iced Tea & Wellness Brews | Dr Tea";
  const seoDesc = catMeta?.metaDescription
    ?? "Hand-tested tea recipes from Dr Tea: classic masala chai, kashmiri kahwa, ginger kadha, iced mango green tea, matcha lattes, global brews and more.";

  function handleCategoryClick(cat: string | undefined) {
    setActiveCategory(cat);
    setQ("");
    setLocation(cat ? `/recipes?category=${encodeURIComponent(cat)}` : "/recipes");
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://drtea.in/" },
      { "@type": "ListItem", position: 2, name: "Recipes", item: "https://drtea.in/recipes" },
      ...(activeCategory
        ? [{ "@type": "ListItem", position: 3, name: activeCategory, item: `https://drtea.in/recipes?category=${encodeURIComponent(activeCategory)}` }]
        : []),
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: activeCategory ? `${activeCategory} Recipes — Dr Tea` : "Dr Tea Recipe Collection",
    description: seoDesc,
    url: activeCategory ? `https://drtea.in/recipes?category=${encodeURIComponent(activeCategory)}` : "https://drtea.in/recipes",
    numberOfItems: items.length,
    itemListElement: items.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.title,
      url: `https://drtea.in/recipes/${r.slug}`,
      item: {
        "@type": "Recipe",
        name: r.title,
        description: r.summary,
        ...(r.hero ? { image: r.hero.startsWith("http") ? r.hero : `https://drtea.in${r.hero}` } : {}),
        recipeCategory: r.category,
        totalTime: `PT${r.prepMinutes + r.cookMinutes}M`,
        recipeYield: `${r.servings} servings`,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title={seoTitle}
        description={seoDesc}
        canonical={activeCategory ? `https://drtea.in/recipes?category=${encodeURIComponent(activeCategory)}` : "https://drtea.in/recipes"}
        jsonLd={[breadcrumbLd, itemListLd]}
        jsonLdId="ld-recipes"
      />

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1a2416]">
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=1400&q=60&auto=format&fit=crop)", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2416]/60 via-[#1a2416]/80 to-[#1a2416]" />

        <div className="relative container mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 max-w-4xl text-center">
          <nav aria-label="Breadcrumb" className="flex justify-center mb-6">
            <ol className="flex items-center gap-1.5 text-[11px] text-white/50">
              <li><Link href="/" className="hover:text-white/80 transition-colors">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li>
                {activeCategory
                  ? <button onClick={() => handleCategoryClick(undefined)} className="hover:text-white/80 transition-colors">Recipes</button>
                  : <span className="text-white/80 font-medium">Recipes</span>}
              </li>
              {activeCategory && (
                <>
                  <li aria-hidden="true">/</li>
                  <li className="text-white/80 font-medium">{activeCategory}</li>
                </>
              )}
            </ol>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/30 border border-primary/40 text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-4">
            <Sparkles className="w-3 h-3" />
            {loading ? "Recipes" : `${items.length} Recipes`}
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-bold mb-4 leading-tight text-white">
            {catMeta ? catMeta.h2 : "Tea Recipes from Around the World"}
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-2xl mx-auto leading-relaxed">
            {catMeta
              ? catMeta.description
              : "From a kulhad of Kolkata bhar chai to a pot of Marrakech mint — recipes submitted by Dr Tea customers, tested in our kitchen, told in story mode."}
          </p>

          {/* Search */}
          <div className="mt-7 max-w-sm sm:max-w-md mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search chai, matcha, kahwa…"
              className="w-full pl-10 pr-4 h-11 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all"
              aria-label="Search recipes"
            />
          </div>

          {/* Trending pills */}
          {!q && !activeCategory && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1 mr-1">
                <TrendingUp className="w-3 h-3" /> Trending:
              </span>
              {TRENDING_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => { searchRef.current?.focus(); setQ(tag); }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors border border-white/10"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CATEGORY CHIPS ───────────────────────────────────────────── */}
      <div className="sticky top-[56px] sm:top-[64px] z-20 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide -mx-1 px-1" role="group" aria-label="Filter by category">
            <CategoryChip active={!activeCategory} label="All" count={loading ? undefined : items.length} onClick={() => handleCategoryClick(undefined)} />
            {categories.map((c) => (
              <CategoryChip
                key={c.category}
                active={activeCategory === c.category}
                label={c.category}
                count={c.count}
                emoji={CATEGORY_META[c.category]?.emoji}
                onClick={() => handleCategoryClick(c.category)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── RECIPE GRID ──────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-6xl">
        {loading ? (
          <RecipesSkeleton />
        ) : items.length === 0 ? (
          <EmptyState onReset={() => { setQ(""); handleCategoryClick(undefined); }} />
        ) : (
          <>
            {/* Featured hero card */}
            {featured && !q && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 sm:mb-10">
                <FeaturedRecipeCard recipe={featured} />
              </motion.div>
            )}

            {/* Cross-sell banner — shown after featured */}
            {!q && !activeCategory && (
              <CrossSellBanner />
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {(q ? items : rest).map((r, i) => (
                <motion.div
                  key={r.slug}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.035, 0.25) }}
                >
                  <RecipeCard recipe={r} />
                </motion.div>
              ))}
            </div>

            {/* Bottom CTA */}
            {!q && items.length > 6 && (
              <div className="mt-14 rounded-2xl bg-[#1a2416] p-6 sm:p-8 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-2">
                  Brew better with Dr Tea
                </p>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mb-3">
                  Every great recipe starts with great tea
                </h2>
                <p className="text-sm text-white/65 max-w-md mx-auto mb-6">
                  Single-estate Darjeeling, hand-blended masala chai, premium matcha — sourced from the best gardens in India and shipped in 24 hours.
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

/* ── CROSS-SELL BANNER ───────────────────────────────────────────── */
function CrossSellBanner() {
  return (
    <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { icon: <Flame className="w-4 h-4 text-amber-600" />, label: "Free shipping", sub: "on orders above ₹999" },
        { icon: <Leaf className="w-4 h-4 text-green-700" />, label: "Single-estate teas", sub: "from Assam & Darjeeling" },
        { icon: <Star className="w-4 h-4 text-yellow-500" />, label: "Matched tea packs", sub: "for every recipe" },
      ].map((item) => (
        <Link
          key={item.label}
          href="/shop"
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

/* ── FEATURED CARD ───────────────────────────────────────────────── */
function FeaturedRecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const emoji = CATEGORY_META[recipe.category]?.emoji ?? "🍵";
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group grid sm:grid-cols-[1fr_1fr] lg:grid-cols-[3fr_2fr] rounded-2xl overflow-hidden border border-border bg-card hover:shadow-xl transition-all"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] sm:aspect-auto min-h-[200px] sm:min-h-[280px] bg-muted overflow-hidden">
        <img
          src={recipe.hero || HERO_FALLBACK}
          alt={`${recipe.title} — ${recipe.category} recipe by Dr Tea`}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 sm:top-4 sm:left-4 inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-foreground shadow-sm">
          <span aria-hidden="true">{emoji}</span> {recipe.category}
        </span>
        <span className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2 sm:px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
          Featured
        </span>
      </div>
      {/* Content */}
      <div className="p-5 sm:p-6 lg:p-8 flex flex-col justify-center">
        {recipe.origin && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold mb-2 inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {recipe.origin}
          </p>
        )}
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold mb-2 sm:mb-3 leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {recipe.title}
        </h2>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-2 sm:line-clamp-3">{recipe.summary}</p>
        <RecipeMeta recipe={recipe} />
        {recipe.authorName && <RecipeByline recipe={recipe} className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/60" />}
        <span className="mt-4 sm:mt-5 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary uppercase tracking-wider group-hover:gap-2.5 transition-all">
          View Recipe <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* ── RECIPE CARD ─────────────────────────────────────────────────── */
function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const emoji = CATEGORY_META[recipe.category]?.emoji ?? "🍵";
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all h-full"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <img
          src={recipe.hero || HERO_FALLBACK}
          alt={`${recipe.title} — ${recipe.category} recipe`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-foreground/90 shadow-sm">
          <span aria-hidden="true">{emoji}</span> {recipe.category}
        </span>
        <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider capitalize ${
          recipe.difficulty === "easy" ? "bg-green-100 text-green-800"
            : recipe.difficulty === "medium" ? "bg-amber-100 text-amber-800"
            : "bg-red-100 text-red-800"
        }`}>
          {recipe.difficulty}
        </span>
      </div>
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        {recipe.origin && (
          <p className="text-[10px] text-amber-700 font-semibold mb-1 inline-flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" /> {recipe.origin}
          </p>
        )}
        <h3 className="text-[15px] sm:text-base font-serif font-semibold mb-1.5 sm:mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">
          {recipe.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{recipe.summary}</p>
        <RecipeMeta recipe={recipe} compact />
        {recipe.authorName && (
          <RecipeByline recipe={recipe} className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-border/60" />
        )}
      </div>
    </Link>
  );
}

/* ── SHARED SUBCOMPONENTS ────────────────────────────────────────── */
function RecipeMeta({ recipe, compact = false }: { recipe: RecipeListItem; compact?: boolean }) {
  const total = recipe.prepMinutes + recipe.cookMinutes;
  return (
    <div className={`flex flex-wrap gap-2.5 sm:gap-3 text-[11px] text-muted-foreground ${compact ? "" : "mt-1"}`}>
      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {total} min</span>
      <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> Serves {recipe.servings}</span>
      <span className="inline-flex items-center gap-1 capitalize"><ChefHat className="w-3 h-3" /> {recipe.difficulty}</span>
    </div>
  );
}

function RecipeByline({ recipe, className = "" }: { recipe: RecipeListItem; className?: string }) {
  if (!recipe.authorName) return null;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {recipe.authorAvatar ? (
        <img src={recipe.authorAvatar} alt={recipe.authorName} className="w-6 h-6 rounded-full object-cover ring-1 ring-border flex-none" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-700 flex-none">
          {recipe.authorName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground truncate">
        By <span className="font-semibold text-foreground/80">{recipe.authorName}</span>
        {recipe.authorLocation && <span className="text-foreground/50"> · {recipe.authorLocation}</span>}
      </p>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-16">
      <ChefHat className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
      <p className="text-base font-semibold text-foreground/70 mb-1">No recipes found</p>
      <p className="text-sm text-muted-foreground mb-5">Try a different search or browse all categories.</p>
      <button onClick={onReset} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        Browse all recipes
      </button>
    </div>
  );
}

function RecipesSkeleton() {
  return (
    <div>
      <div className="mb-8 rounded-2xl overflow-hidden border border-border animate-pulse grid sm:grid-cols-2">
        <div className="aspect-[4/3] sm:aspect-auto min-h-[200px] bg-muted" />
        <div className="p-6 sm:p-8 space-y-3">
          <div className="h-3 bg-muted rounded w-1/4" />
          <div className="h-6 bg-muted rounded w-4/5" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="flex gap-3 mt-4">
            {[1,2,3].map(i => <div key={i} className="h-3 bg-muted rounded w-14" />)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-border animate-pulse">
            <div className="aspect-[4/3] bg-muted" />
            <div className="p-4 space-y-2.5">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-5 bg-muted rounded w-4/5" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="flex gap-3 mt-3">
                {[1,2,3].map(j => <div key={j} className="h-3 bg-muted rounded w-12" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
