# 04 — Frontend Analytics & Marketing Tags (Sprint 3)

**Status:** Draft v1 — code audit 2026-07-20. GTM container internals pending
access ([Q15](./OPEN_QUESTIONS.md)); see [05-gtm-containers.md](./05-gtm-containers.md).

The Angular app (`front/imai`) runs **four independent client tracking layers**
plus Sentry (errors), VWO (A/B), and two first-party bridges to the backend.
All of these fire for **every white-label domain**, not just imai.co (Q12/Q15).

---

## 1. Layer inventory

| Layer | ID / key | Loaded from | Purpose |
|---|---|---|---|
| GTM container #1 | `GTM-PBZ6TBF` | index.html:26 | Tag orchestration (contents unknown — Q15) |
| GTM container #2 "LEADERS" | `GTM-5TRH876J` | index.html:40 | Second container, purpose unconfirmed (Q15) |
| Google Ads gtag | `AW-17928663214` | index.html:17 | Ads conversion tagging |
| GA4 via `ngx-google-analytics` | prod `G-TD1DHH379G` / dev `G-B1VM71MJ2V` | main.ts:198 (`environment.ga`) | Product funnel events |
| Microsoft Clarity | `kaw00ybizl` | runtime-injected by `AnalyticsService.init()` (app.component.ts:57); skipped on localhost | Session recording + custom tags |
| Segment ("PRophet Tag Manager") | write key `sW20Nx1r1a8BQcqQiHQdGSsSichtOjoE` | index.html:54 | identify-only (no track calls found) — Q16 |
| VWO | account `1044481` | main.ts:153 — **only when domain label === 'imai'** | A/B testing |
| Sentry | DSN in environment.prod.ts | main.ts:54 | Error monitoring (not analytics) |
| AWS visit pixel (OLD) | `t.imai.co` (API GW eu-central-1) | injected at trial activation (home.component.ts:116) + influencer search (influencers.component.ts:351) | Page-visit/attribution beacon → logs DB (see 01-architecture.md §1[B]) |

## 2. GTM dataLayer events (`GtmService.pushEvent`)

Only **four** call sites exist (gtm.service.ts:5 pushes `{event, ...data}`):

| Event | Where | Payload | Notes |
|---|---|---|---|
| `successful_signup` | registration.component.ts:106 (google), :435 (email) | `method`, `email` | ⚠ raw email into dataLayer (Enhanced Conversions per code comment) |
| `successful_trial_started` | credit-card.component.ts:261 | `user_id`, `transaction_id` (=user_id string), `value` (price), `currency:'USD'`, `email` | `transaction_id` doubles as dedup key vs a "server-side leg" (= the GA4 MP purchase? unconfirmed — Q11) |
| `successful_onboarding_completed` | onboarding.component.ts:412 | `user_id` | |

## 3. GA4 events (`$gaService.event`, co-fired with the funnel)

| GA event | Where | Category/label |
|---|---|---|
| `begin_checkout` | credit-card.component.ts:159 | payments / Trial checkout started |
| `credit_card_modified` | credit-card.component.ts:245; redirect.component.ts:29 | payments |
| `trial_success` | credit-card.component.ts:260; onboarding.component.ts:411 | payments / Subscribed to Free Trial |
| `payment_success` | credit-card.component.ts:269 (with price); redirect.component.ts:34 | payments |
| `credit_card_error` | credit-card.component.ts:350 | payments / error text |
| `payment_failure` | redirect.component.ts:43 | payments |
| `manual_upgrade_intercom` | packages.component.ts:143 | packages |
| `upgrade_package` | packages.component.ts:168 | packages / packageId |
| `google_signup` / `signup` | registration.component.ts:105 / :434 | registration |
| `email_verified` | registration.component.ts:462 | registration |

Plus the **server-side** GA4 Measurement Protocol `purchase`
(backend, payments.service.ts:1798 — see 03-emitters.md §4, Q11).

## 4. Microsoft Clarity custom tags (`AnalyticsService`)

`identify()` sends **email only** (the userId param is ignored — user-id
segmentation unavailable in Clarity today). `track(key, value)` maps to
`clarity('set', key, value)`, default value `'true'`.

| Tag | Where |
|---|---|
| identify(email) | authentication.service.ts:128; app.component.ts:141 |
| `Payment Success` | credit-card.component.ts:255; redirect.component.ts:33 |
| `New Signup` | registration.component.ts:86 |
| `Subscription Page` = JSON `{email, name, packageId, isDemo, hasActiveSubscription}` | packages.component.ts:109 |
| `Hype Search` | influencers.component.ts:605 |

## 5. Segment / "PRophet"

Loaded for all domains; the ONLY call is
`window['analytics'].identify(userEmail, {userId})`
(app.component.ts:114, invoked from refreshData :149). No `track()` calls
anywhere. Either a dormant integration or purely an identity feed for an
external "PRophet" tool — Q16.

## 6. First-party bridges (client → backend)

| Bridge | Endpoint | What |
|---|---|---|
| Trial-friction events | `POST /data/pipedrive/trial-event` (trial-gating.service.ts:53) | See 02-event-dictionary.md §5 and 03-emitters.md §2 — the client picks whitelisted server event names (`trial_upgrade_<placement>`, `trial_unlock_modal_opened`, `trial_book_call_*`, `trial_sample_report_viewed`). |
| Client error log | `POST /logger/log` (error-logging.service.ts:10) | Errors only (message/stack/userId); gated by `environment.enableLogger`; receiver is the server-only `frontend-logger` service (Q8). Not analytics. |

Note: `GET /data/log` (users.service.ts:233) is the in-app notification feed
— despite the name it is NOT event tracking.

## 7. Client ↔ server cross-map (the same user action, all destinations)

| User action | Client fires | Server fires | Dedup/consistency risk |
|---|---|---|---|
| Signup | GTM `successful_signup` (+email) · GA4 `signup`/`google_signup` · Clarity `New Signup` | webhook `signup` (+utm, phone) → E/M/K/C · Bubble ip-capture | Different names per tool; no shared id — cross-tool joins only by user_id/email. |
| Trial start | GTM `successful_trial_started` (transaction_id = user_id) · GA4 `trial_success` | webhook `new_subscription_trial` (+amount) · AWS visit pixel fires on the post-trial redirect (`?u=1`) | `transaction_id` dedup contract with the "server-side leg" unconfirmed (Q11). |
| First payment / renewal | GA4 `payment_success` (client) | webhook `new_subscription_payment` / `payment_success` · GA4 MP `purchase` (server, only prices 99/499/1200) | GA4 receives BOTH a client event and a server MP purchase — double-count risk inside GA4 (Q11). |
| Upgrade | GA4 `upgrade_package` | webhook `upgrade_package_payment` | |
| Onboarding done | GTM `successful_onboarding_completed` · GA4 `trial_success` (also fired here!) | webhook `finished_onboarding` | GA4 `trial_success` fires on BOTH credit-card and onboarding paths — inflates trial counts in GA4. |
| Search | — (Clarity `Hype Search` only for hype path) | proxy webhook `influencer_discovery_search` (+ AWS visit pixel on the search page) | |
| Trial friction | (UI only) | webhook trial_* via bridge | Client guard = trial users only; events deduped server-side once/day for limit family only. |

## 8. PII & white-label findings (input to Sprint 5)

1. **Raw email** goes into: GTM dataLayer (2 events), Clarity identify +
   `Subscription Page` tag, Segment identify, webhook events (by design),
   imai_events (stored), plus `ip` in imai_events and Bubble ip-capture.
2. **All ~50 white-label domains load IMAI's tags** (GTM ×2, GA4, Clarity,
   Segment; VWO is imai-only) — tenant users are tracked in IMAI's
   marketing tools. Their server events may route to per-label webhooks but
   client-side everything lands in IMAI properties (Q12, Q13, Q15).
3. Consent management: **none found in code** — no consent banner/CMP gating
   any tag. (If a CMP is injected via GTM, only the container export shows it
   — Q15.)
