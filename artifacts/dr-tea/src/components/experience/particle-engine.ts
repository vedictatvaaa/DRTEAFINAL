export type ParticleEffectKind = "none" | "rain" | "snow" | "leaves" | "diyas" | "petals";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  hue?: number;
  alpha: number;
  drift: number;
  phase: number;
}

const FULL_COUNTS: Record<Exclude<ParticleEffectKind, "none">, number> = {
  rain: 110,
  snow: 70,
  leaves: 28,
  diyas: 36,
  petals: 40,
};

function makeParticle(effect: Exclude<ParticleEffectKind, "none">, w: number, h: number): Particle {
  const r = Math.random;
  switch (effect) {
    case "rain":
      return { x: r() * w, y: r() * h, vx: -1.2, vy: 9 + r() * 6, size: 1 + r() * 1.5, rot: 0, vr: 0, alpha: 0.35 + r() * 0.35, drift: 0, phase: 0 };
    case "snow":
      return { x: r() * w, y: r() * h, vx: 0, vy: 0.6 + r() * 1.4, size: 1.5 + r() * 3, rot: 0, vr: 0, alpha: 0.55 + r() * 0.4, drift: 0.5 + r() * 1.2, phase: r() * Math.PI * 2 };
    case "leaves":
      return { x: r() * w, y: r() * h, vx: -0.4 - r() * 0.6, vy: 0.6 + r() * 1.0, size: 7 + r() * 8, rot: r() * Math.PI * 2, vr: (r() - 0.5) * 0.04, hue: 25 + r() * 25, alpha: 0.7 + r() * 0.3, drift: 1 + r() * 1.5, phase: r() * Math.PI * 2 };
    case "diyas":
      return { x: r() * w, y: r() * h, vx: 0, vy: -(0.3 + r() * 0.6), size: 2 + r() * 3, rot: 0, vr: 0, alpha: 0.5 + r() * 0.5, drift: 0.4 + r() * 0.8, phase: r() * Math.PI * 2 };
    case "petals":
      return { x: r() * w, y: r() * h, vx: -0.2 - r() * 0.4, vy: 0.6 + r() * 1.2, size: 5 + r() * 6, rot: r() * Math.PI * 2, vr: (r() - 0.5) * 0.03, alpha: 0.7 + r() * 0.3, drift: 0.8 + r() * 1.5, phase: r() * Math.PI * 2 };
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, effect: Exclude<ParticleEffectKind, "none">) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  switch (effect) {
    case "rain":
      ctx.strokeStyle = "rgba(180,210,230,0.7)";
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(2, 12);
      ctx.stroke();
      break;
    case "snow":
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "leaves":
      ctx.fillStyle = `hsl(${p.hue ?? 32}, 60%, 45%)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "diyas": {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 4);
      grad.addColorStop(0, "rgba(255,200,90,0.95)");
      grad.addColorStop(0.4, "rgba(255,150,40,0.55)");
      grad.addColorStop(1, "rgba(255,120,20,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,235,180,1)";
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "petals":
      ctx.fillStyle = "rgba(255,182,200,0.9)";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function step(p: Particle, effect: Exclude<ParticleEffectKind, "none">, w: number, h: number, t: number) {
  p.x += p.vx;
  p.y += p.vy;
  if (effect === "snow") {
    p.x += Math.sin(t * 0.001 + p.phase) * 0.4 * p.drift;
  } else if (effect === "leaves" || effect === "petals") {
    p.x += Math.sin(t * 0.0015 + p.phase) * 0.5 * p.drift;
    p.rot += p.vr;
  } else if (effect === "diyas") {
    p.x += Math.sin(t * 0.001 + p.phase) * 0.2 * p.drift;
    p.alpha = 0.5 + Math.abs(Math.sin(t * 0.003 + p.phase)) * 0.4;
  }
  if (p.y > h + 20) {
    p.y = -10;
    p.x = Math.random() * w;
  } else if (p.y < -20 && effect === "diyas") {
    p.y = h + 10;
    p.x = Math.random() * w;
  }
  if (p.x < -20) p.x = w + 10;
  if (p.x > w + 20) p.x = -10;
}

export interface RunParticlesOptions {
  effect: Exclude<ParticleEffectKind, "none">;
  width: number;
  height: number;
  countMultiplier?: number;
  respectVisibility?: boolean;
}

export function runParticles(canvas: HTMLCanvasElement, opts: RunParticlesOptions): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2);
  let { width: w, height: h } = opts;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const baseCount = FULL_COUNTS[opts.effect];
  const count = Math.max(4, Math.floor(baseCount * (opts.countMultiplier ?? 1)));
  const particles: Particle[] = Array.from({ length: count }, () => makeParticle(opts.effect, w, h));

  let raf = 0;
  let running = true;
  const loop = (t: number) => {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      step(p, opts.effect, w, h, t);
      drawParticle(ctx, p, opts.effect);
    }
    raf = window.requestAnimationFrame(loop);
  };
  raf = window.requestAnimationFrame(loop);

  let onVis: (() => void) | null = null;
  if (opts.respectVisibility) {
    onVis = () => {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = window.requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);
  }

  return () => {
    running = false;
    window.cancelAnimationFrame(raf);
    if (onVis) document.removeEventListener("visibilitychange", onVis);
    ctx.clearRect(0, 0, w, h);
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
