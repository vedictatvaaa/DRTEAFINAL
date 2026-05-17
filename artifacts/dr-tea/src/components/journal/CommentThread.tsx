import { useEffect, useState } from "react";
import { useShopper } from "@/lib/shopper-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import SignInModal from "./SignInModal";

const API = `${import.meta.env.BASE_URL}api`;

interface Comment {
  id: number;
  authorName: string;
  body: string;
  createdAt: string;
}

export default function CommentThread({ slug }: { slug: string }) {
  const { user } = useShopper();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/journal/articles/${encodeURIComponent(slug)}/comments`);
      const j = (await r.json()) as Comment[];
      setComments(j);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [slug]);

  async function submit() {
    if (!user) {
      setSignInOpen(true);
      return;
    }
    if (body.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await fetch(
        `${API}/journal/articles/${encodeURIComponent(slug)}/comments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim() }),
        },
      );
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
        message?: string;
      };
      if (!r.ok) {
        toast({
          title: j.error ?? "Couldn't post comment",
          description: j.reason,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Sent for review",
        description:
          j.message ?? "Your comment will appear here once approved.",
      });
      setBody("");
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
    <section className="container mx-auto px-4 sm:px-6 pb-10 pt-8 max-w-3xl border-t border-border">
      <h3 className="text-xl font-serif font-semibold mb-1 mt-6">Comments</h3>
      <p className="text-xs text-muted-foreground mb-5">
        Be kind — every comment is reviewed before going live.
      </p>

      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        {user ? (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              Posting as <span className="font-medium text-foreground">{user.name || user.email}</span>
            </p>
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your take…"
            />
            <div className="flex justify-end mt-3">
              <Button onClick={submit} disabled={busy || body.trim().length < 2}>
                {busy ? "Sending…" : "Post comment"}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              Sign in to leave a comment.
            </p>
            <Button onClick={() => setSignInOpen(true)}>Sign in to comment</Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Be the first to comment.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="border-b border-border pb-4 last:border-b-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{c.authorName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <SignInModal
        open={signInOpen}
        onOpenChange={setSignInOpen}
        onSignedIn={load}
      />
    </section>
  );
}
