import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadImage } from "@/lib/upload-image";

export function ImageField({
  label,
  value,
  onChange,
  onUploaded,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Called only when a file finishes uploading (not on every URL keystroke). */
  onUploaded?: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const url = await uploadImage(file);
      onChange(url);
      onUploaded?.(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Image URL or upload below"
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => ref.current?.click()}
        >
          {busy ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {value && (
        <img
          src={value}
          alt=""
          className="mt-1 h-20 w-20 object-cover rounded border"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {err && <div className="text-xs text-destructive">{err}</div>}
    </div>
  );
}
