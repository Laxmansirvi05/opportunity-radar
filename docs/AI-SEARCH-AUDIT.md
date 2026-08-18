# AI Search — completion audit

The plan for taking AI Search to genuinely finished, not demo-finished.
Written at the end of the 18 Aug session so the next one starts with facts
rather than re-deriving them.

## Verified working (evidence, not assumption)

- **End-to-end integration.** A search submitted through the app reached the
  agent and returned. `ai_search_jobs` recorded its first-ever row
  (`5932ec52…`), correctly linked to the agent's `pipeline_jobs` row
  (`492b0e2c…`). Auth held, upload worked, job recorded before the agent call.
- **Real results.** 7 matches: MongoDB, KGE Technologies, StayingBee, Anvaya AI,
  ALGORYX, Resource One IT, Spritle, Anvistar. Working apply URLs, correct
  Hyderabad/Chennai weighting, scores spread 85-100 (not clustered).
- **Honest shortfall reporting.** The agent refuses to pad and says why. Now
  surfaced in the UI via the "Why N of X" panel.
- **Reload safety.** `GET /api/ai-search` returns the caller's most recent run
  and the client rehydrates completed results on mount — so the upload screen's
  "will be here when you come back" promise is real. Verified by reading both
  sides; an earlier apparent failure was a lost dev session, not a bug.
- **Concurrency guard.** One run at a time per student, already implemented.
- **Stuck jobs.** The poll route ages out runs with `PIPELINE_TIMEOUT`.

## Fixed on 18 Aug

- `shortfallIsOurFault` fired on any provider-error mention, so a successful run
  showed "Something went wrong on our side" above its own "Good match rate"
  text, and offered to re-run a search that had just succeeded. Now gated on
  result tier. Two regression tests pin the real payload shape.
- Results were a single full-width column in a 896px shell on a 2000px screen.
  Now a 1440px shell with a two-up grid and equal-height cards.
- The agent's shortfall reasons were rendered nowhere.
- `is_paid` documented as the trap it is (see below).
- No rate limit on `POST /api/ai-search` — the route never called
  `checkRateLimit` at all, so the DEFAULT_LIMIT backstop could not apply.
  Now `ai_search: max 5 / 24h`.

## Must fix before real students use it

- [ ] **`is_paid` means "salary was disclosed", not "this role is paid."**
      Computed in workflows.json standardize node as
      `!!(salary.min || salary.max) || salaryDisclosedAsString`. A posting that
      never published pay returns `false`, indistinguishable from one that said
      it is unpaid. All 7 live results were `false`; none claimed to be unpaid.
      Should emit `null` when undeterminable. Currently rendered nowhere, so it
      is a latent trap rather than a live defect — DO NOT add a Paid/Unpaid
      badge before fixing this at source.
- [x] **Cross-user RLS — PROVEN 18 Aug.** Tested by impersonating a second
      authenticated user against the real job row, all four attacks blocked:
        * SELECT as another user -> 0 rows (control: owner sees 1, so the test
          is not simply returning 0 for everyone)
        * UPDATE of the victim's job -> 0 rows affected
        * INSERT forging `user_id` as the victim -> rejected, 42501
          "new row violates row-level security policy"
      Defence in depth also holds: every query in both route handlers filters
      `.eq('user_id', user.id)` independently of RLS.
- [ ] **Rate limit works.** Submit 6 searches in a day; the 6th must 429.
      Implemented but never exercised.
- [ ] **Agent dies mid-run.** `pkill` job-server during a search; the UI must
      say something true rather than spin.
- [ ] **Bad uploads.** Corrupt PDF, >5MB, non-PDF, image-only PDF, 0-byte.
- [ ] **Two users at once.** Only ever tested single-user.
- [ ] **Partial-failure paths.** Supabase insert succeeds but agent call fails,
      and the reverse.
- [ ] **`maxDuration = 60`** on the submit route — is it enough under load?

## Known quality gaps (diagnosed, not bugs in our code)

- [ ] **69% of discovery is wasted.** 18 of 26 pages had no readable job
      details. **Highest-value fix available to this feature** — would roughly
      double results without touching anything else.

      Located, not yet fixed. The skip fires in the workflow's scoring node:

          function hasScorableContent(opp) {
            return nonEmpty(opp.company) || nonEmpty(opp.description) ||
                   nonEmpty(opp.requirements) || nonEmpty(opp.skills);
          }

      So an item is skipped only when ALL FOUR are empty — the skip is a
      deliberate, documented token optimisation ("~30% of a run's entire token
      budget spent to produce zeros") and is correctly reported separately from
      scoring failures. It is a symptom, not the bug.

      The open question is WHICH of two things is failing, and they need
      different fixes:
        (a) render-service returns nothing usable (Cloudflare challenge, JS
            timeout, bot block) — fix is in render-service/renderer.js; or
        (b) render-service returns good HTML and the extraction/standardize
            step fails to map it onto company/description/requirements/skills
            — fix is in the workflow's extract node.

      To find out, next session:
        1. Bring the stack up (docker compose up postgres redis, then the four
           services; they were all down at the end of 18 Aug).
        2. Run one search and capture a SKIPPED item's full payload —
           specifically whether `raw` / rendered HTML is present and non-trivial.
           If `raw` is substantial, it is (b). If empty or a challenge page,
           it is (a).
        3. `POST http://localhost:3100/api/fetch` with `{"url": …}` and the
           `x-api-key` header reproduces one page in isolation.

      **ANSWERED 18 Aug: it is (b), extraction — not rendering.**
      Started render-service alone and fetched a real posting URL
      (`POST localhost:3100/fetch`, note the path is /fetch, NOT /api/fetch):

          HTTP 200 · html 516,248 chars · visible text 94,648 chars
          jsRendered: true · cloudflareDetected: false · renderTimeMs: 3695

      Chromium runs the page's JS and returns half a megabyte of real content,
      so the renderer is not blocked, challenged or timing out. The break is
      between that HTML and the four fields.

      Two concrete leads from the captured payload, both unverified:

        1. The extracted visible text BEGINS with inline <script> contents —
           `var os_type = "Windows"; var browser_name = 'chrome'; …`. Whatever
           consumes this HTML is treating script bodies as page text. If ~94k
           chars of mostly-script are handed to the extraction model, it may
           find nothing job-shaped in its window and return empty fields, which
           then correctly trip hasScorableContent and get skipped. Stripping
           script/style/nav before extraction is the obvious first fix.

        2. That same payload contains `view = "internship/search/search"` — the
           URL is a SEARCH RESULTS page, not an individual posting. If discovery
           is admitting listing pages alongside job pages, empty per-job fields
           are exactly what you would expect, and no amount of extraction work
           fixes it. CHECK THIS FIRST — it is cheaper to verify and would make
           lead 1 irrelevant for those items.

      **COUNTED 18 Aug — lead 2 confirmed. This is a DISCOVERY QUALITY problem,
      not an extraction one.** Pulled the URL pool from n8n execution 344
      (`sqlite3 ~/.n8n/database.sqlite "select data from execution_data where
      executionId=344"`) — the run that produced the 7 results. What discovery
      admitted:

        NOT JOB POSTINGS AT ALL
          https://www.instagram.com/reel/DOgGAomj135
          https://www.instagram.com/reel/DaQAA76vrVT
          https://codegnan.com/blogs/10-c-programming-career-paths
          https://codegnan.com/python-career-opportunities

        SEARCH / LISTING / ERROR PAGES, not individual jobs
          https://internshala.com/internships/javascript-development-internship
          https://internshala.com/internships/python-internship
          https://job-boards.greenhouse.io/verifone?error=true
          https://job-board-one-chi.vercel.app

        REAL POSTINGS (these are fine)
          apply.workable.com/… · jobs.lever.co/… · job-boards.greenhouse.io/…/jobs/…
          cutshort.io/job/… · myinternships.in/job/… · unstop.com/internships/…
          stayingbee.com/join-our-team/…

      An Instagram reel and a blog post have no company/description/
      requirements/skills, so hasScorableContent skips them CORRECTLY. The
      scoring node is behaving exactly as designed; the waste is upstream, in
      what discovery lets through.

      So the fix is a discovery-side URL filter, NOT extraction work:
        - reject non-job hosts outright (instagram.com, facebook.com, youtube.com…)
        - reject obvious content paths (/blog/, /blogs/, /career-paths, /amp)
        - reject listing/search pages: an internshala.com/internships/<query>
          path with no numeric job id is a SEARCH page; real ones carry an id
        - reject error pages (?error=true) and bare domains with no path

      **Separately, a dedup gap is visible in the same pool** — the same job
      appears twice differing only by trailing slash or letter case:
          .../j/49D461FD97  vs  .../j/49d461fd97
          .../python-internship  vs  .../python-internship/
      Canonicalise (lowercase host+path, strip trailing slash) before the
      "Discovery Quality Gate + Dedup" node counts admissions, or the same
      posting burns two render+score budgets.

      **MEASURED 18 Aug, after the filter + dedup landed (commit a658b85).**
      Same resume, same pipeline:

                            before    after
          discovered           26        17
          skipped_no_content   18         9
          waste rate          69%       53%
          scored ok             7         7
          returned              7         6

      The filter works at the front: 9 junk URLs no longer reach the pipeline,
      saving 9 Chromium renders and 9 scoring calls — about a third of the run's
      cost. No more Instagram reels or blog posts.

      **But the prediction that this would "roughly double results" was WRONG.**
      Results went 7 -> 6. Removing junk does not make the remaining pages
      scoreable: 9 of the 17 legitimate URLs STILL have no readable job details.
      There is a second, independent problem underneath the one that was fixed —
      and it is the extraction/script-noise lead that was set aside as "made
      irrelevant" by the listing-page finding. It was not irrelevant, it was
      hidden behind the junk. Both were real.

      The 7 -> 6 drop is most likely run-to-run variance in what discovery
      surfaces (a 17-URL pool is not the same pool as 26), not a regression from
      the filter — but that is UNPROVEN. Re-run twice more before concluding.

      Next on this thread: take the 9 still-skipped URLs from a fresh run, and
      check whether their rendered HTML actually contains job details that
      extraction is failing to pull out (the <script>-noise lead), or whether
      they are genuinely thin pages. That decides whether extraction work pays.

      Caveat on the original count: that was the discovered URL POOL for the
      run, not a per-item attribution of each of the 18 skips — n8n's flattened execution
      format made mapping each skip to its exact URL impractical in the time
      available. The presence of Instagram reels and blog posts in the pool is
      conclusive enough to direct the fix; re-measure skip counts after the
      filter lands to confirm the size of the win.
- [ ] **Score calibration.** A frontend resume scored 100 on a SQL internship
      off "student with existing SQL knowledge", outranking four well-matched
      frontend roles. Lives in the gateway's `score_fit` prompt. Note the
      pipeline runs on Groq alone — comments say Gemini returns 404
      ("no longer available to new users"), so there is no fallback and no
      second opinion.

## Run history (same resume each time)

                        baseline  filter-v1  filter-v2 + key rotation
    discovered              26        17          20
    skipped_no_content      18         9          12
    waste rate             69%       53%         60%
    scored ok                7         7           8
    scoring failures         1         1           0
    returned                 7         6           8
    tier                  good      good        FULL

Key rotation (gateway commit e999e20) is what made the last run possible at
all: three consecutive attempts before it died with 503s, every provider
exhausted. That run logged 14 rotations and zero scoring failures — the first
clean scoring pass of the day.

Read the skip RATE with care. These runs are not comparable: the last one
broadened (9 extra URLs admitted) where the previous did not, so it is a
different pool. 9 -> 12 is noise across differing pools, not a regression, and
one run is not a trend — a lesson already learned once here by predicting a
doubling and getting 7 -> 6.

What is solid: returned 7 -> 8, scoring failures 1 -> 0, and tier reaching
FULL for the first time.

### Extraction fix measured (commit 35759e7) — no effect on skips

                    baseline  filter-v1  +rotation  +extraction
    discovered          26        17         20         20
    skipped_no_content  18         9         12         12
    scored ok            7         7          8          8
    returned             7         6          8          8
    tier              good      good       full       full

The fix DID take effect — scores moved (90/88/85 vs 100/92/90) and different
companies surfaced — so the model is now receiving main_content instead of
truncated whole-page text. But the skip count did not move at all.

Conclusion: the 12 skipped items fail BEFORE extraction quality matters. They
arrive with no company, description, requirements or skills whatsoever, so
choosing a better field cannot rescue them. The fix is still correct on its own
merits (the model was being fed navigation chrome), but it is NOT the lever on
the skip count.

Two theories now dead, both by measurement rather than argument:
  - <script> noise — Clean HTML already strips script/style/noscript/template/
    svg/canvas.
  - field selection/truncation — fixed, skips unchanged.

What is left for the 12: find out what render-service actually returns for one
of THEM specifically. Every inspection so far used a URL picked by hand, not a
confirmed member of the skipped set. Capture a skipped item's own payload
(status, html length, cloudflareDetected) before theorising again.

### BREAKTHROUGH — the skips are NOT thin pages (18 Aug, execution 350)

Resolved all 12 confirmed skipped URLs for the first time by dereferencing
n8n's flat pointer array (objects hold INDEX pointers; find the index of the
'skipped_no_content' string, then match objects whose scoring_status points at
it). Every prior inspection used a hand-picked URL, which is why three theories
in a row missed.

The 12 are mostly REAL ATS postings — lever.co/palantir, workable/robusta,
ashbyhq/ramp, cutshort.io/job — not junk. Fetched three through render-service:

  workable/robusta/j/1A49B1E6C2   200  cleaned 7,982  "Senior Frontend
                                                       Developer (AEM/CMS)"
  lever.co/palantir/e27af7ab…     200  cleaned 7,469  "Software Engineer,
                                                       Internship"
  ashbyhq.com/ramp/31f7e045…      200  cleaned   145  "Job not found" (dead)

TWO OF THREE HAVE REAL, READABLE JOB CONTENT and were still skipped. So the
failure is neither rendering nor the pages themselves — it is between render
and hasScorableContent.

Leading hypothesis, NOT yet proven: extraction is an LLM call (HTTP Request2,
task extract_opportunity) and that run logged 14 key rotations from rate
limiting. If those calls fail under pressure, the item reaches scoring with
empty fields and is counted as skipped_no_content — "nothing to match on" —
when the truth is "we failed to extract it". That would also explain why the
main_content fix changed nothing: the calls never succeeded to begin with.

This matters beyond the count. skipped_no_content is reported to the student as
a property of the POSTING ("no readable job details"). If it is really our
extraction failing, that is the same class of mislabel as the is_paid trap:
our failure presented as a fact about the world.

**PROVEN 18 Aug (commit 6ba151a, instrumented run).** The hypothesis held:

    extraction_status            scoring_status
      extracted           34       scored              15
      extracted_from_text  0       extraction_failed    5
      parse_failed         0       skipped_no_content   1
      no_response         20

  20 extraction calls returned nothing usable from the gateway. Of the items
  that reached scoring with empty fields, FIVE were our extraction failing and
  only ONE was a genuinely thin page.

  So the old reporting was backwards five times out of six. "N discovered pages
  had no readable job details" was mostly us failing to read a perfectly good
  posting — confirmed independently by fetching those URLs, which returned real
  job content with correct titles.

  parse_failed = 0 is itself informative: the model is not answering badly, it
  is not answering at all. That points at the gateway/provider layer (timeouts,
  exhausted chain), not at the extraction prompt.

  Remaining, in order:
   1. PACING between gateway calls — now clearly the right fix, not more keys.
      20 no_response in one run, against a chain that rotates 9 keys, means the
      burst is outrunning capacity rather than lacking it.
   2. Once extraction succeeds, re-measure returned/tier. The 15 scored here is
      already the highest of the day.
   3. Student-facing copy in Build Response still folds extraction_failed into
      the skipped_no_content sentence. Fix AFTER pacing, so the numbers it
      reports are real.

### NEW — postings admitted with no title
Two results came back with title None and low scores (FloLabs 60, Redis 50).
A posting with no title should probably not be shown to a student at all;
at minimum it should not occupy a slot above a titled one.

### Still open on this thread
- [ ] The ~12 remaining skips are LEGITIMATE postings the pipeline cannot read
      (board roots and junk are now filtered out). This is the extraction
      thread — the <script>-noise finding from render-service, where stripping
      script/style cut 154KB of HTML to 2,951 chars of real text. Last known
      lever on result quality.
- [ ] Pacing between gateway calls. Rotation now ABSORBS the burst that trips
      Groq's ~12k tokens/min; it does not prevent it. 14 rotations for one run
      is a lot of key budget spent on avoidable retries.

## Deployment (after the above)

- [ ] `AI_AGENT_URL` and `AI_AGENT_INTERNAL_SECRET` set in Vercel. Without the
      secret, Caddy rejects every call. Unset locally is correct.
- [ ] Host: cannot run on Vercel — job-server spawns `n8n execute`, runs
      setInterval daemons, passes work via local filesystem, drives Chromium,
      and takes 78-781s per run. Needs an always-on VM.
- [ ] Azure for Students ($100, no card, verified by college email) is the
      card-free option; ~3 months on a 4GB box. Cloudflare Tunnel is the free
      interim for anything that does not need to stay up.
