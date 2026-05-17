import { db, productsTable, articlesTable } from "@workspace/db";
import { products } from "../../artifacts/dr-tea/src/data/products";
import { articles } from "../../artifacts/dr-tea/src/data/journal";

async function main() {
  console.log(`Seeding ${products.length} products...`);
  let productOrder = 0;
  for (const p of products) {
    await db
      .insert(productsTable)
      .values({
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category,
        description: p.description,
        shortDescription: p.shortDescription,
        price: p.price,
        rating: p.rating,
        reviewCount: p.reviewCount,
        variants: p.variants,
        tastingNotes: p.tastingNotes,
        ingredients: p.ingredients,
        wellnessBenefits: p.wellnessBenefits,
        brewingGuide: p.brewingGuide,
        origin: p.origin,
        harvestSeason: p.harvestSeason,
        caffeineLevel: p.caffeineLevel,
        flavorProfile: p.flavorProfile,
        wellnessFocus: p.wellnessFocus,
        brewingType: p.brewingType,
        ritualStyle: p.ritualStyle,
        fomoTag: p.fomoTag ?? null,
        imageUrl: p.imageUrl,
        categoryTheme: p.categoryTheme,
        pairsWith: p.pairsWith,
        moodTags: p.moodTags,
        plantationStory: p.plantationStory,
        sortOrder: productOrder++,
      })
      .onConflictDoNothing({ target: productsTable.id });
  }

  console.log(`Seeding ${articles.length} articles...`);
  let articleOrder = 0;
  for (const a of articles) {
    await db
      .insert(articlesTable)
      .values({
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        category: a.category,
        readTime: a.readTime,
        date: a.date,
        cover: a.cover,
        body: a.body,
        sortOrder: articleOrder++,
      })
      .onConflictDoNothing({ target: articlesTable.slug });
  }

  console.log("Seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
