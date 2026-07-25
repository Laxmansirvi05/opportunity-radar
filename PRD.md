# CURRENT ENGINEERING OBJECTIVE
Complete the implementation, integration, and stabilization of the ATS-V2 system (Phase 3C schema-aware AI fallback and E2E validation setup). 

## TASKS

### Task 1: Integrate ATS V2 Backend Logic
- **Objective:** Connect the new schema-aware AI fallback, hallucination guards, and V2 scoring models to the primary ATS check API route.
- **Relevant Files/Components:**
  - `frontend/app/api/resume/ats-check/route.ts`
  - `frontend/lib/ats-checker/scoring-v2.ts`
  - `frontend/features/resume-toolkit/services/ai/ats-v2-intelligence.ts`
- **Verification Before Modification:** Inspect `frontend/app/api/resume/ats-check/route.ts`. Check if it already imports `scoring-v2.ts` or `ats-v2-intelligence.ts`. If it does, record this existing evidence and do not duplicate the integration. (Current finding: it is not integrated yet).
- **Acceptance Criteria:** The API successfully delegates processing to the new `ats-v2` services and returns the expanded response shape containing evidence units.
- **Deterministic Verification:** Ensure API unit tests and routing tests pass. The API route must correctly structure the response when given mock AI provider data.
- **Live Provider Verification:** Execute a real request against the API route using live AI calls. External provider unavailability MUST NOT cause deterministic code verification to be marked failed.
- **Dependencies:** None.
- **Explicit Completion Condition:** The API route builds without new TypeScript errors and successfully responds with the new ATS-V2 payload format to valid requests.

### Task 2: Update ATS UI Components for V2 Evidence
- **Objective:** Modify the ATS Results components to correctly parse, render, and display the new ATS-V2 scoring format and evidence units without breaking.
- **Relevant Files/Components:**
  - `frontend/features/resume-toolkit/components/ats-checker/ats-results.tsx`
  - `frontend/features/resume-toolkit/components/ats-checker/index.tsx`
  - `frontend/types/resume.ts`
- **Verification Before Modification:** Check if `ats-results.tsx` already handles the `AtsV2Score` or `EvidenceMatrix` types. If yes, record evidence and mark criterion satisfied.
- **Acceptance Criteria:** The frontend gracefully consumes the new API payload. Evidence units and AI hallucination guard warnings (if any) are displayed properly.
- **Deterministic Verification:** Ensure the UI components render correctly without crashing when provided with mock V2 evidence data.
- **Live Provider Verification:** Verify the UI renders correctly when receiving a payload from a live provider request.
- **Dependencies:** Task 1.
- **Explicit Completion Condition:** The UI renders the ATS check results without runtime exceptions or console errors.

### Task 3: Stabilize AI Provider Fallbacks
- **Objective:** Validate that the system correctly falls back or handles exceptions when primary AI providers fail (e.g., quota exhaustion, unavailable provider, schema-invalid responses).
- **Relevant Files/Components:**
  - `frontend/features/resume-toolkit/services/ai/ats-v2-hallucination-guard.ts`
  - `frontend/features/resume-toolkit/services/ai/ats-v2-prompts.ts`
  - `frontend/features/resume-toolkit/lib/schema/resume/ats-v2.ts`
- **Verification Before Modification:** Check if the hallucination guard is already properly throwing/returning errors on schema-invalid output in the test files.
- **Acceptance Criteria:** The hallucination guard successfully detects schema-invalid output. The system handles Gemini/Groq credential/quota failures by safely returning proper error boundaries instead of crashing.
- **Deterministic Verification:** Run `frontend/tests/schema-aware-fallback.test.ts`, `frontend/tests/ats-v2-hallucination-guard.test.ts`, and fallback schema tests.
- **Live Provider Verification:** Intentionally trigger a schema-invalid output or a quota error, and verify the app recovers safely.
- **Dependencies:** Task 1.
- **Explicit Completion Condition:** All newly introduced `ats-v2` unit tests run and pass without requiring weakened validation rules.

### Task 4: Playwright E2E Verification
- **Objective:** Verify the entire ATS flow end-to-end via the browser.
- **Relevant Files/Components:** Playwright test suite (`tests/e2e/` or equivalent).
- **Verification Before Modification:** Verify if Playwright currently tests the ATS V2 flow with evidence units.
- **Acceptance Criteria:** The dashboard, resume upload, and ATS checker workflows run successfully in the browser simulator.
- **Deterministic Verification:** N/A (E2E implies live).
- **Live Provider Verification:** Run the Playwright suite. Must distinguish `APPLICATION_FAILURE` (UI bugs, crashes) from `PROVIDER_UNAVAILABLE` (AI API quota/outage). A provider outage/quota/credential problem MUST NOT be reported as a UI implementation failure.
- **Dependencies:** Task 1, Task 2, Task 3.
- **Explicit Completion Condition:** Playwright test run completes with PASS for all tests. No unhandled exceptions in the browser console. No new network errors (excluding known 404/406 issues).
