import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight, Heart, Plus, Check, ChevronRight, Star, Sparkles, Award, Leaf, ShieldCheck, Package } from 'lucide-react';
import { useProducts, useArticles } from '@/lib/api-data';
import { useGetActiveExperience } from '@workspace/api-client-react';
import ExperienceHero from '@/components/experience/ExperienceHero';
import { useStore } from '@/store/use-store';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/currency';
import Seo from '@/components/Seo';
import { useHomepageSeo } from '@/hooks/use-homepage-seo';
import ProductImage from '@/components/product/ProductImage';
import { Cta, CtaLink } from '@/components/ui/Cta';
import drTeaGoldJar from '@assets/IMG_3968.JPG_1778439476266.jpeg';

// Intent shortcuts — deliberately do NOT duplicate the 6-card category grid
// below (Chai, Tea Reserve, etc.). Pills are for things the grid can't express:
// best-of cuts, dietary filters, gifting, and the quiz.
const AVAILABLE_SLUGS = new Set(['blue-pea-flower', 'hibiscus-tea', 'dr-tea-gold-ctc']);

const quickPills = [
  { label: 'Bestsellers',   icon: '⭐', href: '/shop' },
  { label: 'New Launches',  icon: '✨', href: '/shop' },
  { label: 'Caffeine Free', icon: '🌺', href: '/shop/floral-tisane' },
  { label: 'Kadha Blends',  icon: '🌿', href: '/shop/kadha' },
  { label: 'Gifting',       icon: '🎁', href: '/gift-cards' },
  { label: 'Take Quiz',     icon: '🍃', href: '/quiz' },
];


const catCards = [
  { name: 'Floral Tisane', slug: 'floral-tisane', tag: 'Calm · Floral · Caffeine Free', bg: '#7B5FA0', img: '/images/category-floral.webp' },
  { name: 'Chai',          slug: 'chai',          tag: 'Strong · Spiced · Comfort',     bg: '#8B4424', img: '/images/category-chai.webp' },
  { name: 'Kadha',         slug: 'kadha',         tag: 'Ayurvedic · Healing',           bg: '#3a5a2c', img: '/images/category-kadha.webp' },
  { name: 'Green Tea',     slug: 'green-tea',     tag: 'Fresh · Light · Everyday',      bg: '#4a6b3c', img: '/images/category-green.webp' },
  { name: 'Black Tea',     slug: 'black-tea',     tag: 'Classic · Rich · Timeless',     bg: '#2a2520', img: '/images/category-black.webp' },
  { name: 'Tea Reserve',   slug: 'tea-reserve',   tag: 'Rare · Premium · Limited',      bg: '#1a1a1a', img: '/images/category-reserve.webp' },
];

const trustBadges = [
  {
    Icon: Leaf,
    title: 'Direct from Estates',
    sub: 'Heritage gardens in Darjeeling, Assam & Nilgiris.',
    accent: '#3a5a2c',
    bg: 'from-[#f4f7ec] to-[#e9efd9]',
    ring: 'ring-[#3a5a2c]/15',
    badge: 'Single-Origin',
  },
  {
    Icon: ShieldCheck,
    title: '100% Natural Ingredients',
    sub: 'Pure. Clean. No artificial flavours.',
    accent: '#1f6f54',
    bg: 'from-[#eef7f1] to-[#dcecde]',
    ring: 'ring-[#1f6f54]/15',
    badge: 'No Additives',
  },
  {
    Icon: Package,
    title: 'Fresh & Hygienic Packaging',
    sub: 'Sealed to lock in freshness and aroma.',
    accent: '#8B4424',
    bg: 'from-[#fbf2e8] to-[#f3e2cc]',
    ring: 'ring-[#8B4424]/15',
    badge: 'Sealed Fresh',
  },
  {
    Icon: Award,
    title: 'Made in India, Loved Globally',
    sub: "Proudly blending India's finest teas.",
    accent: '#a35a1b',
    bg: 'from-[#fdf1e2] to-[#f6dec1]',
    ring: 'ring-[#a35a1b]/15',
    badge: 'Crafted in India',
  },
];

const communityPhotos = [
  '/images/community-1.webp',
  '/images/community-2.webp',
  '/images/community-3.webp',
  '/images/community-4.webp',
  '/images/community-5.webp',
  '/images/community-6.webp',
  '/images/community-7.webp',
];

const gardenSteps = [
  { icon: '🌿', step: '01', title: 'Single-Origin',   body: 'Named garden, named season.' },
  { icon: '✋', step: '02', title: 'Hand-Plucked',     body: 'Harvested at peak hours.' },
  { icon: '🔥', step: '03', title: 'Traditional',     body: 'Withered, fixed, fermented.' },
  { icon: '⚖️', step: '04', title: 'Small-Batch',     body: 'Blended in 5–10kg lots.' },
  { icon: '📦', step: '05', title: 'Sealed Fresh',    body: 'Nitrogen-flushed, <7 days.' },
];

const journalAccents = ['#3A6B2A', '#7B3F1E', '#0D0D0D'];

interface MostLovedItem {
  slug: string;
  name: string;
  sub: string;
  price: number;
  fomo: string | null;
  img: string;
}
interface MostLovedCardProps {
  item: MostLovedItem;
  onAdd: () => void;
  onWishlist: () => void;
  isWishlisted: boolean;
}

function MostLovedCard({ item, onAdd, onWishlist, isWishlisted }: MostLovedCardProps) {
  const [added, setAdded] = useState(false);
  const currency = useStore((s) => s.currency);
  const available = AVAILABLE_SLUGS.has(item.slug);
  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!available) return;
    onAdd();
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };
  return (
    <div className={`flex-shrink-0 w-[180px] bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col snap-start relative ${!available ? 'pointer-events-none' : ''}`}>
      <Link href={available ? `/product/${item.slug}` : '#'} onClick={(e) => { if (!available) e.preventDefault(); }} className="block relative aspect-square bg-[#f7f5f1] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]">
        <ProductImage src={item.img} name={item.name} className={`absolute inset-0 w-full h-full object-cover ${!available ? 'blur-sm grayscale opacity-60' : ''}`} />
        {available && (
          <button onClick={(e) => { e.preventDefault(); onWishlist(); }} aria-label={`${isWishlisted ? 'Remove from' : 'Add to'} wishlist`} className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/95 shadow-sm flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]">
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </button>
        )}
        {available && item.fomo && (
          <span className="absolute top-2 left-2 bg-[#1a2416] text-white text-[8px] uppercase tracking-wider px-2 py-1 rounded-sm font-bold">
            {item.fomo}
          </span>
        )}
        {!available && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-black/75 text-white text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm font-bold">
              Out of Stock
            </span>
          </div>
        )}
      </Link>
      <div className={`p-3 flex flex-col flex-1 ${!available ? 'opacity-50' : ''}`}>
        <Link href={available ? `/product/${item.slug}` : '#'} onClick={(e) => { if (!available) e.preventDefault(); }}>
          <h4 className="text-[13px] font-semibold leading-tight text-[#1a2416]">{item.name}</h4>
          <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
        </Link>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[14px] font-bold text-[#1a2416]">{formatPrice(item.price, currency)}</span>
          <button onClick={handleAdd} disabled={!available} aria-label={available ? `Add ${item.name} to cart` : `${item.name} out of stock`} className={`flex items-center gap-1 px-3 py-2.5 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${!available ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : added ? 'bg-green-700 text-white' : 'bg-[#f0ede4] text-[#1a2416] hover:bg-[#1a2416] hover:text-white'}`}>
            {!available ? 'OOS' : added ? <><Check className="w-2.5 h-2.5" /> Added</> : <><Plus className="w-2.5 h-2.5" /> Add</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [videoReady, setVideoReady] = useState(false);
  const { addToCart, toggleWishlist, wishlist, openSearch } = useStore();
  const currency = useStore((s) => s.currency);
  const { toast } = useToast();
  const { products } = useProducts();
  const { articles } = useArticles();
  const { data: activeExperience } = useGetActiveExperience();
  const heroTakeover = activeExperience?.heroTakeover ?? null;
  const homepageSeo = useHomepageSeo();

  const findRealProduct = (slug: string) => products.find(p => p.slug === slug);

  const mostLoved: MostLovedItem[] = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.reviewCount - a.reviewCount)
        .slice(0, 5)
        .map((p) => ({
          slug: p.slug,
          name: p.name,
          sub: (p.flavorProfile ?? []).slice(0, 3).join(' · ') || p.shortDescription || p.category,
          price: p.price,
          fomo: p.fomoTag ?? null,
          img: p.imageUrl,
        })),
    [products],
  );

  const newLaunches = useMemo(() => {
    const lovedSlugs = new Set(mostLoved.map((m) => m.slug));
    return products
      .filter((p) => !lovedSlugs.has(p.slug))
      .slice(0, 3)
      .map((p) => ({ slug: p.slug, name: p.name, price: p.price, img: p.imageUrl }));
  }, [products, mostLoved]);

  const journalPosts = useMemo(
    () =>
      articles.slice(0, 3).map((a, i) => ({
        slug: a.slug,
        tag: a.category,
        color: journalAccents[i % journalAccents.length],
        img: a.cover,
        title: a.title,
        excerpt: a.excerpt,
        readTime: a.readTime,
      })),
    [articles],
  );


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
        // clear hash without navigation
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      }
    };
    tryScroll();
    const t = window.setTimeout(tryScroll, 250);
    return () => window.clearTimeout(t);
  }, []);

  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://drtea.in/' },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://drtea.in/shop' },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': 'https://drtea.in/#collections',
        name: 'Shop Indian Tea by Category',
        description: 'Single-origin chai, ayurvedic kadha, Darjeeling, Assam, green tea, black tea and floral tisanes from Dr Tea.',
        url: 'https://drtea.in/',
        hasPart: catCards.map((c, i) => ({
          '@type': 'CollectionPage',
          position: i + 1,
          name: `${c.name} Tea`,
          url: `https://drtea.in/shop/${c.slug}`,
          about: c.tag,
        })),
      },
      {
        '@type': 'ItemList',
        name: 'Tea Categories',
        itemListElement: catCards.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          url: `https://drtea.in/shop/${c.slug}`,
        })),
      },
      {
        '@type': 'ItemList',
        name: 'Most Loved Rituals — Bestselling Indian Teas',
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: Math.min(8, products.length),
        itemListElement: [...products]
          .sort((a, b) => b.reviewCount - a.reviewCount)
          .slice(0, 8)
          .map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://drtea.in/product/${p.slug}`,
            item: {
              '@type': 'Product',
              name: p.name,
              url: `https://drtea.in/product/${p.slug}`,
              image: p.imageUrl,
              category: p.category,
              brand: { '@type': 'Brand', name: 'Dr Tea' },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: p.rating,
                reviewCount: p.reviewCount,
              },
              offers: {
                '@type': 'Offer',
                priceCurrency: 'INR',
                price: p.price,
                availability: 'https://schema.org/InStock',
                url: `https://drtea.in/product/${p.slug}`,
              },
            },
          })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1a2416]">
      <Seo
        title="Dr Tea — Buy Premium Indian Tea Online | Masala Chai, Kadha, Darjeeling, Green Tea & Tisanes"
        description="Shop Dr Tea — single-estate Darjeeling, Assam gold, royal masala chai, ayurvedic kadha, tulsi & jasmine green tea, hibiscus and chamomile tisanes. Hand-blended, small batch, free shipping above ₹999."
        canonical="https://drtea.in/"
        jsonLd={homeJsonLd}
        jsonLdId="ld-home"
      />

      {/* ── 1. HERO — experience takeover or default ─────────────────── */}
      {heroTakeover ? <ExperienceHero hero={heroTakeover} /> : (
      <section className="relative bg-[#0e1a0d]">
        <div className="relative w-full h-[clamp(420px,60vw,640px)] overflow-hidden">
          {/* Layer 1 — static image. Always visible: instant LCP, low-network
              fallback, and the "canvas" the video fades in over. Never remove
              this; it is the hero image equivalent for Core Web Vitals. */}
          <img
            src="/images/hero-pour.webp"
            alt="Premium Indian tea — masala chai being poured into a porcelain cup"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover -translate-y-5 sm:translate-y-0"
          />
          {/* Layer 2 — looping video. Starts invisible; fades in smoothly over
              the static image once the browser has enough data to play without
              stutter. On low-network / no-autoplay the static image stays and
              nothing feels broken. */}
          <video
            src="/videos/hero-pour.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            aria-label="Premium Indian tea — masala chai being poured into a porcelain cup with steam rising"
            className="absolute inset-0 w-full h-full object-cover -translate-y-5 sm:translate-y-0 transition-opacity duration-[1200ms] ease-in-out"
            style={{ opacity: videoReady ? 1 : 0 }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e1a0d]/70 via-[#0e1a0d]/15 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1a0d]/35 via-transparent to-transparent" />

          {/* Hero text — pushed toward the top on mobile so the CTAs leave
              comfortable room for the featured-product card below them.
              Tablet+ keeps the centered composition. */}
          <div className="relative z-10 h-full flex items-start pt-6 sm:items-center sm:pt-0 px-6 sm:px-12 lg:px-20">
            <div className="max-w-md w-full">
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                className="text-[12px] tracking-wide text-white/65 mb-2 sm:mb-3 italic font-serif">
                {homepageSeo.heroEyebrow}
              </motion.p>
              <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }}
                className="text-[clamp(2rem,6.4vw,4rem)] font-serif font-bold leading-[1.02] text-white mb-3 sm:mb-5">
                <span aria-hidden="true" style={{ whiteSpace: 'pre-line' }}>
                  {homepageSeo.h1Visible}
                </span>
                <span className="sr-only">{homepageSeo.h1SrOnly}</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
                className="text-[11px] sm:text-[12px] text-amber-100/85 font-semibold tracking-wide mb-3 sm:mb-4">
                {homepageSeo.h1Subline}
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.35 }}
                className="text-[12px] sm:text-[14px] text-white/80 font-light leading-relaxed mb-4 sm:mb-7 max-w-xs sm:max-w-md">
                {homepageSeo.heroSubcopy}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
                className="flex flex-row gap-3">
                <CtaLink href="/shop" variant="secondary" aria-label="Shop premium Indian tea online">Explore Teas</CtaLink>
                <CtaLink href="/shop/teawares" variant="outlineLight" aria-label="Explore teawares — brass cups, bone china sets and strainers">Explore Teawares</CtaLink>
              </motion.div>

              {/* Featured-product card — mobile only. Sits in the breathing
                  room created by pushing the hero copy upward. */}
              <motion.a
                href="/product/dr-tea-gold-ctc"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.65 }}
                aria-label="Featured: Dr Tea Gold — A Sip of Heritage, ₹299"
                className="sm:hidden mt-6 group flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md rounded-xl p-2.5 pr-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
              >
                <div className="relative flex-none w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-[#f3dc9f] to-[#e8c87a] ring-1 ring-amber-100/30">
                  <img src={drTeaGoldJar} alt="" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] uppercase tracking-[0.22em] text-amber-200/95 font-bold">New · Just Launched</p>
                  <p className="text-[13px] font-serif font-bold text-white leading-tight truncate">Dr Tea Gold</p>
                  <p className="text-[10px] text-white/75 leading-tight truncate">A Sip of Heritage · ₹299</p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-200/95 flex-none group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </motion.a>
            </div>
          </div>

          {/* Floating product jar — tablet+ only. Mobile uses the inline
              card under the CTAs above instead. */}
          <motion.a
            href="/product/dr-tea-gold-ctc"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            aria-label="Shop Dr Tea Gold — A Sip of Heritage, ₹299"
            className="hidden sm:block absolute z-20 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 rounded-xl bottom-[14%] right-[8%] w-[150px] lg:right-[10%] lg:w-[180px]"
          >
            <div className="absolute -inset-2 rounded-2xl bg-amber-200/15 blur-xl opacity-60 group-hover:opacity-90 transition-opacity" aria-hidden="true" />
            <div className="relative rounded-xl overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.55)] ring-1 ring-amber-100/30 aspect-square bg-gradient-to-br from-[#f3dc9f] to-[#e8c87a]">
              <img
                src={drTeaGoldJar}
                alt="Dr Tea Gold — long leaves blended with bold CTC granules"
                loading="eager"
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5">
                <p className="text-[8px] uppercase tracking-[0.2em] text-amber-200/95 font-bold">DR TEA · NEW</p>
                <p className="text-[12px] font-serif font-bold text-white leading-tight mt-0.5">Dr Tea Gold</p>
                <p className="text-[7px] uppercase tracking-wider text-amber-100/70 mt-0.5">A Sip of Heritage · ₹299</p>
              </div>
            </div>
          </motion.a>

          {/* Down indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white/15 backdrop-blur border border-white/30 flex items-center justify-center">
            <ChevronRight className="w-3.5 h-3.5 text-white rotate-90" />
          </div>
        </div>
      </section>
      )}

      {/* ── 2. QUICK DISCOVERY PILLS — floating white card ────────────── */}
      <nav aria-label="Shop tea by category" className="relative -mt-9 sm:-mt-12 z-20 px-4 sm:px-8 mb-6">
        <div className="max-w-[1600px] mx-auto bg-white rounded-2xl shadow-[0_8px_30px_-12px_rgba(26,36,22,0.18)] border border-gray-100/80 px-2 py-2">
          <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory sm:justify-between">
            {quickPills.map(pill => (
              <Link key={pill.label} href={pill.href} aria-label={`Shop ${pill.label}`} className="flex-shrink-0 flex flex-col items-center gap-1 px-3 sm:px-5 py-2 hover:bg-[#f7f5f1] rounded-lg transition-colors min-w-[72px] snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]">
                <span className="text-[18px] leading-none" aria-hidden="true">{pill.icon}</span>
                <span className="text-[10px] font-semibold whitespace-nowrap text-gray-700 tracking-[0.04em]">{pill.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* ── 3. MOST LOVED RITUALS ─────────────────────────────────────── */}
      <section className="px-4 sm:px-8 mb-7">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-serif font-bold text-[#1a2416]">Most Loved Rituals</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Handpicked by our tea lovers</p>
            </div>
            <Link href="/shop" className="text-[10px] font-bold text-[#1a2416] uppercase tracking-[0.18em] hover:text-primary">VIEW ALL</Link>
          </div>
          <div className="relative">
            <div
              className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:[mask-image:linear-gradient(to_right,black_calc(100%_-_48px),transparent)] sm:[-webkit-mask-image:linear-gradient(to_right,black_calc(100%_-_48px),transparent)]"
              style={{ scrollPaddingInlineStart: '1rem' }}
            >
              {mostLoved.map(item => (
                <MostLovedCard
                  key={item.slug}
                  item={item}
                  onAdd={() => {
                    const real = findRealProduct(item.slug);
                    if (real && real.variants[0]) addToCart(real, real.variants[0]);
                  }}
                  onWishlist={() => toggleWishlist(item.slug)}
                  isWishlisted={wishlist.includes(item.slug)}
                />
              ))}
            </div>
            <button className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 -mr-3 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-[#1a2416] z-10">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. CATEGORY GRID — 6 cards 3x2 ────────────────────────────── */}
      <section className="px-4 sm:px-8 mb-6">
        <div className="max-w-[1600px] mx-auto grid grid-cols-3 gap-2 sm:gap-3">
          {catCards.map((cat, idx) => (
            <Link key={cat.slug} href={`/shop/${cat.slug}`}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                whileTap={{ scale: 0.97 }}
                className="relative rounded-xl overflow-hidden h-[110px] sm:h-[140px] group cursor-pointer"
                style={{ backgroundColor: cat.bg }}
              >
                <img src={cat.img} alt={cat.name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0" style={{ backgroundColor: cat.bg, opacity: 0.22 }} />
                {/* Stronger bottom-up scrim for caption legibility on bright photos */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
                <div className="absolute inset-0 p-3 flex flex-col justify-between">
                  <div>
                    <h3 className="text-white font-serif font-bold text-[13px] sm:text-[15px] leading-tight drop-shadow-sm">{cat.name}</h3>
                    <p className="text-white/85 text-[9px] sm:text-[10px] font-medium leading-snug mt-0.5 hidden sm:block drop-shadow-sm">{cat.tag}</p>
                  </div>
                  <span className="inline-flex w-fit bg-white/10 backdrop-blur-sm border border-white/60 text-white text-[8px] sm:text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm font-bold">
                    EXPLORE
                  </span>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 5. EDITORIAL BANNER — For Tea Lovers (Teawares) ───────────── */}
      <section className="px-4 sm:px-8 mb-6">
        <div className="max-w-[1600px] mx-auto rounded-2xl overflow-hidden relative h-[180px] sm:h-[200px] bg-[#1a2416]">
          <img src="/images/banner-teawares.webp" alt="Brass kulhad cups, bone china tea set and stainless steel strainer" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-85" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a2416]/95 via-[#1a2416]/55 to-transparent" />
          <div className="relative h-full flex flex-col justify-center px-6 sm:px-8 max-w-md">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/80 font-bold mb-2">For Tea Lovers</p>
            <h3 className="text-[24px] sm:text-[28px] font-serif font-bold text-white leading-tight mb-2">
              The Ritual Toolkit
            </h3>
            <p className="text-[12px] text-white/70 mb-4 leading-relaxed">
              Brass kulhads, bone china sets &amp; stainless strainers — built to last a lifetime.
            </p>
            <Link href="/shop/teawares" className="group inline-flex items-center justify-center gap-2 w-fit px-5 py-2.5 bg-amber-200 text-[#1a2416] text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-colors rounded-sm shadow-md shadow-black/20">
              SHOP TEAWARES
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. TRUST BADGES — cinematic single-row strip ──────────────── */}
      <section aria-label="Why customers choose Dr Tea" className="px-4 sm:px-8 mb-7">
        <div className="max-w-[1600px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-md bg-[#0e1810] ring-1 ring-white/5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]"
          >
            {/* subtle gold light wash */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/[0.04] to-transparent z-10" aria-hidden="true" />
            {/* edge fades so items appear / disappear softly at the sides */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-12 bg-gradient-to-r from-[#0e1810] to-transparent z-10" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-12 bg-gradient-to-l from-[#0e1810] to-transparent z-10" aria-hidden="true" />

            <ul
              className="relative flex items-center gap-0 py-2.5 sm:py-3 w-max animate-marquee"
              aria-hidden="true"
            >
              {[...trustBadges, ...trustBadges].map(({ Icon, title }, i) => (
                <li key={`${title}-${i}`} className="flex items-center">
                  <div className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-4 whitespace-nowrap">
                    <Icon className="w-[13px] h-[13px] sm:w-[15px] sm:h-[15px] text-amber-200/80" strokeWidth={1.6} aria-hidden="true" />
                    <span className="text-[10px] sm:text-[11px] font-medium tracking-[0.04em] text-white/85">
                      {title}
                    </span>
                  </div>
                  <span className="h-3 w-px bg-white/15" aria-hidden="true" />
                </li>
              ))}
            </ul>
            {/* SR-only static list for accessibility */}
            <ul className="sr-only">
              {trustBadges.map(({ title }) => <li key={title}>{title}</li>)}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* ── 7. NEW LAUNCHES + FIND YOUR TEA RITUAL (split 2/3 + 1/3) ──── */}
      <section className="px-4 sm:px-8 mb-7">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* New Launches (2/3) */}
          <div className="sm:col-span-2">
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="text-[18px] sm:text-[20px] font-serif font-bold text-[#1a2416]">New Launches</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">Discover our freshest blends</p>
              </div>
              <Link href="/shop" className="text-[10px] font-bold text-[#1a2416] uppercase tracking-[0.18em]">VIEW ALL</Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {newLaunches.map(item => {
                const available = AVAILABLE_SLUGS.has(item.slug);
                return (
                <div key={item.slug} className="bg-white rounded-xl border border-gray-100 overflow-hidden relative">
                  <div className="relative aspect-square bg-[#f7f5f1] overflow-hidden">
                    <Link href={available ? `/product/${item.slug}` : '#'} onClick={(e) => { if (!available) e.preventDefault(); }} className="absolute inset-0">
                      <ProductImage src={item.img} name={item.name} className={`w-full h-full object-cover ${!available ? 'blur-sm grayscale opacity-60' : ''}`} />
                    </Link>
                    {available && <span className="absolute top-1.5 left-1.5 bg-[#1a2416] text-white text-[7px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm font-bold">NEW</span>}
                    {available && (
                      <button onClick={() => toggleWishlist(item.slug)} aria-label={`${wishlist.includes(item.slug) ? 'Remove from' : 'Add to'} wishlist`} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]">
                        <Heart className={`w-3 h-3 ${wishlist.includes(item.slug) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                      </button>
                    )}
                    {!available && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="bg-black/75 text-white text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm font-bold">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  <Link href={available ? `/product/${item.slug}` : '#'} onClick={(e) => { if (!available) e.preventDefault(); }} className={`p-2 block ${!available ? 'opacity-50' : ''}`}>
                    <h4 className="text-[10px] font-semibold leading-tight line-clamp-2 mb-1 text-[#1a2416] min-h-[26px]">{item.name}</h4>
                    <p className="text-[11px] font-bold text-[#1a2416]">{formatPrice(item.price, currency)}</p>
                  </Link>
                </div>
                );
              })}
            </div>
          </div>

          {/* Jorhat Plantation Staycation (1/3) */}
          <Link
            href="/staycation"
            aria-label="2-night, 3-day Dr Tea plantation staycation in Jorhat — ₹10,000 all-inclusive, includes Kaziranga"
            className="group bg-[#2a3a24] rounded-xl overflow-hidden text-white relative flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
          >
            <div className="relative h-[140px] sm:h-[170px] overflow-hidden">
              <img
                src="/images/staycation-bungalow-dusk.webp"
                alt="One-horned rhino grazing at dusk beside a lantern-lit heritage tea bungalow in Jorhat, Assam"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2a3a24]/70 via-transparent to-transparent" />
              <span className="absolute top-2 right-2 text-[9px] uppercase tracking-[0.18em] font-bold bg-amber-200 text-[#1a2416] px-2 py-0.5 rounded-full">
                New
              </span>
            </div>
            <div className="p-4 flex flex-col flex-1 text-center">
              <h3 className="font-serif font-bold text-[18px] sm:text-[20px] leading-tight mb-1.5">
                A Staycation in the Tea Capital
              </h3>
              <p className="text-[10px] text-white/70 leading-relaxed mb-3 flex-1">
                2N / 3D in Jorhat · Heritage bungalow, plantation walk-through &amp; Kaziranga safari. <span className="text-amber-200 font-semibold tabular-nums">₹10,000</span> all-in.
              </p>
              <span className="inline-flex items-center justify-center gap-1.5 bg-amber-200 text-[#1a2416] text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-2 rounded-md group-hover:bg-amber-100 transition-colors w-full">
                Reserve or Win
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── 8. PHILOSOPHY + PROCESS — minimal ────────────────────────── */}
      <section id="process" className="bg-[#1a2416] text-white py-6 sm:py-8 px-4 sm:px-8 mb-7 scroll-mt-20">
        <div className="max-w-[1600px] mx-auto">
          {/* Philosophy — single centered line */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-5 sm:mb-6"
          >
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.28em] text-amber-200/70 mb-1.5">Our Philosophy</p>
            <h2 className="text-[15px] sm:text-[18px] font-serif font-bold leading-tight mb-1.5">
              Rooted in soil. Crafted in stillness.
            </h2>
            <p className="text-[11px] sm:text-[12px] text-white/55 font-light leading-snug max-w-xl mx-auto">
              Heritage estates · whole leaves · ancient Ayurvedic principles · no artificial flavourings.
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 mt-3 text-[10px] uppercase tracking-[0.22em] font-semibold text-white/60 hover:text-white transition-colors group"
            >
              Read our story <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Process — minimal numbered row */}
          <div className="border-t border-white/10 pt-5">
            <p className="text-[9px] uppercase tracking-[0.28em] text-amber-200/60 mb-5 text-center">From Garden to Cup</p>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="relative overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              <div className="relative min-w-[640px] sm:min-w-0">
                {/* Animated track line + traveling leaf */}
                <div className="absolute left-[10%] right-[10%] top-[14px] h-px pointer-events-none" aria-hidden="true">
                  <div className="absolute inset-0 bg-white/10" />
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-200/60 via-amber-200/40 to-amber-200/0 origin-left w-full"
                    variants={{
                      hidden: { scaleX: 0 },
                      visible: { scaleX: 1 },
                    }}
                    transition={{ duration: 1.8, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute -top-2 left-0 text-[14px] leading-none select-none"
                    variants={{
                      hidden: { x: 0, opacity: 0 },
                      visible: { x: 'calc(100% - 14px)', opacity: [0, 1, 1, 0] },
                    }}
                    transition={{ duration: 1.8, ease: 'easeInOut', times: [0, 0.08, 0.92, 1] }}
                  >
                    🍃
                  </motion.div>
                </div>

                {/* Steps */}
                <ol className="grid grid-cols-5 gap-2 sm:gap-3 relative">
                  {gardenSteps.map((step, idx) => (
                    <motion.li
                      key={step.step}
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      transition={{ delay: 0.15 + idx * 0.28, duration: 0.45, ease: 'easeOut' }}
                      className="snap-start flex flex-col items-center text-center px-1"
                    >
                      <motion.div
                        variants={{
                          hidden: { scale: 0.4, opacity: 0 },
                          visible: { scale: 1, opacity: 1 },
                        }}
                        transition={{ delay: 0.15 + idx * 0.28, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        className="relative w-7 h-7 rounded-full bg-[#1a2416] border border-amber-200/40 flex items-center justify-center shadow-[0_0_0_3px_rgba(26,36,22,1)] z-10"
                      >
                        <span className="text-[13px] leading-none">{step.icon}</span>
                      </motion.div>
                      <span className="font-serif italic text-[10px] text-amber-200/60 mt-2 leading-none">{step.step}</span>
                      <h3 className="text-[11px] sm:text-[12px] font-semibold text-white mt-1 leading-tight">{step.title}</h3>
                      <p className="text-[10px] sm:text-[11px] text-white/55 leading-snug mt-0.5">{step.body}</p>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 9. TEA JOURNAL PREVIEW ──────────────────────────────────── */}
      <section id="journal" className="py-12 px-4 sm:px-8 bg-white border-y border-gray-100 scroll-mt-20">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#3a5a2c] font-bold mb-1">The Dr Tea Journal</p>
              <h2 className="text-[18px] sm:text-[20px] font-serif font-bold">Slow Reading</h2>
            </div>
          </div>

          {journalPosts[0] && (
            <motion.article
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group cursor-pointer"
            >
              <Link href={`/journal/${journalPosts[0].slug}`} className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-4 sm:gap-6 items-center">
                <div className="aspect-[16/10] sm:aspect-[4/3] rounded-xl overflow-hidden relative bg-[#f0ede4]">
                  <img
                    src={journalPosts[0].img}
                    alt={journalPosts[0].title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <span
                    className="absolute top-2.5 left-2.5 px-2 py-1 text-[8px] uppercase tracking-wider font-bold text-white rounded-sm"
                    style={{ backgroundColor: journalPosts[0].color }}
                  >
                    {journalPosts[0].tag}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5">{journalPosts[0].readTime}</p>
                  <h3 className="text-[16px] sm:text-[20px] font-serif font-bold leading-tight mb-2 text-[#1a2416] group-hover:text-primary transition-colors">
                    {journalPosts[0].title}
                  </h3>
                  <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-3 mb-4">
                    {journalPosts[0].excerpt}
                  </p>
                </div>
              </Link>
            </motion.article>
          )}

          <div className="mt-5 flex justify-center">
            <Link
              href="/journal"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-[#1a2416]/15 text-[11px] font-bold uppercase tracking-[0.22em] text-[#1a2416] hover:bg-[#1a2416] hover:text-white transition-colors"
            >
              View More <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 10. COMMUNITY — auto-scrolling marquee ───────────────────── */}
      <section id="community" className="py-8 sm:py-10 bg-[#FAF8F4] scroll-mt-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4 sm:mb-5">
            <div className="max-w-2xl">
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.28em] text-[#3a5a2c]/80 mb-1.5">
                Our community
              </p>
              <h2 className="font-serif font-bold text-[#1a2416] leading-[1.15] text-[20px] sm:text-[26px] md:text-[30px]">
                India doesn’t just drink tea.<br className="hidden sm:block" />
                <span className="italic text-[#3a5a2c]"> It lives it.</span>
              </h2>
              <p className="mt-2 text-[12px] sm:text-[13px] text-[#1a2416]/65 leading-snug">
                1.4 billion cups a day. A million little rituals. These are a few of them.
              </p>
            </div>
            <a
              href="https://instagram.com/drteawellness"
              target="_blank"
              rel="noopener noreferrer"
              className="self-start sm:self-end inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#3a5a2c]/25 bg-white text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-[#3a5a2c] hover:bg-[#3a5a2c] hover:text-white hover:border-[#3a5a2c] transition-colors"
              aria-label="Tag us on Instagram with hashtag drteawellness"
            >
              #drteawellness
            </a>
          </div>
        </div>

        {/* Edge-to-edge marquee with fade masks */}
        <div
          className="group relative overflow-hidden"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
            maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
          }}
        >
          <motion.div
            className="flex gap-2 sm:gap-3 w-max group-hover:[animation-play-state:paused]"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 32, ease: 'linear', repeat: Infinity }}
          >
            {[...communityPhotos, ...communityPhotos].map((photo, i) => (
              <div
                key={i}
                className="w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] flex-shrink-0 rounded-xl overflow-hidden bg-gray-100"
              >
                <img
                  src={photo}
                  alt={`Community ritual ${(i % communityPhotos.length) + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </motion.div>
        </div>
      </section>

    </div>
  );
}
