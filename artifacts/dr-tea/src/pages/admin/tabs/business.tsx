import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Building2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileText,
  ShieldCheck,
  Banknote,
  MapPin,
  Loader2,
} from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

interface Address {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

interface BusinessSettings {
  legalName: string | null;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  fssai: string | null;
  cin: string | null;
  iec: string | null;
  address: Address;
  dispatchAddress: Address;
  defaultHsnCode: string;
  defaultGstRatePct: number;
  pricesIncludeTax: boolean;
  invoicePrefix: string;
  invoiceFyKey: string | null;
  invoiceCounter: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  upiId: string | null;
  signatureImageUrl: string | null;
  invoiceFooterNote: string | null;
}

const INDIAN_STATES: Array<{ name: string; code: string }> = [
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Ladakh", code: "38" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Puducherry", code: "34" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
  { name: "Chandigarh", code: "04" },
  { name: "Dadra and Nagar Haveli", code: "26" },
  { name: "Daman and Diu", code: "25" },
  { name: "Andaman and Nicobar Islands", code: "35" },
  { name: "Lakshadweep", code: "31" },
];

const HSN_PRESETS = [
  { code: "0902", label: "0902 — Tea (general, 5%)" },
  { code: "09022030", label: "09022030 — Green tea, leaf (5%)" },
  { code: "09023010", label: "09023010 — Black tea, leaf (5%)" },
  { code: "09024030", label: "09024030 — Black tea, dust (5%)" },
  { code: "21069099", label: "21069099 — Tea premix / blend (18%)" },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

function isGstinValid(gstin: string | null): boolean {
  if (!gstin) return false;
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/u.test(gstin.toUpperCase());
}

export default function BusinessTab() {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => api<{ settings: BusinessSettings }>("/admin/business-settings"),
  });

  const [form, setForm] = useState<BusinessSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsQ.data?.settings && !form) {
      setForm(settingsQ.data.settings);
    }
  }, [settingsQ.data, form]);

  const save = useMutation({
    mutationFn: async (patch: Partial<BusinessSettings>) =>
      api<{ settings: BusinessSettings }>("/admin/business-settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => {
      setForm(data.settings);
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    },
  });

  const completeness = useMemo(() => {
    if (!form) return 0;
    const fields: Array<unknown> = [
      form.legalName,
      form.gstin,
      form.pan,
      form.address?.line1,
      form.address?.city,
      form.address?.state,
      form.address?.postalCode,
      form.bankAccountNumber,
      form.bankIfsc,
    ];
    const filled = fields.filter((v) => !!v && String(v).trim().length).length;
    return Math.round((filled / fields.length) * 100);
  }, [form]);

  if (settingsQ.isLoading || !form) {
    return (
      <div className="p-8 text-stone-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading business settings…
      </div>
    );
  }

  const updateField = <K extends keyof BusinessSettings>(
    k: K,
    v: BusinessSettings[K],
  ) => setForm({ ...form, [k]: v });

  const updateAddress = (
    key: "address" | "dispatchAddress",
    patch: Partial<Address>,
  ) => setForm({ ...form, [key]: { ...(form[key] ?? {}), ...patch } });

  const handleSave = () => {
    if (!form) return;
    const patch: Partial<BusinessSettings> = {
      legalName: form.legalName?.trim() || null,
      tradeName: form.tradeName?.trim() || null,
      gstin: form.gstin?.trim().toUpperCase() || null,
      pan: form.pan?.trim().toUpperCase() || null,
      fssai: form.fssai?.trim() || null,
      cin: form.cin?.trim() || null,
      iec: form.iec?.trim() || null,
      address: cleanAddress(form.address),
      dispatchAddress: cleanAddress(form.dispatchAddress),
      defaultHsnCode: form.defaultHsnCode,
      defaultGstRatePct: form.defaultGstRatePct,
      pricesIncludeTax: form.pricesIncludeTax,
      invoicePrefix: form.invoicePrefix,
      bankName: form.bankName?.trim() || null,
      bankAccountNumber: form.bankAccountNumber?.trim() || null,
      bankIfsc: form.bankIfsc?.trim().toUpperCase() || null,
      bankBranch: form.bankBranch?.trim() || null,
      upiId: form.upiId?.trim() || null,
      signatureImageUrl: form.signatureImageUrl?.trim() || null,
      invoiceFooterNote: form.invoiceFooterNote?.trim() || null,
    };
    save.mutate(patch);
  };

  const gstinOk = !form.gstin || isGstinValid(form.gstin);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a2416] flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Business Registration &amp; GST
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Fills every invoice, packing slip, e-way bill, and GSTR return.
            All fields are optional — invoices fall back to "Proforma" until
            you set GSTIN.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-stone-500">Profile complete</div>
          <div className="text-2xl font-semibold text-[#3a5a2c]">
            {completeness}%
          </div>
          <div className="w-32 h-1.5 bg-stone-200 rounded mt-1 overflow-hidden">
            <div
              className="h-full bg-[#3a5a2c] transition-all"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky top-0 z-10 bg-[#FAF8F4]/95 backdrop-blur py-3 -mx-2 px-2 border-b border-stone-200 flex items-center justify-between">
        <div className="text-sm text-stone-600">
          {save.isPending && (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          {save.isError && (
            <span className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" />{" "}
              {(save.error as Error).message}
            </span>
          )}
        </div>
        <Button onClick={handleSave} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save changes
        </Button>
      </div>

      {/* Identity */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-[#1a2416] flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Legal identity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Legal business name (as on GST cert)">
            <Input
              value={form.legalName ?? ""}
              onChange={(e) => updateField("legalName", e.target.value)}
              placeholder="Vedic Tatva Pvt Ltd"
            />
          </Field>
          <Field label="Trade name (shown on invoice header)">
            <Input
              value={form.tradeName ?? ""}
              onChange={(e) => updateField("tradeName", e.target.value)}
              placeholder="Dr Tea"
            />
          </Field>
          <Field
            label="GSTIN (15 chars)"
            hint={
              form.gstin && !gstinOk
                ? "⚠ Format invalid — should be like 29ABCDE1234F1Z5"
                : undefined
            }
          >
            <Input
              value={form.gstin ?? ""}
              onChange={(e) =>
                updateField("gstin", e.target.value.toUpperCase())
              }
              placeholder="29ABCDE1234F1Z5"
              className={
                form.gstin && !gstinOk ? "border-rose-400" : undefined
              }
            />
          </Field>
          <Field label="PAN">
            <Input
              value={form.pan ?? ""}
              onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
            />
          </Field>
          <Field label="FSSAI license (14 digits)">
            <Input
              value={form.fssai ?? ""}
              onChange={(e) => updateField("fssai", e.target.value)}
              placeholder="12345678901234"
            />
          </Field>
          <Field label="CIN (companies)">
            <Input
              value={form.cin ?? ""}
              onChange={(e) => updateField("cin", e.target.value)}
              placeholder="U15490DL2024PTC123456"
            />
          </Field>
          <Field label="IEC (Importer-Exporter Code, optional)">
            <Input
              value={form.iec ?? ""}
              onChange={(e) => updateField("iec", e.target.value)}
              placeholder="0123456789"
            />
          </Field>
        </div>
      </Card>

      {/* Registered address */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-[#1a2416] flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Registered address
        </h2>
        <AddressBlock
          value={form.address}
          onChange={(p) => updateAddress("address", p)}
        />
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#1a2416] flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Dispatch / Pickup address
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateField("dispatchAddress", { ...form.address })
            }
          >
            Same as registered
          </Button>
        </div>
        <p className="text-xs text-stone-500">
          Used as "From" address on packing slips, e-way bills, and the
          Shiprocket pickup location.
        </p>
        <AddressBlock
          value={form.dispatchAddress}
          onChange={(p) => updateAddress("dispatchAddress", p)}
        />
      </Card>

      {/* Tax defaults */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-[#1a2416] flex items-center gap-2">
          <FileText className="h-4 w-4" /> Tax &amp; invoice defaults
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Default HSN code">
            <Select
              value={
                HSN_PRESETS.some((h) => h.code === form.defaultHsnCode)
                  ? form.defaultHsnCode
                  : "custom"
              }
              onValueChange={(v) => {
                if (v !== "custom") updateField("defaultHsnCode", v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HSN_PRESETS.map((h) => (
                  <SelectItem key={h.code} value={h.code}>
                    {h.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              value={form.defaultHsnCode}
              onChange={(e) => updateField("defaultHsnCode", e.target.value)}
              placeholder="0902"
            />
          </Field>
          <Field label="Default GST rate">
            <Select
              value={String(form.defaultGstRatePct)}
              onValueChange={(v) =>
                updateField("defaultGstRatePct", Number(v))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 5, 12, 18, 28].map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Listed prices include tax?">
            <Select
              value={form.pricesIncludeTax ? "yes" : "no"}
              onValueChange={(v) =>
                updateField("pricesIncludeTax", v === "yes")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">
                  Yes (Indian retail standard)
                </SelectItem>
                <SelectItem value="no">No — add tax on top</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Invoice number prefix">
            <Input
              value={form.invoicePrefix}
              onChange={(e) =>
                updateField("invoicePrefix", e.target.value.toUpperCase())
              }
              placeholder="INV"
            />
          </Field>
          <Field label="Current FY counter (locked once issued)">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{form.invoiceFyKey ?? "—"}</Badge>
              <span className="text-stone-700 font-mono">
                #{form.invoiceCounter.toString().padStart(5, "0")}
              </span>
            </div>
          </Field>
        </div>
        <Field label="Invoice footer note (returns policy, support email, etc)">
          <Textarea
            value={form.invoiceFooterNote ?? ""}
            onChange={(e) => updateField("invoiceFooterNote", e.target.value)}
            placeholder="Returns accepted within 7 days · support@vedictatva.com · +91-..."
            rows={2}
          />
        </Field>
      </Card>

      {/* Bank */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-[#1a2416] flex items-center gap-2">
          <Banknote className="h-4 w-4" /> Bank &amp; UPI (invoice footer)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bank name">
            <Input
              value={form.bankName ?? ""}
              onChange={(e) => updateField("bankName", e.target.value)}
              placeholder="HDFC Bank"
            />
          </Field>
          <Field label="Branch">
            <Input
              value={form.bankBranch ?? ""}
              onChange={(e) => updateField("bankBranch", e.target.value)}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.bankAccountNumber ?? ""}
              onChange={(e) =>
                updateField("bankAccountNumber", e.target.value)
              }
            />
          </Field>
          <Field label="IFSC code">
            <Input
              value={form.bankIfsc ?? ""}
              onChange={(e) =>
                updateField("bankIfsc", e.target.value.toUpperCase())
              }
              placeholder="HDFC0001234"
            />
          </Field>
          <Field label="UPI ID">
            <Input
              value={form.upiId ?? ""}
              onChange={(e) => updateField("upiId", e.target.value)}
              placeholder="vedictatva@hdfcbank"
            />
          </Field>
          <Field label="Authorised signature image URL">
            <Input
              value={form.signatureImageUrl ?? ""}
              onChange={(e) =>
                updateField("signatureImageUrl", e.target.value)
              }
              placeholder="https://…/signature.png"
            />
          </Field>
        </div>
      </Card>

      {/* GST returns */}
      <Card className="p-5 space-y-3">
        <h2 className="font-semibold text-[#1a2416] flex items-center gap-2">
          <Download className="h-4 w-4" /> GST returns export
        </h2>
        <p className="text-sm text-stone-600">
          Download a GSTR-1 CSV for any month or financial year. Includes
          B2C-Small (intra-state), B2C-Large (inter-state &gt; ₹2.5L), and
          HSN summary rows in the GST offline-tool format.
        </p>
        <Gstr1Downloader />
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-700 mb-1.5 block">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-xs text-rose-600 mt-1 block">{hint}</span>
      )}
    </label>
  );
}

function AddressBlock({
  value,
  onChange,
}: {
  value: Address;
  onChange: (p: Partial<Address>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Address line 1">
        <Input
          value={value.line1 ?? ""}
          onChange={(e) => onChange({ line1: e.target.value })}
        />
      </Field>
      <Field label="Address line 2">
        <Input
          value={value.line2 ?? ""}
          onChange={(e) => onChange({ line2: e.target.value })}
        />
      </Field>
      <Field label="City">
        <Input
          value={value.city ?? ""}
          onChange={(e) => onChange({ city: e.target.value })}
        />
      </Field>
      <Field label="State">
        <Select
          value={value.state ?? ""}
          onValueChange={(v) => {
            const s = INDIAN_STATES.find((st) => st.name === v);
            onChange({ state: v, stateCode: s?.code ?? value.stateCode });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select state…" />
          </SelectTrigger>
          <SelectContent>
            {INDIAN_STATES.map((s) => (
              <SelectItem key={s.code} value={s.name}>
                {s.name} ({s.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="PIN code (6 digits)">
        <Input
          value={value.postalCode ?? ""}
          onChange={(e) => onChange({ postalCode: e.target.value })}
          maxLength={6}
        />
      </Field>
      <Field label="Country">
        <Input
          value={value.country ?? "India"}
          onChange={(e) => onChange({ country: e.target.value })}
        />
      </Field>
    </div>
  );
}

function cleanAddress(a: Address | null | undefined): Address {
  if (!a) return {};
  const out: Address = {};
  for (const [k, v] of Object.entries(a)) {
    const s = typeof v === "string" ? v.trim() : v;
    if (s) (out as Record<string, unknown>)[k] = s;
  }
  return out;
}

function Gstr1Downloader() {
  const [mode, setMode] = useState<"month" | "fy">("month");
  const now = new Date();
  const defMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defFy = `${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`;
  const [month, setMonth] = useState(defMonth);
  const [fyKey, setFyKey] = useState(defFy);

  const url = useMemo(() => {
    const q =
      mode === "month"
        ? `month=${encodeURIComponent(month)}`
        : `fyKey=${encodeURIComponent(fyKey)}`;
    return `${API}/admin/gst/returns/gstr1.csv?${q}`;
  }, [mode, month, fyKey]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Period">
        <Select value={mode} onValueChange={(v) => setMode(v as "month" | "fy")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Single month</SelectItem>
            <SelectItem value="fy">Full financial year</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {mode === "month" ? (
        <Field label="Month (YYYY-MM)">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </Field>
      ) : (
        <Field label="FY (YY-YY, e.g. 26-27)">
          <Input
            value={fyKey}
            onChange={(e) => setFyKey(e.target.value)}
            className="w-32"
            pattern="\d{2}-\d{2}"
          />
        </Field>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" /> Download GSTR-1 CSV
        </Button>
      </a>
    </div>
  );
}
