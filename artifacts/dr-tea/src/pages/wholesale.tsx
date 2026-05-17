import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Coffee,
  Building,
  Briefcase,
  Gift,
  Store,
  Boxes,
  Truck,
  ShieldCheck,
  Tag,
  Package,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react';
import Seo from '@/components/Seo';

const segments = [
  { value: 'cafe' as const,     Icon: Coffee,    label: 'Cafe / QSR',          blurb: 'Specialty cafes, chai stalls, dessert parlours, cloud kitchens.' },
  { value: 'hotel' as const,    Icon: Building,  label: 'Hotel / Restaurant',  blurb: 'Premium hotels, fine-dine, banquet & spa tea menus.' },
  { value: 'office' as const,   Icon: Briefcase, label: 'Office / Pantry',     blurb: 'Corporate pantry programmes, co-working stations, in-office gifting.' },
  { value: 'gifting' as const,  Icon: Gift,      label: 'Corporate Gifting',   blurb: 'Festival hampers, employee onboarding kits, client appreciation.' },
  { value: 'retailer' as const, Icon: Store,     label: 'Retailer / Boutique', blurb: 'Specialty grocers, gourmet stores, wellness chains, e-comm resellers.' },
  { value: 'other' as const,    Icon: Boxes,     label: 'Other',               blurb: 'Airlines, lounges, events, subscription boxes, private label.' },
];

const tiers = [
  {
    name: 'Starter',
    moq: '25 kg / month',
    discount: 'Up to 18%',
    perks: ['Standard catalogue', 'NDA & specs on request', 'Net-15 after 1st invoice', 'Pan-India dispatch in 5–7 days'],
    accent: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  },
  {
    name: 'Growth',
    moq: '100 kg / month',
    discount: 'Up to 28%',
    perks: ['Co-branded packaging', 'Dedicated account manager', 'Net-30 terms', 'Priority dispatch in 48 hrs', 'Quarterly menu masterclass'],
    accent: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    featured: true,
  },
  {
    name: 'Enterprise',
    moq: '500 kg / month',
    discount: 'Custom pricing',
    perks: ['Bespoke blends & private label', 'Single-estate sourcing on demand', 'Dedicated supply contract', 'Spot-priced commodity hedging', 'On-site training & audits'],
    accent: 'bg-[#1a2416]/5 text-[#1a2416] ring-[#1a2416]/15',
  },
];

const pillars = [
  {
    Icon: Tag,
    title: 'Volume pricing',
    body: 'Tiered slabs from 25 kg to 5 tonnes/month. Lock in 6- or 12-month rate cards.',
  },
  {
    Icon: Package,
    title: 'Private label',
    body: 'Your brand on bulk pouches, sachets, or retail tins. MOQ from 100 kg per SKU.',
  },
  {
    Icon: Truck,
    title: 'Reliable supply',
    body: 'Direct from our Assam warehouse. Same-week dispatch on standard SKUs.',
  },
  {
    Icon: ShieldCheck,
    title: 'Quality you can audit',
    body: 'FSSAI, ISO 22000, and Rainforest Alliance options. Lab reports on every lot.',
  },
];

const interestOptions = [
  'Single-estate Darjeeling',
  'Assam CTC & blends',
  'Royal Masala Chai',
  'Kadha & wellness blends',
  'Green & white teas',
  'Floral tisanes',
  'Cold-brew sachets',
  'Private label',
];

type SegmentValue = (typeof segments)[number]['value'];
type VolumeValue = 'under-25kg' | '25-100kg' | '100-500kg' | '500kg-plus';

const volumeOptions: { value: VolumeValue; label: string }[] = [
  { value: 'under-25kg', label: 'Under 25 kg / month' },
  { value: '25-100kg', label: '25 – 100 kg / month' },
  { value: '100-500kg', label: '100 – 500 kg / month' },
  { value: '500kg-plus', label: '500 kg+ / month' },
];

export default function Wholesale() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<SegmentValue>('cafe');
  const [interested, setInterested] = useState<string[]>([]);

  function toggleInterest(label: string) {
    setInterested((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label],
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      companyName: String(fd.get('companyName') ?? '').trim(),
      contactName: String(fd.get('contactName') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      phone: String(fd.get('phone') ?? '').trim(),
      city: String(fd.get('city') ?? '').trim(),
      state: String(fd.get('state') ?? '').trim(),
      segment,
      monthlyVolume: String(fd.get('monthlyVolume') ?? 'under-25kg') as VolumeValue,
      interestedIn: interested,
      message: String(fd.get('message') ?? '').trim(),
    };
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/wholesale/inquire`, {
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
        title="Wholesale & B2B — Bulk Tea Supply for Cafes, Hotels & Offices · Dr Tea"
        description="Source premium Indian tea in bulk. Wholesale pricing, private label, corporate gifting, and pantry programmes for cafes, hotels, offices, and retailers across India."
        canonical="https://drtea.in/wholesale"
      />

      {/* Hero */}
      <section className="relative bg-[#1a2416] text-white overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/banner-monsoon-chai.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a2416] via-[#1a2416]/85 to-[#1a2416]/40" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/80 mb-3">Wholesale &amp; B2B</p>
          <h1 className="font-serif text-[36px] sm:text-[52px] leading-[1.05] font-bold mb-4 max-w-2xl">
            Premium Indian tea,<br />by the kilo &amp; by the tonne.
          </h1>
          <p className="text-[14px] sm:text-[16px] text-white/70 max-w-xl leading-relaxed mb-7">
            Direct from estate to your cafe, hotel, office, or store. Volume pricing,
            private label, and reliable pan-India supply — backed by lab reports on every lot.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#enquire"
              className="inline-flex items-center gap-2 px-5 py-3 bg-amber-200 text-[#1a2416] text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-amber-100 transition-colors shadow-md shadow-black/20"
            >
              Request a quote <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="#tiers"
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/30 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-white/10 transition-colors"
            >
              See pricing tiers
            </a>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-10 max-w-xl">
            {[
              { k: '25 kg', v: 'Minimum order' },
              { k: '48 hrs', v: 'Priority dispatch' },
              { k: '180+', v: 'B2B partners' },
            ].map((s) => (
              <div key={s.k}>
                <p className="font-serif text-[24px] sm:text-[28px] text-amber-200">{s.k}</p>
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
            <h2 className="font-serif text-[22px] text-[#1a2416] mb-2">Enquiry received</h2>
            <p className="text-[13px] text-gray-600 max-w-md mx-auto">
              Thank you. Our wholesale team will reach out within 2 working days
              with pricing, samples, and next steps.
            </p>
          </div>
        </section>
      )}

      {/* Who it's for */}
      <section className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] mb-2">Who we supply</p>
          <h2 className="font-serif text-[26px] sm:text-[34px] text-[#1a2416] leading-tight mb-8 max-w-2xl">
            From neighbourhood cafes to five-star pantries.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {segments.map(({ value, Icon, label, blurb }, idx) => (
              <motion.button
                key={value}
                type="button"
                onClick={() => {
                  setSegment(value);
                  document.getElementById('enquire')?.scrollIntoView({ behavior: 'smooth' });
                }}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="text-left p-5 rounded-xl bg-white border border-[#1a2416]/8 hover:border-[#3a5a2c]/40 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]/40"
              >
                <div className="w-10 h-10 rounded-full bg-[#1a2416] text-amber-200 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h3 className="text-[15px] font-semibold text-[#1a2416] mb-1">{label}</h3>
                <p className="text-[12.5px] text-gray-600 leading-relaxed">{blurb}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Why partner */}
      <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white border-y border-[#1a2416]/8">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] mb-2">Why Dr Tea</p>
          <h2 className="font-serif text-[26px] sm:text-[34px] text-[#1a2416] leading-tight mb-8 max-w-xl">
            Estate-direct supply, built for serious buyers.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {pillars.map(({ Icon, title, body }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl bg-[#FAF8F4] border border-[#1a2416]/8">
                <div className="w-10 h-10 shrink-0 rounded-full bg-[#1a2416] text-amber-200 flex items-center justify-center">
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

      {/* Tiers */}
      <section id="tiers" className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#3a5a2c] mb-2">Volume tiers</p>
          <h2 className="font-serif text-[26px] sm:text-[34px] text-[#1a2416] leading-tight mb-8 max-w-xl">
            Pricing that rewards scale &amp; commitment.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {tiers.map((tier, idx) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
                className={`relative rounded-2xl border p-5 sm:p-6 flex flex-col bg-white ${
                  tier.featured
                    ? 'border-[#3a5a2c] ring-2 ring-[#3a5a2c]/15 shadow-lg'
                    : 'border-[#1a2416]/10'
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-2.5 left-5 text-[9px] font-bold uppercase tracking-[0.22em] bg-[#3a5a2c] text-white px-2 py-1 rounded">
                    Most popular
                  </span>
                )}
                <h3 className="font-serif text-[22px] text-[#1a2416] mb-1">{tier.name}</h3>
                <p className="text-[12px] text-gray-500 mb-4">From {tier.moq}</p>
                <p className={`inline-block self-start text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded ring-1 mb-5 ${tier.accent}`}>
                  {tier.discount}
                </p>
                <ul className="space-y-2.5 flex-1">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2 text-[12.5px] text-gray-700 leading-snug">
                      <Check className="w-4 h-4 text-[#3a5a2c] shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#enquire"
                  className={`mt-6 inline-flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors ${
                    tier.featured
                      ? 'bg-[#1a2416] text-amber-200 hover:bg-[#0e1a0d]'
                      : 'border border-[#1a2416]/30 text-[#1a2416] hover:bg-[#1a2416]/5'
                  }`}
                >
                  Get a quote <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Enquiry form */}
      <section id="enquire" className="px-4 sm:px-8 py-12 sm:py-16 bg-[#1a2416] text-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80 mb-2">Request a quote</p>
          <h2 className="font-serif text-[28px] sm:text-[36px] leading-tight mb-2">Tell us about your buying needs</h2>
          <p className="text-[13px] text-white/65 mb-8 max-w-lg">
            Share a few details and our wholesale team will respond within 2 working days
            with pricing, samples and lead times.
          </p>

          {error && (
            <div className="mb-5 rounded-md bg-red-500/15 border border-red-300/30 px-4 py-3 text-[12px] text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field name="companyName" label="Company / Business name" required placeholder="Bansi Coffee Roasters Pvt Ltd" />
            <Field name="contactName" label="Your name" required placeholder="Aarav Kapoor" />
            <Field name="email" label="Work email" type="email" required placeholder="you@company.com" />
            <Field name="phone" label="Phone" type="tel" required placeholder="+91 98xxxxxxxx" />
            <Field name="city" label="City" required placeholder="Bengaluru" />
            <Field name="state" label="State" placeholder="Karnataka" />

            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5 block">
                Business type <span className="text-amber-200">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {segments.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSegment(value)}
                    aria-pressed={segment === value}
                    className={`px-3 py-2.5 rounded-md text-[12px] font-semibold uppercase tracking-wider transition-colors border ${
                      segment === value
                        ? 'bg-amber-200 text-[#1a2416] border-amber-200'
                        : 'bg-white/[0.04] text-white/80 border-white/15 hover:bg-white/[0.08]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <label htmlFor="monthlyVolume" className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5">
                Estimated monthly volume <span className="text-amber-200">*</span>
              </label>
              <select
                id="monthlyVolume"
                name="monthlyVolume"
                required
                defaultValue="under-25kg"
                className="bg-white/[0.06] border border-white/15 rounded-md px-3 py-2.5 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-amber-200/40 focus:border-amber-200/40"
              >
                {volumeOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#1a2416]">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5 block">
                Categories of interest (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((label) => {
                  const on = interested.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleInterest(label)}
                      aria-pressed={on}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors border ${
                        on
                          ? 'bg-amber-200 text-[#1a2416] border-amber-200'
                          : 'bg-white/[0.04] text-white/75 border-white/15 hover:bg-white/[0.08]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-col">
              <label htmlFor="message" className="text-[10px] uppercase tracking-widest text-white/55 font-bold mb-1.5">
                Anything else? (optional)
              </label>
              <textarea
                id="message"
                name="message"
                rows={3}
                maxLength={2000}
                placeholder="Specific blends, packaging needs, target launch date, current supplier…"
                className="bg-white/[0.06] border border-white/15 rounded-md px-3 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-amber-200/40 focus:border-amber-200/40 resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-white/45 max-w-sm">
                By submitting you agree to be contacted by Dr Tea’s wholesale team. Your details
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
                    Send enquiry <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-3 text-[12px] text-white/65">
            <a href="mailto:wholesale@drtea.in" className="flex items-center gap-2 hover:text-white">
              <Mail className="w-4 h-4 text-amber-200" /> wholesale@drtea.in
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
