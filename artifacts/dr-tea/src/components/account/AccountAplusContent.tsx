import { Link } from 'wouter';
import {
  ArrowRight,
  Leaf,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  BookOpen,
  Award,
  Gift,
} from 'lucide-react';

const A_PLUS_CATEGORIES = [
  { name: 'Floral Tisane', slug: 'floral-tisane', img: '/images/category-floral.webp', tag: 'Calm · Caffeine Free', accent: '#6B4E8A' },
  { name: 'Chai',          slug: 'chai',          img: '/images/category-chai.webp',   tag: 'Bold · Warming',      accent: '#7B3F1E' },
  { name: 'Kadha',         slug: 'kadha',         img: '/images/category-kadha.webp',  tag: 'Ayurvedic · Healing', accent: '#2E4A1E' },
  { name: 'Green Tea',     slug: 'green-tea',     img: '/images/category-green.webp',  tag: 'Fresh · Everyday',    accent: '#3A6B2A' },
  { name: 'Black Tea',     slug: 'black-tea',     img: '/images/category-black.webp',  tag: 'Classic · Rich',      accent: '#1C1C1C' },
  { name: 'Tea Reserve',   slug: 'tea-reserve',   img: '/images/category-reserve.webp', tag: 'Rare · Exclusive',   accent: '#0D0D0D' },
];

const TRUST_ITEMS = [
  { Icon: Leaf,        title: 'Single-estate sourced',  body: 'Direct from Assam, Darjeeling, Munnar, the Nilgiris and trusted Ayurvedic apothecaries.' },
  { Icon: Truck,       title: 'Free shipping over ₹999', body: 'Insulated, food-safe pouches. Dispatched within 24 hours of order placement.' },
  { Icon: ShieldCheck, title: 'FSSAI · ISO certified',   body: 'Every batch lab-tested for purity, moisture, and microbial safety before it ships.' },
  { Icon: RotateCcw,   title: '14-day brew guarantee',   body: 'Not in love with the leaf? Get a free replacement or refund — no questions asked.' },
];

const LEARN_LINKS = [
  { Icon: Award,    title: 'Tea Pass · ₹6,000/yr', body: 'Unlimited tea for a household of two — pick any 2 categories.', href: '/tea-pass' },
  { Icon: Sparkles, title: 'Find Your Tea',        body: 'A 90-second ritual quiz — get a match made for your mood.',     href: '/quiz' },
  { Icon: BookOpen, title: 'The Journal',          body: 'Guides, tasting notes & opinion from our master blenders.',     href: '/journal' },
  { Icon: Leaf,     title: 'Teapedia',             body: 'Look up any tea, term, region or brewing technique.',           href: '/teapedia' },
];

export default function AccountAplusContent({
  variant = 'account',
}: { variant?: 'account' | 'checkout-empty' }) {
  const isCheckout = variant === 'checkout-empty';

  return (
    <section
      className="bg-[#FAF8F4] border-t border-[#1a2416]/8"
      aria-labelledby="aplus-heading"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        {/* Eyebrow + headline */}
        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#3a5a2c] font-bold mb-2.5">
            {isCheckout ? 'Your cart is empty — start here' : 'While you\u2019re here'}
          </p>
          <h2
            id="aplus-heading"
            className="font-serif text-3xl sm:text-4xl text-[#1a2416] leading-[1.1] mb-3"
          >
            {isCheckout ? 'Build a tea ritual that feels like yours.' : 'Explore the Dr Tea world.'}
          </h2>
          <p className="text-[14px] text-[#1a2416]/65 leading-relaxed">
            {isCheckout
              ? 'Six collections, one philosophy: clean, single-estate Indian tea brewed the way it was meant to be. Pick a mood below and we\u2019ll take it from there.'
              : 'Discover new blends, sharpen your brew, and unlock perks. Curated picks from our editors and master tasters — refreshed every week.'}
          </p>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-12 sm:mb-14">
          {A_PLUS_CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/shop/${cat.slug}`}
              className="group relative overflow-hidden rounded-lg bg-white border border-[#1a2416]/8 hover:border-[#1a2416]/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2"
              aria-label={`Shop ${cat.name}`}
            >
              <div className="aspect-[4/3] overflow-hidden bg-[#1a2416]/5">
                <img
                  src={cat.img}
                  alt={cat.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif text-[14px] sm:text-base text-[#1a2416] truncate leading-tight">
                    {cat.name}
                  </p>
                  <p className="text-[10px] text-[#1a2416]/55 mt-0.5 truncate">{cat.tag}</p>
                </div>
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white flex-shrink-0 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: cat.accent }}
                  aria-hidden="true"
                >
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Trust columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-7 mb-12 sm:mb-14">
          {TRUST_ITEMS.map(({ Icon, title, body }) => (
            <div key={title} className="text-center sm:text-left">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#1a2416] text-amber-100 mb-2.5">
                <Icon className="w-4 h-4" strokeWidth={1.6} />
              </div>
              <p className="font-semibold text-[13px] text-[#1a2416] mb-1 leading-tight">{title}</p>
              <p className="text-[11.5px] text-[#1a2416]/55 leading-snug">{body}</p>
            </div>
          ))}
        </div>

        {/* Learn / discover links */}
        <div className="border-t border-[#1a2416]/10 pt-10 sm:pt-12">
          <div className="flex items-end justify-between gap-3 mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] font-bold mb-1">
                Deepen your ritual
              </p>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#1a2416] leading-tight">
                Read, taste, earn.
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LEARN_LINKS.map(({ Icon, title, body, href }) => (
              <Link
                key={href}
                href={href}
                className="group block bg-white border border-[#1a2416]/8 hover:border-[#1a2416]/25 rounded-lg p-4 sm:p-5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
              >
                <Icon className="w-5 h-5 text-[#3a5a2c] mb-3" strokeWidth={1.6} />
                <p className="font-semibold text-[14px] text-[#1a2416] mb-1 leading-tight flex items-center gap-1.5">
                  {title}
                  <ArrowRight className="w-3.5 h-3.5 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </p>
                <p className="text-[12px] text-[#1a2416]/60 leading-snug">{body}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Final CTA strip */}
        <div className="mt-12 sm:mt-14 rounded-xl bg-[#1a2416] text-amber-100 px-6 py-7 sm:px-9 sm:py-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full bg-amber-200/15 text-amber-100 flex-shrink-0">
              <Gift className="w-5 h-5" strokeWidth={1.6} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80 mb-1">
                New here?
              </p>
              <p className="font-serif text-xl sm:text-2xl leading-snug text-white">
                Get 10% off your first order, plus 50% off every subscription.
              </p>
              <p className="text-[12px] text-amber-200/70 mt-1.5">
                Use code <span className="font-mono font-bold text-amber-100">WELCOME10</span> at checkout. One per customer.
              </p>
            </div>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-amber-200 hover:bg-amber-100 text-[#1a2416] px-5 py-3 rounded-md text-[12px] font-bold uppercase tracking-[0.18em] transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a2416]"
          >
            Start shopping <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
