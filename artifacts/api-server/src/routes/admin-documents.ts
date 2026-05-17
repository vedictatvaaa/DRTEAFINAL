// Admin document generators: tax invoice, packing slip, e-way bill,
// and GSTR-1 CSV exports. All HTML endpoints render print-optimised
// pages that the operator (or customer, via signed link) can save as
// PDF directly from the browser — zero server-side PDF dependency.
//
// Routes (all under requireAdmin):
//   GET  /admin/orders/:id/invoice           → tax invoice (customer-facing)
//   GET  /admin/orders/:id/invoice?variant=admin    → with cost notes
//   GET  /admin/orders/:id/packing-slip      → warehouse packing slip
//   GET  /admin/orders/:id/eway-bill         → EWB-01 worksheet
//   POST /admin/orders/:id/issue-invoice     → lock the invoice number
//   GET  /admin/gst/returns/gstr1.csv?fyKey=YY-YY&month=YYYY-MM
//                                           → GSTR-1 export

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  shipmentsTable,
  businessSettingsTable,
  type BusinessSettingsRow,
  type OrderRow,
  type OrderItemRow,
} from "../lib/db";
import { requireAdmin } from "../middlewares/admin-auth";
import { recordActivity } from "../lib/activity-log";
import { logger } from "../lib/logger";
import {
  computeLine,
  computeTotals,
  hsnSummary,
  isInterStateSupply,
  resolveStateCode,
  fyKeyForDate,
  fyRangeForKey,
  escapeHtml as esc,
  inrFmt,
  type ComputedLine,
  type ComputedTotals,
} from "../lib/invoice-utils";

const router: IRouter = Router();
router.use("/admin/orders/:id/invoice", requireAdmin);
router.use("/admin/orders/:id/packing-slip", requireAdmin);
router.use("/admin/orders/:id/eway-bill", requireAdmin);
router.use("/admin/orders/:id/issue-invoice", requireAdmin);
router.use("/admin/gst", requireAdmin);

// ── Loaders ──────────────────────────────────────────────────────────

export async function loadBusiness(): Promise<BusinessSettingsRow> {
  const [row] = await db
    .select()
    .from(businessSettingsTable)
    .where(eq(businessSettingsTable.id, 1))
    .limit(1);
  if (row) return row;
  const [created] = await db
    .insert(businessSettingsTable)
    .values({ id: 1 })
    .returning();
  return created;
}

interface OrderBundle {
  order: OrderRow;
  items: OrderItemRow[];
  shipment: {
    courierCode: string | null;
    awb: string | null;
    weightGrams: number | null;
    trackingUrl: string | null;
  } | null;
}

export async function loadOrderBundle(id: number): Promise<OrderBundle | null> {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id));
  const [ship] = await db
    .select({
      courierCode: shipmentsTable.courierCode,
      awb: shipmentsTable.awb,
      weightGrams: shipmentsTable.weightGrams,
      trackingUrl: shipmentsTable.trackingUrl,
    })
    .from(shipmentsTable)
    .where(eq(shipmentsTable.orderId, id))
    .limit(1);
  return { order, items, shipment: ship ?? null };
}

// ── Tax invoice ──────────────────────────────────────────────────────

const QueryVariant = z.object({
  variant: z.enum(["customer", "admin"]).default("customer"),
});

router.get("/admin/orders/:id/invoice", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).send("Invalid order id");
    return;
  }
  const { variant } = QueryVariant.parse(req.query);
  try {
    const bundle = await loadOrderBundle(id);
    if (!bundle) {
      res.status(404).send("Order not found");
      return;
    }
    const business = await loadBusiness();
    const html = renderInvoice(bundle, business, variant);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    logger.error({ err, id }, "documents.invoice_failed");
    res.status(500).send("Failed to render invoice");
  }
});

router.get(
  "/admin/orders/:id/packing-slip",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).send("Invalid order id");
      return;
    }
    try {
      const bundle = await loadOrderBundle(id);
      if (!bundle) {
        res.status(404).send("Order not found");
        return;
      }
      const business = await loadBusiness();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderPackingSlip(bundle, business));
    } catch (err) {
      logger.error({ err, id }, "documents.packing_slip_failed");
      res.status(500).send("Failed to render packing slip");
    }
  },
);

router.get(
  "/admin/orders/:id/eway-bill",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).send("Invalid order id");
      return;
    }
    try {
      const bundle = await loadOrderBundle(id);
      if (!bundle) {
        res.status(404).send("Order not found");
        return;
      }
      const business = await loadBusiness();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderEwayBill(bundle, business));
    } catch (err) {
      logger.error({ err, id }, "documents.eway_bill_failed");
      res.status(500).send("Failed to render e-way bill");
    }
  },
);

// Lock the invoice number — turns a draft order into a legally-issued
// tax invoice. Idempotent: returns the existing number if already issued.
router.post(
  "/admin/orders/:id/issue-invoice",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }
    try {
      const result = await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.id, id))
          .limit(1)
          .for("update");
        if (!order) return { status: 404 as const };
        if (order.invoiceNumber) {
          return {
            status: 200 as const,
            invoiceNumber: order.invoiceNumber,
            invoiceIssuedAt: order.invoiceIssuedAt,
            alreadyIssued: true,
          };
        }
        const [biz] = await tx
          .select()
          .from(businessSettingsTable)
          .where(eq(businessSettingsTable.id, 1))
          .limit(1)
          .for("update");
        const business =
          biz ??
          (await tx
            .insert(businessSettingsTable)
            .values({ id: 1 })
            .returning())[0];
        const now = new Date();
        const fyKey = fyKeyForDate(now);
        const counter = business.invoiceFyKey === fyKey
          ? business.invoiceCounter + 1
          : 1;
        const number = `${business.invoicePrefix}/${fyKey}/${String(counter).padStart(5, "0")}`;
        await tx
          .update(businessSettingsTable)
          .set({
            invoiceFyKey: fyKey,
            invoiceCounter: counter,
            updatedAt: sql`now()`,
          })
          .where(eq(businessSettingsTable.id, 1));
        await tx
          .update(ordersTable)
          .set({
            invoiceNumber: number,
            invoiceIssuedAt: now,
            updatedAt: sql`now()`,
          })
          .where(eq(ordersTable.id, id));
        return {
          status: 200 as const,
          invoiceNumber: number,
          invoiceIssuedAt: now,
          alreadyIssued: false,
        };
      });
      if (result.status === 404) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      if (!result.alreadyIssued) {
        await recordActivity({
          kind: "invoice_issued",
          actor: "admin",
          title: `Invoice ${result.invoiceNumber} issued`,
          summary: `For order #${id}`,
          entityType: "order",
          entityId: String(id),
        });
      }
      res.json({
        invoiceNumber: result.invoiceNumber,
        invoiceIssuedAt: result.invoiceIssuedAt,
        alreadyIssued: result.alreadyIssued,
      });
    } catch (err) {
      logger.error({ err, id }, "documents.issue_invoice_failed");
      res.status(500).json({ error: "Failed to issue invoice" });
    }
  },
);

// ── GSTR-1 export ────────────────────────────────────────────────────
// Generates a CSV that matches the GST offline tool's tabular format.
// Three sections: B2B (when buyer GSTIN is captured — currently unused
// for retail), B2CL (inter-state, invoice value > ₹2.5 L), and B2CS
// (everything else — summary by state × tax rate). HSN summary appended.

const Gstr1Query = z.object({
  fyKey: z.string().regex(/^\d{2}-\d{2}$/u).optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/u, "month must be YYYY-MM")
    .optional(),
});

router.get("/admin/gst/returns/gstr1.csv", async (req, res: Response) => {
  const parsed = Gstr1Query.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).send("Invalid query");
    return;
  }
  try {
    const { start, end, label } = resolveDateRange(
      parsed.data.fyKey,
      parsed.data.month,
    );
    const business = await loadBusiness();
    const orders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.invoiceIssuedAt, start),
          lt(ordersTable.invoiceIssuedAt, end),
        ),
      );
    if (!orders.length) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="gstr1-${label}.csv"`,
      );
      res.send("No issued invoices in this period.\n");
      return;
    }
    const orderIds = orders.map((o) => o.id);
    const items = await db
      .select()
      .from(orderItemsTable)
      .where(
        sql`${orderItemsTable.orderId} IN (${sql.join(
          orderIds.map((i) => sql`${i}`),
          sql`, `,
        )})`,
      );
    const csv = renderGstr1Csv({ orders, items, business, label });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="gstr1-${label}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    logger.error({ err }, "documents.gstr1_failed");
    res.status(500).send("Failed to generate GSTR-1");
  }
});

function resolveDateRange(
  fyKey: string | undefined,
  month: string | undefined,
): { start: Date; end: Date; label: string } {
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    return { start, end, label: month };
  }
  const fy = fyKey ?? fyKeyForDate(new Date());
  const { start, end } = fyRangeForKey(fy);
  return { start, end, label: `FY${fy}` };
}

// ── Renderers ────────────────────────────────────────────────────────

function buildLines(
  bundle: OrderBundle,
  business: BusinessSettingsRow,
  isInterState: boolean,
): { lines: ComputedLine[]; totals: ComputedTotals } {
  const defaults = {
    hsn: business.defaultHsnCode,
    ratePct: business.defaultGstRatePct,
  };
  const lines = bundle.items.map((it) =>
    computeLine(
      {
        productId: it.productId,
        productName: it.productName,
        variantSize: it.variantSize,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        hsnCode: it.hsnCode,
        gstRatePct: it.gstRatePct,
      },
      defaults,
      business.pricesIncludeTax,
      isInterState,
    ),
  );
  const totals = computeTotals({
    lines,
    isInterState,
    paidTotal: bundle.order.total,
    orderSubtotal: bundle.order.subtotal,
    loyaltyDiscount: bundle.order.loyaltyDiscount,
  });
  return { lines, totals };
}

function fmtAddress(
  a: BusinessSettingsRow["address"] | null | undefined,
): string {
  if (!a) return "";
  return [a.line1, a.line2, [a.city, a.state, a.postalCode]
    .filter(Boolean)
    .join(", "), a.country]
    .filter(Boolean)
    .map((x) => esc(x))
    .join("<br>");
}

function fmtShipAddress(o: OrderRow): string {
  const a = o.shippingAddress;
  return [
    a.line1,
    a.line2,
    [a.city, a.region, a.postalCode].filter(Boolean).join(", "),
    a.country,
  ]
    .filter(Boolean)
    .map((x) => esc(x))
    .join("<br>");
}

const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; font-size: 12px; line-height: 1.45; background: #fff; }
.doc { max-width: 820px; margin: 0 auto; }
.row { display: flex; justify-content: space-between; gap: 24px; }
.row > div { flex: 1; }
h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.02em; }
h2 { font-size: 14px; margin: 0 0 6px; color: #3a5a2c; text-transform: uppercase; letter-spacing: 0.08em; }
h3 { font-size: 11px; margin: 0 0 4px; color: #6b6b6b; text-transform: uppercase; letter-spacing: 0.06em; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eaeaea; vertical-align: top; }
th { background: #f7f5ef; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #3a5a2c; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.box { border: 1px solid #e5e3dc; border-radius: 8px; padding: 14px; }
.muted { color: #6b6b6b; }
.brand { font-weight: 700; color: #1a2416; font-size: 22px; letter-spacing: 0.04em; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #1a2416; color: #faf8f4; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
.totals td { padding: 6px 10px; border: none; }
.totals .grand { font-weight: 700; font-size: 14px; border-top: 2px solid #1a2416; padding-top: 8px; }
.signature { margin-top: 36px; text-align: right; }
.signature img { max-height: 64px; }
.footer { margin-top: 24px; font-size: 10px; color: #6b6b6b; border-top: 1px dashed #ddd; padding-top: 10px; }
.print-bar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
.print-bar button { padding: 8px 14px; border: 1px solid #1a2416; background: #1a2416; color: #faf8f4; cursor: pointer; border-radius: 6px; font-size: 12px; }
.print-bar a { padding: 8px 14px; border: 1px solid #1a2416; background: #fff; color: #1a2416; text-decoration: none; border-radius: 6px; font-size: 12px; }
@media print { .print-bar { display: none; } body { padding: 0; } }
.warn { background: #fff7e6; border: 1px solid #ffd591; padding: 8px 12px; border-radius: 6px; color: #7a4f00; margin: 8px 0; font-size: 11px; }
`;

export function renderInvoice(
  bundle: OrderBundle,
  business: BusinessSettingsRow,
  variant: "customer" | "admin",
): string {
  const { order } = bundle;
  const sellerStateCode = resolveStateCode(business.address.stateCode);
  const isInterState = isInterStateSupply(
    sellerStateCode,
    order.shippingAddress.region,
  );
  const { lines, totals } = buildLines(bundle, business, isInterState);
  const hsnRows = hsnSummary(lines);
  const issued = !!order.invoiceNumber;
  const docTitle = issued ? "Tax Invoice" : "Proforma Invoice";
  const number = order.invoiceNumber ?? `DRAFT-${order.id}`;
  const issuedAt = order.invoiceIssuedAt ?? order.createdAt;
  const adminBlock =
    variant === "admin"
      ? `<div class="warn">Admin copy — internal use only. Customer copy omits this banner.</div>`
      : "";
  const proformaWarn = issued
    ? ""
    : `<div class="warn">This is a proforma invoice. Click "Issue invoice number" in the Orders tab to lock a sequential GST tax invoice number.</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(docTitle)} ${esc(number)}</title><style>${PRINT_CSS}</style></head><body>
<div class="print-bar">
  <button onclick="window.print()">Print / Save PDF</button>
  ${variant === "customer" ? `<a href="?variant=admin">Admin copy</a>` : `<a href="?variant=customer">Customer copy</a>`}
</div>
<div class="doc">
  ${adminBlock}
  ${proformaWarn}
  <div class="row" style="align-items:flex-start;margin-bottom:16px;">
    <div>
      <div class="brand">${esc(business.tradeName ?? business.legalName ?? "Dr Tea")}</div>
      <div class="muted">${esc(business.legalName ?? "")}</div>
      <div style="margin-top:6px;">${fmtAddress(business.address)}</div>
      ${business.gstin ? `<div style="margin-top:6px;"><strong>GSTIN:</strong> ${esc(business.gstin)}</div>` : ""}
      ${business.pan ? `<div><strong>PAN:</strong> ${esc(business.pan)}</div>` : ""}
      ${business.fssai ? `<div><strong>FSSAI:</strong> ${esc(business.fssai)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <span class="tag">${esc(docTitle)}</span>
      <h1 style="margin-top:8px;">${esc(number)}</h1>
      <div class="muted">Issued: ${esc(new Date(issuedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }))}</div>
      <div class="muted">Order #${order.id}</div>
      <div class="muted">Place of supply: ${esc(order.shippingAddress.region ?? "—")} ${isInterState ? "(Inter-state)" : "(Intra-state)"}</div>
    </div>
  </div>

  <div class="row">
    <div class="box">
      <h3>Bill to</h3>
      <strong>${esc(order.customerName)}</strong><br>
      ${esc(order.customerEmail)}${order.customerPhone ? "<br>" + esc(order.customerPhone) : ""}<br>
      ${fmtShipAddress(order)}
    </div>
    <div class="box">
      <h3>Ship to</h3>
      <strong>${esc(order.customerName)}</strong><br>
      ${fmtShipAddress(order)}
      ${bundle.shipment?.awb ? `<div style="margin-top:8px;"><strong>AWB:</strong> ${esc(bundle.shipment.awb)} <span class="muted">(${esc(bundle.shipment.courierCode ?? "")})</span></div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>HSN</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Taxable</th>
        ${
          isInterState
            ? `<th class="num">IGST %</th><th class="num">IGST ₹</th>`
            : `<th class="num">CGST %</th><th class="num">CGST ₹</th><th class="num">SGST %</th><th class="num">SGST ₹</th>`
        }
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lines
        .map(
          (l, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(l.name)}</strong><br><span class="muted">${esc(l.variant)}</span></td>
        <td>${esc(l.hsn)}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${inrFmt(l.unitPriceNet)}</td>
        <td class="num">${inrFmt(l.taxable)}</td>
        ${
          isInterState
            ? `<td class="num">${l.gstRatePct}%</td><td class="num">${inrFmt(l.igst)}</td>`
            : `<td class="num">${(l.gstRatePct / 2).toFixed(1)}%</td><td class="num">${inrFmt(l.cgst)}</td><td class="num">${(l.gstRatePct / 2).toFixed(1)}%</td><td class="num">${inrFmt(l.sgst)}</td>`
        }
        <td class="num"><strong>${inrFmt(l.lineGross)}</strong></td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="row" style="align-items:flex-start;">
    <div class="box">
      <h3>HSN summary</h3>
      <table style="margin:0;">
        <thead><tr><th>HSN</th><th class="num">Qty</th><th class="num">Taxable</th><th class="num">Tax</th></tr></thead>
        <tbody>
          ${hsnRows
            .map(
              (h) => `<tr><td>${esc(h.hsn)}</td><td class="num">${h.totalQty}</td><td class="num">${inrFmt(h.taxable)}</td><td class="num">${inrFmt(h.cgst + h.sgst + h.igst)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div>
      <table class="totals">
        <tr><td>Taxable value</td><td class="num">${inrFmt(totals.subtotal)}</td></tr>
        ${isInterState ? `<tr><td>IGST</td><td class="num">${inrFmt(totals.igst)}</td></tr>` : `<tr><td>CGST</td><td class="num">${inrFmt(totals.cgst)}</td></tr><tr><td>SGST</td><td class="num">${inrFmt(totals.sgst)}</td></tr>`}
        ${totals.discount ? `<tr><td>Loyalty discount</td><td class="num">−${inrFmt(totals.discount)}</td></tr>` : ""}
        ${totals.shipping ? `<tr><td>Shipping &amp; handling</td><td class="num">${inrFmt(totals.shipping)}</td></tr>` : ""}
        <tr class="grand"><td>Grand total (₹)</td><td class="num">${inrFmt(totals.grandTotal)}</td></tr>
      </table>
      <div class="muted" style="margin-top:6px;font-style:italic;">${esc(totals.amountInWords)}</div>
    </div>
  </div>

  ${
    business.bankName || business.upiId
      ? `<div class="box" style="margin-top:14px;"><h3>Payment details</h3>
        ${business.bankName ? `<div><strong>Bank:</strong> ${esc(business.bankName)}${business.bankBranch ? " — " + esc(business.bankBranch) : ""}</div>` : ""}
        ${business.bankAccountNumber ? `<div><strong>A/c:</strong> ${esc(business.bankAccountNumber)}</div>` : ""}
        ${business.bankIfsc ? `<div><strong>IFSC:</strong> ${esc(business.bankIfsc)}</div>` : ""}
        ${business.upiId ? `<div><strong>UPI:</strong> ${esc(business.upiId)}</div>` : ""}
      </div>`
      : ""
  }

  <div class="signature">
    ${business.signatureImageUrl ? `<img src="${esc(business.signatureImageUrl)}" alt="Signature">` : ""}
    <div style="margin-top:6px;"><strong>For ${esc(business.legalName ?? business.tradeName ?? "")}</strong></div>
    <div class="muted">Authorised signatory</div>
  </div>

  <div class="footer">
    ${business.invoiceFooterNote ? `<div>${esc(business.invoiceFooterNote)}</div>` : ""}
    <div>This is a system-generated invoice. ${issued ? "Tax invoice issued under Rule 46 of CGST Rules, 2017." : "Convert to a tax invoice by issuing a number from the Orders tab."}</div>
    ${variant === "admin" ? `<div style="margin-top:6px;"><strong>Admin notes:</strong> Order status: ${esc(order.status)} · ${bundle.shipment?.weightGrams ? `Parcel ${bundle.shipment.weightGrams}g` : "No shipment yet"}</div>` : ""}
  </div>
</div>
<script>setTimeout(function(){ if (location.hash === '#print') window.print(); }, 100);</script>
</body></html>`;
}

function renderPackingSlip(
  bundle: OrderBundle,
  business: BusinessSettingsRow,
): string {
  const { order, items, shipment } = bundle;
  const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Packing slip — Order #${order.id}</title><style>${PRINT_CSS}</style></head><body>
<div class="print-bar"><button onclick="window.print()">Print / Save PDF</button></div>
<div class="doc">
  <div class="row" style="align-items:flex-start;margin-bottom:16px;">
    <div>
      <div class="brand">${esc(business.tradeName ?? business.legalName ?? "Dr Tea")}</div>
      <div class="muted">Packing slip — keep with parcel</div>
    </div>
    <div style="text-align:right;">
      <span class="tag">Pack &amp; ship</span>
      <h1 style="margin-top:8px;">Order #${order.id}</h1>
      <div class="muted">${esc(new Date(order.createdAt).toLocaleString("en-IN"))}</div>
      ${shipment?.awb ? `<div style="margin-top:6px;"><strong>AWB:</strong> ${esc(shipment.awb)}</div>` : ""}
      ${shipment?.courierCode ? `<div class="muted">via ${esc(shipment.courierCode)}</div>` : ""}
    </div>
  </div>
  <div class="row">
    <div class="box"><h3>Ship to</h3><strong>${esc(order.customerName)}</strong><br>${fmtShipAddress(order)}<br><span class="muted">${esc(order.customerPhone ?? order.customerEmail)}</span></div>
    <div class="box"><h3>Dispatch from</h3>${fmtAddress(business.dispatchAddress?.line1 ? business.dispatchAddress : business.address)}</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Variant</th><th class="num">Qty</th><th>✓</th></tr></thead>
    <tbody>
      ${items
        .map(
          (it, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(it.productName)}</strong><br><span class="muted">SKU: ${esc(it.productId)}</span></td>
        <td>${esc(it.variantSize)}${it.subscription ? ' <span class="tag">SUB</span>' : ""}</td>
        <td class="num"><strong>${it.quantity}</strong></td>
        <td style="font-size:18px;color:#3a5a2c;">☐</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <div class="row">
    <div><strong>Total units:</strong> ${totalQty}</div>
    <div class="num">Order value: ${inrFmt(order.total)}</div>
  </div>
  ${order.notes ? `<div class="box" style="margin-top:12px;"><h3>Customer note</h3>${esc(order.notes)}</div>` : ""}
  <div class="footer">Pack securely. Snap a photo of the sealed parcel before handing to the courier — this is your delivery-dispute proof.</div>
</div>
</body></html>`;
}

function renderEwayBill(
  bundle: OrderBundle,
  business: BusinessSettingsRow,
): string {
  const { order, shipment } = bundle;
  const sellerStateCode = resolveStateCode(business.address.stateCode);
  const isInterState = isInterStateSupply(
    sellerStateCode,
    order.shippingAddress.region,
  );
  const { lines, totals } = buildLines(bundle, business, isInterState);
  const required = order.total >= 50_000 || isInterState;
  return `<!doctype html><html><head><meta charset="utf-8"><title>E-way bill worksheet — Order #${order.id}</title><style>${PRINT_CSS}</style></head><body>
<div class="print-bar"><button onclick="window.print()">Print</button> <a target="_blank" rel="noopener" href="https://ewaybillgst.gov.in">Open EWB portal</a></div>
<div class="doc">
  ${
    !required
      ? `<div class="warn">This order is &lt; ₹50,000 and intra-state — an e-way bill is <strong>not mandatory</strong>. Use this worksheet only if you choose to generate one anyway.</div>`
      : `<div class="warn">E-way bill <strong>required</strong> (${order.total >= 50_000 ? "value ≥ ₹50,000" : ""}${order.total >= 50_000 && isInterState ? " · " : ""}${isInterState ? "inter-state movement" : ""}). Enter these values at <strong>ewaybillgst.gov.in</strong> → Generate New.</div>`
  }
  <h1>E-way Bill Worksheet (EWB-01)</h1>
  <div class="muted">For Order #${order.id} — ${esc(new Date(order.createdAt).toLocaleDateString("en-IN"))}</div>
  <table>
    <tbody>
      <tr><th style="width:35%;">1. Supply type</th><td>Outward — Supply</td></tr>
      <tr><th>2. Sub type</th><td>Supply (B2C)</td></tr>
      <tr><th>3. Document type</th><td>Tax Invoice</td></tr>
      <tr><th>4. Document no</th><td>${esc(order.invoiceNumber ?? `DRAFT-${order.id}`)}</td></tr>
      <tr><th>5. Document date</th><td>${esc(new Date(order.invoiceIssuedAt ?? order.createdAt).toLocaleDateString("en-IN"))}</td></tr>
      <tr><th>6. From — GSTIN</th><td>${esc(business.gstin ?? "URP")}</td></tr>
      <tr><th>From — Name</th><td>${esc(business.legalName ?? business.tradeName ?? "")}</td></tr>
      <tr><th>From — Address</th><td>${fmtAddress(business.dispatchAddress?.line1 ? business.dispatchAddress : business.address)}</td></tr>
      <tr><th>From — State</th><td>${esc(business.address.state ?? "")} (${esc(business.address.stateCode ?? "—")})</td></tr>
      <tr><th>7. To — GSTIN</th><td>URP (Unregistered)</td></tr>
      <tr><th>To — Name</th><td>${esc(order.customerName)}</td></tr>
      <tr><th>To — Address</th><td>${fmtShipAddress(order)}</td></tr>
      <tr><th>To — State</th><td>${esc(order.shippingAddress.region ?? "")}</td></tr>
      <tr><th>8. Item details</th><td>${lines.map((l) => `${esc(l.name)} (${esc(l.variant)}) × ${l.qty} — HSN ${esc(l.hsn)} @ ${l.gstRatePct}%`).join("<br>")}</td></tr>
      <tr><th>9. Total taxable value</th><td class="num">${inrFmt(totals.subtotal)}</td></tr>
      <tr><th>10. CGST</th><td class="num">${inrFmt(totals.cgst)}</td></tr>
      <tr><th>11. SGST</th><td class="num">${inrFmt(totals.sgst)}</td></tr>
      <tr><th>12. IGST</th><td class="num">${inrFmt(totals.igst)}</td></tr>
      <tr><th>13. Total invoice value</th><td class="num"><strong>${inrFmt(totals.grandTotal)}</strong></td></tr>
      <tr><th>14. Transporter</th><td>${esc(shipment?.courierCode ?? "—")}</td></tr>
      <tr><th>15. Transport mode</th><td>Road</td></tr>
      <tr><th>16. Approx distance (km)</th><td class="muted">Auto-calculated by EWB portal from PIN ↔ PIN</td></tr>
      <tr><th>17. AWB / Doc no</th><td>${esc(shipment?.awb ?? "—")}</td></tr>
      <tr><th>18. Vehicle / LR no</th><td class="muted">Provided by courier (Shiprocket auto-pushes once manifested)</td></tr>
    </tbody>
  </table>
  <div class="footer">Once generated on the portal, paste the 12-digit EBN back into the Order's notes field for audit trail.</div>
</div>
</body></html>`;
}

// ── GSTR-1 CSV ───────────────────────────────────────────────────────

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function renderGstr1Csv(args: {
  orders: OrderRow[];
  items: OrderItemRow[];
  business: BusinessSettingsRow;
  label: string;
}): string {
  const { orders, items, business, label } = args;
  const sellerStateCode = resolveStateCode(business.address.stateCode);
  const itemsByOrder = new Map<number, OrderItemRow[]>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.orderId, arr);
  }

  const rows: string[] = [];
  rows.push(`# GSTR-1 export — period ${label}`);
  rows.push(
    `# Seller GSTIN: ${business.gstin ?? "(not configured)"} · Generated ${new Date().toISOString()}`,
  );
  rows.push("");

  // ── B2CL: inter-state, invoice value > ₹2.5 lakh ──────────────────
  rows.push(
    "Section,Invoice Number,Invoice Date,Invoice Value,Place of Supply,Rate,Taxable Value,IGST Amount",
  );
  let b2clCount = 0;
  for (const o of orders) {
    const buyerState = resolveStateCode(o.shippingAddress.region);
    const inter = sellerStateCode && buyerState && sellerStateCode !== buyerState;
    if (!inter || o.total < 250_000) continue;
    const orderItems = itemsByOrder.get(o.id) ?? [];
    const lines = orderItems.map((it) =>
      computeLine(
        {
          productId: it.productId,
          productName: it.productName,
          variantSize: it.variantSize,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          hsnCode: it.hsnCode,
          gstRatePct: it.gstRatePct,
        },
        { hsn: business.defaultHsnCode, ratePct: business.defaultGstRatePct },
        business.pricesIncludeTax,
        true,
      ),
    );
    const byRate = groupByRate(lines);
    for (const [rate, group] of byRate) {
      const taxable = sum(group.map((l) => l.taxable));
      const igst = sum(group.map((l) => l.igst));
      rows.push(
        [
          "B2CL",
          csvEscape(o.invoiceNumber ?? `ORD-${o.id}`),
          csvEscape(new Date(o.invoiceIssuedAt ?? o.createdAt).toISOString().slice(0, 10)),
          o.total.toFixed(2),
          csvEscape(o.shippingAddress.region ?? ""),
          rate.toFixed(2),
          taxable.toFixed(2),
          igst.toFixed(2),
        ].join(","),
      );
      b2clCount += 1;
    }
  }
  if (!b2clCount) rows.push("# (no B2CL invoices in period)");
  rows.push("");

  // ── B2CS: summary by Place-of-Supply × rate ───────────────────────
  rows.push(
    "Section,Type,Place of Supply,Rate,Taxable Value,CGST Amount,SGST Amount,IGST Amount",
  );
  type Bucket = {
    pos: string;
    rate: number;
    inter: boolean;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
  };
  const buckets = new Map<string, Bucket>();
  for (const o of orders) {
    const buyerState = resolveStateCode(o.shippingAddress.region);
    const inter = !!(sellerStateCode && buyerState && sellerStateCode !== buyerState);
    // B2CL handled above
    if (inter && o.total >= 250_000) continue;
    const orderItems = itemsByOrder.get(o.id) ?? [];
    const lines = orderItems.map((it) =>
      computeLine(
        {
          productId: it.productId,
          productName: it.productName,
          variantSize: it.variantSize,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          hsnCode: it.hsnCode,
          gstRatePct: it.gstRatePct,
        },
        { hsn: business.defaultHsnCode, ratePct: business.defaultGstRatePct },
        business.pricesIncludeTax,
        inter,
      ),
    );
    for (const l of lines) {
      const pos = o.shippingAddress.region ?? "";
      const key = `${pos}|${l.gstRatePct}|${inter ? "I" : "L"}`;
      const cur =
        buckets.get(key) ??
        ({
          pos,
          rate: l.gstRatePct,
          inter,
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
        } as Bucket);
      cur.taxable += l.taxable;
      cur.cgst += l.cgst;
      cur.sgst += l.sgst;
      cur.igst += l.igst;
      buckets.set(key, cur);
    }
  }
  for (const b of buckets.values()) {
    rows.push(
      [
        "B2CS",
        b.inter ? "OE" : "L",
        csvEscape(b.pos),
        b.rate.toFixed(2),
        b.taxable.toFixed(2),
        b.cgst.toFixed(2),
        b.sgst.toFixed(2),
        b.igst.toFixed(2),
      ].join(","),
    );
  }
  if (buckets.size === 0) rows.push("# (no B2CS rows)");
  rows.push("");

  // ── HSN summary across all orders ─────────────────────────────────
  rows.push(
    "Section,HSN,Description,UQC,Total Qty,Total Value,Taxable,CGST,SGST,IGST",
  );
  const allLines: ComputedLine[] = [];
  for (const o of orders) {
    const inter = !!(
      sellerStateCode &&
      resolveStateCode(o.shippingAddress.region) &&
      sellerStateCode !== resolveStateCode(o.shippingAddress.region)
    );
    for (const it of itemsByOrder.get(o.id) ?? []) {
      allLines.push(
        computeLine(
          {
            productId: it.productId,
            productName: it.productName,
            variantSize: it.variantSize,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            hsnCode: it.hsnCode,
            gstRatePct: it.gstRatePct,
          },
          { hsn: business.defaultHsnCode, ratePct: business.defaultGstRatePct },
          business.pricesIncludeTax,
          inter,
        ),
      );
    }
  }
  for (const h of hsnSummary(allLines)) {
    rows.push(
      [
        "HSN",
        csvEscape(h.hsn),
        csvEscape(h.description),
        h.uqc,
        h.totalQty.toFixed(2),
        h.totalValue.toFixed(2),
        h.taxable.toFixed(2),
        h.cgst.toFixed(2),
        h.sgst.toFixed(2),
        h.igst.toFixed(2),
      ].join(","),
    );
  }

  return rows.join("\n") + "\n";
}

function groupByRate(lines: ComputedLine[]): Map<number, ComputedLine[]> {
  const m = new Map<number, ComputedLine[]>();
  for (const l of lines) {
    const arr = m.get(l.gstRatePct) ?? [];
    arr.push(l);
    m.set(l.gstRatePct, arr);
  }
  return m;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export default router;
