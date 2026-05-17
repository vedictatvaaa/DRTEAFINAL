import { useEffect, useMemo, useState } from "react";
import {
  useListExperiences,
  useActivateExperience,
  useUpdateExperience,
  getListExperiencesQueryKey,
  getGetActiveExperienceQueryKey,
  type Experience,
  type ParticleEffect,
  type UpdateExperienceRequest,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ImageField } from "@/components/admin/ImageField";
import { ParticleSwatch } from "@/components/experience/ParticleSwatch";

const PRIMARY_TOKENS = ["background", "primary", "accent", "secondary", "muted"] as const;
const PARTICLES: ParticleEffect[] = ["none", "rain", "snow", "leaves", "diyas", "petals"];

function ThemeSwatches({ tokens }: { tokens: Experience["themeTokens"] }) {
  return (
    <div className="flex gap-1.5">
      {PRIMARY_TOKENS.map((name) => {
        const v = tokens?.[name];
        if (!v) return null;
        return (
          <div
            key={name}
            title={`--${name}: ${v}`}
            className="h-7 w-7 rounded-md border border-black/10 shadow-sm"
            style={{ background: `hsl(${v})` }}
          />
        );
      })}
    </div>
  );
}

interface DraftState {
  bannerText: string;
  bannerCtaLabel: string;
  bannerCtaHref: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroImageUrl: string;
  particleEffect: ParticleEffect;
}

function expToDraft(exp: Experience): DraftState {
  return {
    bannerText: exp.banner?.text ?? "",
    bannerCtaLabel: exp.banner?.ctaLabel ?? "",
    bannerCtaHref: exp.banner?.ctaHref ?? "",
    heroEyebrow: exp.heroTakeover?.eyebrow ?? "",
    heroTitle: exp.heroTakeover?.title ?? "",
    heroSubtitle: exp.heroTakeover?.subtitle ?? "",
    heroCtaLabel: exp.heroTakeover?.ctaLabel ?? "",
    heroCtaHref: exp.heroTakeover?.ctaHref ?? "",
    heroImageUrl: exp.heroTakeover?.imageUrl ?? "",
    particleEffect: exp.particleEffect ?? "none",
  };
}

function draftToPayload(d: DraftState): UpdateExperienceRequest {
  const banner = d.bannerText.trim()
    ? {
        text: d.bannerText.trim(),
        ctaLabel: d.bannerCtaLabel.trim() || undefined,
        ctaHref: d.bannerCtaHref.trim() || undefined,
      }
    : null;
  const hero =
    d.heroTitle.trim() && d.heroCtaLabel.trim() && d.heroCtaHref.trim()
      ? {
          eyebrow: d.heroEyebrow.trim() || undefined,
          title: d.heroTitle.trim(),
          subtitle: d.heroSubtitle.trim() || undefined,
          ctaLabel: d.heroCtaLabel.trim(),
          ctaHref: d.heroCtaHref.trim(),
          imageUrl: d.heroImageUrl.trim() || undefined,
        }
      : null;
  return { banner, heroTakeover: hero, particleEffect: d.particleEffect };
}

export default function ExperienceTab() {
  const list = useListExperiences();
  const activate = useActivateExperience();
  const update = useUpdateExperience();
  const qc = useQueryClient();
  const { toast } = useToast();

  const experiences = useMemo(() => list.data ?? [], [list.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => experiences.find((e) => e.id === selectedId) ?? experiences[0] ?? null,
    [experiences, selectedId],
  );
  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    if (selected) setDraft(expToDraft(selected));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListExperiencesQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetActiveExperienceQueryKey() }),
    ]);
  };

  const onActivate = async (exp: Experience) => {
    if (exp.isActive) return;
    try {
      await activate.mutateAsync({ id: exp.id });
      await invalidate();
      toast({ title: `${exp.name} activated`, description: "Storefront updated live." });
    } catch (err) {
      toast({
        title: "Failed to activate",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const onSave = async () => {
    if (!selected || !draft) return;
    try {
      await update.mutateAsync({ id: selected.id, data: draftToPayload(draft) });
      await invalidate();
      toast({ title: `${selected.name} saved`, description: "Changes are live for active experience." });
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (list.isLoading) return <div className="text-muted-foreground">Loading experiences…</div>;
  if (list.error) return <div className="text-destructive">Failed to load experiences.</div>;

  const set = <K extends keyof DraftState>(k: K, v: DraftState[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-serif">Live Experience</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Pick a global experience. Colours, banner, hero takeover and ambient particles update across the
          entire storefront in real time — no redeploy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* List */}
        <div className="space-y-2">
          {experiences.map((exp) => (
            <Card
              key={exp.id}
              onClick={() => setSelectedId(exp.id)}
              className={`p-3 cursor-pointer transition ${
                selected?.id === exp.id ? "ring-2 ring-primary" : "hover:bg-muted/40"
              }`}
              data-testid={`exp-row-${exp.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-serif text-sm">{exp.name}</div>
                  <div className="text-[11px] text-muted-foreground">{exp.particleEffect}</div>
                </div>
                {exp.isActive && (
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Active
                  </span>
                )}
              </div>
              <ThemeSwatches tokens={exp.themeTokens} />
            </Card>
          ))}
        </div>

        {/* Editor */}
        {selected && draft ? (
          <Card className="p-5 space-y-6">
            <div className="flex items-start justify-between gap-3 pb-4 border-b">
              <div>
                <div className="font-serif text-lg">{selected.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{selected.description}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selected.isActive ? "outline" : "default"}
                  disabled={selected.isActive || activate.isPending}
                  onClick={() => onActivate(selected)}
                  data-testid={`activate-${selected.id}`}
                >
                  {selected.isActive ? "Active" : "Activate"}
                </Button>
                <Button onClick={onSave} disabled={update.isPending} data-testid="save-experience">
                  {update.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Festive Banner</h3>
              <div>
                <Label className="text-xs">Banner text (leave blank to hide)</Label>
                <Input value={draft.bannerText} onChange={(e) => set("bannerText", e.target.value)} placeholder="Diya-lit Diwali drops — free silk pouch on ₹999+" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CTA label</Label>
                  <Input value={draft.bannerCtaLabel} onChange={(e) => set("bannerCtaLabel", e.target.value)} placeholder="Shop gifting" />
                </div>
                <div>
                  <Label className="text-xs">CTA href</Label>
                  <Input value={draft.bannerCtaHref} onChange={(e) => set("bannerCtaHref", e.target.value)} placeholder="/shop/tea-reserve" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Homepage Hero Takeover</h3>
              <p className="text-[11px] text-muted-foreground -mt-1">Title + CTA label + CTA href all required to take over the home hero. Otherwise the default hero shows.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Eyebrow</Label>
                  <Input value={draft.heroEyebrow} onChange={(e) => set("heroEyebrow", e.target.value)} placeholder="Diwali Gold" />
                </div>
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={draft.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} placeholder="Light · Spice · Celebration" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Subtitle</Label>
                <Textarea rows={2} value={draft.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} placeholder="Festive blends and limited-edition gifting tins…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CTA label</Label>
                  <Input value={draft.heroCtaLabel} onChange={(e) => set("heroCtaLabel", e.target.value)} placeholder="Explore Diwali edit" />
                </div>
                <div>
                  <Label className="text-xs">CTA href</Label>
                  <Input value={draft.heroCtaHref} onChange={(e) => set("heroCtaHref", e.target.value)} placeholder="/shop/tea-reserve" />
                </div>
              </div>
              <ImageField
                label="Background image"
                value={draft.heroImageUrl}
                onChange={(url) => set("heroImageUrl", url)}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ambient Particles</h3>
              <div className="flex flex-wrap gap-3">
                {PARTICLES.map((p) => (
                  <button
                    key={p}
                    onClick={() => set("particleEffect", p)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-md border transition ${
                      draft.particleEffect === p
                        ? "border-primary ring-2 ring-primary"
                        : "border-input hover:bg-muted"
                    }`}
                    data-testid={`particle-${p}`}
                  >
                    <ParticleSwatch effect={p} />
                    <span className="text-[11px] capitalize font-medium">{p}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Particles auto-disable for visitors with reduced-motion preference and pause when the tab is hidden.
              </p>
            </section>
          </Card>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">Pick an experience to edit.</Card>
        )}
      </div>
    </div>
  );
}
