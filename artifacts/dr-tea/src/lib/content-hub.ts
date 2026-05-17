// Client helpers for the Dr Tea Content Hub (pairing / wellness / regional).
// One unified API + shared types so the three storefront sections stay in sync.

const API = `${import.meta.env.BASE_URL}api`;

export type ContentHubKind = "pairing" | "wellness" | "regional";

export interface ContentHubCard {
  id: number;
  slug: string;
  hub: ContentHubKind;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  hero: string;
  viewCount: number;
  updatedAt: string;
}

export interface ContentHubEntry extends ContentHubCard {
  body: Array<{ heading?: string; paragraphs: string[] }>;
  facets: Record<string, unknown> | null;
  faqs: Array<{ q: string; a: string }>;
  relatedProductIds: string[];
  relatedRecipeSlugs: string[];
  relatedEntrySlugs: string[];
  metaTitle: string;
  metaDescription: string;
  jsonLd: Record<string, unknown> | null;
  authorType: "admin" | "ai";
  status: "approved" | "pending" | "rejected";
  published: boolean;
  sortOrder: number;
}

export interface ContentHubDetailResponse {
  entry: ContentHubEntry;
  relatedProducts: Array<{
    id: string;
    slug: string;
    name: string;
    price?: number;
    images?: string[];
  } & Record<string, unknown>>;
  relatedRecipes: Array<{
    slug: string;
    title: string;
    summary: string;
    hero: string;
    category: string;
  }>;
  relatedEntries: Array<{
    slug: string;
    title: string;
    summary: string;
    category: string;
    hero: string;
    hub: ContentHubKind;
  }>;
}

export const HUB_PATH: Record<ContentHubKind, string> = {
  pairing: "/pairings",
  wellness: "/wellness",
  regional: "/tea-culture",
};

export const HUB_COPY: Record<
  ContentHubKind,
  {
    eyebrow: string;
    title: string;
    tagline: string;
    categoriesLabel: string;
    metaTitle: string;
    metaDescription: string;
    canonical: string;
  }
> = {
  pairing: {
    eyebrow: "The Pairing Library",
    title: "Pair your tea like you'd pair wine",
    tagline:
      "Editorial guides matching every Dr Tea blend to the food it was born to sit beside — from buttery shortbread to a fiery samosa.",
    categoriesLabel: "Pair by mood",
    metaTitle: "Tea & Food Pairings — Pair Tea Like Wine | Dr Tea",
    metaDescription:
      "Editorial pairing guides for Indian and global teas: what to drink with samosas, biryani, shortbread, dark chocolate and more. Curated by Dr Tea blenders.",
    canonical: "https://drtea.in/pairings",
  },
  wellness: {
    eyebrow: "Wellness & Ayurveda",
    title: "Modern wellness, ancient leaves",
    tagline:
      "Caffeine-free brews, sleep rituals, immunity kadhas and dosha-balancing teas — written for everyday life, never as medicine.",
    categoriesLabel: "Brew for",
    metaTitle: "Tea Wellness & Ayurveda — Caffeine-Free Brews & Kadhas | Dr Tea",
    metaDescription:
      "Caffeine-free brews, sleep rituals, immunity kadhas and dosha-balancing teas for everyday life. Written for general wellbeing — never as medical advice.",
    canonical: "https://drtea.in/wellness",
  },
  regional: {
    eyebrow: "Regional Tea Culture",
    title: "A passport, brewed",
    tagline:
      "From a Kolkata bhar to a Kashmiri kahwa to a Japanese chashitsu — the rituals, vessels and stories behind the world's great tea cultures.",
    categoriesLabel: "Travel by region",
    metaTitle: "Tea Culture — World Tea Rituals, Ceremonies & Traditions | Dr Tea",
    metaDescription:
      "Long-form storytelling on world tea cultures: Japanese chanoyu, Indian chai, Moroccan mint, Kashmiri kahwa, Chinese gongfu — the rituals, vessels and history behind the cup.",
    canonical: "https://drtea.in/tea-culture",
  },
};

export async function fetchContentHubList(
  hub: ContentHubKind,
  opts: { category?: string; q?: string; tag?: string; limit?: number } = {},
): Promise<ContentHubCard[]> {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  if (opts.q) params.set("q", opts.q);
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString() ? `?${params.toString()}` : "";
  const r = await fetch(`${API}/content/${hub}${qs}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as ContentHubCard[];
}

export async function fetchContentHubCategories(
  hub: ContentHubKind,
): Promise<Array<{ category: string; count: number }>> {
  const r = await fetch(`${API}/content/${hub}/categories`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as Array<{ category: string; count: number }>;
}

export async function fetchContentHubEntry(
  hub: ContentHubKind,
  slug: string,
): Promise<ContentHubDetailResponse> {
  const r = await fetch(`${API}/content/${hub}/${slug}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as ContentHubDetailResponse;
}

export function recordContentHubView(
  hub: ContentHubKind,
  slug: string,
): void {
  fetch(`${API}/content/${hub}/${slug}/view`, {
    method: "POST",
    keepalive: true,
  }).catch(() => undefined);
}
