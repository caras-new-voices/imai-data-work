# IMAI "How It Works" site

Static, zero-build knowledge site generated from the Discovery-imai code
audit (verified @ `da98fcf2`, 2026-07-22) and live Mixpanel measurement.

## Deploy to Vercel (2 minutes)

1. vercel.com → **Add New… → Project** → Import `caras-new-voices/imai-data-work`.
2. **Root Directory: `site`** (Framework preset: "Other" — it's plain HTML,
   no build command, output dir = root).
3. Deploy. Every push to the tracked branch redeploys.

Notes:
- Vercel deploys the repo's production branch by default. This work lives on
  `claude/new-session-zy3mol` — either point the Vercel project's Production
  Branch setting at it, or merge to the default branch first.
- The audit corpus contains internal details (env-var names, funnel/revenue
  numbers). `vercel.json` sets `X-Robots-Tag: noindex`, but you should ALSO
  enable **Vercel Deployment Protection** (project → Settings → Deployment
  Protection) so the site isn't world-readable.

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
