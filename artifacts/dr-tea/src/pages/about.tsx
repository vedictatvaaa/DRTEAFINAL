import { useRef } from 'react';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight, Leaf, MapPin, Award } from 'lucide-react';
import Seo from '@/components/Seo';

// Word-by-word ink-reveal for the pull-quote — feels handwritten, not mechanical
const quoteContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.15 } },
};
const quoteWord: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', damping: 18, stiffness: 110, mass: 0.6 },
  },
};

const PHILOSOPHY_QUOTE =
  '“India grows some of the finest tea on earth — yet the most premium blends have historically been exported, leaving Indian consumers with what remains.”';

const values = [
  { icon: '🌱', title: 'Single-Origin Always', body: 'Every tea is traceable to a named garden, a named season, and named pickers — because transparency is the foundation of trust.' },
  { icon: '🤝', title: 'Ethical Partnerships', body: 'We pay above fair-trade rates to every estate we work with. Good tea starts with good people.' },
  { icon: '🧪', title: 'Tested for Purity', body: 'All batches are third-party tested for pesticides, heavy metals, and adulterants before they reach your cup.' },
  { icon: '📦', title: 'Plastic-Free Packaging', body: 'Our pouches are compostable kraft, our labels are recycled, and our mailers are made from 100% recycled cardboard.' },
];

const certifications = [
  { badge: 'FSSAI', label: 'India Food Safety', sub: 'Certified manufacturer' },
  { badge: 'ISO', label: 'ISO 22000', sub: 'Food safety management' },
  { badge: 'Halal', label: 'Halal Certified', sub: 'All blends approved' },
  { badge: 'UK', label: 'UK Registered', sub: 'Trading Standards compliant' },
];

const team = [
  { name: 'Mr Mohit Barman', role: 'Founder', origin: 'Jorhat, Assam', img: '/images/brand-story.webp' },
  { name: 'Priya Nair', role: 'Head of Sourcing', origin: 'Darjeeling · Nilgiris', img: '/images/category-green.webp' },
];

export default function About() {
  const philosophyRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: philosophyRef,
    offset: ['start end', 'end start'],
  });
  // Parallax: background wash & drifting leaves move at different rates than the section
  const washY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const washScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1.05, 1]);
  const leafAY = useTransform(scrollYProgress, [0, 1], [60, -160]);
  const leafARot = useTransform(scrollYProgress, [0, 1], [-15, 25]);
  const leafBY = useTransform(scrollYProgress, [0, 1], [-40, 140]);
  const leafBRot = useTransform(scrollYProgress, [0, 1], [20, -30]);

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="About Dr Tea — Modern Indian Tea, Sourced from Heritage Estates"
        description="Dr Tea is a UK-registered, India-manufactured tea brand sourcing single-origin chai, kadha, Darjeeling, Assam, Nilgiris and floral tisanes directly from heritage estates. FSSAI, ISO 22000 and Halal certified."
        canonical="https://drtea.in/about"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About Dr Tea',
          url: 'https://drtea.in/about',
          mainEntity: {
            '@type': 'Organization',
            name: 'Dr Tea',
            foundingLocation: 'London, United Kingdom',
            description: 'Modern Indian tea brand sourcing single-origin chai, kadha, Darjeeling, Assam, Nilgiris and floral tisanes directly from heritage estates.',
          },
        }}
        jsonLdId="ld-about"
      />
      {/* Hero */}
      <section className="relative h-[60vw] min-h-[300px] max-h-[460px] overflow-hidden">
        <img src="/images/brand-story.webp" alt="Tea garden" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#FAF8F4]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-3">Our Story</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="text-[clamp(2.2rem,8vw,4rem)] font-serif font-bold text-white leading-tight">
            Rooted in Soil.<br />Crafted in Stillness.
          </motion.h1>
        </div>
      </section>

      {/* Philosophy */}
      <section
        ref={philosophyRef}
        className="relative max-w-2xl mx-auto px-5 py-24 text-center overflow-hidden"
      >
        {/* Background layer: parallax radial wash + breathing pulse */}
        <motion.div
          style={{ y: washY, scale: washScale }}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full bg-[radial-gradient(circle,rgba(20,83,45,0.07),transparent_65%)] -z-0"
          aria-hidden="true"
        />

        {/* Drifting tea leaves — parallax + idle sway */}
        <motion.div
          style={{ y: leafAY, rotate: leafARot }}
          className="pointer-events-none absolute left-[8%] top-[18%] text-primary/15 -z-0 hidden sm:block"
          aria-hidden="true"
        >
          <motion.div
            animate={{ rotate: [0, 6, -4, 0], y: [0, -6, 4, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Leaf className="w-10 h-10" strokeWidth={1.2} />
          </motion.div>
        </motion.div>
        <motion.div
          style={{ y: leafBY, rotate: leafBRot }}
          className="pointer-events-none absolute right-[6%] top-[55%] text-primary/10 -z-0 hidden sm:block"
          aria-hidden="true"
        >
          <motion.div
            animate={{ rotate: [0, -8, 5, 0], y: [0, 5, -3, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          >
            <Leaf className="w-14 h-14" strokeWidth={1.1} />
          </motion.div>
        </motion.div>

        {/* Top hairline rule — draws across like ink */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="origin-center mx-auto mb-6 h-px w-16 bg-primary/40"
        />

        <motion.p
          initial={{ opacity: 0, y: 10, letterSpacing: '0.4em' }}
          whileInView={{ opacity: 1, y: 0, letterSpacing: '0.28em' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          className="text-[10px] uppercase text-primary/80 mb-4 relative"
        >
          Philosophy
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring', damping: 18, stiffness: 90, mass: 0.9, delay: 0.18 }}
          className="text-[clamp(1.6rem,4.2vw,2rem)] font-serif font-bold mb-4 leading-tight relative"
        >
          Why Dr Tea Exists
        </motion.h2>

        {/* Divider — leaf gently sways forever */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center justify-center gap-2 mb-12 text-primary/40 relative"
          aria-hidden="true"
        >
          <motion.span
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
            className="origin-right h-px w-8 bg-current"
          />
          <motion.span
            animate={{ rotate: [-8, 8, -8] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block"
          >
            <Leaf className="w-3.5 h-3.5" />
          </motion.span>
          <motion.span
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
            className="origin-left h-px w-8 bg-current"
          />
        </motion.div>

        <div className="relative space-y-7 text-left">
          {/* Lead pull-quote — word-by-word ink reveal with spring + blur */}
          <motion.p
            variants={quoteContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="text-[clamp(1rem,2.4vw,1.15rem)] font-serif italic text-gray-800 leading-relaxed text-center px-2"
          >
            {PHILOSOPHY_QUOTE.split(' ').map((w, i) => (
              <motion.span
                key={i}
                variants={quoteWord}
                className="inline-block mr-[0.25em] will-change-transform"
              >
                {w}
              </motion.span>
            ))}
          </motion.p>

          {/* Hairline that sweeps under the quote once it lands */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="origin-center mx-auto h-px w-10 bg-primary/30"
            aria-hidden="true"
          />

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', damping: 22, stiffness: 100, delay: 0.55 }}
            className="text-[13px] text-gray-600 leading-relaxed font-light"
          >
            Dr Tea is a UK-registered, India-manufactured botanical tea brand built on a single conviction: <span className="text-gray-800 font-normal">that modern Indian tea deserves to be world-class</span> — not just exported and forgotten.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', damping: 22, stiffness: 100, delay: 0.7 }}
            className="text-[13px] text-gray-600 leading-relaxed font-light"
          >
            We partner directly with heritage estates across Darjeeling, Assam, the Nilgiris and Kerala — cutting out every unnecessary intermediary, so more money flows back to the growers and more freshness reaches you.
          </motion.p>
        </div>

        {/* Pillar anchors — hairline rule sweeps in, then number drops with overshoot spring */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.13, delayChildren: 0.85 } },
          }}
          className="mt-14 grid grid-cols-3 gap-2 sm:gap-6 max-w-md mx-auto relative"
        >
          {[
            { k: 'Direct', v: 'from estate' },
            { k: '0', v: 'middlemen' },
            { k: 'Always', v: 'single-origin' },
          ].map(p => (
            <motion.div
              key={p.k}
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.12 } },
              }}
              className="text-center pt-3 relative"
            >
              <motion.div
                variants={{
                  hidden: { scaleX: 0 },
                  show: { scaleX: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
                }}
                className="origin-center absolute top-0 left-0 right-0 h-px bg-primary/25"
              />
              <motion.p
                variants={{
                  hidden: { opacity: 0, y: -10, scale: 0.8 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', damping: 12, stiffness: 220, mass: 0.7 },
                  },
                }}
                className="font-serif text-[20px] text-primary leading-none"
              >
                {p.k}
              </motion.p>
              <motion.p
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
                }}
                className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mt-1.5"
              >
                {p.v}
              </motion.p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Values */}
      <section className="bg-white border-y border-gray-100 py-12 px-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.22em] text-primary mb-2 text-center">What We Stand For</p>
          <h2 className="text-[20px] font-serif font-bold text-center mb-8">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {values.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="flex gap-4">
                <div className="text-3xl flex-shrink-0">{v.icon}</div>
                <div>
                  <h3 className="text-[13px] font-semibold mb-1">{v.title}</h3>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{v.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sourcing map */}
      <section className="py-12 px-5 max-w-2xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary mb-2 text-center">Where We Source</p>
        <h2 className="text-[20px] font-serif font-bold text-center mb-6">Garden to Your Cup</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { region: 'Darjeeling', specialty: 'First-flush black & green', emoji: '🏔️' },
            { region: 'Assam',      specialty: 'Bold CTC & orthodox black', emoji: '🍵' },
            { region: 'Nilgiris',   specialty: 'Blue mountain oolongs',     emoji: '🌿' },
            { region: 'Kerala',     specialty: 'Butterfly pea & spice blends', emoji: '🌺' },
            { region: 'Himachal',   specialty: 'Chamomile & lavender',      emoji: '❄️' },
            { region: 'Andhra',     specialty: 'Hibiscus & botanical tisane', emoji: '🌼' },
          ].map(loc => (
            <div key={loc.region} className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
              <div className="text-2xl">{loc.emoji}</div>
              <div className="flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                <p className="text-[11px] font-semibold">{loc.region}</p>
              </div>
              <p className="text-[10px] text-gray-400 leading-snug">{loc.specialty}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Certifications */}
      <section className="bg-[#1a2416] text-white py-10 px-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 justify-center mb-6">
            <Award className="w-4 h-4 text-primary" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Certifications &amp; Compliance</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {certifications.map(c => (
              <div key={c.badge} className="flex flex-col items-center text-center gap-2 border border-white/10 rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center font-bold text-[11px] text-white/90 tracking-wide">{c.badge}</div>
                <div>
                  <p className="text-[11px] font-semibold text-white">{c.label}</p>
                  <p className="text-[9px] text-white/40 mt-0.5">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-5 text-center">
        <Leaf className="w-6 h-6 text-primary mx-auto mb-4 opacity-60" />
        <h2 className="text-[20px] font-serif font-bold mb-2">Ready to Start Your Ritual?</h2>
        <p className="text-[12px] text-gray-500 mb-6">Explore 45+ teas from across India's finest gardens.</p>
        <Link href="/shop" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-primary/90 transition-colors">
          Explore Teas <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
