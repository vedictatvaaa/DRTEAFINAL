import { Trash2, Plus } from "lucide-react";
import type { Variant } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VariantsEditorProps {
  value: Variant[];
  onChange: (next: Variant[]) => void;
  errors?: string[];
}

export function VariantsEditor({ value, onChange, errors }: VariantsEditorProps) {
  const list = value ?? [];

  const update = (i: number, patch: Partial<Variant>) => {
    onChange(list.map((v, j) => (i === j ? { ...v, ...patch } : v)));
  };
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));
  const add = () => onChange([...list, { size: "", price: 0, stock: 0 }]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Variants</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Add variant
        </Button>
      </div>
      {list.length === 0 && (
        <p className="text-xs text-muted-foreground">No variants yet — add at least one (size, price, stock).</p>
      )}
      <div className="space-y-2">
        {list.map((v, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Size</Label>
              <Input
                value={v.size}
                placeholder="250g"
                onChange={(e) => update(i, { size: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Price (INR)</Label>
              <Input
                type="number"
                min={0}
                value={v.price}
                onChange={(e) => update(i, { price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Stock</Label>
              <Input
                type="number"
                min={0}
                value={v.stock}
                onChange={(e) => update(i, { stock: Number(e.target.value) })}
              />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove variant">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      {errors && errors.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5">
          {errors.map((err, i) => (
            <li key={i}>• {err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
