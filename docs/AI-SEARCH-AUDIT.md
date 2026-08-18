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
- [ ] **Cross-user RLS.** Sign in as A, take a job id, fetch it as B. Untested.
      Hard stop if it leaks.
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
      details. The skip itself is a deliberate, documented token optimisation;
      the real problem is render-service extraction. **Highest-value fix
      available to this feature** — would roughly double results without
      touching anything else.
- [ ] **Score calibration.** A frontend resume scored 100 on a SQL internship
      off "student with existing SQL knowledge", outranking four well-matched
      frontend roles. Lives in the gateway's `score_fit` prompt. Note the
      pipeline runs on Groq alone — comments say Gemini returns 404
      ("no longer available to new users"), so there is no fallback and no
      second opinion.

## Deployment (after the above)

- [ ] `AI_AGENT_URL` and `AI_AGENT_INTERNAL_SECRET` set in Vercel. Without the
      secret, Caddy rejects every call. Unset locally is correct.
- [ ] Host: cannot run on Vercel — job-server spawns `n8n execute`, runs
      setInterval daemons, passes work via local filesystem, drives Chromium,
      and takes 78-781s per run. Needs an always-on VM.
- [ ] Azure for Students ($100, no card, verified by college email) is the
      card-free option; ~3 months on a 4GB box. Cloudflare Tunnel is the free
      interim for anything that does not need to stay up.
