import { db, productsTable } from "@workspace/db";
import { products as allProducts } from "../../../dr-tea/src/data/products";
import { logger } from "./logger";

export async function seedTeawares(): Promise<void> {
  try {
    const teawares = allProducts.filter((p) => p.category === "Teawares");
    if (teawares.length === 0) return;

    let baseOrder = 1000;
    for (const p of teawares) {
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
          sortOrder: baseOrder++,
        })
        .onConflictDoNothing({ target: productsTable.id });
    }
    logger.info({ count: teawares.length }, "Teawares seed checked");
  } catch (err) {
    logger.error({ err }, "Failed to seed teawares");
  }
}
