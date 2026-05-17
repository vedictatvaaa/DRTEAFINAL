import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  MapPin,
  Leaf,
  Sun,
  Moon,
  Train,
  Coffee,
  Phone,
  MessageCircle,
  Award,
  Calendar,
  CheckCircle2,
  Sparkles,
  Mail,
  Trees,
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import Seo from '@/components/Seo';

const PRICE = '₹10,000';
const PHONE_DISPLAY = '+91-8929-8929-22';
const PHONE_TEL = 'tel:+918929892922';
const PHONE_WA = 'https://wa.me/918929892922?text=I%27d%20like%20to%20book%20the%20Dr%20Tea%20Jorhat%20Staycation';

const itinerary = [
  {
    day: 'Day 01',
    icon: Train,
    title: 'Arrive in Jorhat · The Tea Capital of the World',
    eyebrow: 'Afternoon',
    body:
      'Picked up from Jorhat Airport and driven through endless emerald gardens to your heritage planter’s bungalow on a working tea estate. Welcome chai on the verandah, a slow walk through the bushes at golden hour, and a candle-lit Assamese dinner of khaar, masor tenga, pitika and aloo bhaja under the rattan fan.',
    pills: ['Heritage bungalow check-in', 'Golden-hour garden walk', 'Traditional Assamese dinner'],
  },
  {
    day: 'Day 02',
    icon: Leaf,
    title: 'Inside the Leaf · Plucking, Processing & The Research Institute',
    eyebrow: 'Full day',
    body:
      'Sunrise plucking with the estate ladies in mekhela chador, learning the "two leaves and a bud" rule by feel. Walk the processing line — withering troughs, the rolling room, the fermentation floor, the wood-fired dryers, and the sorting plant where machines and human eyes grade leaf by character. After lunch, a private visit to Tocklai Tea Research Institute (est. 1911) — the oldest tea research station in the world.',
    pills: ['Sunrise plucking', 'Processing & sorting walk-through', 'Tocklai Research Institute visit', 'Tasting session with the estate sommelier'],
  },
  {
    day: 'Day 03',
    icon: Trees,
    title: 'Kaziranga at Sunrise · One-Horned Rhinos in the Mist',
    eyebrow: 'Sunrise to evening',
    body:
      'Early drive to Kaziranga National Park, a UNESCO World Heritage site. Jeep safari through Kohora or Bagori range — wild one-horned rhinoceros, swamp deer, wild buffalo and over 480 species of birds. A long Assamese lunch by the park, brief stop at a riverside tea garden, then drop to Jorhat Airport with a Dr Tea farewell tin tucked into your bag.',
    pills: ['Kaziranga jeep safari', 'UNESCO heritage site', 'Riverside tea garden stop', 'Airport drop'],
  },
];

const included = [
  { icon: Moon, label: 'Heritage stay', body: '2 nights in a colonial planter’s bungalow on a working tea estate.' },
  { icon: Coffee, label: 'All meals', body: 'Authentic Assamese cuisine, estate-grown teas, evening hi-tea & nightcap.' },
  { icon: Leaf, label: 'Plantation experience', body: 'Plucking, withering, rolling, fermentation, drying & sorting — hands-on.' },
  { icon: Award, label: 'Tocklai Institute visit', body: 'Private guided walk through the world’s oldest tea research station.' },
  { icon: Trees, label: 'Kaziranga safari', body: 'Jeep safari at sunrise in Kaziranga National Park, all permits & guide.' },
  { icon: Train, label: 'Local transfers', body: 'Airport pickup & drop, all on-ground transfers in a private vehicle.' },
];

const winnerPerks = [
  'A complimentary 2N/3D Staycation for two',
  'Personal welcome by Mr Mohit Barman, Founder',
  'A signed founder’s tin of first-flush single-estate Assam',
  'Featured in the Dr Tea Journal as the month’s storyteller',
];

const faqs = [
  {
    q: 'When can I travel?',
    a: 'The Staycation runs year-round, but the most beautiful windows are Mar\u2013May (first flush, green hills) and Oct\u2013Mar (cool, clear, Kaziranga open). We confirm dates within 48 hours of booking.',
  },
  {
    q: 'How does the monthly winner work?',
    a: 'Every order placed on drtea.in earns one entry into that month’s draw — bigger orders earn more entries. On the 1st of every month, one buyer is drawn at random and gifted the full Staycation for two. No purchase of the package required to win.',
  },
  {
    q: 'How do I get to Jorhat?',
    a: 'Daily direct flights from Kolkata and Guwahati land at Jorhat Airport (JRH). We pick you up from the airport — no further planning required.',
  },
  {
    q: 'What’s NOT included?',
    a: 'Flights to and from Jorhat, personal expenses, premium alcohol, and any extra activities you add on. Everything in the itinerary is included.',
  },
  {
    q: 'Can families & children come?',
    a: 'Yes. The package is priced per person on twin sharing. Children under 8 stay free. Families of up to 4 are welcome — please mention this when you book.',
  },
  {
    q: 'Could the specific tea estate, factory or hotel change?',
    a: 'Occasionally, yes. Tea estates and processing factories are working industrial sites — pluck cycles, weather, machinery downtime or visiting buyers can close a specific bungalow or factory floor on short notice. If that happens, we move you to a comparable heritage estate, factory or accommodation of the same standard in the Jorhat / Upper Assam belt at no extra cost. The experience (2 nights heritage stay, hands-on plantation walkthrough, Tocklai-style research visit, Kaziranga safari, all meals & transfers) stays exactly the same. We confirm the final estate and property 7 days before arrival.',
  },
];

export default function Staycation() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', when: '', guests: '2' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast({ title: 'Almost there', description: 'Please share your name, email and phone.' });
      return;
    }
    toast({
      title: 'Reservation request received',
      description: `Thanks ${form.name.split(' ')[0]} — Mr Mohit Barman’s team will be in touch within 24 hours.`,
    });
    setForm({ name: '', email: '', phone: '', when: '', guests: '2' });
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: 'Dr Tea Jorhat Plantation Staycation — 2N/3D',
    description:
      'A 2-night, 3-day cinematic staycation in Jorhat, the tea capital of the world. Heritage bungalow stay, hands-on plantation walk-through, Tocklai Tea Research Institute visit, and a sunrise jeep safari in Kaziranga National Park. All-inclusive at ' +
      PRICE +
      '.',
    touristType: 'Tea & wildlife enthusiasts',
    offers: {
      '@type': 'Offer',
      price: '10000',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: 'https://drtea.in/staycation',
    },
    itinerary: itinerary.map((d, i) => ({
      '@type': 'ItemList',
      name: d.title,
      position: i + 1,
    })),
    provider: { '@type': 'Organization', name: 'Dr Tea', url: 'https://drtea.in/' },
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1a2416]">
      <Seo
        title="Jorhat Tea Plantation Staycation — 2N/3D in the Tea Capital of the World | Dr Tea"
        description="A cinematic 2-night, 3-day staycation in Jorhat, Assam. Heritage planter's bungalow, hands-on tea plantation walkthrough, Tocklai Research Institute & Kaziranga safari. All-inclusive at ₹10,000. Plus: every month, one Dr Tea buyer wins the trip on us."
        canonical="https://drtea.in/staycation"
        jsonLd={jsonLd}
        jsonLdId="ld-staycation"
      />

      {/* ── 1. HERO — cinematic FOMO mosaic ─────────────────────── */}
      <section className="relative bg-[#0a100c] overflow-hidden">
        {/* faint amber glow */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-[520px] h-[520px] bg-amber-400/10 blur-3xl rounded-full" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-20 w-[480px] h-[480px] bg-[#3a5a2c]/25 blur-3xl rounded-full" aria-hidden />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-12 sm:pb-16">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 sm:mb-7"
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] font-bold text-amber-200 bg-amber-200/10 border border-amber-200/25 px-3 py-1.5 rounded-full">
              <MapPin className="w-3 h-3" /> Jorhat · Assam
            </span>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/55">
              The Tea Capital of the World
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#0a100c] bg-amber-200 px-2.5 py-1 rounded-full ml-auto">
              <Sparkles className="w-3 h-3" /> Only 4 guests per weekend
            </span>
          </motion.div>

          {/* Mosaic — flex split on lg so 3 tiles stack beside main */}
          <div className="flex flex-col lg:flex-row gap-2 sm:gap-3">
            {/* MAIN tile — bungalow at dusk + headline */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7 }}
              className="relative w-full lg:w-[64%] aspect-[16/10] lg:aspect-auto lg:min-h-[600px] rounded-2xl overflow-hidden bg-[#0f1612] group"
            >
              <img
                src="/images/staycation-bungalow-dusk.webp"
                alt="Colonial Assam tea planter's bungalow at blue-hour dusk, every window lit with lantern light, surrounded by emerald tea bushes"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-transparent" />

              {/* Top-left chip */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-[0.22em] font-bold text-amber-200 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full border border-white/10">
                  Your suite · Day 1
                </span>
              </div>

              {/* Headline overlay */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
                <motion.h1
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  className="font-serif font-bold text-white text-[30px] sm:text-[48px] lg:text-[60px] leading-[1.02] mb-3 sm:mb-5 max-w-2xl"
                >
                  Don’t just drink the tea.<br />
                  <span className="italic text-amber-200">Live inside the garden it came from.</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.25 }}
                  className="text-white/85 text-[13px] sm:text-[16px] leading-relaxed max-w-xl mb-5 sm:mb-7 font-light"
                >
                  Three days. Five worlds. One unhurried life.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.35 }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <a
                    href="#reserve"
                    className="inline-flex items-center justify-center gap-2 bg-amber-200 text-[#1a2416] text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.16em] px-5 sm:px-6 py-3.5 sm:py-4 rounded-full hover:bg-amber-100 transition-colors"
                  >
                    Reserve the Staycation
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="#winner"
                    className="inline-flex items-center justify-center gap-2 text-white text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.16em] px-5 sm:px-6 py-3.5 sm:py-4 rounded-full border border-white/30 hover:border-white/70 hover:bg-white/5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    Or win it free
                  </a>
                  <div className="text-white/70 text-[11px] flex items-center gap-2 ml-1">
                    <span className="text-white font-semibold text-[14px] sm:text-[15px] tabular-nums">{PRICE}</span>
                    <span className="text-white/40">·</span>
                    <span>All inclusive · 2N / 3D</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* RIGHT column — 3 stacked showcase tiles */}
            <div className="flex flex-row lg:flex-col gap-2 sm:gap-3 lg:w-[36%]">
            {[
              {
                img: '/images/staycation-elephant.webp',
                alt: 'Elephant safari at sunrise in Kaziranga, mahout on neck, tourists spotting a one-horned rhino in the grass',
                eyebrow: 'Day 3 · Sunrise',
                title: 'Elephant safari at Kaziranga',
                sub: 'Two-thirds of the world’s one-horned rhinos live here.',
                delay: 0.25,
              },
              {
                img: '/images/staycation-factory.webp',
                alt: 'Tea master raking emerald green tea leaves in a working Assam tea factory at golden hour',
                eyebrow: 'Day 2 · Hands-on',
                title: 'Inside the factory floor',
                sub: 'Withering, rolling, fermentation, drying, sorting — all of it.',
                delay: 0.35,
              },
              {
                img: '/images/staycation-dinner.webp',
                alt: 'Candle-lit Assamese thali dinner of masor tenga, khaar and chai on the verandah of a heritage tea bungalow',
                eyebrow: 'Every night',
                title: 'Candle-lit Assamese dinners',
                sub: 'Khaar, masor tenga, pitika, chai — on the verandah.',
                delay: 0.45,
              },
            ].map((tile) => (
              <motion.a
                key={tile.title}
                href="#itinerary"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: tile.delay }}
                className="relative flex-1 min-w-0 aspect-[4/3] lg:aspect-auto lg:min-h-[192px] rounded-2xl overflow-hidden bg-[#0f1612] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                <img
                  src={tile.img}
                  alt={tile.alt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <p className="text-[9px] uppercase tracking-[0.22em] font-bold text-amber-200/95 mb-1">
                    {tile.eyebrow}
                  </p>
                  <p className="font-serif font-bold text-white text-[14px] sm:text-[16px] leading-tight mb-0.5">
                    {tile.title}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-white/65 leading-snug line-clamp-2">
                    {tile.sub}
                  </p>
                </div>
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/55 backdrop-blur border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-3 h-3 text-amber-200" />
                </div>
              </motion.a>
            ))}
            </div>
          </div>

          {/* Marquee strip — fomo proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mt-5 sm:mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/55"
          >
            <span className="flex items-center gap-1.5"><Leaf className="w-3 h-3 text-[#7da568]" /> 5 experiences</span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1.5"><Moon className="w-3 h-3 text-amber-200/80" /> 2 nights in a heritage bungalow</span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1.5"><Trees className="w-3 h-3 text-[#7da568]" /> 1 sunrise at Kaziranga</span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1.5 text-amber-200/90"><Sparkles className="w-3 h-3" /> 1 free winner every month</span>
          </motion.div>
        </div>
      </section>

      {/* ── 2. THE PREMISE ───────────────────────────────────────── */}
      <section className="px-5 sm:px-10 py-14 sm:py-20 bg-[#FAF8F4]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#8B6F2A] mb-3">The Idea</p>
          <h2 className="font-serif font-bold text-[26px] sm:text-[36px] leading-tight mb-5">
            India invented the morning cup of tea.<br />
            We just want to take you home to where it grows.
          </h2>
          <p className="text-[14px] sm:text-[15px] text-[#1a2416]/75 leading-relaxed">
            Jorhat is the tea capital of the world. More than 800 estates wrap around it.
            The world’s oldest tea research institute is here. The first commercial tea plant in India was rolled here in 1837.
            For three days, this is your address.
          </p>
        </div>
      </section>

      {/* ── 3. ITINERARY ─────────────────────────────────────────── */}
      <section className="px-5 sm:px-10 pb-14 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c] mb-2">The Itinerary</p>
            <h2 className="font-serif font-bold text-[26px] sm:text-[34px] leading-tight">
              Three slow days. One unhurried life.
              <a
                href="#faq"
                aria-label="See note about possible estate or property changes"
                className="text-[#8B6F2A] align-super text-[16px] sm:text-[18px] ml-0.5 hover:underline"
              >
                *
              </a>
            </h2>
          </div>

          <div className="space-y-5 sm:space-y-6">
            {/* discreet operational-change footnote */}
            <p className="text-[11px] text-[#1a2416]/55 italic leading-relaxed -mt-2 mb-2">
              <span className="text-[#8B6F2A] not-italic">*</span> Specific estate, factory or
              accommodation may change at short notice (these are working industrial sites). We always
              swap to a comparable property at the same standard — same experience, no extra cost.
              {' '}
              <a href="#faq" className="underline underline-offset-2 hover:text-[#1a2416]">
                Full note in FAQ →
              </a>
            </p>

            {itinerary.map((d, i) => {
              const Icon = d.icon;
              return (
                <motion.article
                  key={d.day}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="grid sm:grid-cols-[180px_1fr] gap-4 sm:gap-8 bg-white border border-black/5 rounded-2xl p-5 sm:p-7"
                >
                  <div className="flex sm:flex-col sm:items-start items-center gap-3 sm:gap-2">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#2a3a24] text-amber-200 flex items-center justify-center">
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="sm:mt-2">
                      <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#8B6F2A]">{d.day}</p>
                      <p className="text-[11px] uppercase tracking-widest text-black/45 mt-0.5">{d.eyebrow}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-[18px] sm:text-[22px] leading-snug mb-2">{d.title}</h3>
                    <p className="text-[13px] sm:text-[14px] text-[#1a2416]/75 leading-relaxed mb-3">{d.body}</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {d.pills.map((p) => (
                        <li
                          key={p}
                          className="text-[10px] sm:text-[11px] bg-[#FAF8F4] border border-black/5 rounded-full px-2.5 py-1 text-[#1a2416]/75"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. THE STAY (bungalow image strip) ───────────────────── */}
      <section className="bg-[#0f1612] text-white">
        <div className="grid lg:grid-cols-2">
          <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[520px] overflow-hidden">
            <img
              src="/images/staycation-bungalow.webp"
              alt="The verandah of a colonial Assam planter's bungalow at golden hour"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="px-6 sm:px-12 py-14 sm:py-20 flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200/85 mb-3">The Stay</p>
            <h2 className="font-serif font-bold text-[26px] sm:text-[36px] leading-tight mb-5">
              A planter’s bungalow that has been pouring tea since 1894.
            </h2>
            <p className="text-white/75 text-[14px] sm:text-[15px] leading-relaxed mb-5">
              Teak floors. Cane chairs. A rattan ceiling fan that has watched five generations of tea makers.
              The same verandah a colonial planter sipped his evening Darjeeling on — except now,
              the cup in your hand belongs to you.
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] text-white/85 mb-2">
              {[
                'Private bedroom suite',
                'Walk-in verandah',
                'En-suite stone bath',
                '24/7 estate butler',
                'Hi-tea every afternoon',
                'Bonfire on cool nights',
              ].map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-200/90 flex-shrink-0" /> {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 5. WHAT'S INCLUDED ───────────────────────────────────── */}
      <section className="px-5 sm:px-10 py-14 sm:py-20 bg-[#FAF8F4]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c] mb-2">All-Inclusive · {PRICE}</p>
            <h2 className="font-serif font-bold text-[26px] sm:text-[34px] leading-tight">
              No add-ons. No surprises. Just tea.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {included.map((it) => {
              const Icon = it.icon;
              return (
                <div
                  key={it.label}
                  className="bg-white border border-black/5 rounded-xl p-5 hover:border-[#3a5a2c]/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[#3a5a2c]/10 text-[#3a5a2c] flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="font-serif font-bold text-[16px] mb-1">{it.label}</p>
                  <p className="text-[12px] text-[#1a2416]/65 leading-relaxed">{it.body}</p>
                </div>
              );
            })}
          </div>
          <p className="text-center text-[11px] text-[#1a2416]/55 mt-6">
            Twin sharing, per person. Children under 8 stay free. Flights to Jorhat (JRH) not included.
          </p>
        </div>
      </section>

      {/* ── 6. KAZIRANGA STRIP ──────────────────────────────────── */}
      <section className="relative bg-[#0f1612] text-white overflow-hidden">
        <div className="relative aspect-[16/9] sm:aspect-[21/9] max-h-[520px]">
          <img
            src="/images/staycation-kaziranga.webp"
            alt="A one-horned rhinoceros in the morning mist at Kaziranga National Park"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f1612] via-[#0f1612]/55 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-3xl px-6 sm:px-12">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200/90 mb-3 flex items-center gap-2">
                <Sun className="w-3 h-3" /> Day Three · Sunrise
              </p>
              <h2 className="font-serif font-bold text-[28px] sm:text-[42px] leading-tight mb-3">
                And then — a rhino, in the mist.
              </h2>
              <p className="text-white/80 text-[14px] sm:text-[16px] leading-relaxed max-w-xl">
                A sunrise jeep safari through Kaziranga — a UNESCO World Heritage site
                home to two-thirds of the world’s one-horned rhinos. Permits, guide and breakfast all on us.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. MONTHLY WINNER ───────────────────────────────────── */}
      <section id="winner" className="px-5 sm:px-10 py-16 sm:py-24 bg-[#1a2416] text-white scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200/90 mb-3 flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3" /> Every Month · One Free Trip
            </p>
            <h2 className="font-serif font-bold text-[28px] sm:text-[40px] leading-tight mb-4">
              Buy a tin of Dr Tea.<br />
              You might just be flying to Jorhat next month.
            </h2>
            <p className="text-white/70 text-[14px] sm:text-[15px] leading-relaxed max-w-2xl mx-auto">
              On the 1st of every month, one customer is drawn at random from everyone who ordered the month before.
              The winner gets the full Staycation — for two, on us. No catch, no fine print buried in a footer.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 mb-10">
            {winnerPerks.map((p) => (
              <div
                key={p}
                className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <Award className="w-4 h-4 text-amber-200 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-white/90 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-amber-200 text-[#1a2416] text-[12px] font-bold uppercase tracking-[0.16em] px-7 py-4 rounded-full hover:bg-amber-100 transition-colors"
            >
              Shop Dr Tea — enter the draw
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <p className="text-[10px] text-white/45 mt-3">
              Every ₹100 spent = 1 entry. Open to residents 18+. T&Cs apply.
            </p>
          </div>
        </div>
      </section>

      {/* ── 8. RESERVE FORM ─────────────────────────────────────── */}
      <section id="reserve" className="px-5 sm:px-10 py-16 sm:py-24 bg-[#FAF8F4] scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c] mb-2 flex items-center justify-center gap-2">
              <Calendar className="w-3 h-3" /> Reserve Your Window
            </p>
            <h2 className="font-serif font-bold text-[28px] sm:text-[36px] leading-tight mb-3">
              Tell us when. We’ll do the rest.
            </h2>
            <p className="text-[13px] sm:text-[14px] text-[#1a2416]/70 leading-relaxed">
              Spots are limited — a maximum of 4 guests per weekend, to keep it slow.
              Mr Mohit Barman’s team replies within 24 hours.
            </p>
          </div>

          {/* before-you-book operational note */}
          <div className="mb-6 border-l-2 border-[#8B6F2A]/50 bg-white/60 rounded-r-md px-4 py-3 text-[12px] sm:text-[13px] text-[#1a2416]/75 leading-relaxed">
            <p className="font-semibold text-[#1a2416] mb-1 flex items-center gap-1.5">
              <span className="text-[#8B6F2A]">*</span> A note before you book
            </p>
            <p>
              Tea estates and processing factories are working industrial sites. The specific
              bungalow, estate or factory shown above may occasionally change at short notice due to
              pluck cycles, weather, machinery downtime or visiting buyers. If that happens, we move
              you to a comparable heritage property of the same standard in the Jorhat / Upper Assam
              belt — at no extra cost. The 2N/3D experience itself
              (heritage stay, plantation walkthrough, research-station visit, Kaziranga safari, all
              meals &amp; transfers) stays exactly the same. We confirm the final property
              7 days before your arrival.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-label="Staycation reservation request"
            className="bg-white border border-black/5 rounded-2xl p-6 sm:p-8 grid sm:grid-cols-2 gap-3"
          >
            <label htmlFor="sc-name" className="sm:col-span-2 sr-only">Your name</label>
            <input
              id="sc-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              autoComplete="name"
              required
              className="sm:col-span-2 w-full bg-[#FAF8F4] border border-black/10 rounded-md px-3 py-3 text-[13px] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#3a5a2c]/40"
            />
            <label htmlFor="sc-email" className="sr-only">Email address</label>
            <input
              id="sc-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              autoComplete="email"
              required
              className="w-full bg-[#FAF8F4] border border-black/10 rounded-md px-3 py-3 text-[13px] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#3a5a2c]/40"
            />
            <label htmlFor="sc-phone" className="sr-only">Phone with country code</label>
            <input
              id="sc-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone (with country code)"
              autoComplete="tel"
              required
              className="w-full bg-[#FAF8F4] border border-black/10 rounded-md px-3 py-3 text-[13px] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#3a5a2c]/40"
            />
            <label htmlFor="sc-when" className="sr-only">Preferred month</label>
            <input
              id="sc-when"
              type="text"
              value={form.when}
              onChange={(e) => setForm({ ...form, when: e.target.value })}
              placeholder="Preferred month (e.g. November 2026)"
              className="w-full bg-[#FAF8F4] border border-black/10 rounded-md px-3 py-3 text-[13px] placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#3a5a2c]/40"
            />
            <label htmlFor="sc-guests" className="sr-only">Number of guests</label>
            <select
              id="sc-guests"
              value={form.guests}
              onChange={(e) => setForm({ ...form, guests: e.target.value })}
              className="w-full bg-[#FAF8F4] border border-black/10 rounded-md px-3 py-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#3a5a2c]/40"
            >
              <option value="1">1 guest</option>
              <option value="2">2 guests</option>
              <option value="3">3 guests</option>
              <option value="4">4 guests</option>
            </select>
            <button
              type="submit"
              className="sm:col-span-2 w-full bg-[#1a2416] hover:bg-[#0f1612] text-white text-[12px] font-bold uppercase tracking-[0.16em] px-5 py-4 rounded-md transition-colors"
            >
              Request my dates — {PRICE} all-in
            </button>
          </form>

          {/* Direct lines */}
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <a
              href={PHONE_TEL}
              className="flex items-center justify-center gap-2 bg-white border border-black/10 rounded-md py-3 text-[13px] font-semibold hover:border-[#3a5a2c]/40 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#3a5a2c]" />
              <span className="tabular-nums">{PHONE_DISPLAY}</span>
            </a>
            <a
              href={PHONE_WA}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-md py-3 text-[13px] font-semibold hover:bg-[#1ebe57] transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp the founder’s team
            </a>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="px-5 sm:px-10 py-14 sm:py-20 bg-white border-t border-black/5 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c] mb-2 text-center">Good to know</p>
          <h2 className="font-serif font-bold text-[24px] sm:text-[32px] leading-tight text-center mb-8">
            Questions you’re too polite to ask
          </h2>
          <div className="divide-y divide-black/5 border-y border-black/5">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer flex items-start justify-between gap-4 list-none">
                  <span className="font-serif font-bold text-[15px] sm:text-[17px] text-[#1a2416]">{f.q}</span>
                  <span className="text-[#3a5a2c] text-lg leading-none transition-transform group-open:rotate-45 flex-shrink-0">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[13px] sm:text-[14px] text-[#1a2416]/70 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. CLOSING SIGNATURE ─────────────────────────────── */}
      <section className="px-5 sm:px-10 py-14 sm:py-20 bg-[#FAF8F4] border-t border-black/5">
        <div className="max-w-2xl mx-auto text-center">
          <Leaf className="w-7 h-7 text-[#3a5a2c] mx-auto mb-4 opacity-70" />
          <p className="font-serif text-[18px] sm:text-[22px] italic text-[#1a2416] leading-relaxed mb-5">
            “Come see where your morning cup is born.<br />
            We’ll keep the kettle on.”
          </p>
          <div className="inline-flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-300 text-[#1a2416] flex items-center justify-center font-serif text-base">
              M
            </div>
            <div className="text-left">
              <p className="text-[13px] font-semibold text-[#1a2416]">Mr Mohit Barman</p>
              <p className="text-[10px] uppercase tracking-widest text-[#1a2416]/55">Founder · Jorhat, Assam</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#reserve"
              className="inline-flex items-center gap-2 bg-[#1a2416] text-white text-[11px] font-bold uppercase tracking-[0.16em] px-5 py-3 rounded-full hover:bg-[#0f1612] transition-colors"
            >
              Reserve your dates <ArrowRight className="w-3 h-3" />
            </a>
            <a
              href="mailto:founder@drtea.in?subject=Staycation%20enquiry"
              className="inline-flex items-center gap-2 text-[#1a2416] text-[11px] font-bold uppercase tracking-[0.16em] px-5 py-3 rounded-full border border-black/15 hover:bg-white transition-colors"
            >
              <Mail className="w-3 h-3" /> founder@drtea.in
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
