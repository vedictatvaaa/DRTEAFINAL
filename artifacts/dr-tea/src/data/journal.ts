export interface Article {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date: string;
  cover: string;
  published?: boolean;
  body: { heading?: string; paragraphs: string[] }[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  jsonLd?: Record<string, unknown> | null;
  relatedProductIds?: string[] | null;
  relatedArticleSlugs?: string[] | null;
  hashtags?: string[] | null;
  seoKeywords?: string[] | null;
  authorName?: string | null;
  authorType?: 'admin' | 'ai' | 'shopper' | null;
}

export const articles: Article[] = [
  {
    slug: 'how-to-brew-darjeeling-first-flush',
    title: 'How to Brew Darjeeling First Flush — A 5-Step Ritual',
    excerpt: 'The most delicate tea in the world deserves a brewing ritual built around its character — light, floral, and unmistakable.',
    category: 'Brewing Guide',
    readTime: '4 min read',
    date: '2026-04-12',
    cover: '/images/category-reserve.webp',
    body: [
      { paragraphs: [
        'Darjeeling first flush is harvested in late February to mid-April, when the tea bushes wake from winter dormancy. The leaves are tender, pale, and impossibly fragrant — and brewing them well is more about restraint than effort.',
      ]},
      { heading: 'The leaf and the water', paragraphs: [
        'Use 2 grams of leaf per 150 ml of water — roughly one heaped teaspoon per cup. Always use filtered or spring water; chlorinated tap water flattens the muscatel notes the first flush is famous for.',
      ]},
      { heading: 'Temperature matters', paragraphs: [
        'Heat the water to 80–85°C, never a rolling boil. Boiling water scorches the young leaf and pulls bitter tannins instead of the green-floral character you want.',
      ]},
      { heading: 'Steep, do not stew', paragraphs: [
        'Three minutes is the sweet spot. The first flush should taste of fresh apricot, white blossom, and a clean mineral finish. If yours tastes astringent or grassy, shorten the steep by 30 seconds.',
      ]},
      { heading: 'No milk, no sugar', paragraphs: [
        'A first-flush Darjeeling is the closest tea gets to white wine — drink it on its own, ideally between meals, to taste the terroir of the garden it came from.',
      ]},
    ],
  },
  {
    slug: 'what-is-kadha',
    title: 'What is Kadha? The Ayurvedic Decoction Behind Indian Wellness',
    excerpt: 'Kadha is older than chai and arguably more important — a slow-simmered decoction of herbs that has been the foundation of Indian home medicine for centuries.',
    category: 'Wellness',
    readTime: '5 min read',
    date: '2026-03-28',
    cover: '/images/category-kadha.webp',
    body: [
      { paragraphs: [
        'Kadha (काढ़ा) is a traditional Ayurvedic decoction made by slow-simmering whole herbs, roots, and spices in water until the active compounds are extracted into the brew. Unlike a tea or infusion, a kadha is boiled — sometimes for 20 minutes or more — to draw out the deepest medicinal properties.',
      ]},
      { heading: 'The ingredients', paragraphs: [
        'A classic kadha base includes tulsi (holy basil), giloy, mulethi (liquorice), ginger, black pepper, and clove. Adaptogenic herbs like ashwagandha and brahmi are added depending on the desired effect — immunity, cognition, stress recovery.',
      ]},
      { heading: 'How it differs from chai', paragraphs: [
        'Chai is a beverage. Kadha is functional. Chai uses tea leaves and milk; kadha is herbal and water-based. Chai is enjoyed for taste; kadha is taken for purpose — often first thing in the morning, or at the first sign of a cold.',
      ]},
      { heading: 'How to brew at home', paragraphs: [
        'Add one teaspoon of kadha blend to 200 ml of water. Bring to a boil, then reduce to a simmer for 8–12 minutes. Strain into a cup. Sweeten with raw honey only after the kadha has cooled to drinking temperature — never add honey to boiling liquid.',
      ]},
    ],
  },
  {
    slug: 'masala-chai-history',
    title: 'A Short History of Masala Chai — From Royal Court to Roadside',
    excerpt: 'Masala chai is one of India\'s greatest cultural exports, but its modern form is barely 100 years old. Here is how it became the worlds most-loved cup.',
    category: 'Heritage',
    readTime: '6 min read',
    date: '2026-03-10',
    cover: '/images/category-chai.webp',
    body: [
      { paragraphs: [
        'The word chai simply means "tea" in Hindi, but in the global imagination it has come to mean something specific — a creamy, spiced, milk-laden brew that is now sold in cafés from London to Los Angeles.',
      ]},
      { heading: 'Pre-colonial roots', paragraphs: [
        'Spiced milk drinks made with cardamom, ginger, and clove existed in royal Ayurvedic courts long before tea arrived in India. These were called kadha, not chai, and were drunk for health rather than refreshment.',
      ]},
      { heading: 'The colonial pivot', paragraphs: [
        'When the British East India Company began cultivating tea in Assam in the 1830s, almost all of it was exported. Indians were not tea drinkers. To create a domestic market, the Indian Tea Association in the 1900s launched aggressive promotional campaigns — and Indian vendors creatively adapted the bitter black tea into something more palatable: boiled with milk, sugar, and the spices already used in kadha.',
      ]},
      { heading: 'Masala chai today', paragraphs: [
        'Modern masala chai is a fusion: Assam CTC tea for body, whole milk for richness, fresh ginger and cardamom for warmth. The "best" recipe varies by household, region, and railway station — and that variation is precisely what makes it Indian.',
      ]},
    ],
  },
  {
    slug: 'green-tea-vs-tisane',
    title: 'Green Tea vs Floral Tisane — What\'s Actually the Difference?',
    excerpt: 'Both are caffeine-light, both are healthy, and both are often sold as "tea" — but botanically they are entirely different. Here is what to know.',
    category: 'Tea 101',
    readTime: '3 min read',
    date: '2026-02-22',
    cover: '/images/category-floral.webp',
    body: [
      { paragraphs: [
        'Strictly speaking, only beverages made from the leaves of Camellia sinensis are "tea" — which means white, green, oolong, black, and pu-erh. Everything else, including chamomile, hibiscus, peppermint and rose, is technically a tisane (or "herbal infusion").',
      ]},
      { heading: 'Caffeine', paragraphs: [
        'Green tea is naturally caffeinated, though only at about 25–35 mg per cup — a third of a strong coffee. Floral tisanes contain zero caffeine, which makes them the perfect evening companion.',
      ]},
      { heading: 'Brewing', paragraphs: [
        'Green tea wants 75–80°C water and a 2-minute steep — go hotter or longer and it turns bitter. Tisanes are far more forgiving: a full 100°C boil and a 5–7 minute steep is ideal to extract the flavour.',
      ]},
      { heading: 'When to drink each', paragraphs: [
        'Green tea is your morning and afternoon ally. Floral tisanes belong to the evening — chamomile and lavender for sleep, rose and hibiscus for relaxation without caffeine.',
      ]},
    ],
  },
];
