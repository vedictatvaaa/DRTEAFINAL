import { useState, useMemo, useEffect } from 'react';
import { Link, useRoute } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Star, Heart, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  categories,
  wellnessFocusOptions, brewingTypeOptions, ritualStyleOptions, flavorProfileOptions,
} from '@/data/products';
import { useProducts } from '@/lib/api-data';
import { useStore } from '@/store/use-store';
import Seo from '@/components/Seo';
import Breadcrumbs from '@/components/Breadcrumbs';
import { formatPrice } from '@/lib/currency';
import ShopSeoContent, { shopFaqs } from '@/components/shop/ShopSeoContent';
import ProductImage from '@/components/product/ProductImage';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const AVAILABLE_SLUGS = new Set(['blue-pea-flower', 'hibiscus-tea', 'dr-tea-gold-ctc']);

type FilterKey = 'category' | 'caffeine' | 'flavorProfile' | 'wellnessFocus' | 'brewingType' | 'ritualStyle';

interface Filters {
  category: string[];
  caffeine: string[];
  flavorProfile: string[];
  wellnessFocus: string[];
  brewingType: string[];
  ritualStyle: string[];
}

const empty: Filters = { category: [], caffeine: [], flavorProfile: [], wellnessFocus: [], brewingType: [], ritualStyle: [] };

const filterDefs: { key: FilterKey; label: string; options: string[] }[] = [
  { key: 'category',      label: 'Category',      options: categories.map(c => c.name) },
  { key: 'caffeine',      label: 'Caffeine',       options: ['none', 'low', 'medium', 'high'] },
  { key: 'wellnessFocus', label: 'Wellness Focus', options: wellnessFocusOptions },
  { key: 'brewingType',   label: 'Brewing Type',   options: brewingTypeOptions },
  { key: 'ritualStyle',   label: 'Ritual Style',   options: ritualStyleOptions },
  { key: 'flavorProfile', label: 'Flavor Profile', options: flavorProfileOptions },
];

export default function Shop() {
  const [matchCat, paramsCat] = useRoute('/shop/:category');
  const routeCategory = matchCat ? paramsCat?.category : null;
  const routeCatObj = routeCategory ? categories.find(c => c.slug === routeCategory) : null;

  const { addToCart, toggleWishlist, wishlist } = useStore();
  const currency = useStore((s) => s.currency);
  const { products } = useProducts();
  const [filters, setFilters] = useState<Filters>(empty);
  const [sortBy, setSortBy] = useState('bestselling');
  const [panelOpen, setPanelOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ category: true, caffeine: false, wellnessFocus: false, brewingType: false, ritualStyle: false, flavorProfile: false });

  // Shared-wishlist link support: /shop?w=slug1,slug2
  const [sharedSlugs, setSharedSlugs] = useState<string[] | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const w = params.get('w');
    if (!w) { setSharedSlugs(null); return; }
    const validSlugs = new Set(products.map(p => p.slug));
    const slugs = w.split(',').map(s => s.trim()).filter(s => validSlugs.has(s));
    setSharedSlugs(slugs.length ? slugs : null);
  }, [products]);
  const clearShared = () => {
    setSharedSlugs(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  useEffect(() => {
    if (routeCatObj) {
      setFilters(f => ({ ...f, category: [routeCatObj.name] }));
    } else {
      setFilters(f => ({ ...f, category: [] }));
    }
  }, [routeCategory]);

  const toggle = (key: FilterKey, val: string) =>
    setFilters(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val] }));

  const toggleSection = (key: string) =>
    setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const clearAll = () => setFilters(empty);

  const totalActive = Object.values(filters).reduce((a, arr) => a + arr.length, 0);

  const filtered = useMemo(() => {
    let r = [...products];
    if (sharedSlugs)                  r = r.filter(p => sharedSlugs.includes(p.slug));
    if (filters.category.length)      r = r.filter(p => filters.category.includes(p.category));
    if (filters.caffeine.length)      r = r.filter(p => filters.caffeine.includes(p.caffeineLevel));
    if (filters.flavorProfile.length) r = r.filter(p => p.flavorProfile.some(f => filters.flavorProfile.includes(f)));
    if (filters.wellnessFocus.length) r = r.filter(p => p.wellnessFocus.some(w => filters.wellnessFocus.includes(w)));
    if (filters.brewingType.length)   r = r.filter(p => filters.brewingType.includes(p.brewingType));
    if (filters.ritualStyle.length)   r = r.filter(p => filters.ritualStyle.includes(p.ritualStyle));
    switch (sortBy) {
      case 'price-low':  return r.sort((a, b) => a.price - b.price);
      case 'price-high': return r.sort((a, b) => b.price - a.price);
      case 'rating':     return r.sort((a, b) => b.rating - a.rating);
      default:           return r.sort((a, b) => b.reviewCount - a.reviewCount);
    }
  }, [filters, sortBy, sharedSlugs, products]);

  const activeCatObj = filters.category.length === 1
    ? categories.find(c => c.name === filters.category[0])
    : routeCatObj;

  const bannerBg = activeCatObj ? `hsl(${activeCatObj.theme.bg})` : 'hsl(var(--muted))';
  // Detect dark category themes (e.g. Tea Reserve uses near-black bg) so the
  // banner heading/subhead remain legible. HSL string format is "H S% L%".
  const bannerIsDark = (() => {
    if (!activeCatObj) return false;
    const m = activeCatObj.theme.bg.match(/(\d+(?:\.\d+)?)%\s*$/);
    return m ? Number(m[1]) < 50 : false;
  })();

  const FilterPanel = () => (
    <div className="space-y-0 divide-y divide-border">
      <div className="flex items-center justify-between py-3 px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-widest">Filters</h3>
        {totalActive > 0 && (
          <button onClick={clearAll} className="text-[10px] text-primary font-medium underline">Clear all</button>
        )}
      </div>
      {filterDefs.map(({ key, label, options }) => (
        <div key={key} className="py-0">
          <button
            onClick={() => toggleSection(key)}
            className="flex items-center justify-between w-full py-3 px-1 text-left"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
            {openSections[key] ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {openSections[key] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pb-3 space-y-2 px-1">
                  {options.map(opt => {
                    const active = (filters[key] as string[]).includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
                        <div className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-all ${active ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}>
                          {active && <span className="text-primary-foreground text-[9px] font-bold">✓</span>}
                        </div>
                        <input type="checkbox" className="sr-only" checked={active} onChange={() => toggle(key, opt)} />
                        <span className="text-[12px] capitalize">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );

  const seoTitle = activeCatObj
    ? `Buy ${activeCatObj.name} Online — Single-Origin Indian Tea | Dr Tea`
    : 'Buy Tea Online India — Masala Chai, Kadha, Darjeeling, Green Tea & Floral Tisanes | Dr Tea';
  const seoDesc = activeCatObj
    ? `${activeCatObj.description} Hand-picked single-origin ${activeCatObj.name.toLowerCase()} from heritage Indian estates — Assam, Darjeeling, Nilgiri & the spice belt. Small-batch, fresh, free shipping above ₹999.`
    : 'Shop the full Dr Tea collection online — single-origin masala chai, Assam CTC, Darjeeling first flush, Nilgiri, green tea, white tea, oolong, ayurvedic kadhas (tulsi-ginger, haldi-mulethi, ashwagandha) and caffeine-free floral tisanes (chamomile, lavender, rose, blue pea, hibiscus). Direct from heritage estates. Free shipping above ₹999.';
  const seoCanonical = activeCatObj
    ? `https://drtea.in/shop/${activeCatObj.slug}`
    : 'https://drtea.in/shop';

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={seoTitle}
        description={seoDesc}
        canonical={seoCanonical}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: seoTitle,
            url: seoCanonical,
            description: seoDesc,
            isPartOf: { '@type': 'WebSite', name: 'Dr Tea', url: 'https://drtea.in/' },
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: filtered.length,
              itemListElement: filtered.slice(0, 24).map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `https://drtea.in/product/${p.slug}`,
                name: p.name,
              })),
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://drtea.in/' },
              { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://drtea.in/shop' },
              ...(activeCatObj
                ? [{ '@type': 'ListItem', position: 3, name: activeCatObj.name, item: seoCanonical }]
                : []),
            ],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: shopFaqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ]}
        jsonLdId="ld-shop"
      />
      <div className="container mx-auto px-4 sm:px-6 pt-4">
        <Breadcrumbs
          items={
            activeCatObj
              ? [{ label: 'Shop', href: '/shop' }, { label: activeCatObj.name }]
              : [{ label: 'Shop' }]
          }
        />
      </div>

      {/* Category banner with dynamic theme */}
      <div
        className="pt-6 pb-8 sm:pt-10 sm:pb-12 relative overflow-hidden transition-colors duration-500"
        style={{ backgroundColor: bannerBg }}
      >
        {activeCatObj && (
          <div className={`absolute inset-0 ${bannerIsDark ? 'opacity-25' : 'opacity-10'}`}>
            <img src={activeCatObj.image} alt={activeCatObj.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <h1 className={`text-3xl sm:text-5xl font-serif font-bold mb-2 ${bannerIsDark ? 'text-white' : ''}`}>
            {activeCatObj ? activeCatObj.name : 'Shop All Teas'}
          </h1>
          <p className={`text-[13px] sm:text-sm max-w-md mx-auto leading-relaxed ${bannerIsDark ? 'text-white/75' : 'text-foreground/65'}`}>
            {activeCatObj ? activeCatObj.description : 'Single-estate teas, hand-blended chais & botanical tisanes — direct from heritage Indian gardens.'}
          </p>
        </div>
      </div>

      {/* Shared wishlist banner */}
      {sharedSlugs && (
        <div className="bg-primary/10 border-b border-primary/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-[12px] sm:text-sm text-primary font-medium">
              <Heart className="inline w-3.5 h-3.5 mr-1.5 fill-primary" />
              Viewing a shared wishlist · {sharedSlugs.length} {sharedSlugs.length === 1 ? 'tea' : 'teas'}
            </p>
            <button
              onClick={clearShared}
              className="text-[11px] font-bold uppercase tracking-wider text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] rounded-sm"
            >
              View all
            </button>
          </div>
        </div>
      )}

      {/* Category quick-nav pills */}
      <div className="bg-white border-b border-border py-3 snap-fade-x">
        <div className="flex gap-2 pl-4 pr-8 sm:px-4 sm:justify-center overflow-x-auto scrollbar-hide snap-x snap-mandatory [mask-image:linear-gradient(to_right,black_calc(100%_-_32px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%_-_32px),transparent)] sm:[mask-image:none] sm:[-webkit-mask-image:none]">
          <Link href="/shop">
            <button className={`flex-shrink-0 px-4 py-2.5 rounded-full text-[12px] font-semibold border transition-all snap-start min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${!filters.category.length && !routeCatObj ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}>
              All
            </button>
          </Link>
          {categories.map(cat => {
            const active = filters.category.includes(cat.name);
            return (
              <Link key={cat.slug} href={`/shop/${cat.slug}`}>
                <button className={`flex-shrink-0 px-4 py-2.5 rounded-full text-[12px] font-semibold border transition-all whitespace-nowrap snap-start min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}>
                  {cat.name}
                </button>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-5">
        {/* Toolbar — filters/active chips on the left, count + sort on the right */}
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider hover:text-primary transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
              {totalActive > 0 && (
                <span className="bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{totalActive}</span>
              )}
            </button>
            {(() => {
              // Hide chips for the URL-route category — it's already shown in
              // the breadcrumb, banner, and active pill, and clicking × would
              // be a no-op (the route useEffect re-adds it on next render).
              const visibleChips = (Object.entries(filters) as [FilterKey, string[]][]).flatMap(([key, vals]) =>
                vals
                  .filter(val => !(key === 'category' && routeCatObj && val === routeCatObj.name))
                  .map(val => ({ key, val }))
              );
              if (visibleChips.length === 0) return null;
              return (
                <>
                  <span aria-hidden="true" className="hidden sm:inline text-muted-foreground/40">·</span>
                  {visibleChips.map(({ key, val }) => (
                    <button key={`${key}:${val}`} onClick={() => toggle(key, val)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-primary/8 text-primary text-[11px] rounded-full font-medium hover:bg-primary/15 transition-colors border border-primary/20">
                      {val} <X className="w-3 h-3" />
                    </button>
                  ))}
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground hidden sm:inline whitespace-nowrap">{filtered.length} {filtered.length === 1 ? 'tea' : 'teas'}</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger
                aria-label="Sort products"
                className="h-auto py-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider rounded-full border-border bg-transparent hover:bg-muted/40 transition-colors gap-2 [&>svg]:opacity-60"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="text-[12px]">
                <SelectItem value="bestselling">Bestselling</SelectItem>
                <SelectItem value="price-low">Price: Low → High</SelectItem>
                <SelectItem value="price-high">Price: High → Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Mobile filter drawer (full-screen sheet) */}
          <AnimatePresence>
            {panelOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="sm:hidden fixed inset-0 z-50 bg-black/40"
                onClick={() => setPanelOpen(false)}
              >
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'tween', duration: 0.25 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-background overflow-y-auto"
                >
                  <div className="flex items-center justify-between px-4 py-4 border-b border-border sticky top-0 bg-background z-10">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider">Filters &amp; sort</h3>
                    <button onClick={() => setPanelOpen(false)} aria-label="Close filters" className="p-1.5 hover:bg-muted rounded-full">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-4 py-2">
                    <div className="py-3 border-b border-border">
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-2">Sort by</label>
                      <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full bg-transparent text-[12px] border border-border rounded-sm px-2 py-2">
                        <option value="bestselling">Bestselling</option>
                        <option value="price-low">Price: Low → High</option>
                        <option value="price-high">Price: High → Low</option>
                        <option value="rating">Highest Rated</option>
                      </select>
                    </div>
                    <FilterPanel />
                  </div>
                  <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex gap-2">
                    {totalActive > 0 && (
                      <button onClick={clearAll} className="flex-1 py-2.5 border border-border text-[11px] font-bold uppercase tracking-wider rounded-sm">Clear</button>
                    )}
                    <button onClick={() => setPanelOpen(false)} className="flex-[2] py-2.5 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider rounded-sm">
                      Show {filtered.length} teas
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop filter sidebar */}
          <AnimatePresence>
            {panelOpen && (
              <motion.aside
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 220 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.22 }}
                className="flex-shrink-0 overflow-hidden hidden sm:block"
              >
                <div className="w-[220px] sticky top-28 bg-card border border-border rounded-xl p-4">
                  <FilterPanel />
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {filtered.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-muted-foreground text-sm mb-3">No teas match your filters.</p>
                <button onClick={clearAll} className="text-primary text-sm underline font-medium">Clear all filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((product, idx) => (
                  <motion.div key={product.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.025 }} className="group">
                    {(() => {
                      const available = AVAILABLE_SLUGS.has(product.slug);
                      return (
                    <div className="bg-card rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow">
                      <div className="relative aspect-square bg-muted overflow-hidden">
                        <Link href={available ? `/product/${product.slug}` : '#'} onClick={e => !available && e.preventDefault()}>
                          <ProductImage
                            src={product.imageUrl}
                            name={product.name}
                            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${!available ? 'blur-[3px] brightness-50' : ''}`}
                          />
                        </Link>
                        {!available && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="bg-black/70 text-white text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-white/20">
                              Out of Stock
                            </span>
                          </div>
                        )}
                        {available && product.fomoTag && (
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded-sm">
                            {product.fomoTag.replace(/-/g, ' ')}
                          </div>
                        )}
                        {available && (
                          <button onClick={() => toggleWishlist(product.slug)}
                            aria-label={`${wishlist.includes(product.slug) ? 'Remove from' : 'Add to'} wishlist`}
                            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow-sm sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]">
                            <Heart className={`w-4 h-4 ${wishlist.includes(product.slug) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                          </button>
                        )}
                        {available ? (
                          <button onClick={() => addToCart(product, product.variants[0])}
                            aria-label={`Add ${product.name} to cart`}
                            className="absolute bottom-2 right-2 sm:bottom-0 sm:right-0 sm:left-0 w-10 h-10 sm:w-auto sm:h-auto sm:py-3 rounded-full sm:rounded-none bg-[#1a2416] sm:bg-primary text-white sm:text-primary-foreground text-[10px] font-bold uppercase tracking-wider sm:text-center sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-200 flex items-center justify-center gap-1 shadow-md sm:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                            <Plus className="w-4 h-4 sm:w-3 sm:h-3" />
                            <span className="hidden sm:inline">Add · {formatPrice(product.variants[0].price, currency)}</span>
                          </button>
                        ) : null}
                      </div>
                      <div className="p-3">
                        <Link href={`/product/${product.slug}`}>
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-serif font-semibold text-[13px] leading-tight line-clamp-2 flex-1 mr-2">{product.name}</h4>
                            <span className="font-bold text-[13px] flex-shrink-0">{formatPrice(product.price, currency)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">{product.shortDescription}</p>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-[11px] font-medium">{product.rating}</span>
                            <span className="text-[11px] text-muted-foreground">({product.reviewCount})</span>
                          </div>
                        </Link>
                      </div>
                    </div>
                      );
                    })()}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ShopSeoContent activeCategoryName={activeCatObj?.name} />
    </div>
  );
}
