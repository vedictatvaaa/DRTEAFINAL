import { useEffect, useRef } from "react";
import { useGetActiveExperience } from "@workspace/api-client-react";
import { runParticles, prefersReducedMotion, type ParticleEffectKind } from "./particle-engine";

export default function ExperienceParticles() {
  const { data } = useGetActiveExperience();
  const effect = (data?.particleEffect ?? "none") as ParticleEffectKind;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (effect === "none") return;
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cleanup: (() => void) | null = null;
    const start = () => {
      cleanup?.();
      cleanup = runParticles(canvas, {
        effect: effect as Exclude<ParticleEffectKind, "none">,
        width: window.innerWidth,
        height: window.innerHeight,
        countMultiplier: window.innerWidth < 640 ? 0.55 : 1,
        respectVisibility: true,
      });
    };
    start();
    window.addEventListener("resize", start);
    return () => {
      window.removeEventListener("resize", start);
      cleanup?.();
    };
  }, [effect]);

  if (effect === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="experience-particles"
      className="pointer-events-none fixed inset-0 z-[5]"
      style={{ mixBlendMode: effect === "diyas" ? "screen" : "normal" }}
    />
  );
}
