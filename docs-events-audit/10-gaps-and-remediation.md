# 10 — Gaps & Remediation Backlog (Sprint 5)

**Status:** Ticket-ready backlog from the audit. Priorities: P1 = data
integrity/correctness, P2 = hygiene/security, P3 = capability. Effort:
S (<1d) / M (1–3d) / L (1w+). Items marked 🔒 depend on an open question.

**Batch 1 executed 2026-07-20** (backend build green; users/payments/lists
suites pass; new guardrail test passes):
- ✅ R1 — proxy emitter gated (`NODE_ENV==='production' && !STAGING`;
  note the proxy's prod convention is `production`, not backend's `prod`).
- ✅ R2 (partial) — GA4 MP purchase gated to prod + `!dev`; ids/secret via
  env. client_id + price-allowlist fixes still 🔒 Q11.
- ✅ R8 (phase 1) — Slack/make.com/Bubble/GA4 secrets read env-first with
  legacy fallbacks (`backend/main/src/shared/integration-endpoints.ts`).
  Phase 2 = rotate each secret, set env vars, delete fallbacks.
- ✅ R9 — `sendEmailTestWebhook` + `sendBlockWebhook` prod-gated.
- ✅ R10 — dead `sendWebhook`, proxy `check24Usage`/`sendEmailNotification`
  and its commented caller removed.
- ✅ R16 — `created_list` emitted on every list creation (dictionary updated).
- ✅ R21 — guardrail test `src/tests/event-dictionary-sync.spec.ts` added.
- ⏸ R14 — **deferred with reason**: backend/main does not set Express
  `trust proxy`, so `@Ip()` behind the LB captures the LB address; removing
  the SDK's ipify lookup today would degrade IP-fallback attribution.
  Bundle with a trust-proxy review.
- ⏸ R13 — deferred; bundle the rename with R5 to avoid double churn.

## P1 — Data integrity

| # | Item | Effort | Detail |
|---|---|---|---|
| R1 | Prod-gate the proxy emitter | S | proxy/index.js:112 — add the same `NODE_ENV==='prod'` guard as backend/main (or env allowlist). Kills staging pollution of the highest-volume event. (Q10 confirms intent first.) |
| R2 | Gate / fix the GA4 MP server purchase | S | payments.service.ts:1798 — env-gate; replace hardcoded `client_id` with the user's GA client id (or a per-user stable id); revisit the {99,499,1200} price allowlist which silently drops other plans. 🔒 Q11 (what consumes it). |
| R3 | Resolve `created_campaign` vs `campaign_created` | S | campaigns.controller.ts:339/:356 — emit one canonical event. 🔒 Q9 (which name downstream uses). |
| R4 | Fix `payment_success` coverage or re-scope it | M | Emit on ALL renewal paths (find the uncovered big-renewal path) or mark the event "partial" in every consumer. Today it silently under-reports dollars 3×. |
| R5 | Single shared emitter contract | M | One typed module (event-name union + payload interface + enrichment + white-label routing + prod gate) consumed by backend/main; port proxy & social-listening to the same names/shape. Kills the duplicated `PipeDriveData` and the three divergent implementations. |
| R6 | Delivery reliability decision | M–L | All emitters are fire-and-forget (no retry/queue/outbox). After Sprint 4 measures real loss (08 §5), decide: accept, or add an outbox table + retry worker. |
| R7 | Add `white_label` + `source_service` to payloads | S | Stop stripping tenant identity (03 §1); resellers become filterable in imai_events. 🔒 Q13 (routing intent). |

## P2 — Hygiene & security

| # | Item | Effort | Detail |
|---|---|---|---|
| R8 | Move hardcoded secrets to env | S | Slack webhook URLs (5+), Bubble bearer token (users.service.ts:3845 etc.), GA4 api_secret (payments.service.ts:1798), Segment write key is public-by-design (ok). Rotate the Bubble token after extraction — it's in git history. |
| R9 | Ungate make.com email-test + Slack block webhooks | S | users.service.ts:3816/:3831 fire from non-prod — add gates. |
| R10 | Remove dead code | S | `sendWebhook` (users.service.ts:3704, no caller), proxy `check24Usage` path (index.js:318 commented caller), `SLOT_ACQUIRED` placeholder. |
| R11 | PII review | M | Email in GTM dataLayer/Clarity/Segment; ip in imai_events + Bubble capture; no CMP found in code. Legal/consent decision needed, esp. for white-label domains loading IMAI tags. 🔒 Q12/Q15. |
| R12 | Commit or document server-only services | M | backend/scraper + backend/frontend-logger exist only on the prod VM (Q8) — version-control them or document why not. |
| R13 | Rename `sendPipeDriveWebhook` → `sendCloseEvent` (or `emitProductEvent`) | S | Part of R5; the misnomer actively confuses (Pipedrive is gone). |
| R14 | Conversion SDK: drop client-side ipify lookup | S | sdk/pixel.js:451 — server already sees request IP; removes 3rd-party call from customer stores (06 §4.1). |
| R15 | Decide the canonical conversion-ingestion path | M | Bubble `wf/order-conversion-*` vs `/tracking/conversion` both live in the tutorial (06 §4.2) — deprecate one. 🔒 Q21. |

## P3 — Capability gaps (from 09 §3)

| # | Item | Effort |
|---|---|---|
| R16 | `created_list` event | S |
| R17 | Report consumption events (viewed/downloaded/shared) | S–M |
| R18 | Search→report funnel middle (result clicked / report opened from search) | M |
| R19 | influencer-crm + brand-safety + UGC module events | M |
| R20 | Real session semantics (or bless `user_logged_in` officially) | M |
| R21 | CI guardrail: emitter call sites ↔ 02-event-dictionary.md sync test | S–M |
| R22 | GTM container cleanup (second container, duplicate tags) | S 🔒 Q15 |

## Suggested sequencing

1. **Now (no dependencies):** R1*, R8, R9, R10, R13, R14, R16, R21
   (*R1 behind a quick Q10 confirmation).
2. **After Q-answers land:** R2 (Q11), R3 (Q9), R7 (Q13), R11 (Q12/15), R15 (Q21), R22 (Q15).
3. **After Sprint 4 measurements:** R4, R5, R6 (loss data decides the design).
4. **Roadmap-driven:** R17–R20 with product prioritization.
