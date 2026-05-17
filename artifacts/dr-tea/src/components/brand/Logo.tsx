interface LogoProps {
  className?: string;
  /** Theme controls how the logo sits on dark backgrounds. */
  variant?: "dark" | "light";
  /** Reserved for API compatibility — the new brand mark always renders the full lockup. */
  wordmarkOnly?: boolean;
  title?: string;
}

/**
 * Dr Tea brand mark — hand-authored SVG lockup.
 *
 * Replaces the previous 1696×406 PNG, which downsampled to ~28-32px in the
 * header and turned the "CRAFTED TEA & TEAWARE" tagline into ~3px of mush.
 * SVG renders pixel-perfect at any size, and the colours are dialled up
 * (slightly brighter, more saturated forest green; warmer gold tagline)
 * so the mark stays vivid on the cream/white nav surfaces.
 *
 * On dark surfaces (`variant="light"`) it floats on a soft white pill so
 * the deep-green wordmark stays legible.
 */
export default function Logo({
  className = "",
  variant = "dark",
  title = "Dr Tea — Crafted Tea & Teaware",
}: LogoProps) {
  const svg = (
    <svg
      viewBox="0 0 220 52"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={variant === "light" ? "h-full w-auto block" : `${className} block`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      <text
        x="100"
        y="30"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontWeight={700}
        fontSize="34"
        letterSpacing="0.5"
        fill="#1f5d2c"
      >
        DR. TEA
      </text>
      <text
        x="184"
        y="22"
        textAnchor="middle"
        fontFamily="'Inter', system-ui, -apple-system, sans-serif"
        fontWeight={800}
        fontSize="20"
        fill="#1f5d2c"
      >
        ®
      </text>
      <text
        x="100"
        y="48"
        textAnchor="middle"
        fontFamily="'Inter', system-ui, -apple-system, sans-serif"
        fontWeight={700}
        fontSize="9"
        letterSpacing="1.6"
        fill="#8b6a2f"
      >
        CRAFTED TEA &amp; TEAWARE
      </text>
    </svg>
  );

  if (variant === "light") {
    return (
      <span
        className={`inline-flex items-center justify-center bg-white rounded-md px-2 py-1 ${className}`}
      >
        {svg}
      </span>
    );
  }
  return svg;
}
