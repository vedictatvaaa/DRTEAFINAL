import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Variant } from '@/data/products';
import type { CurrencyCode } from '@/lib/currency';
import { appendJournal } from '@/lib/cart-sync';

function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

export interface CartItem {
  id: string; // unique instance id for the cart
  product: Product;
  variant: Variant;
  quantity: number;
  subscription?: boolean;
}

export interface UserPreferences {
  name: string;
  email: string;
  brewingMethod: string;
}

interface StoreState {
  cart: CartItem[];
  isCartOpen: boolean;
  wishlist: string[]; // product slugs
  isMenuOpen: boolean;
  isSearchOpen: boolean;
  isSignInOpen: boolean;
  hasHydrated: boolean;
  preferences: UserPreferences;

  currency: CurrencyCode;
  currencyAuto: boolean; // true until the user manually overrides

  /** Promo code applied at checkout (e.g. abandoned-cart "COMEBACK5"). Null when none. */
  appliedDiscountCode: string | null;
  setAppliedDiscountCode: (code: string | null) => void;

  // Actions
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;

  openSearch: () => void;
  closeSearch: () => void;

  openSignIn: () => void;
  closeSignIn: () => void;

  addToCart: (product: Product, variant: Variant, quantity?: number, subscription?: boolean) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;

  toggleWishlist: (slug: string) => void;

  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setHasHydrated: (state: boolean) => void;

  setCurrency: (code: CurrencyCode, manual?: boolean) => void;
}

const defaultPreferences: UserPreferences = {
  name: 'Guest User',
  email: 'guest@example.com',
  brewingMethod: 'Loose Leaf (Teapot)',
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      cart: [],
      isCartOpen: false,
      wishlist: [],
      isMenuOpen: false,
      isSearchOpen: false,
      isSignInOpen: false,
      hasHydrated: false,
      preferences: defaultPreferences,
      currency: 'INR',
      currencyAuto: true,
      appliedDiscountCode: null,
      setAppliedDiscountCode: (code) => set({ appliedDiscountCode: code }),

      openCart: () => set({ isCartOpen: true, isMenuOpen: false, isSearchOpen: false }),
      closeCart: () => set({ isCartOpen: false }),
      toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen, isMenuOpen: false, isSearchOpen: false })),

      openMenu: () => set({ isMenuOpen: true, isCartOpen: false, isSearchOpen: false }),
      closeMenu: () => set({ isMenuOpen: false }),
      toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen, isCartOpen: false, isSearchOpen: false })),

      openSearch: () => set({ isSearchOpen: true, isCartOpen: false, isMenuOpen: false, isSignInOpen: false }),
      closeSearch: () => set({ isSearchOpen: false }),

      openSignIn: () => set({ isSignInOpen: true, isCartOpen: false, isMenuOpen: false, isSearchOpen: false }),
      closeSignIn: () => set({ isSignInOpen: false }),

      addToCart: (product, variant, quantity = 1, subscription = false) => set((state) => {
        if (isOffline()) {
          appendJournal({ kind: 'add', ts: Date.now(), productId: product.id, variantSize: variant.size, quantity });
        }
        const existingItemIndex = state.cart.findIndex(
          (item) => item.product.id === product.id && item.variant.size === variant.size && !!item.subscription === !!subscription
        );

        if (existingItemIndex !== -1) {
          const newCart = [...state.cart];
          const existing = newCart[existingItemIndex]!;
          newCart[existingItemIndex] = { ...existing, quantity: existing.quantity + quantity };
          return { cart: newCart, isCartOpen: true };
        }

        return {
          cart: [...state.cart, { id: `${product.id}-${variant.size}-${subscription ? 'sub' : 'one'}-${Date.now()}`, product, variant, quantity, subscription }],
          isCartOpen: true
        };
      }),

      removeFromCart: (cartItemId) => set((state) => {
        if (isOffline()) {
          const item = state.cart.find((i) => i.id === cartItemId);
          if (item) appendJournal({ kind: 'remove', ts: Date.now(), productId: item.product.id, variantSize: item.variant.size });
        }
        return { cart: state.cart.filter((item) => item.id !== cartItemId) };
      }),

      updateQuantity: (cartItemId, quantity) => set((state) => {
        if (isOffline()) {
          const item = state.cart.find((i) => i.id === cartItemId);
          if (item) appendJournal({ kind: 'update', ts: Date.now(), productId: item.product.id, variantSize: item.variant.size, quantity: Math.max(1, quantity) });
        }
        return {
          cart: state.cart.map((item) =>
            item.id === cartItemId ? { ...item, quantity: Math.max(1, quantity) } : item
          )
        };
      }),

      clearCart: () => {
        if (isOffline()) {
          appendJournal({ kind: 'clear', ts: Date.now() });
        }
        set({ cart: [] });
      },

      toggleWishlist: (slug) => set((state) => ({
        wishlist: state.wishlist.includes(slug)
          ? state.wishlist.filter(s => s !== slug)
          : [...state.wishlist, slug]
      })),

      updatePreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
      })),

      setHasHydrated: (state) => set({ hasHydrated: state }),

      setCurrency: (code, manual = true) => set({ currency: code, currencyAuto: !manual }),
    }),
    {
      name: 'dr-tea-storage',
      partialize: (state) => ({
        cart: state.cart,
        wishlist: state.wishlist,
        preferences: state.preferences,
        currency: state.currency,
        currencyAuto: state.currencyAuto,
        appliedDiscountCode: state.appliedDiscountCode,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
