# 05 — GTM Container Audit (Sprint 3)

**Status:** BLOCKED on GTM admin access ([Q15](./OPEN_QUESTIONS.md)) — this
doc records what is knowable from code and the exact procedure to finish it.

## What we know without access

| | Container 1 | Container 2 |
|---|---|---|
| ID | `GTM-PBZ6TBF` | `GTM-5TRH876J` |
| Loaded | index.html:26 (+ noscript :135) | index.html:40 (+ noscript :141), commented "LEADERS" |
| Scope | every page, every domain (incl. white-labels) | same |

Both consume the same `dataLayer`, which receives exactly three event names
from code (`successful_signup`, `successful_trial_started`,
`successful_onboarding_completed` — see 04 §2) plus whatever GTM itself
derives (page views, clicks, scroll triggers we cannot see from here).

Also in the page, outside GTM: gtag.js `AW-17928663214` (Google Ads),
GA4 `G-TD1DHH379G` via ngx-google-analytics, Clarity, Segment, VWO — so GTM
is NOT the single tag manager; any audit must reconcile duplicates between
in-code tags and GTM-injected tags (e.g. a second GA4/Ads tag inside GTM
would double-fire conversions).

"LEADERS" matches the GCP project name ("Leaders Prod") — the containers may
be split company-entity vs product, or one may be legacy. Unconfirmed.

## Completion procedure (30–60 min once someone has GTM access)

1. GTM → each container → **Export container** (Admin → Export) — attach the
   two JSON exports next to this doc (`gtm-PBZ6TBF.json`, `gtm-5TRH876J.json`).
2. For each container, fill the tables below from the export:
   - Tags: name, type (GA4/Ads/pixel/custom HTML), firing triggers, consumed
     dataLayer variables.
   - Triggers: which of the 3 code events are used; any all-pages/history
     triggers.
   - Custom HTML tags: full inventory (this is where surprise third parties
     hide — TikTok/Meta/LinkedIn pixels, CMPs, affiliate tags).
3. Answer: does either container send `email` from the dataLayer to any tag
   (Enhanced Conversions is the stated intent — confirm scope)?
4. Answer: is `GTM-5TRH876J` still needed? Recommendation + owner.
5. Update Q15 in OPEN_QUESTIONS.md with findings; fold conclusions into
   04-frontend-analytics.md §7/§8.

## Template to fill

### Container GTM-PBZ6TBF
| Tag | Type | Trigger(s) | Variables used | Sends PII? |
|---|---|---|---|---|
| _pending export_ | | | | |

### Container GTM-5TRH876J ("LEADERS")
| Tag | Type | Trigger(s) | Variables used | Sends PII? |
|---|---|---|---|---|
| _pending export_ | | | | |
