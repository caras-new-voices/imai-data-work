# 07 — Destinations: Mixpanel, Klaviyo, Close, GA4 (Sprint 4)

**Status:** Draft v1 — everything below that is dated/verified comes from
`backend/main/src/usage-ai/SCHEMA.md` (live-data-verified knowledge base) or
this audit's code reads. Items marked 🔒 need access (Q-refs) and have a
ready-to-run completion procedure.

---

## 1. Mixpanel

### 1.0 MEASURED 2026-07-20 (via Mixpanel connector — project 3432835 "Influencer Marketing AI", 30-day totals)

**The project contains 104 events in TWO live namespaces:**

1. **A Title-Case namespace with NO emitter in the codebase** — high volume and active:
   `Platform Usage` **1,614,471**/30d (!), `Influencer Report` 33,200, `Influencer
   Search` 11,118, `Login` 10,739, `Campaign Media Scraped` 6,583, `Added
   Influencer to List` 6,313, `Added Tracked Campaign Influencer` 3,579, `Created
   Influencer List` 379, `Payment Attempt` 254, `Created Campaign` 214, `Added
   Payment Method` 213, `Free Trial Signup` 153, `Intercom Conversation` 116,
   `Cancelled Subscription` 86, `Invited Team Member` 85, `Deleted Account` 42,
   `Campaign Invite` 411, `Campaign Requirement Approval` 134, plus low-volume
   (Bulk Contacts Export 25, Scheduled Meeting 26, Campaign Chat Message 16,
   Created Campaign Requirements 35, Forgot Password 5). Source unidentified —
   this is a SECOND event pipeline (Q24).
2. **The snake_case webhook namespace** (matches the code-derived dictionary):
   `influencer_discovery_search` 18,765, `user_logged_in` 10,275,
   `influencer_discovery_search_paginated` 5,366, `report_creation_attempt`
   29,614, `report_creation_failed` 2,737, `influencer_added_to_campaign` 2,622,
   `signup` 1,854, `finished_onboarding` 466, `first_report_created` 427,
   `payment_failed` 218, `duplicate_charge_prevented` 169, `pr_journalist_search`
   115, `free_trial_blocked` 79, `started_cancellation_process` 75, `first_list_created`
   58, `team_member_added` 53, `cancel_trial` 48, `payment_success` 47,
   `pr_generated_pitch` 47, `new_subscription_payment` 34, `deactivate_account`
   28, `trial_unlock_modal_opened` 83, trial_upgrade_* ≈60 total, others <30.

**Mapped (renamed) events — these snake names DO NOT EXIST in Mixpanel:**
`new_subscription_trial` → `Free Trial Signup` · `cancel_subscription` →
`Cancelled Subscription` · `created_report` → `Influencer Report`(?) ·
`created_campaign`/`campaign_created` → `Created Campaign`(?) — the health-score's
mixed name lists are explained by this mapping.

**Same-action pairs BOTH live (double-counting hazard):**
`Login` 10,739 vs `user_logged_in` 10,275 (≈4% apart — likely same action from
two sources) · `Influencer Search` 11,118 vs `influencer_discovery_search`
18,765 (**41% apart — different definitions, Q25**) · `Invited Team Member` 85
vs `team_member_added` 53.

**Dictionary events ABSENT from Mixpanel entirely:** the whole social-listening
family (`created_social_listening_report`, `generated_social_trends_insight`,
`social_listening_segment_created`, `social_listening_report_ready`),
`pr_sent_pitch`, `first_campaign_created`, `manual_subscription_purchase_blocked`,
`trial_charge_exception`, `new_trial_email_failed`, `trial_book_call_clicked`,
`trial_upgrade_campaign_list_banner`, `trial_upgrade_search_limit_empty_state`,
the `trial_search_*_limit` family, `high_value_signup` (in Klaviyo but NOT
Mixpanel), `user_logged_in`'s sibling `created_list` (new 2026-07-20 — expected
sync lag, recheck).

**Mixpanel-only events not in the dictionary (beyond the Title-Case family):**
`api_credits_added`/`api_credits_renewed`, `reseller_customer_created`, `refund`,
`answered_scheduled_ai_agent_call`, `canceled_demo_scheduled_{danielr,morya,shah}`,
`scheduled_demo_{morya,tom}`, `scheduled_forced_onboarding_shah`,
`scheduled_onboarding_button_shah`, `scheduled_trial_agent_call`,
`trial_upgrade_clicked` (6/30d — someone already emits the collapsed name),
`$session_start`/`$session_end` (Mixpanel virtual).

**Lexicon hygiene: zero.** No event has a description, tag, display name, or
verified flag. No business context is configured on the project.

**What we know:**
- Populated ONLY by the external sync from the webhook/logs-DB pipeline —
  no code in this repo writes to it (verified repo-wide).
- Sync is **lagging and lossy** (SCHEMA.md calls drift vs live data "its sync
  lag"); `user.mixpanel_sync` (int, prod user table, added Oct 2024) is
  presumably a per-user sync watermark — writer unknown (Q4).
- Event naming in Mixpanel does NOT always match imai_events: the health
  score formula uses Mixpanel-style names (`'Influencer Search'`,
  `'Added Influencer to List'`) alongside snake_case (`'influencer_discovery_search'`)
  — SCHEMA.md keeps both lists verbatim "for parity with the Mixpanel sync".
  A name-mapping table Mixpanel↔imai_events is REQUIRED output of this sprint.
- The per-user **health score (0–100)** the team uses in Mixpanel is exactly
  replicated in SQL at usage-board.service.ts:1909 (60-day window, recency
  bucket + tiered usage; bands ≥80 Healthy / ≥60 Stable / ≥40 At Risk /
  else Critical).

**🔒 Completion procedure (Q19/Q20 — needs Mixpanel project admin):**
1. Export Lexicon (events + properties + descriptions) → diff against
   02-event-dictionary.md: (a) Mixpanel events with no dictionary entry,
   (b) dictionary events absent from Mixpanel, (c) name variants → build the
   mapping table.
2. Identity audit: what is `distinct_id` (user_id? email?)? How are team
   members / main_user_id handled? Any identity merge rules?
3. Lag/loss measurement (30 days, top 10 events): count in imai_events vs
   count in Mixpanel (raw export API), bucket by day; record median ingest
   delay and loss % per event.
4. Usage audit: which reports/boards/cohorts does the team actually open
   (Mixpanel usage report)? Those events become "protected names" for the
   Sprint 5 taxonomy.

## 2. Klaviyo (verified 2026-07-13 in SCHEMA.md)

- Account is young — nothing predates 2025-11.
- **Two mirror mechanisms:**
  1. **7 API-pushed lifecycle metrics** (with metric ids + birth dates):
     `Signup` TgdFj8 (2025-12-23) · `New Trial` T47iri (2025-12-25) ·
     `New Customer` W9Y37g (2026-03-23) · `Churned Customer` SL668n
     (2026-03-23) · `Demo Booked` WtXNd6 (2025-12-18) · `Viewed Product`
     WVeTEK (2025-12-11) · `Active on Site` Rj7QRn (2025-11-20).
     `New Trial` matches imai_events `new_subscription_trial` ≈99%.
  2. **~97 lists as the automation bus** — list-adds named EXACTLY like
     imai_events events (`signup`, `new_subscription_trial`,
     `new_subscription_payment`, `cancel_trial`, `cancel_subscription`,
     `first_report_created`, `first_list_created`, `first_campaign_created`,
     `free_trial_blocked`, `high_value_signup`, `scheduled_demo_*` /
     `scheduled_ai_agent_call*` families) **plus Close stage labels**
     (Qualification, Won, …). ALL live flows trigger on "Added to List".
- Known quirks: duplicate list names (4× `signup` — aggregate by name);
  **single-event routing** (trial cancelers land ONLY in `cancel_trial`
  list — flows on `cancel_subscription` never reach them); **~1 in 10
  events reach neither list** (sync not lossless).
- 19 flows (16 live) map to platform behavior; the 14D/12D trial flows
  belong to a retired 14-day trial — historical stats only.
- Email-machinery metric ids (engagement): Received WGpvnP · Opened YuPnTi
  (Apple MPP-inflated) · Clicked SuwFKe · Unsub RDN7PX · Bounced RRvD8B ·
  Spam XRNkgF.

**🔒 Completion (Q5):** identify the pushing integration (API key holder) in
Klaviyo settings; quantify the ~10% list-miss on a 30-day sample; document
which flows fire per event (list → flow map).

## 3. Close CRM

- Destination of the webhook events (leads timeline/automations — exact
  consumption unknown until Q1/Q6) AND a source: pipeline stage changes are
  mirrored back into imai_events as events (02 §6).
- Read-side facts already verified in SCHEMA.md: two pipelines (Sales
  `pipe_0xLHT…`, CS `pipe_4BnK…`) with stage ids for disambiguation; demo
  booking auto-creates a Sales opportunity at Qualification; `value>0` ⇔
  demo happened (Sales pipeline only); "No Show" is process-lost though
  typed active; join keys: lead custom fields ⭐ IMAI User Id / Contact
  Email / Stripe ID (cf ids in SCHEMA.md).
- ⚠ This session's Close connector reaches the **NewVoices** org, not
  IMAI's — automations inspection blocked (Q6).

## 4. GA4 (property G-TD1DHH379G)

Receives: client events (04 §3), GTM-mediated tags (unknown until Q15), and
the server-side MP `purchase` (03 §4). Known risks to verify in the GA4 UI:
`trial_success` double-fire (credit-card + onboarding paths), client
`payment_success` vs server `purchase` double-count, hardcoded MP
`client_id` collapsing all purchases onto one synthetic user, and staging
pollution (MP call not env-gated) — all Q11.

## 5. Coverage matrix (code-derived; ✔=lands there, ？=unconfirmed)

| User action | proxy billing DB | imai_events | Mixpanel | Klaviyo | GA4 | Close |
|---|---|---|---|---|---|---|
| Signup | – | ✔ | ✔ | ✔ list+metric | ✔ client | ✔ |
| Trial start | – | ✔ | ✔ | ✔ list+metric | ✔ client (+GTM) | ✔ |
| Trial→paid | – | ✔ (thin patches) | ✔ | ✔ metric+list | ✔ MP purchase (99/499/1200 only) | ✔ |
| Renewal charge | – | ⚠ ~57% count / 36% $ | ⚠ same | ？ | ？ | ？ |
| Cancel (trial) | – | ✔ since 2026-04-22 | ✔ | ✔ cancel_trial list only | – | ✔ |
| Cancel (paying) | – | ✔ (needs prior-payment filter) | ✔ | ✔ | – | ✔ |
| Search | ✔ (billing rows) | ✔ (high vol) | ✔ | – | – | – |
| Report created | ✔ (billing) | ✔ | ✔ (excluded from health score) | first only | – | – |
| List/Campaign created | – | ✔ (dup names ⚠) | ✔ | first only | – | – |
| Login | – | ✔ (session proxy) | ✔ | `Active on Site`? | – | – |
| Trial friction | – | ✔ since 2026-06-30 | ✔ | ？ | – | ✔ (sales visibility is the stated purpose) |
| Demo booked | – | ✔ (orphan emitter) | ✔ | ✔ metric | – | ✔ (auto-opportunity) |
| Page visits (trial/search) | – | ？ via AWS pixel (Q17) | ？ | `Viewed Product`? | ✔ GA4 auto | – |

**Revenue ground truth is NONE of these** — prod `user_payments` (stripe+
cardcom, no manual deals) + Close values for manual deals; there is no
complete revenue record anywhere (SCHEMA.md gotcha #1).
