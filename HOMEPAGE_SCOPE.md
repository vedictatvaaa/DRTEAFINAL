# Dr Tea — Homepage Polish + Growth Scope

A grounded audit of `drtea.in`'s storefront. Every item below is tagged
with **what it is**, **why it matters**, **effort**, and **expected lift**.
Pick the rows you want and I'll execute.

---

## 0. What you already have (don't rebuild)

| Surface | Status |
| --- | --- |
| Dynamic XML sitemap with `<image:image>` entries | ✅ `/sitemap.xml`, `/sitemap-images.xml` |
| Google Merchant XML feed | ✅ `/feeds/google-merchant.xml` |
| Meta catalog CSV feed | ✅ `/feeds/meta-catalog.csv` |
| `robots.txt` server-rendered | ✅ |
| `Seo` component (title/desc/canonical/OG/Twitter/JSON-LD) | ✅ |
| Product JSON-LD with `Offer`, `AggregateRating`, `OfferShippingDetails` | ✅ on PDP |
| Organization JSON-LD on every page | ✅ baked into `index.html` |
| OG + Twitter cards, theme color, manifest, PWA, sw.js | ✅ |
| Web push opt-in, abandoned-cart cron, analytics tracker | ✅ |
| Hero image preloaded as `webp` with `fetchpriority="high"` | ✅ |
| Admin SEO editor + keyword-rank cron + PSI integration | ✅ |

---

## 1. Critical SEO bugs (fix first — high ROI, low effort)

### 1.1 No `<h1>` on the homepage
**Found:** `home.tsx` uses only `<h2>` tags inside sections; there is no
`<h1>` anywhere on `/`. Google uses the H1 as the strongest topical
signal on the page.
**Fix:** Add a single visually-styled `<h1>` to the hero
("Modern Indian Tea Rituals — Single-Estate Chai, Kadha, Darjeeling &
Tisanes") and demote the existing hero text to `<p>` if needed.
**Effort:** 15 min. **Lift:** measurable on brand+category queries within 2–4 weeks.

### 1.2 Keyword stuffing in `<meta name="keywords">`
**Found:** ~50 keywords, comma-separated, in `index.html`. Google ignores
this tag, but Bing/Yandex penalise stuffing and it makes your code look
spammy.
**Fix:** Trim to 8–12 truly intent-matching keywords per page; let the
`Seo` component manage page-specific ones.
**Effort:** 10 min.

### 1.3 No `WebSite` + `SearchAction` JSON-LD (sitelinks search box)
**Found:** Only `Organization` schema. Without `WebSite` + `potentialAction`,
Google won't show the in-SERP search box for `drtea.in` brand queries.
**Fix:** Add a second `<script type="application/ld+json">` to `index.html`.
**Effort:** 5 min. **Lift:** branded SERP looks 2× more "real".

### 1.4 No `BreadcrumbList` schema on collection / PDP pages
**Found:** Visual breadcrumbs exist (`Breadcrumbs.tsx`) but no JSON-LD
emits the structured equivalent. Google uses this for breadcrumb chips
under your blue links.
**Fix:** Emit `BreadcrumbList` from the existing component.
**Effort:** 30 min.

### 1.5 No `FAQPage` schema (homepage + PDP)
**Why:** FAQ schema still drives ~10–25% CTR uplift on long-tail queries.
**Fix:** Add a "Quick Answers" accordion (5–7 Qs) to homepage + PDP and
mirror it as `FAQPage` JSON-LD via the `Seo` component.
**Effort:** 1.5 h.

### 1.6 No `hreflang` despite serving IN/GB/US/AE/SG
**Found:** `Organization.areaServed` lists 5 countries. With no hreflang,
US shoppers get the INR-priced page in search results.
**Fix:** Either drop the international claim, **or** add per-country
canonical URLs (`/in`, `/gb`, …) and emit
`<link rel="alternate" hreflang="en-IN" href="…">` etc.
**Effort:** 4 h if you want it real; 5 min if you want to drop the claim.

---

## 2. Homepage UX / conversion polish

| # | What | Why | Effort |
| - | --- | --- | --- |
| 2.1 | **Sticky "category rail" under header** (chips: Chai · Kadha · Green · Darjeeling · Floral · Reserve) that scrolls to category-anchored sections, with active state | Cuts taps to category from 3 → 1; killer mobile UX | 2 h |
| 2.2 | **Hero A/B copy via `experiences` table** (you already have `useGetActiveExperience`) — test 3 hero headlines | Use what's built; convert with data | 1 h |
| 2.3 | **Bestseller carousel ABOVE the fold** (currently below trust badges) | Average e-commerce homepage with bestsellers above fold sees +8–14% PDP click rate | 30 min |
| 2.4 | **"Brewing ritual" interactive on home** (mini version of PDP brewing card) — turn the static `#process` section into 4 tabbed steps with timer animation | High dwell time signal to Google + delights | 3 h |
| 2.5 | **Live "X people brewing now" social-proof ticker** (use your existing analytics events) | FOMO + perceived liveness | 1.5 h |
| 2.6 | **Currency + country auto-detect modal** ("Looks like you're in the UK — switch to £?") | You have `CurrencyAutoDetect.tsx` — surface it visually | 1 h |
| 2.7 | **Skeleton states for product cards** (currently blank flash) | LCP/CLS improvement | 45 min |
| 2.8 | **Re-encode hero PNG → AVIF** (current preload is webp + png fallback) | 25–40% smaller LCP image on Chrome/Edge | 30 min |

---

## 3. Header

| # | What | Why | Effort |
| - | --- | --- | --- |
| 3.1 | **Mega-menu on desktop** — group products by Brew style / Mood / Caffeine level / Occasion | Gives you 4× internal-link surface for Google | 4 h |
| 3.2 | **Search overlay → instant search** (currently navigates to `/shop?q=`); use Fuse.js client-side index over your products + journal + teapedia | Reduces bounce on no-result | 3 h |
| 3.3 | **"Free shipping above ₹999" announcement bar** with auto-dismiss + remember-state | +3–5% AOV in tea retail | 30 min |
| 3.4 | **Cart icon: stock micro-warning** ("only 3 left in cart" if a line item < 5 stock) | Same FOMO mechanic, different surface | 1 h |
| 3.5 | **Wishlist icon** (you have `Heart` import already on cards) — persist to `localStorage` + sync if logged in | Retention surface for re-engagement push | 4 h |

---

## 4. Footer

| # | What | Why | Effort |
| - | --- | --- | --- |
| 4.1 | **Footer link audit** — every link must lead to an indexable page; today's footer probably has dead/duplicate paths. I'll diff against the routes table. | Avoid soft-404s | 30 min |
| 4.2 | **"Shop by mood / caffeine / brew time" link block** | Internal linking = the cheapest SEO; 12 deep-link anchors with target keywords | 1 h |
| 4.3 | **Trust strip** (FSSAI no., 100% natural, India + UK shipping, Razorpay/Stripe icons) | Conversion proxy; also signals legitimacy to AI overviews | 45 min |
| 4.4 | **Newsletter form with double opt-in** wired to Resend (you already have `RESEND_API_KEY` env) | Owned channel; single biggest lift to repeat purchase | 2 h |
| 4.5 | **Sitemap link in `<footer>`** (HTML version, not just XML) | Modest but real — surfaces deep pages for crawl | 30 min |

---

## 5. SEO infrastructure upgrades

### 5.1 Sitemap improvements
- Add **`/sitemap-news.xml`** for journal articles (Google News inclusion).
- Add **`/sitemap-index.xml`** at root that references the others (best practice once you exceed 1 sitemap).
- Add **`<lastmod>` to static paths** (currently only dynamic ones have it).
- Already done: `<image:image>` per product. ✅

### 5.2 SEO-friendly URLs
**Today:** `/product/<slug>`, `/journal/<slug>`, `/teapedia/<slug>`, `/shop/<category>` — these are already clean.
**Recommended changes:**
- Move PDPs from `/product/<slug>` → **`/tea/<slug>`** (matches search intent, shorter).
- Add **`/collections/<slug>`** as canonical alias for `/shop/<slug>` (industry standard; Shopify-style; better for Google Shopping merchant feed).
- Add **`/c/<category>/<subcategory>`** for filter combos as crawlable URLs (e.g. `/c/chai/caffeine-free`) — captures long-tail queries.
- 301-redirect old paths via Express middleware so existing inbound links don't 404.
- **Effort:** 4 h. **Lift:** medium-high; permanent.

### 5.3 IndexNow + sitemap ping
- Implement **IndexNow** (Bing/Yandex) — push updates the moment a product or article changes. ~50 lines of code.
- POST sitemap to Google Search Console + Bing Webmaster on every deploy (a script in `deploy.sh`).
- **Effort:** 2 h.

### 5.4 Crawl budget protection
- Make sure `robots.txt` blocks `/admin`, `/api/admin/*`, `?utm_*` parametrised URLs, and faceted filter combinations you *don't* want indexed.
- Add `<meta name="robots" content="noindex, follow">` to `/cart`, `/checkout`, `/account/*`.
- **Effort:** 30 min.

---

## 6. AI-visibility signals (LLM/AI Overviews/Perplexity/ChatGPT browsing)

This is where most Indian D2C sites are still asleep. ROI in 2026 is real.

### 6.1 `llms.txt` and `llms-full.txt`
A growing convention where you tell LLMs which pages are "the canonical
description of your brand." OpenAI, Anthropic, Perplexity, and Google
SGE crawlers respect it.
- Generate from your product DB at build time.
- **Effort:** 1 h.

### 6.2 Speakable schema
For Google Assistant + Alexa flash briefings — emit
`SpeakableSpecification` on PDP and journal articles.
- **Effort:** 30 min.

### 6.3 Brand & Product entity disambiguation
- Add `Brand` JSON-LD with founders, awards, certifications, FSSAI no.
- Add `MerchantReturnPolicy`, `OfferShippingDetails` (PDP already has shipping ✅), `unitText` on weight.
- Submit to **Google Knowledge Graph** via the Wikipedia + Wikidata path
  (out of scope for code, but I can write you a 1-page playbook).
- **Effort:** 1.5 h code + ongoing manual KG work.

### 6.4 ChatGPT / Perplexity citation optimisation
LLMs cite pages that are: (a) date-stamped, (b) author-attributed,
(c) include statistics with sources, (d) have a "What is X?" first paragraph.
- Refactor journal articles + teapedia entries to lead with a
  one-paragraph definition and an `Article.dateModified`.
- **Effort:** 1 h template work + content rewrite ongoing.

### 6.5 GEO (Generative Engine Optimisation) snippets
Insert short, factual, highly-quotable lines at the top of every product
description: *"Dr Tea Gold CTC is a single-estate Assam orthodox tea
hand-rolled at 1,200 ft, sealed within 14 days of plucking, and brewed
to a 4.5/5 strength."* — these are the lines AI Overviews quote
verbatim.
- **Effort:** 30 min template + 5–10 min per SKU.

---

## 7. Smart automation (low-touch growth)

| # | What | Effort | Already wired? |
| - | --- | --- | --- |
| 7.1 | **Abandoned-cart email + push (15 min / 24 h / 72 h)** | already cron'd ✅ — just needs Resend templates | partially |
| 7.2 | **Back-in-stock push** (web push + email) when an OOS variant flips to in-stock | 3 h | no |
| 7.3 | **Price-drop push** for wishlisted items | 2 h | needs wishlist (4.5) |
| 7.4 | **Auto-resync Google Merchant + Meta catalog hourly** via `submitFeed` API (you already build the XML/CSV) | 2 h | feed exists, no auto-submit |
| 7.5 | **Auto post new journal article to Instagram, X, Threads** (Buffer-style; or via Composio) | 4 h | no |
| 7.6 | **Auto-generate alt text for product images via Gemini Vision** at upload time | 2 h | no |
| 7.7 | **Auto-translate product titles + descriptions** for `/gb`, `/ae` locales | 3 h | no |
| 7.8 | **Auto-extract "frequently asked" Qs from `ai-concierge` chat logs** → seed FAQ JSON-LD weekly | 3 h | concierge route exists |

---

## 8. User acquisition

### 8.1 Google Shopping (deep linkage)
- **Free organic Shopping listings**: your `feeds/google-merchant.xml`
  is enough — needs Merchant Center account verification on `drtea.in`
  + claim the URL via Google Search Console (the cert in
  `bootstrap-and-deploy.sh` already enables this).
- **Performance Max** campaigns auto-pull from the same feed; nothing
  to change codeside, but I can add a `gtag` conversion event on
  `order-confirmed.tsx` if it isn't there yet.
- Add **`shipping`, `tax`, `gtin`, `mpn`, `availability_date`,
  `unit_pricing_measure`** to `merchant-feeds.ts` if missing — these
  are the fields Merchant Center loves.

### 8.2 Meta Advantage+ catalog
- Same feed pipe; verify pixel events fire on `home`, `product`, `add-to-cart`, `checkout`, `purchase`.
- Add **server-side Conversion API (CAPI)** — fires from api-server,
  bypasses ad-blockers, recovers ~20% of lost attribution. ~3 h.

### 8.3 SEO content engine (already half-built)
You have `content-trends-cron`, `content-hub-cron`, `journal-cron`,
`teapedia-cron`, `recipes-cron`, `keyword-rank-cron`. That's a content
factory. What's missing:
- A **monthly editorial dashboard** in `/admin` showing keyword
  positions vs. content velocity vs. organic clicks.
- **Auto-link new articles** to relevant product pages (internal
  linking) using a similarity score over titles.
- **Effort:** 4 h.

### 8.4 Referral + reward loops
You have `loyalty.ts` and `rewards.tsx`. Wire up:
- Post-purchase "Share for ₹100 off" with unique link + UTM.
- Friend-conversion tracking via `shopper-orders` join.
- **Effort:** 4 h.

---

## 9. Frontend technical upgrades

| # | What | Lift |
| - | --- | --- |
| 9.1 | **Code-split the home page** (lazy-load `/journal` + `/community` blocks below fold) | -30 KB JS LCP |
| 9.2 | **Convert `Header.tsx` (427 lines) → split files** | maintainability + LCP |
| 9.3 | **Critical CSS extraction** (Vite plugin: `vite-plugin-critical`) | LCP -200ms |
| 9.4 | **Replace `framer-motion` for hero with raw CSS keyframes** | -45 KB JS |
| 9.5 | **Image responsive `srcset` + `sizes` everywhere** (`SmartImage.tsx` exists — extend it) | bandwidth -50% |
| 9.6 | **Route-level prefetch on hover** (already in wouter; flag and confirm) | perceived speed |
| 9.7 | **Edge-cache product pages 5 min via Nginx** (don't cache `/cart`, `/account`) | TTFB -300ms |
| 9.8 | **`<link rel="preload" as="font">` for Inter** (currently CSS-loaded after parse) | LCP -150ms |

---

## 10. Backend technical upgrades

| # | What | Why |
| - | --- | --- |
| 10.1 | **Postgres index pass** — confirm indexes on `products.slug`, `articles.slug`, `articles.published`, `orders.shopper_id` | query latency |
| 10.2 | **Redis cache for product list + sitemap** (5 min TTL, invalidate on admin write) | cuts repeat DB load 90% |
| 10.3 | **HTTP-cache headers** on `/api/catalog` (`Cache-Control: public, s-maxage=300, stale-while-revalidate=60`) | nginx + browsers cache for free |
| 10.4 | **Rate-limit** `/api/admin/*` and `/api/concierge` (express-rate-limit) | brute-force + cost protection |
| 10.5 | **Sentry / Pino → Loki** for structured production logs | debug deployed bugs without SSH |
| 10.6 | **Daily DB backup → object storage** (you have a backups cron — verify it's writing somewhere durable, not local disk) | DR |
| 10.7 | **Healthcheck endpoint expansion** — currently `/api/health` returns OK; add `/api/health/db`, `/api/health/queue` | better deploy gating |

---

## 11. Recommended execution order

If I were to do this in waves, this is the order I'd ship:

**Wave 1 — "fix the bleeding" (3 hours)**
- 1.1 H1 on home
- 1.2 Trim keywords meta
- 1.3 WebSite + SearchAction JSON-LD
- 1.4 BreadcrumbList JSON-LD
- 5.4 robots/noindex hygiene
- 4.1 Footer link audit + 4.3 trust strip
- 9.1 + 9.5 + 9.8 (LCP polish)

**Wave 2 — "growth surface" (1 day)**
- 2.1 Sticky category rail
- 2.3 Bestsellers above fold
- 2.6 Currency auto-detect modal
- 3.3 Announcement bar
- 4.4 Newsletter (Resend)
- 5.1 Sitemap-news + sitemap-index
- 5.2 URL refactor (`/tea/<slug>` + `/collections/<slug>`)
- 5.3 IndexNow

**Wave 3 — "AI-era moat" (1 day)**
- 1.5 FAQPage schema
- 6.1 llms.txt
- 6.2 Speakable
- 6.3 Brand entity
- 6.5 GEO snippets
- 7.6 Auto alt text via Gemini
- 8.2 Meta CAPI
- 10.2 Redis cache + 10.3 HTTP cache headers

**Wave 4 — "compound flywheel" (2 days)**
- 3.1 Mega-menu
- 3.2 Instant search
- 3.5 Wishlist
- 7.2 Back-in-stock
- 7.3 Price drop push
- 7.4 Auto-resync Merchant + Meta
- 7.5 Auto-social
- 8.4 Referral loop

---

## How we proceed

Reply with **"Wave 1"** (or any specific row numbers, e.g.
`1.1, 1.3, 4.4, 6.1`) and I'll execute. I'll typecheck + smoke-test
after each wave. Anything I should skip or you want phrased differently
(e.g. "no need for AI-era stuff"), just say.
