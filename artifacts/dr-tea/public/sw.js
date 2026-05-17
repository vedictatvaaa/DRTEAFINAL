/* Dr Tea service worker — offline shell + image caching */
const VERSION = "v2";
const SHELL_CACHE = `drtea-shell-${VERSION}`;
const IMAGE_CACHE = `drtea-images-${VERSION}`;
const RUNTIME_CACHE = `drtea-runtime-${VERSION}`;
const CATALOG_CACHE = `drtea-catalog-${VERSION}`;
// Catalog responses (prices, stock, etc) are only served from cache when the
// network is unavailable AND the cached copy is no older than this TTL. Past
// the TTL the SW returns a fresh network error so the app can render its
// "offline / stale" state instead of misleading the shopper with stale data.
const CATALOG_FRESH_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CATALOG_TIMESTAMP_HEADER = "x-drtea-cached-at";

const BASE = new URL(self.registration.scope).pathname;

// `__PRECACHE_MANIFEST__` is replaced at build time by
// `scripts/inject-precache.mjs` with the actual list of built assets.
// If someone runs a raw `vite build` (skipping the inject step), the
// placeholder remains as a string — we detect that and fall back to a
// minimal manifest so the SW still installs without crashing.
const __MANIFEST__ = "__PRECACHE_MANIFEST__";
const RELATIVE_SHELL_ASSETS = Array.isArray(__MANIFEST__)
  ? __MANIFEST__
  : [
      "",
      "index.html",
      "manifest.webmanifest",
      "favicon.svg",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
    ];

const SHELL_ASSETS = RELATIVE_SHELL_ASSETS.map((p) => BASE + p);
const SHELL_INDEX = BASE + "index.html";
const SHELL_ROOT = BASE;

const isCoreAsset = (relPath) =>
  relPath === "" ||
  relPath === "index.html" ||
  /^assets\/index-[^/]+\.(js|css)$/.test(relPath);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(async (cache) => {
        await Promise.all(
          RELATIVE_SHELL_ASSETS.map(async (relPath) => {
            const url = BASE + relPath;
            const req = new Request(url, { cache: "reload" });
            try {
              await cache.add(req);
            } catch (err) {
              if (isCoreAsset(relPath)) {
                // Re-throw so the SW install fails loudly and the
                // browser will retry rather than ship a half-cached shell.
                throw err;
              }
              // Optional shell assets (icons, manifest) are best-effort.
            }
          }),
        );
      }),
    // NOTE: do NOT call self.skipWaiting() here. We let the new SW sit in
    // the "waiting" state until the user clicks Refresh on the in-app
    // update toast (which posts SKIP_WAITING). This makes updates
    // user-driven so dismissing the toast defers the new version to the
    // next visit.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== SHELL_CACHE &&
                key !== IMAGE_CACHE &&
                key !== RUNTIME_CACHE &&
                key !== CATALOG_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
    // NOTE: do NOT call self.clients.claim() here. We want existing
    // pages to keep using the old SW until the user accepts the update
    // (or reloads on the next visit). The new SW will start controlling
    // pages on the next navigation/reload after activation.
  );
});

const isImageRequest = (request) => {
  if (request.destination === "image") return true;
  const url = new URL(request.url);
  return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname);
};

const isFontRequest = (request) => {
  if (request.destination === "font") return true;
  const url = new URL(request.url);
  return (
    /\.(woff2?|ttf|otf)$/i.test(url.pathname) ||
    url.hostname === "fonts.gstatic.com"
  );
};

const isStyleOrScript = (request) =>
  request.destination === "style" ||
  request.destination === "script" ||
  request.destination === "worker";

const isCatalogRequest = (url) =>
  url.origin === self.location.origin &&
  /\/api\/catalog\//.test(url.pathname);

const stampedResponse = (response) => {
  // Clone headers and tag the response with a cache timestamp so we can
  // enforce a TTL when serving from cache later.
  const headers = new Headers(response.headers);
  headers.set(CATALOG_TIMESTAMP_HEADER, String(Date.now()));
  return response
    .clone()
    .blob()
    .then(
      (body) =>
        new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        }),
    );
};

const isFreshEnough = (cachedResponse) => {
  if (!cachedResponse) return false;
  const ts = Number(cachedResponse.headers.get(CATALOG_TIMESTAMP_HEADER));
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= CATALOG_FRESH_TTL_MS;
};

// Network-first with a short TTL fallback. Always tries the network first so
// shoppers see the latest prices/stock when online; falls back to a recent
// cached snapshot only when the network fails AND the snapshot is still
// within `CATALOG_FRESH_TTL_MS`.
const networkFirstWithTtl = async (request) => {
  const cache = await caches.open(CATALOG_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      const stamped = await stampedResponse(fresh);
      cache.put(request, stamped.clone()).catch(() => undefined);
      return stamped;
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (isFreshEnough(cached)) {
      return cached;
    }
    // Drop the stale entry so we don't keep serving it.
    if (cached) cache.delete(request).catch(() => undefined);
    throw err;
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type !== "opaque") {
        cache.put(request, response.clone()).catch(() => undefined);
      } else if (response && response.type === "opaque") {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle http(s)
  if (!url.protocol.startsWith("http")) return;

  // Navigation requests — network first, fall back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put(SHELL_INDEX, copy))
            .catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match(SHELL_INDEX)) ||
            (await cache.match(SHELL_ROOT)) ||
            Response.error()
          );
        }),
    );
    return;
  }

  // Catalog API — network-first with short TTL cache fallback
  if (isCatalogRequest(url)) {
    event.respondWith(networkFirstWithTtl(request));
    return;
  }

  // Same-origin images — stale-while-revalidate
  if (isImageRequest(request) && url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // Cross-origin fonts (Google Fonts) — stale-while-revalidate
  if (isFontRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Same-origin static assets (JS/CSS) — stale-while-revalidate
  if (isStyleOrScript(request) && url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // Google Fonts stylesheet
  if (url.hostname === "fonts.googleapis.com") {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ── Web push (Task #30) ──────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let payload = { title: "Dr Tea", body: "A fresh brew is steeping.", url: "/" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Dr Tea", {
      body: payload.body || "",
      icon: BASE + "icon-192.png",
      badge: BASE + "icon-192.png",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            client.focus();
            client.postMessage({ type: "navigate", url: target });
            return;
          }
        } catch {
          // ignore malformed client urls
        }
      }
      return self.clients.openWindow(BASE.replace(/\/$/, "") + target);
    }),
  );
});
