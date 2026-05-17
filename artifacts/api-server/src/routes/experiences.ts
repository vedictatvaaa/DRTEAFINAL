import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc } from "drizzle-orm";
import { db, experiencesTable, type ExperienceRow } from "@workspace/db";

const router: IRouter = Router();

function toApi(row: ExperienceRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    themeTokens: row.themeTokens,
    banner: row.banner ?? null,
    heroTakeover: row.heroTakeover ?? null,
    particleEffect: row.particleEffect ?? "none",
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

router.get("/catalog/active-experience", async (_req: Request, res: Response) => {
  const [active] = await db
    .select()
    .from(experiencesTable)
    .where(eq(experiencesTable.isActive, true))
    .limit(1);
  if (active) {
    res.json(toApi(active));
    return;
  }
  // Fallback: first by sort order, or a hard-coded default if table is empty
  const [first] = await db
    .select()
    .from(experiencesTable)
    .orderBy(asc(experiencesTable.sortOrder))
    .limit(1);
  if (first) {
    res.json(toApi(first));
    return;
  }
  res.json({
    id: "default",
    name: "Default",
    description: "",
    themeTokens: {},
    banner: null,
    heroTakeover: null,
    particleEffect: "none",
    isActive: true,
    sortOrder: 0,
  });
});

export default router;
