# 11 — Platform Spending Report: Plan

**Status:** Plan + first measurements, 2026-07-20. Numbers marked [MP-30d] were
measured live via the Mixpanel connector (project 3432835, 30 days to
2026-07-20); numbers marked [SCHEMA] are the internal catalog's verified
baselines (dates noted there). Dollar-denominated sections are blocked on
prod-DB / Stripe / Close access and marked accordingly.

---

## 0. Ground rules for any spending analysis (from the audit)

1. **There is no single complete revenue record.** Prod `user_payments` =
   authoritative for Stripe+Cardcom self-serve; **manual/invoiced (enterprise)
   deals exist only in Close** (561 of ~648 paying accounts are `manual`!).
   Every revenue statement must say which population it covers.
2. **Never build dollar analysis on events** — the event log captured 36% of
   recurring dollars in June 2026. Events are for *behavioral* funnel steps;
   `user_payments` + Close are for money.
3. Self-serve plan prices: $99 (Individuals) / $499 (Growth) / $1200 (Scale);
   `amount` is whole USD; IL-billed charges carry ×1.17 VAT; Close deal values
   are cents and annualized as entered.
4. Exclude internal emails, admin-created users, white-label/reseller traffic;
   roll team members up to `main_user_id`; calendar-day windows.

## 1. The spending flow (how money actually moves)

```
signup ──► card page ──► card accepted ──► 7-day trial ──► day-6-8 AUTOCHARGE ──► recurring renewals ──► churn
  │             │              │                │                  │                      │
  │             │         free_trial_blocked    │            (default-driven:        payment_failed
  │             │         (abuse gate)     cancel median      ~76% of payers pay      (dunning)
  │        (UNINSTRUMENTED                 ~4 HOURS in         via autocharge)            │
  │         — no events between            [SCHEMA]                │                  recovery?
  │         signup and card result)                          upgrade_package_payment
  │                                                          (expansion — nearly zero)
  └──► sales-led path: demo → Close opportunity → manual/invoiced deal (invisible to user_payments)
```

Two revenue engines with different physics:
- **Self-serve** (Stripe, minority of accounts but the growth funnel): trial
  autocharge is the conversion moment; engagement in the first hours decides it.
- **Sales-led** (manual, majority of paying accounts): renewal = CS
  relationship + admin-set `endTime`; usage health is the only leading signal
  (~280 of 561 manual payers have ZERO platform events ever [SCHEMA]).

## 2. The funnel, with real 30-day numbers [MP-30d]

| Stage | Event | 30d count | Step conversion |
|---|---|---|---|
| Signup | `signup` | 1,854 | — |
| Payment attempted | `Payment Attempt` | 254 | **13.7% of signups** |
| Card saved | `Added Payment Method` | 213 | 84% of attempts |
| Blocked at card (abuse gate) | `free_trial_blocked` | 79 | **~34% of card-entering users** (79 vs 153 passed) |
| Trial started | `Free Trial Signup` | 153 | **8.3% of signups** |
| Active trial cancel | `cancel_trial` (+ legacy path) | 48 | ~31% of trials cancel actively |
| Trial → paid | `new_subscription_payment` | 34 | **~22% of trials** (cohort-window caveat) |
| Expansion | `upgrade_package_payment` | 5 | ~0.8% of paying base/month |
| Churn intent | `started_cancellation_process` | 75 | |
| All cancels | `Cancelled Subscription` + `cancel_trial` | 86 + 48 | needs trial/paying split |
| Payment failures | `payment_failed` | 218 events | dunning noise — distinct users TBD |
| Refunds | `refund` | 4 | |

Cross-check when logs-DB access lands: these Mixpanel counts vs `imai_events`
vs proxy billing rows (08-data-quality.md §5).

## 3. Where the drop-off is (evidence-ranked)

1. **Signup → card page: the cliff.** 1,854 signups → 254 payment attempts.
   ~86% of signups never even attempt payment — and this segment is
   **uninstrumented** (no events between `signup` and card-result; the trial
   page view, pricing page view, and card-form abandonment emit nothing).
   Biggest measurement AND biggest revenue lever.
2. **The abuse gate: 79 blocks vs 153 passes.** If even 15–20% of
   `free_trial_blocked` are false positives, that's +8–10% trials/month.
   Nobody currently reviews block quality (error text is in the event payload).
3. **The first 4 hours of trial.** Median active cancel at ~4h [SCHEMA] —
   value must land in session one. Activation metric exists
   (`first_report_created` in trial window; 427/30d vs 153 trials — includes
   non-trial users, needs cohorting).
4. **Trial → paid at ~22%**, but ~76% of conversions are day-6-8 autocharge —
   i.e., conversion is substantially "didn't cancel" rather than "actively
   bought". Friction events (trial_upgrade_* ≈60/30d, unlock modal 83/30d)
   show real intent volume to work with.
5. **Renewal leakage is invisible.** `payment_failed` 218 events/30d with no
   recovery tracking; `payment_success` misses the big renewals — recovery
   rate is currently unmeasurable without `user_payments` (R4 fix or DB access).
6. **Expansion is ~zero.** 5 upgrades/month. All limit/upgrade-intent
   instrumentation is TRIAL-ONLY — paying users hitting plan limits emit
   nothing and see fewer prompts. No usage-based expansion motion exists.
7. **Manual-account renewal risk.** 561 manual payers; ~280 with zero events
   ever; health score exists but the CS outreach loop off it is (per
   usage-board cards) new.

## 4. The questions the report should answer

**Money (blocked on prod `user_payments` + Close + Stripe):**
- MRR/ARR by plan and payment type (stripe/cardcom/manual), trend 24 months.
- ARPU / AOV; revenue concentration (top-N accounts % of revenue).
- Net revenue retention: renewal dollars, expansion dollars, churned dollars.
- LTV by cohort, by acquisition channel (join `attribution` sheet), by plan.
- Dunning: failed→recovered rate, involuntary-churn share of total churn.
- Refund rate; duplicate-charge prevention effectiveness (169 blocks/30d!).
- Manual-deal renewal calendar (Close `Next Renewal Date` custom field) vs
  usage health — the at-risk-renewal dollars number.

**Behavior (answerable now / with logs DB):**
- Full funnel above, cohorted monthly, split self-serve vs sales-led.
- Time-to-value: what did converters do in hours 0–4 that cancelers didn't?
- Which trial-friction placements correlate with conversion vs cancellation?
- Does hitting a limit (`trial_*_limit_reached`) raise or kill conversion?
- Search/report/campaign usage depth vs plan tier — who's outgrowing $99?

**Pricing/packaging (needs the above):**
- Price-point mix over time; do $499/$1200 convert at different trial rates?
- Are annual/enterprise renewals (the big dollars) correlated with usage?

## 5. Recommendations to increase revenue (proposed, evidence-linked)

Quick wins (instrument + operate):
1. **Instrument the signup→card gap** (pricing page view, card form opened,
   abandoned) — you cannot fix an 86% cliff you can't see. [drop-off #1]
2. **Audit the abuse gate**: weekly review of `free_trial_blocked` payloads;
   measure false-positive rate; add a manual-review recovery path. [#2]
3. **Dunning program**: measure failed→recovered per user; add smart retries /
   card-updater; target involuntary churn first — it's the cheapest revenue. [#5]
4. **Fix `payment_success` coverage (R4)** so renewal dollars become visible
   to monitoring without DB access.

Product motions:
5. **Win the first 4 hours**: onboarding that lands a completed report in
   session one (activation = `first_report_created`); pre-built sample value;
   measure activation→conversion lift. [#3]
6. **Build the expansion motion**: extend limit/upgrade-intent events to
   PAYING users; usage-based upgrade prompts at plan ceilings; target the
   $99→$499 path. 5 upgrades/month is a vacuum, not a result. [#6]
7. **At-risk renewal playbook**: health score < 60 + upcoming `Next Renewal
   Date` → CS outreach list (the usage-board card already computes the worst
   list); prioritize manual accounts (biggest dollars, zero-usage tail). [#7]
8. **Convert intent signals**: 83 unlock-modal opens + 60 upgrade clicks/month
   are hand-raisers — route high-intent trial users to fast human follow-up
   (the trial_book_call events exist but fire ~3/month — the CTA is invisible).

## 6. Execution order

1. **Now (no access needed):** cohort the Mixpanel funnel monthly; property-level
   analysis of free_trial_blocked errors and trial-friction→conversion paths.
   (Mixpanel connector — reconnect when needed.)
2. **With logs DB (Q3):** verify funnel vs imai_events; hours-0–4 behavioral
   diff converters-vs-cancelers; limit-hit→conversion correlation.
3. **With prod DB:** all §4 money questions for self-serve; dunning recovery;
   NRR. **With Close (IMAI org, Q6):** manual-deal revenue + renewal calendar →
   the complete-revenue picture (self-serve + manual).
4. **Then:** the actual "State of Spending" report — one document, both
   engines, with the §5 recommendations sized in dollars.
