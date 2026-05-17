import { sql } from "drizzle-orm";
import { db, experiencesTable } from "@workspace/db";
import { logger } from "./logger";

interface Preset {
  id: string;
  name: string;
  description: string;
  themeTokens: Record<string, string>;
  banner: { text: string; ctaLabel?: string; ctaHref?: string } | null;
  heroTakeover:
    | {
        eyebrow?: string;
        title: string;
        subtitle?: string;
        ctaLabel: string;
        ctaHref: string;
        imageUrl?: string;
      }
    | null;
  particleEffect: "none" | "rain" | "snow" | "leaves" | "diyas" | "petals";
  sortOrder: number;
}

const FOREST: Preset["themeTokens"] = {
  background: "42 35% 97%",
  foreground: "130 25% 14%",
  card: "42 35% 99%",
  primary: "130 35% 22%",
  "primary-foreground": "42 35% 97%",
  secondary: "130 15% 18%",
  "secondary-foreground": "42 35% 97%",
  accent: "38 70% 48%",
  "accent-foreground": "130 25% 14%",
  muted: "42 20% 92%",
  "muted-foreground": "130 10% 42%",
  border: "40 20% 87%",
  input: "40 20% 87%",
  ring: "130 35% 22%",
  sidebar: "42 35% 97%",
  "sidebar-primary": "130 35% 22%",
  "sidebar-accent": "38 70% 48%",
};

const MONSOON: Preset["themeTokens"] = {
  background: "200 30% 16%",
  foreground: "180 20% 92%",
  card: "200 30% 20%",
  primary: "175 45% 35%",
  "primary-foreground": "180 20% 96%",
  secondary: "200 25% 12%",
  "secondary-foreground": "180 20% 92%",
  accent: "175 60% 45%",
  "accent-foreground": "200 30% 12%",
  muted: "200 20% 25%",
  "muted-foreground": "180 15% 70%",
  border: "200 20% 28%",
  input: "200 20% 28%",
  ring: "175 45% 35%",
  sidebar: "200 30% 14%",
  "sidebar-primary": "175 45% 35%",
  "sidebar-accent": "175 60% 45%",
};

const DIWALI: Preset["themeTokens"] = {
  background: "35 40% 96%",
  foreground: "0 30% 15%",
  card: "35 40% 99%",
  primary: "0 55% 30%",
  "primary-foreground": "35 40% 97%",
  secondary: "0 30% 18%",
  "secondary-foreground": "35 40% 97%",
  accent: "42 85% 50%",
  "accent-foreground": "0 30% 15%",
  muted: "35 25% 92%",
  "muted-foreground": "0 15% 40%",
  border: "35 20% 85%",
  input: "35 20% 85%",
  ring: "0 55% 30%",
  sidebar: "35 40% 96%",
  "sidebar-primary": "0 55% 30%",
  "sidebar-accent": "42 85% 50%",
};

const WINTER: Preset["themeTokens"] = {
  background: "210 30% 96%",
  foreground: "215 30% 18%",
  card: "210 30% 99%",
  primary: "215 40% 28%",
  "primary-foreground": "210 30% 97%",
  secondary: "215 25% 22%",
  "secondary-foreground": "210 30% 97%",
  accent: "200 60% 55%",
  "accent-foreground": "215 30% 15%",
  muted: "210 20% 90%",
  "muted-foreground": "215 15% 42%",
  border: "210 20% 85%",
  input: "210 20% 85%",
  ring: "215 40% 28%",
  sidebar: "210 30% 96%",
  "sidebar-primary": "215 40% 28%",
  "sidebar-accent": "200 60% 55%",
};

const SAKURA: Preset["themeTokens"] = {
  background: "340 40% 97%",
  foreground: "340 25% 18%",
  card: "340 40% 99%",
  primary: "340 50% 50%",
  "primary-foreground": "340 40% 97%",
  secondary: "340 25% 22%",
  "secondary-foreground": "340 40% 97%",
  accent: "320 70% 70%",
  "accent-foreground": "340 25% 18%",
  muted: "340 25% 92%",
  "muted-foreground": "340 15% 45%",
  border: "340 20% 87%",
  input: "340 20% 87%",
  ring: "340 50% 50%",
  sidebar: "340 40% 97%",
  "sidebar-primary": "340 50% 50%",
  "sidebar-accent": "320 70% 70%",
};

const PRESETS: Preset[] = [
  {
    id: "default",
    name: "Forest Default",
    description: "Signature DR TEA cream + forest green palette.",
    themeTokens: FOREST,
    banner: null,
    heroTakeover: null,
    particleEffect: "none",
    sortOrder: 0,
  },
  {
    id: "monsoon",
    name: "Monsoon Mumbai",
    description: "Cool teal + petrichor for grey-sky chai afternoons.",
    themeTokens: MONSOON,
    banner: {
      text: "Monsoon mood — kadak chai paired with biscuit, free with orders ₹799+",
      ctaLabel: "Shop chai",
      ctaHref: "/shop/chai",
    },
    heroTakeover: {
      eyebrow: "Monsoon Mumbai",
      title: "Rain · Chai · Stillness",
      subtitle:
        "Strong, spiced brews for grey-sky afternoons. Pair with a biscuit. Listen to the rain.",
      ctaLabel: "Shop monsoon chai",
      ctaHref: "/shop/chai",
      imageUrl: "/images/banner-monsoon-chai.webp",
    },
    particleEffect: "rain",
    sortOrder: 1,
  },
  {
    id: "diwali",
    name: "Diwali Gold",
    description: "Warm maroon + festive gold for the festival of lights.",
    themeTokens: DIWALI,
    banner: {
      text: "Diya-lit Diwali drops — free silk gifting pouch on orders ₹999+",
      ctaLabel: "Shop gifting",
      ctaHref: "/shop/tea-reserve",
    },
    heroTakeover: {
      eyebrow: "Diwali Gold",
      title: "Light · Spice · Celebration",
      subtitle: "Festive blends and limited-edition gifting tins, hand-finished for the festival of lights.",
      ctaLabel: "Explore Diwali edit",
      ctaHref: "/shop/tea-reserve",
      imageUrl: "/images/category-chai.webp",
    },
    particleEffect: "diyas",
    sortOrder: 2,
  },
  {
    id: "winter",
    name: "Winter Frost",
    description: "Crisp blues + soft whites for the longest nights of the year.",
    themeTokens: WINTER,
    banner: {
      text: "Winter warmers — kadha + spiced chai bundles. Free shipping above ₹699",
      ctaLabel: "Shop kadha",
      ctaHref: "/shop/kadha",
    },
    heroTakeover: {
      eyebrow: "Winter Frost",
      title: "Hot tea. Cold mornings.",
      subtitle: "Healing kadhas and bold black teas to warm the longest nights of the year.",
      ctaLabel: "Shop winter blends",
      ctaHref: "/shop/kadha",
      imageUrl: "/images/category-kadha.webp",
    },
    particleEffect: "snow",
    sortOrder: 3,
  },
  {
    id: "sakura",
    name: "Sakura Spring",
    description: "Soft blush + petal pink for first-flush florals and greens.",
    themeTokens: SAKURA,
    banner: {
      text: "Sakura season — first-flush florals and delicate green teas, freshly arrived",
      ctaLabel: "Shop florals",
      ctaHref: "/shop/floral-tisane",
    },
    heroTakeover: {
      eyebrow: "Sakura Spring",
      title: "Petals · Light · Renewal",
      subtitle: "Soft floral tisanes and first-flush greens for the season of new leaves.",
      ctaLabel: "Shop florals",
      ctaHref: "/shop/floral-tisane",
      imageUrl: "/images/category-floral.webp",
    },
    particleEffect: "petals",
    sortOrder: 4,
  },
];

export async function seedExperiences(): Promise<void> {
  try {
    for (const p of PRESETS) {
      await db
        .insert(experiencesTable)
        .values({
          id: p.id,
          name: p.name,
          description: p.description,
          themeTokens: p.themeTokens,
          banner: p.banner,
          heroTakeover: p.heroTakeover,
          particleEffect: p.particleEffect,
          isActive: p.id === "default",
          sortOrder: p.sortOrder,
        })
        // Insert-only baseline: never overwrite admin-edited content on
        // boot. Existing rows are left as-is. Set EXPERIENCE_PRESETS_RESET=1
        // to force-restore the canonical preset content from this file.
        .onConflictDoNothing({ target: experiencesTable.id });
    }
    if (process.env["EXPERIENCE_PRESETS_RESET"] === "1") {
      logger.warn("EXPERIENCE_PRESETS_RESET=1 — overwriting all experience presets with code defaults");
      for (const p of PRESETS) {
        await db
          .insert(experiencesTable)
          .values({
            id: p.id,
            name: p.name,
            description: p.description,
            themeTokens: p.themeTokens,
            banner: p.banner,
            heroTakeover: p.heroTakeover,
            particleEffect: p.particleEffect,
            isActive: p.id === "default",
            sortOrder: p.sortOrder,
          })
          .onConflictDoUpdate({
            target: experiencesTable.id,
            set: {
              name: p.name,
              description: p.description,
              themeTokens: p.themeTokens,
              banner: p.banner,
              heroTakeover: p.heroTakeover,
              particleEffect: p.particleEffect,
              sortOrder: p.sortOrder,
              updatedAt: new Date(),
            },
          });
      }
    }
    // Normalize to exactly one active experience.
    // 1) If multiple rows are active, keep only the most recently updated.
    // 2) If none are active, fall back to 'default'.
    await db.execute(sql`
      WITH winner AS (
        SELECT id FROM experiences
        WHERE is_active = true
        ORDER BY updated_at DESC, sort_order ASC
        LIMIT 1
      )
      UPDATE experiences
      SET is_active = false
      WHERE is_active = true
        AND id <> COALESCE((SELECT id FROM winner), '')
    `);
    await db.execute(sql`
      UPDATE experiences SET is_active = true
      WHERE id = 'default'
        AND NOT EXISTS (SELECT 1 FROM experiences WHERE is_active = true)
    `);
    logger.info({ count: PRESETS.length }, "Experience presets seeded");
  } catch (err) {
    logger.warn({ err }, "Failed to seed experience presets (non-fatal)");
  }
}
