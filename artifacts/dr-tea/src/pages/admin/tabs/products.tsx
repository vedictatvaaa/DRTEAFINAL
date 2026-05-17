import { useMemo, useState } from "react";
import {
  useAdminListProducts,
  useAdminCreateProduct,
  useAdminUpdateProduct,
  useAdminDeleteProduct,
  useAdminReorderProducts,
  getAdminListProductsQueryKey,
  type Product,
  type ProductInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageField } from "@/components/admin/ImageField";
import { GalleryEditor } from "@/components/admin/GalleryEditor";
import { ChipsInput } from "@/components/admin/ChipsInput";
import { VariantsEditor } from "@/components/admin/VariantsEditor";
import { BrewingGuideEditor } from "@/components/admin/BrewingGuideEditor";
import { SeoEditorSection } from "@/components/admin/SeoEditorSection";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown } from "lucide-react";

type EditState = Partial<Product>;

const EMPTY: EditState = {
  id: "",
  slug: "",
  name: "",
  category: "Floral Tisane",
  description: "",
  shortDescription: "",
  price: 0,
  rating: 0,
  reviewCount: 0,
  imageUrl: "",
  images: [],
  variants: [{ size: "250g", price: 0, stock: 0 }],
  tastingNotes: [],
  ingredients: [],
  wellnessBenefits: [],
  brewingGuide: { temperature: "", steepTime: "", cupSize: "", teaAmount: "", steps: [] },
  origin: "",
  harvestSeason: "",
  caffeineLevel: "low",
  flavorProfile: [],
  wellnessFocus: [],
  brewingType: "",
  ritualStyle: "",
  fomoTag: null,
  categoryTheme: {
    primary: "330 60% 65%",
    accent: "280 40% 60%",
    bg: "340 30% 96%",
    gradient: "linear-gradient(135deg, hsl(340 30% 96%), hsl(280 30% 96%))",
    dark: "330 40% 20%",
  },
  pairsWith: [],
  moodTags: [],
  plantationStory: "",
};

function toInput(v: EditState): ProductInput {
  return {
    id: v.id ?? "",
    slug: v.slug ?? "",
    name: v.name ?? "",
    category: v.category ?? "",
    description: v.description ?? "",
    shortDescription: v.shortDescription ?? "",
    price: v.price ?? 0,
    rating: v.rating ?? 0,
    reviewCount: v.reviewCount ?? 0,
    variants: v.variants ?? [],
    tastingNotes: v.tastingNotes ?? [],
    ingredients: v.ingredients ?? [],
    wellnessBenefits: v.wellnessBenefits ?? [],
    brewingGuide: v.brewingGuide ?? { temperature: "", steepTime: "", cupSize: "", teaAmount: "", steps: [] },
    origin: v.origin ?? "",
    harvestSeason: v.harvestSeason ?? "",
    caffeineLevel: v.caffeineLevel ?? "low",
    flavorProfile: v.flavorProfile ?? [],
    wellnessFocus: v.wellnessFocus ?? [],
    brewingType: v.brewingType ?? "",
    ritualStyle: v.ritualStyle ?? "",
    fomoTag: v.fomoTag ?? null,
    imageUrl: v.imageUrl ?? "",
    images: v.images ?? [],
    categoryTheme: v.categoryTheme ?? {
      primary: "330 60% 65%",
      accent: "280 40% 60%",
      bg: "340 30% 96%",
      gradient: "linear-gradient(135deg, hsl(340 30% 96%), hsl(280 30% 96%))",
      dark: "330 40% 20%",
    },
    pairsWith: v.pairsWith ?? [],
    moodTags: v.moodTags ?? [],
    plantationStory: v.plantationStory ?? "",
    metaTitle: v.metaTitle ?? undefined,
    metaDescription: v.metaDescription ?? undefined,
    jsonLd: v.jsonLd ?? undefined,
    relatedProductIds: v.relatedProductIds ?? undefined,
    relatedArticleSlugs: v.relatedArticleSlugs ?? undefined,
  };
}

interface ValidationResult {
  errors: Record<string, string>;
  variantErrors: string[];
}

function validate(v: EditState): ValidationResult {
  const errors: Record<string, string> = {};
  const variantErrors: string[] = [];

  if (!v.id?.trim()) errors.id = "ID is required";
  else if (!/^[a-z0-9-]+$/.test(v.id)) errors.id = "ID must be lowercase letters, numbers, or dashes";
  if (!v.slug?.trim()) errors.slug = "URL slug is required";
  else if (!/^[a-z0-9-]+$/.test(v.slug)) errors.slug = "Slug must be lowercase letters, numbers, or dashes";
  if (!v.name?.trim()) errors.name = "Name is required";
  if (!v.category?.trim()) errors.category = "Category is required";
  if ((v.price ?? 0) < 0) errors.price = "Price cannot be negative";

  const variants = v.variants ?? [];
  if (variants.length === 0) {
    errors.variants = "At least one variant is required";
  } else {
    const sizes = new Set<string>();
    variants.forEach((vr, i) => {
      if (!vr.size?.trim()) variantErrors.push(`Variant ${i + 1}: size is required`);
      else if (sizes.has(vr.size)) variantErrors.push(`Variant ${i + 1}: size "${vr.size}" is duplicated`);
      else sizes.add(vr.size);
      if (vr.price < 0 || !Number.isFinite(vr.price)) variantErrors.push(`Variant ${i + 1}: price must be ≥ 0`);
      if (vr.stock < 0 || !Number.isFinite(vr.stock)) variantErrors.push(`Variant ${i + 1}: stock must be ≥ 0`);
    });
  }

  return { errors, variantErrors };
}

export default function ProductsTab() {
  const list = useAdminListProducts();
  const create = useAdminCreateProduct();
  const update = useAdminUpdateProduct();
  const del = useAdminDeleteProduct();
  const reorder = useAdminReorderProducts();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });
  const { toast } = useToast();

  const [editing, setEditing] = useState<EditState | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const products: Product[] = list.data ?? [];

  async function move(idx: number, dir: -1 | 1) {
    const next = [...products];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    await reorder.mutateAsync({ data: { order: next.map((p) => p.id) } });
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-medium">{products.length} products</h2>
        <Button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); setShowErrors(false); }}>New product</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-2 py-2 w-20">Order</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr key={p.id} className="border-t">
                <td className="px-2 py-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" disabled={idx === 0 || reorder.isPending} onClick={() => move(idx, -1)} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={idx === products.length - 1 || reorder.isPending} onClick={() => move(idx, 1)} aria-label="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-2 font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.slug}</div></td>
                <td className="px-4 py-2">{p.category}</td>
                <td className="px-4 py-2">₹{p.price}</td>
                <td className="px-4 py-2">{(p.variants ?? []).reduce((s, v) => s + (v.stock ?? 0), 0)}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p); setIsNew(false); setShowErrors(false); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete "${p.name}"?`)) return;
                    await del.mutateAsync({ id: p.id });
                    refresh();
                  }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "New product" : `Edit ${editing?.name}`}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProductForm
              value={editing}
              onChange={setEditing}
              showErrors={showErrors}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={create.isPending || update.isPending}
              onClick={async () => {
                if (!editing) return;
                const { errors, variantErrors } = validate(editing);
                const errorCount = Object.keys(errors).length + variantErrors.length;
                if (errorCount > 0) {
                  setShowErrors(true);
                  toast({
                    title: "Please fix the highlighted fields",
                    description: `${errorCount} issue${errorCount === 1 ? "" : "s"} need attention before saving.`,
                  });
                  return;
                }
                const data = toInput(editing);
                if (isNew) {
                  await create.mutateAsync({ data });
                } else if (editing.id) {
                  await update.mutateAsync({ id: editing.id, data });
                }
                setEditing(null);
                setShowErrors(false);
                refresh();
                toast({ title: isNew ? "Product created" : "Product saved" });
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

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}

function ProductForm({
  value,
  onChange,
  showErrors,
}: {
  value: EditState;
  onChange: (v: EditState) => void;
  showErrors: boolean;
}) {
  const set = <K extends keyof Product>(k: K, v: Product[K]) => onChange({ ...value, [k]: v });
  const { errors, variantErrors } = useMemo(() => validate(value), [value]);
  const err = (k: string) => (showErrors ? errors[k] : undefined);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ID (slug-like, unique)</Label>
          <Input value={value.id ?? ""} onChange={(e) => set("id", e.target.value)} aria-invalid={!!err("id")} />
          <FieldError msg={err("id")} />
        </div>
        <div className="space-y-1.5">
          <Label>URL slug</Label>
          <Input value={value.slug ?? ""} onChange={(e) => set("slug", e.target.value)} aria-invalid={!!err("slug")} />
          <FieldError msg={err("slug")} />
        </div>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={value.name ?? ""} onChange={(e) => set("name", e.target.value)} aria-invalid={!!err("name")} />
          <FieldError msg={err("name")} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Input value={value.category ?? ""} onChange={(e) => set("category", e.target.value)} aria-invalid={!!err("category")} />
          <FieldError msg={err("category")} />
        </div>
        <div className="space-y-1.5">
          <Label>Price (INR)</Label>
          <Input type="number" value={value.price ?? 0} onChange={(e) => set("price", Number(e.target.value))} aria-invalid={!!err("price")} />
          <FieldError msg={err("price")} />
        </div>
        <div className="space-y-1.5"><Label>Origin</Label><Input value={value.origin ?? ""} onChange={(e) => set("origin", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Harvest season</Label><Input value={value.harvestSeason ?? ""} onChange={(e) => set("harvestSeason", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Caffeine level</Label><Input value={value.caffeineLevel ?? "low"} onChange={(e) => set("caffeineLevel", e.target.value as Product["caffeineLevel"])} /></div>
        <div className="space-y-1.5"><Label>Brewing type</Label><Input value={value.brewingType ?? ""} onChange={(e) => set("brewingType", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Ritual style</Label><Input value={value.ritualStyle ?? ""} onChange={(e) => set("ritualStyle", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Rating</Label><Input type="number" step="0.1" value={value.rating ?? 0} onChange={(e) => set("rating", Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>Review count</Label><Input type="number" value={value.reviewCount ?? 0} onChange={(e) => set("reviewCount", Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>FOMO tag (optional)</Label><Input value={value.fomoTag ?? ""} onChange={(e) => set("fomoTag", e.target.value || null)} /></div>
      </div>

      <ImageField label="Main image (legacy fallback — used if gallery is empty)" value={value.imageUrl ?? ""} onChange={(url) => set("imageUrl", url)} />
      <GalleryEditor
        productId={value.id || undefined}
        productName={value.name ?? ""}
        images={value.images ?? []}
        onChange={(imgs) => set("images", imgs)}
      />
      <p className="text-[11px] text-muted-foreground italic">
        * Pack designs and formats may change periodically — this disclaimer is shown to shoppers under the gallery.
      </p>

      <div className="space-y-1.5"><Label>Short description</Label><Textarea rows={2} value={value.shortDescription ?? ""} onChange={(e) => set("shortDescription", e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Description</Label><Textarea rows={4} value={value.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Plantation story</Label><Textarea rows={3} value={value.plantationStory ?? ""} onChange={(e) => set("plantationStory", e.target.value)} /></div>

      <VariantsEditor
        value={value.variants ?? []}
        onChange={(next) => set("variants", next)}
        errors={showErrors ? [...(errors.variants ? [errors.variants] : []), ...variantErrors] : []}
      />

      <BrewingGuideEditor
        value={value.brewingGuide ?? { temperature: "", steepTime: "", cupSize: "", teaAmount: "", steps: [] }}
        onChange={(next) => set("brewingGuide", next)}
      />

      <ChipsInput
        label="Tasting notes"
        value={value.tastingNotes ?? []}
        onChange={(next) => set("tastingNotes", next)}
        placeholder="e.g. honey, citrus, malt"
      />
      <ChipsInput
        label="Ingredients"
        value={value.ingredients ?? []}
        onChange={(next) => set("ingredients", next)}
        placeholder="e.g. Chamomile flowers"
      />
      <ChipsInput
        label="Wellness benefits"
        value={value.wellnessBenefits ?? []}
        onChange={(next) => set("wellnessBenefits", next)}
        placeholder="e.g. Supports calm sleep"
      />
      <ChipsInput
        label="Flavor profile"
        value={value.flavorProfile ?? []}
        onChange={(next) => set("flavorProfile", next)}
        placeholder="e.g. floral, sweet, herbal"
      />
      <ChipsInput
        label="Wellness focus"
        value={value.wellnessFocus ?? []}
        onChange={(next) => set("wellnessFocus", next)}
        placeholder="e.g. sleep, immunity"
      />
      <ChipsInput
        label="Pairs with"
        value={value.pairsWith ?? []}
        onChange={(next) => set("pairsWith", next)}
        placeholder="e.g. dark chocolate, biscotti"
      />
      <ChipsInput
        label="Mood tags"
        value={value.moodTags ?? []}
        onChange={(next) => set("moodTags", next)}
        placeholder="e.g. cozy, focused"
      />

      <SeoEditorSection
        kind="product"
        itemId={value.id || undefined}
        value={{
          metaTitle: value.metaTitle,
          metaDescription: value.metaDescription,
          jsonLd: value.jsonLd,
          relatedProductIds: value.relatedProductIds,
          relatedArticleSlugs: value.relatedArticleSlugs,
        }}
        onChange={(seo) => onChange({ ...value, ...seo })}
        targetLabel="Description"
        targetText={value.description ?? ""}
        onTargetTextChange={(t) => set("description", t)}
      />

      <details className="rounded-md border border-dashed p-3">
        <summary className="text-sm cursor-pointer">Advanced — Category theme (HSL strings + gradient)</summary>
        <Textarea
          rows={6}
          className="mt-2 font-mono text-xs"
          value={JSON.stringify(value.categoryTheme ?? {}, null, 2)}
          onChange={(e) => {
            try {
              onChange({ ...value, categoryTheme: JSON.parse(e.target.value) });
            } catch {
              /* ignore live JSON errors while typing */
            }
          }}
        />
      </details>
    </div>
  );
}
