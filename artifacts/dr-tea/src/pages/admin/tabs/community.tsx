import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Sparkles, RefreshCw, MessageSquare, FileText } from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

interface PendingArticle {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  authorType: "admin" | "ai" | "shopper";
  authorName: string;
  status: "pending" | "approved" | "rejected";
  moderationReason: string | null;
  createdAt: string;
  body: Array<{ heading?: string; paragraphs: string[] }>;
}

interface PendingComment {
  id: number;
  articleSlug: string;
  authorName: string;
  authorEmail: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  moderationReason: string | null;
  createdAt: string;
}

export default function CommunityTab() {
  const { toast } = useToast();
  const [articles, setArticles] = useState<PendingArticle[]>([]);
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/journal/queue`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as {
        pendingArticles: PendingArticle[];
        pendingComments: PendingComment[];
      };
      setArticles(j.pendingArticles);
      setComments(j.pendingComments);
    } catch (err) {
      toast({
        title: "Couldn't load queue",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function articleAction(id: number, action: "approve" | "reject") {
    try {
      const r = await fetch(`${API}/admin/journal/articles/${id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: "Rejected by admin" }) : undefined,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: action === "approve" ? "Published" : "Rejected" });
      void load();
    } catch (err) {
      toast({ title: "Action failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function commentAction(id: number, action: "approve" | "reject") {
    try {
      const r = await fetch(`${API}/admin/journal/comments/${id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: "Rejected by admin" }) : undefined,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: action === "approve" ? "Comment approved" : "Comment rejected" });
      void load();
    } catch (err) {
      toast({ title: "Action failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function generateNow() {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/admin/journal/generate-now`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { created?: number; skipped?: boolean };
      toast({
        title: j.skipped
          ? "Today's quota already full"
          : `Generated ${j.created ?? 0} drafts`,
      });
      void load();
    } catch (err) {
      toast({ title: "Generation failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  const aiArticles = articles.filter((a) => a.authorType === "ai");
  const shopperArticles = articles.filter((a) => a.authorType === "shopper");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif font-semibold">Community moderation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            One-click publish daily AI articles. Review and moderate shopper posts and comments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={generateNow} disabled={generating}>
            <Sparkles className="w-4 h-4 mr-2" />
            {generating ? "Generating…" : "Generate today's 10 articles"}
          </Button>
        </div>
      </div>

      <Section
        icon={<Sparkles className="w-4 h-4" />}
        title={`Daily AI articles awaiting publish (${aiArticles.length})`}
        empty="No AI drafts pending. The cron generates 10 fresh ideas every morning."
      >
        {aiArticles.map((a) => (
          <ArticleCard key={a.id} article={a} onAction={articleAction} kind="ai" />
        ))}
      </Section>

      <Section
        icon={<FileText className="w-4 h-4" />}
        title={`Shopper-submitted posts (${shopperArticles.length})`}
        empty="No shopper posts pending."
      >
        {shopperArticles.map((a) => (
          <ArticleCard key={a.id} article={a} onAction={articleAction} kind="shopper" />
        ))}
      </Section>

      <Section
        icon={<MessageSquare className="w-4 h-4" />}
        title={`Comments awaiting review (${comments.length})`}
        empty="No comments pending."
      >
        {comments.map((c) => (
          <div key={c.id} className="border border-border rounded-xl p-4 bg-card">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{c.authorName}</span>
                {" · "}
                {c.authorEmail}
                {" · on "}
                <a href={`/journal/${c.articleSlug}`} className="underline hover:text-foreground">
                  {c.articleSlug}
                </a>
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${c.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                {c.status}
              </span>
            </div>
            <p className="text-sm whitespace-pre-line mb-2">{c.body}</p>
            {c.moderationReason ? (
              <p className="text-[11px] text-muted-foreground italic mb-2">
                AI: {c.moderationReason}
              </p>
            ) : null}
            <div className="flex gap-2">
              {c.status !== "approved" && (
                <Button size="sm" onClick={() => commentAction(c.id, "approve")}>
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                </Button>
              )}
              {c.status !== "rejected" && (
                <Button size="sm" variant="outline" onClick={() => commentAction(c.id, "reject")}>
                  <XCircle className="w-3 h-3 mr-1" /> Reject
                </Button>
              )}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const hasItems = arr.filter(Boolean).length > 0;
  return (
    <section>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 inline-flex items-center gap-2">
        {icon} {title}
      </h3>
      {hasItems ? (
        <div className="grid gap-3">{children}</div>
      ) : (
        <p className="text-sm text-muted-foreground italic">{empty}</p>
      )}
    </section>
  );
}

function ArticleCard({
  article,
  onAction,
  kind,
}: {
  article: PendingArticle;
  onAction: (id: number, action: "approve" | "reject") => void;
  kind: "ai" | "shopper";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-1">
            {article.category} · {kind === "ai" ? "AI draft" : `by ${article.authorName}`}
          </p>
          <h4 className="font-serif font-semibold text-lg leading-snug">{article.title}</h4>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.excerpt}</p>
        </div>
      </div>
      {article.moderationReason ? (
        <p className="text-[11px] text-muted-foreground italic mb-2">
          AI: {article.moderationReason}
        </p>
      ) : null}
      <button
        type="button"
        className="text-xs text-primary hover:underline mb-3"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide preview" : "Preview body"}
      </button>
      {open && (
        <div className="prose prose-sm max-w-none border-t border-border pt-3 mb-3 max-h-80 overflow-y-auto">
          {article.body.map((s, i) => (
            <div key={i}>
              {s.heading && <h4 className="font-semibold mt-3">{s.heading}</h4>}
              {s.paragraphs.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed">{p}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onAction(article.id, "approve")}>
          <CheckCircle2 className="w-3 h-3 mr-1" /> Publish
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction(article.id, "reject")}>
          <XCircle className="w-3 h-3 mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}
