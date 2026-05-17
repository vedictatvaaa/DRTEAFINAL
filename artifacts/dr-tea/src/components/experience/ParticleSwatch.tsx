import { useEffect, useRef } from "react";
import { runParticles, prefersReducedMotion, type ParticleEffectKind } from "./particle-engine";

const SWATCH_W = 88;
const SWATCH_H = 44;

const BG_BY_EFFECT: Record<ParticleEffectKind, string> = {
  none: "linear-gradient(135deg,#f3f4f6,#e5e7eb)",
  rain: "linear-gradient(180deg,#1f2937,#374151)",
  snow: "linear-gradient(180deg,#475569,#94a3b8)",
  leaves: "linear-gradient(180deg,#3f2a18,#6b4423)",
  diyas: "linear-gradient(180deg,#3a0f0a,#7a1d10)",
  petals: "linear-gradient(180deg,#3b1f2c,#7a2f4a)",
};

export function ParticleSwatch({ effect }: { effect: ParticleEffectKind }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (effect === "none") return;
    if (prefersReducedMotion()) return;
    const c = ref.current;
    if (!c) return;
    return runParticles(c, {
      effect,
      width: SWATCH_W,
      height: SWATCH_H,
      countMultiplier: 0.18,
      respectVisibility: true,
    });
  }, [effect]);

  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{ width: SWATCH_W, height: SWATCH_H, background: BG_BY_EFFECT[effect] }}
      aria-hidden="true"
      data-testid={`particle-swatch-${effect}`}
    >
      {effect === "none" ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wider text-gray-500">
          off
        </div>
      ) : (
        <canvas ref={ref} className="absolute inset-0" />
      )}
    </div>
  );
}
