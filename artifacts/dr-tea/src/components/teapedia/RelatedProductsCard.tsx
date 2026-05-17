import { Link } from "wouter";
import { ShoppingBag } from "lucide-react";
import type { TeapediaDetail } from "@/lib/teapedia-data";

export default function RelatedProductsCard({
  products,
}: {
  products: TeapediaDetail["relatedProducts"];
}) {
  if (!products.length) return null;
  return (
    <aside className="bg-gradient-to-br from-primary/5 to-amber-50 border border-border rounded-2xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-1 inline-flex items-center gap-2">
        <ShoppingBag className="w-4 h-4" /> Shop the topic
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Hand-picked from our tea catalog to match this entry.
      </p>
      <ul className="space-y-3">
        {products.slice(0, 4).map((p) => (
          <li key={p.id}>
            <Link
              href={`/product/${p.slug}`}
              className="flex items-center gap-3 group"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {p.category}
                </p>
                <p className="font-serif text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                  {p.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.shortDescription}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
