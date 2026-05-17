// Invoice & GST math helpers shared by all document generators
// (tax invoice, packing slip, e-way bill, GSTR returns).
//
// Conventions:
//  - All money values are in whole rupees (matches ordersTable).
//  - Tax math uses paise internally (×100) to avoid float drift, then
//    rounds to the nearest rupee at the end.
//  - GST rate is a percent integer (5 → 5%). Half-rates (CGST/SGST)
//    are computed as rate/2 to the paise.

export interface BusinessSettingsLite {
  legalName: string | null;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  fssai: string | null;
  cin: string | null;
  iec: string | null;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
    country?: string;
  };
  defaultHsnCode: string;
  defaultGstRatePct: number;
  pricesIncludeTax: boolean;
  invoicePrefix: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  upiId: string | null;
  signatureImageUrl: string | null;
  invoiceFooterNote: string | null;
  dispatchAddress: BusinessSettingsLite["address"];
}

export interface OrderItemLite {
  productId: string;
  productName: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
  hsnCode: string | null;
  gstRatePct: number | null;
}

export interface ComputedLine {
  productId: string;
  name: string;
  variant: string;
  hsn: string;
  qty: number;
  // Per-unit values for display
  unitPriceGross: number; // what customer sees (₹)
  unitPriceNet: number;   // ex-GST per unit (₹)
  gstRatePct: number;
  // Line totals (₹, rounded)
  lineGross: number;
  lineNet: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxable: number; // alias for lineNet — the GSTR-1 column
}

export interface ComputedTotals {
  subtotal: number;     // sum of net (taxable)
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  shipping: number;
  discount: number;
  grandTotal: number;   // what the customer paid
  isInterState: boolean;
  amountInWords: string;
}

// ── Indian financial year helpers ────────────────────────────────────
// FY runs 1 Apr → 31 Mar. fyKey "26-27" → 2026-04-01 to 2027-03-31.
export function fyKeyForDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  const start = m >= 3 ? y : y - 1;
  const end = start + 1;
  return `${String(start).slice(-2)}-${String(end).slice(-2)}`;
}

export function fyRangeForKey(fyKey: string): { start: Date; end: Date } {
  const [a, b] = fyKey.split("-").map((s) => 2000 + Number(s));
  return {
    start: new Date(Date.UTC(a, 3, 1, 0, 0, 0)),
    end: new Date(Date.UTC(b, 3, 1, 0, 0, 0)),
  };
}

// ── State code derivation ────────────────────────────────────────────
// Place-of-supply rules. We compare seller stateCode (2-digit) against
// the buyer's state. If they match → intra-state (CGST+SGST), else IGST.
// We accept either the 2-digit GSTIN prefix or a state name and map it.
const STATE_NAME_TO_CODE: Record<string, string> = {
  "JAMMU AND KASHMIR": "01",
  "HIMACHAL PRADESH": "02",
  "PUNJAB": "03",
  "CHANDIGARH": "04",
  "UTTARAKHAND": "05",
  "HARYANA": "06",
  "DELHI": "07",
  "RAJASTHAN": "08",
  "UTTAR PRADESH": "09",
  "BIHAR": "10",
  "SIKKIM": "11",
  "ARUNACHAL PRADESH": "12",
  "NAGALAND": "13",
  "MANIPUR": "14",
  "MIZORAM": "15",
  "TRIPURA": "16",
  "MEGHALAYA": "17",
  "ASSAM": "18",
  "WEST BENGAL": "19",
  "JHARKHAND": "20",
  "ODISHA": "21",
  "CHHATTISGARH": "22",
  "MADHYA PRADESH": "23",
  "GUJARAT": "24",
  "DAMAN AND DIU": "25",
  "DADRA AND NAGAR HAVELI": "26",
  "MAHARASHTRA": "27",
  "ANDHRA PRADESH": "28", // pre-2017 code — Telangana split off
  "KARNATAKA": "29",
  "GOA": "30",
  "LAKSHADWEEP": "31",
  "KERALA": "32",
  "TAMIL NADU": "33",
  "PUDUCHERRY": "34",
  "ANDAMAN AND NICOBAR ISLANDS": "35",
  "TELANGANA": "36",
  "ANDHRA PRADESH (NEW)": "37",
  "LADAKH": "38",
};

export function resolveStateCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (/^\d{2}$/.test(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase();
  return STATE_NAME_TO_CODE[upper] ?? null;
}

export function isInterStateSupply(
  sellerStateCode: string | null | undefined,
  buyerStateInput: string | null | undefined,
): boolean {
  const seller = resolveStateCode(sellerStateCode ?? null);
  const buyer = resolveStateCode(buyerStateInput ?? null);
  if (!seller || !buyer) return false; // safe default — show CGST+SGST
  return seller !== buyer;
}

// ── Money math ───────────────────────────────────────────────────────

function paiseFromRupees(r: number): number {
  return Math.round(r * 100);
}
function rupeesFromPaise(p: number): number {
  return Math.round(p) / 100;
}

/**
 * Compute one invoice line's tax breakdown.
 *
 * If `pricesIncludeTax`, we treat unitPrice as gross and back out the
 * net taxable value:  net = gross / (1 + r).  Otherwise unitPrice is
 * net and tax is added on top.
 */
export function computeLine(
  item: OrderItemLite,
  defaults: { hsn: string; ratePct: number },
  pricesIncludeTax: boolean,
  isInterState: boolean,
): ComputedLine {
  const ratePct = item.gstRatePct ?? defaults.ratePct;
  const hsn = item.hsnCode ?? defaults.hsn;
  const r = ratePct / 100;

  const lineGrossPaise = paiseFromRupees(item.unitPrice * item.quantity);
  let lineNetPaise: number;
  let lineTaxPaise: number;
  if (pricesIncludeTax) {
    lineNetPaise = Math.round(lineGrossPaise / (1 + r));
    lineTaxPaise = lineGrossPaise - lineNetPaise;
  } else {
    lineNetPaise = lineGrossPaise;
    lineTaxPaise = Math.round(lineGrossPaise * r);
  }

  const halfTax = Math.round(lineTaxPaise / 2);
  const cgst = isInterState ? 0 : rupeesFromPaise(halfTax);
  const sgst = isInterState ? 0 : rupeesFromPaise(lineTaxPaise - halfTax);
  const igst = isInterState ? rupeesFromPaise(lineTaxPaise) : 0;

  return {
    productId: item.productId,
    name: item.productName,
    variant: item.variantSize,
    hsn,
    qty: item.quantity,
    unitPriceGross: rupeesFromPaise(paiseFromRupees(item.unitPrice)),
    unitPriceNet: rupeesFromPaise(Math.round(lineNetPaise / item.quantity)),
    gstRatePct: ratePct,
    lineGross: pricesIncludeTax
      ? rupeesFromPaise(lineGrossPaise)
      : rupeesFromPaise(lineNetPaise + lineTaxPaise),
    lineNet: rupeesFromPaise(lineNetPaise),
    cgst,
    sgst,
    igst,
    taxable: rupeesFromPaise(lineNetPaise),
  };
}

export function computeTotals(args: {
  lines: ComputedLine[];
  isInterState: boolean;
  /** Order-level grand total customer actually paid (₹). */
  paidTotal: number;
  /** Order-level subtotal (gross before discount/shipping). */
  orderSubtotal: number;
  loyaltyDiscount: number;
}): ComputedTotals {
  const subtotal = sumRound(args.lines.map((l) => l.lineNet));
  const cgst = sumRound(args.lines.map((l) => l.cgst));
  const sgst = sumRound(args.lines.map((l) => l.sgst));
  const igst = sumRound(args.lines.map((l) => l.igst));
  const totalTax = cgst + sgst + igst;
  const grossLines = sumRound(args.lines.map((l) => l.lineGross));
  // Shipping / packaging falls out as the gap between paid grand total
  // and the gross of all lines (after subtracting loyalty discount).
  const shipping = Math.max(
    0,
    args.paidTotal - (grossLines - args.loyaltyDiscount),
  );
  return {
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax,
    shipping,
    discount: args.loyaltyDiscount,
    grandTotal: args.paidTotal,
    isInterState: args.isInterState,
    amountInWords: amountInWordsINR(args.paidTotal),
  };
}

function sumRound(xs: number[]): number {
  const total = xs.reduce((acc, x) => acc + paiseFromRupees(x), 0);
  return rupeesFromPaise(total);
}

// ── Amount in words (Indian numbering) ───────────────────────────────
// "₹ 1,23,456.78" → "Indian Rupees One Lakh Twenty Three Thousand Four
// Hundred Fifty Six and Seventy Eight Paise Only"

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return TENS[t] + (u ? " " + ONES[u] : "");
}
function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(twoDigit(r));
  return parts.join(" ");
}

export function amountInWordsINR(rupees: number): string {
  const sign = rupees < 0 ? "Minus " : "";
  let n = Math.abs(Math.round(rupees * 100));
  const paise = n % 100;
  n = Math.floor(n / 100);
  if (n === 0 && paise === 0) return "Indian Rupees Zero Only";
  const parts: string[] = [];
  // Crore (10^7)
  const crore = Math.floor(n / 10_000_000);
  if (crore) {
    parts.push(`${twoDigit(crore)} Crore`);
    n %= 10_000_000;
  }
  // Lakh (10^5)
  const lakh = Math.floor(n / 100_000);
  if (lakh) {
    parts.push(`${twoDigit(lakh)} Lakh`);
    n %= 100_000;
  }
  // Thousand
  const thou = Math.floor(n / 1_000);
  if (thou) {
    parts.push(`${twoDigit(thou)} Thousand`);
    n %= 1_000;
  }
  if (n) parts.push(threeDigit(n));
  let s = `Indian Rupees ${sign}${parts.join(" ").trim() || "Zero"}`;
  if (paise) s += ` and ${twoDigit(paise)} Paise`;
  return `${s} Only`;
}

// ── HSN summary (for GSTR-1 + invoice footer) ────────────────────────
export interface HsnSummaryRow {
  hsn: string;
  description: string;
  uqc: string; // unit-quantity code: PCS, KGS, GMS — we use PCS by default
  totalQty: number;
  totalValue: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export function hsnSummary(lines: ComputedLine[]): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();
  for (const l of lines) {
    const key = l.hsn;
    const cur = map.get(key) ?? {
      hsn: l.hsn,
      description: "Tea",
      uqc: "PCS",
      totalQty: 0,
      totalValue: 0,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    cur.totalQty += l.qty;
    cur.totalValue += l.lineGross;
    cur.taxable += l.taxable;
    cur.cgst += l.cgst;
    cur.sgst += l.sgst;
    cur.igst += l.igst;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
}

// ── HTML escaping ────────────────────────────────────────────────────
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function inrFmt(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
