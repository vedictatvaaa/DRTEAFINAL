// One-off bulk image generator: 1 hero (lifestyle) image per product
// that doesn't already have a hero. Calls the admin generate-image endpoint
// so it benefits from auth, validation, ACL handling.
//
// Usage: node scripts/seed-product-hero-images.mjs
// Requires env: ADMIN_PASSWORD; api server running on PORT (default 8080)

const BASE = process.env.API_BASE ?? "http://127.0.0.1:8080";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD not set");
  process.exit(1);
}

const HERO_PROMPT = (name) =>
  `Premium product photography of a Dr Tea kraft-paper jar of ${name}, sitting on rustic warm-toned wood, soft golden window light, brass spoon and a few loose tea leaves nearby, shallow depth of field, lifestyle scene, the brown kraft jar clearly shows the wordmark "DR TEA" in elegant serif type, cinematic, 3:2 framing.`;

async function login() {
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("No cookie returned from login");
  const cookie = setCookie.split(";")[0];
  return cookie;
}

async function listProducts(cookie) {
  const res = await fetch(`${BASE}/api/admin/products`, { headers: { cookie } });
  if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function generateHero(cookie, product) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${BASE}/api/admin/products/${product.id}/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        kind: "hero",
        prompt: HERO_PROMPT(product.name),
        size: "1536x1024",
        alt: `${product.name} — lifestyle pack shot`,
      }),
    });
    if (res.ok) return res.json();
    const body = await res.text();
    const isRate = res.status === 502 && /RATELIMIT|429/i.test(body);
    if (!isRate || attempt === maxAttempts) {
      throw new Error(`Generate failed (${res.status}): ${body.slice(0,180)}`);
    }
    const wait = 8000 * attempt + Math.random() * 2000;
    await new Promise((r) => setTimeout(r, wait));
  }
}

(async () => {
  const t0 = Date.now();
  const cookie = await login();
  console.log("[ok] logged in");
  const products = await listProducts(cookie);
  console.log(`[info] ${products.length} products fetched`);
  const need = products.filter((p) => !(p.images ?? []).some((i) => i.kind === "hero"));
  console.log(`[info] ${need.length} need a hero image`);
  let done = 0, failed = 0;
  const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);
  let cursor = 0;
  async function worker() {
    while (cursor < need.length) {
      const idx = cursor++;
      const p = need[idx];
      const tStart = Date.now();
      try {
        await generateHero(cookie, p);
        done++;
        console.log(`[${done+failed}/${need.length}] ✓ ${p.id} — ${p.name}  (${((Date.now()-tStart)/1000).toFixed(1)}s)`);
      } catch (e) {
        failed++;
        console.error(`[${done+failed}/${need.length}] ✗ ${p.id} — ${p.name}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`[done] generated ${done}, failed ${failed} in ${((Date.now()-t0)/1000).toFixed(1)}s`);
})().catch((e) => { console.error("[fatal]", e); process.exit(1); });
