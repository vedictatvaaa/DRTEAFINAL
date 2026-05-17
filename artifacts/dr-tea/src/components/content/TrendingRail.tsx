import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Flame } from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

interface TrendingCard {
  kind: "journal" | "teapedia" | "hub";
  hub?: string | null;
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  url: string;
  date: string;
  category: string;
  tags: string[];
  hashtags?: string[];
}

interface Props {
  kind?: "journal" | "teapedia" | "hub" | "all";
  hub?: "pairing" | "wellness" | "regional";
  limit?: number;
  title?: string;
}

export default function TrendingRail({
  kind = "all",
  hub,
  limit = 8,
  title = "Trending this week",
}: Props) {
  const [items, setItems] = useState<TrendingCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ kind, limit: String(limit) });
    if (hub) params.set("hub", hub);
    fetch(`${API}/trending?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => !cancelled && setItems(j as TrendingCard[]))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind, hub, limit]);

  if (!loading && !items.length) return null;

  return (
    <section className="container mx-auto px-4 sm:px-6 max-w-6xl my-10 sm:my-14">
      <div className="flex items-end justify-between mb-5">
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-600" /> {title}
        </h2>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Updated daily from RSS, Reddit & Google Trends
        </p>
      </div>
      <div className="-mx-4 sm:mx-0 overflow-x-auto snap-x snap-mandatory pb-3">
        <ul className="flex gap-4 px-4 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
          {(loading ? Array.from({ length: 4 }) : items).map((it, i) => {
            if (loading) {
              return (
                <li
                  key={i}
                  className="snap-start shrink-0 w-72 sm:w-auto h-44 rounded-2xl bg-black/5 animate-pulse"
                />
              );
            }
            const c = it as TrendingCard;
            return (
              <li key={`${c.kind}-${c.slug}`} className="snap-start shrink-0 w-72 sm:w-auto">
                <Link href={c.url}>
                  <a className="block group rounded-2xl overflow-hidden border border-black/5 bg-white hover:shadow-lg transition-shadow h-full">
                    {c.cover ? (
                      <div
                        className="aspect-[16/10] bg-center bg-cover"
                        style={{ backgroundImage: `url("${c.cover}")` }}
                      />
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-amber-50 to-emerald-50" />
                    )}
                    <div className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-orange-700 font-bold mb-1.5">
                        {c.kind === "hub" ? c.hub : c.kind} · {c.category}
                      </p>
                      <h3 className="font-serif text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {c.title}
                      </h3>
                      {c.excerpt ? (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {c.excerpt}
                        </p>
                      ) : null}
                      {c.hashtags && c.hashtags.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {c.hashtags.slice(0, 4).map((h) => (
                            <span
                              key={h}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-700"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
