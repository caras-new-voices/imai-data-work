# 08 — Data-Quality Validation Playbook (Sprint 4)

**Status:** Ready-to-run — every check below is written against the logs DB
(`imai_events`) and prod DB so that the moment read access lands
([Q3/Q14](./OPEN_QUESTIONS.md)), executing this sprint is mechanical.
Known-good semantics and prior verified numbers are inline as expectations.

Conventions: calendar-day windows (`date >= current_date - interval 'N days'`
— rolling `now()` windows will NOT match manual counts, SCHEMA.md gotcha #9);
`imai_events.date` is timezone-naive; exclude `%test%`, `ldrsgroup.com`,
`influencermarketing.ai` emails to match the reporting views.

## 1. Dictionary validation (Q14)

```sql
-- 1a. Every live event name + volume, 90d — diff against 02-event-dictionary.md
SELECT event, count(*) n, count(DISTINCT user_id) u,
       min(date) first_seen, max(date) last_seen
FROM imai_events
WHERE date >= current_date - interval '90 days'
GROUP BY 1 ORDER BY n DESC;
-- Expect: influencer_discovery_search dominates (~2.8M lifetime).
-- Flag: names present here but missing from the dictionary (orphans beyond
-- the known high_value_signup / scheduled_* / Close stage labels), and
-- dictionary events with n=0 (dead emitters).

-- 1b. Payload fill rates for enriched fields
SELECT event,
       avg((email IS NOT NULL)::int)        email_fill,
       avg((name IS NOT NULL)::int)         name_fill,
       avg((main_user_id IS NOT NULL)::int) main_user_fill,
       avg((amount IS NOT NULL)::int)       amount_fill
FROM imai_events
WHERE date >= current_date - interval '90 days'
GROUP BY 1 ORDER BY 1;
-- Expect: payment events ~100% amount_fill; occasional missing email/name
-- (backend sends un-enriched on user-lookup failure — 03-emitters.md §1).
```

## 2. Known-gap regression checks

```sql
-- 2a. Daily volume per key event, 120d — eyeball for thin patches like the
--     April 2026 new_subscription_payment gap
SELECT date_trunc('day', date) d, event, count(*)
FROM imai_events
WHERE event IN ('signup','new_subscription_trial','new_subscription_payment',
                'payment_success','cancel_trial','cancel_subscription')
  AND date >= current_date - interval '120 days'
GROUP BY 1,2 ORDER BY 1,2;

-- 2b. payment_success coverage vs prod truth (repeat of the June-2026 check:
--     events saw 57% of charges / 36% of dollars). Logs side:
SELECT count(*) charges, sum(amount) dollars
FROM imai_events
WHERE event IN ('payment_success') AND date >= date '2026-06-01' AND date < date '2026-07-01';
--     Prod side (user_payments; price whole dollars, created epoch secs):
SELECT count(*) charges, sum("price") dollars
FROM user_payments
WHERE paid = true AND "price" > 0
  AND to_timestamp("created") >= date '2026-06-01'
  AND to_timestamp("created") <  date '2026-07-01';

-- 2c. Duplicate-fire checks
--     created_campaign vs campaign_created should be ~1:1 if both fire per create (Q9)
SELECT event, count(*) FROM imai_events
WHERE event IN ('created_campaign','campaign_created')
  AND date >= current_date - interval '30 days' GROUP BY 1;
--     new_subscription_payment double-fires per user (known ~90%/dedupe note):
SELECT user_id, count(*) c FROM imai_events
WHERE event = 'new_subscription_payment'
GROUP BY 1 HAVING count(*) > 1 ORDER BY c DESC LIMIT 20;
-- Expect: ~7% of payers >1 (re-subscription); one outlier with 34.
```

## 3. Funnel integrity (anchors verified 2026-07-13, re-run to confirm)

```sql
-- Anchor coverage: % of trial-cancelers with a trial-start event (expect ~99%),
-- % of payers with trial+signup anchors (expect ~97%)
WITH t AS (SELECT user_id, min(date) trial_start FROM imai_events
           WHERE event='new_subscription_trial' GROUP BY 1),
     p AS (SELECT user_id, min(date) first_pay FROM imai_events
           WHERE event='new_subscription_payment' GROUP BY 1)
SELECT count(*) payers,
       avg((t.user_id IS NOT NULL)::int) with_trial_anchor
FROM p LEFT JOIN t USING (user_id);

-- Trial→paid timing distribution (expect median ~6.9d, ~76% day 6–8)
WITH t AS (SELECT user_id, min(date) ts FROM imai_events WHERE event='new_subscription_trial' GROUP BY 1),
     p AS (SELECT user_id, min(date) fp FROM imai_events WHERE event='new_subscription_payment' GROUP BY 1)
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM fp-ts)/86400) median_days
FROM t JOIN p USING (user_id) WHERE fp > ts;
```

## 4. Staging-pollution check (proxy not prod-gated — Q10)

```sql
-- Search events from non-prod: look for dev/staging emails or IPs, and for
-- rows emitted while prod was quiet (deploy windows). Simplest proxy:
SELECT email, count(*) FROM imai_events
WHERE event LIKE 'influencer_discovery_search%'
  AND (email ILIKE '%test%' OR email ILIKE '%influencermarketing.ai%' OR email ILIKE '%ldrsgroup%')
  AND date >= current_date - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;
```

## 5. Cross-source usage validation (proxy billing vs events)

The proxy writes billing rows for every search independently of the webhook
(03-emitters.md §3). Compare daily `insertBillingEntity` rows
(packageTypeId=1, Search) in prod DB vs `influencer_discovery_search(_paginated)`
in imai_events. Divergence = webhook loss rate for the highest-volume event —
the best available proxy for overall pipeline loss (until Q1 gives us the
receiver's own metrics).

## 6. Mixpanel / Klaviyo lag & loss (🔒 blocked on Q19 / Q5)

Procedure documented in 07-destinations.md §1.3 and §2. Prior verified
figures to beat: Klaviyo `New Trial` ≈99% match; lists ~90%; Mixpanel drift
"sync lag" (unquantified).

## 7. White-label / reseller contamination

```sql
-- Legacy resellers are only visible via reseller_stripe_cuid (best-effort):
SELECT count(DISTINCT user_id) FROM imai_events WHERE reseller_stripe_cuid IS NOT NULL;
-- Expect ~126 users / 7 platforms; the `resellers` table maps cuid→platform.
-- Modern white-labels: pull user."whiteLabelId" IS NOT NULL ids from prod
-- (~100 users) and check their event presence here (they SHOULD be routed to
-- per-label webhooks — presence in default imai_events = routing fallthrough, Q13).
```

## 8. Deliverable checklist for the sprint

- [ ] §1a diff table appended to 02-event-dictionary.md (new/dead events)
- [ ] §1b fill-rate table
- [ ] §2 gap scan chart + regression notes
- [ ] §3 funnel anchors re-verified (update SCHEMA.md dates if drifted)
- [ ] §4/§7 contamination findings → Q10/Q13 answers
- [ ] §5 webhook loss estimate
- [ ] §6 Mixpanel/Klaviyo lag & loss (once unblocked)
- [ ] 07-destinations.md coverage matrix ✔/？ cells resolved
