# 09 — Tracking Plan v1 (Sprint 5 — PROPOSAL, needs stakeholder review)

**Status:** Draft proposal from the audit. Nothing here is applied. Renames
must wait for the Mixpanel/Klaviyo protected-names audit (Q19/Q20) because
downstream automations key on exact strings (Klaviyo lists, Close flows).

## 1. Naming convention (proposed)

- `snake_case`, verb-first past tense for actions: `object_action` →
  **`<domain>_<object>_<action>`** for new events (e.g. `campaign_created`,
  `report_created`, `trial_upgrade_clicked`).
- No entity names/IDs baked into event NAMES (violations today:
  `scheduled_forced_onboarding_tehilla`, per-rep `scheduled_*_call`
  variants, `trial_upgrade_<placement>`) — move the variable part to a
  property (`placement`, `rep`, `feature`).
- Reserved prefixes: `trial_` (friction/intent), `pr_` (PR module),
  `social_listening_`, `first_` (activation milestones).
- Sales/CRM mirror events must be namespaced `crm_<stage>` instead of raw
  stage labels colliding with product events.
- Required base properties on every event: `user_id`, `main_user_id`,
  `email`, `white_label` (NEW — today stripped), `source_service`
  (NEW — backend|proxy|social-listening|frontend-bridge).

## 2. Keep / rename / merge / deprecate map

| Current | Verdict | Notes |
|---|---|---|
| Core lifecycle (`signup`, `new_subscription_trial`, `new_subscription_payment`, `cancel_trial`, `cancel_subscription`, `payment_failed`, `upgrade_package_payment`, `free_trial_blocked`) | **KEEP as-is** | Protected: Klaviyo lists + Close automations + Mixpanel history key on these. |
| `payment_success` | KEEP name, **fix coverage** | Either emit on ALL renewal paths (incl. big annual/enterprise) or explicitly document as partial. Never rename — trend history. |
| `created_campaign` + `campaign_created` | **MERGE** (Q9) | Keep whichever downstream uses; emit once. Decide after Q9 volume check. |
| `created_report` / `created_geo_analysis` / `created_social_listening_report` vs `first_*_created` | KEEP | Consistent enough; document the `first_` milestone convention. |
| `scheduled_forced_onboarding_tehilla` | **RENAME** → `forced_onboarding_scheduled` (+`rep` property) | Person-named event. |
| `trial_upgrade_<placement>` family | KEEP short-term, **collapse long-term** → `trial_upgrade_clicked` + `placement` property | 15 names for one action makes Mixpanel funnels painful; but Klaviyo/Close may key on specific placements — verify first. |
| `trial_{feature}_{daily|total}_limit_reached[_dayN]` | Same treatment → `trial_limit_reached` + `{feature, period, trial_day}` | Properties already exist in the payload — the name duplication is redundant. |
| Close stage labels as events (`Qualification`, `Won`, …) | **NAMESPACE** → `crm_stage_changed` + `{stage, pipeline}` | Blocked on finding the mirror mechanism (Q6). |
| Orphans (`high_value_signup`, `scheduled_demo_*`, `scheduled_ai_agent_call*`) | DOCUMENT once emitter found (Q6) | Then apply naming rules. |
| `user_logged_in` | KEEP | Sole session proxy; consider adding real session events (below). |

Migration rule: renames are **dual-emit** (old+new) for one quarter with a
Mixpanel Lexicon alias, then old is dropped; Klaviyo lists get re-pointed
during the dual window.

## 3. Missing events (gap candidates — validate with stakeholders)

From code reading, these user actions emit NOTHING to the pipeline today:

1. `created_list` (only `first_list_created` exists — list cadence invisible).
2. Report viewed/downloaded/shared (creation is tracked, consumption isn't).
3. List → influencer added (health score references an 'Added Influencer to
   List' Mixpanel name, but no in-repo emitter — likely a dead/legacy event; Q19).
4. Search filters used / result clicked → report opened (search→report
   funnel has no middle).
5. CRM/outreach module actions (influencer-crm has no events at all).
6. Session end / duration (only login exists).
7. Feature-level adoption for brand-safety, overlap, UGC workspace — zero events.
8. White-label tenant activity as a first-class dimension (Q13).
9. API-key (programmatic) usage visible only in proxy billing, never as events.

## 4. Governance (proposed)

- **This folder is the tracking plan.** A new event = PR touching
  02-event-dictionary.md + the emitter code; reviewers include a data owner.
- CI guardrail (Sprint 5 backlog item): test extracts event names from
  `sendPipeDriveWebhook(` call sites + the trial whitelist and fails if any
  name is missing from 02-event-dictionary.md.
- Quarterly: re-run 08-data-quality.md §1 diff; update SCHEMA.md verified
  dates.
- Ownership table (fill in): pipeline infra (❓ Q1/Q2), emitters (backend
  team), Mixpanel (❓), Klaviyo (marketing), Close (sales ops), GTM/GA4
  (marketing — Q15).
