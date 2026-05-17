import { useState, useMemo } from 'react';
import { Leaf } from 'lucide-react';

type Props = {
  src?: string | null;
  name: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'sync' | 'async' | 'auto';
};

const PALETTES = [
  ['#1c2a1c', '#3a5a2c'],
  ['#2c2018', '#5a3322'],
  ['#1f2a3a', '#2c4a6a'],
  ['#3a1a28', '#6a2a44'],
  ['#2a241a', '#5a4a2a'],
  ['#1a3236', '#2c5a60'],
  ['#3a2618', '#7a4a1c'],
  ['#241a36', '#4a3a6a'],
  ['#36241a', '#7a4424'],
  ['#1a3628', '#2c6a4a'],
  ['#3a2a3a', '#6a4a6a'],
  ['#2a2a2a', '#4a4a4a'],
] as const;

function paletteFor(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[hash % PALETTES.length]!;
}

/**
 * Image paths used as generic stock fallbacks for many products. When a
 * product's imageUrl matches one of these we render the branded placeholder
 * instead, so cards don't look identical and don't feel "missing".
 */
export const GENERIC_PLACEHOLDER_URLS = new Set<string>([
  '/images/category-floral.webp',
  '/images/category-floral.png',
  '/images/category-kadha.webp',
  '/images/category-kadha.png',
  '/images/category-green.webp',
  '/images/category-green.png',
  '/images/category-black.webp',
  '/images/category-black.png',
  '/images/category-chai.webp',
  '/images/category-chai.png',
  '/images/category-reserve.webp',
  '/images/category-reserve.png',
  '/images/product-chai.png',
  '/images/product-chai.webp',
]);

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'DT';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/**
 * Drop-in <img> replacement for product imagery. When the source URL is
 * missing or fails to load, renders a branded gradient placeholder showing
 * the product initials + name in serif so empty cards never look broken.
 */
export default function ProductImage({
  src,
  name,
  className = '',
  loading = 'lazy',
  decoding = 'async',
}: Props) {
  const [errored, setErrored] = useState(false);
  const isGeneric = !!src && GENERIC_PLACEHOLDER_URLS.has(src);
  const showFallback = !src || errored || isGeneric;

  const [from, to] = useMemo(() => paletteFor(name), [name]);
  const initials = useMemo(() => initialsFor(name), [name]);

  if (showFallback) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`relative flex flex-col items-center justify-center text-white overflow-hidden ${className}`}
        style={{ background: `linear-gradient(140deg, ${from} 0%, ${to} 100%)` }}
        data-testid="product-image-placeholder"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.10), transparent 55%)',
          }}
        />
        <Leaf className="absolute top-3 right-3 w-4 h-4 text-white/30" aria-hidden="true" />
        <span className="font-serif italic text-3xl sm:text-5xl tracking-tight text-white/90 drop-shadow-sm select-none">
          {initials}
        </span>
        <span className="mt-1 px-3 text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-white/70 text-center line-clamp-2 max-w-[85%]">
          {name}
        </span>
        <span className="absolute bottom-2 inset-x-0 text-center text-[8px] tracking-[0.3em] text-white/35 uppercase font-serif">
          Dr Tea
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading={loading}
      decoding={decoding}
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
