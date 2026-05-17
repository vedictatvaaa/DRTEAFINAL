// Lightweight first-party analytics client. Buffers events, posts batches
// to /api/events, and resends on visibility change so we don't drop the last
// page-view of a session.

const API_BASE = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

const SESSION_KEY = "drtea_session_v1";
const ATTR_KEY = "drtea_attr_v1";

interface Attribution {
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  country: string;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr-no-session";
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = uuid();
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return uuid();
  }
}

function captureAttribution(): Attribution {
  if (typeof window === "undefined") {
    return { referrer: "", utmSource: "", utmMedium: "", utmCampaign: "", country: "" };
  }
  try {
    const cached = sessionStorage.getItem(ATTR_KEY);
    if (cached) return JSON.parse(cached) as Attribution;
  } catch { /* ignore */ }
  const url = new URL(window.location.href);
  const attr: Attribution = {
    referrer: document.referrer ?? "",
    utmSource: url.searchParams.get("utm_source") ?? "",
    utmMedium: url.searchParams.get("utm_medium") ?? "",
    utmCampaign: url.searchParams.get("utm_campaign") ?? "",
    country: (navigator.language?.split("-")[1] ?? "").toUpperCase(),
  };
  try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr)); } catch { /* ignore */ }
  return attr;
}

export type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "order_placed";

export interface TrackEvent {
  type: AnalyticsEventType;
  path?: string;
  productId?: string;
  orderId?: number;
  value?: number;
  currency?: string;
}

interface QueuedEvent extends TrackEvent {
  sessionId: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  country: string;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { void flush(); }, 1500);
}

async function flush(useBeacon = false): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  const body = JSON.stringify({ events: batch });
  const url = `${API_BASE}/events`;
  try {
    if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Drop on failure — analytics is best-effort.
  }
}

export function track(evt: TrackEvent): void {
  if (typeof window === "undefined") return;
  const attr = captureAttribution();
  queue.push({
    type: evt.type,
    path: evt.path ?? window.location.pathname,
    productId: evt.productId,
    orderId: evt.orderId,
    value: evt.value,
    currency: evt.currency,
    sessionId: getSessionId(),
    referrer: attr.referrer,
    utmSource: attr.utmSource,
    utmMedium: attr.utmMedium,
    utmCampaign: attr.utmCampaign,
    country: attr.country,
  });
  scheduleFlush();
}

export function installAnalyticsLifecycle(): void {
  if (typeof window === "undefined") return;
  const onHide = () => { void flush(true); };
  window.addEventListener("pagehide", onHide);
  window.addEventListener("beforeunload", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush(true);
  });
}
