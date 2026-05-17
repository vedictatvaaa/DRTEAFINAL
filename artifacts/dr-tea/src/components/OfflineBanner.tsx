import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setHasBeenOffline(true);
      setShowReconnected(false);
      return;
    }
    if (hasBeenOffline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
    return;
  }, [isOnline, hasBeenOffline]);

  const visible = !isOnline || showReconnected;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 240 }}
          role="status"
          aria-live="polite"
          data-testid="offline-banner"
          className={`fixed top-0 left-0 right-0 z-[80] px-4 py-2 text-center text-[12px] font-medium flex items-center justify-center gap-2 shadow-sm ${
            isOnline
              ? "bg-green-700 text-white"
              : "bg-amber-600 text-white"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>Back online — you're all set.</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>
                You're offline. You can keep browsing, but cart and checkout will resume when you reconnect.
              </span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
