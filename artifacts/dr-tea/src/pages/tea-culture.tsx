import { Link } from "wouter";
import { ArrowRight, Globe, Sparkles } from "lucide-react";
import ContentHubListPage from "@/components/content/ContentHubList";
import TrendingRail from "@/components/content/TrendingRail";
import Seo from "@/components/Seo";

const REGIONS = [
  { label: "Assam", emoji: "🌿", desc: "Bold, malty, the world's largest tea garden" },
  { label: "Darjeeling", emoji: "🏔️", desc: "First flush, muscatel, the champagne of teas" },
  { label: "Nilgiris", emoji: "🫖", desc: "Brisk, fragrant, South India's blue mountain brew" },
  { label: "Kashmir", emoji: "❄️", desc: "Saffron noon chai, pink, salted, spiced" },
  { label: "Kerala", emoji: "🌴", desc: "Sulaimani black tea, cardamom, and lemon" },
  { label: "Sikkim", emoji: "🌸", desc: "Organic, rare single-estate Temi Tea" },
];

export default function TeaCulturePage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://drtea.in/" },
      { "@type": "ListItem", position: 2, name: "Tea Culture", item: "https://drtea.in/tea-culture" },
    ],
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="Tea Culture — Regional Indian Tea Traditions & Rituals | Dr Tea"
        description="Explore India's rich tea culture — from Assam estate brews and Darjeeling first flush to Kashmiri noon chai and Kerala sulaimani. Regional traditions, brewing rituals, and the stories behind every cup."
        canonical="https://drtea.in/tea-culture"
        jsonLd={[breadcrumbLd]}
        jsonLdId="ld-tea-culture"
      />

      {/* ── DARK EDITORIAL HERO ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1a2416]">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=1400&q=60&auto=format&fit=crop)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2416]/50 via-[#1a2416]/75 to-[#1a2416]" />

        <div className="relative container mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 max-w-4xl text-center">
          <nav aria-label="Breadcrumb" className="flex justify-center mb-5">
            <ol className="flex items-center gap-1.5 text-[11px] text-white/45">
              <li>
                <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-white/70 font-medium">Tea Culture</li>
            </ol>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 border border-primary/35 text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-4">
            <Globe className="w-3 h-3" />
            Regional Traditions
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-bold mb-4 leading-tight text-white">
            Tea Culture Across India
          </h1>
          <p className="text-sm sm:text-base text-white/65 max-w-2xl mx-auto leading-relaxed">
            Every state has a brew. Every brew has a story. From the mist-covered gardens
            of Assam to the saffron-kissed cups of Kashmir — India's tea traditions are as
            diverse as its people.
          </p>
        </div>
      </section>

      {/* ── REGIONAL QUICK LINKS ─────────────────────────────────────── */}
      <section className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-primary" /> Explore by Region
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {REGIONS.map((r) => (
            <div
              key={r.label}
              className="group flex flex-col items-center text-center p-3 sm:p-4 rounded-2xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              <span className="text-2xl mb-2" aria-hidden="true">{r.emoji}</span>
              <p className="text-[13px] font-bold text-foreground mb-1">{r.label}</p>
              <p className="text-[10px] text-muted-foreground leading-snug hidden sm:block">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CROSS-SELL STRIP ─────────────────────────────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { emoji: "🍵", label: "Tea Recipes", sub: "93 regional brews, step-by-step", href: "/recipes" },
            { emoji: "📖", label: "Teapedia", sub: "Look up any tea term or origin", href: "/teapedia" },
            { emoji: "🛍️", label: "Shop by Origin", sub: "Single-estate teas from ₹299", href: "/shop" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-none text-base group-hover:bg-primary/10 transition-colors">
                {item.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-foreground leading-none mb-0.5">{item.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-none opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── TRENDING RAIL ─────────────────────────────────────────────── */}
      <TrendingRail kind="hub" hub="regional" limit={8} title="Trending tea cultures this week" />

      {/* ── MAIN CONTENT HUB ─────────────────────────────────────────── */}
      <ContentHubListPage hub="regional" />

      {/* ── BOTTOM CTA ───────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 pb-16 max-w-5xl">
        <div className="rounded-2xl bg-[#1a2416] p-6 sm:p-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-2">
            From the culture to the cup
          </p>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mb-3">
            Taste India's tea heritage
          </h2>
          <p className="text-sm text-white/65 max-w-md mx-auto mb-6">
            Single-estate Darjeeling, hand-blended masala chai, premium Assam gold —
            teas with stories, shipped in 24 hours from our warehouse in Assam.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Shop All Teas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
