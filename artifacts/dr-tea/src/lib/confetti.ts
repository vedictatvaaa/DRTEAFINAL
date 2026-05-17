interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  color: string;
  alpha: number;
  rotate: number;
  rotateV: number;
  shape: 'rect' | 'circle';
}

const COLORS = ['#f59e0b', '#fbbf24', '#fde68a', '#1a2416', '#ffffff', '#d97706', '#10b981'];

export function fireConfetti(originX: number, originY: number, count = 110) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const particles: Particle[] = Array.from({ length: count }, () => {
    const angle = (Math.random() * 180 - 90) * (Math.PI / 180);
    const speed = 6 + Math.random() * 10;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
      vy: -(3 + Math.random() * 9),
      r: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      rotate: Math.random() * 360,
      rotateV: (Math.random() - 0.5) * 12,
      shape: Math.random() < 0.6 ? 'rect' : 'circle',
    };
  });

  let frame: number;
  const gravity = 0.35;
  const drag = 0.97;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.vy += gravity;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotate += p.rotateV;
      if (p.y > canvas.height * 0.6) p.alpha -= 0.03;
      if (p.alpha <= 0) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotate * Math.PI) / 180);
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      }
      ctx.restore();
    }
    if (alive) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }

  frame = requestAnimationFrame(draw);
  setTimeout(() => {
    cancelAnimationFrame(frame);
    canvas.remove();
  }, 3500);
}
