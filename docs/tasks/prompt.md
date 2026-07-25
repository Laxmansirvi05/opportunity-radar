# Ralph Loop Permanent Operating Contract

## Operational Directives
Every Ralph iteration MUST execute the following sequence:

1. Read `PRD.md` completely to understand the current engineering objective and tasks.
2. Read `docs/tasks/progress.txt` to establish context and verified baseline.
3. Inspect `git status` and recent `git log` history to understand the active work state.
4. Select the highest-priority incomplete task from `PRD.md` whose dependencies are fully satisfied.
5. Inspect relevant existing implementation thoroughly before editing any code. MUST VERIFY BEFORE MODIFYING. If existing code satisfies a criterion, do not rewrite it; record existing evidence.
6. **CHANGE BUDGET:** Make the smallest possible change required to achieve the task objective. Ralph MUST NOT refactor unrelated code. Ralph MUST NOT modify a file unless it is absolutely necessary for the active acceptance criterion.
7. Run targeted unit/integration tests for the modified files.
8. **REGRESSION RULE:** Run appropriate regression tests. The known baseline is 155 passing / 8 skipped. Ralph MUST NOT introduce NEW test failures. Existing legacy TypeScript errors are baseline debt. Ralph MUST NOT introduce NEW TypeScript errors in files it changes.
9. Build the application when appropriate to verify compilation.
10. **NEVER** weaken tests, schemas, validation logic, security rules, or scoring algorithms merely to obtain a PASS.
11. **NEVER** fabricate successful external-provider results if the real service failed.
12. **NEVER** modify `.env` files or expose credentials/secrets.
13. **NEVER** deploy to production.
14. **NEVER** perform destructive database operations.
15. **NEVER** rewrite unrelated working code.
16. **NEVER** silently change ATS scoring constants.
17. **NEVER** delete failing tests simply to make the suite pass.
18. Update `docs/tasks/progress.txt` with concrete evidence of execution and results.
19. Commit only verified, tested work.

## Git Rule
- **NEVER** force push.
- **NEVER** reset or rewrite existing history.
- **NEVER** commit secrets.
- **NEVER** merge into the production/main branch.
- Work **ONLY** on the Ralph-created branch.

## Loop Escape Rule
If the same failure occurs in 2 consecutive iterations without meaningful new evidence or progress, Ralph MUST mark the task **BLOCKED** and move to another independent task.
Do NOT repeatedly modify code attempting to solve an external failure.

## Blocker Policy
If execution is blocked by API quota limits, invalid credentials, unavailable provider, external service outage, or missing user decision, Ralph MUST explicitly record the state as **BLOCKED** in `progress.txt` and continue ONLY if another independent task from `PRD.md` is safely executable. 

Do NOT attempt to solve external quota/credential problems by weakening validation. Do not treat infrastructure failures as justification for redesigning working code.

### Failure Classification
Ralph MUST explicitly distinguish and log failures according to these categories:
- `CODE_FAILURE`: Logical error or bug in the implemented code.
- `TEST_FAILURE`: Regressions or failing assertions in the test suite.
- `ENVIRONMENT_FAILURE`: Local setup, Node version, or internal tooling issues.
- `PROVIDER_FAILURE` / `PROVIDER_UNAVAILABLE`: External AI provider returned errors (e.g., 500, quota exceeded, invalid auth).
- `SCHEMA_FAILURE`: The response from the external provider violated the enforced Zod/JSON schema.
- `EXTERNAL_SERVICE_FAILURE`: General external API outage.
- `APPLICATION_FAILURE`: An actual UI/implementation failure (distinguished from provider unavailability).

## Playwright Policy
Use Playwright for verifying user-visible changes. Playwright should **verify**, not silently repair.
For relevant UI tasks, Ralph MUST:
- Start and use the application on localhost.
- Exercise the feature through actual UI interactions in the browser simulator.
- Inspect the browser console for runtime exceptions and warnings.
- Inspect failed network requests.
- Distinguish `APPLICATION_FAILURE` from `PROVIDER_UNAVAILABLE`. A provider outage/quota/credential problem MUST NOT be reported as a UI implementation failure.
- Record PASS/FAIL evidence.
- A Playwright failure MUST return the loop to implementation rather than being ignored.

## Completion Policy
A task may be marked `COMPLETE` ONLY when its explicit acceptance criteria defined in `PRD.md` are demonstrably satisfied by concrete output.
"Agent believes it works" is **NOT** completion evidence. Passing tests, successful build logs, and Playwright verification output constitute valid evidence.
