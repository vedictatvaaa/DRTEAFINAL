import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, User, X, ArrowRight, ChevronDown } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { useStore } from '@/store/use-store';
import { formatPrice } from '@/lib/currency';
import { useShopper } from '@/lib/shopper-auth';
import Logo from '@/components/brand/Logo';

const menuCategories = [
  { name: 'Floral Tisane', slug: 'floral-tisane', img: '/images/category-floral.webp', tag: 'Calm · Caffeine Free', color: '#6B4E8A' },
  { name: 'Chai',          slug: 'chai',          img: '/images/category-chai.webp',   tag: 'Bold · Warming',     color: '#7B3F1E' },
  { name: 'Kadha',         slug: 'kadha',         img: '/images/category-kadha.webp',  tag: 'Ayurvedic · Healing', color: '#2E4A1E' },
  { name: 'Green Tea',     slug: 'green-tea',     img: '/images/category-green.webp',  tag: 'Fresh · Everyday',   color: '#3A6B2A' },
  { name: 'Black Tea',     slug: 'black-tea',     img: '/images/category-black.webp',  tag: 'Classic · Rich',     color: '#1C1C1C' },
  { name: 'Tea Reserve',   slug: 'tea-reserve',   img: '/images/category-reserve.webp', tag: 'Rare · Exclusive',  color: '#0D0D0D' },
];

export default function Header() {
  const [hoveredCat, setHoveredCat] = useState(menuCategories[0]);
  const { toggleCart, cart, isMenuOpen, openMenu, closeMenu, openSearch, openSignIn } = useStore();
  const currency = useStore((s) => s.currency);
  const [location] = useLocation();
  const { user: shopper } = useShopper();

  useEffect(() => { closeMenu(); }, [location]);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const iconBtn = "w-10 h-10 flex items-center justify-center text-[#1a2416] hover:text-primary transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]";

  const navLinks = useMemo<NavItem[]>(
    () => [
      {
        label: 'SHOP',
        href: '/shop',
        match: (l) => l === '/shop' || l.startsWith('/shop/') || l.startsWith('/gift-cards'),
        children: [
          { label: 'All Teas',      href: '/shop',                blurb: 'Browse the full collection' },
          { label: 'Rituals',       href: '/shop/tea-reserve',    blurb: 'Rare & reserve blends' },
          { label: 'Subscriptions', href: '/shop?subscribe=1',    blurb: 'Tea, delivered monthly' },
          { label: 'Gift Cards',    href: '/gift-cards',          blurb: 'A gift, beautifully wrapped' },
        ],
      },
      {
        label: 'LEARN',
        href: '/journal',
        match: (l) =>
          l.startsWith('/journal') ||
          l.startsWith('/teapedia') ||
          l.startsWith('/recipes') ||
          l.startsWith('/pairings') ||
          l.startsWith('/wellness') ||
          l.startsWith('/tea-culture'),
        children: [
          { label: 'The Journal', href: '/journal',      blurb: 'Fresh writing — guides & opinion' },
          { label: 'Teapedia',    href: '/teapedia',     blurb: 'Look up any tea, term or origin' },
          { label: 'Recipes',     href: '/recipes',      blurb: 'Brew it your way' },
          { label: 'Pairings',    href: '/pairings',     blurb: 'Pair tea like wine' },
          { label: 'Wellness',    href: '/wellness',     blurb: 'Caffeine-free brews & ayurveda' },
          { label: 'Tea Culture', href: '/tea-culture',  blurb: 'Long reads on world tea traditions' },
        ],
      },
      {
        label: 'BUSINESS',
        href: '/wholesale',
        match: (l) => l.startsWith('/franchise') || l.startsWith('/wholesale') || l.startsWith('/b2b'),
        children: [
          { label: 'Wholesale & B2B', href: '/wholesale', blurb: 'Bulk supply for cafes, hotels, offices' },
          { label: 'Franchise',       href: '/franchise', blurb: 'Open a Dr Tea outlet' },
        ],
      },
      { label: 'REWARDS', href: '/rewards', match: (l) => l.startsWith('/rewards') },
      { label: 'ABOUT',   href: '/about',   match: (l) => l.startsWith('/about') },
    ],
    [],
  );

  // Rotating announcement (free shipping ↔ win-a-trip)
  const announcements = useMemo(
    () => [
      { text: `🌿 Free shipping on orders above ${formatPrice(999, currency)}`, href: null as string | null },
      { text: '🍃 Stay in a tea garden — 2N/3D in Jorhat from \u20b910,000 all-in →', href: '/staycation' },
    ],
    [currency],
  );
  const reduceMotion = useReducedMotion();
  const [announceIdx, setAnnounceIdx] = useState(0);
  useEffect(() => {
    if (reduceMotion || announcements.length < 2) return;
    const id = window.setInterval(() => setAnnounceIdx((i) => (i + 1) % announcements.length), 6000);
    return () => window.clearInterval(id);
  }, [announcements.length, reduceMotion]);
  const announce = announcements[announceIdx];

  return (
    <>
      {/* Top announcement strip — single rotating message */}
      <div className="bg-[#1f2a1c] text-white/85 px-4 h-7 text-[11px] tracking-wide flex items-center justify-center gap-3">
        {/* aria-live intentionally off — timed auto-rotation would be noisy for screen readers */}
        <div className="flex-1 min-w-0 text-center relative h-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={announceIdx}
              initial={reduceMotion ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: -12, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 flex items-center justify-center truncate"
            >
              {announce.href ? (
                <Link href={announce.href} className="hover:text-amber-100 transition-colors truncate">
                  {announce.text}
                </Link>
              ) : (
                <span className="truncate">{announce.text}</span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Main header — white, slim */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100/80">
        <div className="px-3 md:px-6">
          <div className="flex items-center h-12 md:h-14 gap-2 md:gap-4">
            {/* Left: hamburger (mobile/tablet) + logo + inline nav (desktop) */}
            <div className="flex items-center gap-3 md:gap-5 lg:gap-7 flex-1 min-w-0">
              <button
                onClick={openMenu}
                className={iconBtn + " md:hidden -ml-1"}
                data-testid="button-mobile-menu"
                aria-label="Open menu"
              >
                <div className="flex flex-col gap-[5px] w-[18px]">
                  <span className="block h-[1.5px] bg-current" />
                  <span className="block h-[1.5px] bg-current" />
                  <span className="block h-[1.5px] bg-current" />
                </div>
              </button>
              {/* Desktop: logo lives at the extreme left */}
              <Link href="/" className="hidden md:flex items-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] rounded" data-testid="link-home-desktop" aria-label="Dr Tea Wellness home">
                <Logo className="h-[28px] md:h-[32px] w-auto" />
              </Link>
              <nav className="hidden md:flex items-center gap-5 lg:gap-7 min-w-0" aria-label="Primary">
                {navLinks.map((nl) => (
                  <DesktopNavItem key={nl.label} item={nl} location={location} />
                ))}
              </nav>
            </div>

            {/* Center: Logo — mobile/tablet only (desktop logo is on the left) */}
            <Link href="/" className="md:hidden flex items-center justify-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] rounded" data-testid="link-home" aria-label="Dr Tea Wellness home">
              <Logo className="h-[28px] w-auto" />
            </Link>

            {/* Right: icons (cart hidden on mobile — lives in BottomNav) */}
            <div className="flex items-center gap-0.5 flex-1 justify-end">
              <button onClick={openSearch} className={iconBtn} data-testid="button-search" aria-label="Search teas">
                <Search className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
              {shopper ? (
                <Link href="/account" className={iconBtn} data-testid="link-account" aria-label={`My account (${shopper.name?.split(' ')[0] || 'signed in'})`}>
                  <span className="relative">
                    <User className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#3a5a2c] ring-2 ring-white" aria-hidden="true" />
                  </span>
                </Link>
              ) : (
                <button onClick={openSignIn} className={iconBtn} data-testid="button-signin" aria-label="Sign in to your account">
                  <User className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </button>
              )}
              <button onClick={toggleCart} className={"hidden sm:flex relative " + iconBtn} data-testid="button-cart" aria-label={`Cart (${cartCount} item${cartCount === 1 ? '' : 's'})`}>
                <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.5} />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 bg-[#1a2416] text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* FULL-SCREEN PREMIUM MENU */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={closeMenu}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, x: '-100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
              className="fixed top-0 left-0 bottom-0 z-[70] w-full sm:w-[580px] flex"
              role="dialog"
              aria-label="Main menu"
            >
              <div className="flex flex-col bg-[#1a2416] text-white w-full sm:w-[280px] flex-shrink-0">
                <div className="flex items-center justify-between px-5 sm:px-6 h-14 sm:h-16 border-b border-white/10">
                  <Logo variant="light" className="h-9 w-auto" />

                  <button onClick={closeMenu} className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" data-testid="button-close-menu" aria-label="Close menu">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 px-5 sm:px-6">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-white/30 mb-2.5">Shop by Mood</p>
                  <div className="space-y-0">
                    {menuCategories.map((cat, i) => (
                      <motion.div key={cat.slug} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 + 0.05 }}>
                        <Link
                          href={`/shop/${cat.slug}`}
                          onClick={closeMenu}
                          onMouseEnter={() => setHoveredCat(cat)}
                          className="flex items-center justify-between py-2.5 border-b border-white/8 group focus-visible:outline-none focus-visible:bg-white/5 rounded-md"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-1 h-6 rounded-full flex-shrink-0 transition-opacity"
                              style={{ backgroundColor: cat.color, opacity: hoveredCat.slug === cat.slug ? 1 : 0.4 }} />
                            <div>
                              <p className={`text-[13px] font-semibold transition-colors leading-tight ${hoveredCat.slug === cat.slug ? 'text-white' : 'text-white/80'}`}>{cat.name}</p>
                              <p className="text-[9.5px] text-white/40 mt-0.5">{cat.tag}</p>
                            </div>
                          </div>
                          <ArrowRight className={`w-3 h-3 transition-all ${hoveredCat.slug === cat.slug ? 'text-white opacity-100' : 'text-white/30 opacity-60 sm:opacity-0'}`} />
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  <div className="pt-5">
                    <p className="text-[9px] uppercase tracking-[0.25em] text-white/30 mb-2.5">Discover</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                      {[
                        { label: 'Tea Pass · ₹6,000/yr', href: '/tea-pass' },
                        { label: 'Find Your Tea', href: '/quiz' },
                        { label: 'Gift Cards', href: '/gift-cards' },
                        { label: 'Rewards', href: '/rewards' },
                        { label: 'Plantation Staycation', href: '/staycation' },
                      ].map((item) => (
                        <Link key={item.href} href={item.href} onClick={closeMenu}
                          className="py-2 text-[13px] text-white/75 hover:text-white transition-colors min-h-[36px] flex items-center focus-visible:outline-none focus-visible:underline">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <p className="text-[9px] uppercase tracking-[0.25em] text-white/30 mb-2.5">Learn</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                      {[
                        { label: 'Journal', href: '/journal' },
                        { label: 'Teapedia', href: '/teapedia' },
                        { label: 'Recipes', href: '/recipes' },
                        { label: 'Pairings', href: '/pairings' },
                        { label: 'Wellness', href: '/wellness' },
                        { label: 'Tea Culture', href: '/tea-culture' },
                      ].map((item) => (
                        <Link key={item.href} href={item.href} onClick={closeMenu}
                          className="py-2 text-[13px] text-white/75 hover:text-white transition-colors min-h-[36px] flex items-center focus-visible:outline-none focus-visible:underline">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 pb-2">
                    <p className="text-[9px] uppercase tracking-[0.25em] text-white/30 mb-2.5">More</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                      {[
                        { label: 'About Us', href: '/about' },
                        { label: 'Wholesale', href: '/wholesale' },
                        { label: 'Franchise', href: '/franchise' },
                        { label: 'Contact', href: '/contact' },
                      ].map((item) => (
                        <Link key={item.href} href={item.href} onClick={closeMenu}
                          className="py-2 text-[13px] text-white/75 hover:text-white transition-colors min-h-[36px] flex items-center focus-visible:outline-none focus-visible:underline">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </nav>

                <div className="px-5 sm:px-6 py-5 border-t border-white/10">
                  <p className="text-[9px] text-white/25">Crafted in India · Registered in UK</p>
                </div>
              </div>

              <div className="hidden sm:block flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={hoveredCat.slug}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute inset-0"
                  >
                    <img src={hoveredCat.img} alt={hoveredCat.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-8 left-6 right-6">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">Now Browsing</p>
                      <h3 className="text-2xl font-serif font-bold text-white mb-1">{hoveredCat.name}</h3>
                      <p className="text-xs text-white/60 mb-5">{hoveredCat.tag}</p>
                      <Link href={`/shop/${hoveredCat.slug}`} onClick={closeMenu}
                        className="inline-flex items-center gap-2 border border-white/40 text-white text-[10px] uppercase tracking-wider px-4 py-2.5 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-sm">
                        Explore Collection <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

type NavChild = { label: string; href: string; blurb?: string };
type NavItem = {
  label: string;
  href: string;
  match: (l: string) => boolean;
  children?: NavChild[];
};

function DesktopNavItem({ item, location }: { item: NavItem; location: string }) {
  const active = item.match(location);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Hover with a small close-delay so the cursor can travel from trigger
  // into the panel without it disappearing.
  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }
  function cancelClose() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  // Close when navigating to a new route
  useEffect(() => { setOpen(false); }, [location]);

  // Close on Escape and on focus moving outside the wrapper
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onFocusIn(e: FocusEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  const triggerCls = `group relative inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.16em] lg:tracking-[0.18em] uppercase py-2 whitespace-nowrap transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2 ${active ? 'text-[#1a2416]' : 'text-[#1a2416]/65 hover:text-[#1a2416]'}`;

  if (!item.children) {
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={triggerCls}
      >
        {item.label}
        <span
          aria-hidden="true"
          className={`absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#1a2416] origin-left transition-transform duration-300 ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
        />
      </Link>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={active ? 'page' : undefined}
        className={triggerCls}
      >
        {item.label}
        <ChevronDown
          aria-hidden="true"
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.25}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0 right-5 -bottom-0.5 h-[1.5px] bg-[#1a2416] origin-left transition-transform duration-300 ${active || open ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={item.label}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 min-w-[280px]"
          >
            <div className="bg-white border border-[#1a2416]/8 rounded-lg shadow-[0_14px_40px_-12px_rgba(26,36,22,0.25)] overflow-hidden p-2">
              {item.children.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-3.5 py-3 rounded-md hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:bg-[#FAF8F4] transition-colors"
                >
                  <p className="text-[12.5px] font-semibold text-[#1a2416] tracking-wide">{c.label}</p>
                  {c.blurb && (
                    <p className="text-[11px] text-[#1a2416]/55 mt-0.5 leading-snug">{c.blurb}</p>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
