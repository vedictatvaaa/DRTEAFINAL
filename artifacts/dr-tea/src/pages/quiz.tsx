import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Plus,
  Play,
  Pause,
  X as XIcon,
  Star,
  Clock,
  Thermometer,
  Leaf,
  BookOpen,
  ChefHat,
  Trophy,
  ShoppingBag,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { useProducts, useArticles } from '@/lib/api-data';
import { useRecipes } from '@/lib/recipes-data';
import { useTeapedia } from '@/lib/teapedia-data';
import { useStore } from '@/store/use-store';
import Seo from '@/components/Seo';
import { formatPrice } from '@/lib/currency';
import type { CurrencyCode } from '@/lib/currency';
import type { Product } from '@/data/products';

// ──────────────────────────────────────────────────────────────────────────
// Quiz definition — 4 steps with iconography for the story-mode visuals
// ──────────────────────────────────────────────────────────────────────────

type CaffeineKey = 'none' | 'low' | 'medium' | 'high';
type MoodKey = 'calm' | 'focus' | 'comfort' | 'wellness';
type StyleKey = 'Loose Leaf' | 'Stovetop' | 'Infuser' | 'Cold Brew';
type TimeKey = 'morning' | 'afternoon' | 'evening' | 'night';

type AnswerKey = 'caffeine' | 'mood' | 'style' | 'time';
type Answers = Partial<Record<AnswerKey, string>>;

interface QuizOption {
  label: string;
  value: string;
  hint?: string;
  Icon?: typeof Sparkles;
}

interface QuizStep {
  key: AnswerKey;
  title: string;
  sub: string;
  /** A short narrator line shown only in story mode. */
  narrator: string;
  /** Background gradient for story mode slides. */
  storyBg: string;
  options: QuizOption[];
}

const steps: QuizStep[] = [
  {
    key: 'caffeine',
    title: 'How much caffeine do you want?',
    sub: 'Pick the energy level your body wants right now.',
    narrator: 'First — the lift. Where do you want to land on the energy curve?',
    storyBg: 'linear-gradient(135deg, #1a2416 0%, #3a5a2c 65%, #b89c4d 100%)',
    options: [
      { label: 'None — pure calm',  value: 'none',   hint: '0 mg · herbal & floral', Icon: Leaf },
      { label: 'A gentle lift',      value: 'low',    hint: '15–30 mg · soft greens', Icon: Sunrise },
      { label: 'Steady focus',       value: 'medium', hint: '40–60 mg · oolongs',     Icon: Sun },
      { label: 'Full power',         value: 'high',   hint: '70–90 mg · black & chai', Icon: Sparkles },
    ],
  },
  {
    key: 'mood',
    title: 'What mood are you brewing for?',
    sub: 'Your ritual should match the moment.',
    narrator: 'Now — the mood. What is this cup for?',
    storyBg: 'linear-gradient(135deg, #2d1a3a 0%, #5a2c4f 60%, #d4af37 100%)',
    options: [
      { label: 'Relax & unwind',    value: 'calm',     hint: 'Lavender · chamomile', Icon: Moon },
      { label: 'Sharpen focus',     value: 'focus',    hint: 'Matcha · sencha',      Icon: Sparkles },
      { label: 'Comfort & warmth',  value: 'comfort',  hint: 'Masala chai · oolong', Icon: Sun },
      { label: 'Immunity & wellness', value: 'wellness', hint: 'Kadha · tulsi',      Icon: Leaf },
    ],
  },
  {
    key: 'style',
    title: 'How do you brew?',
    sub: "We'll match your daily tea style.",
    narrator: 'How do you actually make tea? Be honest with yourself.',
    storyBg: 'linear-gradient(135deg, #1f3a1f 0%, #5b7e3a 60%, #f3e6c4 100%)',
    options: [
      { label: 'Loose leaf, slow ritual', value: 'Loose Leaf', hint: '5–10 min ceremony',  Icon: Leaf },
      { label: 'Stovetop boiling',        value: 'Stovetop',   hint: 'Indian masala way', Icon: ChefHat },
      { label: 'Quick infuser',           value: 'Infuser',    hint: 'Bag or basket',     Icon: Clock },
      { label: 'Iced or cold brew',       value: 'Cold Brew',  hint: 'Slow extraction',   Icon: Thermometer },
    ],
  },
  {
    key: 'time',
    title: 'When does this cup happen?',
    sub: 'We tune the ritual to your time of day.',
    narrator: 'And finally — when. Every hour has its own tea.',
    storyBg: 'linear-gradient(135deg, #3a2616 0%, #b8743a 60%, #f7d589 100%)',
    options: [
      { label: 'Morning · 6–10am',  value: 'morning',   hint: 'Wake-up ritual', Icon: Sunrise },
      { label: 'Afternoon · 12–4pm', value: 'afternoon', hint: 'Reset & focus',  Icon: Sun },
      { label: 'Evening · 5–8pm',    value: 'evening',   hint: 'Wind down',      Icon: Sunset },
      { label: 'Night · 9pm+',       value: 'night',     hint: 'Sleep tonic',    Icon: Moon },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Recommendation engine — deterministic, scored
// ──────────────────────────────────────────────────────────────────────────

const moodToTags: Record<MoodKey, string[]> = {
  calm:     ['relaxing', 'soothing', 'evening', 'calming', 'sleepy', 'dreamy'],
  focus:    ['energizing', 'focus', 'morning', 'invigorating'],
  comfort:  ['comforting', 'warming', 'cozy'],
  wellness: ['healing', 'immunity', 'restorative', 'magical'],
};

const timeToCaffeine: Record<TimeKey, CaffeineKey[]> = {
  morning:   ['high', 'medium'],
  afternoon: ['medium', 'low'],
  evening:   ['low', 'none'],
  night:     ['none'],
};

interface ScoredProduct {
  product: Product;
  score: number;
  reasons: string[];
}

function scoreProducts(products: Product[], answers: Answers): ScoredProduct[] {
  const caffeine = answers.caffeine as CaffeineKey | undefined;
  const mood     = answers.mood as MoodKey | undefined;
  const style    = answers.style as StyleKey | undefined;
  const time     = answers.time as TimeKey | undefined;
  const moodTags = mood ? moodToTags[mood] : [];

  return products.map((p) => {
    const reasons: string[] = [];
    let score = 0;
    if (caffeine && p.caffeineLevel === caffeine) {
      score += 4;
      reasons.push(`${caffeine === 'none' ? 'Caffeine-free' : `${caffeine} caffeine`} match`);
    }
    if (style && p.brewingType.toLowerCase().includes(style.toLowerCase())) {
      score += 2;
      reasons.push(`${style} brewing`);
    }
    if (mood && moodTags.some((t) => p.moodTags.some((m) => m.toLowerCase().includes(t)))) {
      score += 3;
      reasons.push(`${mood.charAt(0).toUpperCase() + mood.slice(1)}-mood blend`);
    }
    if (time && p.caffeineLevel) {
      const ok = timeToCaffeine[time].includes(p.caffeineLevel as CaffeineKey);
      if (ok) {
        score += 2;
        reasons.push(`${time.charAt(0).toUpperCase() + time.slice(1)}-friendly`);
      }
    }
    score += (p.rating - 4);
    return { product: p, score, reasons };
  });
}

function pickRecommendations(products: Product[], answers: Answers, limit = 3): ScoredProduct[] {
  return scoreProducts(products, answers)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ──────────────────────────────────────────────────────────────────────────
// Quiz mode controller
// ──────────────────────────────────────────────────────────────────────────

type Mode = 'select' | 'classic' | 'story' | 'results';

export default function Quiz() {
  const [mode, setMode] = useState<Mode>('select');
  const [answers, setAnswers] = useState<Answers>({});
  const { products } = useProducts();

  const recs = useMemo(
    () => (mode === 'results' ? pickRecommendations(products, answers, 3) : []),
    [mode, products, answers],
  );

  const reset = useCallback(() => {
    setAnswers({});
    setMode('select');
  }, []);

  const finish = useCallback((next: Answers) => {
    setAnswers(next);
    setMode('results');
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="Tea Finder Quiz — Story Mode + A+ Ritual Modules | Dr Tea"
        description="Take our 60-second tea finder quiz in classic or full-screen story mode. Get a personalised ritual with rich A+ modules: comparison table, brewing timeline, recipes that pair, and journal stories that go deeper."
        canonical="https://drtea.in/quiz"
        keywords={[
          'tea quiz',
          'tea finder',
          'best tea for me',
          'find my tea ritual',
          'Dr Tea quiz',
          'interactive tea quiz',
          'tea story mode',
        ]}
      />

      {mode === 'select' && <ModeSelector onPick={setMode} />}
      {mode === 'classic' && (
        <ClassicQuiz
          initialAnswers={answers}
          onCancel={reset}
          onFinish={finish}
        />
      )}
      {mode === 'story' && (
        <StoryQuiz
          onClose={reset}
          onFinish={finish}
        />
      )}
      {mode === 'results' && (
        <ResultsView
          answers={answers}
          recommendations={recs}
          onRetake={reset}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 0. Mode selector — landing card, choose Classic vs Story
// ──────────────────────────────────────────────────────────────────────────

function ModeSelector({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 max-w-4xl">
      <div className="text-center mb-10">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold mb-2 inline-flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Tea Finder
        </p>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold mb-3">Find Your Ritual</h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Four questions, one bespoke ritual. Pick how you want to take it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <button
          onClick={() => onPick('classic')}
          className="group relative overflow-hidden rounded-3xl border border-border bg-card p-7 text-left transition-all hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 flex items-center justify-center mb-5">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-2">Classic Quiz</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Four quick questions on a single page. Tap, get matched, see all the modules side-by-side.
          </p>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground">
            Start the quiz <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </button>

        <button
          onClick={() => onPick('story')}
          className="group relative overflow-hidden rounded-3xl border border-transparent text-white p-7 text-left transition-all hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          style={{ background: 'linear-gradient(135deg, #1a2416 0%, #3a5a2c 60%, #b89c4d 100%)' }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,#d4af37_0%,transparent_45%),radial-gradient(circle_at_75%_70%,#5a2c4f_0%,transparent_45%)]"
          />
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-amber-200 text-[#1a2416] flex items-center justify-center mb-5">
              <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-200 text-[#1a2416] mb-3">
              <Sparkles className="w-3 h-3" /> NEW
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-2">Story Mode</h2>
            <p className="text-sm text-white/80 mb-6 leading-relaxed">
              Full-screen, vertical storytelling. Tap to advance, hold to pause — like a tea-leaf cinema reel.
            </p>
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              Begin the journey <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground mt-8">
        ~60 seconds · {steps.length} questions · personalised ritual + brewing guide
      </p>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Classic quiz — single column with progress bar
// ──────────────────────────────────────────────────────────────────────────

function ClassicQuiz({
  initialAnswers,
  onCancel,
  onFinish,
}: {
  initialAnswers: Answers;
  onCancel: () => void;
  onFinish: (a: Answers) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);

  const current = steps[step];
  const progressPct = ((step) / steps.length) * 100;

  const handlePick = (value: string) => {
    if (!current) return;
    const next: Answers = { ...answers, [current.key]: value };
    setAnswers(next);
    if (step + 1 >= steps.length) {
      onFinish(next);
    } else {
      setStep(step + 1);
    }
  };

  if (!current) return null;

  return (
    <section className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 max-w-2xl">
      <div className="flex items-center justify-between mb-6 gap-3">
        <button
          onClick={onCancel}
          className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Exit quiz
        </button>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Step {step + 1} of {steps.length}
        </p>
      </div>

      <div className="h-1 bg-muted rounded-full overflow-hidden mb-10">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: `${progressPct}%` }}
          animate={{ width: `${progressPct + 100 / steps.length}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm"
        >
          <h2 className="text-xl sm:text-2xl font-serif font-semibold mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground mb-6">{current.sub}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {current.options.map((opt) => {
              const Icon = opt.Icon ?? Sparkles;
              const selected = answers[current.key] === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handlePick(opt.value)}
                  className={`text-left px-4 py-4 border rounded-xl transition-all min-h-[68px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] flex items-start gap-3 ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  <span className="w-9 h-9 shrink-0 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium leading-tight">{opt.label}</span>
                    {opt.hint && (
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{opt.hint}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Story Mode — full-screen, Instagram-stories style
// ──────────────────────────────────────────────────────────────────────────

const STORY_DURATION_MS = 7000;

function StoryQuiz({
  onClose,
  onFinish,
}: {
  onClose: () => void;
  onFinish: (a: Answers) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number>(Date.now());
  const elapsedBefore = useRef<number>(0);
  const pickTimeoutRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const stepRef = useRef(step);
  const answersRef = useRef<Answers>(answers);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => () => {
    closedRef.current = true;
    if (pickTimeoutRef.current !== null) {
      window.clearTimeout(pickTimeoutRef.current);
      pickTimeoutRef.current = null;
    }
  }, []);

  const current = steps[step];

  // Auto-advance timer
  useEffect(() => {
    if (!current || answers[current.key]) return;
    if (paused) return;
    startedAt.current = Date.now();
    const tick = setInterval(() => {
      const elapsed = elapsedBefore.current + (Date.now() - startedAt.current);
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(tick);
        // No selection: still advance, leaving answer undefined for that step.
        advance();
      }
    }, 50);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paused]);

  // Reset progress when step changes
  useEffect(() => {
    setProgress(0);
    elapsedBefore.current = 0;
    startedAt.current = Date.now();
  }, [step]);

  // Pause/resume bookkeeping
  useEffect(() => {
    if (paused) {
      elapsedBefore.current += Date.now() - startedAt.current;
    } else {
      startedAt.current = Date.now();
    }
  }, [paused]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowRight') advance();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, answers]);

  function advance() {
    if (step + 1 >= steps.length) {
      onFinish(answers);
    } else {
      setStep(step + 1);
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function pick(value: string) {
    if (!current) return;
    const next: Answers = { ...answers, [current.key]: value };
    setAnswers(next);
    if (pickTimeoutRef.current !== null) {
      window.clearTimeout(pickTimeoutRef.current);
    }
    // Brief delay so the user sees their selection animate before advancing.
    pickTimeoutRef.current = window.setTimeout(() => {
      pickTimeoutRef.current = null;
      if (closedRef.current) return;
      const cur = stepRef.current;
      if (cur + 1 >= steps.length) onFinish(next);
      else setStep(cur + 1);
    }, 350);
  }

  function handleClose() {
    closedRef.current = true;
    if (pickTimeoutRef.current !== null) {
      window.clearTimeout(pickTimeoutRef.current);
      pickTimeoutRef.current = null;
    }
    onClose();
  }

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Tea finder story mode"
    >
      <div
        className="relative w-full h-full sm:max-w-md sm:h-[min(900px,95vh)] sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: current.storyBg }}
      >
        {/* Decorative texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25)_0%,transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,0,0,0.35)_0%,transparent_50%)]"
        />

        {/* Top: progress bars + controls */}
        <div className="absolute top-0 inset-x-0 z-20 px-3 pt-3">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white transition-[width] duration-100 ease-linear"
                  style={{
                    width:
                      i < step ? '100%' : i === step ? `${progress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-white/85">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Dr Tea · Story Mode
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute narrator' : 'Mute narrator'}
                className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? 'Resume' : 'Pause'}
                className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center"
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={handleClose}
                aria-label="Close story mode"
                className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Slide content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 h-full flex flex-col px-6 sm:px-7 pt-20 pb-32 text-white"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-3">
              Question {step + 1} of {steps.length}
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl leading-tight mb-3">
              {current.title}
            </h2>
            <p className="text-[14px] text-white/75 italic leading-relaxed mb-6">
              "{current.narrator}"
            </p>

            <div className="flex-1" />

            <div className="space-y-2.5">
              {current.options.map((opt, i) => {
                const Icon = opt.Icon ?? Sparkles;
                const selected = answers[current.key] === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => pick(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border backdrop-blur-md transition-all flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                      selected
                        ? 'bg-amber-200 text-[#1a2416] border-amber-200'
                        : 'bg-white/10 border-white/25 hover:bg-white/15'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                        selected ? 'bg-[#1a2416] text-amber-200' : 'bg-white/20'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold leading-tight">{opt.label}</span>
                      {opt.hint && (
                        <span
                          className={`block text-[11px] mt-0.5 ${
                            selected ? 'text-[#1a2416]/70' : 'text-white/65'
                          }`}
                        >
                          {opt.hint}
                        </span>
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Tap zones for navigation (left = back, right = next) */}
        {/* Decorative tap-to-navigate zones; the on-screen control buttons
            (back/advance via answer selection) and keyboard arrows are the
            real a11y surface. */}
        <button
          onClick={back}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute left-0 top-16 bottom-44 w-1/4 z-0 outline-none"
        />
        <button
          onClick={advance}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute right-0 top-16 bottom-44 w-1/4 z-0 outline-none"
        />

        {/* Bottom hint */}
        <p className="absolute bottom-3 inset-x-0 text-center text-[10px] uppercase tracking-widest text-white/55 z-10">
          Tap edges to navigate · space to pause · esc to exit
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Results View — A+ modules
// ──────────────────────────────────────────────────────────────────────────

function ResultsView({
  answers,
  recommendations,
  onRetake,
}: {
  answers: Answers;
  recommendations: ScoredProduct[];
  onRetake: () => void;
}) {
  const top = recommendations[0]?.product;
  const { addToCart } = useStore();
  const currency = useStore((s) => s.currency);

  // Smoothly scroll to top on mount so the user sees the hero
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!top || recommendations.length === 0) {
    return (
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-xl text-center">
        <p className="text-sm text-muted-foreground mb-6">
          We couldn't find a perfect match — try the quiz again with different answers.
        </p>
        <button
          onClick={onRetake}
          className="px-5 py-3 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider rounded-sm"
        >
          Retake quiz
        </button>
      </section>
    );
  }

  const stackTotal = recommendations.reduce((s, r) => s + r.product.price, 0);

  return (
    <div>
      <HeroPickModule
        scored={recommendations[0]!}
        currency={currency}
        onAdd={() => {
          const v = top.variants?.[0];
          if (v) addToCart(top, v);
        }}
        answers={answers}
      />

      <ComparisonTableModule
        recommendations={recommendations}
        currency={currency}
      />

      <RitualTimelineModule product={top} />

      <BundleStackModule
        recommendations={recommendations}
        currency={currency}
        total={stackTotal}
        onAddAll={() => {
          recommendations.forEach((r) => {
            const v = r.product.variants?.[0];
            if (v) addToCart(r.product, v);
          });
        }}
      />

      <PairingsModule productId={top.id} />

      <RelatedReadsModule answers={answers} top={top} />

      <ContinueJourneyModule answers={answers} />

      <section className="container mx-auto px-4 sm:px-6 py-10 max-w-3xl">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Want a different ritual? Retake the quiz, or share your match with a friend.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onRetake}
              className="px-4 py-2.5 border border-border text-[11px] font-bold uppercase tracking-wider rounded-sm hover:border-primary hover:text-primary transition-colors"
            >
              Retake quiz
            </button>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-primary/90 transition-colors"
            >
              Browse all teas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A+ Module 1 — Hero pick
// ──────────────────────────────────────────────────────────────────────────

function HeroPickModule({
  scored,
  currency,
  onAdd,
  answers,
}: {
  scored: ScoredProduct;
  currency: CurrencyCode;
  onAdd: () => void;
  answers: Answers;
}) {
  const { product, reasons } = scored;
  const theme = product.categoryTheme;
  return (
    <section
      className="px-4 sm:px-8 py-12 sm:py-20 relative overflow-hidden"
      style={{ background: theme.gradient }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] px-3 py-1.5 rounded-full bg-[#1a2416] text-amber-200 mb-4">
            <Trophy className="w-3 h-3" /> Your #1 match
          </div>
          <p className="text-[11px] uppercase tracking-widest text-foreground/55 mb-2">
            {product.category} · {product.origin}
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-foreground leading-tight mb-4">
            {product.name}
          </h2>
          <p className="text-base text-foreground/75 leading-relaxed mb-5 max-w-xl">
            {product.shortDescription}
          </p>

          <ul className="space-y-1.5 mb-6">
            {reasons.map((r) => (
              <li
                key={r}
                className="inline-flex items-center gap-2 text-[12.5px] text-foreground/80 mr-2 mb-1 px-2.5 py-1 rounded-full bg-white/55 backdrop-blur-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {r}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#1a2416] text-amber-100 text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-[#0f1810] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
            >
              <Plus className="w-3.5 h-3.5" /> Add to cart · {formatPrice(product.price, currency)}
            </button>
            <Link
              href={`/product/${product.slug}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/70 hover:text-foreground"
            >
              Full product story <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-4 text-[11px] text-foreground/70">
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {product.rating.toFixed(1)} · {product.reviewCount} reviews
            </span>
            <span className="inline-flex items-center gap-1">
              <Leaf className="w-3.5 h-3.5" /> {product.caffeineLevel} caffeine
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl bg-white">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl px-4 py-3 max-w-[60%]">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
              Brewing time
            </p>
            <p className="font-serif text-xl text-foreground tabular-nums">
              {product.brewingGuide.steepTime}
            </p>
          </div>
          <div className="absolute -top-4 -right-4 bg-[#1a2416] text-amber-100 rounded-2xl shadow-xl px-4 py-3 max-w-[55%]">
            <p className="text-[10px] uppercase tracking-widest text-amber-200/70 mb-0.5">
              Match score
            </p>
            <p className="font-serif text-xl text-amber-100 tabular-nums">
              {Math.min(100, Math.round((scored.score / 12) * 100))}%
            </p>
          </div>
        </motion.div>
      </div>

      {/* Quiz answer summary chip rail */}
      <div className="max-w-6xl mx-auto mt-10 flex flex-wrap gap-2 relative z-10">
        {(Object.entries(answers) as [AnswerKey, string][]).map(([k, v]) => {
          const stepDef = steps.find((s) => s.key === k);
          const opt = stepDef?.options.find((o) => o.value === v);
          if (!opt) return null;
          return (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-white/70 text-foreground/75 backdrop-blur-sm border border-white/40"
            >
              <span className="uppercase tracking-wider text-[9px] font-bold text-foreground/50">{k}</span>
              <span className="font-medium">{opt.label}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A+ Module 2 — Comparison table
// ──────────────────────────────────────────────────────────────────────────

function ComparisonTableModule({
  recommendations,
  currency,
}: {
  recommendations: ScoredProduct[];
  currency: CurrencyCode;
}) {
  if (recommendations.length < 2) return null;
  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white border-y border-border">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold mb-2">
          A+ Module · Side-by-side
        </p>
        <h3 className="font-serif text-2xl sm:text-3xl text-foreground mb-6 max-w-2xl">
          Compare your top {recommendations.length} matches.
        </h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="py-3 px-3 sm:px-4 font-semibold w-[26%]">Tea</th>
                <th className="py-3 px-3 sm:px-4 font-semibold">Caffeine</th>
                <th className="py-3 px-3 sm:px-4 font-semibold">Brew time</th>
                <th className="py-3 px-3 sm:px-4 font-semibold">Temperature</th>
                <th className="py-3 px-3 sm:px-4 font-semibold">Mood</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((r, idx) => (
                <tr
                  key={r.product.id}
                  className={`border-b border-border last:border-0 ${idx === 0 ? 'bg-emerald-50/40' : ''}`}
                >
                  <td className="py-4 px-3 sm:px-4">
                    <Link
                      href={`/product/${r.product.slug}`}
                      className="flex items-center gap-3 hover:text-primary"
                    >
                      <span className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                        <img
                          src={r.product.imageUrl}
                          alt={r.product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-serif text-[14px] font-semibold leading-tight line-clamp-2">
                          {r.product.name}
                        </span>
                        <span className="block text-[10.5px] uppercase tracking-wider text-muted-foreground mt-0.5">
                          {r.product.category}
                          {idx === 0 && <span className="ml-2 text-emerald-700">· Top match</span>}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-4 px-3 sm:px-4 text-[12.5px] capitalize">{r.product.caffeineLevel}</td>
                  <td className="py-4 px-3 sm:px-4 text-[12.5px] tabular-nums">{r.product.brewingGuide.steepTime}</td>
                  <td className="py-4 px-3 sm:px-4 text-[12.5px] tabular-nums">{r.product.brewingGuide.temperature}</td>
                  <td className="py-4 px-3 sm:px-4 text-[12.5px] capitalize">
                    {r.product.moodTags.slice(0, 2).join(', ') || '—'}
                  </td>
                  <td className="py-4 px-3 sm:px-4 text-[13px] font-bold text-right tabular-nums">
                    {formatPrice(r.product.price, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A+ Module 3 — Brewing ritual timeline
// ──────────────────────────────────────────────────────────────────────────

function RitualTimelineModule({ product }: { product: Product }) {
  const steps = product.brewingGuide.steps;
  if (!steps?.length) return null;
  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-[#FAF8F4]">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold mb-2">
          A+ Module · Ritual timeline
        </p>
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <h3 className="font-serif text-2xl sm:text-3xl text-foreground max-w-2xl">
            Brew your {product.name} in {steps.length} steps.
          </h3>
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5" /> {product.brewingGuide.temperature}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {product.brewingGuide.steepTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5" /> {product.brewingGuide.teaAmount}
            </span>
          </div>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {steps.map((s, i) => (
            <li
              key={i}
              className="relative rounded-2xl bg-white border border-border p-4 sm:p-5"
            >
              <div className="w-9 h-9 rounded-full bg-[#1a2416] text-amber-200 flex items-center justify-center font-serif text-base mb-3 tabular-nums">
                {i + 1}
              </div>
              <p className="text-[12.5px] text-foreground/80 leading-relaxed">{s}</p>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="hidden lg:block absolute top-10 -right-2 w-4 h-px bg-border"
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A+ Module 4 — Build the bundle
// ──────────────────────────────────────────────────────────────────────────

function BundleStackModule({
  recommendations,
  currency,
  total,
  onAddAll,
}: {
  recommendations: ScoredProduct[];
  currency: CurrencyCode;
  total: number;
  onAddAll: () => void;
}) {
  if (recommendations.length < 2) return null;
  // 10% bundle saving (display only — actual cart logic unchanged for now).
  const saving = Math.round(total * 0.1);
  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-[#1a2416] text-white">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200 font-bold mb-2">
          A+ Module · Stack the bundle
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 items-start">
          <div className="lg:col-span-2">
            <h3 className="font-serif text-2xl sm:text-3xl mb-3">
              Stack all {recommendations.length} for a complete daily ritual.
            </h3>
            <p className="text-[14px] text-white/70 max-w-xl mb-6 leading-relaxed">
              Morning lift, mid-day reset, evening wind-down. Add them together and we'll send
              brewing cards in the box.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {recommendations.map((r) => (
                <Link
                  key={r.product.id}
                  href={`/product/${r.product.slug}`}
                  className="group rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  <div className="aspect-square overflow-hidden bg-white/5">
                    <img
                      src={r.product.imageUrl}
                      alt={r.product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-[11.5px] font-semibold leading-tight line-clamp-2">{r.product.name}</p>
                    <p className="text-[10.5px] text-white/55 mt-1 tabular-nums">
                      {formatPrice(r.product.price, currency)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl bg-white/[0.06] border border-white/10 p-5 sm:p-6">
            <p className="text-[10px] uppercase tracking-widest text-amber-200/80 font-semibold mb-3">
              Bundle summary
            </p>
            <ul className="space-y-1.5 text-[12.5px] text-white/75 mb-4">
              {recommendations.map((r) => (
                <li key={r.product.id} className="flex justify-between gap-2">
                  <span className="truncate">{r.product.name}</span>
                  <span className="tabular-nums shrink-0">{formatPrice(r.product.price, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-white/10 pt-3 mb-4 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between text-white/70">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(total, currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-300">
                <span>Bundle saving · 10%</span>
                <span className="tabular-nums">−{formatPrice(saving, currency)}</span>
              </div>
              <div className="flex justify-between font-semibold text-amber-100 pt-1.5 border-t border-white/10 mt-1.5">
                <span>You pay</span>
                <span className="tabular-nums">{formatPrice(total - saving, currency)}</span>
              </div>
            </div>
            <button
              onClick={onAddAll}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-200 text-[#1a2416] text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-amber-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Add all {recommendations.length} to cart
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A+ Module 5 — Recipe pairings (filtered by top product)
// ──────────────────────────────────────────────────────────────────────────

function PairingsModule({ productId }: { productId: string }) {
  const { items, loading } = useRecipes({ productId });
  if (loading) return null;
  if (!items?.length) return null;
  const slice = items.slice(0, 3);
  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white border-y border-border">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold mb-2">
              A+ Module · Pair it
            </p>
            <h3 className="font-serif text-2xl sm:text-3xl text-foreground max-w-xl">
              Recipes built for your match.
            </h3>
          </div>
          <Link
            href="/recipes"
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80"
          >
            All recipes <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {slice.map((r) => (
            <Link
              key={r.id}
              href={`/recipe/${r.slug}`}
              className="group rounded-2xl overflow-hidden border border-border bg-card hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={r.hero}
                  alt={r.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  {r.category} · {r.difficulty} · {r.prepMinutes + r.cookMinutes} min
                </p>
                <h4 className="font-serif text-[15px] font-semibold leading-tight line-clamp-2 group-hover:text-primary mb-1">
                  {r.title}
                </h4>
                <p className="text-[12px] text-muted-foreground line-clamp-2">{r.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A+ Module 6 — Related journal reads
// ──────────────────────────────────────────────────────────────────────────

function RelatedReadsModule({ answers, top }: { answers: Answers; top: Product }) {
  const { articles } = useArticles();
  const related = useMemo(() => {
    const moodTags = answers.mood ? moodToTags[answers.mood as MoodKey] : [];
    const cat = top.category.toLowerCase();
    const ranked = articles
      .filter((a) => a.published !== false)
      .map((a) => {
        let s = 0;
        const blob = `${a.title} ${a.excerpt} ${a.category}`.toLowerCase();
        if (blob.includes(cat)) s += 3;
        moodTags.forEach((t) => {
          if (blob.includes(t)) s += 1;
        });
        if (top.relatedArticleSlugs?.includes(a.slug)) s += 5;
        return { a, s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.a);
    return ranked;
  }, [articles, answers, top]);

  if (!related.length) return null;

  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-[#FAF8F4]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold mb-2">
              A+ Module · Read deeper
            </p>
            <h3 className="font-serif text-2xl sm:text-3xl text-foreground max-w-xl">
              Stories that go with your ritual.
            </h3>
          </div>
          <Link
            href="/journal"
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80"
          >
            The journal <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {related.map((a) => (
            <Link
              key={a.slug}
              href={`/journal/${a.slug}`}
              className="group rounded-2xl overflow-hidden border border-border bg-card hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={a.cover}
                  alt={a.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  {a.category} · {a.readTime}
                </p>
                <h4 className="font-serif text-[15px] font-semibold leading-tight line-clamp-2 group-hover:text-primary mb-1">
                  {a.title}
                </h4>
                <p className="text-[12px] text-muted-foreground line-clamp-2">{a.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A+ Module 7 — Continue your tea education (Teapedia)
// ──────────────────────────────────────────────────────────────────────────

function ContinueJourneyModule({ answers }: { answers: Answers }) {
  const { items, loading } = useTeapedia();
  const slice = useMemo(() => {
    if (!items?.length) return [];
    const moodTags = answers.mood ? moodToTags[answers.mood as MoodKey] : [];
    const ranked = items
      .map((e) => {
        let s = 0;
        const blob = `${e.title} ${e.summary} ${(e.tags ?? []).join(' ')}`.toLowerCase();
        moodTags.forEach((t) => {
          if (blob.includes(t)) s += 1;
        });
        return { e, s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map((x) => x.e);
    return ranked;
  }, [items, answers]);

  if (loading || !slice.length) return null;

  return (
    <section className="px-4 sm:px-8 py-12 sm:py-16 bg-white border-t border-border">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold mb-2">
          A+ Module · Continue your journey
        </p>
        <h3 className="font-serif text-2xl sm:text-3xl text-foreground mb-6 max-w-xl">
          From the Teapedia.
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {slice.map((e) => (
            <Link
              key={e.id}
              href={`/teapedia/${e.slug}`}
              className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary transition-colors"
            >
              <div className="aspect-square overflow-hidden bg-muted">
                <img
                  src={e.hero}
                  alt={e.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <p className="text-[9.5px] uppercase tracking-widest text-muted-foreground mb-1">
                  {e.category}
                </p>
                <p className="font-serif text-[13px] font-semibold leading-tight line-clamp-2 group-hover:text-primary">
                  {e.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
