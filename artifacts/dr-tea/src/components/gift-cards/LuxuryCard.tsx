import type { GiftCardDesign, GiftCardTier } from '@/lib/gift-cards';

// Each tier has its own visual language — no shared gradient template.
// Heritage = forest deep-green + art-deco gilt frame + Devanagari mark.
// Silver Estate = brushed platinum + Darjeeling topo lines + altitude.
// Gold Reserve = bronze base + Mughal jaali lattice + paisley filigree.
// Obsidian = inkwell black + champagne pinstripe + Centurion minimalism.
// All four still share dimensions, footprint, and the print-mode CR80 lock.

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export interface LuxuryCardProps {
  design?: GiftCardDesign;
  tier: GiftCardTier;
  serial?: string;
  amount: number;
  recipientName?: string;
  senderName?: string;
  print?: boolean;
  back?: boolean;
  code?: string;
  expiresAt?: string;
}

// ── Sizing tokens (px on screen, mm in print) ────────────────────────
function tokens(print: boolean) {
  return {
    pad: print ? '5mm' : '6%',
    pillRadius: print ? '3.18mm' : '1rem',
    brand: print ? '5mm' : '20px',
    eyebrow: print ? '1.7mm' : '9px',
    serial: print ? '4.6mm' : '20px',
    holder: print ? '3.6mm' : '15px',
    value: print ? '6mm' : '26px',
    valid: print ? '3.2mm' : '14px',
    crest: print ? '12mm' : '46px',
    sub: print ? '1.6mm' : '9px',
    micro: print ? '1.4mm' : '8px',
  };
}

function frameStyle(print: boolean, bg: React.CSSProperties['background']): React.CSSProperties {
  return print
    ? {
        width: '85.6mm',
        height: '53.98mm',
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '3.18mm',
      }
    : { background: bg };
}

const tierLabel: Record<GiftCardTier, string> = {
  standard: 'Heritage',
  silver: 'Silver Estate',
  gold: 'Gold Reserve',
  obsidian: 'Obsidian',
};

const tierFoil: Record<GiftCardTier, string> = {
  standard: '#d4af37',
  silver: '#dfe4ea',
  gold: '#e8c860',
  obsidian: '#cdb88a',
};

// ── Shared back of card ──────────────────────────────────────────────
function CardBack(props: LuxuryCardProps) {
  const t = tokens(props.print ?? false);
  const print = props.print ?? false;
  const last4 = (props.code ?? '')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(-4)
    .toUpperCase() || '••••';
  const foil = tierFoil[props.tier];
  // Backs share a deep ink base regardless of tier — feels professional and
  // keeps the magstripe legible. The foil + label pick up tier identity.
  const bg = props.tier === 'obsidian'
    ? '#050608'
    : props.tier === 'silver'
      ? '#1a1f24'
      : props.tier === 'gold'
        ? '#1a1208'
        : '#0e1810';
  return (
    <div
      className={
        print ? '' : 'relative aspect-[1.585/1] rounded-2xl shadow-2xl overflow-hidden'
      }
      style={{ ...frameStyle(print, bg), color: '#FAF8F4' }}
      data-testid="luxury-card-back"
    >
      <div
        className="absolute left-0 right-0"
        style={{
          top: print ? '6mm' : '12%',
          height: print ? '10mm' : '18%',
          background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
        }}
      />
      <div
        className="absolute"
        style={{
          left: print ? '5mm' : '6%',
          right: print ? '28mm' : '32%',
          top: print ? '22mm' : '40%',
          height: print ? '8mm' : '14%',
          background: '#f4ecd8',
          borderRadius: '1mm',
        }}
      >
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.04) 4px 8px)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: print ? '-3mm' : '-18%',
            left: print ? '0.5mm' : '2%',
            fontSize: t.micro,
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          AUTHORISED SIGNATURE
        </div>
      </div>
      <div
        className="absolute font-mono"
        style={{
          right: print ? '5mm' : '6%',
          top: print ? '22mm' : '40%',
          height: print ? '8mm' : '14%',
          width: print ? '20mm' : '24%',
          background: '#f4ecd8',
          color: '#1a2416',
          borderRadius: '1mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: print ? '3mm' : '14px',
          fontWeight: 700,
          letterSpacing: '0.12em',
        }}
      >
        {last4}
      </div>
      <div
        className="absolute leading-relaxed"
        style={{
          left: print ? '5mm' : '6%',
          right: print ? '5mm' : '6%',
          bottom: print ? '4mm' : '6%',
          fontSize: t.sub,
          opacity: 0.75,
        }}
      >
        Bearer instrument · {tierLabel[props.tier]} member. Reload anytime at
        drtea.in/gift-cards. Lost cards re-issued via concierge. Redeemable at
        all Dr Tea outlets and online — no surcharge. Foil scratches; treat
        with care.
      </div>
      <div
        className="absolute font-serif"
        style={{
          right: print ? '5mm' : '6%',
          bottom: print ? '4mm' : '6%',
          fontSize: print ? '2.4mm' : '11px',
          color: foil,
          letterSpacing: '0.18em',
        }}
      >
        DR · TEA
      </div>
    </div>
  );
}

// ── HERITAGE (entry tier) ────────────────────────────────────────────
//
// Visual: forest deep-green base, subtle linen weave, inset double-line
// gilt frame, ornate corner fans, centered watermark of a hand-drawn tea
// leaf, Devanagari "चाय" wordmark beside the brand. Reads as a botanical
// herbarium plate — heritage, scholarly, restrained.
function HeritageFront(props: LuxuryCardProps) {
  const t = tokens(props.print ?? false);
  const print = props.print ?? false;
  const foil = '#c9a44a';
  const bg =
    'radial-gradient(circle at 30% 20%, #1a2416 0%, #0c1408 80%), repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.012) 0 1px, transparent 1px 5px)';
  const frame = `${print ? '0.3mm' : '1px'} solid ${foil}88`;
  return (
    <div
      className={
        print ? '' : 'relative aspect-[1.585/1] rounded-2xl shadow-2xl overflow-hidden'
      }
      style={{ ...frameStyle(print, bg), color: '#f4ecd8' }}
      data-testid="luxury-card-front"
    >
      {/* Gilt double frame */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: print ? '2.4mm' : '3.5%',
          border: frame,
          borderRadius: print ? '2mm' : '0.6rem',
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: print ? '3.2mm' : '5%',
          border: `${print ? '0.15mm' : '0.5px'} solid ${foil}55`,
          borderRadius: print ? '1.4mm' : '0.45rem',
        }}
      />
      {/* Tea-leaf watermark, hand-drawn */}
      <svg
        aria-hidden
        viewBox="0 0 200 120"
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.085,
        }}
      >
        <g fill="none" stroke={foil} strokeWidth="0.4">
          <path d="M100 30 C 70 40, 60 70, 100 95 C 140 70, 130 40, 100 30 Z" />
          <path d="M100 32 L 100 92" />
          <path d="M100 45 L 82 60 M100 55 L 82 70 M100 65 L 82 80 M100 45 L 118 60 M100 55 L 118 70 M100 65 L 118 80" />
        </g>
      </svg>
      {/* Corner fans */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => {
        const map = {
          tl: { top: print ? '3.6mm' : '5.5%', left: print ? '3.6mm' : '5.5%', rot: 0 },
          tr: { top: print ? '3.6mm' : '5.5%', right: print ? '3.6mm' : '5.5%', rot: 90 },
          bl: { bottom: print ? '3.6mm' : '5.5%', left: print ? '3.6mm' : '5.5%', rot: 270 },
          br: { bottom: print ? '3.6mm' : '5.5%', right: print ? '3.6mm' : '5.5%', rot: 180 },
        }[c];
        return (
          <svg
            key={c}
            viewBox="0 0 24 24"
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              width: print ? '5mm' : '20px',
              height: print ? '5mm' : '20px',
              ...map,
              transform: `rotate(${map.rot}deg)`,
            }}
          >
            <g fill="none" stroke={foil} strokeWidth="0.6" opacity="0.9">
              <path d="M2 22 L 22 22 L 22 2" />
              <path d="M6 22 Q 10 18, 14 14" />
              <path d="M10 22 Q 14 18, 18 14" />
              <path d="M14 22 Q 18 18, 22 14" />
            </g>
          </svg>
        );
      })}
      {/* Top: brand + Devanagari + crest */}
      <div
        className="absolute flex items-start justify-between"
        style={{
          left: print ? '6.5mm' : '9%',
          right: print ? '6.5mm' : '9%',
          top: print ? '6.5mm' : '11%',
        }}
      >
        <div>
          <div
            className="font-serif"
            style={{ fontSize: t.brand, color: foil, letterSpacing: '0.04em', lineHeight: 1 }}
          >
            Dr Tea
          </div>
          <div
            style={{
              fontSize: t.eyebrow,
              letterSpacing: '0.32em',
              color: '#f4ecd8',
              opacity: 0.75,
              marginTop: print ? '0.6mm' : '3px',
            }}
          >
            HERITAGE · चाय
          </div>
        </div>
        <div
          className="font-serif flex items-center justify-center"
          style={{
            width: t.crest,
            height: t.crest,
            border: `${print ? '0.4mm' : '1.5px'} solid ${foil}`,
            borderRadius: '999px',
            color: foil,
            fontSize: print ? '5mm' : '20px',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          I
        </div>
      </div>
      {/* Serial */}
      <div
        className="absolute font-mono"
        style={{
          left: print ? '6.5mm' : '9%',
          top: print ? '24mm' : '46%',
          fontSize: t.serial,
          letterSpacing: '0.2em',
          color: foil,
          textShadow: '0 1px 0 rgba(0,0,0,0.45)',
          fontWeight: 600,
        }}
        data-testid="card-serial"
      >
        {props.serial && props.serial.length > 0 ? props.serial : 'DT/••••/••••••'}
      </div>
      {/* Holder + value */}
      <BottomLine {...props} foil={foil} />
    </div>
  );
}

// ── SILVER ESTATE ────────────────────────────────────────────────────
//
// Visual: brushed platinum face, Darjeeling topo contour lines as the
// hero motif, geometric sans typography, square-with-slash crest, tiny
// altitude stamp ("ELEV. 2,134 m"). High-altitude estate aesthetic.
function SilverEstateFront(props: LuxuryCardProps) {
  const t = tokens(props.print ?? false);
  const print = props.print ?? false;
  const foil = '#fefefe';
  const ink = '#1a1f24';
  // Brushed platinum: cool radial + horizontal micro-ridges.
  const bg = `
    linear-gradient(180deg, #c9d2da 0%, #93a3b3 45%, #b8c3cc 100%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 3px)
  `;
  return (
    <div
      className={
        print ? '' : 'relative aspect-[1.585/1] rounded-2xl shadow-2xl overflow-hidden'
      }
      style={{ ...frameStyle(print, bg), color: ink }}
      data-testid="luxury-card-front"
    >
      {/* Topographic contour lines — Darjeeling silhouette */}
      <svg
        aria-hidden
        viewBox="0 0 200 120"
        preserveAspectRatio="xMidYMid slice"
        className="absolute pointer-events-none"
        style={{ inset: 0, width: '100%', height: '100%', opacity: 0.45 }}
      >
        <g fill="none" stroke={ink} strokeWidth="0.35">
          <path d="M-10 95 Q 20 80, 45 88 T 95 78 T 145 84 T 210 70" />
          <path d="M-10 80 Q 18 65, 42 72 T 92 60 T 142 66 T 210 50" opacity="0.85" />
          <path d="M-10 65 Q 22 48, 46 56 T 96 42 T 146 50 T 210 34" opacity="0.7" />
          <path d="M-10 50 Q 25 32, 50 40 T 100 26 T 150 34 T 210 20" opacity="0.55" />
          <path d="M-10 35 Q 28 18, 54 26 T 104 12 T 154 20 T 210 6" opacity="0.4" />
        </g>
      </svg>
      {/* Top: brand + crest */}
      <div
        className="absolute flex items-start justify-between"
        style={{
          left: print ? '5mm' : '6%',
          right: print ? '5mm' : '6%',
          top: print ? '4.5mm' : '7%',
        }}
      >
        <div>
          <div
            style={{
              fontSize: t.brand,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: ink,
              lineHeight: 1,
            }}
          >
            DR TEA
          </div>
          <div
            style={{
              fontSize: t.eyebrow,
              letterSpacing: '0.34em',
              color: ink,
              opacity: 0.7,
              marginTop: print ? '0.6mm' : '3px',
              fontWeight: 600,
            }}
          >
            SILVER ESTATE
          </div>
        </div>
        {/* Square crest with diagonal slash */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: t.crest,
            height: t.crest,
            border: `${print ? '0.4mm' : '1.5px'} solid ${ink}`,
            background: foil,
            color: ink,
            fontWeight: 800,
            fontSize: print ? '4.4mm' : '18px',
            letterSpacing: '0.04em',
          }}
        >
          II
          <div
            aria-hidden
            className="absolute"
            style={{
              top: 0,
              right: 0,
              width: 0,
              height: 0,
              borderLeft: `${print ? '4mm' : '14px'} solid transparent`,
              borderTop: `${print ? '4mm' : '14px'} solid ${ink}`,
            }}
          />
        </div>
      </div>
      {/* Serial */}
      <div
        className="absolute font-mono"
        style={{
          left: print ? '5mm' : '6%',
          top: print ? '23mm' : '44%',
          fontSize: t.serial,
          letterSpacing: '0.16em',
          color: ink,
          fontWeight: 700,
        }}
        data-testid="card-serial"
      >
        {props.serial && props.serial.length > 0 ? props.serial : 'DT/••••/••••••'}
      </div>
      {/* Altitude stamp */}
      <div
        className="absolute"
        style={{
          right: print ? '5mm' : '6%',
          top: print ? '23mm' : '44%',
          fontSize: t.micro,
          letterSpacing: '0.32em',
          color: ink,
          opacity: 0.7,
          fontWeight: 600,
        }}
      >
        ELEV. 2,134 m
      </div>
      {/* Holder + value */}
      <BottomLine {...props} foil={ink} dark />
    </div>
  );
}

// ── GOLD RESERVE ─────────────────────────────────────────────────────
//
// Visual: bronze base, Mughal jaali (geometric lattice) watermark, gold
// paisley filigree on opposite corners, italic-serif typography, ornate
// octagonal crest. Royal Lucknowi feel, opulent without shouting.
function GoldReserveFront(props: LuxuryCardProps) {
  const t = tokens(props.print ?? false);
  const print = props.print ?? false;
  const foil = '#f3d889';
  const bg = `
    radial-gradient(ellipse at 20% 0%, #6b4d22 0%, #3a2b14 60%, #1f1408 110%)
  `;
  return (
    <div
      className={
        print ? '' : 'relative aspect-[1.585/1] rounded-2xl shadow-2xl overflow-hidden'
      }
      style={{ ...frameStyle(print, bg), color: '#FAF8F4' }}
      data-testid="luxury-card-front"
    >
      {/* Mughal jaali lattice — repeating geometric SVG, faint */}
      <svg
        aria-hidden
        className="absolute pointer-events-none"
        style={{ inset: 0, width: '100%', height: '100%', opacity: 0.18 }}
      >
        <defs>
          <pattern id="jaali" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={foil} strokeWidth="0.4">
              <circle cx="7" cy="7" r="3.5" />
              <circle cx="0" cy="0" r="3.5" />
              <circle cx="14" cy="0" r="3.5" />
              <circle cx="0" cy="14" r="3.5" />
              <circle cx="14" cy="14" r="3.5" />
              <path d="M7 0 L 7 14 M 0 7 L 14 7" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#jaali)" />
      </svg>
      {/* Paisley flourish — top right */}
      <svg
        aria-hidden
        viewBox="0 0 60 60"
        className="absolute pointer-events-none"
        style={{
          top: print ? '2mm' : '3%',
          right: print ? '2mm' : '3%',
          width: print ? '18mm' : '70px',
          height: print ? '18mm' : '70px',
          opacity: 0.55,
        }}
      >
        <g fill="none" stroke={foil} strokeWidth="0.7">
          <path d="M30 5 C 50 10, 55 35, 35 50 C 20 60, 10 45, 18 30 C 24 20, 30 18, 30 5 Z" />
          <path d="M30 15 C 42 20, 44 35, 32 44" />
          <circle cx="30" cy="22" r="1.5" />
          <circle cx="35" cy="30" r="1" />
          <circle cx="28" cy="36" r="1" />
        </g>
      </svg>
      {/* Paisley flourish — bottom left, mirrored */}
      <svg
        aria-hidden
        viewBox="0 0 60 60"
        className="absolute pointer-events-none"
        style={{
          bottom: print ? '2mm' : '3%',
          left: print ? '2mm' : '3%',
          width: print ? '18mm' : '70px',
          height: print ? '18mm' : '70px',
          opacity: 0.45,
          transform: 'scale(-1, -1)',
        }}
      >
        <g fill="none" stroke={foil} strokeWidth="0.7">
          <path d="M30 5 C 50 10, 55 35, 35 50 C 20 60, 10 45, 18 30 C 24 20, 30 18, 30 5 Z" />
          <path d="M30 15 C 42 20, 44 35, 32 44" />
        </g>
      </svg>
      {/* Top center: brand + crest */}
      <div
        className="absolute flex items-start justify-between"
        style={{
          left: print ? '6mm' : '8%',
          right: print ? '6mm' : '8%',
          top: print ? '5mm' : '8%',
        }}
      >
        <div>
          <div
            className="font-serif italic"
            style={{ fontSize: t.brand, color: foil, lineHeight: 1, letterSpacing: '0.02em' }}
          >
            Dr Tea
          </div>
          <div
            style={{
              fontSize: t.eyebrow,
              letterSpacing: '0.4em',
              color: foil,
              opacity: 0.85,
              marginTop: print ? '0.6mm' : '3px',
            }}
          >
            GOLD · RESERVE
          </div>
        </div>
        {/* Octagonal crest */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: t.crest,
            height: t.crest,
            color: foil,
            fontFamily: 'serif',
            fontStyle: 'italic',
            fontSize: print ? '4.6mm' : '19px',
          }}
        >
          <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full">
            <polygon
              points="12,2 28,2 38,12 38,28 28,38 12,38 2,28 2,12"
              fill="rgba(0,0,0,0.35)"
              stroke={foil}
              strokeWidth="1.2"
            />
            <polygon
              points="14,4 26,4 36,14 36,26 26,36 14,36 4,26 4,14"
              fill="none"
              stroke={foil}
              strokeWidth="0.4"
              opacity="0.7"
            />
          </svg>
          <span className="relative">III</span>
        </div>
      </div>
      {/* Serial — italic gold serif */}
      <div
        className="absolute font-serif italic"
        style={{
          left: print ? '6mm' : '8%',
          top: print ? '24mm' : '46%',
          fontSize: t.serial,
          letterSpacing: '0.14em',
          color: foil,
          textShadow: '0 1px 0 rgba(0,0,0,0.55)',
          fontWeight: 600,
        }}
        data-testid="card-serial"
      >
        {props.serial && props.serial.length > 0 ? props.serial : 'DT/••••/••••••'}
      </div>
      <BottomLine {...props} foil={foil} serif />
    </div>
  );
}

// ── OBSIDIAN ─────────────────────────────────────────────────────────
//
// Visual: deep ink-well black, vertical champagne pinstripe (very faint),
// brand wordmark only — the smallest possible amount of text. A single
// hand-drawn tea leaf at bottom-right is the only ornament. Tier mark "★"
// floats top-right with no surrounding crest. Centurion-grade restraint.
function ObsidianFront(props: LuxuryCardProps) {
  const t = tokens(props.print ?? false);
  const print = props.print ?? false;
  const foil = '#cdb88a';
  const bg = `
    linear-gradient(180deg, #050608 0%, #0c0e12 100%),
    repeating-linear-gradient(90deg, rgba(205,184,138,0.04) 0 1px, transparent 1px 6px)
  `;
  return (
    <div
      className={
        print ? '' : 'relative aspect-[1.585/1] rounded-2xl shadow-2xl overflow-hidden'
      }
      style={{ ...frameStyle(print, bg), color: '#FAF8F4' }}
      data-testid="luxury-card-front"
    >
      {/* Pinstripe overlay — vertical champagne */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(205,184,138,0.06) 0 0.6px, transparent 0.6px 6px)',
        }}
      />
      {/* Top-left: tiny serial (mono) */}
      <div
        className="absolute font-mono"
        style={{
          left: print ? '5mm' : '6%',
          top: print ? '4mm' : '6%',
          fontSize: t.micro,
          letterSpacing: '0.28em',
          color: foil,
          opacity: 0.85,
        }}
        data-testid="card-serial"
      >
        {props.serial && props.serial.length > 0 ? props.serial : 'DT/••••/••••••'}
      </div>
      {/* Top-right: bare star */}
      <div
        className="absolute font-serif"
        style={{
          right: print ? '5mm' : '6%',
          top: print ? '3.4mm' : '5%',
          fontSize: print ? '7mm' : '28px',
          color: foil,
          lineHeight: 1,
        }}
      >
        ★
      </div>
      {/* Centerpiece — brand only */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -55%)',
          textAlign: 'center',
        }}
      >
        <div
          className="font-serif"
          style={{
            fontSize: print ? '7.5mm' : '30px',
            color: foil,
            letterSpacing: '0.32em',
            lineHeight: 1,
            fontWeight: 500,
          }}
        >
          DR · TEA
        </div>
        <div
          style={{
            fontSize: t.micro,
            color: '#FAF8F4',
            opacity: 0.55,
            letterSpacing: '0.5em',
            marginTop: print ? '1mm' : '6px',
          }}
        >
          OBSIDIAN
        </div>
      </div>
      {/* Single tea leaf — bottom right */}
      <svg
        aria-hidden
        viewBox="0 0 40 40"
        className="absolute pointer-events-none"
        style={{
          right: print ? '5mm' : '6%',
          bottom: print ? '4mm' : '6%',
          width: print ? '8mm' : '32px',
          height: print ? '8mm' : '32px',
          opacity: 0.85,
        }}
      >
        <g fill="none" stroke={foil} strokeWidth="0.7">
          <path d="M20 5 C 8 12, 6 28, 20 36 C 34 28, 32 12, 20 5 Z" />
          <path d="M20 6 L 20 35" />
          <path d="M20 14 L 12 20 M 20 20 L 12 26 M 20 14 L 28 20 M 20 20 L 28 26" />
        </g>
      </svg>
      {/* Holder + value, bottom left, very minimal */}
      <div
        className="absolute"
        style={{
          left: print ? '5mm' : '6%',
          bottom: print ? '4mm' : '6%',
        }}
      >
        <div
          style={{
            fontSize: t.micro,
            letterSpacing: '0.32em',
            opacity: 0.55,
            color: '#FAF8F4',
          }}
        >
          HOLDER
        </div>
        <div
          className="font-serif"
          style={{
            fontSize: t.holder,
            color: '#FAF8F4',
            marginTop: print ? '0.4mm' : '2px',
          }}
        >
          {(props.recipientName ?? '').trim() || 'A Tea Connoisseur'}
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: t.value,
            color: foil,
            fontWeight: 500,
            letterSpacing: '0.04em',
            marginTop: print ? '1mm' : '4px',
            lineHeight: 1.05,
          }}
        >
          {inr(props.amount)}
        </div>
      </div>
      {/* Valid thru — bottom center-right, tiny */}
      <div
        className="absolute font-mono"
        style={{
          right: print ? '17mm' : '18%',
          bottom: print ? '6mm' : '9%',
          fontSize: t.micro,
          color: foil,
          opacity: 0.85,
          letterSpacing: '0.18em',
        }}
      >
        VALID THRU{' '}
        {props.expiresAt
          ? new Date(props.expiresAt).toLocaleDateString('en-IN', {
              month: '2-digit',
              year: '2-digit',
            })
          : '••/••'}
      </div>
    </div>
  );
}

// ── Shared bottom row used by Heritage, Silver, Gold ─────────────────
function BottomLine(
  props: LuxuryCardProps & { foil: string; dark?: boolean; serif?: boolean },
) {
  const t = tokens(props.print ?? false);
  const print = props.print ?? false;
  const ink = props.dark ? '#1a1f24' : '#FAF8F4';
  const labelOpacity = props.dark ? 0.7 : 0.65;
  return (
    <div
      className="absolute"
      style={{
        left: print ? '6.5mm' : '8%',
        right: print ? '6.5mm' : '8%',
        bottom: print ? '5mm' : '8%',
      }}
    >
      <div
        style={{
          fontSize: t.micro,
          letterSpacing: '0.3em',
          color: ink,
          opacity: labelOpacity,
          textTransform: 'uppercase',
        }}
      >
        Holder
      </div>
      <div
        className={props.serif ? 'font-serif italic' : 'font-serif'}
        style={{
          fontSize: t.holder,
          color: ink,
          marginTop: print ? '0.4mm' : '2px',
        }}
      >
        {(props.recipientName ?? '').trim() || 'A Tea Connoisseur'}
      </div>
      <div
        className="flex items-end justify-between"
        style={{ marginTop: print ? '1mm' : '6px' }}
      >
        <div>
          <div
            style={{
              fontSize: t.micro,
              letterSpacing: '0.3em',
              color: ink,
              opacity: labelOpacity,
              textTransform: 'uppercase',
            }}
          >
            Value loaded
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: t.value,
              fontWeight: 700,
              color: props.foil,
              lineHeight: 1.05,
            }}
          >
            {inr(props.amount)}
          </div>
        </div>
        <div className="text-right">
          <div
            style={{
              fontSize: t.micro,
              letterSpacing: '0.3em',
              color: ink,
              opacity: labelOpacity,
              textTransform: 'uppercase',
            }}
          >
            Valid thru
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: t.valid,
              color: ink,
              marginTop: print ? '0.4mm' : '2px',
            }}
          >
            {props.expiresAt
              ? new Date(props.expiresAt).toLocaleDateString('en-IN', {
                  month: '2-digit',
                  year: '2-digit',
                })
              : '••/••'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public entry point ───────────────────────────────────────────────
export function LuxuryCard(props: LuxuryCardProps) {
  if (props.back) return <CardBack {...props} />;
  switch (props.tier) {
    case 'silver':
      return <SilverEstateFront {...props} />;
    case 'gold':
      return <GoldReserveFront {...props} />;
    case 'obsidian':
      return <ObsidianFront {...props} />;
    case 'standard':
    default:
      return <HeritageFront {...props} />;
  }
}
