# Ralph Loop Permanent Operating Contract

## Operational Directives
Every Ralph iteration MUST execute the following sequence:

1. Read `PRD.md`, `docs/tasks/prompt.md`, `docs/tasks/progress.txt`.
2. Inspect `git status`.
3. Select the HIGHEST priority unresolved task from `PRD.md`.
4. Reproduce the problem BEFORE changing code.
5. Make the smallest justified change.
6. Run focused tests.
7. Run relevant recruiter/adversarial tests.
8. Run type-check for modified scope.
9. If verified, create a checkpoint commit.
10. Update progress.txt with:
    ITERATION
    TASK
    HYPOTHESIS
    FILES CHANGED
    TESTS
    RESULT
    FAILURE CATEGORY
    COMMIT
    NEXT ACTION
11. End the iteration cleanly so Ralph can start the next iteration.

## Absolute Destructive Command Ban
RALPH MUST NEVER EXECUTE:
- `git reset`
- `git reset --hard`
- `git clean`
- `git restore`
- `git checkout`
- `git checkout --`
- `git stash`
- `git rebase`
- `git switch`

No equivalent destructive command may be used.
If an edit is incorrect: FIX IT FORWARD.
Never destroy working-tree state to undo it.

## Safety Rules
- NEVER delete tests to obtain PASS.
- NEVER weaken schemas.
- NEVER weaken hallucination protection.
- NEVER fabricate provider responses.
- NEVER modify `.env` or expose secrets.
- NEVER push or deploy.
- NEVER perform destructive database operations.

## Checkpoint Policy
After each independently verified improvement:
`git add` ONLY relevant files, then commit.
Use descriptive commits such as `fix(ats-v2): ...` or `test(ats-v2): ...`.
Do not bundle unrelated changes.

## Loop Escape Rule
If the SAME root failure occurs in TWO consecutive iterations without meaningful improvement:
DO NOT attempt the same fix again.
Record `BLOCKED` with evidence and continue to another independently solvable priority.
External provider failures (quota/rate-limit/network) are `PROVIDER_FAILURE`, not application failures.

## Efficiency
- Do not repeatedly reread the entire repository.
- Use `progress.txt` as persistent loop memory.
- Use targeted searches.
- Use focused tests before full test suite.
- Use Sequential Thinking only for ambiguous architectural/root-cause problems.
- Use Playwright only after relevant backend/UI state is ready.
- Prefer existing infrastructure over creating new abstractions.
- Do not refactor unrelated Opportunity Radar features.

## Loop Budget
Configure this work for approximately 8 Ralph iterations.
If all completion gates pass before iteration 8: STOP EARLY.
Do NOT continue changing working code just because iterations remain.

## Completion Gates
ATS V2.1 may be marked COMPLETE only when:
- [ ] Evidence strength differentiates claim vs demonstrated experience
- [ ] Quantified impact is recognised when grounded
- [ ] Keyword stuffing does not outperform demonstrated evidence
- [ ] Semantic equivalents receive appropriate credit
- [ ] Related-but-different technologies are not hallucinated
- [ ] Hard requirements are grounded
- [ ] Unknown requirements remain unknown
- [ ] Same input produces acceptably stable result
- [ ] Marker manipulation has no meaningful effect
- [ ] Three profession-specific benchmarks are reasonable
- [ ] Cross-profession sanity checks behave appropriately
- [ ] ATS V2 tests pass
- [ ] Schema-aware fallback tests pass
- [ ] No new TypeScript errors
- [ ] Playwright E2E passes
- [ ] No production auth bypass exists from test infrastructure
- [ ] Working tree is clean
- [ ] All completed work is committed
