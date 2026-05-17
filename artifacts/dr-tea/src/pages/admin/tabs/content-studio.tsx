import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAdminListContentDrafts,
  useAdminListContentIdeas,
  useAdminGenerateSocialDrafts,
  useAdminGenerateBlogDraft,
  useAdminUpdateContentDraft,
  useAdminDeleteContentDraft,
  useAdminPromoteBlogDraft,
  useAdminGenerateContentDraftImage,
  useAdminRefreshContentIdeas,
  useAdminUpdateContentIdea,
  getAdminListContentDraftsQueryKey,
  getAdminListContentIdeasQueryKey,
  type ContentDraft,
  type ContentIdea,
  type ContentChannel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const SOCIAL_CHANNELS: ContentChannel[] = [
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "linkedin",
  "youtube_shorts",
];
const ALL_CHANNELS: ContentChannel[] = [...SOCIAL_CHANNELS, "blog"];
const ALL_STATUSES: ContentDraft["status"][] = ["draft", "approved", "posted"];

const CHANNEL_LABEL: Record<ContentChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X / Twitter",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
  youtube_shorts: "YouTube Shorts",
  blog: "Blog",
};

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function ChannelBadge({ channel }: { channel: ContentChannel }) {
  return <Badge variant="secondary">{CHANNEL_LABEL[channel]}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "posted" ? "default" : status === "approved" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

// ──────────────────────────────────────────────────────────────────────────
// Trend ideas card
// ──────────────────────────────────────────────────────────────────────────

function TrendIdeasCard({ onUseIdea }: { onUseIdea: (idea: ContentIdea) => void }) {
  const qc = useQueryClient();
  const ideas = useAdminListContentIdeas();
  const refresh = useAdminRefreshContentIdeas();
  const update = useAdminUpdateContentIdea();
  const { toast } = useToast();
  const visible = (ideas.data ?? []).filter((i) => !i.dismissed).slice(0, 8);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">Trend ideas</h3>
          <p className="text-xs text-muted-foreground">
            Auto-refreshed daily. {(ideas.data ?? []).length} total · {visible.length} active.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refresh.isPending}
          onClick={async () => {
            try {
              const out = await refresh.mutateAsync();
              await qc.invalidateQueries({ queryKey: getAdminListContentIdeasQueryKey() });
              toast({ title: `Generated ${out.inserted} new ideas` });
            } catch (err) {
              toast({ title: "Refresh failed", description: String(err), variant: "destructive" });
            }
          }}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh now"}
        </Button>
      </div>
      {ideas.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ideas…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active ideas. Click Refresh to generate a fresh batch.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((idea) => (
            <li key={idea.id} className="border rounded p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{idea.headline}</p>
                <p className="text-xs text-muted-foreground mt-1">{idea.rationale}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {idea.channels.map((c) => <ChannelBadge key={c} channel={c} />)}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => onUseIdea(idea)}>Use</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await update.mutateAsync({ id: idea.id, data: { dismissed: true } });
                    await qc.invalidateQueries({ queryKey: getAdminListContentIdeasQueryKey() });
                  }}
                >Dismiss</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Draft card (used by Social and Blog subtabs)
// ──────────────────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  onSave,
  onDelete,
  onGenerateImage,
  generatingImage,
  variant,
  onPromote,
  highlighted,
  onHighlightConsumed,
}: {
  draft: ContentDraft;
  onSave: (patch: Partial<ContentDraft>) => Promise<void>;
  onDelete: () => Promise<void>;
  onGenerateImage: (prompt: string) => Promise<void>;
  generatingImage: boolean;
  variant: "social" | "blog";
  onPromote?: () => Promise<void>;
  highlighted?: boolean;
  onHighlightConsumed?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!highlighted) return;
    const node = cardRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(true);
    const t = window.setTimeout(() => {
      setFlash(false);
      onHighlightConsumed?.();
    }, 2200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, draft.id]);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [hashtags, setHashtags] = useState(draft.hashtags.join(" "));
  const [cta, setCta] = useState(draft.cta);
  const [scheduledAt, setScheduledAt] = useState(draft.scheduledAt ?? "");
  const [imagePrompt, setImagePrompt] = useState(draft.imagePrompt ?? "");
  const dirty =
    title !== draft.title ||
    body !== draft.body ||
    hashtags !== draft.hashtags.join(" ") ||
    cta !== draft.cta ||
    (scheduledAt || "") !== (draft.scheduledAt ?? "") ||
    imagePrompt !== (draft.imagePrompt ?? "");
  // Snapshot the user's current local edits as a PATCH body. Used both by the
  // explicit "Save changes" button and by quick-actions on imageRefs so that
  // unsaved text edits aren't dropped when the cache refreshes.
  const buildLocalPatch = (): Partial<ContentDraft> => {
    const patch: Partial<ContentDraft> = {
      body,
      cta,
      scheduledAt: scheduledAt || null,
      imagePrompt,
      hashtags: hashtags
        .split(/\s+/).map((h) => h.replace(/^#/, "")).filter(Boolean),
    };
    if (variant === "blog") patch.title = title;
    return patch;
  };

  return (
    <Card
      ref={cardRef}
      className={`p-4 space-y-3 transition-all duration-500 ${
        flash ? "ring-2 ring-primary ring-offset-2 bg-primary/5" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ChannelBadge channel={draft.channel} />
          <StatusBadge status={draft.status} />
          {draft.promotedArticleId && (
            <Badge variant="default">Article #{draft.promotedArticleId}</Badge>
          )}
          <span className="text-xs text-muted-foreground">{fmtDate(draft.createdAt)}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {variant === "blog" && onPromote && (
            <Button size="sm" variant="outline" disabled={!!draft.promotedArticleId} onClick={onPromote}>
              {draft.promotedArticleId ? "Promoted" : "Promote to Article"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
        </div>
      </div>

      {/* Channel + Status reassignment row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`channel-${draft.id}`}>Channel</Label>
          <select
            id={`channel-${draft.id}`}
            className="w-full border rounded h-9 px-2 bg-background"
            value={draft.channel}
            onChange={async (e) => { await onSave({ channel: e.target.value as ContentChannel }); }}
            disabled={variant === "blog"}
          >
            {(variant === "blog" ? (["blog"] as ContentChannel[]) : SOCIAL_CHANNELS).map((c) => (
              <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`status-${draft.id}`}>Status</Label>
          <select
            id={`status-${draft.id}`}
            className="w-full border rounded h-9 px-2 bg-background"
            value={draft.status}
            onChange={async (e) => { await onSave({ status: e.target.value as ContentDraft["status"] }); }}
          >
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {variant === "blog" && (
        <div>
          <Label htmlFor={`title-${draft.id}`}>Title</Label>
          <Input id={`title-${draft.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      )}
      {variant === "social" && (
        <div>
          <Label className="text-xs">Topic</Label>
          <p className="text-sm">{draft.topic}</p>
        </div>
      )}

      <div>
        <Label htmlFor={`body-${draft.id}`}>{variant === "blog" ? "Markdown body" : "Body"}</Label>
        <Textarea
          id={`body-${draft.id}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={variant === "blog" ? 18 : Math.min(12, Math.max(4, body.split("\n").length))}
          className={variant === "blog" ? "font-mono text-xs" : undefined}
        />
      </div>

      {variant === "social" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`tags-${draft.id}`}>Hashtags (space-separated)</Label>
            <Input id={`tags-${draft.id}`} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`cta-${draft.id}`}>CTA</Label>
            <Input id={`cta-${draft.id}`} value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor={`sch-${draft.id}`}>Scheduled at (ISO, optional)</Label>
        <Input
          id={`sch-${draft.id}`}
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          placeholder="2025-01-15T09:00:00Z"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Approved drafts auto-publish at this time (checked every 5 min). Blogs go live on the journal; social posts get marked as sent.
        </p>
      </div>

      {/* Image prompt + generated images */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`imgprompt-${draft.id}`} className="text-xs">
            Image prompt
          </Label>
          <Button
            size="sm"
            variant="outline"
            disabled={generatingImage || !imagePrompt.trim()}
            onClick={() => onGenerateImage(imagePrompt)}
            title={
              !imagePrompt.trim()
                ? "Write an image prompt first"
                : "Generate an AI image from this prompt"
            }
          >
            {generatingImage ? "Generating…" : "Generate image"}
          </Button>
        </div>
        <Textarea
          id={`imgprompt-${draft.id}`}
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          rows={2}
          placeholder="e.g. Steaming cup of green tea on a wooden tray, soft morning light, editorial photography"
          className="text-xs"
        />
        {draft.imageRefs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {draft.imageRefs.map((img, idx) => (
              <div key={`${img.url}-${idx}`} className="relative group">
                <img
                  src={img.url}
                  alt={img.alt ?? "AI image"}
                  className={`rounded border w-full aspect-square object-cover ${
                    idx === 0 ? "ring-2 ring-primary" : ""
                  }`}
                />
                {idx === 0 && (
                  <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0">
                    Cover
                  </Badge>
                )}
                <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx !== 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 px-2 text-[10px] flex-1"
                      onClick={() => {
                        const next = [
                          draft.imageRefs[idx],
                          ...draft.imageRefs.filter((_, i) => i !== idx),
                        ];
                        void onSave({ ...buildLocalPatch(), imageRefs: next });
                      }}
                    >
                      Set as cover
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      const next = draft.imageRefs.filter((_, i) => i !== idx);
                      void onSave({ ...buildLocalPatch(), imageRefs: next });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dirty && (
        <Button
          size="sm"
          onClick={() => {
            void onSave(buildLocalPatch());
          }}
        >
          Save changes
        </Button>
      )}
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Social subtab
// ──────────────────────────────────────────────────────────────────────────

function SocialSubtab({
  topicSeed,
  channelsSeed,
  focusDraftId,
  focusChannel,
  onHighlightConsumed,
  onClearFocus,
}: {
  topicSeed: string;
  channelsSeed: ContentChannel[];
  focusDraftId: number | null;
  focusChannel: ContentChannel | null;
  onHighlightConsumed: () => void;
  onClearFocus: () => void;
}) {
  const qc = useQueryClient();
  const drafts = useAdminListContentDrafts({ kind: "social" });
  const generate = useAdminGenerateSocialDrafts();
  const update = useAdminUpdateContentDraft();
  const del = useAdminDeleteContentDraft();
  const genImage = useAdminGenerateContentDraftImage();
  const { toast } = useToast();
  const [topic, setTopic] = useState(topicSeed);
  const [selected, setSelected] = useState<ContentChannel[]>(
    channelsSeed.length ? channelsSeed.filter((c) => c !== "blog") : ["instagram", "twitter"],
  );
  const [imageBusyId, setImageBusyId] = useState<number | null>(null);

  useEffect(() => { if (topicSeed) setTopic(topicSeed); }, [topicSeed]);
  useEffect(() => {
    if (channelsSeed.length) setSelected(channelsSeed.filter((c) => c !== "blog"));
  }, [channelsSeed]);

  const refreshList = () => qc.invalidateQueries({ queryKey: getAdminListContentDraftsQueryKey({ kind: "social" }) });

  const handleGenerate = async () => {
    if (!topic.trim()) { toast({ title: "Topic required", variant: "destructive" }); return; }
    if (!selected.length) { toast({ title: "Pick at least one channel", variant: "destructive" }); return; }
    try {
      await generate.mutateAsync({ data: { topic: topic.trim(), channels: selected } });
      await refreshList();
      toast({ title: "Drafts generated" });
    } catch (err) {
      toast({ title: "Generation failed", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <Label htmlFor="social-topic">Topic / hook</Label>
          <Input
            id="social-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Brewing the perfect Darjeeling first flush"
          />
        </div>
        <div>
          <Label>Channels</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {SOCIAL_CHANNELS.map((c) => {
              const active = selected.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelected(active ? selected.filter((x) => x !== c) : [...selected, c])}
                  className={`px-3 py-1 rounded border text-sm ${active ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  {CHANNEL_LABEL[c]}
                </button>
              );
            })}
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={generate.isPending}>
          {generate.isPending ? "Generating…" : "Generate drafts"}
        </Button>
      </Card>

      {focusChannel ? (
        <Card className="p-2 px-3 flex items-center justify-between text-xs">
          <span>
            Showing only <strong>{CHANNEL_LABEL[focusChannel]}</strong> drafts.
          </span>
          <Button size="sm" variant="ghost" className="h-7" onClick={onClearFocus}>
            Show all channels
          </Button>
        </Card>
      ) : null}

      <div className="space-y-3">
        {(() => {
          const all = drafts.data ?? [];
          const visible = focusChannel ? all.filter((d) => d.channel === focusChannel) : all;
          // Resolve highlight target: prefer explicit id, else the most recent
          // matching draft on the focused channel (handles cases where the
          // jumper hadn't loaded the drafts list yet).
          const fallbackId =
            focusDraftId == null && focusChannel
              ? visible.reduce<number | null>(
                  (best, d) => (best == null || d.id > best ? d.id : best),
                  null,
                )
              : null;
          const highlightId = focusDraftId ?? fallbackId;
          if (!visible.length) {
            return (
              <Card className="p-4 text-sm text-muted-foreground">
                {focusChannel
                  ? `No social drafts for ${CHANNEL_LABEL[focusChannel]} yet.`
                  : "No social drafts yet."}
              </Card>
            );
          }
          return visible.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              variant="social"
              highlighted={highlightId === d.id}
              onHighlightConsumed={onHighlightConsumed}
              generatingImage={imageBusyId === d.id}
              onSave={async (patch) => {
                await update.mutateAsync({ id: d.id, data: patch });
                await refreshList();
                toast({ title: "Saved" });
              }}
              onDelete={async () => {
                await del.mutateAsync({ id: d.id });
                await refreshList();
              }}
              onGenerateImage={async (prompt) => {
                setImageBusyId(d.id);
                try {
                  await genImage.mutateAsync({ id: d.id, data: { prompt } });
                  await refreshList();
                  toast({ title: "Image generated" });
                } catch (err) {
                  toast({ title: "Image generation failed", description: String(err), variant: "destructive" });
                } finally {
                  setImageBusyId(null);
                }
              }}
            />
          ));
        })()}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Blog subtab
// ──────────────────────────────────────────────────────────────────────────

function BlogSubtab({
  topicSeed,
  focusDraftId,
  onHighlightConsumed,
}: {
  topicSeed: string;
  focusDraftId: number | null;
  onHighlightConsumed: () => void;
}) {
  const qc = useQueryClient();
  const drafts = useAdminListContentDrafts({ kind: "blog" });
  const generate = useAdminGenerateBlogDraft();
  const update = useAdminUpdateContentDraft();
  const del = useAdminDeleteContentDraft();
  const promote = useAdminPromoteBlogDraft();
  const genImage = useAdminGenerateContentDraftImage();
  const { toast } = useToast();
  const [topic, setTopic] = useState(topicSeed);
  const [audience, setAudience] = useState("");
  const [imageBusyId, setImageBusyId] = useState<number | null>(null);

  useEffect(() => { if (topicSeed) setTopic(topicSeed); }, [topicSeed]);

  const refreshList = () => qc.invalidateQueries({ queryKey: getAdminListContentDraftsQueryKey({ kind: "blog" }) });

  const handleGenerate = async () => {
    if (!topic.trim()) { toast({ title: "Topic required", variant: "destructive" }); return; }
    try {
      await generate.mutateAsync({ data: { topic: topic.trim(), audience: audience.trim() || undefined } });
      await refreshList();
      toast({ title: "Blog draft generated" });
    } catch (err) {
      toast({ title: "Generation failed", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <Label htmlFor="blog-topic">Topic</Label>
          <Input
            id="blog-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The art of evening Tulsi tea rituals"
          />
        </div>
        <div>
          <Label htmlFor="blog-aud">Audience (optional)</Label>
          <Input
            id="blog-aud"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. wellness-curious urban professionals"
          />
        </div>
        <Button onClick={handleGenerate} disabled={generate.isPending}>
          {generate.isPending ? "Generating (~30s)…" : "Generate blog draft"}
        </Button>
      </Card>

      <div className="space-y-3">
        {(drafts.data ?? []).length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No blog drafts yet.</Card>
        ) : (
          (drafts.data ?? []).map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              variant="blog"
              highlighted={focusDraftId === d.id}
              onHighlightConsumed={onHighlightConsumed}
              generatingImage={imageBusyId === d.id}
              onSave={async (patch) => {
                await update.mutateAsync({ id: d.id, data: patch });
                await refreshList();
                toast({ title: "Saved" });
              }}
              onDelete={async () => {
                await del.mutateAsync({ id: d.id });
                await refreshList();
              }}
              onPromote={async () => {
                try {
                  const out = await promote.mutateAsync({ id: d.id });
                  await refreshList();
                  toast({ title: `Promoted to draft article (slug: ${out.slug})` });
                } catch (err) {
                  toast({ title: "Promotion failed", description: String(err), variant: "destructive" });
                }
              }}
              onGenerateImage={async (prompt) => {
                setImageBusyId(d.id);
                try {
                  await genImage.mutateAsync({ id: d.id, data: { prompt } });
                  await refreshList();
                  toast({ title: "Hero image generated" });
                } catch (err) {
                  toast({ title: "Image generation failed", description: String(err), variant: "destructive" });
                } finally {
                  setImageBusyId(null);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Calendar subtab — week view + week-based CSV export + assignment workflow
// ──────────────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  // Monday as week start.
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - day);
  return out;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarSubtab() {
  const qc = useQueryClient();
  const all = useAdminListContentDrafts();
  const update = useAdminUpdateContentDraft();
  const { toast } = useToast();
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const [view, setView] = useState<"week" | "month">("week");

  const refreshList = () => qc.invalidateQueries({ queryKey: getAdminListContentDraftsQueryKey() });

  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const monthStart = useMemo(() => {
    const m = new Date(weekAnchor); m.setDate(1); m.setHours(0, 0, 0, 0); return m;
  }, [weekAnchor]);
  const monthEnd = useMemo(() => {
    const m = new Date(monthStart); m.setMonth(m.getMonth() + 1); m.setDate(0); m.setHours(23, 59, 59, 999); return m;
  }, [monthStart]);

  const { rangeStart, rangeEnd } = view === "week"
    ? { rangeStart: weekStart, rangeEnd: addDays(weekStart, 7) }
    : { rangeStart: monthStart, rangeEnd: addDays(monthEnd, 1) };

  // Bucket scheduled drafts by day-of-range.
  const buckets = useMemo(() => {
    const map = new Map<string, ContentDraft[]>();
    for (const d of all.data ?? []) {
      if (!d.scheduledAt) continue;
      const date = new Date(d.scheduledAt);
      if (date < rangeStart || date >= rangeEnd) continue;
      const key = ymd(date);
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return map;
  }, [all.data, rangeStart, rangeEnd]);

  const days = useMemo(() => {
    if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const arr: Date[] = [];
    for (let d = new Date(monthStart); d <= monthEnd; d = addDays(d, 1)) arr.push(new Date(d));
    return arr;
  }, [view, weekStart, monthStart, monthEnd]);

  const handleExportRange = () => {
    const base = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
    const since = rangeStart.toISOString();
    const until = rangeEnd.toISOString();
    window.open(
      `${base}/admin/content/drafts.csv?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
      "_blank",
    );
  };

  const unscheduled = (all.data ?? []).filter((d) => !d.scheduledAt);
  const total = Array.from(buckets.values()).reduce((n, arr) => n + arr.length, 0);

  const setStatus = async (d: ContentDraft, status: ContentDraft["status"]) => {
    await update.mutateAsync({ id: d.id, data: { status } });
    await refreshList();
    toast({ title: `Marked ${status}` });
  };
  const setScheduled = async (d: ContentDraft, scheduledAt: string | null) => {
    await update.mutateAsync({ id: d.id, data: { scheduledAt } });
    await refreshList();
  };
  const setChannel = async (d: ContentDraft, channel: ContentChannel) => {
    await update.mutateAsync({ id: d.id, data: { channel } });
    await refreshList();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Content calendar</h3>
          <p className="text-xs text-muted-foreground">
            {view === "week"
              ? `Week of ${ymd(weekStart)} → ${ymd(weekEnd)}`
              : `${monthStart.toLocaleString("en", { month: "long", year: "numeric" })}`}
            {" · "}{total} scheduled · {unscheduled.length} unscheduled
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border rounded p-0.5">
            <button
              type="button"
              className={`text-xs px-2 py-1 rounded ${view === "week" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setView("week")}
            >Week</button>
            <button
              type="button"
              className={`text-xs px-2 py-1 rounded ${view === "month" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setView("month")}
            >Month</button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setWeekAnchor(addDays(weekAnchor, view === "week" ? -7 : -30))}>
            ← Prev
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeekAnchor(startOfWeek(new Date()))}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeekAnchor(addDays(weekAnchor, view === "week" ? 7 : 30))}>
            Next →
          </Button>
          <Button size="sm" variant="default" onClick={handleExportRange}>
            Export {view} CSV
          </Button>
        </div>
      </Card>

      {view === "week" ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map((day) => {
            const key = ymd(day);
            const items = buckets.get(key) ?? [];
            return (
              <Card key={key} className="p-3 min-h-[140px]">
                <p className="text-xs font-semibold mb-2">
                  {day.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No posts</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((d) => (
                      <li key={d.id} className="border rounded p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <ChannelBadge channel={d.channel} />
                          <StatusBadge status={d.status} />
                        </div>
                        <p className="line-clamp-2">{d.title || d.topic || d.body.slice(0, 60)}</p>
                        <div className="flex flex-wrap gap-1">
                          {d.status !== "approved" && (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setStatus(d, "approved")}>Approve</Button>
                          )}
                          {d.status !== "posted" && (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setStatus(d, "posted")}>Mark posted</Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {days.map((day) => {
            const key = ymd(day);
            const items = buckets.get(key) ?? [];
            return (
              <Card key={key} className="p-2 min-h-[80px]">
                <p className="text-xs font-semibold">{day.getDate()}</p>
                {items.length > 0 && (
                  <ul className="space-y-1 mt-1">
                    {items.slice(0, 3).map((d) => (
                      <li key={d.id} className="text-[10px] flex items-center gap-1 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block shrink-0" />
                        <span className="truncate">{CHANNEL_LABEL[d.channel]}</span>
                      </li>
                    ))}
                    {items.length > 3 && <li className="text-[10px] text-muted-foreground">+{items.length - 3} more</li>}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Unscheduled assignment workflow */}
      <Card className="p-4">
        <h4 className="font-semibold mb-2">Unscheduled drafts</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Assign a date, channel, and status to add a draft to the calendar.
        </p>
        {unscheduled.length === 0 ? (
          <p className="text-sm text-muted-foreground">All drafts are scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {unscheduled.map((d) => (
              <UnscheduledRow
                key={d.id}
                draft={d}
                onAssign={async (date, channel, status) => {
                  await update.mutateAsync({
                    id: d.id,
                    data: {
                      scheduledAt: date ? new Date(date).toISOString() : null,
                      channel,
                      status,
                    },
                  });
                  await refreshList();
                  toast({ title: "Scheduled" });
                }}
                onSetChannel={(c) => setChannel(d, c)}
                onSetStatus={(s) => setStatus(d, s)}
                onSetScheduled={(v) => setScheduled(d, v)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function UnscheduledRow({
  draft,
  onAssign,
  onSetChannel: _onSetChannel,
  onSetStatus: _onSetStatus,
  onSetScheduled: _onSetScheduled,
}: {
  draft: ContentDraft;
  onAssign: (date: string, channel: ContentChannel, status: ContentDraft["status"]) => Promise<void>;
  onSetChannel: (c: ContentChannel) => Promise<void>;
  onSetStatus: (s: ContentDraft["status"]) => Promise<void>;
  onSetScheduled: (v: string | null) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [channel, setChannel] = useState<ContentChannel>(draft.channel);
  const [status, setStatus] = useState<ContentDraft["status"]>(draft.status);
  return (
    <li className="border rounded p-2 text-xs flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[160px]">
        <p className="font-medium truncate">{draft.title || draft.topic || draft.body.slice(0, 60)}</p>
        <p className="text-muted-foreground truncate">{CHANNEL_LABEL[draft.channel]} · {draft.kind}</p>
      </div>
      <input
        type="datetime-local"
        className="border rounded h-8 px-2 text-xs bg-background"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <select
        className="border rounded h-8 px-2 text-xs bg-background"
        value={channel}
        onChange={(e) => setChannel(e.target.value as ContentChannel)}
      >
        {ALL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
      </select>
      <select
        className="border rounded h-8 px-2 text-xs bg-background"
        value={status}
        onChange={(e) => setStatus(e.target.value as ContentDraft["status"])}
      >
        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <Button
        size="sm"
        disabled={!date}
        onClick={() => onAssign(date, channel, status)}
      >
        Assign
      </Button>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Tab root
// ──────────────────────────────────────────────────────────────────────────

type FocusState = {
  draftId: number | null;
  kind: "blog" | "social" | null;
  channel: ContentChannel | null;
};

const SOCIAL_CHANNEL_SET = new Set<string>(SOCIAL_CHANNELS);

function readFocusFromUrl(): FocusState {
  if (typeof window === "undefined") return { draftId: null, kind: null, channel: null };
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("focusDraft");
  const id = raw ? Number(raw) : NaN;
  const k = params.get("focusKind");
  const c = params.get("focusChannel");
  return {
    draftId: Number.isFinite(id) ? id : null,
    kind: k === "blog" || k === "social" ? k : null,
    channel: c && SOCIAL_CHANNEL_SET.has(c) ? (c as ContentChannel) : null,
  };
}

function ImageBackfillCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  async function run(scope: "all" | "journal" | "teapedia" | "recipes" | "content-hub") {
    setBusy(scope);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/admin/images/backfill`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, onlyMissing, limit: 200 }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({
        title: "Image regeneration queued",
        description:
          "Gemini is generating real-life lifestyle photos in the background. New heroes will appear over the next several minutes as they finish.",
      });
    } catch (err) {
      toast({
        title: "Could not queue regeneration",
        description: err instanceof Error ? err.message : "Try again shortly.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="font-semibold">Regenerate hero images (Gemini lifestyle)</h3>
          <p className="text-xs text-muted-foreground">
            Replaces hero images across Journal, Teapedia, Recipes, and Content Hub
            with content-relevant real-life lifestyle photographs generated by Gemini.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          Only items missing a hero
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", "journal", "teapedia", "recipes", "content-hub"] as const).map((s) => (
          <Button
            key={s}
            type="button"
            variant={s === "all" ? "default" : "outline"}
            size="sm"
            disabled={busy !== null}
            onClick={() => run(s)}
            data-testid={`button-backfill-${s}`}
          >
            {busy === s ? "Queuing…" : s === "all" ? "Regenerate ALL" : `Regen ${s}`}
          </Button>
        ))}
      </div>
    </Card>
  );
}

export default function ContentStudioTab() {
  const [topicSeed, setTopicSeed] = useState("");
  const [channelsSeed, setChannelsSeed] = useState<ContentChannel[]>([]);
  const [activeSub, setActiveSub] = useState("social");
  const [focus, setFocus] = useState<FocusState>(() => readFocusFromUrl());
  // Tracks which (draft, channel) we have already played the flash for, so we
  // don't replay the highlight every time the drafts query refetches. The deep
  // link itself stays in the URL so a refresh re-targets the same draft.
  const [highlightConsumed, setHighlightConsumed] = useState(false);

  useEffect(() => {
    function read() {
      setFocus(readFocusFromUrl());
      setHighlightConsumed(false);
    }
    window.addEventListener("focusdraftchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("focusdraftchange", read);
      window.removeEventListener("popstate", read);
    };
  }, []);

  useEffect(() => {
    if (focus.kind === "blog") setActiveSub("blog");
    else if (focus.kind === "social") setActiveSub("social");
    setHighlightConsumed(false);
  }, [focus.kind, focus.draftId, focus.channel]);

  const clearFocus = () => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.delete("focusDraft");
    params.delete("focusKind");
    params.delete("focusChannel");
    const qs = params.toString();
    const url = (qs ? `?${qs}` : window.location.pathname) + window.location.hash;
    window.history.replaceState(null, "", url);
    setFocus({ draftId: null, kind: null, channel: null });
    setHighlightConsumed(false);
  };

  const onHighlightConsumed = () => setHighlightConsumed(true);

  const onUseIdea = (idea: ContentIdea) => {
    setTopicSeed(idea.headline);
    setChannelsSeed(idea.channels);
    if (idea.channels.length === 1 && idea.channels[0] === "blog") setActiveSub("blog");
    else setActiveSub("social");
  };

  return (
    <div className="space-y-6">
      <ImageBackfillCard />
      <TrendIdeasCard onUseIdea={onUseIdea} />
      <Tabs value={activeSub} onValueChange={setActiveSub}>
        <TabsList>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="social" className="mt-4">
          <SocialSubtab
            topicSeed={topicSeed}
            channelsSeed={channelsSeed}
            focusDraftId={focus.kind === "social" && !highlightConsumed ? focus.draftId : null}
            focusChannel={focus.kind === "social" ? focus.channel : null}
            onHighlightConsumed={onHighlightConsumed}
            onClearFocus={clearFocus}
          />
        </TabsContent>
        <TabsContent value="blog" className="mt-4">
          <BlogSubtab
            topicSeed={topicSeed}
            focusDraftId={focus.kind === "blog" && !highlightConsumed ? focus.draftId : null}
            onHighlightConsumed={onHighlightConsumed}
          />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <CalendarSubtab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
