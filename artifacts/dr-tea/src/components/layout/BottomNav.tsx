import { Link, useLocation } from 'wouter';
import { Home as HomeIcon, ShoppingBag, User, ShoppingCart, Gift } from 'lucide-react';
import { useStore } from '@/store/use-store';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WIN_LABELS = ['WIN', 'STAYCATION'];

export default function BottomNav() {
  const [location] = useLocation();

  const cart = useStore((s) => s.cart);
  const toggleCart = useStore((s) => s.toggleCart);
  const isCartOpen = useStore((s) => s.isCartOpen);
  const isMenuOpen = useStore((s) => s.isMenuOpen);
  const isSearchOpen = useStore((s) => s.isSearchOpen);
  const isSignInOpen = useStore((s) => s.isSignInOpen);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Rotating WIN label
  const [labelIdx, setLabelIdx] = useState(0);
  useEffect(() => {
    if (isMenuOpen || isCartOpen || isSearchOpen || isSignInOpen) return;
    const id = setInterval(() => setLabelIdx((i) => (i + 1) % WIN_LABELS.length), 2200);
    return () => clearInterval(id);
  }, [isMenuOpen, isCartOpen, isSearchOpen, isSignInOpen]);

  if (isMenuOpen || isCartOpen || isSearchOpen || isSignInOpen) return null;

  const isActive = (path: string) =>
    path === '/' ? location === '/' : location.startsWith(path);

  const itemCls = (active: boolean) =>
    `relative flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] rounded-md ${
      active ? 'text-[#1a2416]' : 'text-gray-400 hover:text-[#1a2416]'
    }`;

  const accentCls = (active: boolean) =>
    `pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-7 rounded-full bg-[#1a2416] origin-center transition-transform duration-300 ${active ? 'scale-x-100' : 'scale-x-0'}`;

  const homeActive = location === '/';
  const shopActive = isActive('/shop');
  const accountActive = isActive('/account');
  const winActive = location.startsWith('/staycation') || location.startsWith('/jorhat-staycation');

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 pb-safe"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Bottom navigation"
    >
      <div className="flex items-stretch h-14 px-1">
        <Link href="/" className={itemCls(homeActive)} aria-label="Home">
          <span aria-hidden="true" className={accentCls(homeActive)} />
          <HomeIcon className="w-[19px] h-[19px]" strokeWidth={homeActive ? 2.2 : 1.5} />
          <span>Home</span>
        </Link>
        <Link href="/shop" className={itemCls(shopActive)} aria-label="Shop">
          <span aria-hidden="true" className={accentCls(shopActive)} />
          <ShoppingBag className="w-[19px] h-[19px]" strokeWidth={shopActive ? 2.2 : 1.5} />
          <span>Shop</span>
        </Link>
        <Link
          href="/staycation"
          className="relative flex-[1.45] flex flex-col items-center justify-center h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 rounded-md"
          aria-label="Win a free 2-night plantation staycation in Jorhat, Assam"
        >
          {/* large gift icon */}
          <div className="relative flex items-center justify-center">
            <Gift
              className={`w-[34px] h-[34px] ${winActive ? 'text-amber-600' : 'text-amber-500'}`}
              strokeWidth={1.4}
            />
            {/* pill centered over the icon */}
            <span
              className={`absolute inline-flex items-center justify-center overflow-hidden h-[15px] px-1.5 rounded-full ${
                winActive ? 'bg-amber-400' : 'bg-amber-300'
              }`}
              style={{ minWidth: 58 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={WIN_LABELS[labelIdx]}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  transition={{ duration: 0.32, ease: 'easeOut' }}
                  className="text-[8px] font-extrabold tracking-[0.14em] text-[#1a2416] whitespace-nowrap"
                >
                  {WIN_LABELS[labelIdx]}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </Link>
        <Link href="/account" className={itemCls(accountActive)} aria-label="Account">
          <span aria-hidden="true" className={accentCls(accountActive)} />
          <User className="w-[19px] h-[19px]" strokeWidth={accountActive ? 2.2 : 1.5} />
          <span>Account</span>
        </Link>
        <button onClick={toggleCart} className={itemCls(false)} aria-label={`Cart (${cartCount} item${cartCount === 1 ? '' : 's'})`}>
          <div className="relative">
            <ShoppingCart className="w-[19px] h-[19px]" strokeWidth={1.6} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#1a2416] text-white text-[9px] font-bold min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </div>
          <span>Cart</span>
        </button>
      </div>
    </nav>
  );
}
