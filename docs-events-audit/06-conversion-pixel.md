# 06 — Customer Conversion Pixel (Sprint 3)

**Status:** Draft v1 — code audit 2026-07-20.

This is the **customer-facing** system: IMAI's clients (brands) install it on
THEIR e-commerce stores so influencer-driven purchases can be attributed to
campaigns. It is completely separate from IMAI's own product analytics
(02/03/04) — but shares the word "pixel" with the legacy AWS visit collector
(01-architecture.md §1[B]) and the logs DB's nickname. **Three different
things called "pixel":**

| "Pixel" | What it is | Where data lands |
|---|---|---|
| Campaign conversion SDK (this doc) | `sdk/pixel.js` on customer stores | GCP backend → campaign tables (prod DB) |
| Legacy AWS visit pixel | `t.imai.co` / S3 `pixel.js` (373 B) | AWS API GW → logs DB (presumed) |
| "Pixel DB" | nickname for the logs Postgres (imai_events) | n/a |

---

## 1. Components

- **`sdk/pixel.js`** (v1.0.0, in-repo) — the tracking SDK customers embed.
  Served from `https://cdn.influencermarketing.ai/pixel.js` (GCP; see
  WooCommerce plugin) — NOT from t.imai.co/S3 (those serve the legacy visit
  beacon).
- **`sdk/influencermarketing-pixel/`** — Shopify **web pixel extension**
  (activated via Shopify OAuth + `webPixelCreate` GraphQL from the backend
  tracking module).
- **`sdk/plugins/imai-tracking-woocommerce/`** — WooCommerce plugin.
- **Backend receiver** — `backend/main/src/tracking/` (controllers
  `tracking.controller.ts`): public endpoints `POST /tracking/click`,
  `/tracking/sdk-click`, `/tracking/conversion`, `/tracking/ping`, plus
  Shopify OAuth/compliance webhooks. (Frontend-visible as `/data/tracking/*`.)
- **Bubble legacy endpoints** — `api.influencermarketing.ai/api/1.1/wf/
  order-conversion-shopify|woocommerce|eccommerce` (white-label:
  `api.igrdr.com`) — the older webhook path still shown in the in-app
  tutorial (conversionTutorial.component.ts:105-297) with copy-paste
  snippets (JS/PHP/Node/Python/curl/Java/Dart/C#) posting `auth_code`,
  `browser_ip`, `total_price`, `line_items`, `store_url`, `order_number`.
- **Per-campaign toggle** — `POST /campaign/:id/pixel` (campaigns.controller.ts:1534)
  flips `pixelActive`; UI requires `baseUrl`/domain + conversion value when
  active (campaignDetails.component.ts:579-586).
- **Domain allowlist** — `client_domains` table (`ClientDomain` entity):
  only authorized domains may send tracking data.

## 2. How the SDK works (sdk/pixel.js, verified by read)

**Identity & capture:**
- Click IDs arrive on the landing URL as `?imai_click_id=…` (set by IMAI's
  link redirector) or are generated locally (`imai_<ts>_<rand>`) when only a
  link shortcode `?imai_sc=…` is present.
- Stored in a **first-party cookie `_imai_clickid`** (default 30 days;
  overridable per-link via `?imai_cw=<N>d`, 1–365). Tracking params are
  scrubbed from the URL afterwards (history.replaceState).
- `?imai_env=local|stage` switches the API target (persisted in
  localStorage) — dev/test backdoor to be aware of.

**Calls to the backend:**
| Call | When | Payload highlights |
|---|---|---|
| `POST …/ping` | every SDK load | `domain, sdkVersion, userId` — powers "is the pixel installed" checks |
| `POST …/sdk-click` | when a shortcode is present | `clickId, landingUrl, referrer, linkShortcode, ip` (fetched from **api64.ipify.org** client-side!), browser/OS/device enrichment |
| `POST …/conversion` | order completion (auto or manual `imaiTrackConversion(orderData)`) | `clickId, orderId, amount, currency, coupon, lineItems[], platform` + device data; or a `rawData` passthrough variant; optional `X-API-Key` |

**Platform auto-detection:** shopify / woocommerce / magento / prestashop /
bigcommerce (with DOM heuristics); auto-tracking implemented for Magento
success pages and (partially) BigCommerce; Shopify handled by the web-pixel
extension; WooCommerce by the plugin.

## 3. Attribution chain (backend `AttributionService`)

Priority: **clickId → coupon code → IP fallback (24h window)**.
Conversions land in prod-DB campaign tables:
`CampaignInfluencerClicks`, `CampaignInfluencerConversions`,
`CampaignInfluencerConversionProducts` (registered cross-module from the
tracking module — a documented anti-pattern to revisit).

## 4. Findings / follow-ups

1. **Client-side IP lookup via third party** (api64.ipify.org) adds latency,
   a third-party dependency on customer stores, and PII flow — the server
   sees the request IP anyway; candidate for removal (Sprint 5 backlog).
2. **Two generations of conversion ingestion** (Bubble `wf/order-conversion-*`
   vs `/tracking/conversion`) are both live in the tutorial UI — which is
   canonical, and is the Bubble path still consumed? → added as **Q21**.
3. **`?imai_env` backdoor** lets anyone point a store's SDK at staging —
   harmless for customers but can silently blackhole real conversions if
   left set; consider prod-build stripping.
4. The Shopify compliance webhooks (GDPR endpoints) exist in
   tracking.controller.ts — good; verify they're registered per app store
   requirements when documenting the Shopify app (Sprint 5).
