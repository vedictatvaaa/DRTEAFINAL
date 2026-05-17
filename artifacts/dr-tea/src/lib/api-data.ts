import {
  useListProducts,
  useGetProductBySlug,
  useListArticles,
  useGetArticleBySlug,
  getGetProductBySlugQueryKey,
  getGetArticleBySlugQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@/data/products";
import type { Article } from "@/data/journal";

export function useProducts(): { products: Product[]; isLoading: boolean } {
  const q = useListProducts();
  return { products: q.data ?? [], isLoading: q.isLoading };
}

export function useProduct(slug: string | undefined): {
  product: Product | undefined;
  isLoading: boolean;
} {
  const q = useGetProductBySlug(slug ?? "", {
    query: { enabled: !!slug, queryKey: getGetProductBySlugQueryKey(slug ?? "") },
  });
  return { product: q.data, isLoading: q.isLoading };
}

export function useArticles(): { articles: Article[]; isLoading: boolean } {
  const q = useListArticles();
  return { articles: q.data ?? [], isLoading: q.isLoading };
}

export function useArticle(slug: string | undefined): {
  article: Article | undefined;
  isLoading: boolean;
} {
  const q = useGetArticleBySlug(slug ?? "", {
    query: { enabled: !!slug, queryKey: getGetArticleBySlugQueryKey(slug ?? "") },
  });
  return { article: q.data, isLoading: q.isLoading };
}
