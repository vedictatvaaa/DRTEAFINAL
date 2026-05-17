import { useEffect, useState } from "react";
import {
  useAdminGetHomepageSeo,
  useAdminPatchHomepageSeo,
  useAdminSuggestHomepageSeo,
  getAdminGetHomepageSeoQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Save, RotateCcw } from "lucide-react";

interface FormState {
  h1Visible: string;
  h1SrOnly: string;
  h1Subline: string;
  heroEyebrow: string;
  heroSubcopy: string;
  metaKeywordsCsv: string;
  breadcrumbHomeLabel: string;
  breadcrumbsJsonLdEnabled: boolean;
}

function fmtDate(s?: string | null): string {
  if (!s) return "never";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function csvToList(csv: string): string[] {
  return csv
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export default function HomepageSeoSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const query = useAdminGetHomepageSeo();
  const patch = useAdminPatchHomepageSeo();
  const suggest = useAdminSuggestHomepageSeo();
  const [form, setForm] = useState<FormState | null>(null);

  // Initialise the form from the effective view so empty raw fields show
  // their defaults — saving an unchanged field still writes the default,
  // which is fine; raw will simply mirror effective.
  useEffect(() => {
    if (!query.data?.effective || form) return;
    const eff = query.data.effective;
    setForm({
      h1Visible: eff.h1Visible,
      h1SrOnly: eff.h1SrOnly,
      h1Subline: eff.h1Subline,
      heroEyebrow: eff.heroEyebrow,
      heroSubcopy: eff.heroSubcopy,
      metaKeywordsCsv: eff.metaKeywords.join(", "),
      breadcrumbHomeLabel: eff.breadcrumbHomeLabel,
      breadcrumbsJsonLdEnabled: eff.breadcrumbsJsonLdEnabled,
    });
  }, [query.data, form]);

  const raw = query.data?.raw;
  const isLoading = query.isLoading || !form;

  const handleSave = async () => {
    if (!form) return;
    try {
      await patch.mutateAsync({
        data: {
          h1Visible: form.h1Visible.trim() || null,
          h1SrOnly: form.h1SrOnly.trim() || null,
          h1Subline: form.h1Subline.trim() || null,
          heroEyebrow: form.heroEyebrow.trim() || null,
          heroSubcopy: form.heroSubcopy.trim() || null,
          metaKeywords: csvToList(form.metaKeywordsCsv),
          breadcrumbHomeLabel: form.breadcrumbHomeLabel.trim() || null,
          breadcrumbsJsonLdEnabled: form.breadcrumbsJsonLdEnabled,
        },
      });
      qc.invalidateQueries({ queryKey: getAdminGetHomepageSeoQueryKey() });
      qc.invalidateQueries({ queryKey: ["seo-public", "homepage"] });
      toast({ title: "Saved", description: "Homepage SEO updated." });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSuggest = async () => {
    try {
      const res = await suggest.mutateAsync();
      if (!res.aiAvailable) {
        toast({
          title: "AI unavailable",
          description: "Set OPENAI_API_KEY to enable suggestions.",
          variant: "destructive",
        });
        return;
      }
      const s = res.suggestion;
      setForm((prev) =>
        prev
          ? {
              ...prev,
              h1Visible: s.h1Visible,
              h1SrOnly: s.h1SrOnly,
              h1Subline: s.h1Subline,
              heroEyebrow: s.heroEyebrow,
              heroSubcopy: s.heroSubcopy,
              metaKeywordsCsv: s.metaKeywords.join(", "),
            }
          : prev,
      );
      qc.invalidateQueries({ queryKey: getAdminGetHomepageSeoQueryKey() });
      toast({
        title: "AI suggestion drafted",
        description: s.rationale.slice(0, 140),
      });
    } catch (err) {
      toast({
        title: "Suggest failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleResetField = (field: keyof FormState) => {
    if (!query.data?.effective || !form) return;
    const eff = query.data.effective;
    setForm({
      ...form,
      [field]:
        field === "metaKeywordsCsv"
          ? eff.metaKeywords.join(", ")
          : field === "breadcrumbsJsonLdEnabled"
            ? eff.breadcrumbsJsonLdEnabled
            : (eff[field as keyof typeof eff] as string),
    });
  };

  return (
    <Card className="p-5 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Homepage Hero & SEO</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Controls the H1 (visible + screen-reader expansion), sub-line,
            sub-copy, meta keywords (site-wide default), and the breadcrumb
            JSON-LD. Changes go live within ~1 minute (60s edge cache).
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Last AI suggestion: {fmtDate(raw?.lastAiSuggestionAt)} · Last save:{" "}
            {fmtDate(raw?.updatedAt)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={suggest.isPending || isLoading}
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {suggest.isPending ? "Thinking…" : "AI Suggest"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={patch.isPending || isLoading}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {patch.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {isLoading || !form ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading homepage SEO…
        </div>
      ) : (
        <div className="grid gap-4">
          <Field
            label="Hero eyebrow"
            hint="Small italic line above the H1. Default: “Single-estate Indian tea”. Keep it short, keyword-rich, and a complete phrase (no dangling “for”)."
            isOverridden={raw?.heroEyebrow != null}
            onReset={() => handleResetField("heroEyebrow")}
          >
            <Input
              value={form.heroEyebrow}
              maxLength={80}
              onChange={(e) =>
                setForm({ ...form, heroEyebrow: e.target.value })
              }
            />
          </Field>

          <Field
            label="H1 — visible"
            hint="Use a newline to control the line break (e.g. “Buy Premium\nIndian Tea Online”)."
            isOverridden={raw?.h1Visible != null}
            onReset={() => handleResetField("h1Visible")}
          >
            <Textarea
              rows={2}
              value={form.h1Visible}
              maxLength={200}
              onChange={(e) =>
                setForm({ ...form, h1Visible: e.target.value })
              }
            />
          </Field>

          <Field
            label="H1 — screen-reader expansion"
            hint="Hidden text Google still indexes. Pack the long-tail keywords here, e.g. categories, regions, USPs."
            isOverridden={raw?.h1SrOnly != null}
            onReset={() => handleResetField("h1SrOnly")}
          >
            <Textarea
              rows={3}
              value={form.h1SrOnly}
              maxLength={800}
              onChange={(e) =>
                setForm({ ...form, h1SrOnly: e.target.value })
              }
            />
          </Field>

          <Field
            label="Sub-line"
            hint="Bold tagline under the H1. Default: “Masala Chai · CTC · Black Tea · Darjeeling Tea · Green Tea· Assam Tea”."
            isOverridden={raw?.h1Subline != null}
            onReset={() => handleResetField("h1Subline")}
          >
            <Input
              value={form.h1Subline}
              maxLength={240}
              onChange={(e) =>
                setForm({ ...form, h1Subline: e.target.value })
              }
            />
          </Field>

          <Field
            label="Hero sub-copy"
            hint="The longer paragraph under the sub-line."
            isOverridden={raw?.heroSubcopy != null}
            onReset={() => handleResetField("heroSubcopy")}
          >
            <Textarea
              rows={3}
              value={form.heroSubcopy}
              maxLength={400}
              onChange={(e) =>
                setForm({ ...form, heroSubcopy: e.target.value })
              }
            />
          </Field>

          <Field
            label="Meta keywords (site-wide default)"
            hint="Comma- or newline-separated. Max 20 terms, 80 chars each. Per-page Seo() components on product/article pages override this."
            isOverridden={(raw?.metaKeywords ?? []).length > 0}
            onReset={() => handleResetField("metaKeywordsCsv")}
          >
            <Textarea
              rows={3}
              value={form.metaKeywordsCsv}
              onChange={(e) =>
                setForm({ ...form, metaKeywordsCsv: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              {csvToList(form.metaKeywordsCsv).length} / 20 terms
            </p>
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Breadcrumb home label"
              hint="Used for the breadcrumb root and its JSON-LD."
              isOverridden={raw?.breadcrumbHomeLabel != null}
              onReset={() => handleResetField("breadcrumbHomeLabel")}
            >
              <Input
                value={form.breadcrumbHomeLabel}
                maxLength={40}
                onChange={(e) =>
                  setForm({ ...form, breadcrumbHomeLabel: e.target.value })
                }
              />
            </Field>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Emit BreadcrumbList JSON-LD
              </Label>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={form.breadcrumbsJsonLdEnabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, breadcrumbsJsonLdEnabled: v })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {form.breadcrumbsJsonLdEnabled ? "On" : "Off"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                When on, every breadcrumb-bearing page injects a
                schema.org BreadcrumbList script.
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  hint,
  isOverridden,
  onReset,
  children,
}: {
  label: string;
  hint?: string;
  isOverridden?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          {label}
          {isOverridden ? (
            <Badge variant="secondary" className="text-[10px]">
              custom
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              default
            </Badge>
          )}
        </Label>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            reset
          </button>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
