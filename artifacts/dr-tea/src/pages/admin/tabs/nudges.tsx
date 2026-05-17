// Admin tab: configure the witty popup-nudge feature.
// - Master on/off toggle
// - Tone picker (witty / sarcastic / romcom / inspirational / hilarious)
// - Trigger picker
// - Threshold sliders
// - Custom-message CRUD (admin-authored lines mixed into the bundled library)
// - Live preview

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  BellRing,
  Save,
  Sparkles,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  Eye,
} from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

const ALL_TONES = ["witty", "sarcastic", "romcom", "inspirational", "hilarious"] as const;
type Tone = (typeof ALL_TONES)[number];

const ALL_TRIGGERS = [
  "idle_browse",
  "exit_intent",
  "product_dwell",
  "many_products",
  "cart_idle",
  "return_visit",
] as const;
type Trigger = (typeof ALL_TRIGGERS)[number];

const TONE_LABEL: Record<Tone, string> = {
  witty: "Witty",
  sarcastic: "Sarcastic",
  romcom: "Rom-com",
  inspirational: "Inspirational",
  hilarious: "Hilarious",
};
const TRIGGER_LABEL: Record<Trigger, string> = {
  idle_browse: "Idle browsing (no cart, just scrolling)",
  exit_intent: "Exit intent (about to close the tab)",
  product_dwell: "Long stare at a product page",
  many_products: "Browsed many products, none added",
  cart_idle: "Items in cart, hasn't checked out",
  return_visit: "Came back without buying last time",
};

interface NudgeCustomMessage {
  id?: string;
  tone: Tone;
  trigger: Trigger;
  text: string;
  cta?: string;
}

interface Settings {
  enabled: boolean;
  tones: Tone[];
  triggers: Trigger[];
  idleSeconds: number;
  productDwellSeconds: number;
  manyProductsThreshold: number;
  cartIdleSeconds: number;
  maxPerSession: number;
  cooldownSeconds: number;
  customMessages: NudgeCustomMessage[];
}

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  tones: ["witty", "inspirational", "romcom"],
  triggers: ["idle_browse", "exit_intent", "product_dwell", "cart_idle"],
  idleSeconds: 45,
  productDwellSeconds: 25,
  manyProductsThreshold: 4,
  cartIdleSeconds: 40,
  maxPerSession: 2,
  cooldownSeconds: 90,
  customMessages: [],
};

export default function NudgesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-nudge-settings"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/nudges/settings`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load");
      const j = await r.json();
      return j.settings as Settings;
    },
  });

  const [draft, setDraft] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (data) setDraft({ ...DEFAULT_SETTINGS, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: Settings) => {
      const r = await fetch(`${API}/admin/nudges/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.enabled,
          tones: next.tones,
          triggers: next.triggers,
          idleSeconds: next.idleSeconds,
          productDwellSeconds: next.productDwellSeconds,
          manyProductsThreshold: next.manyProductsThreshold,
          cartIdleSeconds: next.cartIdleSeconds,
          maxPerSession: next.maxPerSession,
          cooldownSeconds: next.cooldownSeconds,
          customMessages: next.customMessages.map((m) => ({
            id: m.id,
            tone: m.tone,
            trigger: m.trigger,
            text: m.text.trim(),
            cta: m.cta?.trim() || undefined,
          })),
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
      return r.json();
    },
    onSuccess: () => {
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["admin-nudge-settings"] });
    },
  });

  function toggleTone(t: Tone) {
    setDraft((d) => ({
      ...d,
      tones: d.tones.includes(t) ? d.tones.filter((x) => x !== t) : [...d.tones, t],
    }));
  }
  function toggleTrigger(t: Trigger) {
    setDraft((d) => ({
      ...d,
      triggers: d.triggers.includes(t)
        ? d.triggers.filter((x) => x !== t)
        : [...d.triggers, t],
    }));
  }
  function addCustom() {
    setDraft((d) => ({
      ...d,
      customMessages: [
        ...d.customMessages,
        { tone: "witty", trigger: "idle_browse", text: "", cta: "" },
      ],
    }));
  }
  function updateCustom(i: number, patch: Partial<NudgeCustomMessage>) {
    setDraft((d) => ({
      ...d,
      customMessages: d.customMessages.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    }));
  }
  function removeCustom(i: number) {
    setDraft((d) => ({
      ...d,
      customMessages: d.customMessages.filter((_, idx) => idx !== i),
    }));
  }

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify({ ...DEFAULT_SETTINGS, ...(data ?? {}) }),
    [draft, data],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading nudges…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
          <BellRing className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-serif text-[#1a2416]">Witty Nudges</h1>
          <p className="text-sm text-gray-500">
            Charming popups for shoppers who browse but don't buy.
          </p>
        </div>
      </div>

      {/* Master toggle */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-[#1a2416]">Feature is {draft.enabled ? "ON" : "OFF"}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Master switch. When off, no nudges appear anywhere on the site.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              draft.enabled ? "bg-[#3a5a2c]" : "bg-gray-300"
            }`}
            aria-pressed={draft.enabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                draft.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Tones */}
      <Card className="p-5">
        <p className="font-semibold text-[#1a2416] mb-1">Allowed tones</p>
        <p className="text-xs text-gray-500 mb-3">Mix and match. Empty = all tones.</p>
        <div className="flex flex-wrap gap-2">
          {ALL_TONES.map((t) => {
            const on = draft.tones.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTone(t)}
                className={`text-xs uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full border transition ${
                  on
                    ? "bg-[#1a2416] text-amber-100 border-[#1a2416]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {TONE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Triggers */}
      <Card className="p-5">
        <p className="font-semibold text-[#1a2416] mb-1">When to nudge</p>
        <p className="text-xs text-gray-500 mb-3">Pick the moments that feel right for your shop.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {ALL_TRIGGERS.map((t) => {
            const on = draft.triggers.includes(t);
            return (
              <label
                key={t}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  on ? "border-[#3a5a2c] bg-[#3a5a2c]/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleTrigger(t)}
                  className="mt-0.5 h-4 w-4 accent-[#3a5a2c]"
                />
                <span className="text-sm text-[#1a2416] leading-snug">{TRIGGER_LABEL[t]}</span>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Thresholds */}
      <Card className="p-5">
        <p className="font-semibold text-[#1a2416] mb-3">Timing & frequency</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField
            label="Idle browse (seconds)"
            value={draft.idleSeconds}
            min={5}
            max={600}
            onChange={(v) => setDraft({ ...draft, idleSeconds: v })}
          />
          <NumField
            label="Product dwell (seconds)"
            value={draft.productDwellSeconds}
            min={5}
            max={600}
            onChange={(v) => setDraft({ ...draft, productDwellSeconds: v })}
          />
          <NumField
            label="Many-products threshold"
            value={draft.manyProductsThreshold}
            min={1}
            max={50}
            onChange={(v) => setDraft({ ...draft, manyProductsThreshold: v })}
          />
          <NumField
            label="Cart idle (seconds)"
            value={draft.cartIdleSeconds}
            min={5}
            max={600}
            onChange={(v) => setDraft({ ...draft, cartIdleSeconds: v })}
          />
          <NumField
            label="Max nudges per session"
            value={draft.maxPerSession}
            min={1}
            max={10}
            onChange={(v) => setDraft({ ...draft, maxPerSession: v })}
          />
          <NumField
            label="Cooldown between nudges (seconds)"
            value={draft.cooldownSeconds}
            min={10}
            max={3600}
            onChange={(v) => setDraft({ ...draft, cooldownSeconds: v })}
          />
        </div>
      </Card>

      {/* Custom messages */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-[#1a2416]">Your custom lines</p>
            <p className="text-xs text-gray-500">
              Mixed in with the bundled library. {draft.customMessages.length} added.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCustom}>
            <Plus className="w-4 h-4 mr-1" /> Add line
          </Button>
        </div>
        {draft.customMessages.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 border border-dashed rounded-lg">
            No custom lines yet. The bundled witty library is doing the talking.
          </div>
        ) : (
          <div className="space-y-3">
            {draft.customMessages.map((m, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={m.tone} onValueChange={(v) => updateCustom(i, { tone: v as Tone })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_TONES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TONE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={m.trigger}
                    onValueChange={(v) => updateCustom(i, { trigger: v as Trigger })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_TRIGGERS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TRIGGER_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Your one-liner. Keep it under 240 characters."
                  value={m.text}
                  maxLength={240}
                  onChange={(e) => updateCustom(i, { text: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="CTA button (optional, e.g. 'Show me')"
                    value={m.cta ?? ""}
                    maxLength={40}
                    onChange={(e) => updateCustom(i, { cta: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCustom(i)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Preview */}
      <Card className="p-5 bg-gradient-to-br from-[#0f1612] to-[#1a2416] text-white">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-amber-200" />
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-amber-200">
            Live preview
          </p>
        </div>
        <div className="rounded-xl bg-[#0a1108] p-4 ring-1 ring-amber-300/20">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-200" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] uppercase tracking-[0.22em] text-amber-200/80 font-bold mb-1.5">
                {draft.tones[0] ? TONE_LABEL[draft.tones[0]] : "Witty"} · A note from Dr Tea
              </p>
              <p className="font-serif text-base leading-snug">
                {draft.customMessages[0]?.text ||
                  "Tea leaves don't get younger. Neither do you. Pick a tin."}
              </p>
              <div className="mt-3">
                <span className="inline-flex items-center text-[11px] uppercase tracking-[0.2em] font-bold bg-amber-300 text-[#1a2416] px-3 py-1.5 rounded-md">
                  {draft.customMessages[0]?.cta || "Show me tea"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {save.isError ? (
            <span className="text-red-600">{(save.error as Error).message}</span>
          ) : savedAt ? (
            <span className="inline-flex items-center text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Saved
            </span>
          ) : dirty ? (
            <span>Unsaved changes</span>
          ) : (
            <span>All saved</span>
          )}
        </div>
        <Button
          onClick={() => save.mutate(draft)}
          disabled={save.isPending || !dirty}
          className="bg-[#1a2416] hover:bg-[#2c3826] text-white"
        >
          {save.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
    </label>
  );
}
