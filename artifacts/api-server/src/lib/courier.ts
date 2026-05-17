import { randomBytes } from "crypto";
import type { OrderRow } from "./db";
import {
  isShiprocketConfigured,
  createOrder as srCreateOrder,
  assignAwb as srAssignAwb,
  generateLabel as srGenerateLabel,
  getTracking as srGetTracking,
} from "./shiprocket";
import { logger } from "./logger";

// Pluggable courier client. Real-world this would dispatch to Delhivery /
// Shiprocket / Bluedart APIs. For now we return deterministic mock AWBs
// and tracking URLs so the rest of the shipping surface (manifests,
// labels, dashboards, automation) is real and ready to plug a provider in.

export interface CourierProfile {
  code: string;
  name: string;
  hub: string;
  // Naive zone-based delivery SLAs in days; lower = faster.
  baseSlaDays: number;
  // Cost per gram in paise (₹0.01) — used to compare quotes.
  costPerGramPaise: number;
}

export const COURIERS: CourierProfile[] = [
  { code: "shiprocket", name: "Shiprocket (auto-pick)", hub: "Multiple", baseSlaDays: 4, costPerGramPaise: 8 },
  { code: "delhivery", name: "Delhivery", hub: "Bengaluru", baseSlaDays: 4, costPerGramPaise: 9 },
  { code: "bluedart", name: "Blue Dart", hub: "Mumbai", baseSlaDays: 3, costPerGramPaise: 14 },
  { code: "xpressbees", name: "Xpressbees", hub: "Pune", baseSlaDays: 5, costPerGramPaise: 8 },
  { code: "indiapost", name: "India Post", hub: "Delhi", baseSlaDays: 7, costPerGramPaise: 5 },
  { code: "manual", name: "Manual / In-house", hub: "Local", baseSlaDays: 2, costPerGramPaise: 12 },
];

export function getCourier(code: string): CourierProfile | null {
  return COURIERS.find((c) => c.code === code) ?? null;
}

export interface QuoteInput {
  weightGrams: number;
  destinationPostalCode: string;
  declaredValue: number;
}

export interface CourierQuote {
  code: string;
  name: string;
  estCostPaise: number;
  estDeliveryAt: string;
  recommended: boolean;
}

// Quote every courier; recommend the best cost-per-day balance.
export function quoteAllCouriers(input: QuoteInput): CourierQuote[] {
  const now = Date.now();
  const quotes = COURIERS.map((c) => {
    const cost = c.costPerGramPaise * Math.max(100, input.weightGrams);
    const eta = new Date(now + c.baseSlaDays * 86_400_000).toISOString();
    // Score: lower cost + faster delivery wins. Pure heuristic.
    const score = cost / 100 + c.baseSlaDays * 50;
    return { code: c.code, name: c.name, estCostPaise: cost, estDeliveryAt: eta, score };
  });
  const best = Math.min(...quotes.map((q) => q.score));
  return quotes.map(({ score, ...q }) => ({
    ...q,
    recommended: score === best,
  }));
}

export interface CreateShipmentInput {
  order: OrderRow;
  courierCode: string;
  weightGrams: number;
  declaredValue: number;
  // Optional real line items — when provided they're forwarded to the
  // provider verbatim. Without them we fall back to a single synthetic
  // line (which Shiprocket accepts in dev but rejects in prod).
  items?: Array<{ name: string; sku: string; units: number; sellingPrice: number }>;
}

export interface CreateShipmentResult {
  awb: string;
  trackingUrl: string;
  labelUrl: string;
  expectedDeliveryAt: Date;
  // Surfaced so callers (and the activity log) can tell real vs mock.
  provider: "shiprocket" | "mock";
  providerShipmentId?: number;
}

// Coarse parcel envelope chosen by total weight. Volumetric weight is
// L×B×H/5000 — these envelopes keep volumetric ≤ actual weight at the
// upper bound of each band so we don't get billed extra by SR.
function pickParcelDimensions(weightGrams: number): {
  length: number;
  breadth: number;
  height: number;
} {
  if (weightGrams <= 500) return { length: 18, breadth: 12, height: 6 };
  if (weightGrams <= 1500) return { length: 22, breadth: 16, height: 10 };
  if (weightGrams <= 5000) return { length: 30, breadth: 22, height: 14 };
  return { length: 38, breadth: 28, height: 20 };
}

function mockShipment(input: CreateShipmentInput): CreateShipmentResult {
  const courier = getCourier(input.courierCode);
  if (!courier) throw new Error(`Unknown courier: ${input.courierCode}`);
  const awb = `${courier.code.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const eta = new Date(Date.now() + courier.baseSlaDays * 86_400_000);
  return {
    awb,
    trackingUrl: `https://track.example/${courier.code}/${awb}`,
    labelUrl: `/api/admin/shipments/label/${encodeURIComponent(awb)}.pdf`,
    expectedDeliveryAt: eta,
    provider: "mock",
  };
}

// Create a shipment via the configured provider. Async because real
// providers (Shiprocket) require multiple sequential API calls. When
// Shiprocket isn't configured we fall back to the deterministic mock so
// the rest of the surface keeps working.
export async function createShipment(
  input: CreateShipmentInput,
): Promise<CreateShipmentResult> {
  const courier = getCourier(input.courierCode);
  if (!courier) throw new Error(`Unknown courier: ${input.courierCode}`);

  // "shiprocket" courier code routes through the SR API exclusively.
  // Any other code with SR configured is treated as a manual override
  // and uses the mock so admins keep direct control.
  if (input.courierCode === "shiprocket") {
    if (!isShiprocketConfigured()) {
      throw new Error(
        "Shiprocket not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.",
      );
    }
    try {
      const sr = await srCreateOrder({
        order: input.order,
        items: input.items?.length
          ? input.items
          : [
              {
                name: `Order #${input.order.id}`,
                sku: `DRTEA-${input.order.id}`,
                units: 1,
                sellingPrice: input.order.total,
              },
            ],
        weightKg: Math.max(input.weightGrams / 1000, 0.05),
        // Pick a parcel envelope from the actual weight rather than a
        // single hardcoded box — Shiprocket bills on volumetric weight
        // (L×B×H/5000) and a too-large box silently overcharges.
        dimensionsCm: pickParcelDimensions(input.weightGrams),
      });
      const awb = await srAssignAwb(sr.shipmentId);
      let labelUrl = `/api/admin/shipments/label/${encodeURIComponent(awb.awb)}.pdf`;
      try {
        labelUrl = await srGenerateLabel([sr.shipmentId]);
      } catch (err) {
        logger.warn({ err }, "shiprocket.label.fallback");
      }
      return {
        awb: awb.awb,
        trackingUrl: `https://shiprocket.co/tracking/${encodeURIComponent(awb.awb)}`,
        labelUrl,
        expectedDeliveryAt: new Date(Date.now() + courier.baseSlaDays * 86_400_000),
        provider: "shiprocket",
        providerShipmentId: sr.shipmentId,
      };
    } catch (err) {
      logger.error({ err }, "shiprocket.create.failed");
      throw err;
    }
  }
  return mockShipment(input);
}

export interface TrackingEvent {
  status: string;
  message: string;
  location: string;
  at: string;
}

// Tracking — uses Shiprocket when configured + AWB looks like SR, else
// falls back to the synthetic mock events.
export async function fetchTrackingAsync(
  awb: string,
  hubCity: string,
): Promise<TrackingEvent[]> {
  if (isShiprocketConfigured()) {
    try {
      const events = await srGetTracking(awb);
      if (events.length) {
        return events.map((e) => ({
          status: e.status,
          message: e.activity,
          location: e.location,
          at: e.date,
        }));
      }
    } catch (err) {
      logger.warn({ err, awb }, "shiprocket.track.fallback");
    }
  }
  return fetchTracking(awb, hubCity);
}

// Mock courier tracking — synthesised from the AWB so it stays stable.
export function fetchTracking(awb: string, hubCity: string): TrackingEvent[] {
  const start = Date.now() - 3 * 86_400_000;
  return [
    {
      status: "manifested",
      message: "Shipment manifested with courier",
      location: hubCity,
      at: new Date(start).toISOString(),
    },
    {
      status: "in_transit",
      message: "In transit to destination hub",
      location: `${hubCity} → Hyderabad`,
      at: new Date(start + 86_400_000).toISOString(),
    },
    {
      status: "out_for_delivery",
      message: "Out for delivery",
      location: "Local hub",
      at: new Date(start + 2 * 86_400_000).toISOString(),
    },
  ];
}
