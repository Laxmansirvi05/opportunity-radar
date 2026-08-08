# Opportunity Ingestion Architecture v2

**Goal:** ~4,000 **real** opportunities, refreshed every 24h, sourced predominantly from
**official company career portals**, weighted ~85% India / ~15% international-but-remote,
covering internships (priority), jobs, hackathons, competitions and events — with zero
fabricated listings, zero duplicates and zero dead apply links.

---

## 1. Why the current system fails

| Problem | Evidence |
|---|---|
| 9 of 13 providers **fabricate** listings | `Array.from({length: 25}).map(...)` with comments like *"using safe fallback strategy with generated realistic data"* |
| Fabricated apply links are dead | `techcorp1.greenhouse.io` → DNS failure; `github.com/careers/jobs/5000000` → 404; `wellfound.com/jobs/201` → 404 |
| Nothing is ever refreshed | Most recent `updated_at` in production: **2026-06-17** |
| Nothing is ever expired | 4,681 rows past deadline, only 33 marked `Expired` |
| The catalogue is effectively empty | 4,757 rows → **76 visible** |
| Scrapers can't finish inside a serverless invocation | Unstop = 250 sequential fetches, Internshala = 180, ceiling = 300s |
| The validator can't detect any of this | It checks that fields *exist* and the URL *parses* — nothing more |

**Root cause:** the system was built to *look* full rather than *be* correct, and nothing
in the pipeline could tell the difference.

---

## 2. Four principles

1. **Trust tiers.** Official ATS > official company page > aggregator. When the same job
   appears twice, the highest tier wins and the rest are collapsed.
2. **Never fabricate.** A provider that cannot fetch returns `[]`. Synthetic data is a
   contract violation, enforced by a test — not a convention.
3. **Verify before publish.** No row becomes visible until its apply URL has resolved.
4. **Reconcile, don't accumulate.** Every run records what it saw; anything not seen in a
   *successful* run is expired. Storage is never spent on dead listings.

---

## 3. Source strategy — official portals first

Most companies run careers on a hosted ATS with a **public, documented JSON endpoint**.
That gives real listings with apply links on the employer's own domain — exactly what you
asked for, and far more reliable than scraping.

**Verified working (tested live):**

| ATS | Endpoint | Status |
|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | ✅ postman 106 jobs, groww 8 jobs |
| Lever | `api.lever.co/v0/postings/{slug}?mode=json` | ✅ confirmed |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{slug}/postings` | ✅ confirmed |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` | ⚠️ verify per slug |
| Recruitee | `{slug}.recruitee.com/api/offers/` | ⚠️ verify per slug |

A real Greenhouse record carries everything we need:

```
absolute_url          → real apply link on the employer's board
location.name         → "Bengaluru, Karnataka, India"  (India filtering)
application_deadline  → deadline
updated_at            → freshness
id                    → stable source_id
```

### The actual hard part: slug discovery

You cannot guess slugs — `razorpay`, `zomato`, `flipkart`, `cred`, `meesho` all returned
0 on Greenhouse; `postman` and `groww` returned real jobs. So the design is a
**data-driven registry**, not a class per company:

```
source_registry(company_name, ats, slug, tier, active, india_focus, last_ok_at)
```

Adding an employer becomes **one row**, not a new provider file. Target: a curated seed of
150–300 India-hiring employers, grown over time. A weekly job re-probes each slug and
deactivates ones that stop responding.

### Keeping the aggregators (demoted)

Unstop and Internshala stay — they're **real** and India-native, and they're the best
source for hackathons, competitions and workshops. They just drop to a lower trust tier,
so an official posting always wins the dedupe.

---

## 4. Pipeline

```
 ┌──────────┐   ┌────────────────┐   ┌──────────────┐   ┌───────────────┐
 │ REGISTRY │──▶│ PRODUCER       │──▶│ ingestion_   │──▶│ CONSUMER      │
 │ (slugs)  │   │ list endpoints │   │ queue        │   │ batch of N    │
 └──────────┘   │ fast, 1 call   │   └──────────────┘   └───────┬───────┘
                └────────────────┘                              │
                                                                ▼
                                                    ┌───────────────────────┐
                                                    │ QUALITY GATES         │
                                                    │ 1 schema              │
                                                    │ 2 synthetic-detect    │
                                                    │ 3 link resolve        │
                                                    │ 4 geo classify        │
                                                    │ 5 dedupe (3-level)    │
                                                    │ 6 freshness           │
                                                    └──────────┬────────────┘
                                                               ▼
                                                        upsert + last_seen_at
                                                               │
                                                               ▼
                                                    ┌───────────────────────┐
                                                    │ RECONCILE             │
                                                    │ unseen → Expired      │
                                                    │ (with safety guard)   │
                                                    └───────────────────────┘
```

Two phases solve the timeout: the producer only touches list endpoints (fast, fits one
invocation); the consumer processes bounded batches and is resumable across invocations.
`QueueProducerService`, `QueueConsumerService`, the `ingestion_queue` table and the
`claim_queue_batch` RPC **already exist and are unused** — this wires them up.

---

## 5. Quality gates — the "no fake / no duplicate / no dead link" engine

| # | Gate | Rejects |
|---|---|---|
| 1 | **Schema** | missing title/company/url/source_id/category (exists today) |
| 2 | **Synthetic** | sequential IDs across a batch; placeholder names (`TechCorp 3`, `Foundation 7`, `Company N`); >N records sharing identical description text; template URLs whose path is a bare incrementing integer. A provider tripping this is rejected **wholesale**, not per-record. |
| 3 | **Link** | DNS failure, 404, 410, redirect-to-careers-home. Result cached in `link_status` / `link_checked_at` so we don't re-probe daily. |
| 4 | **Geo** | classify India vs international; international allowed **only if remote**. 85/15 enforced as a *publishing quota*, not a hard reject. |
| 5 | **Dedupe** | ① exact `(source, source_id)` → update ② canonical URL (strip UTM/query, lowercase) ③ fuzzy `company + title + location` → keep highest trust tier, link the rest via `duplicate_of` |
| 6 | **Freshness** | deadline already past |

Gate 2 is the one that would have caught all nine fake providers on day one.

---

## 6. Reconciliation — automatic removal

Every observed record gets `last_seen_at = run_started_at`.

After a run completes **successfully for a given source**, expire anything from that source
not seen this run:

```sql
UPDATE opportunities SET status = 'Expired'
WHERE source = $1 AND last_seen_at < $run_started
```

**Safety guard (essential):** only reconcile if this run saw at least ~60% of the previous
run's volume for that source. Otherwise a partially-failed scrape would wipe the catalogue.
A run below threshold is logged as `PARTIAL` and skips reconciliation.

Combined with deadline-expiry and dead-link-expiry, this is the "opportunity gets deleted
automatically" behaviour, done without the failure mode that would empty your site.

---

## 7. Schema additions (one migration)

```sql
ALTER TABLE opportunities
  ADD COLUMN last_seen_at    timestamptz,
  ADD COLUMN trust_tier      smallint DEFAULT 3,   -- 1 official ATS, 2 company page, 3 aggregator
  ADD COLUMN is_remote       boolean,
  ADD COLUMN country         text,
  ADD COLUMN canonical_url   text,
  ADD COLUMN duplicate_of    uuid REFERENCES opportunities(id),
  ADD COLUMN link_status     smallint,
  ADD COLUMN link_checked_at timestamptz;

CREATE UNIQUE INDEX idx_opportunities_canonical_url
  ON opportunities(canonical_url) WHERE canonical_url IS NOT NULL;

CREATE TABLE source_registry (...);
```

Plus the still-missing `ai_usage_log` from the original audit.

---

## 8. UI work

**Search**
- Category tabs: Internships · Jobs · Hackathons · Competitions · Events
- India / Remote toggle, defaulting to India
- "Official company posting" trust badge on tier-1 results
- Freshness indicator ("verified today")
- Fix the stat bar (currently shows `0 Posted Today` because nothing ingests)

**Detail page**
- **The Apply button is currently hard-disabled** — must be fixed
- Verified-link badge, deadline countdown, clear company block
- Replace the 163 hardcoded hex colours with design tokens

---

## 9. Recommended order

| Phase | Work | Why here | Est. |
|---|---|---|---|
| **1. Stop the bleeding** | Delete 9 fake providers; purge 135 fake rows; disable Wellfound; fix `vercel.json` | Prevents fake data reaching students tonight; nothing else is trustworthy until sources are honest | ~0.5 day |
| **2. Clean the slate** | Run maintenance; expire the 4,681 stale rows | Makes the real numbers visible so later phases are measurable | ~0.5 day |
| **3. Trust engine** | Migration + quality gates + reconciliation | Must exist **before** scaling sources, or we scale the mess | ~3 days |
| **4. Queue wiring** | Producer/consumer on real crons | Removes the 300s timeout that blocks volume | ~1 day |
| **5. Official sources** | Generic ATS adapters + registry + 150–300 seed employers | The actual goal: real, official, India-weighted volume | ~1 week |
| **6. Events** | Real hackathon/competition sources (Unstop is already real; add MLH, Devfolio real API) | Rounds out the student offering | ~2 days |
| **7. UI** | Search + detail redesign, apply button | Best done once the data is real and shaped | ~3 days |

**Sequencing rationale:** phases 1–2 are cheap and stop active harm. Phase 3 before 5 is the
critical ordering — building the trust engine *after* adding 300 sources would mean
re-validating everything. Phase 4 before 5 because 300 sources cannot run synchronously.

### Volume estimate (does 4,000 hold up?)

| Source | Realistic India-relevant live rows |
|---|---|
| ATS registry (150–300 employers) | 1,000–3,000 |
| Internshala | 500–800 |
| Unstop (internships/hackathons/competitions) | 800–1,500 |
| Amazon India | 200–500 |
| YC/HN (remote only) | 50–150 |

**Total: ~2,500–6,000.** The 4,000 target is achievable, and the 85/15 India split is
enforceable via the geo gate.
