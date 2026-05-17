import { useEffect, useState } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { useGetActiveExperience } from "@workspace/api-client-react";

const STORAGE_KEY = "drtea-banner-dismissed";

export default function ExperienceBanner() {
  const { data } = useGetActiveExperience();
  const banner = data?.banner ?? null;
  const expId = data?.id ?? "";
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  if (!banner || !banner.text) return null;
  if (dismissed && dismissed === expId) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, expId);
    }
    setDismissed(expId);
  };

  const inner = (
    <div className="px-4 py-2 flex items-center justify-center gap-3 text-[11px] sm:text-[12px] tracking-wide">
      <span aria-hidden="true">✦</span>
      <span className="truncate text-center">{banner.text}</span>
      {banner.ctaLabel && banner.ctaHref && (
        <span className="hidden sm:inline-flex items-center gap-1 font-bold uppercase tracking-[0.18em] text-[10px] underline-offset-4 group-hover:underline">
          {banner.ctaLabel} →
        </span>
      )}
    </div>
  );

  return (
    <div
      className="relative bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-b border-black/5"
      role="region"
      aria-label="Featured experience"
      data-testid="experience-banner"
    >
      {banner.ctaHref ? (
        <Link href={banner.ctaHref} className="group block hover:brightness-110 transition">
          {inner}
        </Link>
      ) : (
        inner
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
