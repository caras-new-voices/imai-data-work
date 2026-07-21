# HANDOFF — IMAI Analytics/Events Audit & Data Work

**From:** Claude Code session on `InfluencerMarketing-Ai/Discovery-imai`, 2026-07-20/21
**To:** the next session, rooted on `caras-new-voices/imai-data-work` (this repo)
**Read this first, then `docs-events-audit/00-overview.md`.**

---

## 1. Mission & operating rules (user-set, still in force)

- **Goal:** comprehensive documentation of how events flow into Mixpanel and
  AWS to understand how users use the platform; then data analysis (current
  focus: a spending/revenue report) and remediation of gaps.
- **NEVER push to `InfluencerMarketing-Ai/Discovery-imai` on GitHub.** All
  work on that codebase stays local-only (user instruction, explicit). This
  repo (`imai-data-work`) IS the push destination for data work going forward.
- Work autonomously; don't stop to ask questions. **Blockers go into
  `docs-events-audit/OPEN_QUESTIONS.md`** (Q1–Q26, statuses, how-to-answer) —
  the user answers them over time; each answer unblocks marked doc sections.
- User likes deliverables as downloadable .docx files (two already produced,
  in `deliverables/`).

## 2. What exists in this repo

| Path | What |
|---|---|
| `docs-events-audit/` | 14-doc audit corpus. `00-overview.md` = index. `OPEN_QUESTIONS.md` = the living blocker register. `11-spending-report-plan.md` = current active workstream. |
| `deliverables/` | `IMAI-Analytics-Field-Guide.docx` (DS onboarding for Mixpanel/logs DB), `SCHEMA-Insights-Breakdown.docx` (breakdown of the internal data catalog). |
| `discovery-imai-patches/` | 7 git patches vs Discovery-imai base `df73c535`. 0001–0005 also exist on branch `claude/events-audit-mixpanel-aws-8kdt11` on GitHub (pushed BEFORE the no-push rule). 0006 (Mixpanel workspace audit findings) and 0007 (spending plan) are **local-only — this repo is their only copy**. |

## 3. Unresolved administrative items

1. **Remote branch `claude/events-audit-mixpanel-aws-8kdt11` still exists on
   Discovery-imai** (5 commits, docs + remediation batch 1). User wants no
   changes on GitHub; deletion was attempted but blocked by permissions.
   User must delete it in GitHub UI, or a session may retry
   `git push origin --delete claude/events-audit-mixpanel-aws-8kdt11` with
   user approval.
2. Remediation batch-1 **code changes** (patch 0005: proxy prod-gate, secret
   env extraction, created_list event, CI guardrail test) are not deployed
   anywhere — they exist only in the patches. If the team wants them, they
   need a sanctioned PR route later.
3. Commit signing was broken in the old container (empty signing key) — the
   stop hook complained every commit; harmless, but expect fresh sessions to
   re-create commits from patches if signed history is wanted.

## 4. The system, as established (full detail in docs; this is the recap)

**Event pipeline:** three fire-and-forget emitters (backend/main
`users.service.ts:3729` prod-gated; proxy `index.js` — now prod-gated by
patch 0005, previously NOT; social-listening) POST ~55 event names + dynamic
`trial_*` families to `CLOSE_WEBHOOK_URL` (value unknown = **Q1, top
blocker**; one grep on the discovery-prod VM answers it) → external pipeline
(not in any visible repo) → **`imai_events`** (logs/"pixel" Postgres, ~4.6M
rows) → Mixpanel sync (lossy/lagging) + Klaviyo (~97 event-named lists,
~10% loss) + Close CRM (stages mirror BACK into imai_events).

**AWS leg:** legacy page-visit pixel. `t.imai.co` = AWS API Gateway custom
domain `d-gnyi890n7g.execute-api.eu-central-1.amazonaws.com`; white-label
`pixel.js` (S3 `influencerprofiles`, ap-northeast-1) beacons to
`47dwgl20q6.execute-api.eu-central-1.amazonaws.com/prod?saveData=true&url=…`
with full query string (UTM/gclid). Fires at trial activation
(`home.component.ts:116`, `?u=1`) and on influencer search. Lambda + write
target unconfirmed (Q2).

**Platform infra:** everything else is GCP — GCE VMs `discovery-prod`/`-stag`
(project "Leaders Prod", pm2, deploy via `deploy/deploy.js`), Cloud Run
campaign-tracker, GCS storage. `api.influencermarketing.ai` = Bubble behind
Cloudflare. Two server-only services not in the repo: `backend/scraper`,
`backend/frontend-logger` (Q8).

**Frontend tags:** GTM ×2 (`GTM-PBZ6TBF` + `GTM-5TRH876J` "LEADERS",
contents unaudited = Q15), GA4 `G-TD1DHH379G` (+ server-side MP `purchase`
with hardcoded client_id — Q11), Clarity `kaw00ybizl`, Segment/"PRophet"
(identify-only), VWO. Raw email goes into dataLayer; all ~50 white-label
domains load IMAI's tags (Q12/Q13). Trial-friction events go frontend →
whitelisted `POST /data/pipedrive/trial-event` → webhook.

**Separate system:** customer e-commerce conversion pixel (`sdk/pixel.js` →
`/tracking/*` → campaign tables, clickId→coupon→IP attribution). Not product
analytics. Three things are called "pixel" — disambiguation table in
`06-conversion-pixel.md`.

## 5. Mixpanel — measured 2026-07-20 (connector; project 3432835)

- **104 events in TWO live namespaces.** (a) Title-Case with NO codebase
  emitter — `Platform Usage` **1.61M/30d**, `Influencer Report` 33.2k,
  `Influencer Search` 11.1k, `Login` 10.7k, `Campaign Media Scraped` 6.6k,
  `Added Influencer to List` 6.3k… source unidentified (**Q24**). (b) The
  snake_case webhook namespace matching the code dictionary.
- **Renamed lifecycle events:** `new_subscription_trial`→`Free Trial Signup`,
  `cancel_subscription`→`Cancelled Subscription`, `created_report`→
  `Influencer Report`(?) — the snake names DON'T EXIST in Mixpanel.
- **Live duplicates:** `Login` 10,739 vs `user_logged_in` 10,275;
  `Influencer Search` 11,118 vs `influencer_discovery_search` 18,765
  (**41% apart — Q25**, changes search KPIs by half).
- **Missing from Mixpanel entirely:** the social-listening family,
  `pr_sent_pitch`, `first_campaign_created`, part of trial-friction,
  `high_value_signup` (Q26).
- **Lexicon hygiene = zero** (no descriptions/tags anywhere; no business
  context configured). Offering to write Lexicon descriptions from the
  dictionary is a standing next step.
- Connector gotchas: call `Get-Business-Context` first (it's empty here);
  `"All Events"` is NOT a valid metric eventName (breakdown queries return
  `{}` silently) — query explicit event names in batches; per-event 30d
  volumes for all 104 events are recorded in `07-destinations.md` §1.0.

## 6. Spending workstream (ACTIVE — `11-spending-report-plan.md`)

Measured 30d funnel [Mixpanel]: **1,854 signups → 254 payment attempts →
213 cards → 79 blocked (abuse gate ≈34% of card-enterers!) → 153 trials →
34 paid (~22%) → 5 upgrades**. Drop-off ranking: (1) signup→card cliff, 86%,
UNINSTRUMENTED; (2) abuse-gate false positives; (3) first-4-hours (median
trial cancel ~4h); (4) passive autocharge conversion; (5) invisible renewal
leakage (`payment_failed` 218/30d, `payment_success` sees 36% of dollars);
(6) expansion vacuum (trial-only limit events); (7) manual-account renewal
risk (~280 of 561 manual payers have zero events ever).

**Revenue ground truth is split:** prod `user_payments` (self-serve; whole
dollars, epoch `created`) + Close (manual/enterprise deals — the MAJORITY of
paying accounts). Never build dollar analysis on events. Plans: $99/$499/$1200;
IL ×1.17 VAT quirk.

Next analysis steps (Mixpanel connector alone): monthly cohorted funnel;
`free_trial_blocked` error-payload analysis; friction-placement → conversion
paths; dashboards/reports inventory (Q20 — gates tracking-plan renames).

## 7. Key verified numbers to reuse (from usage-ai/SCHEMA.md, dated)

Trial 7 days; trial→paid median 6.9d, ~76% day 6–8; trial cancel median ~4h;
`cancel_trial` born 2026-04-22 (union recipe for full trial churn);
paying churn needs prior-payment EXISTS filter (raw ~4× too high);
`payment_failed` = dunning noise (6,000:44); event log ≈70% of charges /
36% of recurring dollars (June 2026); "isActive" lies (~2,170 raw vs ~650
real — endTime+endTrial filter); resellers only via `reseller_stripe_cuid`;
health score formula in `usage-board.service.ts:1909` replicates Mixpanel's;
trial-friction events born 2026-06-30; calendar-day windows always.

## 8. Access & tooling status

- **Mixpanel connector:** org-connected; per-session toggle needed (session
  connectors panel). Was working; disconnects happen — re-toggle.
- **Close connector:** reaches the **NewVoices org, NOT IMAI's** — IMAI Close
  automations uninspectable (Q6).
- **No access yet:** logs DB (Q3 — `08-data-quality.md` has ready-to-run
  validation SQL), prod DB, AWS console (Q2), GTM (Q15), make.com, prod env
  values (Q1), Klaviyo admin (Q5).
- GitHub: sessions are single-owner; a session on this repo cannot also
  attach Discovery-imai (and vice versa) — plan work accordingly.
- Old-container quirks (may not apply in new session): LibreOffice broken
  (docx verification via zip/XML checks instead), commit signing broken.

## 9. Suggested immediate agenda for the new session

1. Commit this zip's contents as the repo baseline (README.md is written).
2. Re-enable Mixpanel connector → run the spending plan §6 step 1 (cohorted
   funnel + abuse-gate analysis) → produce the first State-of-Spending
   interim report (docx).
3. Q20: inventory Mixpanel dashboards/saved reports via connector.
4. Offer to write Mixpanel Lexicon descriptions + project business context
   from the event dictionary (user hasn't approved yet — ask once).
5. Keep nudging the register: Q1 (env grep) is still the highest-leverage
   unanswered question; Q24 (Title-Case pipeline source) is the biggest
   data-understanding gap.
