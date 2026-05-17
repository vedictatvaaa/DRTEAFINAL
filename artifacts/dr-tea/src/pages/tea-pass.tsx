import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  Crown,
  Users,
  Infinity as InfinityIcon,
  Check,
  ArrowRight,
  Leaf,
  Truck,
  Heart,
  Calendar,
  ShieldCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import Seo from '@/components/Seo';
import { useToast } from '@/hooks/use-toast';
import { useShopper } from '@/lib/shopper-auth';

const CATEGORIES = [
  { slug: 'floral-tisane', name: 'Floral Tisane', tag: 'Calm · Caffeine free', img: '/images/category-floral.webp', accent: '#6B4E8A' },
  { slug: 'chai',          name: 'Chai',          tag: 'Bold · Warming',       img: '/images/category-chai.webp',   accent: '#7B3F1E' },
  { slug: 'kadha',         name: 'Kadha',         tag: 'Ayurvedic · Healing',  img: '/images/category-kadha.webp',  accent: '#2E4A1E' },
  { slug: 'green-tea',     name: 'Green Tea',     tag: 'Fresh · Everyday',     img: '/images/category-green.webp',  accent: '#3A6B2A' },
  { slug: 'black-tea',     name: 'Black Tea',     tag: 'Classic · Rich',       img: '/images/category-black.webp',  accent: '#1C1C1C' },
  { slug: 'tea-reserve',   name: 'Tea Reserve',   tag: 'Rare · Exclusive',     img: '/images/category-reserve.webp', accent: '#0D0D0D' },
] as const;

const INCLUSIONS = [
  { Icon: InfinityIcon, title: 'Unlimited brews, one year',     body: 'Top-ups any time. We post the next pouch the moment your last one runs low.' },
  { Icon: Users,        title: 'For a family of two',           body: 'One household, two tea-lovers, one bill. Share, gift, or sip side by side.' },
  { Icon: Leaf,         title: 'Pick any two categories',       body: 'Pair Floral + Black, Green + CTC, Chai + Kadha — whatever your household drinks most.' },
  { Icon: Truck,        title: 'Free, scheduled delivery',      body: 'Pre-paid shipping all year. Pause or reschedule from your account anytime.' },
  { Icon: Heart,        title: 'Welcome ritual on us',          body: 'A hand-thrown brew kit and tasting card arrive with your first delivery.' },
  { Icon: ShieldCheck,  title: 'Single-estate, lab-tested',     body: 'The same tea we sell in our flagship — no compromise, no leftovers.' },
];

const FAQ = [
  { q: 'Is the ₹6,000 really for the entire year?', a: 'Yes — one payment, twelve months, two tea categories, unlimited refills for a household of two. No hidden fees, no per-pouch charges.' },
  { q: 'How does "unlimited" actually work?',       a: 'You request a refill from your account whenever you\'re running low. Most households need 1–2 pouches a month per category — we send the next one within 48 hours.' },
  { q: 'Can I change my two categories later?',     a: 'You can swap one category every 90 days, so your Pass grows with the seasons.' },
  { q: 'What if there are more than 2 tea drinkers?', a: 'The Pass is sized for two regular drinkers. Add a second Pass (or upgrade to our upcoming Family Plus) for larger households.' },
  { q: 'When does the Pass launch?',                a: 'We\'re onboarding the first 200 founder families in the next 4 weeks. Sign up below and we\'ll lock in the ₹6,000 launch price for you.' },
];

const ANNUAL_PRICE = 6000;

export default function TeaPassPage() {
  const { toast } = useToast();
  const shopper = useShopper();
  const [picked, setPicked] = useState<string[]>([]);
  const [email, setEmail] = useState(shopper.user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [hp, setHp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (slug: string) => {
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 2) return [prev[1]!, slug];
      return [...prev, slug];
    });
  };

  const monthly = useMemo(() => Math.round(ANNUAL_PRICE / 12), []);
  const perPerson = useMemo(() => Math.round(ANNUAL_PRICE / 12 / 2), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (picked.length !== 2 || new Set(picked).size !== 2) {
      toast({ title: 'Pick two categories', description: 'Choose two different tea categories your household drinks most.', variant: 'destructive' });
      return;
    }
    if (hp.trim() !== '') {
      setDone(true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: 'Email looks off', description: 'Please share a valid email so we can lock in your founder price.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/tea-pass/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          name: shopper.user?.name || undefined,
          categories: picked,
          source: 'tea-pass-page',
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast({ title: 'Could not save your spot', description: data?.error ?? 'Please try again in a moment.', variant: 'destructive' });
        return;
      }
      setDone(true);
      toast({ title: 'You\u2019re on the list', description: data.message });
    } catch {
      toast({ title: 'Network hiccup', description: 'Please try again in a moment.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FAF8F4] min-h-screen">
      <Seo
        title="Tea Pass — Unlimited tea for ₹6,000/year | Dr Tea"
        description="The Dr Tea Pass: ₹6,000 a year for unlimited single-estate tea for a household of two. Pick any two categories — Floral, Black, Green, CTC, Chai or Kadha — and we deliver, year-round."
        canonical="https://drtea.in/tea-pass"
      />

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#1a2416] text-white">
        <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_top_right,_#fbbf24_0%,_transparent_45%),radial-gradient(circle_at_bottom_left,_#3a5a2c_0%,_transparent_50%)]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24 text-center">
          <div className="inline-flex items-center gap-1.5 bg-amber-300/15 ring-1 ring-amber-300/40 text-amber-200 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.22em] font-bold mb-5">
            <Crown className="w-3 h-3" /> Founder pricing · Limited to first 200 families
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-white mb-4 max-w-3xl mx-auto">
            One year of unlimited tea.<br className="hidden sm:block" />
            <span className="text-amber-200">For two. For ₹6,000.</span>
          </h1>
          <p className="text-[14px] sm:text-base text-white/75 max-w-2xl mx-auto leading-relaxed mb-7">
            The Dr Tea Pass is a yearly membership for two tea-lovers under one roof. Pick any
            <span className="text-amber-200 font-semibold"> two categories</span> — Floral &amp; Black, Green &amp; CTC, Chai &amp; Kadha — and we keep your kitchen stocked, all year, no per-pouch charges.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] text-white/70 mb-8">
            <span className="flex items-center gap-1.5"><InfinityIcon className="w-3.5 h-3.5 text-amber-300" /> Unlimited refills</span>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-amber-300" /> Family of 2</span>
            <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-amber-300" /> Free delivery</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-amber-300" /> 365 days</span>
          </div>

          <div className="inline-flex flex-col items-center gap-1.5">
            <a href="#claim" className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-200 text-[#1a2416] px-7 py-4 rounded-md text-[13px] font-bold uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a2416]">
              Claim my Tea Pass <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-[10.5px] text-white/55 mt-2 tabular-nums">
              ~₹{monthly}/month · roughly ₹{perPerson} per person, per month
            </p>
          </div>
        </div>
      </section>

      {/* INCLUSIONS */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#3a5a2c] font-bold mb-2.5">What\u2019s included</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#1a2416] leading-[1.1]">
            A whole year, taken care of.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INCLUSIONS.map(({ Icon, title, body }) => (
            <div key={title} className="bg-white border border-[#1a2416]/8 rounded-lg p-5 sm:p-6">
              <div className="w-10 h-10 rounded-full bg-[#1a2416] text-amber-200 inline-flex items-center justify-center mb-3.5">
                <Icon className="w-4.5 h-4.5" strokeWidth={1.6} />
              </div>
              <p className="font-serif text-lg text-[#1a2416] leading-tight mb-1.5">{title}</p>
              <p className="text-[13px] text-[#1a2416]/65 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MATH STRIP */}
      <section className="bg-white border-y border-[#1a2416]/8 py-10 sm:py-12">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 grid grid-cols-1 sm:grid-cols-3 gap-y-7 gap-x-6 text-center">
          {[
            { k: '₹6,000', v: 'one year, one bill' },
            { k: `₹${monthly}/mo`, v: 'works out to' },
            { k: '~₹50/cup', v: 'or less, brewed at home' },
          ].map((c) => (
            <div key={c.v}>
              <p className="font-serif text-3xl sm:text-4xl text-[#1a2416] tabular-nums leading-none">{c.k}</p>
              <p className="text-[11px] uppercase tracking-widest text-[#1a2416]/55 font-semibold mt-2">{c.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CLAIM FORM */}
      <section id="claim" className="max-w-4xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-9">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#3a5a2c] font-bold mb-2.5">Lock in founder pricing</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#1a2416] leading-[1.1] mb-3">
            Pick your two categories.
          </h2>
          <p className="text-[13.5px] text-[#1a2416]/65 leading-relaxed">
            Tap the two your household drinks most. We\u2019ll hold your ₹6,000 launch price and email you the moment the Pass opens.
          </p>
        </div>

        {done ? (
          <div className="bg-white border border-emerald-200 rounded-xl p-8 sm:p-10 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-2xl text-[#1a2416] mb-2">You\u2019re on the founder list</h3>
            <p className="text-[13px] text-[#1a2416]/65 mb-5">
              We\u2019ll email <span className="font-semibold text-[#1a2416]">{email}</span> the moment the Pass opens. Meanwhile, take a look at the teas you\u2019ll be drinking on us.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {picked.map((slug) => {
                const c = CATEGORIES.find((x) => x.slug === slug);
                if (!c) return null;
                return (
                  <span key={slug} className="inline-flex items-center gap-1.5 bg-[#1a2416] text-amber-100 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                    <Check className="w-3 h-3" /> {c.name}
                  </span>
                );
              })}
            </div>
            <Link href="/shop" className="inline-flex items-center gap-2 bg-[#1a2416] hover:bg-[#0e1810] text-amber-100 px-5 py-3 rounded-md text-[12px] font-bold uppercase tracking-[0.18em]">
              Browse the teas <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-7">
            {/* Category picker */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-widest font-semibold text-[#1a2416]/65">
                  Your two categories
                </span>
                <span className={`text-[11px] font-semibold tabular-nums ${picked.length === 2 ? 'text-emerald-700' : 'text-[#1a2416]/55'}`}>
                  {picked.length}/2 selected
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CATEGORIES.map((c) => {
                  const isSel = picked.includes(c.slug);
                  return (
                    <button
                      type="button"
                      key={c.slug}
                      onClick={() => toggle(c.slug)}
                      aria-pressed={isSel}
                      className={`group relative overflow-hidden rounded-lg border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2 ${
                        isSel
                          ? 'border-[#1a2416] bg-white shadow-md scale-[1.01]'
                          : 'border-[#1a2416]/10 bg-white/70 hover:border-[#1a2416]/30'
                      }`}
                    >
                      <div className="aspect-[5/3] overflow-hidden bg-[#1a2416]/5 relative">
                        <img src={c.img} alt={c.name} loading="lazy" className={`w-full h-full object-cover transition-transform duration-500 ${isSel ? 'scale-105' : 'group-hover:scale-105'}`} />
                        {isSel && (
                          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#1a2416] text-amber-200 flex items-center justify-center shadow-lg">
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="font-serif text-[14px] text-[#1a2416] leading-tight">{c.name}</p>
                        <p className="text-[10px] text-[#1a2416]/55 mt-0.5">{c.tag}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest font-semibold text-[#1a2416]/65 mb-1.5 block">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white border border-[#1a2416]/15 rounded-md px-3.5 py-3 text-[13.5px] focus:outline-none focus:border-[#3a5a2c] focus:ring-2 focus:ring-[#3a5a2c]/20"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest font-semibold text-[#1a2416]/65 mb-1.5 block">
                  Phone <span className="text-[#1a2416]/35 font-normal normal-case tracking-normal">(optional)</span>
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9XXXXXXXXX"
                  className="w-full bg-white border border-[#1a2416]/15 rounded-md px-3.5 py-3 text-[13.5px] focus:outline-none focus:border-[#3a5a2c] focus:ring-2 focus:ring-[#3a5a2c]/20"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest font-semibold text-[#1a2416]/65 mb-1.5 block">
                  City <span className="text-[#1a2416]/35 font-normal normal-case tracking-normal">(optional — helps us prioritise deliveries)</span>
                </span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mumbai, Bengaluru, Delhi…"
                  className="w-full bg-white border border-[#1a2416]/15 rounded-md px-3.5 py-3 text-[13.5px] focus:outline-none focus:border-[#3a5a2c] focus:ring-2 focus:ring-[#3a5a2c]/20"
                />
              </label>
            </div>

            {/* honeypot — hidden from real users, bots tend to fill it */}
            <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden" style={{ position: 'absolute' }}>
              <label>
                Website
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#1a2416] hover:bg-[#0e1810] disabled:opacity-60 text-amber-100 px-6 py-4 rounded-md text-[12.5px] font-bold uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving your spot</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Reserve my Tea Pass</>
              )}
            </button>
            <p className="text-center text-[10.5px] text-[#1a2416]/50">
              No payment now. We\u2019ll email you when the Pass opens and you can decide then.
            </p>
          </form>
        )}
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-[#1a2416]/8 py-14 sm:py-18">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-9">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#3a5a2c] font-bold mb-2.5">Questions</p>
            <h2 className="font-serif text-3xl text-[#1a2416] leading-tight">The honest answers.</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group bg-[#FAF8F4] border border-[#1a2416]/8 rounded-lg open:border-[#1a2416]/20"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 py-4 text-[13.5px] font-semibold text-[#1a2416]">
                  <span>{item.q}</span>
                  <span className="text-[#3a5a2c] text-xl leading-none group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[13px] text-[#1a2416]/70 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
