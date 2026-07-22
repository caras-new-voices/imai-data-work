# Kickoff — Discovery-imai architecture refresh session

**Upload this kit's files, then paste the prompt below as your first message.**
This doc also lives in `caras-new-voices/imai-data-work` at
`docs-events-audit/prompts/discovery-imai-refresh-kickoff.md`.

---

## Paste this as the first message in the Discovery-imai session

> This is a READ-ONLY audit session. HARD RULES: never push to this repo,
> never create branches, commits, or PRs in it, never edit its files. Your
> only outputs are downloadable files I will carry to a different repo.
>
> I've uploaded a kit from the documentation repo
> (caras-new-voices/imai-data-work — you cannot attach it, single-owner
> sessions):
> - `imai-architecture.json` + `imai-architecture.html` — the current
>   architecture map, built from an audit of this repo at commit df73c535
>   (2026-07-20)
> - `01-architecture.md`, `02-event-dictionary.md`, `03-emitters.md`,
>   `04-frontend-analytics.md`, `06-conversion-pixel.md` — the audit docs
>   behind that map
> - `OPEN_QUESTIONS.md` — the Q1–Q28 blocker register
> - `EVENTS_AUDIT_PLAN.md` — Part 1 describes the sweep method used
>
> Task: refresh the architecture map against current HEAD.
> 1. `git log --oneline df73c535..HEAD` and review the diff since the
>    audit baseline (`git diff --stat df73c535..HEAD` first for shape).
> 2. Verify every file:line reference in imai-architecture.json
>    ("key_files" sections) against HEAD; fix drifted line numbers.
> 3. Sweep for NEW or REMOVED webhook events (grep the three emitters'
>    call sites: users.service.ts sendPipeDriveWebhook callers, proxy
>    index.js, social-listening) and diff against 02-event-dictionary.md.
> 4. Check whether any open questions can now be answered from code
>    (especially Q9 created_campaign duplicate, Q22 proxy CORS, Q23
>    trust proxy; also look for any new Mixpanel/Stripe integration code —
>    Q24/Q28 — and price-point config for $599/$959/$175).
> 5. Note anything architecturally new since df73c535 (new services,
>    modules, integrations, env vars).
>
> Deliverables — as downloadable files only:
> - `imai-architecture.json` (updated, same schema; bump meta.generated_at,
>   set meta.base_commit_audited to the HEAD you audited)
> - `imai-architecture.html` (updated to match)
> - `REFRESH-NOTES.md` (what changed since df73c535: commits reviewed, new
>   /removed events, corrected references, open-question answers found,
>   anything the docs got wrong)
> - If any doc needs edits (02/03/04/06/OPEN_QUESTIONS), provide the edited
>   copy in full, same filename.
>
> Work autonomously; put anything you can't resolve into REFRESH-NOTES.md
> instead of stopping to ask. Do not include real secret values in any
> output file (patch 0005 in the docs repo got blocked by push protection
> for that) — reference secrets by env-var name only.

## After that session finishes

Download its output files and upload them into a session on
`caras-new-voices/imai-data-work` with the message: "reconcile these
refresh outputs into architecture/ and docs-events-audit/". That session
will diff, merge, and commit them.

## Kit manifest

| File | Purpose |
|---|---|
| imai-architecture.json | current map — the thing being refreshed |
| imai-architecture.html | human twin — refresh to match |
| 01-architecture.md | infra topology + probe evidence |
| 02-event-dictionary.md | all webhook events + caveats |
| 03-emitters.md | emitter implementations + side channels |
| 04-frontend-analytics.md | client tags + bridges |
| 06-conversion-pixel.md | customer conversion SDK |
| OPEN_QUESTIONS.md | Q1–Q28 register |
| EVENTS_AUDIT_PLAN.md | original sweep method (Part 1) |
