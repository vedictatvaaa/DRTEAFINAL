import { logger } from "./logger";
import type { OrderRow } from "./db";

// Shiprocket REST adapter. Activates when SHIPROCKET_EMAIL and
// SHIPROCKET_PASSWORD are set in the environment. Otherwise the courier
// client falls back to the deterministic mock so development works
// without external credentials.
//
// Docs: https://apidocs.shiprocket.in/

const BASE_URL = process.env.SHIPROCKET_BASE_URL ?? "https://apiv2.shiprocket.in/v1/external";
const PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION ?? "Primary";

export function isShiprocketConfigured(): boolean {
  return Boolean(
    process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD,
  );
}

interface CachedToken {
  token: string;
  expiresAt: number;
  refreshedAt: number;
}
let tokenCache: CachedToken | null = null;
// Lightweight in-process telemetry — surfaced via getHealth() so the
// admin can see the SR connection's last successful API hit, last
// failure reason, and token age without us adding a dedicated table.
const health = {
  lastSuccessAt: 0 as number,
  lastFailureAt: 0 as number,
  lastFailureMessage: "" as string,
  totalCalls: 0,
  totalFailures: 0,
};

export function getHealth(): {
  configured: boolean;
  tokenRefreshedAt: number | null;
  tokenExpiresAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastFailureMessage: string;
  totalCalls: number;
  totalFailures: number;
} {
  return {
    configured: isShiprocketConfigured(),
    tokenRefreshedAt: tokenCache?.refreshedAt ?? null,
    tokenExpiresAt: tokenCache?.expiresAt ?? null,
    lastSuccessAt: health.lastSuccessAt || null,
    lastFailureAt: health.lastFailureAt || null,
    lastFailureMessage: health.lastFailureMessage,
    totalCalls: health.totalCalls,
    totalFailures: health.totalFailures,
  };
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  if (!isShiprocketConfigured()) {
    throw new Error("Shiprocket not configured");
  }
  const r = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Shiprocket auth failed: ${r.status} ${t}`);
  }
  const json = (await r.json()) as { token: string };
  tokenCache = {
    token: json.token,
    // SR tokens last ~10d; refresh after 8d to be safe.
    expiresAt: Date.now() + 8 * 24 * 60 * 60 * 1000,
    refreshedAt: Date.now(),
  };
  return json.token;
}

async function srFetch<T>(
  path: string,
  init: { method?: string; body?: unknown },
): Promise<T> {
  // Single-attempt fetch helper. On a 401 we bust the token cache and
  // re-auth once — Shiprocket tokens occasionally invalidate before the
  // 8-day TTL we cache them for.
  const attempt = async (): Promise<Response> => {
    const token = await getToken();
    return fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  };
  let r = await attempt();
  if (r.status === 401) {
    tokenCache = null;
    r = await attempt();
  }
  const text = await r.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  health.totalCalls += 1;
  if (!r.ok) {
    health.totalFailures += 1;
    health.lastFailureAt = Date.now();
    health.lastFailureMessage = `${r.status} ${text.slice(0, 200)}`;
    throw new Error(
      `Shiprocket ${init.method ?? "GET"} ${path} failed: ${r.status} ${text.slice(0, 240)}`,
    );
  }
  health.lastSuccessAt = Date.now();
  return data as T;
}

// Map a raw Shiprocket webhook current_status into our internal
// ShipmentStatus enum. SR uses fairly free-form strings so we normalise
// against keywords rather than exact equality. Falls through to
// undefined when the status isn't recognised — the webhook handler
// then logs the event without flipping the row's status.
export function mapShiprocketStatus(raw: string | null | undefined):
  | "manifested"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delayed"
  | "undelivered"
  | "returned"
  | "lost"
  | undefined {
  if (!raw) return undefined;
  const s = String(raw).toLowerCase();
  if (s.includes("delivered")) return "delivered";
  if (s.includes("rto") || s.includes("returned")) return "returned";
  if (s.includes("lost")) return "lost";
  if (s.includes("undelivered") || s.includes("ndr")) return "undelivered";
  if (s.includes("delay")) return "delayed";
  if (s.includes("out for delivery") || s.includes("ofd")) return "out_for_delivery";
  if (s.includes("transit") || s.includes("in_transit") || s.includes("shipped") || s.includes("picked"))
    return "in_transit";
  if (s.includes("manifest") || s.includes("awb") || s.includes("ready"))
    return "manifested";
  return undefined;
}

export interface SrCreateOrderResult {
  shiprocketOrderId: number;
  shipmentId: number;
}

// Create an order in Shiprocket. We map our OrderRow + items to the SR
// payload. The caller still needs to assign an AWB after this.
export async function createOrder(input: {
  order: OrderRow;
  items: Array<{ name: string; sku: string; units: number; sellingPrice: number }>;
  weightKg: number;
  dimensionsCm: { length: number; breadth: number; height: number };
}): Promise<SrCreateOrderResult> {
  const a = input.order.shippingAddress;
  const payload = {
    order_id: `DRTEA-${input.order.id}`,
    order_date: new Date(input.order.createdAt).toISOString().slice(0, 10),
    pickup_location: PICKUP_LOCATION,
    billing_customer_name: input.order.customerName,
    billing_last_name: "",
    billing_address: a.line1,
    billing_address_2: a.line2 ?? "",
    billing_city: a.city,
    billing_pincode: a.postalCode,
    billing_state: a.region ?? "",
    billing_country: a.country,
    billing_email: input.order.customerEmail,
    billing_phone: "0000000000",
    shipping_is_billing: true,
    // Shiprocket expects snake_case keys (selling_price, not sellingPrice).
    // Map every item the caller passed into SR's shape so the real path
    // doesn't silently send invalid items.
    order_items: (input.items.length
      ? input.items
      : [
          {
            name: `Order #${input.order.id}`,
            sku: `DRTEA-${input.order.id}`,
            units: 1,
            sellingPrice: input.order.total,
          },
        ]
    ).map((it) => ({
      name: it.name,
      sku: it.sku,
      units: it.units,
      selling_price: it.sellingPrice,
    })),
    payment_method: input.order.status === "paid" ? "Prepaid" : "COD",
    sub_total: input.order.subtotal,
    length: input.dimensionsCm.length,
    breadth: input.dimensionsCm.breadth,
    height: input.dimensionsCm.height,
    weight: input.weightKg,
  };
  const data = await srFetch<{ order_id: number; shipment_id: number }>(
    "/orders/create/adhoc",
    { method: "POST", body: payload },
  );
  return { shiprocketOrderId: data.order_id, shipmentId: data.shipment_id };
}

export interface SrAwbResult {
  awb: string;
  courierName: string;
  courierCompanyId: number;
}

export async function assignAwb(
  shiprocketShipmentId: number,
  courierCompanyId?: number,
): Promise<SrAwbResult> {
  const data = await srFetch<{
    awb_assign_status: number;
    response: { data: { awb_code: string; courier_name: string; courier_company_id: number } };
  }>("/courier/assign/awb", {
    method: "POST",
    body: { shipment_id: shiprocketShipmentId, courier_id: courierCompanyId },
  });
  if (!data.response?.data?.awb_code) {
    throw new Error("Shiprocket: AWB not assigned");
  }
  return {
    awb: data.response.data.awb_code,
    courierName: data.response.data.courier_name,
    courierCompanyId: data.response.data.courier_company_id,
  };
}

export async function generateLabel(
  shiprocketShipmentIds: number[],
): Promise<string> {
  const data = await srFetch<{ label_url?: string }>("/courier/generate/label", {
    method: "POST",
    body: { shipment_id: shiprocketShipmentIds },
  });
  if (!data.label_url) throw new Error("Shiprocket: label URL missing");
  return data.label_url;
}

export interface SrTrackingEvent {
  date: string;
  activity: string;
  location: string;
  status: string;
}

export async function getTracking(awb: string): Promise<SrTrackingEvent[]> {
  const data = await srFetch<{
    tracking_data?: { shipment_track_activities?: SrTrackingEvent[] };
  }>(`/courier/track/awb/${encodeURIComponent(awb)}`, { method: "GET" });
  return data.tracking_data?.shipment_track_activities ?? [];
}

export async function cancelShipment(awb: string): Promise<void> {
  try {
    await srFetch("/orders/cancel/shipment/awbs", {
      method: "POST",
      body: { awbs: [awb] },
    });
  } catch (err) {
    logger.warn({ err, awb }, "shiprocket.cancel.failed");
  }
}
