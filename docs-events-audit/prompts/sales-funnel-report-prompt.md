# Prompt: Build the IMAI Sales Funnel Report

> Reusable prompt, authored 2026-07-21. Paste into a fresh session with the
> Mixpanel connector enabled (and Close, if IMAI-org access ever lands).
> Encodes the audit's ground rules so the numbers come out right.

## Role & goal

You are a data analyst working on the IMAI (InfluencerMarketing.ai)
analytics workspace. Build a **sales funnel report** covering both revenue
engines: the **self-serve funnel** (signup → trial → paid, measurable in
Mixpanel) and the **sales-led funnel** (Close CRM pipeline: lead → demo →
won). Deliver it as a Word document (.docx) plus a committed markdown source
in the `caras-new-voices/imai-data-work` repo.

## Read these first (in the repo)

1. `docs-events-audit/12-mixpanel-lexicon.md` — every event's meaning, tags, and traps
2. `docs-events-audit/11-spending-report-plan.md` §0 (ground rules) and §7 (latest measured baselines)
3. `docs-events-audit/OPEN_QUESTIONS.md` — active blockers (especially Q6, Q27)

Mixpanel project: **3432835**. The project business context is populated —
call `Get-Business-Context` first and follow it.

## Funnel A — self-serve (Mixpanel)

Build a monthly-cohorted funnel with exactly these stages and events:

| Stage | Event | Rules |
|---|---|---|
| Signup | `signup` (snake_case) | NOT Title-Case `Signup` (import duplicate). Exclude accounts that also have `user_created_by_admin`. |
| Card entered / trial started | `Free Trial Signup` | This IS the renamed `new_subscription_trial`; the snake name doesn't exist in Mixpanel. |
| Blocked at gate | `free_trial_blocked` | Report alongside, not as a funnel step. No reason property exists (Q27) — geo breakdown only. |
| Trial canceled | `cancel_trial` | Born 2026-04-22. For full trial churn, union with `Cancelled Subscription` filtered to trial users, deduped. |
| Converted to paid | `new_subscription_payment` | Dedupe per user: first payment = min(date). Use a **14-day conversion window** from `Free Trial Signup`. |
| Expansion | `upgrade_package_payment` | Report as count; volume is tiny (~2–5/mo). |

Method requirements:

- Use Mixpanel **funnels** reports (unique count) with a 14-day window,
  cohorted by calendar month of trial start, for at least the last 6 full
  months. End the cohort window ≥14 days before today to avoid
  right-censoring.
- Report per cohort: signups, trials, trial→paid %, avg time-to-convert,
  active-cancel %.
- Do **not** use `Payment Attempt` or `Added Payment Method` as funnel
  steps — they are Stripe integration telemetry including renewals and
  dunning retries. You may use `Payment Attempt` filtered to
  `Status='succeeded'` as a sanity cross-check only.
- Trial-friction events (`trial_*`) were born **2026-06-30** — only analyze
  them for cohorts after that date, and label sample sizes.
- Breakdowns worth running: `mp_country_code` (signup quality + gate
  block-rate by market); day-of-week seasonality if signal exists.

Sanity benchmarks (July 2026 — flag any large deviation, don't silently
accept): trial→paid ≈ 13.6% in 14d, avg conversion ~8.2 days, signup→trial
11–14.5%, gate blocks ~30% of card-enterers.

## Funnel B — sales-led (Close CRM)

The Close pipeline stages are mirrored into Mixpanel as events
(`Qualification`, `Discovery / Demo`, `Proposal / Buying`, `Won`,
`Won (Renewed/Expanded)`, `Lost`, `No Show`) — tagged `crm-mirror`. Caveats:

- Stage names exist in BOTH the Sales and CS pipelines and the mirror
  carries no `status_id` — treat stage counts as **approximate** and label
  them as such.
- Deal **values** live only in Close. Known session limitation: the Close
  connector reaches the **NewVoices org, not IMAI's** (Q6) — if that's
  still true, report stage volumes/velocity from the Mixpanel mirrors and
  explicitly mark dollar figures as blocked.
- Also report the demo-scheduling family (`scheduled_demo_*`,
  `canceled_demo_*`, `answered_scheduled_ai_agent_call`) as top-of-funnel
  sales activity.

## Hard rules (violating any of these invalidates the report)

1. **Never compute dollars from events** — the event log captured ~36% of
   recurring dollars (June 2026). Revenue = prod `user_payments`
   (self-serve) + Close deals (manual). If you lack both, ship the report
   with a "dollars blocked" section, not estimated dollars.
2. **Never mix namespaces in one metric** — snake_case (webhook),
   Title-Case usage (server import), Stripe events, and CRM mirrors are
   four different pipelines with different coverage.
3. **Exclude** admin-created accounts, internal/team emails, and
   white-label/reseller traffic where identifiable; roll team members up
   via `main_user_id`.
4. Calendar-day windows; state the timezone assumption.
5. Every number states its source and window; every known-partial metric
   carries its caveat inline (e.g., `payment_success` coverage, mirror
   ambiguity).

## Deliverable

- `deliverables/Sales-Funnel-Report-<YYYY-MM>.docx`: executive summary
  (5 bullets max, led by the biggest drop-off), the two funnels with
  monthly cohort tables, geo/gate analysis, sales-activity view, a "what's
  blocked and why" section, and 3–5 evidence-linked recommendations.
- Matching markdown committed to `docs-events-audit/` and pushed to the
  working branch.
- Update `OPEN_QUESTIONS.md` if you hit a new blocker; do not stop to ask —
  record it and continue with what's measurable.
