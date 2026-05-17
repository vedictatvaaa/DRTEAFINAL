import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Crown,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Check,
  X,
  Timer,
  Leaf,
} from 'lucide-react';

type TeaType = {
  slug: string;
  name: string;
  region: string;
  img: string;
  steepSeconds: number; // ideal
  tempC: number;
  blurb: string;
  tolerance: number;
};

const TEAS: TeaType[] = [
  { slug: 'darjeeling-first-flush', name: 'Darjeeling First Flush', region: 'Darjeeling, India', img: '/images/category-black.webp', steepSeconds: 180, tempC: 85, blurb: 'Delicate muscatel — short, hot, fragrant.', tolerance: 30 },
  { slug: 'sencha',                  name: 'Sencha',                  region: 'Shizuoka, Japan',  img: '/images/category-green.webp', steepSeconds: 60,  tempC: 75, blurb: 'Vegetal & marine — quick steep in cooler water.', tolerance: 20 },
  { slug: 'masala-chai',             name: 'Masala Chai',             region: 'Maharashtra, India', img: '/images/category-chai.webp', steepSeconds: 300, tempC: 100, blurb: 'Boiled with milk + whole spices for body.', tolerance: 60 },
  { slug: 'chamomile',               name: 'Chamomile Tisane',        region: 'Kashmir, India',    img: '/images/category-floral.webp', steepSeconds: 420, tempC: 95, blurb: 'Caffeine-free — let the apples bloom fully.', tolerance: 90 },
  { slug: 'kadha',                   name: 'Tulsi Kadha',             region: 'Uttarakhand, India', img: '/images/category-kadha.webp', steepSeconds: 600, tempC: 100, blurb: 'Boiled like medicine — long simmer, big aroma.', tolerance: 120 },
  { slug: 'silver-needle',           name: 'Silver Needle',           region: 'Assam, India',     img: '/images/category-reserve.webp', steepSeconds: 240, tempC: 80, blurb: 'White bud — gentle water, patient steep.', tolerance: 45 },
];

const FACTS = [
  { k: 'Steeping science', v: 'Above 85 °C, green tea releases bitter catechins. Drop to 75 °C and you get sweetness, not astringency.' },
  { k: 'Origin story',     v: 'Indian chai got its sweet, milky form during the British Raj — to stretch a luxury leaf across a tired commute.' },
  { k: 'Pairing rule',     v: 'A second-flush Darjeeling loves dark chocolate. The muscatel grape note + cocoa fat = velvet on the tongue.' },
  { k: 'Caffeine truth',   v: 'A cup of black tea has roughly half the caffeine of brewed coffee — and the L-theanine in tea can soften the jitter into a calmer alertness.' },
  { k: 'Storage tip',      v: 'Tea hates four things: light, air, heat, moisture. An opaque tin in a cool cupboard keeps it singing for a year.' },
  { k: 'Water matters',    v: 'Soft, low-mineral water lets aroma compounds shine. Hard tap water mutes a great tea into a flat one.' },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function CinematicHero() {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden bg-[#0f1612] text-white">
      <div className="absolute inset-0 opacity-[0.35]" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_#3a5a2c_0%,_transparent_55%),radial-gradient(circle_at_75%_80%,_#7B5FA0_0%,_transparent_55%)]" />
      </div>
      {/* Animated steam ribbons (static when reduced-motion is on) */}
      <svg className="absolute left-1/2 -translate-x-1/2 top-6 w-56 h-40 opacity-30 mix-blend-screen" viewBox="0 0 200 140" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i}
            d={`M${70 + i * 30} 130 C ${60 + i * 30} 95, ${85 + i * 30} 70, ${70 + i * 30} 40 S ${60 + i * 30} 10, ${70 + i * 30} 0`}
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 0.35 : 0 }}
            animate={reduce ? { opacity: 0.35 } : { pathLength: 1, opacity: [0, 0.6, 0] }}
            transition={reduce ? { duration: 0 } : { duration: 4.5, delay: i * 0.7, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </svg>
      {/* Teapot SVG */}
      <svg className="absolute left-1/2 -translate-x-1/2 top-32 w-32 h-16 opacity-90" viewBox="0 0 120 60" aria-hidden="true">
        <ellipse cx="60" cy="42" rx="40" ry="14" fill="#3a5a2c" />
        <rect x="20" y="30" width="80" height="14" rx="4" fill="#3a5a2c" />
        <path d="M100 36 q12 0 12 -10" stroke="#3a5a2c" strokeWidth="6" fill="none" strokeLinecap="round" />
        <ellipse cx="60" cy="30" rx="40" ry="6" fill="#2c4422" />
        <circle cx="60" cy="26" r="3" fill="#fbbf24" />
      </svg>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 pt-14 pb-20 sm:pt-20 sm:pb-28 text-center">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-[10px] uppercase tracking-[0.32em] text-amber-200/80 font-bold mb-4 mt-28"
        >
          Your cup is empty
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-4 max-w-2xl mx-auto"
        >
          Let&rsquo;s <span className="italic text-amber-200">brew</span> the next one.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="text-[13.5px] sm:text-base text-white/70 max-w-xl mx-auto leading-relaxed mb-7"
        >
          While you&rsquo;re here — play a quick steep-time game, time a real brew, or pick up a bit of tea-lore. Then we&rsquo;ll find you something worth pouring.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/shop" className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-200 text-[#0f1612] px-6 py-3.5 rounded-md text-[12px] font-bold uppercase tracking-[0.18em] transition-colors">
            Explore teas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/quiz" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 ring-1 ring-white/20 text-white px-6 py-3.5 rounded-md text-[12px] font-bold uppercase tracking-[0.18em] transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> 60-sec quiz
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ── Steep Sense game ────────────────────────────────────────────────────────
function SteepSenseGame() {
  const rounds = useMemo(() => {
    const shuffled = [...TEAS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState(120);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [perfect, setPerfect] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = rounds[idx]!;
  const diff = Math.abs(guess - current.steepSeconds);
  const close = diff <= current.tolerance;
  const pts = revealed ? Math.max(0, 100 - Math.round((diff / current.steepSeconds) * 100)) : 0;

  const lockGuess = () => {
    if (revealed) return;
    setRevealed(true);
    setScore((s) => s + Math.max(0, 100 - Math.round((diff / current.steepSeconds) * 100)));
    if (close) setPerfect((p) => p + 1);
  };

  const next = () => {
    if (idx + 1 < rounds.length) {
      setIdx(idx + 1);
      setGuess(120);
      setRevealed(false);
    } else {
      setFinished(true);
    }
  };

  const reset = () => {
    setIdx(0);
    setGuess(120);
    setRevealed(false);
    setScore(0);
    setPerfect(0);
    setFinished(false);
  };

  return (
    <div className="bg-white border border-[#1a2416]/10 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-[#FAF8F4] border-b border-[#1a2416]/8">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.28em] font-bold text-[#3a5a2c]">Mini game</p>
          <p className="font-serif text-lg text-[#1a2416] leading-tight">Steep Sense</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1a2416]/65 tabular-nums">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          {score} pts · {idx + (finished ? 1 : 0)}/{rounds.length}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {finished ? (
          <motion.div
            key="finish"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-5 sm:px-8 py-8 text-center"
          >
            <div className="inline-flex w-14 h-14 rounded-full bg-amber-100 text-amber-700 items-center justify-center mb-3">
              <Trophy className="w-7 h-7" />
            </div>
            <p className="font-serif text-2xl text-[#1a2416] mb-1">
              {perfect === rounds.length ? 'Brewmaster.' : perfect >= 2 ? 'Sharp palate.' : 'Steeping in progress…'}
            </p>
            <p className="text-[13px] text-[#1a2416]/65 mb-5">
              You scored <span className="font-bold text-[#1a2416] tabular-nums">{score}</span> / {rounds.length * 100} —{' '}
              {perfect}/{rounds.length} within the perfect window.
            </p>

            {perfect === rounds.length ? (
              <div className="bg-[#0f1612] text-amber-100 rounded-lg px-5 py-4 mb-5 max-w-sm mx-auto">
                <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80 font-bold mb-1">Reward unlocked</p>
                <p className="font-serif text-xl tracking-wider">STEEP10</p>
                <p className="text-[11px] text-amber-100/70 mt-1">10% off your first order — apply at checkout.</p>
              </div>
            ) : (
              <p className="text-[12px] text-[#1a2416]/55 italic mb-5">
                Get all 3 within the perfect window to unlock a discount code.
              </p>
            )}

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 bg-white border border-[#1a2416]/15 hover:border-[#1a2416]/35 text-[#1a2416] px-4 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Play again
              </button>
              <Link href="/shop" className="inline-flex items-center gap-1.5 bg-[#1a2416] hover:bg-[#0e1810] text-amber-100 px-4 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]">
                Shop the teas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`round-${idx}-${revealed ? 'r' : 'q'}`}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5 px-5 sm:px-6 py-5"
          >
            <div className="aspect-square md:aspect-auto md:h-full rounded-lg overflow-hidden bg-[#1a2416]/5 relative">
              <img src={current.img} alt={current.name} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2">
                <p className="text-white text-[10px] uppercase tracking-widest font-semibold">{current.region}</p>
              </div>
            </div>

            <div>
              <p className="font-serif text-xl text-[#1a2416] leading-tight mb-1">{current.name}</p>
              <p className="text-[12px] text-[#1a2416]/65 mb-4">{current.blurb} · Water: {current.tempC} °C</p>

              <div className="mb-3">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-[#1a2416]/60">Your steep time</span>
                  <span className="font-serif text-2xl tabular-nums text-[#1a2416]">{fmt(guess)}</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={720}
                  step={15}
                  value={guess}
                  onChange={(e) => setGuess(Number(e.target.value))}
                  disabled={revealed}
                  className="w-full accent-[#3a5a2c] disabled:opacity-60"
                  aria-label={`Steep time for ${current.name}`}
                />
                <div className="flex justify-between text-[10px] text-[#1a2416]/45 tabular-nums mt-1">
                  <span>0:30</span><span>6:00</span><span>12:00</span>
                </div>
              </div>

              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-md border px-3.5 py-3 mb-3 ${close ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {close ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    <p className="text-[11px] uppercase tracking-widest font-bold">
                      {close ? 'Perfect window' : 'Off the mark'} · {pts} pts
                    </p>
                  </div>
                  <p className="text-[12.5px] leading-snug">
                    Ideal steep is <span className="font-bold tabular-nums">{fmt(current.steepSeconds)}</span>.
                    {diff > 0 && <> You guessed {diff > current.tolerance ? 'far' : 'close'} — {diff > 0 ? (guess > current.steepSeconds ? 'a touch long' : 'a touch short') : 'exact'}.</>}
                  </p>
                </motion.div>
              )}

              <div className="flex justify-end gap-2">
                {!revealed ? (
                  <button
                    type="button"
                    onClick={lockGuess}
                    className="inline-flex items-center gap-1.5 bg-[#1a2416] hover:bg-[#0e1810] text-amber-100 px-5 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
                  >
                    Lock guess
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={next}
                    className="inline-flex items-center gap-1.5 bg-[#3a5a2c] hover:bg-[#2c4422] text-white px-5 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
                  >
                    {idx + 1 < rounds.length ? 'Next tea' : 'See result'} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Brew Timer ──────────────────────────────────────────────────────────────
const TIMER_PRESETS: { key: string; label: string; sec: number; temp: number }[] = [
  { key: 'green',   label: 'Green',   sec: 90,  temp: 75 },
  { key: 'black',   label: 'Black',   sec: 240, temp: 95 },
  { key: 'floral',  label: 'Floral',  sec: 420, temp: 95 },
  { key: 'chai',    label: 'Chai',    sec: 300, temp: 100 },
  { key: 'kadha',   label: 'Kadha',   sec: 600, temp: 100 },
  { key: 'reserve', label: 'Reserve', sec: 180, temp: 80 },
];

function BrewTimer() {
  const reduce = useReducedMotion();
  const [preset, setPreset] = useState(TIMER_PRESETS[0]!);
  const [remaining, setRemaining] = useState(TIMER_PRESETS[0]!.sec);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    setRemaining(preset.sec);
    setRunning(false);
    setDone(false);
  }, [preset]);

  useEffect(() => {
    if (!running) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      return;
    }
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          setDone(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running]);

  const pct = preset.sec === 0 ? 0 : ((preset.sec - remaining) / preset.sec);
  const radius = 60;
  const C = 2 * Math.PI * radius;
  const dash = C * pct;

  const start = useCallback(() => {
    if (done) {
      setRemaining(preset.sec);
      setDone(false);
    }
    setRunning(true);
  }, [done, preset.sec]);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(preset.sec);
    setDone(false);
  }, [preset.sec]);

  return (
    <div className="bg-white border border-[#1a2416]/10 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-[#FAF8F4] border-b border-[#1a2416]/8">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.28em] font-bold text-[#3a5a2c]">Useful tool</p>
          <p className="font-serif text-lg text-[#1a2416] leading-tight">Brew timer</p>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-[#1a2416]/55 font-semibold flex items-center gap-1">
          <Timer className="w-3 h-3" /> Water {preset.temp} °C
        </div>
      </div>

      <div className="px-5 sm:px-6 py-6 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-5 items-center">
        <div className="relative w-[160px] h-[160px] mx-auto">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle cx="70" cy="70" r={radius} stroke="#1a2416" strokeOpacity="0.08" strokeWidth="6" fill="none" />
            <motion.circle
              cx="70"
              cy="70"
              r={radius}
              stroke="#3a5a2c"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={C}
              strokeDashoffset={C - dash}
              animate={done && !reduce ? { stroke: ['#3a5a2c', '#fbbf24', '#3a5a2c'] } : { stroke: done ? '#fbbf24' : '#3a5a2c' }}
              transition={done && !reduce ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" role="status" aria-live="polite" aria-atomic="true">
            <p className="font-serif text-3xl tabular-nums text-[#1a2416]">{fmt(remaining)}</p>
            <p className="text-[9px] uppercase tracking-widest text-[#1a2416]/45 font-semibold mt-0.5">
              {done ? 'Ready to pour' : running ? 'Steeping' : 'Standing by'}
            </p>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {TIMER_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p)}
                aria-pressed={preset.key === p.key}
                className={`text-[11px] font-semibold py-2 rounded-md transition-colors ${
                  preset.key === p.key
                    ? 'bg-[#1a2416] text-amber-100'
                    : 'bg-[#FAF8F4] text-[#1a2416]/70 hover:bg-[#1a2416]/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {!running ? (
              <button
                type="button"
                onClick={start}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#3a5a2c] hover:bg-[#2c4422] text-white px-4 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
              >
                <Play className="w-3.5 h-3.5" /> {done ? 'Brew again' : 'Start'}
              </button>
            ) : (
              <button
                type="button"
                onClick={pause}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-300 hover:bg-amber-200 text-[#1a2416] px-4 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-[#1a2416]/15 hover:border-[#1a2416]/35 text-[#1a2416] px-3.5 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.16em]"
              aria-label="Reset timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {done && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11.5px] text-emerald-700 font-semibold mt-3 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Pour now — peak aroma window.
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Did You Know carousel ───────────────────────────────────────────────────
function TeaTrivia() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reduce) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % FACTS.length), 5000);
    return () => window.clearInterval(t);
  }, [paused, reduce]);

  const f = FACTS[i]!;
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Tea facts"
      className="relative bg-gradient-to-br from-[#1a2416] to-[#2c4422] text-white rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-amber-300/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative px-5 sm:px-7 py-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-300/15 text-amber-200 flex items-center justify-center">
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <p className="text-[9.5px] uppercase tracking-[0.28em] font-bold text-amber-200/80">Did you know</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            role="group"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Fact ${i + 1} of ${FACTS.length}: ${f.k}`}
          >
            <p className="text-[11px] uppercase tracking-widest text-amber-200/70 font-semibold mb-1.5">{f.k}</p>
            <p className="font-serif text-xl sm:text-2xl leading-snug text-white">&ldquo;{f.v}&rdquo;</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1.5">
            {FACTS.map((_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setI(n)}
                aria-label={`Go to fact ${n + 1}`}
                className={`h-1 rounded-full transition-all ${n === i ? 'w-6 bg-amber-300' : 'w-2 bg-white/25 hover:bg-white/40'}`}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setI((n) => (n - 1 + FACTS.length) % FACTS.length)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Previous fact"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setI((n) => (n + 1) % FACTS.length)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Next fact"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Closing CTA strip ───────────────────────────────────────────────────────
function ClosingStrip() {
  return (
    <section className="bg-white border-y border-[#1a2416]/8">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/quiz" className="group bg-[#FAF8F4] rounded-xl px-5 py-5 hover:bg-[#1a2416]/[0.04] transition-colors">
          <Sparkles className="w-5 h-5 text-[#3a5a2c] mb-2" />
          <p className="font-serif text-lg text-[#1a2416] leading-tight mb-1">Find your tea ritual</p>
          <p className="text-[12px] text-[#1a2416]/65">A 60-second quiz that matches you to your perfect daily cup.</p>
          <p className="text-[10.5px] uppercase tracking-widest text-[#3a5a2c] font-bold mt-3 inline-flex items-center gap-1">Start quiz <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></p>
        </Link>
        <Link href="/teapedia" className="group bg-[#FAF8F4] rounded-xl px-5 py-5 hover:bg-[#1a2416]/[0.04] transition-colors">
          <Leaf className="w-5 h-5 text-[#3a5a2c] mb-2" />
          <p className="font-serif text-lg text-[#1a2416] leading-tight mb-1">Teapedia</p>
          <p className="text-[12px] text-[#1a2416]/65">A library of teas, terroirs, and brewing techniques.</p>
          <p className="text-[10.5px] uppercase tracking-widest text-[#3a5a2c] font-bold mt-3 inline-flex items-center gap-1">Browse <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></p>
        </Link>
        <Link href="/tea-pass" className="group bg-gradient-to-br from-amber-50 to-amber-100/60 rounded-xl px-5 py-5 hover:from-amber-100 transition-colors ring-1 ring-amber-300/40">
          <Crown className="w-5 h-5 text-amber-700 mb-2" />
          <p className="font-serif text-lg text-[#1a2416] leading-tight mb-1">Tea Pass · ₹6,000/yr</p>
          <p className="text-[12px] text-[#1a2416]/65">Unlimited tea for a household of two — pick any 2 categories.</p>
          <p className="text-[10.5px] uppercase tracking-widest text-amber-800 font-bold mt-3 inline-flex items-center gap-1">Reserve <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></p>
        </Link>
      </div>
    </section>
  );
}

// ── Public component ────────────────────────────────────────────────────────
export default function EmptyCartCinematic() {
  return (
    <div className="bg-[#FAF8F4]">
      <CinematicHero />
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SteepSenseGame />
          <BrewTimer />
        </div>
        <div className="mt-5">
          <TeaTrivia />
        </div>
      </section>
      <ClosingStrip />
    </div>
  );
}
