import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChipsInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
}

export function ChipsInput({ label, value, onChange, placeholder, hint }: ChipsInputProps) {
  const [draft, setDraft] = useState("");
  const list = value ?? [];

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...list, trimmed]);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && list.length > 0) {
      onChange(list.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-2 min-h-[44px]">
        {list.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          className="border-0 shadow-none focus-visible:ring-0 h-7 flex-1 min-w-[120px] p-0"
          value={draft}
          placeholder={list.length === 0 ? (placeholder ?? "Type and press Enter") : ""}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
