# 03 — Event Emitters & Side Channels (Sprint 2)

**Status:** Draft v1 — code audit 2026-07-20.
Companion to [02-event-dictionary.md](./02-event-dictionary.md) (what fires)
— this doc covers **how** it fires and every parallel channel.

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
| Location | users/services/users.service.ts:3729 | proxy/index.js:112 | src/users/social-listening-users.service.ts:36 |
| Language | TS (NestJS) | JS (Express) | TS (NestJS) |
| **Prod-gated** | ✅ `NODE_ENV==='prod'` | ✅ since 2026-07-20 (R1): `NODE_ENV==='production' && !STAGING` — note the different prod convention | ✅ `NODE_ENV==='prod'` |
| Payload enrichment | looks up user → adds `name`, `email`, `main_user_id` | caller passes `email/user_id/name` explicitly | caller passes payload; keys snake_cased |
| White-label routing | ✅ `CLOSE_WEBHOOK_URL_<LABEL>` (label ≠ 'imai'), falls back to default | ✅ same, via DB label lookup; strips `whiteLabelId` key | ❌ default URL only |
| White-label identity in payload | ❌ stripped | ❌ stripped | n/a |
| Retry / queue | none | none | none |
| Type contract | `PipeDriveData` — defined TWICE (users.service.ts:75 vs user.interface.ts:49, drift risk) | none (plain object) | none |

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
→ `POST /data/pipedrive/trial-event` → users.controller.ts:2382
→ `sendTrialIntentEvent` (users.service.ts:1730) → webhook.

Contract: trial users only (client-side guard); event name whitelisted by
prefix (`trial_upgrade_`, `trial_book_call_`, `trial_unlock_modal_`,
`trial_sample_report_`) + `^[a-z][a-z0-9_]{0,63}$`; payload `{source?,
feature?}`; errors swallowed on both ends. This is the ONLY path where the
client chooses a server event name.

Server-side trial-friction events (limit-reached family) are emitted directly
by quota enforcement with a **once-per-user-per-event-per-day cache**
(users.service.ts:1652) — volumes are floor-counts of affected users/days,
not raw click counts.

## 3. Parallel usage record: proxy billing (DB-side, not events)

The proxy independently records **all API usage** to Postgres on every
proxied response (`onProxyRes`, proxy/index.js:327-497): `insertBillingEntity`
(JWT + API-key users), `decrementUserBalanceByApiKey`,
`insertMannyBillingEntity` (cron/reports path), `incrementSubscriptionCount`
(paginated search) — keyed by `x-tokens-cost` header with per-route cost
floors. Package types: 1=Search, 2=Reports, 4=Social Listening, 6=Overlap.

This is a **second source of truth for usage** that never passes through the
event pipeline — useful for cross-validating imai_events search counts
(Sprint 4) and unaffected by webhook loss.

## 4. Side channels (complete outbound map)

| Channel | Destination | Trigger / payload | Gated? | Notes |
|---|---|---|---|---|
| GA4 Measurement Protocol | `google-analytics.com/mp/collect`, property `G-TD1DHH379G` | server-side `purchase` on `savePaidPayment` when price ∈ {99, 499, 1200} (payments.service.ts:1798) | ❌ | Hardcoded api_secret + client_id; bypasses webhook pipeline entirely. Q11. |
| make.com — cancellation | `CANCELLATION_WEBHOOK_URL` | rich cancel payload: reason, competitor, message, subscription_amount… (users.service.ts:2262) | via env | Parallel to the `cancel_*` events. |
| make.com — email test | hardcoded `hook.us1.make.com/ghqua…` | email-connection failure `{error, email_address}` (users.service.ts:3816) | ❌ | |
| Slack — quota blocks | hardcoded hook (B04570374LR) | ~10 call sites, block notices (users.service.ts:3242-3551) | ❌ | |
| Slack — cancellations | hardcoded hook (B074EJ23NJW) | `sendCancelSubscriptionSlack` (users.service.ts:3879) | | |
| Slack — bad-card trials | hardcoded hook (B052AN3HQL8) | alongside `free_trial_blocked` (payments.service.ts:1539) | | |
| Slack — mail failures | hardcoded hook (B04570374LR) | mail.service.ts:614, users.service.ts:2644 | | |
| Slack — deploys | hardcoded hook (B06T9CAC0P5) | deploy announcements (deploy/deploy.js:63) | | |
| Bubble — IP capture | `api.influencermarketing.ai/…/imai-ip-capture` (hardcoded bearer) | `{event: login\|signup, user_id, ip}` (users.service.ts:3845; called :1208, :3049, :4764) | ✅ prod | Feeds ip-based attribution? (relates to attribution sheet `ip` column). |
| Bubble — blocked signup | `…/blocked-signup` | `{ip, email}` (users.service.ts:3864) | | |
| Bubble — report errors | `…/imai-report-error` | Influencer.service.ts:631 | | |
| Bubble — generic ("Robby") | `…/imai-webhooks` | `sendWebhook` users.service.ts:3704 — **no caller in repo** (dead?) | | |
| Email-notification (dormant) | `BACKEND_API_URL/email-notification` | proxy `check24Usage` — only caller is commented out (index.js:318) | | Dead code. |
| brand-safety → main | `MAIN_BACKEND_URL/brand-safety-report/:id/complete` | service-to-service callback | | Not analytics. |
| `ai_usage` table | Postgres | AI token/cost logging from BOTH backend/main (`src/ai-usage/`) and brand-safety (`services/ai-usage.service.js`); `event` column = category label (`audio_transcription`, `video_analysis`, …) | | Internal cost accounting, not behavioral analytics. |
| SL observability | GCP logs | pino `SL_EVENTS` (`segment.create.*`, `quota.*`, dotted names) → log-based metrics | | Not analytics; different naming convention (dotted vs snake_case). |

## 5. Hardening candidates (feed Sprint 5 backlog)

1. Single shared emitter contract: typed event-name union + one payload
   interface; kills the duplicated `PipeDriveData` and the three divergent
   implementations.
2. ~~Prod-gate the proxy emitter (Q10) and the GA4 MP call (Q11).~~
   **Done 2026-07-20** (R1/R2-partial) — both gated; GA4 client_id/price
   allowlist still pending Q11.
3. ~~Move hardcoded secrets to env.~~ **Done 2026-07-20** (R8) — env-first
   with legacy fallbacks in `src/shared/integration-endpoints.ts`; rotation
   still required, then remove the fallbacks.
4. Add `white_label` to payloads instead of stripping identity (Q13).
5. Consider at-least-once delivery (outbox table or queue) if downstream loss
   (Mixpanel/Klaviyo) turns out to matter — measure first in Sprint 4.
6. ~~CI guardrail.~~ **Done 2026-07-20** (R21) —
   `backend/main/src/tests/event-dictionary-sync.spec.ts` fails on any
   statically-named webhook event missing from 02-event-dictionary.md.
