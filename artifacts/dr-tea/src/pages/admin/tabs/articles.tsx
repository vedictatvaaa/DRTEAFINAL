import { useState } from "react";
import {
  useAdminListArticles,
  useAdminCreateArticle,
  useAdminUpdateArticle,
  useAdminDeleteArticle,
  useAdminSeoRegenerateArticleImage,
  useAdminSeoSetArticleCover,
  getAdminListArticlesQueryKey,
  type Article,
  type ArticleInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageField } from "@/components/admin/ImageField";
import { SeoEditorSection } from "@/components/admin/SeoEditorSection";
import { useToast } from "@/hooks/use-toast";

type EditState = Partial<Article> & { id?: number };

type Section = { heading?: string; paragraphs: string[] };

function bodyToMarkdown(body: Section[]): string {
  return body
    .map((s) => {
      const head = s.heading ? `## ${s.heading}\n\n` : "";
      return head + (s.paragraphs ?? []).join("\n\n");
    })
    .join("\n\n");
}

function markdownToBody(md: string): Section[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let current: Section = { paragraphs: [] };
  let buf: string[] = [];
  const flushPara = () => {
    const text = buf.join("\n").trim();
    if (text) current.paragraphs.push(text);
    buf = [];
  };
  const flushSection = () => {
    flushPara();
    if (current.heading || current.paragraphs.length) sections.push(current);
  };
  for (const line of lines) {
    const headingMatch = /^##\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushSection();
      current = { heading: headingMatch[1].trim(), paragraphs: [] };
    } else if (line.trim() === "") {
      flushPara();
    } else {
      buf.push(line);
    }
  }
  flushSection();
  return sections.length ? sections : [{ paragraphs: [] }];
}

const EMPTY: EditState = {
  slug: "",
  title: "",
  excerpt: "",
  category: "Brewing Guide",
  readTime: "5 min read",
  date: new Date().toISOString().slice(0, 10),
  cover: "",
  body: [{ paragraphs: [""] }],
  published: true,
};

function toInput(v: EditState): ArticleInput {
  return {
    slug: v.slug ?? "",
    title: v.title ?? "",
    excerpt: v.excerpt ?? "",
    category: v.category ?? "",
    readTime: v.readTime ?? "",
    date: v.date ?? new Date().toISOString().slice(0, 10),
    cover: v.cover ?? "",
    body: v.body ?? [],
    published: v.published ?? true,
    metaTitle: v.metaTitle ?? undefined,
    metaDescription: v.metaDescription ?? undefined,
    jsonLd: v.jsonLd ?? undefined,
    relatedProductIds: v.relatedProductIds ?? undefined,
    relatedArticleSlugs: v.relatedArticleSlugs ?? undefined,
    hashtags: v.hashtags ?? undefined,
    seoKeywords: v.seoKeywords ?? undefined,
  };
}

export default function ArticlesTab() {
  const list = useAdminListArticles();
  const create = useAdminCreateArticle();
  const update = useAdminUpdateArticle();
  const del = useAdminDeleteArticle();
  const regenImage = useAdminSeoRegenerateArticleImage();
  const setCover = useAdminSeoSetArticleCover();
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: getAdminListArticlesQueryKey() });

  const [editing, setEditing] = useState<EditState | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  async function handleRegenerateImage() {
    if (!editing?.id) {
      toast({ title: "Save first", description: "Save the article before regenerating its hero image." });
      return;
    }
    setImageBusy(true);
    try {
      const r = await regenImage.mutateAsync({ id: editing.id });
      setEditing((cur) => (cur ? { ...cur, cover: r.url } : cur));
      refresh();
      toast({ title: "Hero image regenerated", description: "A fresh AI cover was saved to this article." });
    } catch (err) {
      toast({
        title: "Image regenerate failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImageBusy(false);
    }
  }

  async function persistUploadedCover(url: string) {
    if (!editing?.id) return;
    try {
      await setCover.mutateAsync({ id: editing.id, data: { url } });
      refresh();
      toast({ title: "Cover image updated" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const articles: Article[] = list.data ?? [];

  async function togglePublished(a: Article) {
    await update.mutateAsync({
      id: a.id,
      data: toInput({ ...a, published: !a.published }),
    });
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-medium">{articles.length} articles</h2>
        <Button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>New article</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2 font-medium">{a.title}<div className="text-xs text-muted-foreground">{a.slug}</div></td>
                <td className="px-4 py-2">{a.category}</td>
                <td className="px-4 py-2">{a.date}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {a.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => togglePublished(a)}>
                    {a.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(a); setIsNew(false); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete "${a.title}"?`)) return;
                    await del.mutateAsync({ id: a.id });
                    refresh();
                  }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isNew ? "New article" : `Edit ${editing?.title}`}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Date</Label><Input value={editing.date ?? ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Category</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Read time</Label><Input value={editing.readTime ?? ""} onChange={(e) => setEditing({ ...editing, readTime: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="space-y-1.5">
                <ImageField
                  label="Cover image"
                  value={editing.cover ?? ""}
                  onChange={(url) => setEditing({ ...editing, cover: url })}
                  onUploaded={(url) => void persistUploadedCover(url)}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={imageBusy || !editing.id}
                    onClick={handleRegenerateImage}
                  >
                    {imageBusy ? "Regenerating…" : "Regenerate AI hero image"}
                  </Button>
                  <span className="text-[11px] text-muted-foreground self-center">
                    {editing.id
                      ? "Upload replaces the cover and saves immediately. Regenerate brews a fresh AI cover."
                      : "Save the article first — Upload and Regenerate persist directly to this article on the server."}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Excerpt</Label><Textarea rows={2} value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.published ?? true} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />
                Published (visible on storefront)
              </label>
              <div className="space-y-1.5">
                <Label>Body <span className="text-xs text-muted-foreground">(Markdown: use `## Heading` for sections; blank lines separate paragraphs)</span></Label>
                <Textarea
                  rows={14}
                  value={bodyToMarkdown(editing.body ?? [])}
                  onChange={(e) => setEditing({ ...editing, body: markdownToBody(e.target.value) })}
                />
              </div>
              <SeoEditorSection
                kind="article"
                itemId={editing.id}
                value={{
                  metaTitle: editing.metaTitle,
                  metaDescription: editing.metaDescription,
                  jsonLd: editing.jsonLd,
                  relatedProductIds: editing.relatedProductIds,
                  relatedArticleSlugs: editing.relatedArticleSlugs,
                  hashtags: editing.hashtags,
                  seoKeywords: editing.seoKeywords,
                }}
                onChange={(seo) => setEditing({ ...editing, ...seo })}
                targetLabel="Body"
                targetText={bodyToMarkdown(editing.body ?? [])}
                onTargetTextChange={(t) =>
                  setEditing({ ...editing, body: markdownToBody(t) })
                }
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={create.isPending || update.isPending}
              onClick={async () => {
                if (!editing) return;
                const data = toInput(editing);
                if (isNew) {
                  await create.mutateAsync({ data });
                } else if (editing.id != null) {
                  await update.mutateAsync({ id: editing.id, data });
                }
                setEditing(null);
                refresh();
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
