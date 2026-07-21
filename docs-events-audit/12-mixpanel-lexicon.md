# 12 — Mixpanel Lexicon: Descriptions, Tags & Business Context

**Status:** Authored 2026-07-21 from `02-event-dictionary.md` + this session's
pipeline findings (Q24/Q27). **FULLY APPLIED to Mixpanel (project 3432835)
on 2026-07-21:** all 8 groups (102 events, descriptions + tags) and the
project business context. Spot-verified by read-back across all groups.
This file remains the source of truth for future edits.

Conventions: every event gets `description` + `tags`. Tags encode the
namespace/pipeline (`webhook-pipeline`, `stripe-integration`,
`server-import`, `crm-mirror`) and the functional family. The two Mixpanel
virtual events (`$session_start`/`$session_end`) keep their built-in
descriptions — do not touch.

---

## Group 1 — tags `lifecycle`, `webhook-pipeline` ✅ APPLIED 2026-07-21

| Event | Description |
|---|---|
| `signup` | Self-serve registration completed. Webhook pipeline (users.service.ts:3041 → imai_events → Mixpanel sync). Admin-created accounts skip this — exclude user_created_by_admin accounts from funnels. DUPLICATE-RISK: Title-Case 'Signup' is a separate import-pipeline event; don't mix in one KPI. |
| `user_created_by_admin` | Account created by an admin (sales-led). These accounts skip the self-serve funnel — exclude them from signup/trial funnels. Webhook pipeline (users.controller.ts:131). |
| `team_member_added` | Team member invited/added (2 code paths). Team members get their OWN user_id — roll up via main_user_id for account-level analysis. Webhook pipeline (users.controller.ts:219/:318). Overlaps import-pipeline 'Invited Team Member'. |
| `user_logged_in` | Login succeeded. The ONLY session proxy (there is no sessions table): sessions/day = logins/day. Webhook pipeline (users.controller.ts:1014). DUPLICATE: Title-Case 'Login' (import pipeline) reports slightly higher counts — pick one per KPI and say which. |
| `finished_onboarding` | Onboarding KYC completed — fires only if the invite-team-members step is reached. Onboarding is skippable (users can go straight to /trial), so this is NOT a mandatory funnel edge. Webhook pipeline (users.controller.ts:1770). |
| `scheduled_forced_onboarding_tehilla` | Forced-onboarding booking flow (users.service.ts:4468). Rep name baked into the event name — taxonomy-cleanup candidate. |
| `scheduled_forced_onboarding_shah` | Forced-onboarding booking flow, per-rep variant. No emitter found in the audited repo — presumed external automation (Close/make.com/Calendly — open question Q6). Rep name in event name: taxonomy-cleanup candidate. |
| `scheduled_onboarding_button_shah` | Onboarding call booked via button, per-rep variant. No emitter found in the audited repo — presumed external automation (Q6). Taxonomy-cleanup candidate. |

## Group 2 — tags `trial-lifecycle`, `webhook-pipeline` ✅ APPLIED 2026-07-21

| Event | Description |
|---|---|
| `Free Trial Signup` | Trial started (card accepted). RENAMED in Mixpanel from the webhook event new_subscription_trial (payments.service.ts:1634) — the snake_case name does not exist in this project. Trials are 7 days; trial-start anchor = min(date) per user. |
| `free_trial_blocked` | Card entered but user blocked by the trial abuse gate (payments.service.ts:1545; also fires a Slack alert). WARNING: the error/block-reason payload is stripped by the sync — no reason property exists here (Q27); reasons are only in the logs DB. ~20-35% of card-enterers get blocked (US 22%, UK 31%, PH 49%; Apr–Jul 2026). |
| `cancel_trial` | Active cancel while trial (endTrial) still set (users.service.ts:2190). BORN 2026-04-22 — before that, ALL trial cancels emitted cancel_subscription. Complete trial churn = union of both, deduped per user. Median active cancel ~4h into trial (mean ~39h). |
| `scheduled_trial_agent_call` | Trial user scheduled an (AI) agent call. No emitter found in the audited repo — presumed external automation (Close/make.com/Calendly, Q6). |

## Group 3 — tags `payments-churn`, `webhook-pipeline` ✅ APPLIED 2026-07-21

| Event | Description |
|---|---|
| `new_subscription_payment` | First real charge — trial→paid conversion, direct purchase, or renewal-cron conversion (payments.service.ts:500/:1710/:2210). THE conversion event. Can re-fire on re-subscription (~7% of payers) — 'first payment' = min(date) per user; dedupe. amount = whole USD (IL ×1.17 VAT on some paths) — never build dollar analysis on events. |
| `payment_success` | Recurring renewal charge succeeded (Stripe/Cardcom paths). PARTIAL COVERAGE — June 2026: captured ~57% of recurring charges but only 36% of dollars (misses big annual/enterprise renewals). Trend shape only; dollars live in prod user_payments. |
| `payment_failed` | Charge attempt failed (initial + Stripe/Cardcom renewals; payments.service.ts). Retry/dunning noise: ~6,000 events per 44 successes in a 3-week sample — ALWAYS count distinct users, never raw events. |
| `upgrade_package_payment` | Plan upgrade charged (Stripe/Cardcom). Counts as a payment event for prior-payment churn filters. Runs ~2-5 users/month — expansion is near zero; all upgrade-intent instrumentation is trial-only. |
| `duplicate_charge_prevented` | Idempotency guard blocked a double charge (payments.service.ts:2084). Operational, not behavioral (~169/30d). |
| `started_cancellation_process` | User entered the cancel flow — churn INTENT, many don't finish. Caveat: pollutes trial_analytics_report.cancel_date (that view counts any %cancel% event). |
| `Cancelled Subscription` | Cancel when endTrial NOT set. RENAMED in Mixpanel from webhook event cancel_subscription (users.service.ts:2190) — the snake name does not exist here. NOT 'paying churn' by itself: ~72% of last year's emitters were still trial users (legacy path). Paying churn requires a prior-payment EXISTS filter. |
| `cancel_subscription_after_ai_agent_call` | Cancel completed after an AI-agent retention call. Retention-flow marker; emitter in the cancel flow. |
| `deactivate_account` | Account deactivated (users.service.ts:2391). Webhook pipeline. |
| `refund` | Payment refunded. Low volume (~4/30d). Dollar amounts are NOT reliable from events — use prod user_payments. |
| `api_credits_added` | API credits added to an account. Not in the code-derived event dictionary — emitter unconfirmed. |
| `api_credits_renewed` | API credits renewed. Not in the code-derived event dictionary — emitter unconfirmed. |
| `reseller_customer_created` | Customer created under a reseller/white-label. Reseller linkage otherwise exists only via reseller_stripe_cuid — white-label traffic is largely untagged in analytics (known gap). |

## Group 4 — tags `product-usage`, `webhook-pipeline` ✅ APPLIED 2026-07-21

| Event | Description |
|---|---|
| `influencer_discovery_search` | User-initiated influencer discovery search (proxy index.js:292 + backend Influencer.controller.ts:53/:75/:97). Very high volume (~2.8M rows in logs DB) — aggregate, never scan. Health-score input. DUPLICATE-RISK: Title-Case 'Influencer Search' counts ~41% FEWER (Q25) — pick one per KPI and say which. |
| `influencer_discovery_search_paginated` | Pagination of a discovery search (proxy index.js:299). Volume event — excluded from most engagement definitions. |
| `report_creation_attempt` | Influencer report requested, before success/failure (report.controller.ts:93). Pair with report_creation_failed and 'Influencer Report' for failure-rate analysis. |
| `report_creation_failed` | Influencer report generation failed (report.controller.ts:101). Operational counterpart of report_creation_attempt. |
| `first_report_created` | First-ever report per user (quota.count===0; report.controller.ts:125). ACTIVATION MILESTONE — the canonical 'activated trial' definition. Feeds Klaviyo activation flows. |
| `first_list_created` | First-ever influencer list per user (quota.count===0; list.controller.ts:273). Activation milestone. |
| `created_geo_analysis` | Geo analysis created (geo.controller.ts:111). |
| `regenerated_geo_analysis` | Geo analysis re-run (geo.controller.ts:389). |
| `pr_journalist_search` | PR module: journalist search (journalist.controller.ts:60). Note: sibling pr_sent_pitch never reaches Mixpanel (Q26). |
| `pr_created_media_list` | PR module: media list created (entity-list.controller.ts:45). |
| `pr_generated_pitch` | PR module: pitch generated (pitch.controller.ts:70). pr_sent_pitch (the send) is missing from Mixpanel (Q26). |
| `influencer_added_to_campaign` | Influencer added to a campaign (campaigns.controller.ts:833; bulk API fires per item). Health-score input. Overlaps import-pipeline 'Added Tracked Campaign Influencer' naming family. |

## Group 5 — tags `trial-friction`, `webhook-pipeline` ✅ APPLIED 2026-07-21

Shared preamble for all 27 (prepend to each description): *"Trial-friction /
upgrade-intent event, BORN 2026-06-30 — any trend crossing that date is a
measurement change, not behavior change. Server-side family deduped once per
user+event per day."*

| Event | Description (after preamble) |
|---|---|
| `trial_unlock_modal_opened` | Unlock/upgrade modal shown — the highest-volume intent signal (~40% of July 2026 trials). Payload `source` is stripped in Mixpanel (Q27). |
| `trial_feature_blocked` | Gated feature attempted by a trial user (users.service.ts:1936). Payload (feature, cta) stripped in Mixpanel (Q27). |
| `trial_report_daily_limit_reached_day1` … `_day7` | Daily report quota hit on trial day N (N in the event name; users.service.ts:1713). Aggregate the 7 with LIKE 'trial_report_daily_limit_reached_day%'. |
| `trial_report_total_limit_reached` | Total trial report quota hit (users.service.ts:1702). |
| `trial_sample_report_viewed` | Sample report viewed by a trial user (feature: social_listening or campaign — stripped here, Q27). |
| `trial_book_call_sidebar` / `trial_book_call_top_bar` | Book-a-call CTA clicked (placement in name); opens Calendly. Fires ~3/month total — the CTA is nearly invisible; a known conversion-lever gap. |
| `trial_upgrade_clicked` | Generic upgrade click. Part of the trial_upgrade_* placement family — aggregate with LIKE 'trial_upgrade_%'. |
| `trial_upgrade_top_bar`, `trial_upgrade_sidebar_workspace`, `trial_upgrade_sidebar_operations`, `trial_upgrade_list_banner`, `trial_upgrade_search_banner`, `trial_upgrade_campaign_demo`, `trial_upgrade_report_download`, `trial_upgrade_report_add_to_list`, `trial_upgrade_influencer_report_banner`, `trial_upgrade_sl_list_banner`, `trial_upgrade_locked_403`, `trial_upgrade_limit_search_daily`, `trial_upgrade_limit_reports_daily` | Upgrade CTA clicked; the PLACEMENT is baked into the event name (frontend → whitelisted POST users/pipedrive/trial-event bridge, users.controller.ts:2382). Aggregate the family with LIKE 'trial_upgrade_%'. |

## Group 6 — tags `stripe-integration`, `payments` ✅ APPLIED 2026-07-21

| Event | Description |
|---|---|
| `Payment Attempt` | Stripe charge attempt — from a Stripe→Mixpanel integration, NOT product instrumentation (Stripe-native props: Status, Amount Charged, Card Fingerprint, Payment Intent, Receipt URL). Counts ALL charges incl. renewals and dunning retries — can exceed signups; do NOT use as a new-user funnel step. Filter Status='succeeded' for successful charges. Failure spikes track abuse waves (May 2026: 634 failed vs 120 succeeded). |
| `Added Payment Method` | Card/payment method saved — Stripe→Mixpanel integration (props: Brand, Valid, Last 4 Digits, Customer ID). Not emitted by platform code; the closest webhook-funnel analogue is Free Trial Signup (card accepted). |

## Group 7 — tags `server-import` ✅ APPLIED 2026-07-21

Verified `$import: true` on the first four; the rest share the namespace and
have no codebase emitter — presumed same import job (Q24, source unidentified).

| Event | Description |
|---|---|
| `Platform Usage` | Server-side batch import ($import) of internal usage records — THE highest-volume event (~1.6M/30d). Props: Cost (internal credit cost), Type, URL. No codebase emitter; source job unidentified (Q24). Not comparable to any webhook event. |
| `Login` | Server-side import. DUPLICATE of webhook user_logged_in (10,739 vs 10,275 in the same 30d) — pick ONE per KPI and document the choice. |
| `Influencer Search` | Server-side import of searches. DUPLICATE-RISK vs webhook influencer_discovery_search — 41% apart (11.1k vs 18.8k/30d, Q25: likely different definitions, UI-only vs UI+API). Pick one per KPI. |
| `Influencer Report` | Server-side import of report creation (props: Report ID, Influencer ID, Platform). Probably the import-side counterpart of webhook created_report, which is ABSENT from Mixpanel. |
| `Added Influencer to List` | Server-side import (list activity). Overlaps webhook created_list/first_list_created family. No codebase emitter (Q24). |
| `Created Influencer List` | Server-side import. Overlaps webhook created_list (born 2026-07, R16) and first_list_created. No codebase emitter (Q24). |
| `Created Campaign` | Server-side import. The webhook pair created_campaign/campaign_created (both fire — Q9) is ABSENT from Mixpanel; this import event is the only campaign-creation signal here. |
| `Created Campaign Requirements` | Campaign-tracker family, server-side import; no codebase emitter (Q24). |
| `Campaign Requirement Approval` | Campaign-tracker family, server-side import; no codebase emitter (Q24). |
| `Campaign Media Scraped` | Campaign-tracker family (media scraping per tracked influencer), server-side import; no codebase emitter (Q24). ~6.6k/30d. |
| `Campaign Chat Message` | Campaign-tracker family, server-side import; no codebase emitter (Q24). |
| `Campaign Invite` | Campaign-tracker family, server-side import; no codebase emitter (Q24). |
| `Added Tracked Campaign Influencer` | Campaign-tracker family, server-side import; overlaps webhook influencer_added_to_campaign. No codebase emitter (Q24). |
| `Bulk Contacts Export` | Contacts export, server-side import; no codebase emitter (Q24). |
| `Invited Team Member` | Server-side import. Overlaps webhook team_member_added — pick one per KPI. |
| `Signup` | Server-side import. DUPLICATE of webhook signup — do NOT mix; funnel work to date uses snake_case signup. |
| `Forgot Password` | Password-reset requested; server-side import namespace, no codebase emitter (Q24). |
| `Deleted Account` | Account deleted; import namespace. Distinct from webhook deactivate_account — relationship unverified. |
| `Intercom Conversation` | Support conversation — most plausibly an Intercom integration/import; no codebase emitter (Q24). Not product usage. |
| `Scheduled Meeting` | Meeting scheduled — presumed Calendly/CRM-sourced import (Q6/Q24). Not product usage. |

## Group 8 — tags `crm-mirror` ✅ APPLIED 2026-07-21

Shared description core: *"Close CRM pipeline-stage mirror written into
imai_events and synced here — NOT a product event; exclude from all
product-usage and funnel analyses. Stage names exist in BOTH the Sales and CS
pipelines — ambiguous without status_id (SCHEMA.md has the ids). Mirror
mechanism unknown (Q6)."*

| Event | Extra notes |
|---|---|
| `Qualification`, `Identification`, `Prospecting`, `Evaluation / Scoping`, `Discovery / Demo`, `Proposal / Buying`, `No Show`, `Lost` | Stage mirror only (shared core). |
| `Won` | Stage mirror. Deal won — but deal VALUE lives in Close; never infer revenue from this event. |
| `Won (Renewed/Expanded)` | Stage mirror. Renewal/expansion won — dollar truth in Close. |
| `scheduled_demo_morya`, `scheduled_demo_tom` | Demo scheduled with a specific rep — external automation (Q6). Rep name in event name: taxonomy-cleanup candidate. |
| `canceled_demo_scheduled_danielr`, `canceled_demo_scheduled_morya`, `canceled_demo_scheduled_shah` | Demo canceled, per-rep variant — external automation (Q6). Taxonomy-cleanup candidates. |
| `answered_scheduled_ai_agent_call` | AI-agent call answered — external automation (Q6). Retention/sales flow marker. |

---

## Project business context (for Update-Business-Context, level=project, id 3432835)

```
# IMAI (InfluencerMarketing.ai) — product analytics

Influencer-marketing SaaS. Self-serve plans $99/$499/$1200, 7-day free trial,
day-7 autocharge (~76% of self-serve conversions are the passive autocharge).
The MAJORITY of paying accounts are manual/enterprise deals managed in Close
CRM and are largely invisible in this project.

## Event namespaces — critical, do not mix in one KPI
1. snake_case = product webhook pipeline (backend → imai_events → synced
   here). The sync STRIPS ALL custom payload properties (only defaults
   arrive) and RENAMES: new_subscription_trial→'Free Trial Signup',
   cancel_subscription→'Cancelled Subscription'.
2. Title-Case usage events ('Platform Usage' ~1.6M/30d, 'Login',
   'Influencer Search', …) = server-side batch import ($import:true) of
   internal usage data; source job unidentified. Several DUPLICATE
   snake_case events: 'Login'≈user_logged_in, 'Influencer Search' vs
   influencer_discovery_search (41% apart), 'Signup'≈signup.
3. 'Payment Attempt'/'Added Payment Method' = Stripe integration; includes
   renewals + dunning retries — NOT new-user funnel steps.
4. Close pipeline stages ('Won', 'Qualification', …) = CRM mirrors, not
   product events.

## Analysis rules
- NEVER compute dollars from events (June 2026: events captured ~36% of
  recurring dollars). Dollars = prod user_payments + Close deals.
- Exclude user_created_by_admin accounts from funnels; roll team members up
  via main_user_id; use calendar-day windows.
- cancel_trial born 2026-04-22 (before: cancel_subscription). Full trial
  churn = union of both. Paying churn needs a prior-payment EXISTS filter.
- trial_* friction events born 2026-06-30.
- payment_failed is dunning noise — count DISTINCT users.
- Benchmarks (Jul 2026): trial→paid 13.6% within 14d (avg 8.2d);
  signup→trial 11–14.5%; abuse gate blocks ~30% of card-enterers.
- Docs & open questions: caras-new-voices/imai-data-work repo
  (docs-events-audit/, OPEN_QUESTIONS.md).
```

## Application log

- 2026-07-21: Group 1 (8 events) applied. Later writes initially declined —
  cause was the Mixpanel connector flapping mid-call, not policy.
- 2026-07-21 (later, user: "apply the lexicon"): Groups 2–8 (94 events) +
  project business context applied; verified by read-back (Free Trial
  Signup, new_subscription_payment, trial_unlock_modal_opened, Payment
  Attempt, Platform Usage, Won all carry descriptions + tags).
