// Client lib for the shopper-facing /shopper/orders endpoints.
// Mirrors the shape of the API responses; intentionally minimal — the
// account page is the only consumer.

const API = `${import.meta.env.BASE_URL}api`;

export interface CustomerOrderItem {
  id: number;
  orderId: number;
  productId: string;
  productName: string;
  variantSize: string;
  quantity: number;
  unitPrice: number;
  subscription: boolean;
  hsnCode: string | null;
  gstRatePct: number | null;
}

export interface CustomerShipment {
  id: number;
  status: string;
  courierCode: string;
  awb: string | null;
  trackingUrl: string | null;
  expectedDeliveryAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface CustomerOrder {
  id: number;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  invoiceNumber: string | null;
  invoiceIssuedAt: string | null;
  notes: string | null;
  shippingAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    region?: string | null;
    postalCode: string;
    country: string;
  };
  items: CustomerOrderItem[];
  shipment: CustomerShipment | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchMyOrders(): Promise<CustomerOrder[]> {
  const r = await fetch(`${API}/shopper/orders`, { credentials: "include" });
  if (!r.ok) throw new Error("Could not load your orders.");
  const j = (await r.json()) as { orders: CustomerOrder[] };
  return j.orders;
}

export function invoiceUrl(orderId: number): string {
  return `${API}/shopper/orders/${orderId}/invoice`;
}
