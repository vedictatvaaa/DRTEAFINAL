import { useState } from 'react';
import { Link } from 'wouter';
import { Check, ArrowRight, Instagram, Facebook, Loader2, Leaf, ShieldCheck, Truck, Globe2, ChevronDown, Phone, MessageCircle } from 'lucide-react';

// Modern X (formerly Twitter) glyph — lucide doesn't ship an X icon.
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.9l-5.4-7.06L3.9 22H.64l8.02-9.17L.5 2h7.06l4.88 6.45L18.244 2Zm-1.21 18h1.91L7.07 4H5.04l11.994 16Z" />
  </svg>
);
import { useStore } from '@/store/use-store';
import { formatPrice } from '@/lib/currency';
import { useNewsletterSubscribe } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import logoColoredSrc from '@assets/logo_dr_tea__1778416916237.png';

const buildFooterCols = (freeShipLabel: string) => [
  {
    title: 'Shop',
    links: [
      { label: 'All Teas', href: '/shop' },
      { label: 'Chai', href: '/shop/chai' },
      { label: 'Floral Tisane', href: '/shop/floral-tisane' },
      { label: 'Green Tea', href: '/shop/green-tea' },
      { label: 'Tea Reserve', href: '/shop/tea-reserve' },
      { label: 'Kadha', href: '/shop/kadha' },
      { label: 'Teawares', href: '/shop/teawares' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'Tea Journal', href: '/journal' },
      { label: 'Recipes', href: '/recipes' },
      { label: 'Pairings', href: '/pairings' },
      { label: 'Wellness', href: '/wellness' },
      { label: 'Find Your Tea', href: '/quiz' },
      { label: 'From Garden to Cup', href: '/#process' },
      { label: 'Why Dr Tea?', href: '/about' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: freeShipLabel, href: '/shipping' },
      { label: '7-Day Returns', href: '/refunds' },
      { label: 'Track Order', href: '/account' },
      { label: 'Shipping & Delivery', href: '/shipping' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'Our Story', href: '/about' },
      { label: 'Partners & Investors', href: '/partners' },
      { label: 'Franchise', href: '/franchise' },
      { label: 'Wholesale / B2B', href: '/wholesale' },
      { label: 'Gift Cards', href: '/gift-cards' },
      { label: 'Tea Club Rewards', href: '/rewards' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
    ],
  },
];

const trustBadges = [
  { Icon: ShieldCheck, label: 'FSSAI Licensed' },
  { Icon: Leaf,        label: '100% Natural' },
  { Icon: Truck,       label: 'Ships in 24h' },
  { Icon: Globe2,      label: 'Ships Worldwide' },
];

const SOCIAL_HANDLE = 'drteawellness';
const socials = [
  { Icon: Instagram, label: 'Instagram @drteawellness', href: `https://instagram.com/${SOCIAL_HANDLE}` },
  { Icon: Facebook,  label: 'Facebook @drteawellness',  href: `https://facebook.com/${SOCIAL_HANDLE}` },
  { Icon: XIcon,     label: 'X (Twitter) @drteawellness', href: `https://x.com/${SOCIAL_HANDLE}` },
];

export default function Footer() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [openCol, setOpenCol] = useState<string | null>(null);
  const currency = useStore((s) => s.currency);
  const footerCols = buildFooterCols(`Free Shipping ${formatPrice(999, currency)}+`);
  const { toast } = useToast();
  const subscribeMut = useNewsletterSubscribe();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !consent || subscribeMut.isPending) return;
    subscribeMut.mutate(
      { data: { email, source: 'footer' } },
      {
        onSuccess: () => {
          setSubscribed(true);
          setEmail('');
          setConsent(false);
        },
        onError: () => {
          toast({
            title: "Couldn't subscribe",
            description: 'Please check your email and try again.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <footer className="relative bg-[#13180f] text-white/80 overflow-hidden">
      {/* Subtle warm vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(60% 50% at 50% 0%, rgba(186,140,72,0.18) 0%, rgba(0,0,0,0) 60%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-6">
        {/* ── Brand block ─────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10">
          <div className="inline-flex bg-white rounded-md p-1 sm:p-1.5 shadow-sm mb-2.5">
            <img
              src={logoColoredSrc}
              alt="Dr Tea — Crafted Tea & Teaware"
              className="h-[20px] sm:h-[22px] w-auto block"
              draggable={false}
            />
          </div>
          <p className="font-serif italic text-[13px] sm:text-[14px] text-amber-200/75 leading-snug max-w-[260px]">
            Crafted in India for modern tea rituals.
          </p>

          {/* Socials — trimmer on mobile (icon-only chips) */}
          <div className="mt-4 sm:mt-5 flex items-center gap-2 sm:gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-white/15 flex items-center justify-center text-white/65 hover:border-amber-200/50 hover:text-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
              >
                <s.Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={1.6} />
              </a>
            ))}
          </div>
        </div>

        {/* ── Newsletter — slim inline on mobile, card on desktop ──────── */}
        <div className="mx-auto max-w-md mb-8 sm:mb-12 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:backdrop-blur-sm sm:p-6">
          <p className="hidden sm:block text-[9px] uppercase tracking-[0.28em] text-amber-200/70 mb-1.5 text-center">The Ritual Letter</p>
          <h3 className="font-serif text-[14px] sm:text-[19px] font-bold text-white text-center leading-tight mb-1">
            Join the slow brew
          </h3>
          <p className="text-[10.5px] sm:text-[11px] text-white/45 sm:text-white/50 text-center leading-snug mb-3 sm:mb-4 px-3 sm:px-0">
            First harvests &amp; quiet offers — once a fortnight.
          </p>

          {subscribed ? (
            <div className="flex items-center justify-center gap-2 text-green-400 text-[13px] sm:text-sm font-medium py-1.5">
              <Check className="w-4 h-4" /> Welcome to the ritual.
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-2 sm:space-y-3">
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  aria-label="Email address"
                  disabled={subscribeMut.isPending}
                  className="flex-1 bg-white/[0.06] border border-white/15 text-white placeholder:text-white/35 px-3 sm:px-3.5 py-2.5 sm:py-3 text-[12px] sm:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50 focus:border-amber-200/40 rounded-md min-w-0 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!consent || subscribeMut.isPending}
                  aria-label="Subscribe to newsletter"
                  className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-[#1a2416] text-[10px] font-bold uppercase tracking-[0.18em] rounded-md flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
                >
                  {subscribeMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span className="hidden sm:inline">Join</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
              <label className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-[10.5px] text-white/45 sm:text-white/50 leading-snug cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-[2px] accent-amber-200 w-3 h-3 sm:w-auto sm:h-auto"
                  aria-label="Marketing consent"
                />
                <span>Send me Dr Tea letters. Unsubscribe anytime.</span>
              </label>
            </form>
          )}
        </div>

        {/* ── Link columns ────────────────────────────────
            Mobile: accordions. Desktop: 4-column grid. */}
        <nav aria-label="Footer" className="border-t border-white/10">
          {/* Mobile accordions */}
          <div className="sm:hidden divide-y divide-white/10">
            {footerCols.map((col) => {
              const isOpen = openCol === col.title;
              return (
                <div key={col.title}>
                  <button
                    type="button"
                    onClick={() => setOpenCol(isOpen ? null : col.title)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between py-4 text-left focus-visible:outline-none focus-visible:bg-white/[0.03]"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">{col.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      strokeWidth={1.8}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                      isOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                    aria-hidden={!isOpen}
                  >
                    <ul className="space-y-2 pb-4 pl-1">
                      {col.links.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            tabIndex={isOpen ? 0 : -1}
                            className="text-[13px] text-white/60 hover:text-white transition-colors block py-1.5 focus-visible:outline-none focus-visible:underline"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop grid */}
          <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-8 pt-10">
            {footerCols.map((col) => (
              <div key={col.title}>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.22em] text-white mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[11.5px] text-white/55 hover:text-amber-200 transition-colors block py-0.5 focus-visible:outline-none focus-visible:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* ── Talk-to-us strip — prominent contact details ─────────── */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-amber-200/80">
              Talk to us
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <a
                href="tel:+918929892922"
                aria-label="Call Dr Tea on +91-8929-8929-22"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/15 bg-white/[0.03] text-white hover:border-amber-200/60 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
              >
                <Phone className="w-3.5 h-3.5 text-amber-200" strokeWidth={1.9} />
                <span className="text-[12px] font-semibold tracking-wide tabular-nums">
                  +91-8929-8929-22
                </span>
              </a>
              <a
                href="https://wa.me/918929892922"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with Dr Tea on WhatsApp"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-100 hover:border-emerald-300/70 hover:bg-emerald-500/[0.12] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-300" strokeWidth={1.9} />
                <span className="text-[12px] font-semibold tracking-wide">WhatsApp</span>
              </a>
              <a
                href="mailto:care@drtea.in"
                aria-label="Email Dr Tea care team"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/15 bg-white/[0.03] text-white hover:border-amber-200/60 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
              >
                <span className="text-[12px] font-semibold tracking-wide">care@drtea.in</span>
              </a>
            </div>
            <p className="text-[10px] text-white/45 tracking-wide">Mon–Sat · 10:00–19:00 IST</p>
          </div>
        </div>

        {/* ── Trust strip — minimal icons row ─────────────── */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:gap-x-8">
            {trustBadges.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-white/60">
                <Icon className="w-3.5 h-3.5 text-amber-200/80" strokeWidth={1.7} aria-hidden="true" />
                <span className="text-[10.5px] uppercase tracking-[0.18em] font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Bottom bar ──────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <span className="text-[9px] text-white/35 font-semibold uppercase tracking-[0.22em]">Secure Pay</span>
            <div className="flex gap-1">
              {[
                { l: 'VISA', cls: 'bg-white text-[#1a2416]' },
                { l: 'MC',   cls: 'bg-orange-500 text-white' },
                { l: 'UPI',  cls: 'bg-blue-500 text-white' },
                { l: 'RZP',  cls: 'bg-indigo-500 text-white' },
                { l: 'COD',  cls: 'bg-white/10 text-white' },
              ].map((b) => (
                <span key={b.l} className={`${b.cls} text-[8px] px-1.5 py-1 rounded font-bold tracking-wider`}>
                  {b.l}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-white/35 text-center sm:text-right">
            © 2026 Dr Tea · Crafted in India · Registered in UK.
          </p>
        </div>
      </div>
    </footer>
  );
}
