# REFRESH-NOTES — Discovery-imai architecture refresh, 2026-07-22

**Session:** read-only refresh rooted on `InfluencerMarketing-Ai/Discovery-imai`.
**Baseline:** `df73c535` (2026-07-20 audit) → **HEAD audited:** `da98fcf2` (2026-07-22).
**Commits reviewed:** all 25 between the two (list at the bottom).
**Outputs:** updated `imai-architecture.json` + `imai-architecture.html`, edited
`02-event-dictionary.md`, `03-emitters.md`, `04-frontend-analytics.md`,
`OPEN_QUESTIONS.md` (full copies), this file. `06-conversion-pixel.md` needs **no**
edits (sdk/ and the tracking module are untouched since df73c535).

---

## 1. HEADLINE FINDING — the R-series remediations are NOT in this repo

The audit docs record R1/R2/R8/R16/R21 as "Done 2026-07-20". **None of them exist
in Discovery-imai — not at df73c535 and not at HEAD.** They evidently live only as
patches in `discovery-imai-patches/` in the docs repo and were never merged. The
docs and JSON described the *patched* state as if it were the repo's state. Verified
at HEAD:

| R | Docs' claim | Reality at `da98fcf2` |
|---|---|---|
| R1 | proxy emitter prod-gated (`NODE_ENV==='production' && !STAGING`) | `proxy/index.js:112 sendPipeDriveWebhook` has **no gate at all** — fires whenever `CLOSE_WEBHOOK_URL` is set. Q10 is still live. |
| R2 | GA4 MP purchase gated, env-based ids/secret | `payments.service.ts:1789-1810` still hardcodes `G-TD1DHH379G` + `api_secret` inline; no env gate; allowlist `{99,499,1200}`. |
| R8 | secrets env-first via `src/shared/integration-endpoints.ts` | File **does not exist**. Slack hooks (`users.service.ts:3838/:3889`, `mail.service.ts:614`), make.com email-test hook (`:3823`), Bubble URLs (`:3856/:3874`, `Influencer.service.ts:631`) all still hardcoded. |
| R16 | `created_list` event added to `lists/list.controller.ts` | **No `created_list` emitter anywhere in the repo.** Only `first_list_created` (`list.controller.ts:273`). Unless the patch was applied out-of-band on the prod VM, the event never fires — the dictionary's "birth date 2026-07" claim is wrong for this repo. |
| R21 | CI guardrail `src/tests/event-dictionary-sync.spec.ts` | File **does not exist** (either commit). |

**Action for the docs repo:** either merge/deploy the patches through the normal
repo flow, or re-mark R1/R2/R8/R16/R21 as *proposed patches, unmerged* everywhere
(02/03/OPEN_QUESTIONS updated accordingly in this kit; Q10 flipped back to OPEN).
Also worth checking with the team whether the prod VM ever ran the patched code —
if `created_list` rows exist in `imai_events`, something out-of-band was deployed.

## 2. What actually changed since df73c535 (code)

25 commits; 2026-07-20 ones are docs/tooling only (stale generated docs deleted,
module READMEs added, `.claude/skills/module-docs` added). Architecture-relevant:

### a. Trial search-session window (`c6a0ece7`, 2026-07-21) — **measurement change**
- New env var **`SEARCH_COUNT_WINDOW_SECONDS`** (`users/constants/trial-gating.constants.ts`).
  ⚠ **Doc-vs-code bug:** the comment says "Default 300s (5 minutes)" but the code
  fallback is **50**. Worth flagging to the team.
- New column `subscription_count.lastCountedAt` (migration `1787000000000`).
- `consumeSearchQuota` (`users.service.ts:1810-1841`) + `tryConsumeTrialCount`
  (`subscription.service.ts:946`): within the window of the last *counted* trial
  search, further searches are allowed but **not counted** — one refinement session
  costs one search.
- Proxy (`index.js` `onProxyRes`): `incrementSubscriptionCount` is now **skipped for
  trial-gated users** (endTrial set + package has trial limits) — backend is
  authoritative; and any *falsy* skip counts as first page, so unified multi-platform
  search legs no longer each bump the count.
- **Analytics impact:** trial search *counts* (subscription_count, quota views)
  change meaning on the deploy date. The `influencer_discovery_search` **webhook
  event is unaffected** (still fires per user-initiated API call).

### b. Signup flow (`2d8bfcd9`, 2026-07-21) — **funnel change**
- Gmail-via-Google business-email gate **commented out** (`users.controller.ts:422-438`).
- `skipOnboardingLabels` now includes `'imai'` (registration.component.ts,
  google-sso.component.ts): **all IMAI signups go straight to `/trial`**, skipping
  `/get-started`.
- **Analytics impact:** expect `finished_onboarding` (webhook),
  `successful_onboarding_completed` (GTM) and the onboarding-path `trial_success`
  (GA4) to collapse from the deploy date; Gmail signups reappear (email-domain mix
  shift). `signup` itself is unchanged.

### c. Phyllo rich authorization status (`d6ae3ac6`, 2026-07-21)
- `influencer.phyllo_status` / `phyllo_last_attempt_at` columns (migration
  `1786000000000`); `scanPhylloStatus` (`phyllo.service.ts:41`) now also processes
  `SESSION.EXPIRED` webhooks.
- Confirms an **inbound side channel** previously undocumented in the map: Phyllo
  webhooks land in the **pixel DB's `phyllo_webhooks` table**, polled by
  backend/main via `campaignService.pixelDB()` — which connects with
  **`PIXEL_DB_HOST/USER/PASSWORD/NAME`** env vars (`campaigns.service.ts:1114-1126`).
  → new evidence for **Q3** (the logs-DB host is in backend/main's prod `.env`).
- Frontend: new `authorization-badge` component (display only, no analytics).

### d. Minor / non-analytics
- `jwt.interceptor.ts`: `X-White-Label` header no longer sent to external hosts
  (GCF uploadFile / GCS) — CORS preflight fix.
- Pricing page now shows Searches/Lists/Campaign-Influencers limits
  (`packages.service.ts` dropped the `Not(In(...))` filter).
- Trial banners/modals: Lottie art swap (cosmetic).
- Comparison report v2: date window derived from data (front-only fix).
- Social-listening post-enrichment: TikTok audience fix + doc-comment path fixes.
- `payments.controller.ts`: one comment edited (no behavior change).

### e. Event set: **no webhook events added or removed** since df73c535
Full sweep of `sendPipeDriveWebhook` call sites across all three emitters matches
the dictionary, with two corrections: `created_list` does not exist (see §1), and
the ai_usage category labels (`comment_sentiment_analysis`, `generate_campaign_*`,
`support_chat_turn`, …) are table rows, not webhook events (as already documented).

## 3. Line-reference corrections (all verified at `da98fcf2`)

Drift pattern: `users.service.ts` +5 before ~line 1810 / +4 after; `users.controller.ts`
+6 after line 419; everything else that the map references is byte-identical to
df73c535 (payments.service.ts, proxy lines <457, social-listening, frontend anchors,
sdk, deploy).

| Reference | Was (df73c535) | Now (da98fcf2) |
|---|---|---|
| backend/main webhook emitter | users.service.ts:3729 | **:3733** |
| PipeDriveData duplicate def | users.service.ts:75 | **:80** (user.interface.ts:49 unchanged) |
| trial dedup cache (`sendTrialPipeDriveEvent`) | :1652 | **:1657** |
| total-limit emit | :1702 | **:1707** |
| daily-limit emit | :1713 | **:1719-1721** |
| `sendTrialIntentEvent` | :1730 | **:1735** |
| `trial_feature_blocked` | :1936 | **:1940** |
| cancel ternary | :2190 | **:2195** |
| make.com cancellation | :2262 | **:2266** |
| mail-failure Slack (users.service) | :2644 | **:2649** |
| `deactivate_account` | :2391 | **:2396** |
| `signup` emit | :3041 | **:3046** (2nd site :3054) |
| Slack quota call sites | :3242-3551 | **:3246-3555** (hook in `sendBlockWebhook` :3835) |
| generic Bubble `sendWebhook` | :3704 | **:3708** |
| make.com email-test | :3816 | **:3820** (URL :3823) |
| Bubble ip-capture fn | :3845 | **:3849** (called users.controller.ts:1214, users.service.ts:3053, :4768 — the :1208 call site was in the **controller**, not the service) |
| Bubble blocked-signup | :3864 | **:3868** |
| cancel-subscription Slack | :3879 | **:3883** |
| `scheduled_forced_onboarding_tehilla` | :4468 | **:4473** |
| `user_logged_in` | users.controller.ts:1014 | **:1020** |
| `finished_onboarding` | :1770 | **:1777** |
| `started_cancellation_process` | :2343 | **:2349** |
| trial-event endpoint | :2382 | **@Post :2367**, `sendTrialIntentEvent` call **:2388** |
| proxy paginated search event | index.js:299 | **:300** |
| proxy metering (`onProxyRes`) | index.js:327-497 | **:327-518** |
| proxy dormant `check24Usage` call | index.js:318 | **:319** |
| GA4 signup (email) | registration.component.ts:434 | **:435** |
| GTM successful_signup (email) | :435 | **:436** |
| GA4 email_verified | :462 | **:463** |
| health score | usage-board.service.ts:1909 | unchanged, but full path is `src/usage-ai/services/usage-board.service.ts` |

Unchanged and re-verified: users.controller.ts:131/:219/:318; all
payments.service.ts refs (:500/:536/:1349/:1410/:1539/:1545/:1622/:1634/:1710/:1798
/:2084/:2210/:2265/:2325/:2376); tasks.service.ts:376; report.controller.ts:93-125;
campaigns.controller.ts:339/:346/:356/:833; campaigns-api.service.ts:242;
list.controller.ts:273; geo.controller.ts:111/:389; entity controllers;
social-listening.controller.ts:31/:115; segment-timing.service.ts:43/:195;
social-listening-users.service.ts:36; proxy index.js:112/:292; index.html:26/:40;
main.ts:198; home.component.ts:116; influencers.component.ts:351;
trial-gating.service.ts:49; error-logging.service.ts:10;
registration.component.ts:86/:105/:106; Influencer.service.ts:631;
mail.service.ts:614; deploy.js:63; Influencer.controller.ts:53/:75/:97
(event lines :54/:76/:98).

## 4. Open-question movement

| Q | Finding at HEAD |
|---|---|
| **Q10** | **Revert PARTIAL → OPEN.** No gate on the proxy emitter (R1 unmerged). |
| **Q11** | The "R2 partial shipped" note is wrong for this repo — GA4 MP is ungated with hardcoded ids/secret at HEAD. |
| **Q3** | **New evidence:** backend/main connects directly to the pixel DB (`PIXEL_DB_HOST/USER/PASSWORD/NAME`, campaigns.service.ts:1114). The prod `.env` grep for Q1 should also capture `PIXEL_DB_*` — answers the host half of Q3 in the same minute. |
| **Q9** | Unchanged: both `created_campaign` (:339) and `campaign_created` (:356) still fire. |
| **Q22** | Unchanged: `cors()` origin still commented out (index.js:34-38); allowed-domain lists still dead code. |
| **Q23** | Unchanged: no `trust proxy` anywhere in proxy or backend/main. |
| **Q24 / Q28** | Re-confirmed: no Mixpanel-import job and no Stripe→Mixpanel integration code anywhere in the repo. |
| **Q28 price points** | $599/$959/$175 are **not code-configured**: packages are DB rows. In code, $599 appears only in the DoReel white-label seed migration (`1739300000001-SeedDoReelWhiteLabel.ts`, Growth default w/ 7-day trial), $959 only in stale **de/es** trial i18n copy ("full feature set at $959/month" — the en copy has no price literal), $175 nowhere. Plan↔price mapping still needs Stripe/DB access. |

New question candidate for the register (suggest **Q29**): *were the
discovery-imai-patches ever deployed to prod out-of-band?* Decide by checking
`imai_events` for `created_list` rows and the prod VM's working tree
(`git status` on discovery-prod) — same SSH session as Q1.

## 5. Doc errata found while refreshing

- `SEARCH_COUNT_WINDOW_SECONDS`: code comment says default 300s, code says 50 —
  in-repo bug to report, and it decides which number our docs should quote (I
  documented **50** with the discrepancy flagged).
- 03-emitters called the ip-capture call sites all `users.service.ts`; one is in
  `users.controller.ts` (login path).
- The JSON's module list mentioned `shared/integration-endpoints.ts (since R8)` —
  removed (file doesn't exist).
- The health-score file lives at `src/usage-ai/services/usage-board.service.ts`
  (docs implied it sits at the usage-ai root).

## 6. Commits reviewed (df73c535..da98fcf2)

- `da98fcf2` 2026-07-22 Merge PR #145 (README update)
- `ed310ea2` fix(front): comparison report date window from data
- `c6a0ece7` **search counting per time interval** (§2a)
- `6297838f` chore: strip session permission grants from .claude/settings.json
- `af648984`, `d0d6324f`, `c07c6f0c` trial banner/modal Lottie art (+ jwt interceptor tweak in d0d6324f)
- `38e7915f` tiktok audience fix (social-listening enrichment)
- `2d8bfcd9` **feat(signup): all IMAI signups straight to trial, allow Gmail via Google** (§2b)
- `aea5a5f7` fix(pricing): show Searches/Lists/Campaign-Influencers limits
- `d6ae3ac6` **feat(campaigns): rich Phyllo authorization status** (§2c)
- `e3bde27f`, `cea908f8`, `d4a49d8d`, `b3230583`, `3573839d`, `dfe417ce`,
  `2f0a49a4`, `c60193e2`, `29d8755b`, `21f9d7a9` docs purge + module READMEs
- `c1a2a1a1`, `ef18ca94`, `9c235bc0`, `2b385757` .claude/skills/module-docs
