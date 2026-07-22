# Events Audit — Open Questions Register

A living list. Questions get an ID and are **never deleted** — when answered,
the status flips and the answer (with evidence) is recorded inline, so the
reasoning trail survives. Add new questions at the bottom of the relevant
section with the next free ID.

**Statuses:** `OPEN` · `ANSWERED` · `PARTIAL` · `WONT-ANSWER` (with reason)

**Refresh 2026-07-22 (HEAD `da98fcf2`):** Q10 reverted PARTIAL→OPEN and Q11's
remediation note corrected — the R-series patches were never merged into
Discovery-imai (see REFRESH-NOTES.md §1). New evidence added to Q3, Q9, Q22,
Q23, Q24, Q28. New Q29 added.

---

## How to answer the top blockers (cheat sheet)

- **Q1** is a one-minute job for anyone with SSH to `discovery-prod`
  (GCP project "Leaders Prod" → Compute Engine):
  `grep -h "WEBHOOK" ~/Discovery-imai/backend/main/.env ~/Discovery-imai/proxy/.env ~/Discovery-imai/backend/social-listening/.env`
  — grab `PIXEL_DB_*` from backend/main/.env in the same pass (answers Q3's
  host half), and run `git status`/`git log -1` in the checkout for Q29.
- **Q2/Q3** need AWS console access (whoever owns the eu-central-1 account).
- **Q6** needs a Close login for IMAI's Close org (not NewVoices).

---

## A. Pipeline infrastructure (Sprint 1)

| ID | Question | Why it matters | How to answer | Status |
|----|----------|----------------|---------------|--------|
| Q1 | What URL is in `CLOSE_WEBHOOK_URL` (and every `CLOSE_WEBHOOK_URL_<LABEL>`, `CANCELLATION_WEBHOOK_URL`) in prod? | Identifies the receiver of ALL named server events — decides whether the Mixpanel/Klaviyo/Close fan-out is AWS, make.com, or something else. Single highest-leverage unknown. | SSH to `discovery-prod`, grep the three services' `.env` files (see cheat sheet). | OPEN |
| Q2 | What Lambda(s)/integrations sit behind API Gateways `d-gnyi890n7g` (t.imai.co) and `47dwgl20q6` (eu-central-1), and what do they write to? | Confirms the AWS ingestion path into the logs DB; locates the pixel-collector source code. | AWS console → API Gateway (eu-central-1) → integrations; check Lambda env vars for DB targets. | OPEN |
| Q3 | Where does the logs/"pixel" Postgres DB run (AWS RDS? GCP? a VM?), and who owns it? | Retention/backup/access policy for the canonical event store; needed before Sprint 4 data-quality work. | AWS/GCP console, or resolve the host in `USAGE_AI_LOGS_DB_URL` from prod env. **New evidence 2026-07-22:** backend/main connects to it directly via `PIXEL_DB_HOST/USER/PASSWORD/NAME` (campaigns.service.ts:1114, `pixelDB()`) — the host is one grep away in backend/main's prod `.env` (fold into the Q1 SSH session). It also hosts `phyllo_webhooks` (Phyllo creator-auth webhooks), so it is an *ingestion* target for a third party, not only the event store. | OPEN |
| Q4 | What job syncs `imai_events` → Mixpanel, on what schedule, and what sets `user.mixpanel_sync` (prod user table)? | The entire "events → Mixpanel" documentation depends on it; explains the known lag/loss. | Likely visible from AWS console (Q2) or from whoever administers Mixpanel; also check make.com scenarios. | OPEN |
| Q5 | What mechanism mirrors events into Klaviyo (7 metrics + ~97 event-named lists), and why does ~1 in 10 events reach neither list? | Klaviyo flows are the lifecycle-email automation bus; the loss rate affects email targeting. | Klaviyo admin → integrations/API logs; or answered implicitly by Q1. | OPEN |
| Q6 | Which system emits the orphan events `high_value_signup`, `scheduled_demo_*`, `scheduled_ai_agent_call*` (found in imai_events/Klaviyo, no emitter in repo)? | Without the emitter these events can't be documented or trusted; likely Close automations, make.com, or Calendly webhooks. | IMAI Close org (⚠ the session's Close connector reaches the NewVoices org, not IMAI's) + make.com account. | OPEN |
| Q7 | Are there GitHub repos this integration can't see that hold the pixel-collector / webhook-receiver / Mixpanel-sync code? | Reading the code beats console reverse-engineering. Only `Discovery-imai` is visible today. | GitHub org owner lists org repos; grant integration read access to any pipeline repo. | OPEN |
| Q8 | What are `backend/scraper` and `backend/frontend-logger` (referenced by deploy/deploy.js, present on the prod VM, absent from the repo)? Does frontend-logger receive the frontend `/logger/log` error events? | Two running services outside version control; frontend-logger is plausibly part of the logging/eventing picture. | Look on `discovery-prod` VM (`~/Discovery-imai/backend/scraper`, `backend/frontend-logger`); consider committing them. | OPEN |

## B. Event semantics & taxonomy (Sprint 2)

| ID | Question | Why it matters | How to answer | Status |
|----|----------|----------------|---------------|--------|
| Q9 | `created_campaign` AND `campaign_created` both fire on campaign creation (campaigns.controller.ts:339, :356 — re-verified at `da98fcf2`). Intentional or a bug? Which do downstream consumers key on? | Double-counting risk in Mixpanel/Klaviyo funnels; taxonomy cleanup candidate. | Check imai_events volumes for both names (needs logs DB, Q3) + ask whoever built the Close/Klaviyo automations. | OPEN |
| Q10 | Is the proxy emitter's missing NODE_ENV gate intentional? | Staging/dev could pollute imai_events/Mixpanel search counts. | ⚠ **Correction 2026-07-22:** the R1 gate previously recorded here as "added 2026-07-20" was never merged — at HEAD `da98fcf2` `proxy/index.js:112 sendPipeDriveWebhook` has **no environment gate at all**. Merge/deploy the R1 patch through the normal repo flow (or re-author against HEAD), then confirm nothing relied on staging emission. | OPEN |
| Q11 | The GA4 Measurement Protocol `purchase` call (payments.service.ts:1789-1810) uses a hardcoded `client_id` AND `api_secret` and fires only for prices {99, 499, 1200}, ungated. Intentional scope? Which report consumes it? | Hardcoded client_id collapses purchases onto one synthetic GA4 user; price allowlist silently drops other plans. | ⚠ **Correction 2026-07-22:** the R2 patch ("prod+!dev gate, env-based ids/secret") was never merged — HEAD still has the hardcoded inline values. Merge R2, then ask marketing what consumes it; check GA4 property. | OPEN |
| Q12 | Who consumes the `email`/`name` enrichment on webhook events, and is PII in the event stream (email, ip in imai_events; email in GTM dataLayer/Clarity) reviewed for GDPR/consent? | Compliance + informs whether payloads can be slimmed. | Product/legal review; part of Sprint 3 task 4. | OPEN |
| Q13 | White-label events: emitters strip `whiteLabelId` and some labels route to `CLOSE_WEBHOOK_URL_<LABEL>` — where do those go, and should white-label traffic be tagged rather than stripped? | Reseller traffic is best-effort-invisible in analytics today (known gap in SCHEMA.md). | Q1 answers the routing; tagging is a Sprint 5 remediation proposal. | OPEN |
| Q14 | 30/90-day volume + payload fill-rate per event to validate the dictionary (which documented events are dead? any undocumented events in imai_events not covered?). | Turns the code-derived dictionary into a verified one; Sprint 2 exit criterion. | Read-only logs-DB access (Q3): `SELECT event, count(*) FROM imai_events WHERE date >= current_date - 90 GROUP BY 1 ORDER BY 2 DESC`. Also checks Q29 (`created_list` rows would prove out-of-band deployment). | OPEN |

## C. Client-side & marketing tags (Sprint 3)

| ID | Question | Why it matters | How to answer | Status |
|----|----------|----------------|---------------|--------|
| Q15 | What tags live inside GTM containers `GTM-PBZ6TBF` and `GTM-5TRH876J` ("LEADERS"), and is the second container intentional? | The dataLayer events are only half the story — GTM decides what actually fires where; dual containers double-fire risk. | GTM admin access → export both container configs. | OPEN |
| Q16 | Is the Segment ("PRophet") integration (write key `sW20Nx…`, identify-only, no track calls) still in use, and what workspace consumes it? | Dead tag = remove; live tag = document destination. | Segment workspace admin. | OPEN |
| Q17 | Why does the OLD AWS pixel fire on trial activation + influencer search specifically (home.component.ts:116, influencers.component.ts:351)? What does its collector store, keyed how? | These are the highest-value funnel moments; their data feeds attribution (gclid capture) but the storage schema is unknown. | Q2 (Lambda code) or logs-DB inspection (Q3). | OPEN |
| Q18 | VWO account 1044481 — active experiments? Clarity project `kaw00ybizl` — retention settings and who reviews recordings? | Complete the marketing-tag inventory (Sprint 3). | VWO/Clarity admin logins. | OPEN |

## D. Destinations (Sprint 4 — will grow)

| ID | Question | Why it matters | How to answer | Status |
|----|----------|----------------|---------------|--------|
| Q19 | Mixpanel: full event/property inventory, identity-resolution rules (user_id vs email vs main_user_id), measured sync lag & loss per event. | Core Sprint 4 deliverable; today "lossy + lagging" is anecdotal. | **Inventory DONE 2026-07-20 via Mixpanel connector** (104 events + 30d volumes — 07-destinations.md §1.0). Remaining: identity rules, lag/loss measurement (needs logs-DB counts to diff against, Q3). | PARTIAL |
| Q24 | What emits the Title-Case Mixpanel namespace (`Platform Usage` 1.6M/30d, `Influencer Report`, `Login`, `Campaign Media Scraped`, …)? NO emitter exists in the codebase — a second live pipeline. | It's the HIGHEST-volume tracking on the platform and completely undocumented; several names duplicate snake_case events (double-count hazard). | **PARTIAL 2026-07-21 (property forensics):** `Payment Attempt`/`Added Payment Method` carry Stripe-native props (Card Fingerprint, Payment Intent, Receipt URL, Brand/Valid) → a **Stripe→Mixpanel integration**. `Platform Usage`/`Login`/`Influencer Search`/`Influencer Report` carry `$import: true` + internal props (`Cost`, `Report ID`, `Influencers Found`) → a **server-side /import batch job** from internal usage data. Re-confirmed 2026-07-22: no such code anywhere in Discovery-imai at `da98fcf2`. Remaining: identify the job/service account (Mixpanel project settings → service accounts, or Q1/Q2). | PARTIAL |
| Q25 | Why do `Influencer Search` (11,118/30d) and `influencer_discovery_search` (18,765/30d) differ by 41% if they describe the same action? | Whichever a dashboard uses changes search KPIs by nearly half. | Compare property sets and a per-user sample of both events; likely different definitions (UI-only vs UI+API, or dedup). ⚠ Note: the 2026-07-21 trial search-session window changes trial search *quota counts* but not the webhook event — don't confuse it with this gap. | OPEN |
| Q26 | The social-listening event family, `pr_sent_pitch`, `first_campaign_created`, and several trial events never reach Mixpanel (present in code + presumably imai_events). Where does the sync drop them? | Whole product areas invisible in Mixpanel. | Answered by the sync job's config (Q4); verify against imai_events once logs-DB access lands. | OPEN |
| Q27 | The webhook→Mixpanel sync strips ALL payload properties: `free_trial_blocked`, `payment_failed`, `cancel_trial`, `new_subscription_payment`, `Cancelled Subscription` carry ZERO custom event properties in Mixpanel (defaults only; measured 2026-07-21). Does the sync drop payloads by design, and can the `free_trial_blocked` error payload be forwarded? | Property-level analysis (block reasons, failure codes, plan on conversion) is impossible in Mixpanel today — the §7.3 abuse-gate audit had to fall back to geo proxies. Same fix likely unlocks price-point breakdowns. | Same owner as Q4 (the sync job). Interim: run payload analyses on the logs DB (Q3). Remediation candidate: forward `error` + `plan`/`amount` props in the sync. | OPEN |
| Q28 | Is the Stripe→Mixpanel integration (`Payment Attempt`/`Added Payment Method`) COMPLETE — every Stripe charge, full history, no gaps? And which plans do the undocumented price points ($599, $959, $175) map to? | The 2026-07 sales-funnel report §dollars is built on it: gross Stripe revenue shows a ~55% decline Nov 2025→Jun 2026 ($150.8k→$67.3k/mo) with revenue/payer falling $874→$565. If the integration has gaps or a start-date artifact, that trend is wrong. Amount unit validated as whole USD; failed charges log $0. | Compare 2-3 months of Mixpanel sums vs the Stripe dashboard (whoever owns Stripe); confirm price points against current pricing config. Also check whether Cardcom charges appear anywhere in Mixpanel (believed absent). **Code sweep 2026-07-22:** the price points are NOT code-configured — packages are DB rows. In-code literals: $599 only in the DoReel white-label seed (`1739300000001-SeedDoReelWhiteLabel.ts`, Growth default w/ 7-day trial), $959 only in stale de/es trial i18n copy ("full feature set at $959/month"), $175 nowhere → plan↔price mapping needs the prod `package`/`package_limit` tables or Stripe. | PARTIAL |
| Q20 | Which Mixpanel reports/boards does the team actually use (health score is replicated in-code at usage-ai/services/usage-board.service.ts:1909 — what else)? | Tells us which events MUST stay stable through any taxonomy cleanup. | **Inventory DONE 2026-07-21 via connector: 62 dashboards.** Notable: `North Star`, lifecycle set (`Acquisition`/`Conversion`/`Retention`/`Adoption`), monthly "IM.AI - Monthly New Users, Retention and Churn" series (Jul 2025–Jan 2026 — apparently discontinued after 01/26), `Free Trial Abuse` (Robby Frank, 2024 — multi-signup abusers, "charge them"), `IMAI Trial → Customer Prediction` + `IMAI Retention Prediction`, `Caras - Payment Analytics Dashboard` + `Caras - User Journey Overview` (Jonathan Caras, created 2026-07-20), ~15 personal "Your Board"s. Remaining: actual usage/view stats and which drive decisions (ask team). | PARTIAL |

## E. Conversion pixel & misc (Sprint 3+)

| ID | Question | Why it matters | How to answer | Status |
|----|----------|----------------|---------------|--------|
| Q21 | Which conversion-ingestion path is canonical: the Bubble `wf/order-conversion-*` workflows or `/tracking/conversion` (both are presented in the in-app tutorial)? Is the Bubble path still consumed? | Two live ingestion paths for customer conversions = split data + double maintenance; deprecation decision needed (R15). | Ask whoever owns the Bubble app; check Bubble workflow run logs vs `CampaignInfluencerConversions` rows. | OPEN |
| Q22 | proxy/index.js computes `allowedDomains` with `NODE_ENV === "prod"` (never true — the proxy runs `production`), but the `cors()` origin option is commented out so CORS is fully open. Is open CORS intentional, or should the allowlists (and the env check) be restored? | Dead config + fully open CORS on the billing/auth proxy; the allowed-domain.prod.js list (59 origins) is maintained but unused. | Ask platform team; if allowlist should be live, fix the env check to `production` and uncomment `origin`. (Re-verified unchanged at `da98fcf2`: index.js:23-24 env check, :34-38 commented origin.) | OPEN |
| Q23 | backend/main never sets Express `trust proxy` — `@Ip()` (tracking attribution, logging) returns the immediate upstream (LB/nginx) address, not the client's. What does prod topology actually deliver, and should trust proxy be enabled? | Blocks R14 (removing the SDK's client-side ipify lookup); may also skew any IP-based logic in the backend. | Inspect prod nginx/LB config (X-Forwarded-For) on discovery-prod; then set `app.set('trust proxy', ...)` accordingly. (Re-verified at `da98fcf2`: no trust-proxy setting anywhere in proxy or backend/main.) | OPEN |

## F. Repo/deploy state (added 2026-07-22)

| ID | Question | Why it matters | How to answer | Status |
|----|----------|----------------|---------------|--------|
| Q29 | Were the `discovery-imai-patches/` remediations (R1 proxy gate, R2 GA4 gating, R8 env-first secrets, R16 `created_list`, R21 CI spec) ever deployed to prod **out-of-band**? None are merged into Discovery-imai at `da98fcf2`, yet the audit docs recorded them as "Done 2026-07-20". | Decides whether prod behavior matches the repo (this map) or the patched docs; if prod runs unpushed code, the deploy process has a drift problem worth flagging on its own. | On `discovery-prod` (same SSH as Q1): `git -C ~/Discovery-imai status` + `git log -1`; and once logs-DB access lands (Q3/Q14): `SELECT count(*) FROM imai_events WHERE event='created_list'` — any rows prove out-of-band deployment. | OPEN |

---

## Answered

(move rows here with the answer + evidence when resolved)

| ID | Question | Answer | Evidence | Date |
|----|----------|--------|----------|------|
| Q-A1 | Is `t.imai.co` AWS? | Yes — API Gateway custom domain `d-gnyi890n7g.execute-api.eu-central-1.amazonaws.com`. | DNS probe 2026-07-20 (01-architecture.md §2). | 2026-07-20 |
| Q-A2 | Does anything in the codebase write to Mixpanel or AWS directly? | No — Mixpanel only via external sync; AWS only the pixel collector + S3 script bucket. | Repo-wide sweeps (EVENTS_AUDIT_PLAN.md Part 1); re-confirmed at `da98fcf2` 2026-07-22. | 2026-07-20 |
| Q-A3 | Where does the platform itself run? | GCP end-to-end: GCE `discovery-prod`/`discovery-stag` ("Leaders Prod"), Cloud Run campaign-tracker, GCS storage; Bubble behind Cloudflare for `api.influencermarketing.ai`. | deploy/readme.md + DNS probes. | 2026-07-20 |
