# 03 — Event Emitters & Side Channels (Sprint 2)

**Status:** Draft v2 — code audit 2026-07-20, refreshed 2026-07-22 against HEAD
`da98fcf2` (all file:line refs re-verified; see REFRESH-NOTES.md).
Companion to [02-event-dictionary.md](./02-event-dictionary.md) (what fires)
— this doc covers **how** it fires and every parallel channel.

> **⚠ Correction (2026-07-22):** remediations R1/R8/R21 previously marked "Done"
> in this doc are **not merged into Discovery-imai** — they exist only as patches
> in `discovery-imai-patches/`. Statements below describe the repo at `da98fcf2`.

---

## 1. The three `sendPipeDriveWebhook` implementations

Despite the name, all three POST to the **Close** webhook
(`CLOSE_WEBHOOK_URL`); "PipeDrive" is a legacy misnomer. All are
fire-and-forget with swallowed errors: **event delivery is best-effort by
design, with no retry, queue, or dead-letter anywhere.** Every known
downstream loss (Mixpanel gaps, Klaviyo ~10% list misses, April-2026 payment
thin patch) is consistent with this.

| | backend/main | proxy | social-listening |
|---|---|---|---|
| Location | users/services/users.service.ts:3733 | proxy/index.js:112 | src/users/social-listening-users.service.ts:36 |
| Language | TS (NestJS) | JS (Express) | TS (NestJS) |
| **Prod-gated** | ✅ `NODE_ENV==='prod'` | ❌ **no gate at all at HEAD** — the R1 patch was never merged (Q10); fires whenever `CLOSE_WEBHOOK_URL` is set | ✅ `NODE_ENV==='prod'` |
| Payload enrichment | looks up user → adds `name`, `email`, `main_user_id` | caller passes `email/user_id/name` explicitly | caller passes payload; keys snake_cased |
| White-label routing | ✅ `CLOSE_WEBHOOK_URL_<LABEL>` (label ≠ 'imai'), falls back to default | ✅ same, via DB label lookup; strips `whiteLabelId` key | ❌ default URL only |
| White-label identity in payload | ❌ stripped | ❌ stripped | n/a |
| Retry / queue | none | none | none |
| Type contract | `PipeDriveData` — defined TWICE (users.service.ts:80 vs user.interface.ts:49, drift risk) | none (plain object) | none |

**Consequences to document for consumers:**
- Events from white-label tenants either go to a different webhook URL
  (per-label env var) or fall through to the default **indistinguishably**
  — imai_events has no white-label field (SCHEMA.md flags reseller
  invisibility as a known analytics gap). Remediation candidate: Sprint 5.
- A user lookup failure in backend/main still sends the un-enriched event
  (logged `PIPEDRIVE_WEBHOOK: user not found`) — expect occasional events
  with missing `email`/`name`.

## 2. The frontend→backend trial-event bridge

`front/imai/src/app/core/services/trial-gating.service.ts:49`
→ `POST /data/pipedrive/trial-event` → users.controller.ts:2367 (`@Post`,
handler calls `sendTrialIntentEvent` at :2388)
→ `sendTrialIntentEvent` (users.service.ts:1735) → webhook.

Contract: trial users only (client-side guard); event name whitelisted by
prefix (`trial_upgrade_`, `trial_book_call_`, `trial_unlock_modal_`,
`trial_sample_report_`) + `^[a-z][a-z0-9_]{0,63}$`; payload `{source?,
feature?}`; errors swallowed on both ends. This is the ONLY path where the
client chooses a server event name.

Server-side trial-friction events (limit-reached family) are emitted directly
by quota enforcement with a **once-per-user-per-event-per-day cache**
(users.service.ts:1657) — volumes are floor-counts of affected users/days,
not raw click counts.

## 3. Parallel usage record: proxy billing (DB-side, not events)

The proxy independently records **all API usage** to Postgres on every
proxied response (`onProxyRes`, proxy/index.js:327-518): `insertBillingEntity`
(JWT + API-key users), `decrementUserBalanceByApiKey`,
`insertMannyBillingEntity` (cron/reports path), `incrementSubscriptionCount`
(paginated search) — keyed by `x-tokens-cost` header with per-route cost
floors. Package types: 1=Search, 2=Reports, 4=Social Listening, 6=Overlap.

**Changed 2026-07-21 (`c6a0ece7`):** `incrementSubscriptionCount` is now
**skipped for trial-gated users** (endTrial set + package configures
`trialTotalLimit`/`trialDailyLimit`) — the backend's `consumeSearchQuota`
(users.service.ts:1810) is authoritative for them and applies a
**search-session window** (`SEARCH_COUNT_WINDOW_SECONDS`; code default 50 s
although its comment claims 300 s — flagged upstream) via
`subscription_count.lastCountedAt`. Also, any *falsy* `skip` now counts as a
first page, so unified multi-platform search legs no longer each bump the
count. ⚠ Trial search *counts* are a measurement change on the deploy date;
the `influencer_discovery_search` webhook event is unaffected.

This is a **second source of truth for usage** that never passes through the
event pipeline — useful for cross-validating imai_events search counts
(Sprint 4) and unaffected by webhook loss.

## 4. Side channels (complete outbound map)

| Channel | Destination | Trigger / payload | Gated? | Notes |
|---|---|---|---|---|
| GA4 Measurement Protocol | `google-analytics.com/mp/collect`, property `G-TD1DHH379G` | server-side `purchase` on `savePaidPayment` when price ∈ {99, 499, 1200} (payments.service.ts:1789-1810) | ❌ ungated; api_secret + client_id hardcoded (R2 patch unmerged) | Bypasses webhook pipeline entirely. Q11. |
| make.com — cancellation | `CANCELLATION_WEBHOOK_URL` | rich cancel payload: reason, competitor, message, subscription_amount… (users.service.ts:2266) | via env | Parallel to the `cancel_*` events. |
| make.com — email test | hardcoded `hook.us1.make.com/ghqua…` (users.service.ts:3823) | email-connection failure `{error, email_address}` (sendEmailTestWebhook :3820) | ❌ | |
| Slack — quota blocks | hardcoded hook (B04570374LR, in `sendBlockWebhook` users.service.ts:3835) | 10 call sites, block notices (users.service.ts:3246-3555) | ❌ | |
| Slack — cancellations | hardcoded hook (B074EJ23NJW) | `sendCancelSubscriptionSlack` (users.service.ts:3883) | | |
| Slack — bad-card trials | hardcoded hook (B052AN3HQL8) | alongside `free_trial_blocked` (payments.service.ts:1539) | | |
| Slack — mail failures | hardcoded hook (B04570374LR) | mail.service.ts:614, users.service.ts:2649 | | |
| Slack — deploys | hardcoded hook (B06T9CAC0P5) | deploy announcements (deploy/deploy.js:63) | | |
| Bubble — IP capture | `api.influencermarketing.ai/…/imai-ip-capture` (hardcoded bearer) | `{event: login\|signup, user_id, ip}` (`sendIpWebhook` users.service.ts:3849; called users.controller.ts:1214 (login), users.service.ts:3053 (signup), :4768) | ✅ prod | Feeds ip-based attribution? (relates to attribution sheet `ip` column). |
| Bubble — blocked signup | `…/blocked-signup` | `{ip, email}` (`sendBlacklistWebhook` users.service.ts:3868) | | |
| Bubble — report errors | `…/imai-report-error` | Influencer.service.ts:631 | | |
| Bubble — generic ("Robby") | `…/imai-webhooks` | `sendWebhook` users.service.ts:3708 — **no caller in repo** (dead?) | | |
| Phyllo — **inbound** | pixel DB `phyllo_webhooks` table | Phyllo creator-auth webhooks (ACCOUNTS.CONNECTED/DISCONNECTED, SESSION.EXPIRED since 2026-07-21) land in the **pixel DB**; backend/main `scanPhylloStatus` (campaigns/services/phyllo.service.ts:41) polls it via `pixelDB()` (PIXEL_DB_* env, campaigns.service.ts:1114) and stamps `influencer.phyllo_status` | | Not analytics; confirms backend/main has direct pixel-DB credentials (evidence for Q3). |
| Email-notification (dormant) | `BACKEND_API_URL/email-notification` | proxy `check24Usage` — only caller is commented out (index.js:319) | | Dead code. |
| brand-safety → main | `MAIN_BACKEND_URL/brand-safety-report/:id/complete` | service-to-service callback | | Not analytics. |
| `ai_usage` table | Postgres | AI token/cost logging from BOTH backend/main (`src/ai-usage/`) and brand-safety (`services/ai-usage.service.js`); `event` column = category label (`audio_transcription`, `video_analysis`, …) | | Internal cost accounting, not behavioral analytics. |
| SL observability | GCP logs | pino `SL_EVENTS` (`segment.create.*`, `quota.*`, dotted names) → log-based metrics | | Not analytics; different naming convention (dotted vs snake_case). |

## 5. Hardening candidates (feed Sprint 5 backlog)

1. Single shared emitter contract: typed event-name union + one payload
   interface; kills the duplicated `PipeDriveData` and the three divergent
   implementations.
2. Prod-gate the proxy emitter (Q10) and the GA4 MP call (Q11).
   **Patches authored 2026-07-20 (R1/R2) but NOT merged into Discovery-imai
   as of da98fcf2** — merge/deploy them through the normal repo flow, or
   re-author them against current HEAD.
3. Move hardcoded secrets to env. **R8 patch authored but NOT merged** —
   `src/shared/integration-endpoints.ts` does not exist in the repo; all
   Slack/make.com/Bubble hooks (and the GA4 api_secret) are still hardcoded.
   Rotation required after merge.
4. Add `white_label` to payloads instead of stripping identity (Q13).
5. Consider at-least-once delivery (outbox table or queue) if downstream loss
   (Mixpanel/Klaviyo) turns out to matter — measure first in Sprint 4.
6. CI guardrail. **R21 patch (event-dictionary-sync.spec.ts) NOT merged** —
   no such spec exists in the repo.
