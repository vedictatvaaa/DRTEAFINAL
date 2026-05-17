import { Trash2, Plus } from "lucide-react";
import type { BrewingGuide } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BrewingGuideEditorProps {
  value: BrewingGuide;
  onChange: (next: BrewingGuide) => void;
}

const EMPTY: BrewingGuide = { temperature: "", steepTime: "", cupSize: "", teaAmount: "", steps: [] };

export function BrewingGuideEditor({ value, onChange }: BrewingGuideEditorProps) {
  const v = value ?? EMPTY;
  const steps = v.steps ?? [];

  const setField = <K extends keyof BrewingGuide>(k: K, val: BrewingGuide[K]) =>
    onChange({ ...v, [k]: val });

  const updateStep = (i: number, val: string) =>
    setField("steps", steps.map((s, j) => (i === j ? val : s)));
  const removeStep = (i: number) => setField("steps", steps.filter((_, j) => j !== i));
  const addStep = () => setField("steps", [...steps, ""]);

  return (
    <div className="space-y-3">
      <Label>Brewing guide</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Temperature</Label>
          <Input value={v.temperature} placeholder="85°C" onChange={(e) => setField("temperature", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Steep time</Label>
          <Input value={v.steepTime} placeholder="3-5 min" onChange={(e) => setField("steepTime", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Cup size</Label>
          <Input value={v.cupSize} placeholder="200ml" onChange={(e) => setField("cupSize", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Tea amount</Label>
          <Input value={v.teaAmount} placeholder="1 tsp" onChange={(e) => setField("teaAmount", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Steps</Label>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-3 w-3 mr-1" /> Add step
          </Button>
        </div>
        {steps.length === 0 && <p className="text-[11px] text-muted-foreground">No steps yet.</p>}
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="grid grid-cols-[28px_1fr_auto] gap-2 items-center">
              <span className="text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              <Input value={s} onChange={(e) => updateStep(i, e.target.value)} placeholder={`Step ${i + 1}`} />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(i)} aria-label="Remove step">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
