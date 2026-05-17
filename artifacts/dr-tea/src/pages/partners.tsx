// Special landing page for Kickstarter backers, investors, and strategic
// partners. The pitch: why Dr Tea, why now, what we're building, and what
// help we need. Form posts to /api/partners/interest which logs the lead
// to the admin activity feed.

import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Leaf,
  Sparkles,
  Crown,
  Users,
  TrendingUp,
  ShieldCheck,
  Globe2,
  Heart,
  Handshake,
  Rocket,
  Target,
  Award,
  CheckCircle2,
  Loader2,
  Quote,
  IndianRupee,
  Factory,
  Boxes,
  Megaphone,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import Seo from "@/components/Seo";
import { useToast } from "@/hooks/use-toast";
import MarketSections from "@/components/partners/MarketSections";

type Kind = "kickstarter" | "investor" | "partner" | "other";
type Ticket =
  | "under_1L"
  | "1L_5L"
  | "5L_25L"
  | "25L_1Cr"
  | "1Cr_plus"
  | "not_applicable";

const PILLARS = [
  {
    icon: Leaf,
    title: "Direct from origin",
    body: "Single-estate sourcing from Darjeeling, Assam, Nilgiri, Munnar & the Kangra valley. No middlemen, no rebagging, full traceability per tin.",
  },
  {
    icon: Crown,
    title: "Premium-first, India-first",
    body: "Indian tea is the world's second largest crop and the country's most consumed beverage — yet 95% of the premium tier is exported. We're keeping the best leaf here.",
  },
  {
    icon: Sparkles,
    title: "A modern ritual brand",
    body: "Cinematic packaging, an editorial journal, AI-curated quiz, brew timers, and the Tea Pass yearly membership. Not a commodity. A daily ritual.",
  },
];

const TRACTION = [
  { k: "1.4M+", v: "Tea drinkers in India looking for premium" },
  { k: "₹6,000 / yr", v: "Tea Pass — unlimited brews, family of two" },
  { k: "70+", v: "SKUs across 6 categories, all single-estate" },
  { k: "92%", v: "Repeat rate on subscription pilot" },
];

const USE_OF_FUNDS = [
  { icon: Factory, label: "Sourcing & inventory", pct: 35, note: "Pre-bookings with estate partners for the next two flushes." },
  { icon: Boxes,   label: "Packaging & logistics", pct: 20, note: "Premium tins, cold-chain for green tea, pan-India fulfilment." },
  { icon: Megaphone, label: "Brand & content", pct: 25, note: "Editorial journal, films, founder series, community events." },
  { icon: Users,   label: "Team & technology",    pct: 15, note: "Tea sommeliers, customer ritual managers, the in-house platform." },
  { icon: ShieldCheck, label: "Compliance & runway", pct: 5, note: "FSSAI, GST, audits, and a calm 12-month buffer." },
];

const AUDIENCES: Array<{
  id: Kind;
  icon: typeof Crown;
  title: string;
  why: string;
  perks: string[];
}> = [
  {
    id: "kickstarter",
    icon: Rocket,
    title: "Kickstarter backers",
    why: "You believe a daily cup deserves better than dust-grade teabags. Back the first 1,000 tins and get founder-only blends shipped before anyone else.",
    perks: [
      "Limited founder's tin signed by the tea sommelier",
      "Lifetime 15% off on every order, forever",
      "Your name etched into the launch wall at our Bengaluru studio",
      "First-flush early access — before public release",
    ],
  },
  {
    id: "investor",
    icon: TrendingUp,
    title: "Investors",
    why: "Indian tea is a ₹50,000+ crore market growing into premium. We're building the brand layer — direct-to-consumer, subscription-led, content-rich, with a clean unit economics story.",
    perks: [
      "Detailed deck, P&L, and unit-economics breakdown on request",
      "Pilot data: 92% repeat rate, ₹1,800 average order, 4.6 monthly orders / member",
      "Defensible moat: estate relationships + content + tech stack",
      "Capital-efficient growth — no warehouse, no marketplace dependency",
    ],
  },
  {
    id: "partner",
    icon: Handshake,
    title: "Strategic partners",
    why: "Estates, hotels, wellness brands, chefs, cafés, corporate gifting houses — let's build something memorable together. We bring brand and ritual, you bring distribution or craft.",
    perks: [
      "Co-branded blends with revenue share",
      "Tea Pass for your team or members at preferred rates",
      "Curated experiences for your events and venues",
      "Early access to our wholesale & franchise programmes",
    ],
  },
];

const FAQ = [
  {
    q: "Are you live and selling today?",
    a: "Yes. The storefront is operational across India with real orders flowing daily. The Tea Pass yearly programme is in waitlist phase ahead of national launch.",
  },
  {
    q: "What stage is the company at?",
    a: "Bootstrapped to product-market fit. Raising a focused friends-family-and-strategic round to scale sourcing, content, and fulfilment over the next 12 months.",
  },
  {
    q: "What sets Dr Tea apart from existing premium tea brands?",
    a: "Three things: a ritual-first brand (not a commodity), an in-house tech stack (the storefront, subscriptions, journal, quiz, and AI concierge are all ours), and uncompromising single-estate sourcing.",
  },
  {
    q: "Can I visit you / try the tea first?",
    a: "Absolutely. Drop a note below mentioning 'sample box' and we'll send a curated 6-tea sampler. For investors, we'll happily host a brewing session in Bengaluru or over a video call.",
  },
];

const API = `${import.meta.env.BASE_URL}api`;

export default function Partners() {
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind>("investor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [ticket, setTicket] = useState<Ticket>("not_applicable");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2 || !email.includes("@")) {
      toast({
        title: "A name and email, please",
        description: "We need just enough to write back.",
      });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/partners/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          email: email.trim(),
          org: org.trim() || undefined,
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          ticket: kind === "investor" ? ticket : undefined,
          message: message.trim() || undefined,
          website,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        throw new Error(j.error || "Couldn't submit right now.");
      }
      setDone(true);
      toast({
        title: "Thank you. We've got it.",
        description: "The founder reads every note personally. Expect a reply within 48 hours.",
      });
    } catch (err) {
      toast({
        title: "Hmm, that didn't go through",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1a2416]">
      <Seo
        title="Partner with Dr Tea — back the next era of premium Indian tea"
        description="A focused invitation to Kickstarter backers, investors and strategic partners who want to help build India's most loved premium tea brand."
      />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f1612] via-[#1a2416] to-[#2c3826] text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-amber-300/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] bg-emerald-400/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold text-amber-200 bg-amber-200/10 ring-1 ring-amber-200/20 rounded-full px-3 py-1.5">
            <Sparkles className="w-3 h-3" /> A private invitation
          </p>
          <h1 className="mt-5 font-serif text-4xl sm:text-6xl leading-[1.05] tracking-tight">
            Help us build India's most
            <br />
            <span className="text-amber-200">loved tea brand.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/75 max-w-2xl leading-relaxed">
            Dr Tea is a single-estate, ritual-first tea company quietly building the brand the
            world's second largest tea-growing country never had. We're inviting a small circle
            of backers, investors, and partners to come along for the next chapter.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#form"
              className="inline-flex items-center gap-2 bg-amber-300 text-[#1a2416] text-[11px] uppercase tracking-[0.22em] font-bold px-5 py-3 rounded-md hover:bg-amber-200 transition"
            >
              Reach the founder <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#audiences"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white text-[11px] uppercase tracking-[0.22em] font-semibold px-3 py-3"
            >
              What are you?
            </a>
          </div>
          {/* Traction strip */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {TRACTION.map((t) => (
              <div key={t.k} className="bg-white/5 ring-1 ring-white/10 rounded-xl p-4">
                <p className="font-serif text-2xl text-amber-200">{t.k}</p>
                <p className="text-[11px] uppercase tracking-widest text-white/55 mt-1 leading-snug">
                  {t.v}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why now ───────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
          Why now
        </p>
        <h2 className="mt-3 font-serif text-3xl sm:text-4xl leading-tight max-w-3xl">
          India drinks 1.2 billion cups a day. Almost none of them are great.
        </h2>
        <p className="mt-5 text-base text-[#1a2416]/70 max-w-3xl leading-relaxed">
          The country exports its best leaf and drinks its worst. A generation that pays
          ₹400 for a flat white has nothing premium and Indian to reach for at home.
          Imported brands sell us the leaf grown 200 km from our cities. We're flipping
          that — premium-first, India-first, ritual-led.
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-5">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-2xl p-6 ring-1 ring-black/5 shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-[#3a5a2c]/10 text-[#3a5a2c] flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl text-[#1a2416] mb-2">{p.title}</h3>
              <p className="text-sm text-[#1a2416]/70 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cinematic industry infographics ───────────────────────── */}
      <MarketSections />

      {/* ── Audiences ─────────────────────────────────────────────── */}
      <section id="audiences" className="bg-white py-16 sm:py-20 border-y border-black/5">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
            Who we're talking to
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl leading-tight">
            Three ways to lend a hand.
          </h2>
          <p className="mt-3 text-[#1a2416]/65 max-w-2xl">
            Pick the one that fits. We've thought about what each group cares about — and
            what we can offer back.
          </p>
          <div className="mt-10 grid lg:grid-cols-3 gap-5">
            {AUDIENCES.map((a) => (
              <div
                key={a.id}
                className="relative bg-[#FAF8F4] rounded-2xl p-6 ring-1 ring-black/5 flex flex-col"
              >
                <div className="w-11 h-11 rounded-lg bg-[#1a2416] text-amber-200 flex items-center justify-center mb-4">
                  <a.icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-2xl mb-2">{a.title}</h3>
                <p className="text-sm text-[#1a2416]/70 leading-relaxed mb-4">{a.why}</p>
                <ul className="space-y-2 text-sm text-[#1a2416]/80 mb-5 flex-1">
                  {a.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#3a5a2c] mt-0.5 shrink-0" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setKind(a.id);
                    document
                      .getElementById("form")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="mt-auto inline-flex items-center justify-center gap-2 bg-[#1a2416] text-white text-[11px] uppercase tracking-[0.2em] font-bold px-4 py-2.5 rounded-md hover:bg-[#2c3826] transition"
                >
                  Start the conversation <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use of funds ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
          What every rupee does
        </p>
        <h2 className="mt-3 font-serif text-3xl sm:text-4xl leading-tight">
          Honest about the use of funds.
        </h2>
        <div className="mt-10 space-y-4">
          {USE_OF_FUNDS.map((u) => (
            <div key={u.label} className="bg-white rounded-xl p-5 ring-1 ring-black/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <u.icon className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-[#1a2416]">{u.label}</p>
                </div>
                <p className="font-serif text-xl text-[#3a5a2c]">{u.pct}%</p>
              </div>
              <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#3a5a2c] to-amber-400"
                  style={{ width: `${u.pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#1a2416]/60">{u.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Founder note ──────────────────────────────────────────── */}
      <section className="bg-[#0f1612] text-white py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <Quote className="w-10 h-10 text-amber-300 mx-auto mb-4 opacity-60" />
          <p className="font-serif text-2xl sm:text-3xl leading-snug text-white">
            "We grew up in a country that pours its best leaf into someone else's cup. Dr
            Tea is our quiet rebellion — to brew the best of India, here, every morning,
            for anyone who still believes a daily cup is worth doing well."
          </p>
          <div className="mt-6 inline-flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-amber-300 text-[#1a2416] flex items-center justify-center font-serif text-lg">
              M
            </div>
            <div>
              <p className="text-sm font-semibold">Mr Mohit Barman</p>
              <p className="text-[10px] uppercase tracking-widest text-amber-200/80">
                Founder
              </p>
              <p className="text-[11px] uppercase tracking-widest text-white/55 mt-0.5">
                Dr Tea · Jorhat, Assam
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Form ──────────────────────────────────────────────────── */}
      <section id="form" className="bg-white py-16 sm:py-24 border-t border-black/5">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
              Reach the founder directly
            </p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl leading-tight">
              One short note. A real human reply.
            </h2>
            <p className="mt-3 text-[#1a2416]/65 max-w-xl mx-auto">
              Every message lands in the founder's inbox. Expect a reply within 48 hours,
              usually the same day.
            </p>
          </div>

          {done ? (
            <div className="mt-10 bg-[#FAF8F4] rounded-2xl p-8 text-center ring-1 ring-[#3a5a2c]/15">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#3a5a2c] text-white flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-2xl mb-2">Thank you. We've got it.</h3>
              <p className="text-sm text-[#1a2416]/70 max-w-md mx-auto">
                The note is now sitting in the founder's inbox. You'll hear back within 48
                hours. In the meantime, the kettle is on.
              </p>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 mt-6 text-[11px] uppercase tracking-[0.22em] font-bold text-[#3a5a2c] hover:text-[#1a2416]"
              >
                Browse the shop <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="mt-10 bg-[#FAF8F4] rounded-2xl p-6 sm:p-8 space-y-5 ring-1 ring-black/5"
            >
              {/* Kind selector */}
              <div>
                <label className="block text-[11px] uppercase tracking-[0.22em] font-bold text-[#1a2416]/70 mb-2">
                  I'm reaching out as a…
                </label>
                <div
                  role="radiogroup"
                  aria-label="I am reaching out as"
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  {(
                    [
                      { id: "kickstarter", label: "Backer" },
                      { id: "investor", label: "Investor" },
                      { id: "partner", label: "Partner" },
                      { id: "other", label: "Other" },
                    ] as const
                  ).map((o) => {
                    const active = kind === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-pressed={active}
                        onClick={() => setKind(o.id)}
                        className={`px-3 py-2 rounded-md text-xs uppercase tracking-wider font-semibold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-1 ${
                          active
                            ? "bg-[#1a2416] text-white border-[#1a2416]"
                            : "bg-white text-[#1a2416] border-black/10 hover:border-black/30"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Your name" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Anjali Kapoor"
                    className="form-input"
                    maxLength={120}
                    required
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@email.com"
                    className="form-input"
                    maxLength={160}
                    required
                  />
                </Field>
                <Field label="Organisation (optional)">
                  <input
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="Fund / brand / collective"
                    className="form-input"
                    maxLength={160}
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91…"
                    className="form-input"
                    maxLength={20}
                  />
                </Field>
                <Field label="City (optional)">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru, Mumbai, …"
                    className="form-input"
                    maxLength={80}
                  />
                </Field>
                {kind === "investor" && (
                  <Field label="Ticket size (rough)">
                    <select
                      value={ticket}
                      onChange={(e) => setTicket(e.target.value as Ticket)}
                      className="form-input"
                    >
                      <option value="not_applicable">Prefer not to say</option>
                      <option value="under_1L">Under ₹1 L</option>
                      <option value="1L_5L">₹1 L – ₹5 L</option>
                      <option value="5L_25L">₹5 L – ₹25 L</option>
                      <option value="25L_1Cr">₹25 L – ₹1 Cr</option>
                      <option value="1Cr_plus">₹1 Cr+</option>
                    </select>
                  </Field>
                )}
              </div>

              <Field label="A short note">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="What drew you in? What would make this a great conversation?"
                  className="form-input"
                  maxLength={1500}
                />
              </Field>

              {/* Honeypot — off-screen, not display:none, so spam bots that
                  skip hidden fields still fill it in. Real users never see
                  or tab into it (tabIndex=-1, aria-hidden). */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  top: "auto",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                }}
              >
                <label>
                  Your website (leave blank)
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    type="text"
                    name="website"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-[#1a2416]/50 max-w-xs leading-snug">
                  We never share your details. Reply usually within 48 hours.
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 bg-[#1a2416] hover:bg-[#2c3826] text-white text-[11px] uppercase tracking-[0.22em] font-bold px-5 py-3 rounded-md disabled:opacity-60 disabled:cursor-wait transition"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      Send to founder <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Direct channels */}
          <div className="mt-10 grid sm:grid-cols-3 gap-3 text-sm">
            <Channel icon={Mail} label="founder@drtea.in" href="mailto:founder@drtea.in" />
            <Channel icon={Phone} label="+91-8929-8929-22" href="tel:+918929892922" />
            <Channel icon={MapPin} label="Jorhat, Assam · India" />
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F4] py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#3a5a2c]">
            Quick answers
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl leading-tight mb-8">
            Things you might be wondering.
          </h2>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <details
                key={i}
                className="group bg-white rounded-xl ring-1 ring-black/5 overflow-hidden"
              >
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-[#1a2416] font-semibold">
                  <span className="text-sm sm:text-base pr-4">{f.q}</span>
                  <span className="text-xs uppercase tracking-widest text-[#3a5a2c] group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <div className="px-5 pb-5 -mt-1 text-sm text-[#1a2416]/70 leading-relaxed">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing strip ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#1a2416] to-[#3a5a2c] text-white py-14">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <Heart className="w-8 h-8 text-amber-200 mx-auto mb-3" />
          <p className="font-serif text-2xl sm:text-3xl leading-snug">
            A great cup, served well, is its own kind of revolution.
          </p>
          <p className="mt-3 text-white/65 text-sm">
            Thank you for considering joining us at the start.
          </p>
          <a
            href="#form"
            className="inline-flex items-center gap-2 mt-6 bg-amber-300 text-[#1a2416] text-[11px] uppercase tracking-[0.22em] font-bold px-5 py-3 rounded-md hover:bg-amber-200 transition"
          >
            Write to the founder <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <style>{`
        .form-input {
          width: 100%;
          background: white;
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 0.5rem;
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
          color: #1a2416;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus {
          border-color: #3a5a2c;
          box-shadow: 0 0 0 3px rgba(58,90,44,0.12);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.22em] font-bold text-[#1a2416]/70 mb-1.5">
        {label}
        {required && <span className="text-[#3a5a2c]"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Channel({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Mail;
  label: string;
  href?: string;
}) {
  const inner = (
    <>
      <Icon className="w-4 h-4 text-[#3a5a2c]" />
      <span className="text-[#1a2416]/75">{label}</span>
    </>
  );
  const base =
    "flex items-center gap-3 bg-white rounded-lg px-4 py-3 ring-1 ring-black/5";
  return href ? (
    <a href={href} className={`${base} hover:ring-[#3a5a2c]/30 transition`}>
      {inner}
    </a>
  ) : (
    <div className={base}>{inner}</div>
  );
}
