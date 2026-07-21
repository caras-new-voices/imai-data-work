# Events & Analytics Documentation — Overview

**Audit executed 2026-07-20** (code + live probes). This folder is the
authoritative documentation of how user-behavior events are produced,
transported, and consumed across the IMAI platform — and the living plan to
finish the parts that require external access.

## Read this first: the system in five sentences

1. Three server emitters (backend/main, proxy, social-listening) POST
   ~55 named events + 4 dynamic families to an env-configured webhook
   (`CLOSE_WEBHOOK_URL`) — fire-and-forget, no retries.
2. An **external pipeline (not in this repo)** fans those events into the
   logs/"pixel" Postgres (`imai_events`, ~4.6M rows), **Mixpanel** (lossy,
   lagging sync), **Klaviyo** (metrics + ~97 event-named lists driving all
   lifecycle email), and **Close CRM**.
3. The **AWS leg** is a legacy page-visit pixel: `t.imai.co` = AWS API
   Gateway (eu-central-1); it fires at trial activation + influencer search
   and captures URL + UTM/gclid (the attribution feed). Everything else
   runs on **Google Cloud**.
4. The frontend separately runs GTM ×2, GA4, Clarity, Segment and VWO, plus
   a whitelisted bridge that lets trial-friction clicks become server events.
5. A completely separate **customer conversion pixel** (sdk/pixel.js →
   `/tracking/*` → campaign tables) measures IMAI clients' store purchases —
   do not confuse the two "pixels".

## Document index

| Doc | Contents | State |
|---|---|---|
| [EVENTS_AUDIT_PLAN.md](./EVENTS_AUDIT_PLAN.md) | Original audit findings + sprint plan | reference |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | **Living question register (Q1–Q21)** — add here, never delete | live |
| [01-architecture.md](./01-architecture.md) | End-to-end pipeline, live-probe evidence, access requests | done to access limit |
| [02-event-dictionary.md](./02-event-dictionary.md) | Canonical event catalog (server-side) | done; volumes pending Q14 |
| [03-emitters.md](./03-emitters.md) | The 3 emitter implementations, bridges, side channels | done |
| [04-frontend-analytics.md](./04-frontend-analytics.md) | Client tags, GTM/GA4/Clarity/Segment, client↔server map, PII | done; GTM internals pending Q15 |
| [05-gtm-containers.md](./05-gtm-containers.md) | GTM container audit | blocked (Q15) — procedure ready |
| [06-conversion-pixel.md](./06-conversion-pixel.md) | Customer conversion SDK/plugins/attribution | done |
| [07-destinations.md](./07-destinations.md) | Mixpanel/Klaviyo/Close/GA4 + coverage matrix | knowns done; audits pending Q5/Q19 |
| [08-data-quality.md](./08-data-quality.md) | Ready-to-run SQL validation playbook | ready — needs logs-DB access (Q3) |
| [09-tracking-plan.md](./09-tracking-plan.md) | Taxonomy proposal, keep/rename map, missing events | proposal — needs review |
| [10-gaps-and-remediation.md](./10-gaps-and-remediation.md) | Ticket-ready backlog R1–R22, sequenced | ready |

## What we can and cannot answer today

**Answerable now (from these docs):** what fires on any user action and from
where; what each event's payload and caveats are; which tool can be trusted
for which question (07 §5 coverage matrix); where the AWS and GCP pieces
live; every known data-loss mode and its workaround.

**Blocked (all itemized in OPEN_QUESTIONS.md):** the webhook receiver's
identity (Q1 — one grep on the prod VM), the Lambda/logs-DB internals (Q2/Q3),
the Mixpanel sync mechanics and workspace inventory (Q4/Q19), Klaviyo's
pusher (Q5), the orphan events' emitter (Q6), and GTM container contents (Q15).

## Operating model

Progress does not stop on blocked items: questions accumulate in the
register with exact answering procedures; each answer unblocks a marked
section of a doc. Engineering fixes are pre-sequenced in
10-gaps-and-remediation.md (batch 1 has no dependencies at all).
