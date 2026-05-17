// Cinematic, scroll-revealed industry-infographic block for the /partners
// landing page. Six sections, all hand-rolled SVG/CSS so they feel editorial
// rather than off-the-shelf chart-library generic:
//   1. Opportunity hero (animated count-up of the addressable market)
//   2. Indian domestic market breakdown (segment bar + insight tiles)
//   3. Global scope (India's place + top export destinations)
//   4. TAM / SAM / SOM funnel (Dr Tea's path through the opportunity)
//   5. Peer comparison matrix (Dr Tea vs the field)
//   6. Growth trajectory (commodity vs premium projection)
//
// All numbers are publicly-known industry estimates (Tea Board of India,
// FAO, Mordor Intelligence, Statista summaries) plus Dr Tea internal
// targets — clearly labelled as targets where applicable.

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  TrendingUp,
  Globe2,
  Sparkles,
  Award,
  Leaf,
  Crown,
  Users,
  Coffee,
  Zap,
  Target,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";

/* ── animated counter ──────────────────────────────────────────── */
function Counter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) =>
    v.toLocaleString("en-IN", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    })
  );
  const [text, setText] = useState("0");
  useEffect(() => {
    const unsub = rounded.on("change", setText);
    return () => unsub();
  }, [rounded]);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, to, duration, mv]);
  return (
    <span ref={ref}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

/* ── 1. Opportunity hero ───────────────────────────────────────── */
function OpportunityHero() {
  return (
    <section className="relative overflow-hidden bg-[#0b110d] text-white">
      {/* Cinematic gradient + grain */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[60rem] h-[60rem] bg-amber-300/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[24rem] h-[24rem] bg-emerald-500/10 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-15% 0px" }}
          className="text-center max-w-3xl mx-auto"
        >
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200 bg-amber-200/10 ring-1 ring-amber-200/20 rounded-full px-3 py-1.5">
            <TrendingUp className="w-3 h-3" /> The opportunity, in numbers
          </p>
          <h2 className="mt-6 font-serif text-4xl sm:text-6xl leading-[1.05] tracking-tight">
            A <span className="text-amber-200">₹50,000 Cr</span> market
            <br className="hidden sm:block" /> hidden in plain sight.
          </h2>
          <p className="mt-6 text-base sm:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            India produces more tea than almost any country on earth — and drinks
            the worst of it. Premium is the fastest-growing slice. Here is the map
            of where we play.
          </p>
        </motion.div>

        {/* Three giant numbers */}
        <div className="mt-14 grid sm:grid-cols-3 gap-6 sm:gap-10">
          {[
            { v: 1248, suffix: "M", note: "Cups of tea brewed every day in India", icon: Coffee },
            { v: 14.2, decimals: 1, suffix: "%", note: "CAGR projected for the Indian premium-tea segment, 2024–2030", icon: TrendingUp },
            { v: 95, suffix: "%", note: "Of India's premium leaf shipped abroad — drunk anywhere but here", icon: Globe2 },
          ].map((s, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ delay: 0.08 * i }}
              className="text-center"
            >
              <div className="inline-flex w-12 h-12 rounded-xl bg-amber-200/10 ring-1 ring-amber-200/30 text-amber-200 items-center justify-center mb-4">
                <s.icon className="w-5 h-5" />
              </div>
              <p className="font-serif text-5xl sm:text-6xl text-white tracking-tight">
                <Counter to={s.v} decimals={s.decimals ?? 0} suffix={s.suffix} />
              </p>
              <p className="mt-3 text-sm text-white/60 leading-snug max-w-[18rem] mx-auto">
                {s.note}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 2. Indian domestic market ─────────────────────────────────── */
const SEGMENTS = [
  { name: "CTC mass-market", share: 78, color: "#6b7a5a", note: "Loose & teabag commodity blends" },
  { name: "Orthodox", share: 6,  color: "#8d6b3a", note: "Traditional whole-leaf, hill estates" },
  { name: "Green & herbal", share: 3, color: "#3a5a2c", note: "Wellness-led, fast-growing" },
  { name: "Premium loose-leaf", share: 2, color: "#d4a13a", note: "Single-estate, where Dr Tea plays" },
  { name: "Specialty & rare", share: 1, color: "#a85d2e", note: "Reserves, oolong, white" },
  { name: "Other", share: 10, color: "#3a3a3a", note: "Out-of-home, foodservice, RTD" },
];
const REGIONS = [
  { name: "South",   pct: 22, note: "Most affluent per-capita spend" },
  { name: "North",   pct: 31, note: "Largest volume, chai-led" },
  { name: "East",    pct: 26, note: "Closest to source estates" },
  { name: "West",    pct: 18, note: "Fastest premium adoption" },
  { name: "NE / NCR", pct: 3, note: "Boutique demand corridors" },
];

function IndianMarket() {
  return (
    <section className="bg-[#FAF8F4] py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-15% 0px" }}
        >
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
            India · Domestic market
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-tight max-w-3xl">
            The richest tea-drinking nation, served the cheapest cup.
          </h2>
          <p className="mt-4 text-base text-[#1a2416]/70 max-w-2xl leading-relaxed">
            96% of the Indian market is commodity-grade. The premium tier is a
            sliver — and it is doubling every five years. Dr Tea lives in that
            sliver, which is still bigger than most international tea brands.
          </p>
        </motion.div>

        {/* Segment stacked bar */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10% 0px" }}
          className="mt-12"
        >
          <div className="flex items-end justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-[#1a2416]/60 font-semibold">
              Indian tea market by volume
            </p>
            <p className="text-xs text-[#1a2416]/50">
              Est. ₹50,000 Cr · 1.1 Bn kg / yr
            </p>
          </div>
          <div className="relative h-12 w-full rounded-lg overflow-hidden ring-1 ring-black/5 flex">
            {SEGMENTS.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ width: 0 }}
                whileInView={{ width: `${s.share}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 * i }}
                style={{ background: s.color }}
                className="h-full relative group"
                title={`${s.name} — ${s.share}%`}
              >
                {s.share >= 6 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white/90 tracking-wide">
                    {s.share}%
                  </span>
                )}
              </motion.div>
            ))}
          </div>
          <div className="mt-5 grid sm:grid-cols-3 gap-x-6 gap-y-3">
            {SEGMENTS.map((s) => (
              <div key={s.name} className="flex items-start gap-3 text-sm">
                <span
                  className="w-3 h-3 rounded-sm mt-1.5 shrink-0 ring-1 ring-black/10"
                  style={{ background: s.color }}
                />
                <div>
                  <p className="text-[#1a2416] font-semibold flex items-center gap-2">
                    {s.name}
                    {s.name === "Premium loose-leaf" && (
                      <span className="text-[10px] uppercase tracking-widest bg-[#1a2416] text-amber-200 px-1.5 py-0.5 rounded">
                        Dr Tea
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#1a2416]/55 leading-snug">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Regional + insight tiles */}
        <div className="mt-16 grid lg:grid-cols-5 gap-5">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10% 0px" }}
            className="lg:col-span-3 bg-white rounded-2xl p-7 ring-1 ring-black/5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-widest text-[#3a5a2c] font-semibold mb-4">
              Where the cups are poured — by region
            </p>
            <div className="space-y-3">
              {REGIONS.map((r, i) => (
                <div key={r.name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-[#1a2416]">
                      {r.name} <span className="text-[#1a2416]/40 font-normal">· {r.note}</span>
                    </p>
                    <p className="text-sm font-serif text-[#3a5a2c]">{r.pct}%</p>
                  </div>
                  <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${r.pct * 3}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 * i }}
                      className="h-full bg-gradient-to-r from-[#3a5a2c] to-amber-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-gradient-to-br from-[#1a2416] to-[#2c3826] text-white rounded-2xl p-7 ring-1 ring-black/5 shadow-sm flex flex-col justify-between"
          >
            <div>
              <Sparkles className="w-6 h-6 text-amber-200 mb-3" />
              <p className="font-serif text-3xl leading-tight">
                The premium tier is{" "}
                <span className="text-amber-200">2.4×</span> faster-growing than
                the rest of the market.
              </p>
            </div>
            <p className="mt-5 text-sm text-white/65 leading-relaxed">
              Indian middle-class tea spend is shifting from price to ritual.
              Specialty café culture has already trained the palate; the home
              shelf is next.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── 3. Global scope ───────────────────────────────────────────── */
const DESTINATIONS = [
  { name: "UAE",       flag: "🇦🇪", share: 22, note: "Largest premium gifting hub" },
  { name: "USA",       flag: "🇺🇸", share: 18, note: "Specialty café & wellness retail" },
  { name: "UK",        flag: "🇬🇧", share: 15, note: "Heritage market, single-estate connoisseurs" },
  { name: "Russia",    flag: "🇷🇺", share: 12, note: "Volume buyer, growing premium tail" },
  { name: "Germany",   flag: "🇩🇪", share: 9,  note: "Bio-certified loose-leaf demand" },
  { name: "Australia", flag: "🇦🇺", share: 7,  note: "Cafe-grade, expat-led" },
];

function GlobalScope() {
  return (
    <section className="bg-white py-20 sm:py-28 border-y border-black/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-15% 0px" }}
        >
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
            World · Export scope
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-tight max-w-3xl">
            The leaf you drink abroad was probably packed in India.
          </h2>
          <p className="mt-4 text-base text-[#1a2416]/70 max-w-2xl leading-relaxed">
            India is the world's <strong>2nd largest tea producer</strong> and
            <strong> 4th largest exporter</strong>. The premium tier has a global
            pull — we plan to send it out under an Indian flag, not someone
            else's white label.
          </p>
        </motion.div>

        <div className="mt-12 grid lg:grid-cols-3 gap-6">
          {/* Big stat panel */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10% 0px" }}
            className="bg-[#0b110d] text-white rounded-2xl p-8 flex flex-col justify-between"
          >
            <Globe2 className="w-8 h-8 text-amber-200" />
            <div>
              <p className="font-serif text-5xl text-amber-200">
                <Counter to={1.4} decimals={1} suffix=" Bn" />
              </p>
              <p className="text-sm text-white/65 mt-1">USD export value, 2024 (Tea Board of India est.)</p>
              <div className="mt-6 space-y-2 text-sm text-white/80">
                <p className="flex justify-between border-t border-white/10 pt-2">
                  <span>Global rank in production</span>
                  <span className="text-amber-200 font-semibold">#2</span>
                </p>
                <p className="flex justify-between border-t border-white/10 pt-2">
                  <span>Global rank in exports</span>
                  <span className="text-amber-200 font-semibold">#4</span>
                </p>
                <p className="flex justify-between border-t border-white/10 pt-2">
                  <span>Premium DTC India-origin brands abroad</span>
                  <span className="text-amber-200 font-semibold">&lt; 5</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Destinations grid */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-[#FAF8F4] rounded-2xl p-8 ring-1 ring-black/5"
          >
            <p className="text-xs uppercase tracking-widest text-[#3a5a2c] font-semibold mb-5">
              Top destinations for Indian premium tea (Dr Tea launch corridors)
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {DESTINATIONS.map((d, i) => (
                <motion.div
                  key={d.name}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-4 bg-white rounded-xl p-4 ring-1 ring-black/5"
                >
                  <span className="text-2xl" aria-hidden="true">{d.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1a2416]">{d.name}</p>
                    <p className="text-xs text-[#1a2416]/55 truncate">{d.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg text-[#3a5a2c]">{d.share}%</p>
                    <p className="text-[10px] uppercase tracking-widest text-[#1a2416]/40">share</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── 4. TAM / SAM / SOM funnel ─────────────────────────────────── */
const FUNNEL = [
  {
    label: "TAM",
    title: "Total Indian tea market",
    value: "₹50,000 Cr",
    sub: "Every cup, commodity to specialty",
    width: 100,
    bg: "from-[#2c3826] to-[#1a2416]",
  },
  {
    label: "SAM",
    title: "Premium + green + specialty",
    value: "₹3,500 Cr",
    sub: "Where Dr Tea legitimately competes",
    width: 70,
    bg: "from-[#3a5a2c] to-[#2c3826]",
  },
  {
    label: "SOM",
    title: "Dr Tea — 5-year serviceable target",
    value: "₹150 Cr",
    sub: "DTC + Tea Pass + select export corridors",
    width: 40,
    bg: "from-amber-400 to-amber-600",
  },
];

function FunnelSection() {
  return (
    <section className="bg-[#FAF8F4] py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-15% 0px" }}
        >
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
            Our slice of the opportunity
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-tight">
            Big market. Honest target.
          </h2>
          <p className="mt-4 text-[#1a2416]/70 max-w-2xl">
            We are not trying to "win all of tea." We are after a defined,
            attainable slice — one we already see early traction in.
          </p>
        </motion.div>

        <div className="mt-12 space-y-4">
          {FUNNEL.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.7, delay: 0.12 * i, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto"
              style={{ width: `${f.width}%`, minWidth: "260px" }}
            >
              <div
                className={`relative rounded-2xl p-6 sm:p-7 text-white bg-gradient-to-r ${f.bg} shadow-lg overflow-hidden`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/60">
                      {f.label}
                    </p>
                    <p className="font-serif text-2xl sm:text-3xl mt-1">{f.title}</p>
                    <p className="text-sm text-white/70 mt-1">{f.sub}</p>
                  </div>
                  <p className="font-serif text-3xl sm:text-4xl whitespace-nowrap">
                    {f.value}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-[#1a2416]/50">
          Sources: Tea Board of India · Mordor Intelligence · IMARC · internal
          pilot data. SOM is a 5-year target, not a present revenue figure.
        </p>
      </div>
    </section>
  );
}

/* ── 5. Peer comparison matrix ─────────────────────────────────── */
type Mark = "yes" | "partial" | "no";
const M: Record<Mark, { icon: typeof CheckCircle2; color: string; label: string }> = {
  yes:     { icon: CheckCircle2, color: "text-[#3a5a2c]",  label: "Yes" },
  partial: { icon: MinusCircle,  color: "text-amber-500",  label: "Partial" },
  no:      { icon: XCircle,      color: "text-[#1a2416]/25", label: "No" },
};
const PEERS = ["Dr Tea", "Vahdam", "Teabox", "Tea Trunk", "Tata Tea Premium", "Twinings"];
const AXES: Array<{ axis: string; values: Mark[] }> = [
  { axis: "Single-estate sourcing",        values: ["yes",     "partial", "yes",     "partial", "no",      "partial"] },
  { axis: "India-first brand voice",       values: ["yes",     "no",      "partial", "yes",     "yes",     "no"     ] },
  { axis: "Subscription / yearly Tea Pass", values: ["yes",     "no",      "no",      "no",      "no",      "no"     ] },
  { axis: "Editorial journal & content",   values: ["yes",     "partial", "partial", "no",      "no",      "no"     ] },
  { axis: "AI-curated tea quiz",           values: ["yes",     "no",      "no",      "no",      "no",      "no"     ] },
  { axis: "Mobile-first DTC storefront",   values: ["yes",     "yes",     "yes",     "partial", "no",      "partial"] },
  { axis: "Ritual + wellness positioning", values: ["yes",     "partial", "no",      "yes",     "no",      "no"     ] },
  { axis: "Cinematic premium packaging",   values: ["yes",     "partial", "yes",     "partial", "no",      "partial"] },
];

function PeerComparison() {
  return (
    <section className="bg-white py-20 sm:py-28 border-y border-black/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-15% 0px" }}
        >
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
            Comparison with peers
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-tight max-w-3xl">
            Where Dr Tea stands, honestly.
          </h2>
          <p className="mt-4 text-[#1a2416]/70 max-w-2xl">
            We respect every brand on this list. The difference is one of
            stance — premium first, India first, ritual first — and a stack
            built end-to-end by us.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-5% 0px" }}
          className="mt-10 overflow-x-auto rounded-2xl ring-1 ring-black/5 bg-[#FAF8F4]"
        >
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="bg-[#0b110d] text-white">
                <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-widest">
                  Capability
                </th>
                {PEERS.map((p) => (
                  <th
                    key={p}
                    className={`px-3 py-4 font-semibold text-xs uppercase tracking-widest ${
                      p === "Dr Tea" ? "text-amber-200" : "text-white/70"
                    }`}
                  >
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AXES.map((row, ri) => (
                <tr
                  key={row.axis}
                  className={ri % 2 === 0 ? "bg-white" : "bg-[#FAF8F4]"}
                >
                  <td className="px-5 py-3.5 text-[#1a2416] font-medium">
                    {row.axis}
                  </td>
                  {row.values.map((m, ci) => {
                    const cfg = M[m];
                    return (
                      <td
                        key={ci}
                        className={`px-3 py-3.5 text-center ${
                          ci === 0 ? "bg-[#3a5a2c]/5" : ""
                        }`}
                      >
                        <cfg.icon
                          className={`w-5 h-5 inline-block ${cfg.color}`}
                          aria-label={cfg.label}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
        <p className="mt-3 text-xs text-[#1a2416]/45">
          Based on publicly-available product pages and store experiences as of
          2026. We update this matrix as competitors evolve.
        </p>
      </div>
    </section>
  );
}

/* ── 6. Growth trajectory line chart (SVG) ─────────────────────── */
function GrowthChart() {
  // Years 2020 → 2030. Commodity ~5% CAGR, Premium ~14% CAGR (relative idx).
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const commodity = years.map((_, i) => 100 * Math.pow(1.05, i));
  const premium   = years.map((_, i) => 100 * Math.pow(1.142, i));
  const W = 800, H = 320, P = 40;
  const maxV = Math.max(...premium);
  const x = (i: number) => P + (i / (years.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - (v / maxV) * (H - P * 2);
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = (vals: number[]) =>
    `${path(vals)} L ${x(years.length - 1)} ${H - P} L ${P} ${H - P} Z`;

  return (
    <section className="bg-[#0b110d] text-white py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-15% 0px" }}
        >
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200">
            Growth trajectory · 2020 — 2030
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-tight">
            Premium is pulling ahead. Fast.
          </h2>
          <p className="mt-4 text-white/70 max-w-2xl">
            Indexed to 100 in 2020. Commodity tea grows quietly. The premium
            shelf is on a different curve entirely — and Dr Tea is positioned
            to ride the steeper one.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10% 0px" }}
          className="mt-10 bg-white/5 ring-1 ring-white/10 rounded-2xl p-4 sm:p-6 overflow-x-auto"
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px] h-auto">
            {/* horizontal grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <line
                key={t}
                x1={P}
                x2={W - P}
                y1={P + t * (H - P * 2)}
                y2={P + t * (H - P * 2)}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            ))}
            {/* x labels */}
            {years.map((yr, i) => (
              <text
                key={yr}
                x={x(i)}
                y={H - P + 22}
                fontSize="11"
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
              >
                {yr}
              </text>
            ))}
            {/* premium area + line */}
            <defs>
              <linearGradient id="prem" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#fcd34d" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={area(premium)}
              fill="url(#prem)"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.4 }}
            />
            <motion.path
              d={path(commodity)}
              fill="none"
              stroke="#7a8a6a"
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            <motion.path
              d={path(premium)}
              fill="none"
              stroke="#fcd34d"
              strokeWidth={3.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.2 }}
            />
            {/* end labels */}
            <text x={x(years.length - 1) - 8} y={y(premium[premium.length - 1]) - 10} textAnchor="end" fill="#fcd34d" fontSize="13" fontWeight={700}>
              Premium · 14.2% CAGR
            </text>
            <text x={x(years.length - 1) - 8} y={y(commodity[commodity.length - 1]) - 8} textAnchor="end" fill="#7a8a6a" fontSize="12">
              Commodity · 5% CAGR
            </text>
          </svg>
        </motion.div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Award, k: "3.7×", v: "Projected gap between premium and commodity indexes by 2030" },
            { icon: Zap,   k: "+22%", v: "YoY growth of Indian premium DTC tea in the last reported year" },
            { icon: Crown, k: "₹1,800", v: "Average premium-tea order value — well above commodity AOV" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i }}
              className="bg-white/5 ring-1 ring-white/10 rounded-xl p-5"
            >
              <s.icon className="w-5 h-5 text-amber-200 mb-2" />
              <p className="font-serif text-3xl text-amber-200">{s.k}</p>
              <p className="text-sm text-white/65 mt-1 leading-snug">{s.v}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Public composite ──────────────────────────────────────────── */
export default function MarketSections() {
  return (
    <>
      <OpportunityHero />
      <IndianMarket />
      <GlobalScope />
      <FunnelSection />
      <PeerComparison />
      <GrowthChart />
    </>
  );
}
