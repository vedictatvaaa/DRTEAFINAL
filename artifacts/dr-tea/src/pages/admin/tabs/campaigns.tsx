import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAdminListCampaigns,
  useAdminGenerateCampaign,
  useAdminUpdateCampaign,
  useAdminApproveCampaign,
  useAdminRetryCampaignImage,
  useAdminDeleteCampaign,
  useAdminListProducts,
  useAdminListContentDrafts,
  useAdminListKeywords,
  useAdminCreateKeyword,
  useAdminDeleteKeyword,
  useAdminRefreshKeywords,
  useAdminSummarizeKeywords,
  useAdminKeywordRankStatus,
  useAdminSetKeywordRankProvider,
  getAdminListCampaignsQueryKey,
  getAdminListKeywordsQueryKey,
  getAdminKeywordRankStatusQueryKey,
  type Campaign,
  type CampaignBundle,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Save, Trash2, Rocket, Download, RefreshCw, Plus, ArrowUp, ArrowDown, Minus } from "lucide-react";

const PRESETS = [
  "Monsoon launch",
  "Diwali festive",
  "Wellness Week",
  "New year reset",
  "Spring first flush",
  "Holi celebration",
];

const SOCIAL_CHANNELS = ["instagram", "facebook", "twitter", "pinterest", "linkedin"] as const;

function emptyBundle(): CampaignBundle {
  return {
    experience: { name: "", themeTokens: {}, banner: null, heroTakeover: null, particleEffect: "none" },
    blog: { title: "", body: "", imagePrompt: "", cta: "", hashtags: [] },
    socials: SOCIAL_CHANNELS.map((c) => ({ channel: c, body: "", hashtags: [], cta: "", imagePrompt: "" })),
    email: { subject: "", preheader: "", body: "", ctaLabel: "Shop now", ctaUrl: "/shop" },
    adCreatives: [],
  };
}

export default function CampaignsTab() {
  return (
    <Tabs defaultValue="campaigns">
      <TabsList>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="feeds">Merchant feeds</TabsTrigger>
        <TabsTrigger value="keywords">Keyword watch</TabsTrigger>
      </TabsList>
      <TabsContent value="campaigns" className="mt-6"><CampaignsPanel /></TabsContent>
      <TabsContent value="feeds" className="mt-6"><FeedsPanel /></TabsContent>
      <TabsContent value="keywords" className="mt-6"><KeywordsPanel /></TabsContent>
    </Tabs>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Campaigns
// ──────────────────────────────────────────────────────────────────────

function CampaignsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const list = useAdminListCampaigns();
  const products = useAdminListProducts();
  const generate = useAdminGenerateCampaign();
  const [moment, setMoment] = useState(PRESETS[0] ?? "");
  const [brief, setBrief] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = useMemo(
    () => (list.data ?? []).find((c) => c.id === activeId) ?? null,
    [list.data, activeId],
  );

  async function handleGenerate() {
    if (brief.trim().length < 8) {
      toast({ title: "Add more detail", description: "Brief should be at least a sentence.", variant: "destructive" });
      return;
    }
    try {
      const created = await generate.mutateAsync({
        data: { brief, moment, targetProductIds: selected, name: name || undefined, save: true },
      });
      await qc.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
      const c = created as Campaign;
      setActiveId(c.id);
      setBrief(""); setName(""); setSelected([]);
      toast({ title: "Campaign drafted", description: c.name });
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> New campaign</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Moment / preset</Label>
              <select value={moment} onChange={(e) => setMoment(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background">
                {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="">Custom…</option>
              </select>
            </div>
            <div>
              <Label>Campaign name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-named from AI if blank" />
            </div>
          </div>
          <div>
            <Label>Brief — describe the moment, audience, hook</Label>
            <Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Launch our monsoon-spiced black tea blend; lean into cozy rituals & rainy-evening pairings; goal = drive trial via gift bundles." />
          </div>
          <div>
            <Label>Target products</Label>
            <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto p-2 border rounded-md">
              {(products.data ?? []).map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button key={p.id} type="button"
                    onClick={() => setSelected((s) => on ? s.filter((x) => x !== p.id) : [...s, p.id])}
                    className={`text-xs px-2 py-1 rounded-md border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={generate.isPending}>
              <Sparkles className="h-4 w-4 mr-2" /> {generate.isPending ? "Drafting…" : "Generate bundle"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">All campaigns</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(list.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No campaigns yet.</p>
            ) : (list.data ?? []).map((c) => (
              <button key={c.id} type="button" onClick={() => setActiveId(c.id)}
                className={`w-full text-left p-2 rounded-md border ${activeId === c.id ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{c.moment || c.brief.slice(0, 60)}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div>
          {active ? <CampaignReview key={active.id} campaign={active} /> : (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Select a campaign on the left, or generate a new one above.
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CampaignReview({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const update = useAdminUpdateCampaign();
  const approve = useAdminApproveCampaign();
  const retryImage = useAdminRetryCampaignImage();
  const del = useAdminDeleteCampaign();
  const [bundle, setBundle] = useState<CampaignBundle>(() => (campaign.proposed as CampaignBundle | null) ?? emptyBundle());
  const [activate, setActivate] = useState(false);
  const [emailSchedule, setEmailSchedule] = useState<string>("");
  const [blogSchedule, setBlogSchedule] = useState<string>("");
  const [socialSchedule, setSocialSchedule] = useState<string>("");
  const [imageFailures, setImageFailures] = useState<Array<{
    target: { kind: string; channel?: string; index?: number };
    prompt: string;
    error: string;
  }>>([]);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [failurePromptDrafts, setFailurePromptDrafts] = useState<Record<string, string>>({});
  const [expandedFailureKey, setExpandedFailureKey] = useState<string | null>(null);
  const [retrySuccess, setRetrySuccess] = useState<Record<string, { url: string; label: string; kind: string; channel?: string; index?: number }>>({});
  const [highlightedAdIndex, setHighlightedAdIndex] = useState<number | null>(null);
  const adCreativesRef = useRef<HTMLDivElement | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allDrafts = useAdminListContentDrafts();
  const hasAnyAdImage = useMemo(() => {
    const proposed = (campaign.proposed as CampaignBundle | null)?.adCreatives ?? [];
    const stored = campaign.adCreatives ?? [];
    const max = Math.max(proposed.length, stored.length);
    for (let i = 0; i < max; i += 1) {
      const url = stored[i]?.imageUrl ?? proposed[i]?.imageUrl ?? null;
      if (typeof url === "string" && url.length > 0) return true;
    }
    return false;
  }, [campaign.adCreatives, campaign.proposed]);

  const blogCoverUrl = useMemo(() => {
    if (!campaign.blogDraftId) return null;
    const d = (allDrafts.data ?? []).find((x) => x.id === campaign.blogDraftId);
    return d?.imageRefs?.[0]?.url ?? null;
  }, [allDrafts.data, campaign.blogDraftId]);

  const socialCoverByChannel = useMemo(() => {
    const map = new Map<string, string>();
    const ids = campaign.socialDraftIds ?? [];
    if (!ids.length) return map;
    for (const d of allDrafts.data ?? []) {
      if (!ids.includes(d.id)) continue;
      const url = d.imageRefs?.[0]?.url;
      if (url) map.set(d.channel, url);
    }
    return map;
  }, [allDrafts.data, campaign.socialDraftIds]);

  const hasAnyCampaignImage = hasAnyAdImage || blogCoverUrl != null || socialCoverByChannel.size > 0;

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  function jumpToAdCreative(index: number) {
    if (typeof window === "undefined") return;
    const root = adCreativesRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`[data-ad-index="${index}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedAdIndex(index);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAdIndex(null), 1800);
  }

  function resolveSocialDraftId(channel: string): number | null {
    const ids = campaign.socialDraftIds ?? [];
    const d = (allDrafts.data ?? []).find(
      (x) => ids.includes(x.id) && x.channel === channel,
    );
    return d?.id ?? null;
  }

  function studioJumpReady(success: { kind: string; channel?: string }): boolean {
    if (success.kind === "blog") return campaign.blogDraftId != null;
    if (success.kind === "social" && success.channel) {
      return allDrafts.isFetched && resolveSocialDraftId(success.channel) != null;
    }
    return false;
  }

  function jumpToStudioDraft(success: { kind: string; channel?: string }) {
    let draftId: number | null = null;
    let focusKind: "blog" | "social" | null = null;
    if (success.kind === "blog") {
      draftId = campaign.blogDraftId ?? null;
      focusKind = "blog";
    } else if (success.kind === "social" && success.channel) {
      draftId = resolveSocialDraftId(success.channel);
      focusKind = "social";
    }
    if (!focusKind || draftId == null) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("focusDraft", String(draftId));
    params.set("focusKind", focusKind);
    if (success.channel) params.set("focusChannel", success.channel);
    else params.delete("focusChannel");
    const qs = params.toString();
    const url = (qs ? `?${qs}` : window.location.pathname) + "#content";
    window.history.pushState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new Event("focusdraftchange"));
  }

  function targetKey(t: { kind: string; channel?: string; index?: number }): string {
    if (t.kind === "blog") return "blog";
    if (t.kind === "social") return `social:${t.channel}`;
    return `ad:${t.index}`;
  }

  function targetLabel(t: { kind: string; channel?: string; index?: number }): string {
    if (t.kind === "blog") return "Blog cover";
    if (t.kind === "social") return `Social — ${t.channel}`;
    return `Ad #${(t.index ?? 0) + 1}`;
  }

  async function handleRetryImage(
    target: { kind: "blog" } | { kind: "social"; channel: string } | { kind: "ad"; index: number },
    prompt?: string,
  ) {
    const key = targetKey(target);
    setRetryingKey(key);
    try {
      const result = await retryImage.mutateAsync({
        id: campaign.id,
        data: { target, ...(prompt ? { prompt } : {}) },
      });
      await qc.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
      const url = result?.url ?? "";
      if (url) {
        setRetrySuccess((prev) => ({
          ...prev,
          [key]: {
            url,
            label: targetLabel(target),
            kind: target.kind,
            channel: target.kind === "social" ? target.channel : undefined,
            index: target.kind === "ad" ? target.index : undefined,
          },
        }));
      } else {
        setImageFailures((prev) => prev.filter((f) => targetKey(f.target) !== key));
      }
      toast({ title: "Cover image generated" });
    } catch (err) {
      toast({
        title: "Image generation failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setRetryingKey(null);
    }
  }

  async function save() {
    await update.mutateAsync({ id: campaign.id, data: { proposed: bundle } });
    await qc.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
    toast({ title: "Saved" });
  }
  async function handleApprove() {
    await update.mutateAsync({ id: campaign.id, data: { proposed: bundle } });
    const result = await approve.mutateAsync({
      id: campaign.id,
      data: {
        activateExperience: activate,
        emailScheduledAt: emailSchedule ? new Date(emailSchedule).toISOString() : null,
        blogScheduledAt: blogSchedule ? new Date(blogSchedule).toISOString() : null,
        socialScheduledAt: socialSchedule ? new Date(socialSchedule).toISOString() : null,
      },
    });
    await qc.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
    const failures = result?.imageFailures ?? [];
    setImageFailures(failures);
    if (failures.length) {
      toast({
        title: `Approved — ${failures.length} cover image${failures.length === 1 ? "" : "s"} failed`,
        description: "Drafts created; retry failed images from the panel below or the draft editor.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Approved",
        description: activate
          ? "Experience is live and cover images generated"
          : "Drafts created with cover images",
      });
    }
  }
  async function handleDelete() {
    if (!confirm("Delete this campaign?")) return;
    await del.mutateAsync({ id: campaign.id });
    await qc.invalidateQueries({ queryKey: getAdminListCampaignsQueryKey() });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{campaign.status}</Badge>
              {hasAnyCampaignImage ? (
                <a href={`/api/admin/campaigns/${campaign.id}/covers.zip`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Download className="h-3 w-3 mr-1" /> Download all campaign images
                  </Button>
                </a>
              ) : (
                <Button variant="outline" size="sm" disabled title="Generate at least one cover image first">
                  <Download className="h-3 w-3 mr-1" /> Download all campaign images
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={save} disabled={update.isPending}><Save className="h-3 w-3 mr-1" /> Save</Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{campaign.brief}</div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Experience preset</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Hero title</Label>
              <Input value={bundle.experience.heroTakeover?.title ?? ""}
                onChange={(e) => setBundle({ ...bundle, experience: { ...bundle.experience,
                  heroTakeover: { ...(bundle.experience.heroTakeover ?? { ctaLabel: "Shop now", ctaHref: "/shop" }), title: e.target.value } } })} />
            </div>
            <div><Label>Particle effect</Label>
              <select className="w-full h-10 px-3 rounded-md border bg-background"
                value={bundle.experience.particleEffect ?? "none"}
                onChange={(e) => setBundle({ ...bundle, experience: { ...bundle.experience, particleEffect: e.target.value as CampaignBundle["experience"]["particleEffect"] } })}>
                {["none","rain","snow","leaves","diyas","petals"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Hero subtitle</Label>
            <Textarea rows={2} value={bundle.experience.heroTakeover?.subtitle ?? ""}
              onChange={(e) => setBundle({ ...bundle, experience: { ...bundle.experience,
                heroTakeover: { ...(bundle.experience.heroTakeover ?? { title: "", ctaLabel: "Shop now", ctaHref: "/shop" }), subtitle: e.target.value } } })} />
          </div>
          <div><Label>Banner text</Label>
            <Input value={bundle.experience.banner?.text ?? ""}
              onChange={(e) => setBundle({ ...bundle, experience: { ...bundle.experience,
                banner: e.target.value ? { ...(bundle.experience.banner ?? {}), text: e.target.value } : null } })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Blog draft</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={bundle.blog.title} placeholder="Title"
            onChange={(e) => setBundle({ ...bundle, blog: { ...bundle.blog, title: e.target.value } })} />
          <Textarea rows={6} value={bundle.blog.body} placeholder="Markdown body"
            onChange={(e) => setBundle({ ...bundle, blog: { ...bundle.blog, body: e.target.value } })} />
          <div className="flex items-center gap-2 pt-1">
            {blogCoverUrl ? (
              <>
                <img src={blogCoverUrl} alt={bundle.blog.title || "Blog cover"}
                  className="h-16 w-16 object-cover rounded-md border" />
                <span className="text-[11px] text-muted-foreground flex-1">Cover image ready</span>
                <a href={`/api/admin/campaigns/${campaign.id}/blog-cover/image`}
                  target="_blank" rel="noreferrer" title="Download blog cover">
                  <Button type="button" size="sm" variant="outline">
                    <Download className="h-3 w-3 mr-1" /> Download
                  </Button>
                </a>
              </>
            ) : (
              <>
                <span className="text-[11px] text-muted-foreground flex-1">
                  {campaign.status === "draft"
                    ? "Approve the campaign to generate a cover image."
                    : "No cover image yet."}
                </span>
                <Button type="button" size="sm" variant="outline" disabled
                  title="Generate the blog cover first">
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Social posts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {bundle.socials.map((s, i) => {
            const socialCover = socialCoverByChannel.get(s.channel) ?? null;
            return (
              <div key={s.channel} className="space-y-1 border-l-2 pl-3 border-primary/30">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.channel}</div>
                <Textarea rows={3} value={s.body}
                  onChange={(e) => {
                    const next = [...bundle.socials]; next[i] = { ...s, body: e.target.value };
                    setBundle({ ...bundle, socials: next });
                  }} />
                <div className="flex items-center gap-2 pt-1">
                  {socialCover ? (
                    <>
                      <img src={socialCover} alt={`${s.channel} cover`}
                        className="h-12 w-12 object-cover rounded-md border" />
                      <span className="text-[11px] text-muted-foreground flex-1">Cover image ready</span>
                      <a href={`/api/admin/campaigns/${campaign.id}/social-covers/${encodeURIComponent(s.channel)}/image`}
                        target="_blank" rel="noreferrer" title={`Download ${s.channel} cover`}>
                        <Button type="button" size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </Button>
                      </a>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-muted-foreground flex-1">
                        {campaign.status === "draft"
                          ? "Approve the campaign to generate a cover image."
                          : "No cover image yet."}
                      </span>
                      <Button type="button" size="sm" variant="outline" disabled
                        title="Generate the social cover first">
                        <Download className="h-3 w-3 mr-1" /> Download
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Email</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={bundle.email.subject} placeholder="Subject"
            onChange={(e) => setBundle({ ...bundle, email: { ...bundle.email, subject: e.target.value } })} />
          <Input value={bundle.email.preheader} placeholder="Preheader"
            onChange={(e) => setBundle({ ...bundle, email: { ...bundle.email, preheader: e.target.value } })} />
          <Textarea rows={5} value={bundle.email.body}
            onChange={(e) => setBundle({ ...bundle, email: { ...bundle.email, body: e.target.value } })} />
          <div className="grid grid-cols-2 gap-2">
            <Input value={bundle.email.ctaLabel} placeholder="CTA label"
              onChange={(e) => setBundle({ ...bundle, email: { ...bundle.email, ctaLabel: e.target.value } })} />
            <Input value={bundle.email.ctaUrl} placeholder="CTA URL"
              onChange={(e) => setBundle({ ...bundle, email: { ...bundle.email, ctaUrl: e.target.value } })} />
          </div>
        </CardContent>
      </Card>

      <Card ref={adCreativesRef}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Ad creatives</CardTitle>
            <div className="flex items-center gap-2">
              {hasAnyAdImage ? (
                <a href={`/api/admin/campaigns/${campaign.id}/ad-creatives.zip`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" /> Download all images</Button>
                </a>
              ) : (
                <Button variant="outline" size="sm" disabled title="Generate at least one cover image first">
                  <Download className="h-3 w-3 mr-1" /> Download all images
                </Button>
              )}
              <a href={`/api/admin/campaigns/${campaign.id}/google-ads.csv`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" title="Google Ads Editor RSA bulk-import CSV">
                  <Download className="h-3 w-3 mr-1" /> Google Ads CSV
                </Button>
              </a>
              <a href={`/api/admin/campaigns/${campaign.id}/meta-ads.csv`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" title="Meta Ads Manager bulk-import CSV">
                  <Download className="h-3 w-3 mr-1" /> Meta Ads CSV
                </Button>
              </a>
              <a href={`/api/admin/campaigns/${campaign.id}/ad-creatives.csv`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" title="Generic CSV (one row per creative)">
                  <Download className="h-3 w-3 mr-1" /> Raw CSV
                </Button>
              </a>
              <a href={`/api/admin/campaigns/${campaign.id}/ad-creatives.json`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" /> JSON</Button>
              </a>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {bundle.adCreatives.map((a, i) => {
            const generated = campaign.adCreatives?.[i]?.imageUrl ?? a.imageUrl ?? null;
            const adKey = `ad:${i}`;
            const busy = retryingKey === adKey;
            const canGenerate = (a.imagePrompt ?? "").trim().length > 0 && campaign.status !== "draft";
            const highlighted = highlightedAdIndex === i;
            return (
              <div
                key={i}
                data-ad-index={i}
                className={`border rounded-md p-3 space-y-2 transition-shadow transition-colors duration-500 ${
                  highlighted
                    ? "ring-2 ring-primary border-primary shadow-md bg-primary/5"
                    : ""
                }`}
              >
                <Input value={a.headline} placeholder="Headline"
                  onChange={(e) => {
                    const next = [...bundle.adCreatives]; next[i] = { ...a, headline: e.target.value };
                    setBundle({ ...bundle, adCreatives: next });
                  }} />
                <Textarea rows={2} value={a.description} placeholder="Description"
                  onChange={(e) => {
                    const next = [...bundle.adCreatives]; next[i] = { ...a, description: e.target.value };
                    setBundle({ ...bundle, adCreatives: next });
                  }} />
                <Input value={a.imagePrompt} placeholder="Image prompt"
                  onChange={(e) => {
                    const next = [...bundle.adCreatives]; next[i] = { ...a, imagePrompt: e.target.value };
                    setBundle({ ...bundle, adCreatives: next });
                  }} />
                <div className="flex items-center gap-2 pt-1">
                  {generated ? (
                    <>
                      <img src={generated} alt={a.headline} className="h-16 w-16 object-cover rounded-md border" />
                      <span className="text-[11px] text-muted-foreground flex-1">Cover image ready</span>
                      <a
                        href={`/api/admin/campaigns/${campaign.id}/ad-creatives/${i}/image`}
                        target="_blank"
                        rel="noreferrer"
                        title="Download cover image"
                      >
                        <Button type="button" size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </Button>
                      </a>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground flex-1">
                      {campaign.status === "draft"
                        ? "Approve the campaign to generate a cover image."
                        : "No cover image yet."}
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !canGenerate}
                    title={
                      campaign.status === "draft"
                        ? "Approve the campaign first"
                        : !(a.imagePrompt ?? "").trim()
                        ? "Add an image prompt first"
                        : undefined
                    }
                    onClick={() => handleRetryImage({ kind: "ad", index: i }, a.imagePrompt)}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${busy ? "animate-spin" : ""}`} />
                    {busy ? "Working…" : generated ? "Regenerate image" : "Generate image"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {imageFailures.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Cover images that failed to generate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Approval still succeeded — drafts and ad creatives were created. Click Retry image
              on a row below to regenerate just that one cover without re-approving.
            </p>
            {imageFailures.map((f, i) => {
              const label = targetLabel(f.target);
              const key = targetKey(f.target);
              const busy = retryingKey === key;
              const expanded = expandedFailureKey === key;
              const editedPrompt = failurePromptDrafts[key] ?? f.prompt;
              const success = retrySuccess[key];
              const retryTarget =
                f.target.kind === "blog"
                  ? ({ kind: "blog" } as const)
                  : f.target.kind === "social"
                  ? ({ kind: "social", channel: f.target.channel ?? "" } as const)
                  : ({ kind: "ad", index: f.target.index ?? 0 } as const);
              if (success) {
                const showStudioLink = success.kind === "blog" || success.kind === "social";
                const showAdJump = success.kind === "ad" && typeof success.index === "number";
                return (
                  <div key={i} className="text-xs border rounded-md p-2 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900">
                    <a href={success.url} target="_blank" rel="noreferrer" title="Open full image">
                      <img
                        src={success.url}
                        alt={`${label} cover`}
                        className="h-12 w-12 object-cover rounded-md border hover:opacity-80 transition-opacity"
                      />
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-emerald-700 dark:text-emerald-400">
                        ✓ New cover generated
                      </div>
                      <div className="text-muted-foreground truncate">{label}</div>
                    </div>
                    {showStudioLink ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={!studioJumpReady(success)}
                        title={
                          studioJumpReady(success)
                            ? undefined
                            : "Loading drafts…"
                        }
                        onClick={() => jumpToStudioDraft(success)}
                      >
                        View in Content Studio
                      </Button>
                    ) : null}
                    {showAdJump ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => jumpToAdCreative(success.index as number)}
                      >
                        Jump to creative
                      </Button>
                    ) : null}
                  </div>
                );
              }
              return (
                <div key={i} className="text-xs border rounded-md p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{label}</div>
                      <div className="text-destructive">{f.error}</div>
                      {!expanded && editedPrompt ? (
                        <div className="text-muted-foreground truncate" title={editedPrompt}>Prompt: {editedPrompt}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedFailureKey(expanded ? null : key)}
                      >
                        {expanded ? "Hide prompt" : "Edit prompt"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => handleRetryImage(retryTarget, editedPrompt.trim() || undefined)}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${busy ? "animate-spin" : ""}`} />
                        {busy ? "Retrying…" : "Retry image"}
                      </Button>
                    </div>
                  </div>
                  {expanded ? (
                    <Textarea
                      rows={3}
                      value={editedPrompt}
                      placeholder="Image prompt"
                      onChange={(e) => setFailurePromptDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Rocket className="h-4 w-4" /> Approve & schedule</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            Activate experience preset on the homepage now
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Email send time</Label>
              <Input type="datetime-local" value={emailSchedule} onChange={(e) => setEmailSchedule(e.target.value)} />
            </div>
            <div>
              <Label>Blog publish time</Label>
              <Input type="datetime-local" value={blogSchedule} onChange={(e) => setBlogSchedule(e.target.value)} />
            </div>
            <div>
              <Label>Social publish time</Label>
              <Input type="datetime-local" value={socialSchedule} onChange={(e) => setSocialSchedule(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Leave any field blank to keep that card as a draft.</p>
          <div className="flex justify-end">
            <Button onClick={handleApprove} disabled={approve.isPending}>
              <Rocket className="h-4 w-4 mr-2" /> {approve.isPending ? "Applying…" : "Approve & apply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Merchant feeds
// ──────────────────────────────────────────────────────────────────────

function FeedsPanel() {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const feeds = [
    { label: "Google Merchant XML", path: "/feeds/google-merchant.xml" },
    { label: "Meta catalog CSV", path: "/feeds/meta-catalog.csv" },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Merchant feeds</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Auto-refreshed from your live catalog. Submit these URLs to Google Merchant Center
            and Meta Commerce Manager. They serve a 10-minute cache so back-to-back product edits
            don't hammer the catalog.
          </p>
          {feeds.map((f) => {
            const url = `${base}${f.path}`;
            return (
              <div key={f.path} className="flex items-center gap-2 border rounded-md p-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground font-mono break-all">{url}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(url)}>Copy</Button>
                <a href={f.path} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" /> Open</Button>
                </a>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Keyword watch
// ──────────────────────────────────────────────────────────────────────

function KeywordsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const list = useAdminListKeywords();
  const create = useAdminCreateKeyword();
  const del = useAdminDeleteKeyword();
  const refresh = useAdminRefreshKeywords();
  const summarize = useAdminSummarizeKeywords();
  const status = useAdminKeywordRankStatus();
  const setProvider = useAdminSetKeywordRankProvider();
  const [term, setTerm] = useState("");

  async function add() {
    if (term.trim().length < 2) return;
    try {
      await create.mutateAsync({ data: { term: term.trim() } });
      setTerm("");
      await qc.invalidateQueries({ queryKey: getAdminListKeywordsQueryKey() });
    } catch (err) {
      toast({ title: "Could not add keyword", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  }

  const mode = status.data?.mode ?? "shadow";
  const activeProvider = status.data?.activeProvider;
  const providers = status.data?.providers ?? [];
  const activeMeta = providers.find((p) => p.id === activeProvider);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Keyword &amp; rank watch</CardTitle>
              {status.data ? (
                <Badge variant={mode === "live" ? "default" : "secondary"}>
                  {mode === "live" ? `Live · ${activeMeta?.label ?? activeProvider}` : "Shadow mode"}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={async () => {
                const r = await refresh.mutateAsync();
                await qc.invalidateQueries({ queryKey: getAdminListKeywordsQueryKey() });
                toast({ title: "Ranks refreshed", description: `Checked ${r.checked}, tracked ${r.tracked}` });
              }}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh ranks
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                const r = await summarize.mutateAsync();
                await qc.invalidateQueries({ queryKey: getAdminListKeywordsQueryKey() });
                toast({ title: "Summary regenerated", description: `${r.updated} updated` });
              }}>
                <Sparkles className="h-3 w-3 mr-1" /> AI summary
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SERP provider config */}
          <div className="border rounded-md p-3 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">
                SERP rank provider
              </Label>
              <select
                className="border rounded h-8 px-2 text-sm bg-background"
                value={activeProvider ?? "serpapi"}
                disabled={!status.data || setProvider.isPending}
                onChange={async (e) => {
                  const next = e.target.value as typeof providers[number]["id"];
                  await setProvider.mutateAsync({ data: { provider: next } });
                  await qc.invalidateQueries({ queryKey: getAdminKeywordRankStatusQueryKey() });
                  toast({ title: `Switched to ${providers.find((p) => p.id === next)?.label ?? next}` });
                }}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.configured ? "✓" : "(no key)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-muted-foreground">
              {providers.map((p) => (
                <div key={p.id} className="flex items-center gap-1">
                  <span className={p.configured ? "text-green-600" : "text-muted-foreground"}>
                    {p.configured ? "●" : "○"}
                  </span>
                  <strong>{p.label}</strong>
                  <span>— {p.freeTierNote}.</span>
                  {!p.configured && (
                    <a
                      href={p.signupUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-foreground"
                      title={`Then add ${p.envKey} as an environment secret`}
                    >
                      Get a free key
                    </a>
                  )}
                </div>
              ))}
            </div>
            {mode === "shadow" && activeMeta && (
              <p className="text-[11px] text-amber-600">
                Active provider <strong>{activeMeta.label}</strong> has no key set. Add{" "}
                <code className="font-mono">{activeMeta.envKey}</code> as an environment secret,
                or switch to a provider that has one configured.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Add a keyword (e.g. 'best masala chai online')"
              onKeyDown={(e) => { if (e.key === "Enter") void add(); }} />
            <Button onClick={add}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Up to 50 terms. Daily check runs automatically.
          </p>
          <div className="space-y-2">
            {(list.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No keywords tracked yet.</p>
            ) : (list.data ?? []).map((k) => {
              const delta = k.delta;
              const Arrow = delta == null ? Minus : (delta > 0 ? ArrowUp : (delta < 0 ? ArrowDown : Minus));
              const tone = delta == null ? "text-muted-foreground" : delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-muted-foreground";
              return (
                <div key={k.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{k.term}</div>
                    <div className="flex items-center gap-3">
                      <div className={`text-xs flex items-center gap-1 ${tone}`}>
                        <Arrow className="h-3 w-3" />
                        {k.currentRank ?? "—"}{delta != null && delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}
                      </div>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await del.mutateAsync({ id: k.id });
                        await qc.invalidateQueries({ queryKey: getAdminListKeywordsQueryKey() });
                      }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {k.lastSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground italic">{k.lastSummary}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
