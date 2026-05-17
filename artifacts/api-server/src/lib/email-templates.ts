import type { OrderRow, OrderItemRow, AbandonedCartRow } from "./db";
import { trackedLink } from "./email";

const STORE_BASE =
  process.env["PUBLIC_STORE_BASE"] ?? "https://dr-tea.example.com";

function formatAddress(addr: unknown): string {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  const a = addr as Record<string, unknown>;
  return [a.line1, a.line2, a.city, a.region, a.postalCode, a.country]
    .filter((v) => typeof v === "string" && v.length > 0)
    .join(", ");
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c] as string);
}

function money(amount: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function shell(opts: { title: string; preheader?: string; bodyHtml: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escape(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f6f3ee;font-family:Georgia,'Times New Roman',serif;color:#1d1a16;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escape(opts.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ee;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffaf2;border:1px solid #e6dfd2;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #efe8da;">
        <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:0.04em;color:#3a2a14;">DR TEA</div>
        <div style="font-size:12px;color:#8a7a60;letter-spacing:0.18em;text-transform:uppercase;">artisan blends</div>
      </td></tr>
      <tr><td style="padding:28px;">${opts.bodyHtml}</td></tr>
      <tr><td style="padding:18px 28px;background:#f3ecdf;font-size:12px;color:#6b5f48;text-align:center;">
        Dr Tea · brewed with care · <a href="${STORE_BASE}" style="color:#6b5f48;">drtea.shop</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function itemsTable(items: OrderItemRow[], currency: string): string {
  const rows = items
    .map(
      (it) => `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #efe8da;">
    <div style="font-weight:bold;">${escape(it.productName)}</div>
    <div style="font-size:12px;color:#7a6a52;">${escape(it.variantSize)} · ×${it.quantity}${it.subscription ? " · Subscription" : ""}</div>
  </td>
  <td style="padding:8px 0;border-bottom:1px solid #efe8da;text-align:right;white-space:nowrap;">${money(it.unitPrice * it.quantity, currency)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

export function renderOrderPlaced(order: OrderRow & { items: OrderItemRow[] }): { subject: string; html: string } {
  const subject = `Order #${order.id} — your tea is on the way`;
  const html = shell({
    title: subject,
    preheader: `We've received your order #${order.id}. We'll start packing it shortly.`,
    bodyHtml: `
<h2 style="margin:0 0 8px;font-size:22px;">Thank you, ${escape(order.customerName || "tea lover")}.</h2>
<p style="margin:0 0 16px;line-height:1.6;">Order <strong>#${order.id}</strong> is in. We'll pack it with care and let you know the moment it ships.</p>
${itemsTable(order.items, order.currency)}
<table role="presentation" width="100%" style="margin-top:12px;">
  <tr><td style="text-align:right;font-size:14px;color:#7a6a52;">Subtotal</td><td style="text-align:right;width:90px;">${money(order.subtotal, order.currency)}</td></tr>
  <tr><td style="text-align:right;font-weight:bold;padding-top:6px;">Total</td><td style="text-align:right;font-weight:bold;padding-top:6px;">${money(order.total, order.currency)}</td></tr>
</table>
<div style="margin:22px 0 0;padding:12px 14px;background:#f3ecdf;border-left:3px solid #b08c4a;border-radius:6px;font-size:13px;color:#6b5234;">
  <strong>Tracking pending.</strong> A separate note with your tracking number will arrive once the parcel leaves our warehouse — usually within 1 business day.
</div>
<div style="margin:18px 0 0;padding:14px 16px;background:#eef2e7;border-radius:8px;">
  <div style="font-weight:bold;font-size:14px;color:#3a4a26;margin-bottom:6px;">Brewing tips while you wait</div>
  <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#3a4a26;">
    <li>Use filtered water, just off the boil (~85–95°C for green &amp; oolong; full boil for black &amp; herbal).</li>
    <li>One heaped teaspoon per cup. Let leaves unfurl — don't crowd the strainer.</li>
    <li>Steep 2–3 min for delicate teas, 4–5 min for black &amp; herbal blends.</li>
    <li>Re-steep good leaves 2–3 times — flavours change and deepen with each pour.</li>
  </ul>
</div>
<p style="margin:24px 0 0;font-size:13px;color:#7a6a52;">Ship to: ${escape(formatAddress(order.shippingAddress))}</p>`,
  });
  return { subject, html };
}

export function renderOrderStatus(
  order: OrderRow & { items: OrderItemRow[] },
  status: "packed" | "shipped" | "delivered" | "refunded",
): { subject: string; html: string } {
  const titles: Record<string, { subj: string; head: string; body: string }> = {
    packed: {
      subj: `Order #${order.id} packed`,
      head: "Packed and ready",
      body: "Your tea is boxed up and waiting for the carrier. You'll get a tracking note next.",
    },
    shipped: {
      subj: `Order #${order.id} shipped`,
      head: "On its way to you",
      body: "Your order has left our warehouse. Most parcels arrive within 3–5 days.",
    },
    delivered: {
      subj: `Order #${order.id} delivered`,
      head: "Delivered — happy brewing",
      body: "Your order has been marked as delivered. We hope it brings a calm pause to your day.",
    },
    refunded: {
      subj: `Order #${order.id} refunded`,
      head: "Refund processed",
      body: "We've issued a full refund for this order. It typically lands in 5–7 business days.",
    },
  };
  const cfg = titles[status];
  const html = shell({
    title: cfg.subj,
    preheader: cfg.body,
    bodyHtml: `
<h2 style="margin:0 0 8px;font-size:22px;">${cfg.head}</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi ${escape(order.customerName || "there")} — ${cfg.body}</p>
${itemsTable(order.items, order.currency)}
<p style="margin:24px 0 0;font-size:13px;color:#7a6a52;">Order #${order.id} · ${money(order.total, order.currency)}</p>`,
  });
  return { subject: cfg.subj, html };
}

export function renderWelcome(name: string): { subject: string; html: string } {
  const subject = "Welcome to the Dr Tea circle";
  const guideUrl = `${STORE_BASE}/guides/dr-tea-brewing-guide.pdf`;
  const html = shell({
    title: subject,
    preheader: "A warm welcome — and your free brewing guide.",
    bodyHtml: `
<h2 style="margin:0 0 8px;font-size:22px;">Welcome${name ? `, ${escape(name)}` : ""}.</h2>
<p style="margin:0 0 16px;line-height:1.6;">You're now in the Dr Tea circle — small-batch blends, slow rituals, and the occasional letter from our tea garden.</p>
<p style="margin:0 0 16px;line-height:1.6;">As a thank-you, here's our free <strong>Dr Tea Brewing Guide</strong> — water temperatures, steep times, and re-steep notes for every blend we make.</p>
<p style="margin:18px 0 0;text-align:center;">
  <a href="${guideUrl}" style="display:inline-block;background:#3a2a14;color:#fffaf2;text-decoration:none;padding:12px 28px;border-radius:999px;letter-spacing:0.08em;text-transform:uppercase;font-size:13px;">Download brewing guide (PDF)</a>
</p>
<p style="margin:18px 0 0;line-height:1.6;">Browse the new season at <a href="${STORE_BASE}/shop">drtea.shop</a>. We'll be in touch when something special is brewing.</p>`,
  });
  return { subject, html };
}

export function renderAbandonedCart(
  cart: AbandonedCartRow,
  resumeToken?: string,
): { subject: string; html: string } {
  const subject = "You left a few teas steeping in your cart";
  const itemHtml = cart.items
    .map(
      (it) => `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #efe8da;">
    <div style="font-weight:bold;">${escape(it.productName)}</div>
    <div style="font-size:12px;color:#7a6a52;">${escape(it.variantSize)} · ×${it.quantity}</div>
  </td>
  <td style="padding:8px 0;border-bottom:1px solid #efe8da;text-align:right;">${money(it.unitPrice * it.quantity, cart.currency)}</td>
</tr>`,
    )
    .join("");
  const token = resumeToken ?? cart.resumeToken ?? "";
  const resumeUrl = token
    ? `${STORE_BASE}/?restore=${encodeURIComponent(token)}`
    : `${STORE_BASE}/cart`;
  const html = shell({
    title: subject,
    preheader: "Your cart is still waiting — finish checkout in a single tap.",
    bodyHtml: `
<h2 style="margin:0 0 8px;font-size:22px;">Still steeping?</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi ${escape(cart.customerName || "there")} — your cart is right where you left it. Tap below and we'll restore every item in one click.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemHtml}</table>
<p style="margin:18px 0 0;text-align:center;">
  <a href="${resumeUrl}" style="display:inline-block;background:#3a2a14;color:#fffaf2;text-decoration:none;padding:12px 28px;border-radius:999px;letter-spacing:0.08em;text-transform:uppercase;font-size:13px;">Resume my cart</a>
</p>`,
  });
  return { subject, html };
}

export function renderNewsletter(opts: {
  subject: string;
  preheader: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  trackingToken: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.7;">${escape(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const ctaHref = opts.ctaUrl ? trackedLink(opts.trackingToken, opts.ctaUrl) : "";
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<p style="margin:18px 0 0;text-align:center;">
  <a href="${ctaHref}" style="display:inline-block;background:#3a2a14;color:#fffaf2;text-decoration:none;padding:12px 28px;border-radius:999px;letter-spacing:0.08em;text-transform:uppercase;font-size:13px;">${escape(opts.ctaLabel)}</a>
</p>`
    : "";
  const html = shell({
    title: opts.subject,
    preheader: opts.preheader,
    bodyHtml: `${paragraphs}${cta}
<p style="margin:28px 0 0;font-size:11px;color:#9a8c70;text-align:center;">
  You're receiving this because you joined the Dr Tea circle.<br/>
  <a href="${opts.unsubscribeUrl}" style="color:#9a8c70;">Unsubscribe</a>
</p>`,
  });
  return { subject: opts.subject, html };
}
