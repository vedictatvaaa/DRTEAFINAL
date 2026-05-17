// Trigger engine for the popup-nudge feature. Watches user behaviour
// (idle, dwell, exit-intent, cart-idle, return-visit) and fires a nudge
// when thresholds are crossed. Respects per-session caps + cooldown.

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/store/use-store";
import {
  pickNudge,
  type NudgeMessage,
  type NudgeTone,
  type NudgeTrigger,
} from "@/lib/nudge-library";

const API = `${import.meta.env.BASE_URL}api`;
const SESSION_KEY = "drtea_nudge_session";
const LAST_VISIT_KEY = "drtea_last_visit";

type Thresholds = {
  idleSeconds: number;
  productDwellSeconds: number;
  manyProductsThreshold: number;
  cartIdleSeconds: number;
  maxPerSession: number;
  cooldownSeconds: number;
};

type Config = {
  enabled: boolean;
  tones: NudgeTone[];
  triggers: NudgeTrigger[];
  thresholds: Thresholds;
  customMessages: NudgeMessage[];
};

type SessionState = {
  shownCount: number;
  shownIds: string[];
  lastShownAt: number;
  fired: Partial<Record<NudgeTrigger, true>>;
};

function loadSession(): SessionState {
  if (typeof window === "undefined") {
    return { shownCount: 0, shownIds: [], lastShownAt: 0, fired: {} };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as SessionState;
  } catch {
    /* noop */
  }
  return { shownCount: 0, shownIds: [], lastShownAt: 0, fired: {} };
}

function saveSession(s: SessionState) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

function postTelemetry(
  kind: "shown" | "converted",
  msg: NudgeMessage,
): void {
  try {
    void fetch(`${API}/nudges/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        tone: msg.tone,
        trigger: msg.trigger,
        messageId: msg.id,
      }),
      keepalive: true,
    });
  } catch {
    /* noop */
  }
}

export type ActiveNudge = {
  message: NudgeMessage;
  shownAt: number;
};

export function useNudgeEngine(): {
  nudge: ActiveNudge | null;
  dismiss: () => void;
  convert: () => void;
} {
  const [config, setConfig] = useState<Config | null>(null);
  const [nudge, setNudge] = useState<ActiveNudge | null>(null);
  const [location] = useLocation();
  const cart = useStore((s) => s.cart);
  const isCartOpen = useStore((s) => s.isCartOpen);

  // 1. Load config once.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/nudges/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setConfig(d as Config);
      })
      .catch(() => {
        /* fail-silent: feature stays off */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Track product page visits.
  const productViewsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (location.startsWith("/product/")) {
      productViewsRef.current.add(location);
    }
  }, [location]);

  // 3. Main trigger loop.
  const sessionRef = useRef<SessionState>(loadSession());
  const lastActivityRef = useRef<number>(Date.now());
  const pageEnteredAtRef = useRef<number>(Date.now());
  const cartChangedAtRef = useRef<number>(Date.now());
  const cartLenRef = useRef<number>(cart.length);

  // Reset page-enter timer on route change.
  useEffect(() => {
    pageEnteredAtRef.current = Date.now();
  }, [location]);

  // Track cart changes.
  useEffect(() => {
    if (cart.length !== cartLenRef.current) {
      cartChangedAtRef.current = Date.now();
      cartLenRef.current = cart.length;
    }
  }, [cart.length]);

  // Update last-activity on real input.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener("mousemove", bump, opts);
    window.addEventListener("scroll", bump, opts);
    window.addEventListener("keydown", bump);
    window.addEventListener("touchstart", bump, opts);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("scroll", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("touchstart", bump);
    };
  }, []);

  // Exit-intent — desktop pointer devices only. We require the cursor to
  // actually leave the document (relatedTarget null) near the top of the
  // viewport, and we throttle so accidental top-edge moves don't spam.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!config?.enabled) return;
    if (!config.triggers.includes("exit_intent")) return;
    // Skip on touch devices — there is no real "exit intent" gesture.
    const isCoarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    let lastCheck = 0;
    const onMouseOut = (e: MouseEvent) => {
      // Only count when the pointer leaves the document (no relatedTarget).
      if (e.relatedTarget !== null) return;
      const toEl = (e as MouseEvent & { toElement?: Element | null }).toElement;
      if (toEl) return;
      if (e.clientY > 8) return;
      const now = Date.now();
      if (now - lastCheck < 2000) return;
      lastCheck = now;
      tryFire("exit_intent");
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Return-visit detection — once per session, on mount if we have a marker.
  useEffect(() => {
    if (!config?.enabled) return;
    if (!config.triggers.includes("return_visit")) return;
    try {
      const last = Number(localStorage.getItem(LAST_VISIT_KEY) || 0);
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      // Only treat as a "return visit" if previous visit was >6h ago and <7d ago.
      if (last && now - last > sixHours && now - last < sevenDays) {
        // Delay so it doesn't slam the first paint.
        const t = window.setTimeout(() => tryFire("return_visit"), 6000);
        return () => window.clearTimeout(t);
      }
      localStorage.setItem(LAST_VISIT_KEY, String(now));
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Polling loop for time-based triggers.
  useEffect(() => {
    if (!config?.enabled) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const t = config.thresholds;
      const idleFor = Math.floor((now - lastActivityRef.current) / 1000);
      const onPageFor = Math.floor((now - pageEnteredAtRef.current) / 1000);
      const cartIdleFor = Math.floor((now - cartChangedAtRef.current) / 1000);

      // cart_idle — has items, drawer not open, sitting still
      if (
        config.triggers.includes("cart_idle") &&
        cart.length > 0 &&
        !isCartOpen &&
        !location.startsWith("/checkout") &&
        cartIdleFor >= t.cartIdleSeconds
      ) {
        if (tryFire("cart_idle")) return;
      }

      // product_dwell — long stare at a product page, nothing in cart change
      if (
        config.triggers.includes("product_dwell") &&
        location.startsWith("/product/") &&
        onPageFor >= t.productDwellSeconds &&
        idleFor >= 6
      ) {
        if (tryFire("product_dwell")) return;
      }

      // many_products — viewed N+ distinct product pages, cart still empty
      if (
        config.triggers.includes("many_products") &&
        cart.length === 0 &&
        productViewsRef.current.size >= t.manyProductsThreshold
      ) {
        if (tryFire("many_products")) return;
      }

      // idle_browse — generic browsing for too long with empty cart
      if (
        config.triggers.includes("idle_browse") &&
        cart.length === 0 &&
        onPageFor >= t.idleSeconds &&
        idleFor >= 8
      ) {
        if (tryFire("idle_browse")) return;
      }
    }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, cart.length, isCartOpen, location]);

  // Save marker on unmount so return_visit can fire next time.
  useEffect(() => {
    return () => {
      try {
        localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
      } catch {
        /* noop */
      }
    };
  }, []);

  function tryFire(trigger: NudgeTrigger): boolean {
    if (!config?.enabled) return false;
    // Don't show on admin or checkout funnel.
    if (location.startsWith("/admin")) return false;
    if (location.startsWith("/checkout")) return false;
    // Don't show if a nudge is already on screen.
    if (nudge) return false;

    const s = sessionRef.current;
    const now = Date.now();
    if (s.shownCount >= config.thresholds.maxPerSession) return false;
    if (now - s.lastShownAt < config.thresholds.cooldownSeconds * 1000) {
      return false;
    }
    // Each trigger fires at most once per session.
    if (s.fired[trigger]) return false;

    const msg = pickNudge(
      trigger,
      config.tones,
      config.customMessages,
      s.shownIds,
    );
    if (!msg) return false;

    const next: SessionState = {
      shownCount: s.shownCount + 1,
      shownIds: [...s.shownIds.slice(-20), msg.id],
      lastShownAt: now,
      fired: { ...s.fired, [trigger]: true },
    };
    sessionRef.current = next;
    saveSession(next);
    setNudge({ message: msg, shownAt: now });
    postTelemetry("shown", msg);
    return true;
  }

  const dismiss = () => setNudge(null);
  const convert = () => {
    if (nudge) postTelemetry("converted", nudge.message);
    setNudge(null);
  };

  return { nudge, dismiss, convert };
}
