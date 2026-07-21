# 13 — Sales Funnel Report, July 2026

**Measured 2026-07-21** via Mixpanel connector (project 3432835), per the
method in `prompts/sales-funnel-report-prompt.md`. Word version:
`deliverables/Sales-Funnel-Report-2026-07.docx`.
Cohort windows are complete (14-day conversion windows end ≥Jul 14 < today);
July cohorts are shown for volume only, never for conversion rates.
Timezone: Mixpanel project time, calendar days. **Dollar figures cover the
STRIPE SELF-SERVE ENGINE ONLY** (the Stripe→Mixpanel integration's
`Amount Charged`, whole USD, `Status='succeeded'`). They exclude Cardcom
(IL) charges and all manual/enterprise Close deals — the majority of paying
accounts — and are unverified against the Stripe dashboard (Q28). Webhook
events still carry no usable dollars (Q27 + 36%-coverage rule).

## Executive summary

1. **The funnel's biggest leak is still the top:** ~85–88% of signups never
   reach the card page, unchanged across every month measured — and this
   segment emits zero events (uninstrumented).
2. **Trial quality collapsed under the Apr–May signup surge, then recovered:**
   cohorted trial→paid fell 35% (Feb) → 24% (Mar) → 11% (Apr) → 10% (May),
   then rebounded to **20% in June — the best absolute month ever (44
   conversions)** while signup volume stayed high. Whatever changed around
   June (gate tuning, traffic mix) is worth identifying and codifying.
3. **The abuse gate is heavy-handed in top markets:** 31% of all
   card-enterers blocked Apr–Jul (US 22%, UK 31%, Brazil 35%, Philippines
   49%). Stripe failed-charge volume confirms a real abuse wave (May: 634
   failed vs 120 succeeded) that receded in June.
4. **Sales-led wins doubled in May–June** (16 Won/month vs ~7 before);
   renewal tracking (`Won (Renewed/Expanded)`) began April. But sales
   top-of-funnel is flat: ~25–39 scheduled meetings/month regardless of the
   5× signup surge.
5. **Stripe self-serve revenue is in decline despite the funnel wins:**
   gross succeeded charges fell from ~$150.8k/mo (Nov 2025) to ~$67.3k/mo
   (Jun 2026). Payers recovered off the February trough (86 → 119 by June)
   but revenue-per-payer fell ~$874 → ~$565 — new self-serve cohorts buy
   smaller plans than the legacy base churning out. Growing conversion
   counts have not yet offset the mix shift.
6. **Customer $ value (Stripe, trailing 12 mo):** average payer worth
   $2,549 in total charges; median $959; p90 $5,489; 3.35 successful
   charges per payer on average.
7. **Expansion remains a vacuum** (2–5 upgrades/month) and active trial
   cancels improved from 60% of trials (May) to 41% (June).

## Funnel A — self-serve, monthly cohorts

Events: `signup` → `Free Trial Signup` → `new_subscription_payment`
(unique users, 14-day conversion window from trial start, per calendar-month
trial cohort). `free_trial_blocked` reported alongside.

| Cohort | Signups | Trials | Signup→trial | Blocked at gate | Trial→paid (14d) | Conversions | Avg time to convert | Active cancels |
|---|---|---|---|---|---|---|---|---|
| Feb 2026 | 155 | 20 | 12.9% | 28 | **35%** | 7 | 6.9 d | n/a (pre-event) |
| Mar 2026 | 374 | 51 | 13.6% | 36 | **24%** | 12 | 6.1 d | n/a (born Apr 22) |
| Apr 2026 | 1,033 | 185 | 17.9% | 116 | **11%** | 20 | 9.3 d | 30 (partial month) |
| May 2026 | 1,837 | 217 | 11.8% | 100 | **10%** | 21 | 10.9 d | 131 (60% of trials) |
| Jun 2026 | 1,527 | 221 | 14.5% | 69 | **20%** | 44 | 6.6 d | 90 (41% of trials) |
| Jul → 20 | 1,387 | 84 | (partial) | 29 | (censored) | — | — | 21 |

Reading:

- **The Apr–May quality dip is a cohort story, not a random wobble.** As
  signups ×5'd, conversion fell to ~10% and average time-to-convert
  stretched to 10.9 days (past the day-7 autocharge — i.e., delayed/retried
  charges), while gate blocks and Stripe failures peaked. June reversed all
  three at once: conversion 20%, time-to-convert back to 6.6 days
  (autocharge-shaped), blocks down to 69, Stripe failures down to 260.
- **The blended "13.6%" (Apr 1–Jul 6) hides this swing** — use monthly
  cohorts for any decision.
- Signup→trial has no trend (11.8–17.9%): the top-of-funnel cliff is
  structural. The trial page view, pricing view, and card-form abandonment
  emit nothing (top remediation item).

### Abuse gate (geo proxy — reasons unavailable in Mixpanel, Q27)

Apr 1 – Jul 20, unique users: **314 blocked vs 705 trials passed (31% of
card-enterers)**. By market: US 22% (32/143), UK 31% (37/118), Brazil 35%
(21/60), Turkey 34% (14/41), Philippines 49% (19/39). Cross-check: Stripe
`Payment Attempt` failures (total events) 296 (Apr) → 634 (May) → 260 (Jun)
vs stable 104–126 succeeded — a genuine abuse wave met the gate; the open
question is precision, answerable only from logs-DB block payloads.

### Trial friction → conversion (born 2026-06-30 — first read only)

July 1–20 cohort (86 trials): 40% opened the unlock modal; modal-openers
converted 15% (5/34) vs 13% cohort baseline (11/86). No lift evidence yet;
samples tiny; re-run with ≥2 full cohorts in September.

## Self-serve dollars — Stripe engine only

Source: Stripe→Mixpanel integration, `Payment Attempt` with
`Status='succeeded'`, `Amount Charged` in whole USD (validated against the
value distribution: plan-price shapes 99/499/599/1199/1200 + custom
amounts; failed charges log $0 and are excluded). **Not covered:** Cardcom
(IL) self-serve and all manual/invoiced Close deals. Completeness vs the
Stripe dashboard is unverified (Q28) — treat as directional until checked.

| Month | Gross revenue (succeeded) | Unique payers | Revenue / payer | Refunds |
|---|---|---|---|---|
| Nov 2025 | $150,836 | 171 | $882 | $12,267 |
| Dec 2025 | $139,038 | 159 | $874 | $7,240 |
| Jan 2026 | $100,438 | 127 | $791 | $6,209 |
| Feb 2026 | $78,271 | 86 | $910 | $3,396 |
| Mar 2026 | $74,628 | 88 | $848 | $1,419 |
| Apr 2026 | $86,764 | 99 | $876 | $9,142 |
| May 2026 | $80,210 | 108 | $743 | $2,126 |
| Jun 2026 | $67,258 | 119 | $565 | $3,021 |
| Jul → 20 | $50,672 | 64 | $792 | $1,896 |

Readings:

- **The Stripe engine shrank ~55% Nov→Jun** while the funnel improved. The
  payer count bottomed in February (86) and has recovered every month since
  (119 by June) — but revenue/payer fell to $565 in June, so gross kept
  sliding. The new self-serve cohorts skew to $99/$499; the revenue lost is
  higher-value legacy payers rolling off. July's partial pace (~$76k
  full-month equivalent) suggests stabilization.
- **Customer value (trailing 12 months, all Stripe payers):** average total
  charged per payer **$2,549**; median **$959**; p90 **$5,489**; average
  **3.35 succeeded charges** per payer. Use median for a typical self-serve
  customer; the mean is pulled up by a heavy tail (custom charges up to
  $7,500 observed).
- **Observed price points don't match the documented $99/$499/$1200 list.**
  Apr–Jul succeeded-charge mix by amount: $499×97, $599×69, $99×46,
  $175×42, $959×27, $1199/1200×20, plus a long custom tail ($1,916×4 …
  $7,500). $599, $959, $175 are undocumented price points — pricing has
  evolved past the docs (worth confirming which plans these are).
- **Refunds run ~2–8% of gross** ($1.4k–$12.3k/mo; April spiked to $9.1k
  during the abuse wave).

## Funnel B — sales-led (Close CRM mirrors — approximate)

Stage events are Close pipeline mirrors without `status_id` (ambiguous
across Sales/CS pipelines, Q6); treat as volumes, not a strict funnel.
Early-stage mirroring only began April 2026 (all zeros before).

| Stage (unique leads/mo) | Dec | Jan | Feb | Mar | Apr | May | Jun | Jul→20 |
|---|---|---|---|---|---|---|---|---|
| Identification | — | — | — | — | 38 | 16 | 8 | 4 |
| Qualification | — | — | — | — | 46 | 23 | 15 | 11 |
| Discovery / Demo | — | — | — | — | 9 | 3 | 3 | 1 |
| Proposal / Buying | — | — | — | — | 5 | 6 | 1 | 2 |
| **Won** | 3 | 9 | 2 | 8 | 7 | **16** | **16** | 6 |
| Won (Renewed/Expanded) | — | — | — | — | 3 | 20 | 14 | 6 |
| Lost | 13 | 8 | 9 | 6 | 12 | 9 | 10 | 4 |
| No Show | 2 | 1 | 4 | 1 | 8 | 10 | 4 | 1 |

Sales activity (top of funnel):

- `Scheduled Meeting`: 25–39/month, **flat all period** — sales
  top-of-funnel did not grow with the 5× signup surge.
- Demo bookings per rep (`scheduled_demo_*`): 2–10/month total; cancels
  run at a similar order of magnitude — small numbers, high cancel share.
- `answered_scheduled_ai_agent_call`: spiked to **23 in June** (vs 0–3
  before) — the AI-agent call motion got real usage in June.

Reading: **Won volume doubled in May–June** (16/mo vs 2–9 before) and
renewal wins are now visible (20 in May, 14 in June). But early stages are
too young (Apr start) and too thin (single digits at Demo/Proposal) for
stage-conversion or velocity claims. Won:Lost improved from roughly 1:1
(Dec–Apr) to ~1.6:1 (May–Jun).

## What's blocked and why

| Missing | Blocker | Unblocks |
|---|---|---|
| Complete dollars (Cardcom + manual deals; MRR, NRR) | prod `user_payments` + IMAI Close org (connector reaches NewVoices org, Q6); Stripe-integration completeness unverified (Q28) | The full revenue picture (Stripe-only view above is partial) |
| Abuse-gate false-positive rate | Block payloads stripped from Mixpanel (Q27); need logs DB (Q3) | Gate precision audit, recovery path sizing |
| Signup→card behavioral diagnosis | Segment uninstrumented (no events between signup and card result) | The single biggest funnel lever |
| Sales stage velocity | Mirrors lack status_id + only 3 months of history | True sales-funnel conversion rates |

## Recommendations (evidence-linked)

1. **Instrument the signup→card gap** (pricing page view, card form opened,
   card form abandoned). ~85–88% of signups vanish here invisibly, every
   month. [Funnel A]
2. **Find and codify the June fix.** Conversion doubled (10%→20%) while
   volume held. Diff June vs May: gate config changes, traffic sources,
   onboarding changes. If it was gate tuning, that quantifies the gate's
   prior false-positive cost. [Cohort table]
3. **Audit gate precision in top markets** once logs-DB access lands (Q3):
   US/UK block rates of 22–31% are hard to justify as pure fraud. [Geo]
4. **Grow sales top-of-funnel:** meetings are flat at ~30/month through a
   5× demand surge — route high-intent trial users (unlock-modal openers,
   40% of trials) to the booking flow; the `trial_book_call_*` CTA fires ~3
   times/month, i.e., it is effectively invisible. [Funnel B + friction]
5. **Scale the AI-agent call motion** if June's 23 answered calls correlate
   with the June Won/conversion jump — measurable next month. [Funnel B]
6. **Build the expansion motion:** 2–5 upgrades/month; limit/upgrade
   instrumentation is trial-only, so paying users hitting ceilings are
   invisible and unprompted. [Funnel A]

## Sources

Mixpanel project 3432835, queried live 2026-07-21: monthly insights
(uniques) for funnel-stage and CRM-mirror events; per-cohort funnels
reports (14-day window, unique count) Feb–Jun; geo breakdown of
`free_trial_blocked` vs `Free Trial Signup` Apr 1–Jul 20; `Payment Attempt`
by `Status`. Baselines from `11-spending-report-plan.md` §7 and the event
dictionary. Dollar figures come solely from the Stripe→Mixpanel
integration (`Amount Charged`, Status=succeeded) — Stripe self-serve only,
unverified vs the Stripe dashboard (Q28); webhook-event dollars remain
unusable (stripped, Q27; ≈36% coverage).
