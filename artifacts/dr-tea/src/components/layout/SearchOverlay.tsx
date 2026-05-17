import { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/use-store';
import { categories } from '@/data/products';
import { useProducts } from '@/lib/api-data';
import { formatPrice } from '@/lib/currency';

const popularQueries = ['Masala Chai', 'Chamomile', 'Green Tea', 'Kadha', 'Darjeeling'];

export default function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useStore();
  const currency = useStore((s) => s.currency);
  const { products } = useProducts();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSearchOpen) return;
    setQuery('');
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isSearchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch(); };
    if (isSearchOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchOpen, closeSearch]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        (p.tastingNotes ?? []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [query, products]);

  const matchedCats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 3);
  }, [query]);

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSearch}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="fixed top-0 left-0 right-0 z-[81] bg-white shadow-2xl max-h-[92vh] overflow-y-auto"
            role="dialog"
            aria-label="Search teas"
          >
            <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teas, blends, or moods…"
                className="flex-1 text-base sm:text-[15px] py-2 focus:outline-none placeholder:text-gray-400 bg-transparent min-w-0"
                data-testid="input-search"
              />
              <button
                onClick={closeSearch}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 sm:px-6 py-5">
              {!query && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3">Popular Searches</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {popularQueries.map(q => (
                      <button
                        key={q}
                        onClick={() => setQuery(q)}
                        className="px-3 py-2 bg-[#f7f5f1] hover:bg-[#1a2416] hover:text-white text-[12px] rounded-full transition-colors min-h-[36px]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3">Browse Collections</p>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map(c => (
                      <Link key={c.slug} href={`/shop/${c.slug}`} onClick={closeSearch}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f7f5f1] transition-colors">
                        <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                          <img src={c.image} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#1a2416] leading-tight">{c.name}</p>
                          <p className="text-[10px] text-gray-400 line-clamp-1">{c.description}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {query && matches.length === 0 && matchedCats.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-500 mb-1">No teas match "{query}"</p>
                  <p className="text-[12px] text-gray-400">Try a different name, mood, or category.</p>
                </div>
              )}

              {matchedCats.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-2">Collections</p>
                  <div className="flex flex-wrap gap-2">
                    {matchedCats.map(c => (
                      <Link key={c.slug} href={`/shop/${c.slug}`} onClick={closeSearch}
                        className="px-3 py-2 bg-[#f0ede4] hover:bg-[#1a2416] hover:text-white text-[12px] font-medium rounded-full transition-colors">
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {matches.length > 0 && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3">Teas</p>
                  <div className="space-y-2">
                    {matches.map(p => (
                      <Link key={p.slug} href={`/product/${p.slug}`} onClick={closeSearch}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f7f5f1] transition-colors">
                        <div className="w-12 h-14 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#1a2416] leading-tight">{p.name}</p>
                          <p className="text-[11px] text-gray-400 line-clamp-1">{p.shortDescription}</p>
                        </div>
                        <span className="text-[13px] font-bold text-[#1a2416] flex-shrink-0">{formatPrice(p.price, currency)}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
