import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListProducts,
  useAdminListArticles,
  useAdminSeoGenerateProductMeta,
  useAdminSeoGenerateArticleMeta,
  useAdminSeoGenerateProductRelated,
  useAdminSeoGenerateArticleRelated,
  getAdminListProductsQueryKey,
  getAdminListArticlesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipsInput } from "@/components/admin/ChipsInput";
import { useToast } from "@/hooks/use-toast";

export interface SeoFields {
  metaTitle?: string;
  metaDescription?: string;
  jsonLd?: Record<string, unknown> | null;
  relatedProductIds?: string[];
  relatedArticleSlugs?: string[];
  /** Articles only: viral social hashtags (#prefix). Ignored for products. */
  hashtags?: string[];
  /** Articles only: long-tail SEO keywords. Ignored for products. */
  seoKeywords?: string[];
}

interface SeoEditorSectionProps {
  kind: "product" | "article";
  /** Database id of the row being edited (string for products, number for articles). Undefined means a new unsaved row. */
  itemId: string | number | undefined;
  value: SeoFields;
  onChange: (next: SeoFields) => void;
  /** The editable long-text field on the parent form to inject related links into. */
  targetLabel: string;
  targetText: string;
  onTargetTextChange: (next: string) => void;
}

/**
 * Renders the SEO override panel embedded in the product/article admin forms.
 * Surfaces AI-filled meta + related fields with explicit override + regenerate
 * controls, plus an "Insert internal links" workflow that appends a curated
 * Related-Reading block to the description/body content (with preview/edit).
 */
export function SeoEditorSection({
  kind,
  itemId,
  value,
  onChange,
  targetLabel,
  targetText,
  onTargetTextChange,
}: SeoEditorSectionProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const productsQ = useAdminListProducts();
  const articlesQ = useAdminListArticles();
  const products = productsQ.data ?? [];
  const articles = articlesQ.data ?? [];

  const genProductMeta = useAdminSeoGenerateProductMeta();
  const genArticleMeta = useAdminSeoGenerateArticleMeta();
  const genProductRel = useAdminSeoGenerateProductRelated();
  const genArticleRel = useAdminSeoGenerateArticleRelated();

  const [busy, setBusy] = useState<null | "meta" | "related">(null);
  const [preview, setPreview] = useState<string | null>(null);

  const set = <K extends keyof SeoFields>(k: K, v: SeoFields[K]) =>
    onChange({ ...value, [k]: v });

  // Local draft for the JSON-LD textarea so the operator can type freely
  // (with intermediate invalid states) without losing characters. Parsed
  // value is committed to form state only when JSON parses successfully or
  // is cleared. We re-sync the draft when an external regenerate happens.
  const [jsonLdDraft, setJsonLdDraft] = useState<string>(() =>
    value.jsonLd ? JSON.stringify(value.jsonLd, null, 2) : "",
  );
  const [lastSyncedJsonLd, setLastSyncedJsonLd] = useState(value.jsonLd ?? null);
  if (value.jsonLd !== lastSyncedJsonLd) {
    setLastSyncedJsonLd(value.jsonLd ?? null);
    setJsonLdDraft(value.jsonLd ? JSON.stringify(value.jsonLd, null, 2) : "");
  }
  const [jsonLdError, setJsonLdError] = useState<string | null>(null);

  const proposedInsert = useMemo(() => {
    const productLines = (value.relatedProductIds ?? [])
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => `- [${p.name}](/product/${p.slug})`);
    const articleLines = (value.relatedArticleSlugs ?? [])
      .map((slug) => articles.find((a) => a.slug === slug))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => `- [${a.title}](/journal/${a.slug})`);
    const sections: string[] = [];
    if (productLines.length) sections.push(`**Related teas:**\n${productLines.join("\n")}`);
    if (articleLines.length) sections.push(`**Related reading:**\n${articleLines.join("\n")}`);
    if (!sections.length) return "";
    if (kind === "article") {
      return `## Related\n\n${sections.join("\n\n")}`;
    }
    return sections.join("\n\n");
  }, [value.relatedProductIds, value.relatedArticleSlugs, products, articles, kind]);

  async function regenerateMeta() {
    if (itemId == null) {
      toast({ title: "Save first", description: "Save the item before regenerating AI meta." });
      return;
    }
    setBusy("meta");
    try {
      const meta =
        kind === "product"
          ? await genProductMeta.mutateAsync({ id: String(itemId) })
          : await genArticleMeta.mutateAsync({ id: Number(itemId) });
      onChange({
        ...value,
        metaTitle: meta.metaTitle,
        metaDescription: meta.metaDescription,
        jsonLd: (meta.jsonLd ?? null) as Record<string, unknown> | null,
        ...(kind === "article"
          ? {
              hashtags: meta.hashtags ?? [],
              seoKeywords: meta.seoKeywords ?? [],
            }
          : {}),
      });
      qc.invalidateQueries({
        queryKey: kind === "product" ? getAdminListProductsQueryKey() : getAdminListArticlesQueryKey(),
      });
      toast({ title: "AI meta regenerated", description: "Edit fields to override before saving." });
    } catch (err) {
      toast({
        title: "AI meta failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function regenerateRelated() {
    if (itemId == null) {
      toast({ title: "Save first", description: "Save the item before regenerating related items." });
      return;
    }
    setBusy("related");
    try {
      const r =
        kind === "product"
          ? await genProductRel.mutateAsync({ id: String(itemId) })
          : await genArticleRel.mutateAsync({ id: Number(itemId) });
      onChange({
        ...value,
        relatedProductIds: r.productIds ?? [],
        relatedArticleSlugs: r.articleSlugs ?? [],
      });
      qc.invalidateQueries({
        queryKey: kind === "product" ? getAdminListProductsQueryKey() : getAdminListArticlesQueryKey(),
      });
      toast({ title: "Related items refreshed" });
    } catch (err) {
      toast({
        title: "Related generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(null);
    }
  }

  function openInsertPreview() {
    if (!proposedInsert) {
      toast({
        title: "No related items yet",
        description: "Click 'Regenerate related' first, or add IDs manually.",
      });
      return;
    }
    setPreview(proposedInsert);
  }

  function acceptInsert() {
    if (preview == null) return;
    const sep = targetText.endsWith("\n") || targetText === "" ? "" : "\n\n";
    onTargetTextChange(`${targetText}${sep}${preview.trim()}\n`);
    setPreview(null);
    toast({ title: `Internal links inserted into ${targetLabel.toLowerCase()}` });
  }

  return (
    <details className="rounded-md border border-dashed p-3" open>
      <summary className="text-sm cursor-pointer font-medium">
        SEO & internal links{" "}
        <span className="text-xs text-muted-foreground">
          (AI auto-fills on publish · edit any field to override)
        </span>
      </summary>
      <div className="space-y-3 mt-3">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label>Meta title</Label>
            <Input
              value={value.metaTitle ?? ""}
              placeholder="Auto-generated on save when empty"
              onChange={(e) => set("metaTitle", e.target.value || undefined)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Meta description</Label>
            <Textarea
              rows={3}
              value={value.metaDescription ?? ""}
              placeholder="Auto-generated on save when empty"
              onChange={(e) => set("metaDescription", e.target.value || undefined)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              JSON-LD <span className="text-xs text-muted-foreground">(schema.org structured data)</span>
            </Label>
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={jsonLdDraft}
              placeholder="Auto-generated on save when empty"
              onChange={(e) => {
                const t = e.target.value;
                setJsonLdDraft(t);
                if (!t.trim()) {
                  setJsonLdError(null);
                  setLastSyncedJsonLd(null);
                  set("jsonLd", null);
                  return;
                }
                try {
                  const parsed = JSON.parse(t) as Record<string, unknown>;
                  setJsonLdError(null);
                  setLastSyncedJsonLd(parsed);
                  set("jsonLd", parsed);
                } catch (err) {
                  // Keep typing — flag the error but do not discard draft.
                  setJsonLdError(err instanceof Error ? err.message : "Invalid JSON");
                }
              }}
            />
            {jsonLdError ? (
              <p className="text-xs text-destructive">
                {jsonLdError} — fix to save changes (last valid value still applied).
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ChipsInput
              label="Related product ids"
              value={value.relatedProductIds ?? []}
              onChange={(next) => set("relatedProductIds", next)}
              placeholder="e.g. floral-1"
            />
            <ChipsInput
              label="Related article slugs"
              value={value.relatedArticleSlugs ?? []}
              onChange={(next) => set("relatedArticleSlugs", next)}
              placeholder="e.g. what-is-kadha"
            />
          </div>
          {kind === "article" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ChipsInput
                label="Hashtags (social)"
                value={value.hashtags ?? []}
                onChange={(next) => set("hashtags", next)}
                placeholder="e.g. #DrTea, #ChaiLife"
                hint="Auto-generated by AI from the post topic; edit or add your own. Used for social sharing."
              />
              <ChipsInput
                label="SEO keywords"
                value={value.seoKeywords ?? []}
                onChange={(next) => set("seoKeywords", next)}
                placeholder="e.g. masala chai recipe"
                hint='Long-tail search keywords. Rendered as a meta keywords tag on the article page.'
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === "meta"}
            onClick={regenerateMeta}
          >
            {busy === "meta" ? "Regenerating…" : "Regenerate AI meta"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === "related"}
            onClick={regenerateRelated}
          >
            {busy === "related" ? "Regenerating…" : "Regenerate related items"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={openInsertPreview}>
            Insert internal links into {targetLabel.toLowerCase()}…
          </Button>
        </div>

        {preview !== null ? (
          <div className="space-y-2 border-t pt-3">
            <Label>
              Preview — these links will be appended to {targetLabel.toLowerCase()}. Edit before
              accepting.
            </Label>
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={acceptInsert}>
                Insert
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPreview(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
