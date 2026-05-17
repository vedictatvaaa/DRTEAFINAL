import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { track, installAnalyticsLifecycle } from "@/lib/analytics";

/**
 * Mounted once at the app root. Emits a `page_view` whenever the wouter
 * location changes and installs visibility-change flushing.
 */
export default function AnalyticsTracker() {
  const [location] = useLocation();
  const installed = useRef(false);
  useEffect(() => {
    if (installed.current) return;
    installed.current = true;
    installAnalyticsLifecycle();
  }, []);
  useEffect(() => {
    track({ type: "page_view", path: location });
  }, [location]);
  return null;
}
