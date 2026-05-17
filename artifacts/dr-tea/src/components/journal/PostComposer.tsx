import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

interface Section {
  heading: string;
  body: string;
}

export default function PostComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("Community");
  const [cover, setCover] = useState("");
  const [sections, setSections] = useState<Section[]>([
    { heading: "", body: "" },
  ]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setTitle("");
    setExcerpt("");
    setCategory("Community");
    setCover("");
    setSections([{ heading: "", body: "" }]);
  }

  async function submit() {
    if (title.trim().length < 6) {
      toast({ title: "Title is too short", variant: "destructive" });
      return;
    }
    if (excerpt.trim().length < 20) {
      toast({ title: "Add a short excerpt (20+ chars)", variant: "destructive" });
      return;
    }
    const cleanSections = sections
      .map((s) => ({
        heading: s.heading.trim() || undefined,
        paragraphs: s.body
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
      }))
      .filter((s) => s.paragraphs.length > 0);
    if (cleanSections.length === 0) {
      toast({ title: "Write at least one paragraph", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/journal/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          excerpt: excerpt.trim(),
          category: category.trim() || "Community",
          cover: cover.trim() || undefined,
          body: cleanSections,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
        message?: string;
      };
      if (!r.ok) {
        toast({
          title: j.error ?? "Couldn't submit post",
          description: j.reason,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Submitted for review",
        description:
          j.message ?? "Your post is in our moderation queue and will appear once approved.",
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Network error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            Write for the Dr Tea Journal
          </DialogTitle>
          <DialogDescription>
            Share a brewing tip, a tea memory, a wellness ritual. Posts are AI-
            and human-reviewed before publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My monsoon kadha ritual"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                Category
              </label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Community"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                Cover image URL (optional)
              </label>
              <Input
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
              Excerpt
            </label>
            <Textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="A 1-2 sentence summary that appears on the journal grid."
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Sections
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setSections((s) => [...s, { heading: "", body: "" }])
                }
              >
                <Plus className="w-3 h-3 mr-1" /> Add section
              </Button>
            </div>
            {sections.map((s, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Section heading (optional)"
                    value={s.heading}
                    onChange={(e) =>
                      setSections((arr) =>
                        arr.map((x, j) =>
                          j === i ? { ...x, heading: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  {sections.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setSections((arr) => arr.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Write paragraphs separated by a blank line."
                  rows={5}
                  value={s.body}
                  onChange={(e) =>
                    setSections((arr) =>
                      arr.map((x, j) =>
                        j === i ? { ...x, body: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
