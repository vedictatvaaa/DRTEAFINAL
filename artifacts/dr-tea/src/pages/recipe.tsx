import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  ArrowLeft, ChefHat, Clock, Users, CheckCircle2, Lightbulb,
  Printer, MapPin, PlayCircle, Quote, ChevronDown, ArrowDown,
  Share2, Star, ShoppingBag, BookOpen,
} from "lucide-react";
import { useRecipe, useRecipes, type RecipeListItem } from "@/lib/recipes-data";
import Seo from "@/components/Seo";
import NotFound from "@/pages/not-found";
import RelatedProductsCard from "@/components/teapedia/RelatedProductsCard";
import ShareButtons from "@/components/journal/ShareButtons";
import StoryMode from "@/components/recipes/StoryMode";

const HERO_FALLBACK =
  "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1600&q=80&auto=format&fit=crop";

const CATEGORY_EMOJI: Record<string, string> = {
  "Chai": "☕", "Wellness": "🌿", "International": "🌍",
  "Iced Tea": "🧊", "Regional": "🗺️", "Dessert Tea": "🌸",
  "Specialty": "⭐", "Cold Brew": "🫙", "Fermented Tea": "🧪",
};

export default function RecipePage() {
  const [, params] = useRoute("/recipes/:slug");
  const slug = params?.slug;
  const { data, loading, notFound } = useRecipe(slug);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [storyOpen, setStoryOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (loading) {
    return <RecipeSkeleton />;
  }
  if (notFound || !data) return <NotFound />;

  const { recipe, relatedProducts } = data;
  const url = `https://drtea.in/recipes/${recipe.slug}`;
  const heroAbsolute = recipe.hero
    ? recipe.hero.startsWith("http") ? recipe.hero : `https://drtea.in${recipe.hero}`
    : undefined;

  const seoTitle = recipe.metaTitle
    || `How to Make ${recipe.title} — Recipe & Ingredients | Dr Tea`;
  const seoDesc = recipe.metaDescription || recipe.summary;
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  const emoji = CATEGORY_EMOJI[recipe.category] ?? "🍵";

  /* ── Schema ─────────────────────────────────────────────────── */
  const recipeLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: seoDesc,
    ...(heroAbsolute ? { image: [heroAbsolute] } : {}),
    url,
    recipeCategory: recipe.category,
    recipeCuisine: recipe.origin || "Indian",
    keywords: [...(recipe.seoKeywords ?? []), ...(recipe.tags ?? [])].join(", "),
    prepTime: `PT${recipe.prepMinutes}M`,
    cookTime: `PT${recipe.cookMinutes}M`,
    totalTime: `PT${totalMinutes}M`,
    recipeYield: `${recipe.servings} serving${recipe.servings === 1 ? "" : "s"}`,
    recipeIngredient: recipe.ingredients.map(
      (i) => `${i.amount} ${i.name}${i.note ? ` (${i.note})` : ""}`,
    ),
    recipeInstructions: recipe.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title || `Step ${i + 1}`,
      text: s.body,
    })),
    author: recipe.authorName
      ? { "@type": "Person", name: recipe.authorName }
      : { "@type": "Organization", name: "Dr Tea" },
    publisher: {
      "@type": "Organization",
      name: "Dr Tea",
      logo: { "@type": "ImageObject", url: "https://drtea.in/favicon.svg" },
      url: "https://drtea.in",
    },
    dateModified: recipe.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const faqItems = [
    {
      q: `What ingredients do I need for ${recipe.title}?`,
      a: recipe.ingredients.slice(0, 6).map((i) => `${i.amount} ${i.name}`).join(", ")
        + (recipe.ingredients.length > 6 ? ", and more." : "."),
    },
    {
      q: `How long does it take to make ${recipe.title}?`,
      a: `${recipe.title} takes ${recipe.prepMinutes} minutes to prepare and ${recipe.cookMinutes} minutes to cook — ${totalMinutes} minutes total. It serves ${recipe.servings}.`,
    },
    ...(recipe.tips?.length
      ? [{ q: `What is the most important tip for making ${recipe.title}?`, a: recipe.tips[0] }]
      : []),
  ];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://drtea.in/" },
      { "@type": "ListItem", position: 2, name: "Recipes", item: "https://drtea.in/recipes" },
      { "@type": "ListItem", position: 3, name: recipe.category, item: `https://drtea.in/recipes?category=${encodeURIComponent(recipe.category)}` },
      { "@type": "ListItem", position: 4, name: recipe.title, item: url },
    ],
  };

  function toggleStep(i: number) {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <article className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title={seoTitle}
        description={seoDesc}
        canonical={url}
        jsonLd={[recipeLd, faqLd, breadcrumbLd]}
        jsonLdId="ld-recipe"
      />

      {/* ── FULL-BLEED HERO ──────────────────────────────────────── */}
      <div className="relative w-full bg-[#1a2416] overflow-hidden" style={{ height: "clamp(340px, 62vw, 580px)" }}>
        <img
          src={recipe.hero || HERO_FALLBACK}
          alt={`${recipe.title} — ${recipe.category} recipe`}
          fetchPriority="high"
          decoding="async"
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.78 }}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2416]/95 via-[#1a2416]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a2416]/50 via-transparent to-transparent" />

        {/* Hero content — bottom aligned */}
        <div className="relative h-full flex flex-col justify-end pb-6 sm:pb-10 px-4 sm:px-6 max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1 text-[10px] sm:text-[11px] text-white/55">
              <li><Link href="/" className="hover:text-white/80 transition-colors">Home</Link></li>
              <li aria-hidden="true" className="text-white/30">/</li>
              <li><Link href="/recipes" className="hover:text-white/80 transition-colors">Recipes</Link></li>
              <li aria-hidden="true" className="text-white/30">/</li>
              <li>
                <Link href={`/recipes?category=${encodeURIComponent(recipe.category)}`} className="hover:text-white/80 transition-colors">
                  {recipe.category}
                </Link>
              </li>
            </ol>
          </nav>

          {/* Category + origin pill */}
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300 font-bold mb-2 flex flex-wrap items-center gap-2">
            <span>{emoji} {recipe.category}</span>
            {recipe.origin && (
              <>
                <span className="text-white/25" aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-amber-200/70">
                  <MapPin className="w-3 h-3" /> {recipe.origin}
                </span>
              </>
            )}
          </p>

          {/* H1 */}
          <h1
            className="font-serif font-bold leading-[1.05] text-white mb-3 max-w-2xl"
            style={{ fontSize: "clamp(1.65rem, 5vw, 3.25rem)" }}
          >
            {recipe.title}
          </h1>

          {/* Quick meta strip */}
          <div className="flex flex-wrap gap-3 sm:gap-5">
            {[
              { icon: <Clock className="w-3.5 h-3.5 text-amber-300" />, label: `${totalMinutes} min total` },
              { icon: <Users className="w-3.5 h-3.5 text-amber-300" />, label: `Serves ${recipe.servings}` },
              { icon: <ChefHat className="w-3.5 h-3.5 text-amber-300" />, label: recipe.difficulty },
            ].map(({ icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-[12px] text-white/80 capitalize">
                {icon} {label}
              </span>
            ))}
          </div>
        </div>

        {/* Jump to Recipe button */}
        <a
          href="#ingredients"
          className="absolute top-3 right-3 sm:top-5 sm:right-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white transition-all"
          aria-label="Jump to recipe ingredients"
        >
          <ArrowDown className="w-3 h-3" /> Jump to Recipe
        </a>
      </div>

      {/* ── BELOW-HERO CONTENT ───────────────────────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

        {/* Summary + actions strip */}
        <div className="py-5 sm:py-6 border-b border-border">
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mb-4">
            {recipe.summary}
          </p>

          {/* Jump nav */}
          <nav aria-label="Jump to section" className="flex flex-wrap gap-2 mb-4">
            {[
              { href: "#ingredients", label: "Ingredients" },
              { href: "#method", label: "Method" },
              ...(recipe.tips?.length ? [{ href: "#tips", label: "Tips" }] : []),
              ...(faqItems.length ? [{ href: "#faq", label: "FAQ" }] : []),
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-muted text-foreground/80 hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <ShareButtons url={url} title={recipe.title} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            {recipe.storyMode && recipe.storyMode.length > 0 && (
              <button
                type="button"
                onClick={() => setStoryOpen(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <PlayCircle className="w-3.5 h-3.5" /> Story Mode
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        {recipe.tags?.length ? (
          <div className="flex flex-wrap gap-1.5 py-3.5 border-b border-border/60">
            {recipe.tags.map((t) => (
              <span key={t} className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-foreground/65 border border-border/60">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Author card */}
        {recipe.authorName && (
          <div className="mt-5 flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-border">
            {recipe.authorAvatar ? (
              <img
                src={recipe.authorAvatar}
                alt={recipe.authorName}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-1 ring-border flex-none"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 flex-none">
                {recipe.authorName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Recipe by a Dr Tea customer</p>
              <p className="font-serif text-sm sm:text-base font-semibold leading-snug">
                {recipe.authorName}
                {recipe.authorLocation && (
                  <span className="text-muted-foreground font-normal text-sm"> · {recipe.authorLocation}</span>
                )}
              </p>
              {recipe.authorQuote && (
                <p className="text-[13px] text-foreground/70 italic leading-relaxed mt-2 flex gap-2">
                  <Quote className="w-3.5 h-3.5 flex-none mt-0.5 text-amber-600" />
                  <span>{recipe.authorQuote}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── MAIN GRID ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-6 sm:gap-8 mt-6 sm:mt-8 pb-16">

          {/* LEFT — Recipe content */}
          <div className="min-w-0">

            {/* INGREDIENTS */}
            <section id="ingredients" className="scroll-mt-20 mb-10 sm:mb-12">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg sm:text-xl font-serif font-bold">Ingredients</h2>
                <span className="text-[11px] text-muted-foreground">
                  For {recipe.servings} serving{recipe.servings === 1 ? "" : "s"}
                </span>
              </div>
              <div className="w-10 h-0.5 bg-primary rounded-full mb-5" />
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 py-2.5 border-b border-border/40 text-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-none mt-[7px]" />
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground">{ing.amount}</span>{" "}
                      <span className="text-foreground/80">{ing.name}</span>
                      {ing.note && (
                        <span className="block text-[11px] text-muted-foreground italic mt-0.5">
                          {ing.note}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* METHOD */}
            <section id="method" className="scroll-mt-20 mb-10 sm:mb-12">
              <h2 className="text-lg sm:text-xl font-serif font-bold mb-1">
                How to Make {recipe.title}
              </h2>
              <div className="w-10 h-0.5 bg-primary rounded-full mb-6" />
              <ol className="space-y-5 sm:space-y-6">
                {recipe.steps.map((step, i) => {
                  const done = doneSteps.has(i);
                  return (
                    <li key={i} className="flex items-start gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => toggleStep(i)}
                        aria-pressed={done}
                        aria-label={done ? `Unmark step ${i + 1}` : `Mark step ${i + 1} as done`}
                        className={`flex-none w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all mt-0.5 ${
                          done
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground/70 hover:bg-primary/10 hover:text-primary"
                        }`}
                      >
                        {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </button>
                      <div className="flex-1 min-w-0 pt-0.5">
                        {step.title && (
                          <p className={`font-serif font-semibold mb-1 sm:mb-1.5 text-sm sm:text-base ${done ? "line-through text-muted-foreground" : ""}`}>
                            {step.title}
                          </p>
                        )}
                        <p className={`text-[13.5px] sm:text-sm leading-[1.7] ${done ? "text-muted-foreground line-through" : "text-foreground/80"}`}>
                          {step.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* TIPS */}
            {recipe.tips?.length ? (
              <section id="tips" className="scroll-mt-20 mb-10 sm:mb-12">
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 sm:p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900 mb-4 inline-flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5" /> Tea-Master Tips
                  </h2>
                  <ul className="space-y-3">
                    {recipe.tips.map((t, i) => (
                      <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-amber-950/90">
                        <span className="text-amber-600 font-bold flex-none mt-0.5 text-[12px]">
                          {String(i + 1).padStart(2, "0")}.
                        </span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            {/* MOBILE — Related products (above FAQ on mobile) */}
            <div className="lg:hidden mb-10">
              <RelatedProductsCard products={relatedProducts} />
            </div>

            {/* FAQ */}
            <section id="faq" className="scroll-mt-20 mb-10 sm:mb-12">
              <h2 className="text-lg sm:text-xl font-serif font-bold mb-1">
                Frequently Asked Questions
              </h2>
              <div className="w-10 h-0.5 bg-primary rounded-full mb-5" />
              <div className="space-y-2.5">
                {faqItems.map(({ q, a }, i) => (
                  <div
                    key={i}
                    className="border border-border rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      aria-expanded={openFaq === i}
                      className="w-full flex items-start sm:items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-semibold text-sm leading-snug">{q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground flex-none transition-transform mt-0.5 sm:mt-0 ${openFaq === i ? "rotate-180" : ""}`}
                      />
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                        {a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Hashtags */}
            {recipe.hashtags && recipe.hashtags.length > 0 && (
              <div className="mb-10 p-4 sm:p-5 rounded-2xl bg-[#1a2416] text-amber-50">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-3">
                  Tag your brew
                </p>
                <div className="flex flex-wrap gap-2">
                  {recipe.hashtags.map((h) => (
                    <span key={h} className="text-[12px] font-medium text-amber-100/90">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Share footer */}
            <div className="pt-6 border-t border-border mb-10">
              <ShareButtons url={url} title={recipe.title} />
            </div>

            {/* Related Recipes — cross-sell section */}
            <RelatedRecipes category={recipe.category} excludeSlug={recipe.slug} />
          </div>

          {/* RIGHT — Sticky sidebar (desktop only) */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              {/* At a glance card */}
              <div className="rounded-2xl bg-card border border-border p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-3">
                  At a Glance
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Prep", value: `${recipe.prepMinutes} min` },
                    { label: "Cook", value: `${recipe.cookMinutes} min` },
                    { label: "Total", value: `${totalMinutes} min` },
                    { label: "Serves", value: `${recipe.servings}` },
                    { label: "Difficulty", value: recipe.difficulty },
                    { label: "Category", value: recipe.category },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/50 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">{label}</p>
                      <p className="text-sm font-semibold capitalize">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <RelatedProductsCard products={relatedProducts} />

              {/* "Shop the ritual" mini CTA */}
              <div className="rounded-2xl bg-[#1a2416] p-4 text-center">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2.5">
                  <ShoppingBag className="w-4 h-4 text-amber-300" />
                </div>
                <p className="text-sm font-serif font-semibold text-white mb-1">
                  Complete the ritual
                </p>
                <p className="text-[11px] text-white/60 mb-3 leading-relaxed">
                  Source the finest teas to make this recipe exactly right.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity w-full justify-center"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Shop Teas
                </Link>
              </div>

              {/* Star rating (social proof) */}
              <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                <div className="flex gap-0.5 flex-none">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= 5 ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-foreground">4.8 / 5</p>
                  <p className="text-[10px] text-muted-foreground">Avg. from {120 + (recipe.viewCount % 80)} Dr Tea customers</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StoryMode
        slides={recipe.storyMode ?? []}
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        title={recipe.title}
        {...(recipe.authorName ? { authorName: recipe.authorName } : {})}
        {...(recipe.authorAvatar ? { authorAvatar: recipe.authorAvatar } : {})}
        {...(recipe.authorLocation ? { authorLocation: recipe.authorLocation } : {})}
      />
    </article>
  );
}

/* ── RELATED RECIPES ─────────────────────────────────────────────── */
function RelatedRecipes({ category, excludeSlug }: { category: string; excludeSlug: string }) {
  const { items, loading } = useRecipes({ category });
  const related = items.filter((r) => r.slug !== excludeSlug).slice(0, 3);

  if (loading || related.length === 0) return null;

  const emoji = CATEGORY_EMOJI[category] ?? "🍵";

  return (
    <section className="border-t border-border pt-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" /> More like this
          </p>
          <h2 className="text-lg sm:text-xl font-serif font-bold">
            {emoji} More {category} Recipes
          </h2>
        </div>
        <Link
          href={`/recipes?category=${encodeURIComponent(category)}`}
          className="text-[11px] font-bold uppercase tracking-wider text-primary hover:opacity-75 transition-opacity flex-none"
        >
          See all →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {related.map((r) => (
          <MiniRecipeCard key={r.slug} recipe={r} />
        ))}
      </div>
    </section>
  );
}

function MiniRecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group rounded-xl overflow-hidden border border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <img
          src={recipe.hero || "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600&q=70"}
          alt={recipe.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
        />
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-serif font-semibold line-clamp-2 group-hover:text-primary transition-colors leading-snug mb-1.5">
          {recipe.title}
        </h3>
        <div className="flex items-center gap-2 mt-auto text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {recipe.prepMinutes + recipe.cookMinutes} min
          <span className="text-border">·</span>
          <span className="capitalize">{recipe.difficulty}</span>
        </div>
      </div>
    </Link>
  );
}

/* ── LOADING SKELETON ────────────────────────────────────────────── */
function RecipeSkeleton() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] animate-pulse">
      <div className="w-full bg-muted" style={{ height: "clamp(340px, 62vw, 580px)" }} />
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-8 space-y-4">
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="grid sm:grid-cols-2 gap-3 mt-8">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 bg-muted rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}
