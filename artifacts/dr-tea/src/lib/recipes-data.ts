import { useEffect, useState, useCallback } from "react";

const API = `${import.meta.env.BASE_URL}api`;

export type RecipeDifficulty = "easy" | "medium" | "hard";

export interface RecipeListItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  hero: string;
  category: string;
  tags: string[];
  difficulty: RecipeDifficulty;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  viewCount: number;
  origin?: string;
  authorName?: string;
  authorAvatar?: string;
  authorLocation?: string;
  hashtags?: string[];
  updatedAt: string;
}

export interface StorySlide {
  image: string;
  title?: string;
  caption: string;
}

export interface Recipe extends RecipeListItem {
  ingredients: Array<{ name: string; amount: string; note?: string }>;
  steps: Array<{ title?: string; body: string }>;
  tips: string[];
  relatedProductIds: string[];
  metaTitle: string;
  metaDescription: string;
  authorQuote?: string;
  storyMode?: StorySlide[];
  seoKeywords?: string[];
}

export interface RecipeCategoryCount {
  category: string;
  count: number;
}

export interface RecipeDetail {
  recipe: Recipe;
  relatedProducts: Array<{
    id: string;
    slug: string;
    name: string;
    category: string;
    shortDescription: string;
    price: number;
    imageUrl: string;
  }>;
}

export function useRecipes(filter: { category?: string; q?: string; productId?: string } = {}) {
  const [items, setItems] = useState<RecipeListItem[]>([]);
  const [categories, setCategories] = useState<RecipeCategoryCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter.category) qs.set("category", filter.category);
      if (filter.q) qs.set("q", filter.q);
      if (filter.productId) qs.set("productId", filter.productId);
      const [listRes, catsRes] = await Promise.all([
        fetch(`${API}/recipes${qs.toString() ? `?${qs}` : ""}`),
        fetch(`${API}/recipes/categories`),
      ]);
      const list = (await listRes.json()) as RecipeListItem[];
      const cats = (await catsRes.json()) as RecipeCategoryCount[];
      setItems(Array.isArray(list) ? list : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch {
      setItems([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [filter.category, filter.q, filter.productId]);

  useEffect(() => { void load(); }, [load]);

  return { items, categories, loading, refetch: load };
}

export function useRecipe(slug: string | undefined) {
  const [data, setData] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`${API}/recipes/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (r.status === 404) { if (!cancelled) setNotFound(true); return null; }
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (json && json.recipe) {
          setData(json as RecipeDetail);
          // Fire-and-forget view count, but de-dupe per browser session so
          // navigating away and back doesn't inflate metrics.
          try {
            const key = `dr-tea:viewed-recipe:${slug}`;
            if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
              sessionStorage.setItem(key, "1");
              fetch(`${API}/recipes/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => {});
            }
          } catch {
            // sessionStorage may be blocked (private mode, etc.); skip silently.
          }
        }
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  return { data, loading, notFound };
}
