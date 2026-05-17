import { Link } from "wouter";
import { BookOpen, ArrowRight } from "lucide-react";
import type { TeapediaListItem } from "@/lib/teapedia-data";

const HERO_FALLBACK =
  "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1200&q=80&auto=format&fit=crop";

export default function EntryCard({ entry }: { entry: TeapediaListItem }) {
  return (
    <Link
      href={`/teapedia/${entry.slug}`}
      className="group block bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={entry.hero || HERO_FALLBACK}
          alt={entry.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-5">
        <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-2 inline-flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> {entry.category}
        </p>
        <h3 className="font-serif font-semibold text-base leading-snug mb-2 group-hover:text-primary transition-colors">
          {entry.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
          {entry.summary}
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary group-hover:gap-2 transition-all">
          Read entry <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}
