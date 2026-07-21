# IMAI Data Work

Analytics/events audit and data documentation for the IMAI platform
(Discovery-imai). Compiled 2026-07-20 from a full codebase audit, live
infrastructure probes, and a first Mixpanel workspace audit via the Mixpanel
connector.

## Layout

| Path | Contents |
|---|---|
| `docs-events-audit/` | The 14-document audit corpus. Start at `00-overview.md` (index + executive summary). Includes the event dictionary, pipeline architecture (AWS collector + GCP topology), frontend/tag audit, Mixpanel measured inventory, ready-to-run data-quality SQL, tracking plan, remediation backlog, spending-report plan, and the living `OPEN_QUESTIONS.md` register (Q1–Q26). |
| `deliverables/` | Word documents: `IMAI-Analytics-Field-Guide.docx` (onboarding guide for data scientists working in Mixpanel / the logs DB) and `SCHEMA-Insights-Breakdown.docx` (complete breakdown of the internal usage-ai/SCHEMA.md data catalog). |
| `discovery-imai-patches/` | The 7 commits of audit + remediation work as git patches against Discovery-imai (base commit `df73c535`). Apply with `git am discovery-imai-patches/*.patch`. Patches 0001–0005 were also pushed to the `claude/events-audit-mixpanel-aws-8kdt11` branch on Discovery-imai; 0006–0007 exist only here. |

## Key facts (short version)

- Product events flow: app services → `CLOSE_WEBHOOK_URL` webhook → external
  pipeline → `imai_events` (logs/"pixel" Postgres, ~4.6M rows) → Mixpanel
  (lossy sync) + Klaviyo + Close CRM.
- The AWS leg is a legacy page-visit pixel: `t.imai.co` = AWS API Gateway
  (eu-central-1), beaconing URL + UTM/gclid at trial activation and search.
- The platform itself runs on GCP ("Leaders Prod", GCE + Cloud Run + GCS).
- Mixpanel (project 3432835) contains 104 events in TWO live namespaces —
  including a Title-Case pipeline with no emitter in the codebase
  (`Platform Usage` ≈1.6M events/30d) — see `07-destinations.md` §1.0.
- Revenue truth is split: prod `user_payments` (self-serve) + Close (manual
  deals). Never build dollar analysis on events.

## Open work

`docs-events-audit/OPEN_QUESTIONS.md` is the living register — answers unblock
marked sections. The top blocker is Q1: the value of `CLOSE_WEBHOOK_URL` in
prod env files (one grep on the discovery-prod VM).
