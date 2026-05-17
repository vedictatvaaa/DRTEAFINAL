import { Link } from "wouter";
import { motion } from "framer-motion";
import type { ExperienceHeroTakeover } from "@workspace/api-client-react";

export default function ExperienceHero({ hero }: { hero: ExperienceHeroTakeover }) {
  return (
    <section className="relative bg-[#0e1a0d]" data-testid="experience-hero">
      <div className="relative w-full h-[clamp(420px,60vw,640px)] overflow-hidden">
        {hero.imageUrl ? (
          <img
            src={hero.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-[hsl(var(--secondary))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e1a0d]/75 via-[#0e1a0d]/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1a0d]/40 via-transparent to-transparent" />

        <div className="relative z-10 h-full flex items-center px-6 sm:px-12 lg:px-20">
          <div className="max-w-xl">
            {hero.eyebrow && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-[11px] sm:text-[12px] tracking-[0.25em] uppercase text-amber-200/85 mb-4 font-bold"
              >
                {hero.eyebrow}
              </motion.p>
            )}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-[clamp(2.25rem,6.5vw,4.25rem)] font-serif font-bold leading-[1.05] text-white mb-5"
            >
              {hero.title}
            </motion.h1>
            {hero.subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="text-[13px] sm:text-[15px] text-white/80 font-light leading-relaxed mb-7 max-w-md"
              >
                {hero.subtitle}
              </motion.p>
            )}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45 }}
            >
              <Link
                href={hero.ctaHref}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[11px] font-bold uppercase tracking-[0.18em] hover:brightness-110 transition rounded-sm"
              >
                {hero.ctaLabel} →
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
