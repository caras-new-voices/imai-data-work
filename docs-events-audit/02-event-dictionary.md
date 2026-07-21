# 02 — Server-Side Event Dictionary (Sprint 2)

**Status:** Draft v1 — derived from code audit 2026-07-20. Volumes/fill-rates
pending logs-DB access ([Q14](./OPEN_QUESTIONS.md)).
**Scope:** every event POSTed to `CLOSE_WEBHOOK_URL` by the three server
emitters (see [03-emitters.md](./03-emitters.md)). Client-side tags are
Sprint 3. Event *semantics* caveats marked ⚠ are imported from
`backend/main/src/usage-ai/SCHEMA.md`, where they were verified against live
data (dates noted there).

**Payload conventions** (apply to every backend/main event unless noted):
- The emitter auto-enriches with `name`, `email`, `main_user_id` (looked up
  from the user; see users.service.ts:3729). `user_id` + `event` are always
  present. Extra fields below are per-call-site additions.
- `amount` is **whole USD** (⚠ not cents); Israel-billed charges are
  multiplied by 1.17 (VAT) before emission on some paths (noted per event).
- Known `imai_events` columns the pipeline can populate: `id, event, user_id,
  email, name, amount, date, main_user_id, admin_user_id, lead_id, ip,
  reseller_stripe_cuid, user_stripe_cuid`.
- Destinations shorthand: **E** = imai_events (logs DB), **M** = Mixpanel
  (via external sync, lagging/lossy), **K** = Klaviyo (event-named list
  and/or lifecycle metric), **C** = Close CRM. All webhook events are assumed
  E+M; K/C flagged where documented. Confirmation of the fan-out is Q1.

---

## 1. Lifecycle — signup & onboarding

| Event | Trigger | Emitter | Extra payload | Destinations | Caveats |
|---|---|---|---|---|---|
| `signup` | Self-serve registration completes | users.service.ts:3041 | `email, name, utm, phone` | E M K(list ×4 + `Signup` metric TgdFj8) C | ⚠ Admin-created users skip this — never compute funnels without excluding `user_created_by_admin` accounts. Klaviyo has 4 duplicate `signup` lists — aggregate by name. |
| `user_created_by_admin` | Admin creates account (sales) | users.controller.ts:131 | `email, name, admin_user_id` | E M | Marks accounts that skip the self-serve funnel. |
| `team_member_added` | Team member invited/added (2 paths) | users.controller.ts:219, :318 | `team_member_email` | E M K | ⚠ Team members get their own `user_id`; roll up via `main_user_id` for account-level analysis. |
| `user_logged_in` | Login succeeds | users.controller.ts:1014 | — | E M | ⚠ The ONLY session proxy — "sessions/day" = logins/day; there is no sessions table. |
| `finished_onboarding` | Onboarding KYC completed (only if `inviteTeamMembers` step reached) | users.controller.ts:1770 | — | E M | ⚠ Onboarding is skippable (users can go straight to /trial) — NOT a mandatory funnel edge. |
| `scheduled_forced_onboarding_tehilla` | Forced-onboarding booking flow | users.service.ts:4468 | — | E M | Named for a CS rep; taxonomy-cleanup candidate (Sprint 5). |

## 2. Lifecycle — trial

| Event | Trigger | Emitter | Extra payload | Destinations | Caveats |
|---|---|---|---|---|---|
| `new_subscription_trial` | Trial starts (card accepted) | payments.service.ts:1634 | `email, name, amount` | E M K(`New Trial` T47iri — matches E ≈99%) C | Trials are 7 days. Trial start anchor = `min(date)` per user. |
| `free_trial_blocked` | Card entered but user blocked (abuse prevention) | payments.service.ts:1545 | `email, name, error` | E M K | Fires alongside a Slack alert (B052AN3HQL8). |
| `new_trial_email_failed` | Trial welcome email throws | payments.service.ts:1622 | `email, name` | E M | Operational, not behavioral. |
| `cancel_trial` | Cancel while `endTrial` still set | users.service.ts:2190 (ternary) | `email, name, subscription_type='trial', cancellation_reason?` | E M K(single-event routing: cancelers land ONLY here, not in cancel_subscription lists) | ⚠ Exists only since **2026-04-22**; before that ALL trial cancels emitted `cancel_subscription`. ⚠ ~20/month trial users with expired `endTrial` still emit `cancel_subscription` today — complete trial-churn = union of both, deduped per user. |
| `trial_charge_exception` | Trials cron charge attempt throws | tasks/tasks.service.ts:376 | `email, name, error` | E M | Operational. |

## 3. Lifecycle — payment & churn

| Event | Trigger | Emitter | Extra payload | Destinations | Caveats |
|---|---|---|---|---|---|
| `new_subscription_payment` | First real charge (trial→paid) — 3 paths: direct purchase, trial conversion, renewal-cron conversion | payments.service.ts:500, :1710, :2210 | `email, name, amount` (IL ×1.17 on :500 path) | E M K(`New Customer` W9Y37g since 2026-03-23) C | ⚠ THE trial→paid conversion event. Can re-fire on re-subscription (~7% of payers; one account has 34) — "first payment" = `min(date)` per user. ⚠ Can double-fire per user — dedupe. ⚠ April 2026 emitted almost nothing (thin patch) — cross-check prod `user_payments` for exact counts. |
| `payment_success` | Recurring renewal charge succeeds (Stripe :2210 path variable / Cardcom :2325) | payments.service.ts:2210, :2325 | `email, name, amount` (Cardcom IL ×1.17) | E M | ⚠ **Partial coverage — trend shape ONLY.** June 2026: captured 57% of recurring charges but 36% of dollars (misses the big annual/enterprise renewals). Never build revenue/retention on it; use prod `user_payments`. |
| `payment_failed` | Charge attempt fails (initial :536; Stripe renewal :2265; Cardcom renewal :2376) | payments.service.ts | `email, name, amount` | E M | ⚠ Retry/dunning noise: 6,000 events vs 44 successes in 3 weeks. Always `count(DISTINCT user_id)`. |
| `upgrade_package_payment` | Plan upgrade charged (Stripe :1349 / Cardcom :1410) | payments.service.ts | `email, name, amount` (Cardcom IL ×1.17) | E M | Counts as a payment event for prior-payment churn filters. |
| `duplicate_charge_prevented` | Idempotency guard blocks a double charge | payments.service.ts:2084 | `subscription_id` | E M | Operational. |
| `manual_subscription_purchase_blocked` | Manual-payment account tries self-serve purchase | payments.controller.ts:150 | `subscription_id, package_id` | E M | |
| `started_cancellation_process` | User enters cancel flow | users.controller.ts:2343 | `email` | E M | Churn-INTENT signal — many don't finish. ⚠ Pollutes `trial_analytics_report.cancel_date` (that view counts any `%cancel%` event). |
| `cancel_subscription` | Cancel when `endTrial` NOT set (else `cancel_trial`) | users.service.ts:2190 (ternary) | `email, name, subscription_type='paying', cancellation_reason?` | E M K C | ⚠ NOT "paying churn" by itself — ~72% of last year's emitters were still in trial (legacy path). Paying churn requires a prior-payment EXISTS filter (recipe in SCHEMA.md). |
| `cancel_subscription_after_ai_agent_call` | Cancel completed after AI-agent retention call | (in imai_events; emitter in cancel flow) | — | E M | Related retention-flow marker. |
| `deactivate_account` | Account deactivated | users.service.ts:2391 | `email, name` | E M | |

The cancel flow ALSO posts a rich payload (reason, competitor, message,
subscription_amount) to make.com via `CANCELLATION_WEBHOOK_URL`
(users.service.ts:2262) and a Slack notice — parallel channels, not
imai_events (see 03-emitters.md §4).

## 4. Product usage

| Event | Trigger | Emitter | Extra payload | Destinations | Caveats |
|---|---|---|---|---|---|
| `influencer_discovery_search` | User-initiated discovery search | **proxy** index.js:292 (`userInitiated===true`) + backend Influencer.controller.ts:53 (search-data), :75 (linkedin), :97 (snapchat) | proxy adds `email, user_id, name` itself | E M | ⚠ ~2.8M rows — always aggregate, never scan. ⚠ Proxy emitter is NOT prod-gated (Q10). Health-score input. |
| `influencer_discovery_search_paginated` | Pagination of a search | proxy index.js:299 (`userPaginated===true`) | same | E M | Volume event; excluded from most engagement definitions. |
| `created_report` | Influencer report created | reports/report.controller.ts:118 | `email, name` | E M | ⚠ Excluded from the health-score event set (`event <> 'created_report'`). |
| `report_creation_attempt` | Report requested (before success) | report.controller.ts:93 | `email, name` | E M | Pair with `created_report`/`report_creation_failed` for failure-rate. |
| `report_creation_failed` | Report generation failed | report.controller.ts:101 | `email, name` | E M | |
| `first_report_created` | First-ever report (quota.count===0) | report.controller.ts:125 | `email, name` | E M K(list + activation flows) | **Activation milestone** — canonical "activated trial" definition. |
| `created_campaign` + `campaign_created` | Campaign created (BOTH fire) | campaigns.controller.ts:339 and :356 | :339 adds `email, name`; :356 none | E M | ⚠ Duplicate pair — Q9. Which one downstream consumers use is unconfirmed. |
| `first_campaign_created` | First-ever campaign (quota.count===0) | campaigns.controller.ts:346 | `email, name` | E M K | Activation milestone. |
| `influencer_added_to_campaign` | Influencer added (UI :833; bulk API per-item campaigns-api.service.ts:242) | campaigns.controller.ts:833 | — | E M | Health-score input ("Added Influencer to Campaign" naming variant in Mixpanel — Sprint 4 to map). |
| `first_list_created` | First-ever list (quota.count===0) | lists/list.controller.ts:273 | `email, name` | E M K | Activation milestone. |
| `created_list` | List created (every time) | lists/list.controller.ts (added 2026-07-20, remediation R16) | `email, name` | E M | ⚠ New event — no history before 2026-07 deploy. |
| `created_geo_analysis` | Geo analysis created | geo/geo.controller.ts:111 | — | E M | |
| `regenerated_geo_analysis` | Geo analysis re-run | geo/geo.controller.ts:389 | — | E M | |
| `pr_journalist_search` | PR module journalist search | entity/controllers/journalist.controller.ts:60 | — | E M | |
| `pr_created_media_list` | PR media list created | entity/controllers/entity-list.controller.ts:45 | — | E M | |
| `pr_generated_pitch` | PR pitch generated | entity/controllers/pitch.controller.ts:70 | — | E M | |
| `pr_sent_pitch` | PR pitch sent | entity/controllers/pitch.controller.ts:125 | — | E M | |
| `created_social_listening_report` | SL report created | social-listening.controller.ts:31 | — | E M | |
| `generated_social_trends_insight` | SL trends insight generated | social-listening.controller.ts:115 | — | E M | |
| `social_listening_segment_created` | SL segment pipeline starts | **social-listening svc** segment-timing.service.ts:43 | `segment_id` | E M | Emitted by the 3rd emitter (own implementation, prod-gated, no white-label routing). |
| `social_listening_report_ready` | SL pipeline completes (once per pipeline) | segment-timing.service.ts:195 | `segment_id, mention_count, total_duration_ms?` | E M | |

## 5. Trial-friction & upgrade-intent (dynamic families — since 2026-06-30)

⚠ Any trend crossing 2026-06-30 is a measurement change, not behavior change.
Server-side family is **deduped once per user+event per day** (cache in
`sendTrialPipeDriveEvent`, users.service.ts:1652).

| Family | Trigger | Emitter | Extra payload |
|---|---|---|---|
| `trial_{feature}_daily_limit_reached` / `..._day{N}` (N = trial day 1–7) | Daily quota hit during trial | users.service.ts:1713 (via `firePipeDriveTrialLimit`) | `feature, period, count, limit, trial_day?` — note `reports`→`report` rename |
| `trial_{feature}_total_limit_reached` | Total trial quota hit | users.service.ts:1702 | same |
| `trial_feature_blocked` | Gated feature attempted | users.service.ts:1936 | `feature, cta` |
| `trial_upgrade_<placement>` | Upgrade CTA clicked; placement baked into the NAME | frontend → `POST users/pipedrive/trial-event` (users.controller.ts:2382) | `source` — placements: `top_bar, sidebar_workspace, sidebar_operations, list_banner, search_banner, campaign_list_banner, campaign_demo, report_download, report_add_to_list, influencer_report_banner, sl_list_banner, locked_403, limit_search_daily, limit_reports_daily, search_limit_empty_state` (aggregate `LIKE 'trial_upgrade_%'`) |
| `trial_unlock_modal_opened` | Unlock modal shown (highest-volume intent signal) | same frontend bridge | `source` |
| `trial_book_call_clicked` / `_sidebar` / `_top_bar` | Book-a-call CTA | same | `source`; opens Calendly |
| `trial_sample_report_viewed` | Sample report viewed | same | `feature` (`social_listening`, `campaign`) |

The frontend bridge whitelist (backend, users.controller.ts:2382): prefixes
`trial_upgrade_`, `trial_book_call_`, `trial_unlock_modal_`,
`trial_sample_report_` + regex `^[a-z][a-z0-9_]{0,63}$`. Guarded client-side
to trial users only (trial-gating.service.ts:49); errors swallowed both sides.

## 6. Sales/CRM mirror events (in imai_events but NOT emitted by the platform)

Close pipeline stage labels are mirrored INTO imai_events as events:
`Qualification`, `Discovery / Demo`, `Proposal / Buying`, `Won`,
`Won (Renewed/Expanded)`, `Lost`, `Identification`, `No Show`, plus
`scheduled_demo_*` / `scheduled_*_call` families.

⚠ Exclude from product-usage analyses. ⚠ Stage names exist in BOTH Close
pipelines (Sales + CS) — ambiguous without `status_id` (SCHEMA.md has the
disambiguation ids). Mirror mechanism unknown — Q6.

## 7. Orphan events (seen in imai_events/Klaviyo; no emitter anywhere in repo)

`high_value_signup` · `scheduled_demo_*` · `scheduled_ai_agent_call*` (incl.
per-rep variants) — presumed Close automations / make.com / Calendly ([Q6]).
Document-blocked until the emitter is found.

## 8. Validation status

Code-derived only. Pending Q14 (logs-DB read access):
per-event 90-day volumes, payload fill rates, dead-event detection, and
discovery of any event names in imai_events not covered above.
