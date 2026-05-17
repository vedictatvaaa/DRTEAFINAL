import { eq } from "drizzle-orm";
import { db, articlesTable, contentDraftsTable, type ContentDraftRow } from "./db";

export interface PromoteResult {
  articleId: number;
  slug: string;
}

/**
 * Convert a blog content draft into an `articles` row. Idempotent on slug
 * (suffixes -2, -3, ... on collision). Wraps the article insert and the
 * draft back-link update in a single transaction so a crash between the
 * two writes can't leave the draft pointing at nothing.
 *
 * @param publish if true, the article is created with `published=true` so
 *   it appears immediately on the public journal. Default false (kept as
 *   an editor draft) preserves the manual workflow.
 */
export async function promoteBlogDraftToArticle(
  draft: ContentDraftRow,
  opts: { publish?: boolean } = {},
): Promise<PromoteResult> {
  if (draft.kind !== "blog") {
    throw new Error("Only blog drafts can be promoted to articles");
  }
  const slug = (draft.title || draft.topic || `draft-${draft.id}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `draft-${draft.id}`;

  // Markdown body → article body sections. Split on H2 (## ) headings.
  const sections: Array<{ heading?: string; paragraphs: string[] }> = [];
  let current: { heading?: string; paragraphs: string[] } = { paragraphs: [] };
  for (const block of draft.body.split(/\n\n+/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      if (current.heading || current.paragraphs.length) sections.push(current);
      current = { heading: h2[1]!.trim(), paragraphs: [] };
    } else {
      current.paragraphs.push(trimmed);
    }
  }
  if (current.heading || current.paragraphs.length) sections.push(current);
  const finalSections = sections.length ? sections : [{ paragraphs: [draft.body] }];
  const excerpt = (draft.body.split(/\n+/)[0] ?? "").slice(0, 200);
  const today = new Date().toISOString().slice(0, 10);

  let finalSlug = slug;
  for (let n = 2; n < 50; n++) {
    const [clash] = await db
      .select({ id: articlesTable.id })
      .from(articlesTable)
      .where(eq(articlesTable.slug, finalSlug))
      .limit(1);
    if (!clash) break;
    finalSlug = `${slug}-${n}`;
  }

  const article = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(articlesTable)
      .values({
        slug: finalSlug,
        title: draft.title || draft.topic || "Untitled",
        excerpt,
        category: "Stories",
        readTime: `${Math.max(2, Math.round(draft.body.split(/\s+/).length / 220))} min read`,
        date: today,
        cover: draft.imageRefs[0]?.url ?? "",
        body: finalSections,
        published: !!opts.publish,
        jsonLd: draft.jsonLd ?? null,
      })
      .returning();
    if (created) {
      await tx
        .update(contentDraftsTable)
        .set({ promotedArticleId: created.id, updatedAt: new Date() })
        .where(eq(contentDraftsTable.id, draft.id));
    }
    return created;
  });

  if (!article) throw new Error("Article insert returned no row");
  return { articleId: article.id, slug: finalSlug };
}
