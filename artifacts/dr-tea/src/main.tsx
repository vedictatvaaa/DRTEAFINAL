import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  const emitUpdate = (registration: ServiceWorkerRegistration) => {
    window.dispatchEvent(
      new CustomEvent<ServiceWorkerRegistration>("dr-tea:sw-update", {
        detail: registration,
      }),
    );
  };

  const watchInstalling = (
    registration: ServiceWorkerRegistration,
    worker: ServiceWorker | null,
  ) => {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (
        worker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        emitUpdate(registration);
      }
    });
  };

  navigator.serviceWorker
    .register(swUrl, { scope: import.meta.env.BASE_URL })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        emitUpdate(registration);
      }
      watchInstalling(registration, registration.installing);
      registration.addEventListener("updatefound", () => {
        watchInstalling(registration, registration.installing);
      });
      // Reload once the new SW takes control after SKIP_WAITING.
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        try {
          sessionStorage.setItem("dr-tea:just-updated", "1");
        } catch {
          /* ignore */
        }
        window.location.reload();
      });
    })
    .catch((err) => {
      console.warn("Dr Tea service worker registration failed:", err);
    });
}
