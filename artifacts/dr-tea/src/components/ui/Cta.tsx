import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Link } from 'wouter';

type Variant = 'primary' | 'secondary' | 'outline' | 'outlineLight';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center font-semibold uppercase tracking-[0.18em] rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap';

const sizes: Record<Size, string> = {
  sm: 'min-h-[36px] px-3.5 text-[10px]',
  md: 'min-h-[44px] px-5 text-[11px]',
};

const variants: Record<Variant, string> = {
  primary:
    'bg-[#1a2416] text-white hover:bg-[#2e4823] focus-visible:ring-offset-white',
  secondary:
    'bg-[#3a5a2c] text-white hover:bg-[#2e4823] focus-visible:ring-offset-white',
  outline:
    'border border-[#1a2416]/25 text-[#1a2416] hover:bg-[#1a2416]/5 focus-visible:ring-offset-white',
  outlineLight:
    'border border-white/40 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-[#1a2416]',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

interface CtaButtonProps
  extends CommonProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  href?: undefined;
}

type CtaLinkProps = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, 'className' | 'children' | 'href' | 'to' | 'asChild'> & {
    href: string;
  };

export const Cta = forwardRef<HTMLButtonElement, CtaButtonProps>(function Cta(
  { variant = 'primary', size = 'md', className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export function CtaLink({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: CtaLinkProps) {
  return (
    <Link
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
