import { useQuery } from "@tanstack/react-query";

// Mirror the server defaults in artifacts/api-server/src/lib/homepage-seo-defaults.ts
// so initial paint never flashes blank while the network call is in flight.
export const HOMEPAGE_SEO_DEFAULTS: HomepageSeo = {
  h1Visible: "Buy Premium\nIndian Tea Online",
  h1SrOnly:
    "Buy Premium Indian Tea Online — Shop Masala Chai, CTC Tea, Black Tea, Darjeeling, Assam, Green Tea, Ayurvedic Kadha & Herbal Tisanes at Dr Tea. Single-estate, hand-blended, free shipping above ₹999 across India.",
  h1Subline: "Masala Chai · CTC · Black Tea · Darjeeling · Green · Kadha",
  heroEyebrow: "Single-estate Indian tea",
  heroSubcopy:
    "Single-estate Darjeeling, Assam gold & royal masala chai — hand-blended in small batches, shipped from Assam in 24 hours.",
  metaKeywords: [
    "buy tea online India",
    "Dr Tea",
    "masala chai",
    "ayurvedic kadha",
    "Darjeeling tea",
    "Assam tea",
    "single estate tea",
    "loose leaf tea",
    "premium Indian tea",
    "floral tisane",
  ],
  breadcrumbHomeLabel: "Home",
  breadcrumbsJsonLdEnabled: true,
};

export interface HomepageSeo {
  h1Visible: string;
  h1SrOnly: string;
  h1Subline: string;
  heroEyebrow: string;
  heroSubcopy: string;
  metaKeywords: string[];
  breadcrumbHomeLabel: string;
  breadcrumbsJsonLdEnabled: boolean;
}

/**
 * Fetch the singleton homepage SEO row. Returns the server defaults
 * synchronously while the request is in flight so consumers can render
 * without a loading state. Cached aggressively — operators don't change
 * these often and stale-while-revalidate keeps the user on fresh values.
 */
export function useHomepageSeo(): HomepageSeo {
  const q = useQuery({
    queryKey: ["seo-public", "homepage"],
    queryFn: async (): Promise<HomepageSeo> => {
      const res = await fetch("/api/seo-public/homepage", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as Partial<HomepageSeo>;
      return { ...HOMEPAGE_SEO_DEFAULTS, ...json };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: HOMEPAGE_SEO_DEFAULTS,
    refetchOnWindowFocus: false,
  });
  return q.data ?? HOMEPAGE_SEO_DEFAULTS;
}
