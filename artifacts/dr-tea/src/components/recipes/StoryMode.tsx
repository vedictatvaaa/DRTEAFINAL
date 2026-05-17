import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { StorySlide } from "@/lib/recipes-data";

const SLIDE_MS = 6000;

interface Props {
  slides: StorySlide[];
  open: boolean;
  onClose: () => void;
  title: string;
  authorName?: string;
  authorAvatar?: string;
  authorLocation?: string;
}

export default function StoryMode({
  slides,
  open,
  onClose,
  title,
  authorName,
  authorAvatar,
  authorLocation,
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number>(0);
  const accumRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setProgress(0);
      accumRef.current = 0;
      return;
    }
    setProgress(0);
    accumRef.current = 0;
    startRef.current = performance.now();

    function tick(now: number) {
      if (!paused) {
        const elapsed = accumRef.current + (now - startRef.current);
        const pct = Math.min(1, elapsed / SLIDE_MS);
        setProgress(pct);
        if (pct >= 1) {
          if (index < slides.length - 1) {
            setIndex((i) => i + 1);
            accumRef.current = 0;
            startRef.current = performance.now();
            setProgress(0);
          } else {
            onClose();
            return;
          }
        }
      } else {
        startRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, index, paused, slides.length, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, slides.length]);

  function goNext() {
    if (index < slides.length - 1) {
      setIndex((i) => i + 1);
      accumRef.current = 0;
      startRef.current = performance.now();
      setProgress(0);
    } else {
      onClose();
    }
  }
  function goPrev() {
    if (index > 0) {
      setIndex((i) => i - 1);
      accumRef.current = 0;
      startRef.current = performance.now();
      setProgress(0);
    }
  }

  if (!open || !slides.length) return null;
  const slide = slides[index]!;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="relative w-full h-full max-w-md max-h-[100dvh] sm:max-h-[90vh] sm:rounded-2xl overflow-hidden bg-black flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 p-2.5">
            {slides.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-[width] duration-100 ease-linear"
                  style={{
                    width:
                      i < index
                        ? "100%"
                        : i === index
                          ? `${progress * 100}%`
                          : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Top bar */}
          <div className="absolute top-5 left-0 right-0 z-30 flex items-center gap-3 px-4 pt-2">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName ?? ""}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                {(authorName ?? title).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white truncate">
                {authorName || title}
              </p>
              {authorLocation && (
                <p className="text-[10px] text-white/70 truncate">{authorLocation}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="text-white/80 hover:text-white p-1"
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white p-1"
              aria-label="Close story"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Slide */}
          <div className="absolute inset-0">
            <AnimatePresence mode="wait">
              <motion.img
                key={index}
                src={slide.image}
                alt={slide.title ?? `Slide ${index + 1}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40" />
          </div>

          {/* Caption */}
          <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-10 text-white">
            {slide.title && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-2">
                {slide.title}
              </p>
            )}
            <p className="font-serif text-lg leading-snug">{slide.caption}</p>
          </div>

          {/* Tap zones */}
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-start pl-3 text-white/0 hover:text-white/60 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-end pr-3 text-white/0 hover:text-white/60 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
