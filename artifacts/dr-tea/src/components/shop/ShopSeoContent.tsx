import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Leaf,
  Flame,
  Moon,
  Sun,
  Sparkles,
  ShieldCheck,
  Truck,
  Award,
  HeartPulse,
  Coffee,
  Mountain,
  ArrowRight,
  Clock,
  Thermometer,
  Droplets,
} from "lucide-react";
import { categories } from "@/data/products";

const wellnessGoals = [
  {
    slug: "immunity",
    label: "Immunity",
    icon: ShieldCheck,
    blurb: "Tulsi, ginger and ayurvedic kadhas to fortify your defences year-round.",
    color: "from-amber-50 to-orange-50",
    href: "/shop/kadha",
  },
  {
    slug: "sleep",
    label: "Sleep & Calm",
    icon: Moon,
    blurb: "Chamomile, lavender and ashwagandha for restorative, deep evening rest.",
    color: "from-indigo-50 to-purple-50",
    href: "/shop/floral-tisane",
  },
  {
    slug: "energy",
    label: "Clean Energy",
    icon: Sun,
    blurb: "High-altitude green and black teas for sustained, jitter-free focus.",
    color: "from-emerald-50 to-lime-50",
    href: "/shop/green-tea",
  },
  {
    slug: "digestion",
    label: "Digestion",
    icon: Leaf,
    blurb: "Fennel, peppermint and CCF blends to soothe and reset after every meal.",
    color: "from-teal-50 to-cyan-50",
    href: "/shop/kadha",
  },
  {
    slug: "ritual",
    label: "Daily Ritual",
    icon: Flame,
    blurb: "Royal masala chai and slow-brewed dum chai for the heart of your morning.",
    color: "from-rose-50 to-amber-50",
    href: "/shop/chai",
  },
  {
    slug: "reserve",
    label: "Connoisseur",
    icon: Award,
    blurb: "First flush Darjeeling, oolongs and rare single-estate lots from the reserve.",
    color: "from-stone-50 to-amber-50",
    href: "/shop/tea-reserve",
  },
];

const ritualMoments = [
  {
    title: "The 6AM Wake-Up",
    desc: "Royal masala chai, kadak CTC and Assam gold — bold, malty, milk-friendly cups built for the Indian morning.",
    icon: Sun,
    href: "/shop/chai",
  },
  {
    title: "The 11AM Reset",
    desc: "Darjeeling first flush, sencha and white tea — clean, focused steeps for the long mid-morning stretch.",
    icon: Coffee,
    href: "/shop/green-tea",
  },
  {
    title: "The 4PM Wellness Shot",
    desc: "Tulsi-ginger kadha, haldi-mulethi and sea buckthorn — ayurvedic decoctions to carry you through the afternoon.",
    icon: HeartPulse,
    href: "/shop/kadha",
  },
  {
    title: "The 9PM Wind-Down",
    desc: "Chamomile, lavender, rose and blue pea — caffeine-free floral tisanes to soften the day's edges.",
    icon: Moon,
    href: "/shop/floral-tisane",
  },
];

const origins = [
  {
    region: "Assam",
    note: "Malty, full-bodied black teas from the Brahmaputra valley — the soul of Indian breakfast chai.",
    img: "https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?w=800&q=80&auto=format&fit=crop",
  },
  {
    region: "Darjeeling",
    note: "Muscatel first and second flush teas grown 2,000m up in the Himalayan foothills — the 'champagne of teas'.",
    img: "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80&auto=format&fit=crop",
  },
  {
    region: "Nilgiri",
    note: "Bright, brisk South Indian teas from the Blue Mountains — clean, aromatic and beautifully iced.",
    img: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80&auto=format&fit=crop",
  },
  {
    region: "Kerala & Karnataka",
    note: "Spice-belt botanicals, cardamom, ginger and tulsi for ayurvedic kadhas and herbal tisanes.",
    img: "https://images.unsplash.com/photo-1542223189-67a03fa0f0bd?w=800&q=80&auto=format&fit=crop",
  },
];

const brewingMatrix = [
  { kind: "Black Tea / CTC", temp: "95–100°C", time: "3–4 min", ratio: "1 tsp / 200ml" },
  { kind: "Green Tea", temp: "75–80°C", time: "2–3 min", ratio: "1 tsp / 200ml" },
  { kind: "White Tea", temp: "75–80°C", time: "4–5 min", ratio: "1.5 tsp / 200ml" },
  { kind: "Oolong", temp: "85–90°C", time: "3–4 min", ratio: "1 tsp / 200ml" },
  { kind: "Floral Tisane", temp: "100°C", time: "5–7 min", ratio: "1 tbsp / 250ml" },
  { kind: "Kadha", temp: "100°C", time: "8–10 min simmer", ratio: "1 tbsp / 300ml" },
];

export const shopFaqs = [
  {
    q: "Which is the best tea for daily Indian breakfast?",
    a: "For traditional milk chai, look for a malty Assam CTC like Royal Masala Chai or Dr Tea Gold CTC — both hold up beautifully to milk, sugar and whole spices. For a stronger, longer brew try Kadak Chai.",
  },
  {
    q: "What is the difference between green tea, black tea and oolong?",
    a: "All three come from the same Camellia sinensis plant — the difference is oxidation. Green tea is unoxidised (grassy, light), black tea is fully oxidised (malty, full-bodied) and oolong sits in between (floral, complex). Caffeine sits in a similar range across all three.",
  },
  {
    q: "Are kadhas and herbal tisanes caffeine-free?",
    a: "Yes — our ayurvedic kadhas (tulsi-ginger, haldi-mulethi, ashwagandha) and floral tisanes (chamomile, lavender, rose, blue pea, hibiscus) are 100% caffeine-free and safe to enjoy in the evening.",
  },
  {
    q: "Which tea is best for weight management and metabolism?",
    a: "Unoxidised green teas, white teas and oolongs are widely studied for metabolic support thanks to their EGCG and polyphenol content. Pair a morning cup with our digestive fennel or CCF blend after meals.",
  },
  {
    q: "How fresh are Dr Tea leaves?",
    a: "Every order ships from a small-batch lot harvested within the current season. We never bulk-warehouse, and resealable pouches preserve aroma for up to 12 months when stored away from heat and sunlight.",
  },
  {
    q: "Do you ship across India? Is shipping free?",
    a: "Yes — Dr Tea ships pan-India in 3–6 working days. Standard shipping is free on orders above ₹999, with express delivery available in metros at checkout.",
  },
];

const trustBadges = [
  { icon: Leaf, label: "Single-origin estates" },
  { icon: Award, label: "Small-batch harvested" },
  { icon: Truck, label: "Free shipping ₹999+" },
  { icon: ShieldCheck, label: "30-day freshness promise" },
];

export default function ShopSeoContent({ activeCategoryName }: { activeCategoryName?: string }) {
  return (
    <div className="space-y-16 sm:space-y-20 pb-16">
      <section className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold mb-3 inline-flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> The Dr Tea collection
          </p>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold mb-4 leading-tight">
            India&rsquo;s most thoughtful tea catalog — direct from heritage
            estates to your cup
          </h2>
          <p className="text-sm sm:text-[15px] text-foreground/75 leading-relaxed">
            From the muscatel hills of <strong>Darjeeling</strong> to the malty
            flush of <strong>Assam</strong>, the high-altitude greens of{" "}
            <strong>Nilgiri</strong> and the ancient <strong>Ayurvedic kadhas</strong>{" "}
            of the South — every tea on this page is small-batch, single-origin
            and shipped within weeks of harvest. Whether you&rsquo;re here for a
            bold <strong>masala chai</strong>, a clarifying <strong>green tea</strong>,
            a calming <strong>chamomile tisane</strong> or a rare reserve flush,
            you&rsquo;ll find a brew worth slowing down for.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {trustBadges.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-border"
            >
              <Icon className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-[12px] font-medium leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6">
        <SectionHeader
          eyebrow="Shop by category"
          title="Find your style of tea"
          sub="Six worlds of flavour, each with its own ritual, terroir and time of day."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
          {categories.map((c, i) => (
            <motion.div
              key={c.slug}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={`/shop/${c.slug}`}
                className="group block rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg transition-shadow relative"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={c.image}
                    alt={`Shop ${c.name}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-serif font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {c.description}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    Shop {c.name.toLowerCase()} <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6">
        <SectionHeader
          eyebrow="Shop by wellness goal"
          title="What do you want your cup to do today?"
          sub="Every tea is tagged by ayurvedic and modern wellness benefit so you can shop with intention."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wellnessGoals.map((g) => (
            <Link
              key={g.slug}
              href={g.href}
              className={`group block rounded-2xl border border-border bg-gradient-to-br ${g.color} p-5 hover:shadow-md transition-shadow`}
            >
              <g.icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-serif font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                {g.label}
              </h3>
              <p className="text-xs text-foreground/70 leading-relaxed">{g.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                Explore <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#1a2416] text-white py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="Shop by ritual"
            title="A tea for every moment of the day"
            sub="From the first sip at dawn to the last cup at midnight — these are our most-loved daily rituals."
            invert
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ritualMoments.map((m) => (
              <Link
                key={m.title}
                href={m.href}
                className="group block rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-5 transition-colors"
              >
                <m.icon className="w-5 h-5 text-amber-200 mb-3" />
                <h3 className="font-serif font-semibold text-base mb-2 group-hover:text-amber-200 transition-colors">
                  {m.title}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">{m.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6">
        <SectionHeader
          eyebrow="From the source"
          title="The origins behind every cup"
          sub="Tea is terroir. We work directly with growers across India&rsquo;s four legendary tea belts."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {origins.map((o) => (
            <article
              key={o.region}
              className="rounded-2xl overflow-hidden border border-border bg-card"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={o.img}
                  alt={`${o.region} tea region`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mountain className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold text-base">{o.region}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{o.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#FAF8F4] py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <SectionHeader
            eyebrow="Brew it right"
            title="The Dr Tea brewing matrix"
            sub="Get more from every gram. Temperature and time matter more than you think."
          />
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Tea type</th>
                  <th className="text-left py-3 px-4 font-semibold">
                    <Thermometer className="w-3 h-3 inline mr-1" /> Temperature
                  </th>
                  <th className="text-left py-3 px-4 font-semibold">
                    <Clock className="w-3 h-3 inline mr-1" /> Steep time
                  </th>
                  <th className="text-left py-3 px-4 font-semibold">
                    <Droplets className="w-3 h-3 inline mr-1" /> Ratio
                  </th>
                </tr>
              </thead>
              <tbody>
                {brewingMatrix.map((row, i) => (
                  <tr
                    key={row.kind}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className="py-3 px-4 font-serif font-semibold">{row.kind}</td>
                    <td className="py-3 px-4 text-foreground/80">{row.temp}</td>
                    <td className="py-3 px-4 text-foreground/80">{row.time}</td>
                    <td className="py-3 px-4 text-foreground/80">{row.ratio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Want the deeper science?{" "}
            <Link href="/teapedia" className="text-primary font-semibold underline">
              Read the Teapedia →
            </Link>
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <SectionHeader
          eyebrow="Frequently asked"
          title="Everything you wanted to know about tea"
          sub=""
        />
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {shopFaqs.map((f) => (
            <details
              key={f.q}
              className="group p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <h3 className="font-serif font-semibold text-base pr-3">{f.q}</h3>
                <span className="text-2xl text-muted-foreground group-open:rotate-45 transition-transform leading-none">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-foreground/75 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 max-w-4xl">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-amber-50 p-7 sm:p-10 text-center">
          <h3 className="text-xl sm:text-2xl font-serif font-bold mb-3">
            Why tea-lovers across India choose Dr Tea
          </h3>
          <p className="text-sm text-foreground/75 leading-relaxed max-w-2xl mx-auto">
            {activeCategoryName ? (
              <>
                Our <strong>{activeCategoryName}</strong> collection — like every
                Dr Tea range — is built on three promises: <strong>traceable single-origin sourcing</strong>{" "}
                from estates we&rsquo;ve personally walked, <strong>small-batch processing</strong>{" "}
                that protects aroma compounds, and <strong>resealable freshness packaging</strong>{" "}
                that holds peak flavour for a full year.
              </>
            ) : (
              <>
                We are not a flavour-house. We are a small team of growers, sommeliers
                and ayurvedic practitioners building a transparent tea catalog for India
                and the world — one estate, one harvest, one ritual at a time. From
                <strong> Royal Masala Chai </strong> to{" "}
                <strong>Darjeeling First Flush</strong>, every cup is sourced, packed
                and shipped with care.
              </>
            )}
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 mt-5 text-[12px] font-bold uppercase tracking-wider text-primary hover:gap-2 transition-all"
          >
            Read our story <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  sub,
  invert,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  invert?: boolean;
}) {
  return (
    <div className="text-center mb-8 sm:mb-10 max-w-2xl mx-auto">
      <p
        className={`text-[10px] uppercase tracking-[0.25em] font-bold mb-2 ${
          invert ? "text-amber-200" : "text-primary"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`text-2xl sm:text-3xl font-serif font-bold leading-tight mb-2 ${
          invert ? "text-white" : ""
        }`}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={`text-sm leading-relaxed ${
            invert ? "text-white/70" : "text-muted-foreground"
          }`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
