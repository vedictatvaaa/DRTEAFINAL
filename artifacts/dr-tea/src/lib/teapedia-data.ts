import { useEffect, useState, useCallback } from "react";

const API = `${import.meta.env.BASE_URL}api`;

export interface TeapediaEntry {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  hero: string;
  body: Array<{ heading?: string; paragraphs: string[] }>;
  relatedProductIds: string[];
  relatedCategorySlugs: string[];
  relatedEntrySlugs: string[];
  metaTitle: string;
  metaDescription: string;
  jsonLd: Record<string, unknown> | null;
  viewCount: number;
  updatedAt: string;
}

export interface TeapediaListItem extends TeapediaEntry {}

export interface TeapediaCategoryCount {
  category: string;
  count: number;
}

export interface TeapediaDetail {
  entry: TeapediaEntry;
  relatedProducts: Array<{
    id: string;
    slug: string;
    name: string;
    category: string;
    shortDescription: string;
    price: number;
    imageUrl: string;
  }>;
  relatedEntries: Array<{
    slug: string;
    title: string;
    summary: string;
    category: string;
    hero: string;
  }>;
}

export function useTeapedia(filter: { category?: string; q?: string } = {}) {
  const [items, setItems] = useState<TeapediaListItem[]>([]);
  const [categories, setCategories] = useState<TeapediaCategoryCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter.category) qs.set("category", filter.category);
      if (filter.q) qs.set("q", filter.q);
      const [listRes, catsRes] = await Promise.all([
        fetch(`${API}/teapedia${qs.toString() ? `?${qs}` : ""}`),
        fetch(`${API}/teapedia/categories`),
      ]);
      const list = (await listRes.json()) as TeapediaListItem[];
      const cats = (await catsRes.json()) as TeapediaCategoryCount[];
      setItems(list);
      setCategories(cats);
    } catch {
      setItems([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [filter.category, filter.q]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, categories, loading, refetch: load };
}

export function useTeapediaEntry(slug: string | undefined) {
  const [data, setData] = useState<TeapediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const r = await fetch(`${API}/teapedia/${encodeURIComponent(slug)}`);
        if (r.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const j = (await r.json()) as TeapediaDetail;
        if (!cancelled) setData(j);
        // Fire-and-forget view increment.
        void fetch(`${API}/teapedia/${encodeURIComponent(slug)}/view`, {
          method: "POST",
        });
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { data, loading, notFound };
}
