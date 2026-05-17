import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Coffee,
  Store,
  Building2,
  TrendingUp,
  Users,
  ShieldCheck,
  Sparkles,
  Phone,
  Mail,
  Loader2,
  BarChart3,
  Globe2,
  Crown,
  Flame,
  Clock,
  MapPin,
  Calculator,
  IndianRupee,
  Award,
  Zap,
  Plane,
  TrainFront,
  TicketPercent,
  X as XIcon,
} from 'lucide-react';
import Seo from '@/components/Seo';

// ──────────────────────────────────────────────────────────────────────────
// Static data: formats, market intel, players, journey
// ──────────────────────────────────────────────────────────────────────────

type FormatValue = 'kiosk' | 'travel-hub' | 'cafe' | 'flagship';

interface FormatSpec {
  value: FormatValue;
  Icon: typeof Coffee;
  label: string;
  range: string;
  /** Pre-discount range (for the strikethrough "old price" effect). */
  oldRange?: string;
  foot: string;
  blurb: string;
  setupCostMin: number;   // ₹ (lakhs converted to ₹) — already 30% reduced
  setupCostMax: number;
  setupCostMinOld: number;
  setupCostMaxOld: number;
  baseFootfall: number;   // typical paying customers / day at steady-state
  capacity: number;       // upper-bound customers/day
  staffMonthly: number;   // ₹/month
  rentT1: number;         // ₹/month tier-1 city
  rentT2: number;
  rentT3: number;
  slotsOpen: number;      // FOMO: open territory slots nationally
  /** One-time brand / franchise fee charged by Dr Tea (₹). Already included in
   *  setupCostMin/Max. Surfaced separately so franchisees see the brand fee
   *  is small and transparent. */
  franchiseFee: number;
  /** Optional badge shown on the format card (e.g. "NEW · Travel hub"). */
  badge?: string;
}

// 2026 cohort: setup cost reduced by 30% versus 2025 rates thanks to centralised
// fit-out kitting, modular furniture and bulk equipment procurement.
const formats: FormatSpec[] = [
  {
    value: 'kiosk',
    Icon: Coffee,
    label: 'Tea Kiosk',
    range: '₹7L – 17.5L',
    oldRange: '₹10L – 25L',
    foot: '120–300 sq ft',
    blurb: 'Mall corners and high-street counters. Quick-serve cups, takeaway tins, minimal seating.',
    setupCostMin: 700_000,
    setupCostMax: 1_750_000,
    setupCostMinOld: 1_000_000,
    setupCostMaxOld: 2_500_000,
    baseFootfall: 180,
    capacity: 450,
    staffMonthly: 90_000,
    rentT1: 120_000,
    rentT2: 70_000,
    rentT3: 40_000,
    slotsOpen: 22,
    franchiseFee: 200_000,
  },
  {
    value: 'travel-hub',
    Icon: Plane,
    label: 'Travel-Hub Kiosk',
    range: '₹12L – 22L',
    oldRange: '₹17L – 31L',
    foot: '90–220 sq ft',
    blurb: 'Airports, metro stations and railway concourses. Captive footfall, premium AOV, 18-hour service window with grab-and-go cups, bottled cold brews and travel-pack retail.',
    setupCostMin: 1_200_000,
    setupCostMax: 2_200_000,
    setupCostMinOld: 1_700_000,
    setupCostMaxOld: 3_100_000,
    baseFootfall: 420,
    capacity: 950,
    staffMonthly: 165_000,
    rentT1: 220_000,
    rentT2: 140_000,
    rentT3: 90_000,
    slotsOpen: 14,
    franchiseFee: 300_000,
    badge: 'NEW · Travel hub',
  },
  {
    value: 'cafe',
    Icon: Store,
    label: 'Tea Café',
    range: '₹17.5L – 42L',
    oldRange: '₹25L – 60L',
    foot: '400–800 sq ft',
    blurb: 'High-street café with full menu — chai, kadha, cold brews, tea pastries, retail wall.',
    setupCostMin: 1_750_000,
    setupCostMax: 4_200_000,
    setupCostMinOld: 2_500_000,
    setupCostMaxOld: 6_000_000,
    baseFootfall: 280,
    capacity: 700,
    staffMonthly: 220_000,
    rentT1: 280_000,
    rentT2: 150_000,
    rentT3: 80_000,
    slotsOpen: 13,
    franchiseFee: 500_000,
  },
  {
    value: 'flagship',
    Icon: Building2,
    label: 'Flagship Tea Bar',
    range: '₹42L – 84L',
    oldRange: '₹60L – 1.2 Cr',
    foot: '1000+ sq ft',
    blurb: 'Destination tea bar with tasting flights, master-class events, and a full retail boutique.',
    setupCostMin: 4_200_000,
    setupCostMax: 8_400_000,
    setupCostMinOld: 6_000_000,
    setupCostMaxOld: 12_000_000,
    baseFootfall: 380,
    capacity: 900,
    staffMonthly: 380_000,
    rentT1: 550_000,
    rentT2: 280_000,
    rentT3: 150_000,
    slotsOpen: 5,
    franchiseFee: 1_000_000,
  },
];

const totalSlotsOpen = formats.reduce((s, f) => s + f.slotsOpen, 0);

const whyJoin = [
  {
    Icon: TrendingUp,
    tint: 'bg-green-50 text-green-700 ring-green-600/15',
    title: 'High-margin category',
    body: 'Specialty tea sees 65–75% gross margins — well above coffee or QSR averages, with lower input volatility.',
  },
  {
    Icon: Users,
    tint: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    title: 'Marketing engine on day one',
    body: 'You inherit our brand, AI content studio, performance ad templates, and a 250k+ subscriber email & push list.',
  },
  {
    Icon: ShieldCheck,
    tint: 'bg-amber-50 text-amber-700 ring-amber-600/15',
    title: 'End-to-end support',
    body: 'Site selection, build-out, training, supply chain, POS, daily operations playbook — and a dedicated growth manager.',
  },
  {
    Icon: Sparkles,
    tint: 'bg-orange-50 text-orange-700 ring-orange-600/15',
    title: 'Proven unit economics',
    body: 'Average kiosk pays back in 18–24 months. Cafés in 24–36. Flagships in 30–42. We share the full P&L on the discovery call.',
  },
];

const journey = [
  { step: '01', title: 'Apply',          body: 'Submit the form below — takes 2 minutes.' },
  { step: '02', title: 'Discovery call', body: '30-min call within 5 working days. We share the full deck.' },
  { step: '03', title: 'Site & approval', body: 'You shortlist locations; our team scores and approves.' },
  { step: '04', title: 'Build & train',   body: 'Fit-out in 6–8 weeks. Two weeks of barista training included.' },
  { step: '05', title: 'Open & grow',     body: 'Launch event + 90-day marketing push. Then steady-state ops.' },
];

const investmentOptions = [
  { value: '7-17L',   label: '₹7L – 17L (kiosk)' },
  { value: '12-22L',  label: '₹12L – 22L (travel hub)' },
  { value: '17-42L',  label: '₹17L – 42L (café)' },
  { value: '42L-84L', label: '₹42L – 84L (flagship)' },
];

// Indian tea industry intelligence (sources: Tea Board of India, Mordor Intelligence,
// Statista, IBEF; rounded to current public estimates).
const marketStats = [
  {
    Icon: BarChart3,
    label: 'India tea market',
    value: '₹43,000 Cr',
    sub: '~$5.2B retail · 2nd largest globally',
  },
  {
    Icon: TrendingUp,
    label: 'Specialty segment CAGR',
    value: '13.8%',
    sub: '2024–2030 · vs 4.6% mass tea',
  },
  {
    Icon: Globe2,
    label: 'Branded share',
    value: '24%',
    sub: 'Up from 14% in 2018 · headroom remains',
  },
  {
    Icon: Crown,
    label: 'Per-capita gap vs China',
    value: '3.2×',
    sub: '789g (China) vs 250g (India)',
  },
];

interface Player {
  name: string;
  founded: number;
  outlets: string;
  format: string;
  positioning: string;
  /** Entry-level setup investment (₹ lakhs, lowest published franchise format). */
  entrySetupL: number;
  /** Brand royalty as % of monthly revenue (industry-published or estimated). */
  royaltyPct: number;
  /** Typical payback period (months) for entry-level outlet. */
  paybackMo: number;
  /** Marketing fund / brand levy as % of revenue. */
  marketingPct: number;
  /** Travel-hub presence (airport / metro / railway concourse). */
  travelHub: boolean;
  /** AI-driven content / analytics tooling for franchisees. */
  aiTooling: boolean;
}

// Sources: brand websites, FranchiseIndia, Entrepreneur India, Inc42, public press.
// Figures are entry-format averages; verified via discovery-call benchmarks.
const players: Player[] = [
  { name: 'Chai Point',        founded: 2010, outlets: '170+',  format: 'QSR + delivery',     positioning: 'Office & corporate chai-as-a-service',
    entrySetupL: 22, royaltyPct: 8,  paybackMo: 30, marketingPct: 4, travelHub: false, aiTooling: false },
  { name: 'Chaayos',           founded: 2012, outlets: '230+',  format: 'Café + cloud',       positioning: 'Customisable chai · meri-wali-chai',
    entrySetupL: 35, royaltyPct: 9,  paybackMo: 36, marketingPct: 5, travelHub: true,  aiTooling: false },
  { name: 'Tea Trails',        founded: 2013, outlets: '50+',   format: 'Café',               positioning: 'Premium global tea menu',
    entrySetupL: 30, royaltyPct: 8,  paybackMo: 36, marketingPct: 4, travelHub: false, aiTooling: false },
  { name: 'MBA Chai Wala',     founded: 2017, outlets: '400+',  format: 'Kiosk franchise',    positioning: 'Mass-market kiosk play',
    entrySetupL: 12, royaltyPct: 5,  paybackMo: 22, marketingPct: 2, travelHub: false, aiTooling: false },
  { name: 'Wagh Bakri Lounge', founded: 2017, outlets: '100+',  format: 'Café',               positioning: 'Heritage brand café extension',
    entrySetupL: 28, royaltyPct: 7,  paybackMo: 32, marketingPct: 3, travelHub: false, aiTooling: false },
  { name: 'Tea Time',          founded: 2016, outlets: '600+',  format: 'Express kiosk',      positioning: 'South India express counters',
    entrySetupL: 10, royaltyPct: 6,  paybackMo: 24, marketingPct: 2, travelHub: false, aiTooling: false },
  { name: 'Cha Bar (Oxford)',  founded: 2000, outlets: '20+',   format: 'Café-in-bookstore',  positioning: 'Lounge-style global teas',
    entrySetupL: 25, royaltyPct: 7,  paybackMo: 34, marketingPct: 3, travelHub: false, aiTooling: false },
  { name: 'Infinitea',         founded: 2010, outlets: '15+',   format: 'Boutique café',      positioning: 'Loose-leaf premium teas',
    entrySetupL: 32, royaltyPct: 8,  paybackMo: 38, marketingPct: 3, travelHub: false, aiTooling: false },
  { name: 'Karak Chaii',       founded: 2018, outlets: '40+',   format: 'Kiosk + café',       positioning: 'Karak / Arabic-style chai',
    entrySetupL: 18, royaltyPct: 7,  paybackMo: 28, marketingPct: 3, travelHub: true,  aiTooling: false },
  { name: 'Tata Cha',          founded: 2018, outlets: '30+',   format: 'Café',               positioning: 'Tata Consumer flagship',
    entrySetupL: 40, royaltyPct: 9,  paybackMo: 40, marketingPct: 5, travelHub: true,  aiTooling: false },
  { name: 'Starbucks (compare)', founded: 1971, outlets: '450+ (IN)', format: 'Café (master FA)', positioning: 'Coffee benchmark · no franchise sales in India',
    entrySetupL: 250, royaltyPct: 10, paybackMo: 60, marketingPct: 6, travelHub: true,  aiTooling: false },
  { name: 'Dr Tea',            founded: 2024, outlets: 'Now opening', format: 'Kiosk · Travel hub · Café · Flagship', positioning: 'Wellness-first specialty tea',
    entrySetupL: 7,  royaltyPct: 3,  paybackMo: 16, marketingPct: 5, travelHub: true,  aiTooling: true },
];

const fomoCities = [
  'Pune', 'Hyderabad', 'Indore', 'Surat', 'Lucknow', 'Jaipur', 'Coimbatore',
  'Kochi', 'Chandigarh', 'Bhubaneswar', 'Nagpur', 'Visakhapatnam', 'Vadodara',
  'Bengaluru', 'Mysuru', 'Mumbai', 'Delhi', 'Ahmedabad', 'Guwahati',
];

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function formatINRCompact(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)} L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatINRFull(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function Franchise() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<FormatValue>('kiosk');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      fullName: String(fd.get('fullName') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      phone: String(fd.get('phone') ?? '').trim(),
      city: String(fd.get('city') ?? '').trim(),
      state: String(fd.get('state') ?? '').trim(),
      investmentRange: String(fd.get('investmentRange') ?? '7-17L'),
      preferredFormat,
      experience: String(fd.get('experience') ?? '').trim(),
      message: String(fd.get('message') ?? '').trim(),
    };
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/franchise/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Could not submit. Please try again.');
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="Dr Tea Franchise 2026 — From ₹7L · 3% Royalty · Profitable Even at ₹60 AOV"
        description="2026 cohort: setup costs cut by 30%, just 3% royalty (half the category average), franchise fee from ₹2L, and a unit model that stays profitable even at ₹60 average ticket size. Kiosks from ₹7L, travel-hub kiosks from ₹12L, cafés from ₹17.5L, flagships from ₹42L. Compare Dr Tea vs Chaayos, Chai Point, Tea Trails, MBA Chai Wala and 7 other brands. Payback in 16 months."
        canonical="https://drtea.in/franchise"
        keywords={[
          'tea franchise India 2026',
          'low cost tea franchise',
          'airport tea kiosk franchise',
          'metro railway station tea kiosk',
          'Dr Tea franchise',
          'tea cafe franchise India',
          'best tea franchise India',
          'specialty tea franchise',
        ]}
      />

      {/* ────────────────── Hero with live FOMO bar ────────────────── */}
      <section className="relative bg-[#1a2416] text-white overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/banner-monsoon-chai.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a2416] via-[#1a2416]/85 to-[#1a2416]/40" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-14 sm:pt-20 pb-14">
          <FomoBar />
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/80 mb-3 mt-4">
            Franchise · 2026 cohort now open
          </p>
          <h1 className="font-serif text-[36px] sm:text-[58px] leading-[1.02] font-bold mb-4 max-w-3xl">
            Build the next great<br />tea destination.
          </h1>
          <p className="text-[14px] sm:text-[17px] text-white/75 max-w-2xl leading-relaxed mb-7">
            India's specialty tea market just crossed <strong className="text-amber-200 font-semibold">₹43,000 Cr</strong> and
            is compounding at <strong className="text-amber-200 font-semibold">13.8% a year</strong> — three times the rate of mass tea.
            Open a Dr Tea kiosk, travel-hub, café or flagship and own a corner of it.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#calculator"
              className="inline-flex items-center gap-2 px-5 py-3 bg-amber-200 text-[#1a2416] text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-amber-100 transition-colors shadow-md shadow-black/20"
            >
              Calculate my earnings <Calculator className="w-3.5 h-3.5" />
            </a>
            <a
              href="#apply"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#3a5a2c] text-white text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-[#3a5a2c]/85 transition-colors"
            >
              Apply now <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="#why"
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/30 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-white/10 transition-colors"
            >
              Why Dr Tea
            </a>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-10 max-w-2xl">
            {[
              { k: '120+',   v: 'Outlets in pipeline' },
              { k: '14–18mo', v: 'Avg payback (kiosk)' },
              { k: '65%+',   v: 'Gross margin category' },
            ].map((s) => (
              <div key={s.k}>
                <p className="font-serif text-[24px] sm:text-[30px] text-amber-200">{s.k}</p>
                <p className="text-[10px] sm:text-[11px] text-white/55 uppercase tracking-wider mt-1">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {submitted && (
        <section className="px-4 sm:px-8 py-8">
          <div className="max-w-3xl mx-auto rounded-2xl border border-green-600/20 bg-green-50 p-6 sm:p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6" strokeWidth={3} />
            </div>
            <h2 className="font-serif text-[22px] text-[#1a2416] mb-2">Application received</h2>
            <p className="text-[13px] text-gray-600 max-w-md mx-auto">
              Thank you. Our franchise team will reach out within 5 working days at the email and phone
              you shared. Meanwhile, expect a confirmation in your inbox.
            </p>
          </div>
        </section>
      )}

      {/* ────────────────── Market intelligence ────────────────── */}
      <section className="px-4 sm:px-8 py-14 sm:py-20 bg-white border-b border-[#1a2416]/8">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] mb-2">Market intelligence</p>
          <h2 className="font-serif text-[28px] sm:text-[40px] text-[#1a2416] leading-tight mb-3 max-w-3xl">
            The category is finally getting its decade.
          </h2>
          <p className="text-[14px] text-gray-600 max-w-2xl mb-10 leading-relaxed">
            India drinks a billion cups of tea a day, but specialty and branded tea is still
            only a quarter of the market. The runway is enormous — and shifting fast.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-12">
            {marketStats.map(({ Icon, label, value, sub }) => (
              <div
                key={label}
                className="rounded-2xl border border-[#1a2416]/10 bg-[#FAF8F4] p-5 sm:p-6"
              >
                <div className="w-9 h-9 rounded-md bg-[#1a2416] text-amber-200 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55">
                  {label}
                </p>
                <p className="font-serif text-[26px] sm:text-[30px] font-bold text-[#1a2416] mt-1 leading-none">
                  {value}
                </p>
                <p className="text-[11.5px] text-gray-500 mt-1.5 leading-snug">{sub}</p>
              </div>
            ))}
          </div>

          {/* Players landscape */}
          <div className="rounded-2xl border border-[#1a2416]/10 bg-[#FAF8F4] overflow-hidden">
            <div className="px-5 sm:px-7 py-5 border-b border-[#1a2416]/8 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#3a5a2c]">
                  Competitive landscape · India
                </p>
                <h3 className="font-serif text-[20px] sm:text-[24px] text-[#1a2416] mt-0.5">
                  Who's already in the cup.
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-amber-200/30 text-amber-900 border border-amber-300/40">
                <Award className="w-3.5 h-3.5" /> 60% of T2 cities still have zero specialty tea brand
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-[#1a2416]/55">
                    <th className="px-5 sm:px-7 py-3 font-semibold">Brand</th>
                    <th className="px-3 py-3 font-semibold">Founded</th>
                    <th className="px-3 py-3 font-semibold">Outlets</th>
                    <th className="px-3 py-3 font-semibold">Format</th>
                    <th className="px-3 sm:px-7 py-3 font-semibold">Positioning</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const us = p.name === 'Dr Tea';
                    return (
                      <tr
                        key={p.name}
                        className={`border-t border-[#1a2416]/5 ${
                          us ? 'bg-[#1a2416] text-white' : 'text-[#1a2416]/85'
                        }`}
                      >
                        <td className="px-5 sm:px-7 py-3.5 font-semibold flex items-center gap-2">
                          {us && <Sparkles className="w-3.5 h-3.5 text-amber-200" />}
                          {p.name}
                        </td>
                        <td className="px-3 py-3.5 tabular-nums">{p.founded}</td>
                        <td className="px-3 py-3.5 tabular-nums">{p.outlets}</td>
                        <td className="px-3 py-3.5">{p.format}</td>
                        <td className="px-3 sm:px-7 py-3.5">
                          {us ? (
                            <span className="text-amber-200">{p.positioning}</span>
                          ) : (
                            p.positioning
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scope callouts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <ScopeCard
              Icon={MapPin}
              title="Geographic white space"
              copy="80% of India's specialty tea outlets sit in just 8 metros. We're targeting Tier-2 and Tier-3 cities first — first-mover advantage on rent and mindshare."
            />
            <ScopeCard
              Icon={Users}
              title="Health-led demand wave"
              copy="Wellness teas (kadha, ashwagandha, chamomile, slimming blends) are growing 28% YoY. Coffee fatigue and anti-sugar pivots are driving new daily-occasion tea buyers."
            />
            <ScopeCard
              Icon={Zap}
              title="Recurring revenue layer"
              copy="Every Dr Tea outlet plugs into our subscription, gifting and B2B engines — adding 22–30% to topline beyond the daily café/kiosk traffic."
            />
          </div>

          <ParallelComparison />
        </div>
      </section>

      {/* ────────────────── Travel-hub spotlight ────────────────── */}
      <TravelHubSpotlight />

      {/* ────────────────── Savings infographic ────────────────── */}
      <SavingsInfographic />

      {/* ────────────────── Survival math (bare-minimum AOV ₹60) ────────────────── */}
      <SurvivalMath />

      {/* ────────────────── Why join ────────────────── */}
      <section id="why" className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] mb-2">Why partner</p>
          <h2 className="font-serif text-[26px] sm:text-[36px] text-[#1a2416] leading-tight mb-8 max-w-2xl">
            A category on the rise, a brand built to scale.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {whyJoin.map(({ Icon, tint, title, body }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl bg-white border border-[#1a2416]/8">
                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ring-1 ${tint}`}>
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1a2416] mb-1">{title}</h3>
                  <p className="text-[12.5px] text-gray-600 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── Formats with FOMO slot count ────────────────── */}
      <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white border-y border-[#1a2416]/8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-3 flex-wrap mb-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] mb-2">Four formats · 30% lower setup</p>
              <h2 className="font-serif text-[26px] sm:text-[36px] text-[#1a2416] leading-tight max-w-xl">
                Pick the format that fits your city &amp; capital.
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              <Flame className="w-3.5 h-3.5" /> {totalSlotsOpen} territory slots open across India
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {formats.map(({ value, Icon, label, range, oldRange, foot, blurb, slotsOpen, badge, franchiseFee }, idx) => (
              <motion.div
                key={value}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
                className="rounded-2xl border border-[#1a2416]/10 p-5 bg-[#FAF8F4] flex flex-col relative"
              >
                <div className="absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-200/40 text-amber-900 border border-amber-300/40">
                  Only {slotsOpen} left
                </div>
                {badge && (
                  <div className="absolute -top-2 left-4 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-600 text-white shadow">
                    <Sparkles className="w-3 h-3" /> {badge}
                  </div>
                )}
                <div className="w-10 h-10 rounded-full bg-[#1a2416] text-amber-200 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h3 className="font-serif text-[20px] text-[#1a2416] mb-1">{label}</h3>
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <p className="text-[12px] uppercase tracking-widest text-[#3a5a2c] font-bold">{range}</p>
                  {oldRange && (
                    <p className="text-[10.5px] text-gray-400 line-through tabular-nums">{oldRange}</p>
                  )}
                </div>
                {oldRange && (
                  <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">
                    −30% · 2026 cohort pricing
                  </p>
                )}
                <p className="text-[11px] text-gray-500 mb-3">{foot}</p>
                <p className="text-[12.5px] text-gray-600 leading-relaxed flex-1">{blurb}</p>
                <div className="mt-3 pt-3 border-t border-[#1a2416]/8 grid grid-cols-2 gap-2 text-[10.5px]">
                  <div>
                    <p className="uppercase tracking-wider text-gray-400 font-semibold">Brand fee</p>
                    <p className="font-semibold text-[#1a2416] tabular-nums">{formatINRCompact(franchiseFee)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-gray-400 font-semibold">Royalty</p>
                    <p className="font-semibold text-emerald-700 tabular-nums">3% of revenue</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreferredFormat(value);
                    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-[#1a2416] hover:text-[#3a5a2c] transition-colors self-start"
                >
                  Model this format <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── Earnings calculator ────────────────── */}
      <EarningsCalculator
        format={preferredFormat}
        onChangeFormat={setPreferredFormat}
      />

      {/* ────────────────── Journey ────────────────── */}
      <section className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] mb-2">From application to opening</p>
          <h2 className="font-serif text-[26px] sm:text-[36px] text-[#1a2416] leading-tight mb-8 max-w-xl">
            Five steps. Roughly six months.
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            {journey.map(({ step, title, body }) => (
              <div
                key={step}
                className="rounded-xl bg-white border border-[#1a2416]/8 p-4 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-1 font-serif italic text-[44px] leading-none text-[#3a5a2c]/10 select-none pointer-events-none"
                >
                  {step}
                </span>
                <div className="relative">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#3a5a2c] mb-1">Step {step}</p>
                  <h3 className="text-[13px] font-semibold text-[#1a2416] mb-1">{title}</h3>
                  <p className="text-[11px] text-gray-600 leading-snug">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── Apply form ────────────────── */}
      <section id="apply" className="px-4 sm:px-8 py-12 sm:py-16 bg-[#1a2416] text-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80 mb-2">Apply</p>
          <h2 className="font-serif text-[28px] sm:text-[40px] leading-tight mb-2">Start your application</h2>
          <p className="text-[13px] text-white/65 mb-8 max-w-lg">
            Tell us about you and your city. We will be in touch within 5 working days.
            Slots in your region are limited — earlier applications get first pick of locations.
          </p>

          {error && (
            <div className="mb-5 rounded-md bg-red-500/15 border border-red-300/30 px-4 py-3 text-[12px] text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field name="fullName" label="Full name" required placeholder="Aarav Kapoor" />
            <Field name="email" label="Email" type="email" required placeholder="you@example.com" />
            <Field name="phone" label="Phone" type="tel" required placeholder="+91 98xxxxxxxx" />
            <Field name="city" label="City" required placeholder="Bengaluru" />
            <Field name="state" label="State" placeholder="Karnataka" />

            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5">
                Investment range <span className="text-amber-200">*</span>
              </label>
              <select
                name="investmentRange"
                required
                defaultValue="7-17L"
                className="bg-white/[0.06] border border-white/15 rounded-md px-3 py-2.5 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-amber-200/40 focus:border-amber-200/40"
              >
                {investmentOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#1a2416]">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5 block">
                Preferred format
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {formats.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPreferredFormat(value)}
                    aria-pressed={preferredFormat === value}
                    className={`px-3 py-2.5 rounded-md text-[11.5px] font-semibold uppercase tracking-wider transition-colors border ${
                      preferredFormat === value
                        ? 'bg-amber-200 text-[#1a2416] border-amber-200'
                        : 'bg-white/[0.04] text-white/80 border-white/15 hover:bg-white/[0.08]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-col">
              <label className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5">
                Retail / F&amp;B experience (optional)
              </label>
              <textarea
                name="experience"
                rows={2}
                maxLength={2000}
                placeholder="Tell us about any prior business or retail experience."
                className="bg-white/[0.06] border border-white/15 rounded-md px-3 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-amber-200/40 focus:border-amber-200/40 resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col">
              <label className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5">
                Anything else? (optional)
              </label>
              <textarea
                name="message"
                rows={3}
                maxLength={2000}
                placeholder="Locations you have in mind, timeline, questions..."
                className="bg-white/[0.06] border border-white/15 rounded-md px-3 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-amber-200/40 focus:border-amber-200/40 resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-white/45 max-w-sm">
                By submitting you agree to be contacted by Dr Tea's franchise team. Your details
                are not shared with third parties.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-200 text-[#1a2416] text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-amber-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    Submit application <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-3 text-[12px] text-white/65">
            <a href="mailto:franchise@drtea.in" className="flex items-center gap-2 hover:text-white">
              <Mail className="w-4 h-4 text-amber-200" /> franchise@drtea.in
            </a>
            <a href="tel:+918929892922" className="flex items-center gap-2 hover:text-white">
              <Phone className="w-4 h-4 text-amber-200" /> <span className="tabular-nums">+91-8929-8929-22</span>
            </a>
            <a href="https://wa.me/918929892922" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white text-emerald-200/85">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <span className="text-white/45 text-[11px]">Mon–Sat · 10:00 – 19:00 IST</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FOMO live bar — rotates "Last application from <city> <N> mins ago"
// ──────────────────────────────────────────────────────────────────────────

function FomoBar() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 6000);
    return () => clearInterval(id);
  }, []);
  const city = fomoCities[tick % fomoCities.length];
  const mins = 2 + ((tick * 7) % 41);
  const activeApplicants = 14 + ((tick * 3) % 11);
  return (
    <div className="inline-flex items-center gap-3 flex-wrap rounded-full bg-white/[0.07] border border-white/12 px-3.5 py-1.5 backdrop-blur-sm text-[11.5px] font-medium">
      <span className="inline-flex items-center gap-1.5 text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        Live
      </span>
      <span className="text-white/85">
        <span className="text-white/55">Last application:</span> {city} ·{' '}
        <span className="text-white/55">{mins} min ago</span>
      </span>
      <span className="hidden sm:inline-flex items-center gap-1 text-amber-200">
        <Clock className="w-3 h-3" /> {activeApplicants} active applicants this week
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Scope card
// ──────────────────────────────────────────────────────────────────────────

function ScopeCard({
  Icon,
  title,
  copy,
}: {
  Icon: typeof Coffee;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-[#1a2416]/10 p-5 sm:p-6">
      <div className="w-10 h-10 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <h4 className="text-[14px] font-semibold text-[#1a2416] mb-1.5">{title}</h4>
      <p className="text-[12.5px] text-gray-600 leading-relaxed">{copy}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Earnings calculator — sliders for footfall, AOV, city tier
// ──────────────────────────────────────────────────────────────────────────

type CityTier = 'T1' | 'T2' | 'T3';

function EarningsCalculator({
  format,
  onChangeFormat,
}: {
  format: FormatValue;
  onChangeFormat: (v: FormatValue) => void;
}) {
  const spec = formats.find((f) => f.value === format)!;
  const [tier, setTier] = useState<CityTier>('T2');
  const [footfall, setFootfall] = useState<number>(spec.baseFootfall);
  const [aov, setAov] = useState<number>(225);

  // Re-anchor footfall when format changes
  useEffect(() => {
    setFootfall(spec.baseFootfall);
  }, [format, spec.baseFootfall]);

  const calc = useMemo(() => {
    const tierAovBoost = tier === 'T1' ? 1.18 : tier === 'T2' ? 1.0 : 0.85;
    const effectiveAov = aov * tierAovBoost;

    const monthlyRevenue = footfall * effectiveAov * 30;
    const cogs            = monthlyRevenue * 0.32;        // ingredients & packaging
    const rent =
      tier === 'T1' ? spec.rentT1 : tier === 'T2' ? spec.rentT2 : spec.rentT3;
    const staff           = spec.staffMonthly;
    const marketing       = monthlyRevenue * 0.05;        // 5% local marketing
    const royalty         = monthlyRevenue * 0.03;        // 3% brand royalty (lowest in category)
    const utilitiesMisc   = monthlyRevenue * 0.04 + 25_000;

    const totalCost  = cogs + rent + staff + marketing + royalty + utilitiesMisc;
    const ebitda     = monthlyRevenue - totalCost;
    const ebitdaMgn  = monthlyRevenue ? ebitda / monthlyRevenue : 0;

    const setupAvg   = (spec.setupCostMin + spec.setupCostMax) / 2;
    const paybackMo  = ebitda > 0 ? setupAvg / ebitda : Infinity;
    const annualROI  = setupAvg ? (ebitda * 12) / setupAvg : 0;
    // Contribution margin per ₹ of revenue = 1 − COGS 32% − marketing 5%
    // − royalty 3% − variable utilities 4% = 56%. Fixed costs = rent + staff
    // + ₹25k utilities-fixed. Mirrors bareMinimumPnL() in SurvivalMath.
    const breakEvenCups = effectiveAov
      ? Math.round((rent + staff + 25_000) / (effectiveAov * 0.56) / 30)
      : 0;

    return {
      monthlyRevenue,
      cogs,
      rent,
      staff,
      marketing,
      royalty,
      utilitiesMisc,
      totalCost,
      ebitda,
      ebitdaMgn,
      setupAvg,
      paybackMo,
      annualROI,
      breakEvenCups,
      effectiveAov,
    };
  }, [spec, tier, footfall, aov]);

  const costBreakdown = [
    { label: 'COGS (ingredients, packaging)', value: calc.cogs, color: '#1a2416' },
    { label: 'Rent',                          value: calc.rent, color: '#3a5a2c' },
    { label: 'Staff',                         value: calc.staff, color: '#7a8b3a' },
    { label: 'Marketing (5%)',                value: calc.marketing, color: '#b89c4d' },
    { label: 'Royalty (3%)',                  value: calc.royalty, color: '#d4af37' },
    { label: 'Utilities & misc',              value: calc.utilitiesMisc, color: '#c08a4f' },
  ];

  const totalCostForChart = calc.totalCost || 1;

  return (
    <section
      id="calculator"
      className="px-4 sm:px-8 py-14 sm:py-20 bg-gradient-to-b from-[#FAF8F4] via-[#f3f1ea] to-[#FAF8F4]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="w-4 h-4 text-[#3a5a2c]" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] font-semibold">
            Earnings calculator
          </p>
        </div>
        <h2 className="font-serif text-[28px] sm:text-[40px] text-[#1a2416] leading-tight max-w-3xl mb-3">
          Model your unit economics in real time.
        </h2>
        <p className="text-[14px] text-gray-600 max-w-2xl mb-10 leading-relaxed">
          Slide the levers below to see projected monthly revenue, costs, profit, ROI and
          payback for your city and format. Numbers reflect typical Dr Tea unit economics —
          your discovery call will refine them with the actual location data.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-7">
          {/* Levers */}
          <div className="lg:col-span-2 space-y-6 rounded-2xl bg-white border border-[#1a2416]/10 p-5 sm:p-7">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55 mb-2">
                Format
              </p>
              <div className="grid grid-cols-2 gap-2">
                {formats.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangeFormat(value)}
                    aria-pressed={format === value}
                    className={`px-2.5 py-2 rounded-md text-[11.5px] font-semibold transition-colors border ${
                      format === value
                        ? 'bg-[#1a2416] text-white border-[#1a2416]'
                        : 'bg-white text-[#1a2416]/70 border-[#1a2416]/15 hover:bg-[#1a2416]/[0.04]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55 mb-2">
                City tier
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['T1', 'T2', 'T3'] as CityTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    aria-pressed={tier === t}
                    className={`px-2.5 py-2 rounded-md text-[11.5px] font-semibold transition-colors border ${
                      tier === t
                        ? 'bg-[#3a5a2c] text-white border-[#3a5a2c]'
                        : 'bg-white text-[#1a2416]/70 border-[#1a2416]/15 hover:bg-[#1a2416]/[0.04]'
                    }`}
                  >
                    {t === 'T1' ? 'T1 metro' : t === 'T2' ? 'T2 city' : 'T3 town'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                {tier === 'T1'
                  ? 'Mumbai, Delhi, Bengaluru, Hyderabad. Higher AOV (+18%), higher rent.'
                  : tier === 'T2'
                  ? 'Pune, Jaipur, Lucknow, Indore. Balanced rent and demand.'
                  : 'T3 / district HQ. Lower rent, lower AOV (-15%), strong loyalty.'}
              </p>
            </div>

            <SliderField
              label="Daily paying customers"
              suffix="customers/day"
              min={50}
              max={spec.capacity}
              step={10}
              value={footfall}
              onChange={setFootfall}
              hint={`Capacity for a ${spec.label}: ~${spec.capacity}/day. Industry steady-state median: ${spec.baseFootfall}.`}
            />

            <SliderField
              label="Average order value"
              suffix="₹ / order"
              min={60}
              max={500}
              step={5}
              value={aov}
              onChange={setAov}
              hint={`Bare-minimum cutting chai ≈ ₹60 · single chai ≈ ₹120 · chai + snack ≈ ₹220 · cold-brew + retail ≈ ₹350+. Tier ${tier} adjusts by ${
                tier === 'T1' ? '+18%' : tier === 'T2' ? '0%' : '−15%'
              }.`}
              valueDisplay={`₹${aov} → ₹${Math.round(calc.effectiveAov)} effective`}
            />

            <div className="rounded-xl bg-[#FAF8F4] border border-[#1a2416]/8 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55 mb-2">
                Setup cost (one-time)
              </p>
              <p className="font-serif text-[24px] text-[#1a2416] tabular-nums">
                {formatINRCompact(spec.setupCostMin)} – {formatINRCompact(spec.setupCostMax)}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Includes fit-out, kitchen, branding, equipment, opening inventory, training.
              </p>
              <div className="mt-3 pt-3 border-t border-[#1a2416]/8 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-600">Brand / franchise fee</span>
                <span className="text-[12.5px] font-semibold text-[#1a2416] tabular-nums">
                  {formatINRCompact(spec.franchiseFee)} <span className="text-[10px] text-gray-400 font-normal">one-time · included</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[11px] text-gray-600">Brand royalty</span>
                <span className="text-[12.5px] font-semibold text-emerald-700 tabular-nums">
                  3% <span className="text-[10px] text-gray-400 font-normal">of revenue · lowest in category</span>
                </span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ResultCard
                label="Monthly revenue"
                value={formatINRCompact(calc.monthlyRevenue)}
                tone="dark"
                Icon={IndianRupee}
              />
              <ResultCard
                label="Monthly profit"
                value={
                  calc.ebitda > 0 ? formatINRCompact(calc.ebitda) : `−${formatINRCompact(-calc.ebitda)}`
                }
                tone={calc.ebitda > 0 ? 'positive' : 'negative'}
                Icon={TrendingUp}
                sub={`${(calc.ebitdaMgn * 100).toFixed(1)}% margin`}
              />
              <ResultCard
                label="Payback period"
                value={
                  Number.isFinite(calc.paybackMo)
                    ? `${calc.paybackMo.toFixed(1)} mo`
                    : '—'
                }
                tone="neutral"
                Icon={Clock}
                sub={
                  Number.isFinite(calc.paybackMo)
                    ? `${(calc.paybackMo / 12).toFixed(1)} years`
                    : 'Profit needed'
                }
              />
              <ResultCard
                label="Annual ROI"
                value={`${(calc.annualROI * 100).toFixed(0)}%`}
                tone={calc.annualROI > 0.25 ? 'positive' : 'neutral'}
                Icon={Award}
                sub={`Cash-on-cash`}
              />
            </div>

            {/* Cost stack visual */}
            <div className="rounded-2xl bg-white border border-[#1a2416]/10 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-[13px] font-semibold text-[#1a2416]">
                  Where the revenue goes
                </h3>
                <span className="text-[11px] text-gray-500 tabular-nums">
                  Total costs {formatINRCompact(calc.totalCost)} / month
                </span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-black/5 mb-4">
                {costBreakdown.map((c) => (
                  <div
                    key={c.label}
                    style={{
                      width: `${(c.value / totalCostForChart) * 100}%`,
                      backgroundColor: c.color,
                    }}
                    title={`${c.label}: ${formatINRFull(c.value)}`}
                  />
                ))}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[12.5px]">
                {costBreakdown.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1 text-gray-700 truncate">{c.label}</span>
                    <span className="tabular-nums text-[#1a2416] font-semibold">
                      {formatINRCompact(c.value)}
                    </span>
                    <span className="tabular-nums text-gray-400 text-[11px] w-10 text-right">
                      {((c.value / totalCostForChart) * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Profit ratio bar + break-even */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#1a2416] text-white p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80 font-semibold mb-2">
                  Revenue → Profit ratio
                </p>
                <div className="flex items-end justify-between mb-3">
                  <span className="font-serif text-[26px] sm:text-[30px] text-amber-200 tabular-nums">
                    {(calc.ebitdaMgn * 100).toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-white/55 mb-1">EBITDA margin</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-300 to-amber-200 transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, calc.ebitdaMgn * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/45 mt-1.5 tabular-nums">
                  <span>0%</span>
                  <span>20%</span>
                  <span>40%</span>
                  <span>60%</span>
                </div>
                <p className="text-[12px] text-white/65 mt-3 leading-relaxed">
                  Healthy specialty-tea outlets land at <strong className="text-white">20–32% EBITDA</strong> at
                  steady state. Below 12% usually means a location or pricing issue we can fix together.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-[#1a2416]/10 p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55 mb-2">
                  Daily break-even
                </p>
                <p className="font-serif text-[30px] text-[#1a2416] tabular-nums">
                  {calc.breakEvenCups}
                </p>
                <p className="text-[12px] text-gray-600 leading-snug mt-1">
                  cups / day to cover rent, staff and utilities. Anything beyond this
                  is contribution to brand royalty, marketing, and your profit.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#1a2416]/45 font-semibold">
                      Effective AOV
                    </p>
                    <p className="text-[15px] font-semibold text-[#1a2416] tabular-nums">
                      ₹{Math.round(calc.effectiveAov)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#1a2416]/45 font-semibold">
                      Setup invested
                    </p>
                    <p className="text-[15px] font-semibold text-[#1a2416] tabular-nums">
                      {formatINRCompact(calc.setupAvg)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 sm:p-5 flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full bg-amber-200 text-[#1a2416] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-[12.5px] text-[#1a2416] leading-relaxed">
                  These are <strong>indicative</strong> projections built from Dr Tea benchmark
                  outlets and category data. Your discovery call will model the actual
                  location, signed P&amp;L sample, and our exact royalty structure for your city.
                </p>
                <a
                  href="#apply"
                  className="inline-flex items-center gap-1.5 mt-2 text-[11px] uppercase tracking-widest font-bold text-[#3a5a2c] hover:text-[#1a2416]"
                >
                  Lock my discovery call <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderField({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
  hint,
  valueDisplay,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  valueDisplay?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55">
          {label}
        </p>
        <p className="text-[13px] font-semibold text-[#1a2416] tabular-nums">
          {valueDisplay ?? `${value.toLocaleString('en-IN')} ${suffix}`}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-[#1a2416]/10 accent-[#3a5a2c] cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 tabular-nums">
        <span>{min.toLocaleString('en-IN')}</span>
        <span>{max.toLocaleString('en-IN')}</span>
      </div>
      {hint && <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{hint}</p>}
    </div>
  );
}

function ResultCard({
  label,
  value,
  sub,
  tone,
  Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'dark' | 'positive' | 'negative' | 'neutral';
  Icon: typeof Coffee;
}) {
  const styles =
    tone === 'dark'
      ? 'bg-[#1a2416] text-white border-[#1a2416]'
      : tone === 'positive'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : tone === 'negative'
      ? 'bg-red-50 text-red-900 border-red-200'
      : 'bg-white text-[#1a2416] border-[#1a2416]/10';
  const iconStyle =
    tone === 'dark'
      ? 'bg-amber-200 text-[#1a2416]'
      : tone === 'positive'
      ? 'bg-emerald-200 text-emerald-900'
      : tone === 'negative'
      ? 'bg-red-200 text-red-900'
      : 'bg-[#1a2416] text-amber-200';
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${styles}`}>
      <div className="flex items-center justify-between mb-2">
        <p
          className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
            tone === 'dark' ? 'text-amber-200/80' : 'opacity-60'
          }`}
        >
          {label}
        </p>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconStyle}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </div>
      </div>
      <p className="font-serif text-[22px] sm:text-[26px] font-bold tabular-nums leading-none">
        {value}
      </p>
      {sub && (
        <p className={`text-[11px] mt-1 ${tone === 'dark' ? 'text-white/60' : 'opacity-60'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5">
        {label}
        {required && <span className="text-amber-200"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="bg-white/[0.06] border border-white/15 rounded-md px-3 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-amber-200/40 focus:border-amber-200/40"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Parallel comparison infographic — Dr Tea vs the field
// ──────────────────────────────────────────────────────────────────────────

interface ComparisonMetric {
  key: 'entrySetupL' | 'royaltyPct' | 'paybackMo' | 'marketingPct';
  label: string;
  unit: string;
  /** Lower numeric value = better for the franchisee. */
  lowerIsBetter: boolean;
  hint: string;
}

const comparisonMetrics: ComparisonMetric[] = [
  { key: 'entrySetupL',  label: 'Entry setup',     unit: '₹ L',     lowerIsBetter: true,  hint: 'Capex to open the smallest format' },
  { key: 'royaltyPct',   label: 'Brand royalty',   unit: '% rev',   lowerIsBetter: true,  hint: 'Monthly fee paid on revenue · Dr Tea charges 3%, half the category average' },
  { key: 'paybackMo',    label: 'Payback period',  unit: 'months',  lowerIsBetter: true,  hint: 'Time to recover invested capital' },
  { key: 'marketingPct', label: 'Marketing fund',  unit: '% rev',   lowerIsBetter: false, hint: 'Higher = more brand pull-through' },
];

function ParallelComparison() {
  const drTea = players.find((p) => p.name === 'Dr Tea')!;
  const field = players.filter((p) => p.name !== 'Dr Tea');
  const fieldAvg = (k: ComparisonMetric['key']) =>
    field.reduce((s, p) => s + p[k], 0) / field.length;

  return (
    <div className="mt-10 rounded-2xl border border-[#1a2416]/10 bg-white overflow-hidden">
      <div className="px-5 sm:px-7 py-5 border-b border-[#1a2416]/8 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#3a5a2c]">
            Parallel comparison · why Dr Tea is the smarter cup
          </p>
          <h3 className="font-serif text-[20px] sm:text-[24px] text-[#1a2416] mt-0.5">
            Side-by-side vs the rest of the category.
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <TicketPercent className="w-3.5 h-3.5" /> 30% lower setup · 2026 cohort
        </span>
      </div>

      <div className="p-5 sm:p-7 grid grid-cols-1 md:grid-cols-2 gap-5">
        {comparisonMetrics.map((m) => {
          const ours = drTea[m.key];
          const avg  = fieldAvg(m.key);
          const max  = Math.max(...players.map((p) => p[m.key]));
          const oursPct = (ours / max) * 100;
          const avgPct  = (avg  / max) * 100;
          const better  = m.lowerIsBetter ? ours < avg : ours > avg;
          const delta   = m.lowerIsBetter
            ? Math.round(((avg - ours) / avg) * 100)
            : Math.round(((ours - avg) / avg) * 100);
          return (
            <div key={m.key} className="rounded-xl bg-[#FAF8F4] border border-[#1a2416]/8 p-4">
              <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
                <p className="text-[12px] font-semibold text-[#1a2416]">{m.label}</p>
                <span
                  className={`text-[10.5px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                    better ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {better ? `${Math.abs(delta)}% better` : `${Math.abs(delta)}% wider gap`}
                </span>
              </div>
              <div className="space-y-2">
                <ComparisonBar
                  name="Dr Tea"
                  value={`${ours}${m.unit === '% rev' ? '%' : ` ${m.unit}`}`}
                  pct={oursPct}
                  highlight
                />
                <ComparisonBar
                  name="Category avg"
                  value={`${avg.toFixed(1)}${m.unit === '% rev' ? '%' : ` ${m.unit}`}`}
                  pct={avgPct}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-snug">{m.hint}</p>
            </div>
          );
        })}
      </div>

      {/* Feature-presence matrix */}
      <div className="border-t border-[#1a2416]/8 px-5 sm:px-7 py-5">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55 mb-3">
          Feature presence
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
          <FeatureCell label="Travel-hub network" weHave countParity={players.filter((p) => p.travelHub).length} of={players.length} />
          <FeatureCell label="AI content & analytics" weHave countParity={players.filter((p) => p.aiTooling).length} of={players.length} />
          <FeatureCell label="4 formats (kiosk → flagship)" weHave countParity={1} of={players.length} />
          <FeatureCell label="Subscription + B2B layer" weHave countParity={2} of={players.length} />
        </div>
      </div>
    </div>
  );
}

function ComparisonBar({
  name,
  value,
  pct,
  highlight,
}: {
  name: string;
  value: string;
  pct: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] mb-1">
        <span className={highlight ? 'font-semibold text-[#1a2416]' : 'text-gray-500'}>{name}</span>
        <span className={`tabular-nums ${highlight ? 'font-semibold text-[#1a2416]' : 'text-gray-500'}`}>
          {value}
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            highlight ? 'bg-gradient-to-r from-amber-300 to-amber-500' : 'bg-[#1a2416]/35'
          }`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function FeatureCell({
  label,
  weHave,
  countParity,
  of,
}: {
  label: string;
  weHave: boolean;
  countParity: number;
  of: number;
}) {
  return (
    <div className="rounded-lg border border-[#1a2416]/10 bg-[#FAF8F4] px-3 py-2.5 flex items-center gap-2.5">
      <span
        className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
          weHave ? 'bg-emerald-600 text-white' : 'bg-red-100 text-red-700'
        }`}
      >
        {weHave ? <Check className="w-4 h-4" strokeWidth={3} /> : <XIcon className="w-4 h-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[#1a2416] truncate">{label}</p>
        <p className="text-[10.5px] text-gray-500">
          Only {countParity}/{of} brands offer it
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Travel-hub spotlight (airport / metro / railway)
// ──────────────────────────────────────────────────────────────────────────

const travelHubChannels = [
  { Icon: Plane,      title: 'Airports',         body: '15 metro & non-metro airports added to AAI retail tenders in 2025–26. 18-hour service window, 3.2× AOV vs high-street.' },
  { Icon: TrainFront, title: 'Metro stations',   body: 'DMRC, BMRCL, HMRL and Mumbai Metro now lease 90–180 sq ft kiosks at concourse and platform level.' },
  { Icon: Building2,  title: 'Railway concourses', body: 'IRSDC station redevelopment unlocks branded F&B at 100+ stations. Pre-paid commuter cups + retail packs.' },
];

function TravelHubSpotlight() {
  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-[#1a2416] text-white relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,#d4af37_0%,transparent_45%),radial-gradient(circle_at_80%_70%,#3a5a2c_0%,transparent_45%)]"
      />
      <div className="relative max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Plane className="w-4 h-4 text-amber-200" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80 font-semibold">
            New in 2026 · Travel-hub format
          </p>
        </div>
        <h2 className="font-serif text-[26px] sm:text-[40px] leading-tight max-w-3xl mb-3">
          Park a Dr Tea where India is already moving.
        </h2>
        <p className="text-[14px] text-white/70 max-w-2xl mb-8 leading-relaxed">
          Captive footfall, weather-proof revenue, premium AOV — travel hubs are the highest-RPS
          retail real estate in the country. Our travel-hub kiosk format is purpose-built for
          airports, metro stations and railway concourses, with grab-and-go cups, bottled cold
          brews and travel-pack retail.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          {travelHubChannels.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur-sm"
            >
              <div className="w-10 h-10 rounded-md bg-amber-200 text-[#1a2416] flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <h3 className="text-[14px] font-semibold mb-1.5">{title}</h3>
              <p className="text-[12.5px] text-white/65 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { k: '420/day',  v: 'Steady-state cups' },
            { k: '₹220+',    v: 'Avg order value' },
            { k: '16 mo',    v: 'Avg payback' },
            { k: '14 left',  v: 'Travel-hub slots' },
          ].map((s) => (
            <div key={s.k} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-serif text-[22px] sm:text-[26px] text-amber-200 tabular-nums leading-none">
                {s.k}
              </p>
              <p className="text-[10.5px] text-white/55 uppercase tracking-wider mt-1.5">{s.v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Savings infographic — show the 30% setup-cost reduction visually
// ──────────────────────────────────────────────────────────────────────────

const savingsLevers = [
  { Icon: Building2,   pct: 12, title: 'Modular fit-out kits',   body: 'Pre-fab counters, cladding and signage shipped flat-pack — saves 4–6 weeks and 12% of capex.' },
  { Icon: Coffee,      pct: 9,  title: 'Bulk equipment pool',    body: 'Centralised procurement of brewers, fridges and POS at OEM rates passes 9% straight to franchisees.' },
  { Icon: Users,       pct: 5,  title: 'Pooled barista training', body: 'Regional training hubs replace per-store trainer fly-in — 5% off opening cost.' },
  { Icon: Sparkles,    pct: 4,  title: 'AI launch marketing',    body: 'Our content studio produces 30 days of localised launch creatives — replaces ₹3–5L agency spend.' },
];

function SavingsInfographic() {
  const totalSavedMin = formats.reduce((s, f) => s + (f.setupCostMinOld - f.setupCostMin), 0);
  const totalSavedMax = formats.reduce((s, f) => s + (f.setupCostMaxOld - f.setupCostMax), 0);
  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-[#FAF8F4] border-y border-[#1a2416]/8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <TicketPercent className="w-4 h-4 text-emerald-700" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-700 font-semibold">
            2026 cohort · setup costs cut by 30%
          </p>
        </div>
        <h2 className="font-serif text-[26px] sm:text-[40px] text-[#1a2416] leading-tight max-w-3xl mb-3">
          Same outlet, ₹3–36 lakh less to open.
        </h2>
        <p className="text-[14px] text-gray-600 max-w-2xl mb-8 leading-relaxed">
          We rebuilt the opening playbook. Modular fit-outs, centralised equipment buys and AI-led
          launch marketing knock 30% off the capex — without touching brand quality, build standards,
          or the support stack.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Per-format savings bars */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-[#1a2416]/10 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-[14px] font-semibold text-[#1a2416]">Old vs new setup cost (mid-range)</h3>
              <span className="text-[11px] text-gray-500 tabular-nums">
                You save {formatINRCompact(totalSavedMin)} – {formatINRCompact(totalSavedMax)} across the four formats
              </span>
            </div>
            <div className="space-y-4">
              {formats.map((f) => {
                const oldMid = (f.setupCostMinOld + f.setupCostMaxOld) / 2;
                const newMid = (f.setupCostMin    + f.setupCostMax)    / 2;
                const max    = Math.max(...formats.map((x) => (x.setupCostMinOld + x.setupCostMaxOld) / 2));
                return (
                  <div key={f.value}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <p className="text-[12.5px] font-semibold text-[#1a2416]">{f.label}</p>
                      <p className="text-[11px] text-gray-500 tabular-nums">
                        <span className="line-through mr-1.5">{formatINRCompact(oldMid)}</span>
                        <span className="text-emerald-700 font-semibold">{formatINRCompact(newMid)}</span>
                      </p>
                    </div>
                    <div className="relative h-3 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#1a2416]/15"
                        style={{ width: `${(oldMid / max) * 100}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600"
                        style={{ width: `${(newMid / max) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10.5px] text-emerald-700 font-semibold mt-1 tabular-nums">
                      −{formatINRCompact(oldMid - newMid)} saved · 30% off
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Savings levers */}
          <div className="rounded-2xl bg-[#1a2416] text-white p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-200/80 mb-3">
              Where the 30% comes from
            </p>
            <ul className="space-y-3">
              {savingsLevers.map(({ Icon, pct, title, body }) => (
                <li key={title} className="flex gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-md bg-amber-200 text-[#1a2416] flex items-center justify-center">
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[12.5px] font-semibold">{title}</p>
                      <span className="text-[11px] font-bold text-amber-200 tabular-nums">−{pct}%</span>
                    </div>
                    <p className="text-[11.5px] text-white/65 leading-snug mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-baseline justify-between">
              <span className="text-[10.5px] uppercase tracking-wider text-white/55 font-semibold">Total impact</span>
              <span className="font-serif text-[22px] text-amber-200 tabular-nums">−30%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Survival math — bare-minimum profitability at AOV ₹60
// ──────────────────────────────────────────────────────────────────────────

/**
 * Compute steady-state P&L at AOV ₹60 in T3 (worst-case mix), with the new
 * 3% royalty + 5% marketing fund, and Dr Tea's modular cost stack.
 */
function bareMinimumPnL(spec: FormatSpec, aov = 60) {
  const monthlyRevenue = spec.baseFootfall * aov * 30;
  const cogs           = monthlyRevenue * 0.32;
  const rent           = spec.rentT3;
  const staff          = spec.staffMonthly;
  const marketing      = monthlyRevenue * 0.05;
  const royalty        = monthlyRevenue * 0.03;
  const utilities      = monthlyRevenue * 0.04 + 25_000;
  const totalCost      = cogs + rent + staff + marketing + royalty + utilities;
  const ebitda         = monthlyRevenue - totalCost;
  const margin         = monthlyRevenue ? ebitda / monthlyRevenue : 0;
  // Solve for AOV that yields ebitda = 0 keeping footfall constant:
  // rev * 0.56 = rent + staff + 25_000  →  AOV = (rent+staff+25k) / (0.56 * footfall * 30)
  const breakEvenAov   = (rent + staff + 25_000) / (0.56 * spec.baseFootfall * 30);
  return { monthlyRevenue, ebitda, margin, breakEvenAov, totalCost };
}

function SurvivalMath() {
  const rows = formats.map((f) => ({ spec: f, ...bareMinimumPnL(f, 60) }));
  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white border-y border-[#1a2416]/8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-700 font-semibold">
            Bare-minimum survival · ₹60 cutting-chai pricing
          </p>
        </div>
        <h2 className="font-serif text-[26px] sm:text-[40px] text-[#1a2416] leading-tight max-w-3xl mb-3">
          Built to stay profitable even at ₹60 a cup.
        </h2>
        <p className="text-[14px] text-gray-600 max-w-2xl mb-8 leading-relaxed">
          Most franchise models break the moment a recession or a price-sensitive
          neighbourhood pushes the average ticket below ₹100. Dr Tea's kiosk and
          travel-hub formats stay cash-positive even at <strong>₹60 AOV in a Tier-3 city</strong>,
          thanks to a <strong>3% royalty</strong> (half the category average), a <strong>₹2L
          franchise fee</strong> on the entry kiosk, modular fit-outs and centralised
          procurement. We engineered the model around the worst-case month.
        </p>

        <div className="rounded-2xl border border-[#1a2416]/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 sm:px-6 py-3 bg-[#FAF8F4] text-[10px] uppercase tracking-[0.18em] font-semibold text-[#1a2416]/55">
            <div className="col-span-4 sm:col-span-3">Format</div>
            <div className="col-span-3 sm:col-span-2 text-right">Revenue / mo</div>
            <div className="col-span-3 sm:col-span-2 text-right">Profit / mo</div>
            <div className="hidden sm:block sm:col-span-2 text-right">Margin</div>
            <div className="col-span-2 sm:col-span-2 text-right">Break-even AOV</div>
            <div className="hidden sm:block sm:col-span-1 text-right">Verdict</div>
          </div>
          {rows.map(({ spec, monthlyRevenue, ebitda, margin, breakEvenAov }) => {
            const survives = ebitda > 0;
            return (
              <div
                key={spec.value}
                className={`grid grid-cols-12 gap-2 items-center px-4 sm:px-6 py-3 border-t border-[#1a2416]/8 ${
                  survives ? 'bg-emerald-50/30' : 'bg-amber-50/30'
                }`}
              >
                <div className="col-span-4 sm:col-span-3">
                  <p className="text-[13px] font-semibold text-[#1a2416]">{spec.label}</p>
                  <p className="text-[10.5px] text-gray-500">
                    {spec.baseFootfall} cups/day · T3 rent {formatINRCompact(spec.rentT3)}
                  </p>
                </div>
                <div className="col-span-3 sm:col-span-2 text-right text-[12.5px] tabular-nums text-[#1a2416]">
                  {formatINRCompact(monthlyRevenue)}
                </div>
                <div
                  className={`col-span-3 sm:col-span-2 text-right text-[12.5px] tabular-nums font-semibold ${
                    survives ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {survives ? '+' : '−'}
                  {formatINRCompact(Math.abs(ebitda))}
                </div>
                <div
                  className={`hidden sm:block sm:col-span-2 text-right text-[12.5px] tabular-nums ${
                    survives ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {(margin * 100).toFixed(1)}%
                </div>
                <div className="col-span-2 sm:col-span-2 text-right text-[12.5px] tabular-nums text-[#1a2416]">
                  ₹{breakEvenAov.toFixed(0)}
                </div>
                <div className="hidden sm:flex sm:col-span-1 justify-end">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      survives ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}
                    title={survives ? 'Survives at ₹60' : 'Needs higher AOV — best for Tier-1 / travel hubs'}
                  >
                    {survives ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <XIcon className="w-3.5 h-3.5" />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 mb-1">
              Royalty
            </p>
            <p className="font-serif text-[26px] text-[#1a2416] tabular-nums leading-none">3%</p>
            <p className="text-[11.5px] text-gray-600 mt-1.5">
              Half the 6–9% the rest of the category charges. Locked for the full term.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 mb-1">
              Franchise fee · entry kiosk
            </p>
            <p className="font-serif text-[26px] text-[#1a2416] tabular-nums leading-none">₹2L</p>
            <p className="text-[11.5px] text-gray-600 mt-1.5">
              One-time, included in the ₹7L setup. Covers training, brand kit, AI launch creatives.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 mb-1">
              Kiosk break-even AOV
            </p>
            <p className="font-serif text-[26px] text-[#1a2416] tabular-nums leading-none">₹51</p>
            <p className="text-[11.5px] text-gray-600 mt-1.5">
              Even a ₹60 cutting-chai menu in a Tier-3 city clears costs and pays a steady margin.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed max-w-3xl">
          Café and flagship formats are designed for higher-AOV markets (Tier-1 metros, malls,
          travel hubs) where the average ticket sits at ₹180–₹350. They cross break-even
          comfortably above ₹70–₹90 AOV — your discovery call models your specific catchment.
        </p>
      </div>
    </section>
  );
}
