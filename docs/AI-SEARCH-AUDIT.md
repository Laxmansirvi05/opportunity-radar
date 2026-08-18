# AI SEARCH — EXTRACTION THREAD CLOSED (18 Aug, verified end-to-end)

First fully-healthy run of the day (render-service + search + n8n CLI all
working at once):

    extraction_status: extracted 95, guard_skipped 0, no_response 0, parse_failed 0
    scoring_status:    scored 44,  extraction_failed 0, skipped_no_content 0
    scoring summary:   17 attempted, 17 succeeded, 0 failed
    returned:          10 of 10   tier: FULL   strength: strong

Zero skips of any kind. A full slate of 10 real matches (Anvaya, Avadhuta,
Nizam, Falcon, Spritle, Copilot GTM, Rejolut, Virtu, Raptee, Codec).

Root cause of the whole extraction saga: render-service's Playwright Chromium
was uninstalled mid-session, so every render 500'd and items reached the guard
with empty content. NOT script noise, truncation, field selection, the gateway,
rate limiting, or pacing — all five were wrong. A missing browser binary.

What actually had to be true for a clean run, and each had blocked it in turn:
  1. Chromium installed (npx playwright install chromium) — the real fix
  2. Clean HTML reads .html not just .data (render branch) — commit 361659e
  3. Gateway key rotation across 9 keys — commit e999e20 (absorbs Groq limits)
  4. A search key with quota — user supplied a fresh Tavily key
  5. n8n SERVER stopped — the pipeline uses `n8n execute` (CLI), which needs
     port 5679; a running n8n server holds it and the CLI produces no output.
     Do NOT run `n8n start` while using this pipeline.
  6. job-server started with .env sourced — it passes process.env to the
     n8n execute child, so a stale job-server = a stale Tavily key in n8n.

OPERATIONAL NOTE for restarts (all four are plain node processes + n8n CLI):
  - render-service :3100  — needs Chromium installed; restart BY PORT
  - ai-gateway :4000, search-planner :4200, job-server :4300 — source .env first
  - do NOT run `n8n start`; the pipeline shells out to `n8n execute`
  - restart by port (lsof -t -iTCP:PORT), never pkill -f (matches wrong procs)

---

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
- [x] **Score calibration — VERIFIED CORRECT (18 Aug), no fix needed.** Tested
      gateway score_fit directly: strong-match 95, student-vs-senior 10,
      pure-frontend-vs-SQL 20, fullstack-vs-SQL 90 — discriminates correctly.
      The earlier read was wrong: the test resume is full-stack with real
      PostgreSQL/SQL, so a SQL role scoring high for it is right. Original note:
      A frontend resume scored 100 on a SQL internship
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

  CORRECTED 18 Aug — see "no_response is two things" below. 'no_response' does
  NOT mean the gateway failed. Of the items
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
   1. PACING — TRIED 18 Aug AND IT MADE THINGS WORSE. Reverted.
      Set n8n HTTP Request2 batching to batchSize 1 / batchInterval 1500ms and
      raised waitBetweenTries 2s -> 5s. Result on the only measurement:

                            before pacing   after pacing
        extracted                34              30
        no_response              20              32
        extraction_failed         5               8
        returned                  8               5
        tier                   full            good

      So spacing the calls did not relieve the pressure — it roughly doubled
      the failures. Plausible reading: stretching a run over a longer window
      exposes it to MORE rate-limit windows and burns more of a daily quota,
      rather than fitting inside a per-minute one. It may also be provider-state
      variance between runs; one measurement is not proof, and this is the
      fourth theory on this thread to die on contact with data.

      Reverted to the pre-pacing workflow (instrumentation kept). Do NOT retry
      naive pacing without first establishing WHICH limit is being hit —
      per-minute tokens, per-day quota, or concurrent requests. The gateway logs
      the provider and code per attempt; read those for one failing run before
      changing timing again.
   2. Once extraction succeeds, re-measure returned/tier. The 15 scored here is
      already the highest of the day.
   3. Student-facing copy in Build Response still folds extraction_failed into
      the skipped_no_content sentence. Fix AFTER pacing, so the numbers it
      reports are real.

### THE ACTUAL ROOT CAUSE — render-service Chromium was uninstalled (18 Aug, late)

Chased the guard_skipped items into render-service's OWN log (/tmp/render.log,
not the gateway log). Every failing item showed:

    browserType.launch: Executable doesn't exist at
    .../ms-playwright/chromium_headless_shell-1234/chrome-headless-shell...
    "Please run: npx playwright install"

The Playwright browser cache was EMPTY — chromium.executablePath() pointed at a
binary that was not on disk. So render-service returned 500 on every single
render, retried 3x, and the item reached Clean HTML with no HTML at all. This
is what actually produced guard_skipped 20 and 40 in the last runs — NOT the
data/html mismatch, NOT extraction logic, NOT rate limits. A missing browser
binary.

(Earlier in the session render-service worked — I fetched the 7,982-char robusta
page successfully. The cache was wiped or updated at some point mid-session,
which is why the skip numbers jumped between runs.)

FIXED: npx playwright install chromium (downloaded chromium-1234 +
chrome-headless-shell + ffmpeg), restarted render-service BY PORT (lsof -t
-iTCP:3100, not pkill -f which matches the wrong process). Verified: the exact
palantir URL that was 500ing now returns 200 with 734,027 chars of HTML.

Lesson: this cost several wrong theories because I read the GATEWAY log and the
n8n execution data, but not the render-service log, for far too long. When an
item has clean_text=0 but html is also absent, the fetch failed — go straight
to the fetcher's own log.

### NEXT RUN THEN BLOCKED — Tavily search quota exhausted

With render-service fixed, the very next full run failed EARLIER, at the
discovery stage (HTTP Request -> api.tavily.com/search):

    HTTP 432 — "This request exceeds your plan's set usage limit."

Tavily's free tier is spent. This is the discovery search provider and it has
NO fallback: the workflow references Exa in comments but no EXA_API_KEY is set
in .env, and the frontend key pool has no search keys to forward (unlike the 9
LLM keys). So end-to-end AI Search cannot complete right now for a reason I
cannot fix without a key I do not have.

This is a genuine external blocker, not a code bug. Options for the next session,
in order of effort:
  1. Wait for Tavily's quota to reset (daily/monthly depending on plan).
  2. Add a second Tavily key and rotate (same pattern as the gateway LLM pool)
     — but the HTTP Request node reads $env.TAVILY_API_KEY directly, so this
     needs the node changed to try a pool, or the search moved behind a small
     rotating proxy.
  3. Wire Exa as a real fallback provider (EXA_API_KEY + a branch in Build
     Multi-Source Search Plan / HTTP Request).

State of the extraction thread: the code fixes are in (Playwright reinstalled,
Clean HTML reads .html, guard_skipped/no_response/render split instrumented).
Whether they actually raise the returned count CANNOT be measured until a
search provider has quota. Do not claim the extraction win until one clean run
completes with render-service healthy AND search working.

### ROOT CAUSE FOUND — silent render failures (18 Aug, final)

The guard_skipped/no_response split settled it in one run:

    extraction_status: extracted 50 | guard_skipped 20 | no_response 0
    scoring_status   : scored 21 | extraction_failed 0 | skipped_no_content 7

no_response = 0. The gateway NEVER fails — that theory is dead for good, and
rotation is doing its job. All losses are guard_skipped, and the guard says why:

    "extracted content is only 0 chars (min 50); extraction_meta.blocks_kept
     is 0 (extractor found nothing usable); no header"

Checked clean_text on those items directly: 0 chars, every one. So Extract Main
Content is NOT at fault — it is handed nothing. The loss is upstream.

The cause is the 'playwright' node (HTTP call to render-service :3100/fetch):

    onError: continueRegularOutput

When a render fails, n8n passes the item through with an EMPTY payload instead
of stopping it. $json.data is undefined, Clean HTML produces clean_text = 0,
the guard skips it, and Build Response tells the student "N discovered pages
had no readable job details" — a claim about the POSTING, when the truth is our
own fetch failed. Same mislabel family as is_paid and skipped_no_content.

Confirmed the pages themselves are fine: fetching those URLs by hand returns
7,982 clean chars with correct headings.

Note also instagram.com/reel appears among the guard_skipped items, so the
discovery filter is not rejecting it on this path — worth checking whether the
filter runs before or after this branch.

### FIX (not yet applied — needs a session with room to verify)
  1. Stop treating a failed render as a valid empty item. Either set the node
     to stop on error for that item, or tag it (render_failed) and carry the
     reason through, so it can never be counted as skipped_no_content.
  2. Add render_failed as a distinct scoring_status, alongside the
     guard_skipped/no_response split already in place.
  3. Then correct Build Response copy so only genuinely thin pages are
     described as having no job details.
  4. Re-measure. scored was 21 this run (best of the day, up from 15).

### no_response is TWO things — my instrumentation conflated them

Read the gateway log for a failing run, as the previous entry said to do:

    provider_failed 58 total
      groq        PROVIDER_RATE_LIMITED       40
      gemini      PROVIDER_TRANSIENT_FAILURE  12
      openrouter  PROVIDER_RATE_LIMITED        3
      gemini      PROVIDER_TIMEOUT             2
    key rotations 40
    requests completed 58 — ALL status 200
    durations: median 1.7s, p90 4.9s, max 71.7s (node timeout is n8n's 300s
                default, so nothing is timing out on our side)

EVERY gateway request eventually succeeded. Rotation absorbed all 40 groq rate
limits exactly as designed. So the gateway is NOT the problem, and the rate
limiting that looked alarming is being handled.

The item counts do not reconcile with 58 requests, and the reason is the
'guard node' that sits between Extract Main Content and HTTP Request2. It marks
an item extraction_skipped when clean_text and main_content are both empty or
shorter than MIN_CONTENT_LENGTH = 50, and those items NEVER REACH THE GATEWAY.
They then arrive at JSON Parse with neither data nor text — which my
instrumentation labels 'no_response'.

So no_response conflates "we asked and got nothing" with "we never asked", and
the second is the common case. My earlier conclusion that "20 extraction calls
returned nothing usable from the gateway" was WRONG, and the pacing experiment
was built on it — which is why pacing made things worse rather than better.

Next, and this time cheap and specific:
  1. Split the status properly: guard_skipped (never sent) vs no_response
     (sent, nothing back). One line in JSON Parse — provenance already carries
     extraction_skipped and skip_reason from the guard.
  2. Then ask the real question: why is main_content under 50 chars for these
     pages, when render-service returns 7,000+ cleaned chars for the same URLs?
     That points at Extract Main Content's heading detection, not at capacity,
     not at the gateway, and not at rate limits.

### NEW — postings admitted with no title
Two results came back with title None and low scores (FloLabs 60, Redis 50).
A posting with no title should probably not be shown to a student at all;
at minimum it should not occupy a slot above a titled one.

### Still open on this thread
- [x] Extraction FIXED & verified — root cause was render-service's Chromium
      being uninstalled; reinstalled + Clean HTML reads .html. Clean run: 0
      skips, 10/10, full tier. (was: ~12 legitimate postings unreadable)
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
