# Discovery-imai patches (vs base commit `df73c535`)

Seven git patches capturing the events-audit work done on the
`InfluencerMarketing-Ai/Discovery-imai` codebase (which must never be pushed
to from these sessions). Patches 0001–0005 also exist on the remote branch
`claude/events-audit-mixpanel-aws-8kdt11` of Discovery-imai; **0006 and 0007
exist only here.**

## ⚠️ Patch 0005 is redacted

`0005-fix-events-remediation-batch-1-...patch` extracts hardcoded secrets
(3 Slack incoming-webhook URLs, 1 Bubble API bearer token) out of the code
and into env vars — so the original diff necessarily contained those live
secrets. GitHub push protection (correctly) blocks them, and they should not
live in this repo either. They have been replaced with placeholders:

| Placeholder | What it was | Where the real value lives |
|---|---|---|
| `REDACTED-WEBHOOK-1` | Slack webhook (`...B04570374LR/...`) | Discovery-imai source @ `df73c535` (proxy/backend Slack notify calls) |
| `REDACTED-WEBHOOK-2` | Slack webhook (`...B074EJ23NJW/...`) | same |
| `REDACTED-WEBHOOK-3` | Slack webhook (`...B052AN3HQL8/...`) | same |
| `REDACTED-BEARER-TOKEN-1` | Bubble API bearer token | same |

Consequence: **0005 no longer applies cleanly with `git am`/`git apply`.**
To use it, check out Discovery-imai at `df73c535`, grep for the four
hardcoded values (`hooks.slack.com` and the `Authorization: 'Bearer ...'`
literals), and substitute them back into the patch — or simply treat the
patch as a specification and re-do the extraction by hand. Since these
secrets were committed to the Discovery-imai repo in plaintext, they should
be **rotated** regardless; after rotation the redaction is moot.

Patches 0001–0004, 0006, 0007 are docs-only and unmodified.
