import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChefHat,
  Plus,
  Search,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  X,
  ImageIcon,
  Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

interface Ingredient {
  name: string;
  amount: string;
  note?: string;
}
interface Step {
  title?: string;
  body: string;
}
interface Recipe {
  id: number;
  slug: string;
  title: string;
  summary: string;
  hero: string;
  category: string;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  tips: string[];
  relatedProductIds: string[];
  metaTitle: string;
  metaDescription: string;
  published: boolean;
  sortOrder: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  authorLocation?: string | null;
  authorQuote?: string | null;
  origin?: string | null;
  hashtags?: string[] | null;
  seoKeywords?: string[] | null;
  storyMode?: { image: string; title?: string; caption: string }[] | null;
  authorType?: "manual" | "ai";
  status?: "pending" | "approved" | "rejected";
}
interface CategoryStat {
  category: string;
  count: number;
  published: number;
}

async function getJson<T>(p: string): Promise<T> {
  const r = await fetch(`${API}${p}`, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}
async function send<T>(method: string, p: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${p}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

const EMPTY_RECIPE: Omit<Recipe, "id" | "viewCount" | "createdAt" | "updatedAt"> = {
  slug: "",
  title: "",
  summary: "",
  hero: "",
  category: "Chai",
  tags: [],
  difficulty: "easy",
  prepMinutes: 5,
  cookMinutes: 10,
  servings: 2,
  ingredients: [],
  steps: [],
  tips: [],
  relatedProductIds: [],
  metaTitle: "",
  metaDescription: "",
  published: true,
  sortOrder: 0,
};

export default function RecipesTab() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [published, setPublished] = useState<"all" | "true" | "false">("all");
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast: toastFn } = useToast();
  const qc = useQueryClient();

  async function generateNow() {
    setGenerating(true);
    try {
      const r = await send<{ created: number; skipped: boolean }>(
        "POST",
        "/admin/recipes/generate-now",
      );
      toastFn({
        title: r.skipped
          ? "Daily quota already met"
          : `Drafted ${r.created} recipe${r.created === 1 ? "" : "s"}`,
        description: r.skipped
          ? "Try again tomorrow or approve pending drafts."
          : "Hero images, avatars, and story slides are generating in the background.",
      });
      void qc.invalidateQueries({ queryKey: ["admin-recipes"] });
    } catch (err) {
      toastFn({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Try again shortly.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (category !== "all") p.set("category", category);
    if (published !== "all") p.set("published", published);
    if (debounced) p.set("q", debounced);
    return p.toString();
  }, [category, published, debounced]);

  const list = useQuery({
    queryKey: ["admin-recipes", category, published, debounced],
    queryFn: () =>
      getJson<{ recipes: Recipe[] }>(
        `/admin/recipes${params ? `?${params}` : ""}`,
      ),
  });
  const cats = useQuery({
    queryKey: ["admin-recipes-categories"],
    queryFn: () => getJson<{ categories: CategoryStat[] }>("/admin/recipes/categories"),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2416]">Recipes</h1>
          <p className="text-sm text-stone-600">
            Tea-led recipes that link out to the products needed to brew them.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={() => generateNow()}
            data-testid="button-generate-recipes"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-1.5" />
            )}
            Generate now
          </Button>
          <Button
            onClick={() => setCreating(true)}
            className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
            data-testid="button-new-recipe"
          >
            <Plus className="w-4 h-4 mr-1.5" /> New recipe
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total recipes"
          value={(list.data?.recipes.length ?? 0).toString()}
        />
        <StatCard
          label="Published"
          value={(
            list.data?.recipes.filter((r) => r.published).length ?? 0
          ).toString()}
        />
        <StatCard
          label="Categories"
          value={(cats.data?.categories.length ?? 0).toString()}
        />
        <StatCard
          label="Total views"
          value={(
            list.data?.recipes.reduce((s, r) => s + r.viewCount, 0) ?? 0
          ).toLocaleString("en-IN")}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, summary, slug"
            className="pl-9"
            data-testid="input-recipes-search"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 px-3 rounded-md border border-stone-200 bg-white text-sm"
          data-testid="select-recipes-category"
        >
          <option value="all">All categories</option>
          {cats.data?.categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category} ({c.count})
            </option>
          ))}
        </select>
        {(["all", "true", "false"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPublished(s)}
            className={`px-3 h-8 rounded-full text-[12px] font-medium border ${
              published === s
                ? "bg-[#1a2416] text-white border-[#1a2416]"
                : "bg-white text-stone-700 border-stone-200 hover:border-[#1a2416]/40"
            }`}
            data-testid={`filter-recipes-${s}`}
          >
            {s === "all" ? "All" : s === "true" ? "Published" : "Drafts"}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {list.isLoading ? (
          <div className="p-6 text-sm text-stone-500">Loading…</div>
        ) : !list.data?.recipes.length ? (
          <div className="p-12 text-center">
            <ChefHat className="w-10 h-10 mx-auto text-stone-300 mb-2" />
            <div className="text-sm text-stone-600">
              No recipes match. Click <strong>New recipe</strong> to add one.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                  <th className="py-2 px-3 w-12"></th>
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Difficulty</th>
                  <th className="py-2 px-3 text-right">Time</th>
                  <th className="py-2 px-3 text-right">Views</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.data.recipes.map((r) => (
                  <RecipeRow key={r.id} recipe={r} onEdit={() => setEditing(r)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(editing || creating) && (
        <RecipeEditor
          recipe={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#1a2416]">{value}</div>
    </Card>
  );
}

function RecipeRow({ recipe, onEdit }: { recipe: Recipe; onEdit: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const togglePub = useMutation({
    mutationFn: () =>
      send<{ recipe: Recipe }>("PATCH", `/admin/recipes/${recipe.id}`, {
        published: !recipe.published,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-recipes"] });
      void qc.invalidateQueries({ queryKey: ["admin-recipes-categories"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not toggle", description: err.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: () => send<{ ok: true }>("DELETE", `/admin/recipes/${recipe.id}`),
    onSuccess: () => {
      toast({ title: "Recipe deleted" });
      void qc.invalidateQueries({ queryKey: ["admin-recipes"] });
      void qc.invalidateQueries({ queryKey: ["admin-recipes-categories"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not delete", description: err.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: () => send<{ recipe: Recipe }>("POST", `/admin/recipes/${recipe.id}/approve`),
    onSuccess: () => {
      toast({ title: "Recipe approved" });
      void qc.invalidateQueries({ queryKey: ["admin-recipes"] });
    },
    onError: (err: Error) =>
      toast({ title: "Approve failed", description: err.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: () => send<{ recipe: Recipe }>("POST", `/admin/recipes/${recipe.id}/reject`),
    onSuccess: () => {
      toast({ title: "Recipe rejected" });
      void qc.invalidateQueries({ queryKey: ["admin-recipes"] });
    },
    onError: (err: Error) =>
      toast({ title: "Reject failed", description: err.message, variant: "destructive" }),
  });

  const regen = useMutation({
    mutationFn: () =>
      send<{ ok: true }>("POST", `/admin/recipes/${recipe.id}/regenerate-image`),
    onSuccess: () => {
      toast({ title: "Regenerating image…", description: "Refresh in a minute." });
      void qc.invalidateQueries({ queryKey: ["admin-recipes"] });
    },
    onError: (err: Error) =>
      toast({ title: "Regenerate failed", description: err.message, variant: "destructive" }),
  });

  const isPending = recipe.status === "pending";

  const totalMin = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <tr className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
      <td className="py-2 px-3">
        {recipe.hero ? (
          <img
            src={recipe.hero}
            alt=""
            className="w-10 h-10 rounded object-cover bg-stone-100"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-stone-100 flex items-center justify-center text-stone-400">
            <ImageIcon className="w-4 h-4" />
          </div>
        )}
      </td>
      <td className="py-2 px-3">
        <button
          type="button"
          onClick={onEdit}
          className="text-left hover:underline"
          data-testid={`button-edit-recipe-${recipe.id}`}
        >
          <div className="font-medium text-[#1a2416]">{recipe.title}</div>
          <div className="text-[12px] text-stone-500 font-mono">/{recipe.slug}</div>
        </button>
      </td>
      <td className="py-2 px-3">
        <Badge variant="secondary" className="bg-stone-100 text-stone-700">
          {recipe.category}
        </Badge>
      </td>
      <td className="py-2 px-3 text-[12px] capitalize">{recipe.difficulty}</td>
      <td className="py-2 px-3 text-right tabular-nums text-[12px] text-stone-600">
        {totalMin}m
      </td>
      <td className="py-2 px-3 text-right tabular-nums text-[12px] text-stone-600">
        {recipe.viewCount.toLocaleString("en-IN")}
      </td>
      <td className="py-2 px-3">
        <div className="flex flex-col gap-1 items-start">
          <button
            type="button"
            onClick={() => togglePub.mutate()}
            disabled={togglePub.isPending}
            className={`inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] font-medium border ${
              recipe.published
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
            }`}
            data-testid={`button-toggle-pub-${recipe.id}`}
          >
            {recipe.published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {recipe.published ? "Published" : "Draft"}
          </button>
          {recipe.status && recipe.status !== "approved" && (
            <span
              className={`inline-flex items-center px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                recipe.status === "pending"
                  ? "bg-sky-50 text-sky-800 border border-sky-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {recipe.status}
            </span>
          )}
          {recipe.authorType === "ai" && (
            <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-wider bg-violet-50 text-violet-800 border border-violet-200">
              <Wand2 className="w-2.5 h-2.5" /> AI
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {isPending && (
            <>
              <button
                type="button"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="px-2 h-7 rounded text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                data-testid={`button-approve-recipe-${recipe.id}`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => reject.mutate()}
                disabled={reject.isPending}
                className="px-2 h-7 rounded text-[11px] font-semibold border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                data-testid={`button-reject-recipe-${recipe.id}`}
              >
                Reject
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => regen.mutate()}
            disabled={regen.isPending}
            className="p-1.5 text-stone-400 hover:text-violet-600 rounded"
            aria-label="Regenerate image"
            title="Regenerate hero image"
            data-testid={`button-regen-recipe-${recipe.id}`}
          >
            {regen.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${recipe.title}"? This cannot be undone.`)) {
                del.mutate();
              }
            }}
            disabled={del.isPending}
            className="p-1.5 text-stone-400 hover:text-rose-600 rounded"
            aria-label="Delete"
            data-testid={`button-delete-recipe-${recipe.id}`}
          >
            {del.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

function RecipeEditor({
  recipe,
  onClose,
}: {
  recipe: Recipe | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(() =>
    recipe
      ? {
          slug: recipe.slug,
          title: recipe.title,
          summary: recipe.summary,
          hero: recipe.hero,
          category: recipe.category,
          tags: recipe.tags,
          difficulty: recipe.difficulty,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          servings: recipe.servings,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tips: recipe.tips,
          relatedProductIds: recipe.relatedProductIds,
          metaTitle: recipe.metaTitle,
          metaDescription: recipe.metaDescription,
          published: recipe.published,
          sortOrder: recipe.sortOrder,
        }
      : { ...EMPTY_RECIPE },
  );

  const save = useMutation({
    mutationFn: () => {
      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.summary.trim()) throw new Error("Summary is required.");
      const body = { ...form, slug: form.slug.trim() || undefined };
      return recipe
        ? send<{ recipe: Recipe }>("PATCH", `/admin/recipes/${recipe.id}`, body)
        : send<{ recipe: Recipe }>("POST", "/admin/recipes", body);
    },
    onSuccess: () => {
      toast({ title: recipe ? "Recipe updated" : "Recipe created" });
      void qc.invalidateQueries({ queryKey: ["admin-recipes"] });
      void qc.invalidateQueries({ queryKey: ["admin-recipes-categories"] });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title={recipe ? `Edit: ${recipe.title}` : "New recipe"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                data-testid="input-recipe-title"
              />
            </Field>
          </div>
          <Field label="Slug (auto if blank)">
            <Input
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="auto-generated"
              data-testid="input-recipe-slug"
            />
          </Field>
        </div>
        <Field label="Summary">
          <Textarea
            value={form.summary}
            onChange={(e) => update("summary", e.target.value)}
            rows={2}
            data-testid="input-recipe-summary"
          />
        </Field>
        <Field label="Hero image URL">
          <Input
            value={form.hero}
            onChange={(e) => update("hero", e.target.value)}
            placeholder="https://… or /path/to/image.jpg"
            data-testid="input-recipe-hero"
          />
        </Field>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Category">
            <Input
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              data-testid="input-recipe-category"
            />
          </Field>
          <Field label="Difficulty">
            <select
              value={form.difficulty}
              onChange={(e) =>
                update("difficulty", e.target.value as Recipe["difficulty"])
              }
              className="w-full h-10 px-3 rounded-md border border-stone-200 bg-white text-sm"
              data-testid="select-recipe-difficulty"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>
          <Field label="Prep (min)">
            <Input
              type="number"
              value={form.prepMinutes}
              onChange={(e) => update("prepMinutes", Number(e.target.value) || 0)}
              data-testid="input-recipe-prep"
            />
          </Field>
          <Field label="Cook (min)">
            <Input
              type="number"
              value={form.cookMinutes}
              onChange={(e) => update("cookMinutes", Number(e.target.value) || 0)}
              data-testid="input-recipe-cook"
            />
          </Field>
          <Field label="Servings">
            <Input
              type="number"
              value={form.servings}
              onChange={(e) => update("servings", Number(e.target.value) || 1)}
              data-testid="input-recipe-servings"
            />
          </Field>
        </div>

        <Field label="Tags (comma separated)">
          <Input
            value={form.tags.join(", ")}
            onChange={(e) =>
              update(
                "tags",
                e.target.value
                  .split(",")
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean),
              )
            }
            placeholder="iced, summer, refreshing"
            data-testid="input-recipe-tags"
          />
        </Field>

        <ListEditor
          label="Ingredients"
          items={form.ingredients}
          onChange={(v) => update("ingredients", v)}
          empty={{ name: "", amount: "" }}
          render={(it, on) => (
            <>
              <Input
                value={it.name}
                onChange={(e) => on({ ...it, name: e.target.value })}
                placeholder="Ingredient"
                className="md:col-span-5"
              />
              <Input
                value={it.amount}
                onChange={(e) => on({ ...it, amount: e.target.value })}
                placeholder="Amount (e.g. 1 tsp)"
                className="md:col-span-3"
              />
              <Input
                value={it.note ?? ""}
                onChange={(e) => on({ ...it, note: e.target.value })}
                placeholder="Note (optional)"
                className="md:col-span-4"
              />
            </>
          )}
        />

        <ListEditor
          label="Steps"
          items={form.steps}
          onChange={(v) => update("steps", v)}
          empty={{ body: "" }}
          render={(it, on) => (
            <>
              <Input
                value={it.title ?? ""}
                onChange={(e) => on({ ...it, title: e.target.value })}
                placeholder="Step title (optional)"
                className="md:col-span-4"
              />
              <Textarea
                value={it.body}
                onChange={(e) => on({ ...it, body: e.target.value })}
                placeholder="Step description"
                rows={2}
                className="md:col-span-8"
              />
            </>
          )}
        />

        <ListEditor
          label="Tips"
          items={form.tips}
          onChange={(v) => update("tips", v)}
          empty=""
          render={(it, on) => (
            <Input
              value={it}
              onChange={(e) => on(e.target.value)}
              placeholder="Tip"
              className="md:col-span-12"
            />
          )}
        />

        <Field label="Related product IDs (comma separated)">
          <Input
            value={form.relatedProductIds.join(", ")}
            onChange={(e) =>
              update(
                "relatedProductIds",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="masala-chai-blend, ginger-fresh"
            data-testid="input-recipe-related"
          />
        </Field>

        <details className="border border-stone-200 rounded p-3">
          <summary className="cursor-pointer text-sm font-medium text-[#1a2416]">
            SEO &amp; sort order
          </summary>
          <div className="mt-3 space-y-3">
            <Field label="Meta title">
              <Input
                value={form.metaTitle}
                onChange={(e) => update("metaTitle", e.target.value)}
                placeholder="defaults to title"
              />
            </Field>
            <Field label="Meta description">
              <Textarea
                value={form.metaDescription}
                onChange={(e) => update("metaDescription", e.target.value)}
                placeholder="defaults to summary"
                rows={2}
              />
            </Field>
            <Field label="Sort order (higher = first)">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => update("sortOrder", Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        </details>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => update("published", e.target.checked)}
            data-testid="checkbox-recipe-published"
          />
          <span>Published</span>
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.title.trim() || !form.summary.trim()}
          className="bg-[#1a2416] text-white hover:bg-[#1a2416]/90"
          data-testid="button-save-recipe"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-stone-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ListEditor<T>({
  label,
  items,
  onChange,
  empty,
  render,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  render: (item: T, onItemChange: (next: T) => void) => React.ReactNode;
}) {
  const update = (idx: number, next: T) => {
    const copy = items.slice();
    copy[idx] = next;
    onChange(copy);
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, structuredClone(empty)]);
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const copy = items.slice();
    [copy[idx], copy[j]] = [copy[j]!, copy[idx]!];
    onChange(copy);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[12px] font-semibold text-stone-700">
          {label} <span className="text-stone-400">({items.length})</span>
        </label>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-[12px] text-[#3a5a2c] hover:text-[#1a2416]"
          data-testid={`button-add-${label.toLowerCase()}`}
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-[12px] text-stone-400 italic px-2 py-3 border border-dashed border-stone-200 rounded">
            No {label.toLowerCase()} yet.
          </div>
        )}
        {items.map((it, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start bg-stone-50 p-2 rounded"
          >
            <div className="md:col-span-12 md:hidden text-[11px] text-stone-500">
              #{idx + 1}
            </div>
            <div className="hidden md:flex md:col-span-12 items-start gap-2">
              <div className="flex flex-col gap-0.5 pt-2">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  className="text-stone-400 hover:text-[#1a2416] text-[10px]"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <GripVertical className="w-3 h-3 text-stone-300" />
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  className="text-stone-400 hover:text-[#1a2416] text-[10px]"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <div className="grid grid-cols-12 gap-2 flex-1">
                {render(it, (next) => update(idx, next))}
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="p-1.5 text-stone-400 hover:text-rose-600"
                aria-label="Remove"
                data-testid={`button-remove-${label.toLowerCase()}-${idx}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="md:hidden col-span-1 flex flex-col gap-2 w-full">
              {render(it, (next) => update(idx, next))}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="self-end text-rose-600 text-[12px] inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/50"
      />
      <div className="relative w-full max-w-3xl bg-white rounded-lg shadow-2xl p-5 my-8">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-stone-100 -mx-5 px-5">
          <h2 className="text-lg font-semibold text-[#1a2416]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-[#1a2416] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
