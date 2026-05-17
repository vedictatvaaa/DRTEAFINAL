import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { uploadImage } from "@/lib/upload-image";
import {
  adminGenerateProductImage,
  type Product,
} from "@workspace/api-client-react";
import { Sparkles, Upload, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

export type ProductImage = NonNullable<Product["images"]>[number];

const HERO_PROMPT = (name: string) =>
  `Premium product photography of a Dr Tea kraft-paper jar of ${name}, sitting on rustic warm-toned wood, soft golden window light, brass spoon and a few loose tea leaves nearby, shallow depth of field, lifestyle scene, the brown kraft jar clearly shows the wordmark "DR TEA" in elegant serif type, cinematic, 3:2 framing.`;

const STUDIO_PROMPT = (name: string, view: string) =>
  `Studio product photography of a Dr Tea kraft-paper jar of ${name}, ${view} view, seamless pure white background, soft even studio lighting, sharp focus, brown kraft paper with elegant "DR TEA" wordmark in serif type clearly visible on the front label, premium retail packaging, square 1:1 framing, no shadows other than a subtle ground shadow.`;

const STUDIO_ANGLES = ["front-facing", "three-quarter angled", "side profile", "top-down with lid removed showing tea leaves"];

export function GalleryEditor({
  productId,
  productName,
  images,
  onChange,
}: {
  productId: string | undefined;
  productName: string;
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
}) {
  const [aiOpen, setAiOpen] = useState<null | { kind: "hero" | "studio"; prompt: string; size: "1024x1024" | "1536x1024" | "1024x1536" }>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const [uploadKind, setUploadKind] = useState<"hero" | "studio">("studio");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange([...images, { url, kind: uploadKind, isAi: false }]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function runAi() {
    if (!aiOpen) return;
    if (!productId) {
      setAiErr("Save the product first, then generate images.");
      return;
    }
    setAiBusy(true);
    setAiErr(null);
    try {
      const updated = await adminGenerateProductImage(productId, {
        kind: aiOpen.kind,
        prompt: aiOpen.prompt,
        size: aiOpen.size,
      });
      onChange(updated.images ?? []);
      setAiOpen(null);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setAiBusy(false);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...images];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange(next);
  }
  function remove(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }
  function setKind(idx: number, kind: "hero" | "studio") {
    onChange(images.map((im, i) => (i === idx ? { ...im, kind } : im)));
  }

  const heroes = images.filter((i) => i.kind === "hero").length;

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Image gallery</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            One lifestyle <em>hero</em> + 3–4 white-background <em>studio</em> shots.
            {heroes === 0 && images.length > 0 && (
              <span className="text-amber-600"> · No hero set — first image will be used.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={uploadKind}
            onChange={(e) => setUploadKind(e.target.value as "hero" | "studio")}
            className="text-xs border border-input rounded px-2 py-1.5 bg-background"
          >
            <option value="hero">Hero</option>
            <option value="studio">Studio</option>
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 mr-1" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {images.length === 0 && (
        <div className="text-xs text-muted-foreground italic px-1 py-2">
          No gallery images yet. Use Upload, or generate with AI below.
        </div>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((im, idx) => (
            <li key={idx} className="rounded border bg-background overflow-hidden">
              <div className="aspect-square bg-muted relative">
                <img src={im.url} alt={im.alt ?? ""} className="w-full h-full object-cover" />
                {im.isAi && (
                  <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wider bg-black/70 text-white px-1.5 py-0.5 rounded">AI</span>
                )}
              </div>
              <div className="p-1.5 space-y-1">
                <select
                  value={im.kind}
                  onChange={(e) => setKind(idx, e.target.value as "hero" | "studio")}
                  className="text-[10px] border border-input rounded px-1 py-0.5 bg-background w-full"
                >
                  <option value="hero">Hero (lifestyle)</option>
                  <option value="studio">Studio (white-bg)</option>
                </select>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, 1)} disabled={idx === images.length - 1} aria-label="Move down">
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto text-destructive" onClick={() => remove(idx)} aria-label="Remove">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            setAiOpen({
              kind: "hero",
              prompt: HERO_PROMPT(productName || "loose-leaf tea"),
              size: "1536x1024",
            })
          }
        >
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Generate hero with AI
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            const studioCount = images.filter((i) => i.kind === "studio").length;
            const view = STUDIO_ANGLES[studioCount % STUDIO_ANGLES.length]!;
            setAiOpen({
              kind: "studio",
              prompt: STUDIO_PROMPT(productName || "loose-leaf tea", view),
              size: "1024x1024",
            });
          }}
        >
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Generate studio shot with AI
        </Button>
      </div>

      <Dialog open={!!aiOpen} onOpenChange={(o) => !o && !aiBusy && setAiOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate {aiOpen?.kind} image with AI</DialogTitle>
            <DialogDescription>
              Tweak the prompt if you want — keep the "DR TEA" wordmark and kraft-paper jar wording for a consistent look.
            </DialogDescription>
          </DialogHeader>
          {aiOpen && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prompt</Label>
                <Textarea
                  rows={6}
                  value={aiOpen.prompt}
                  onChange={(e) => setAiOpen({ ...aiOpen, prompt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Size</Label>
                <select
                  value={aiOpen.size}
                  onChange={(e) =>
                    setAiOpen({ ...aiOpen, size: e.target.value as "1024x1024" | "1536x1024" | "1024x1536" })
                  }
                  className="text-sm border border-input rounded px-2 py-1.5 bg-background w-full"
                >
                  <option value="1024x1024">Square (1024×1024)</option>
                  <option value="1536x1024">Landscape (1536×1024)</option>
                  <option value="1024x1536">Portrait (1024×1536)</option>
                </select>
              </div>
              {!productId && (
                <p className="text-xs text-amber-600">
                  Save this product first — AI generation needs a product ID.
                </p>
              )}
              {aiErr && <p className="text-xs text-destructive">{aiErr}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={aiBusy} onClick={() => setAiOpen(null)}>Cancel</Button>
            <Button disabled={aiBusy || !productId} onClick={runAi}>
              {aiBusy ? (<><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Generating…</>) : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
