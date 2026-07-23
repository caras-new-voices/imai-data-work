# IMAI "How It Works" site

Static, zero-build knowledge site generated from the Discovery-imai code
audit (verified @ `da98fcf2`, 2026-07-22) and live Mixpanel measurement.

## Deployment status

**LIVE: https://imai-how-it-works.vercel.app** — deployed 2026-07-22 via
CLI (`npx vercel deploy --prod`) to project `imai-how-it-works` on the
`new-voices` team, using the session's `VERCEL_TOKEN`. This is a one-shot
CLI deploy, NOT git-connected: pushes to this repo do NOT redeploy.

To redeploy after content changes: copy `site/` to a directory named
`imai-how-it-works`, then from inside it run
`npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"`.

⚠ **The site is PUBLIC.** Vercel Authentication for production deployments
is not available on the team's current plan (API returned
`invalid_sso_protection`); `vercel.json` sets `X-Robots-Tag: noindex`, but
anyone with the URL can read it, and it contains internal funnel/revenue
numbers. Options: upgrade the Vercel plan and enable Deployment
Protection, or take it down with
`npx vercel remove imai-how-it-works --token "$VERCEL_TOKEN"`.

## Updating content

Pages are hand-written HTML sourced from `docs-events-audit/` and
`architecture/imai-architecture.json`. When those change (e.g. after the
next repo refresh), regenerate the affected sections — each page's footer
names its sources.

| Page | Sources |
|---|---|
| index.html | overview of everything below |
| architecture.html | architecture/imai-architecture.{json,html} |
| events.html | docs-events-audit/02, 03, 04, 12 |
| features.html | architecture JSON services + 06-conversion-pixel.md |
| user-flows.html | 02/03/04 + 13-sales-funnel-report + REFRESH-NOTES |
| metrics.html | 13-sales-funnel-report-2026-07.md + 11-spending §7 |
| open-questions.html | OPEN_QUESTIONS.md (Q1–Q29) |
