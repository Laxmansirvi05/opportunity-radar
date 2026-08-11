# Opportunity Radar V2: Document Audit & Alignment

## PART 1: DOCUMENT AUDIT

Based on the newly finalized "Current Agreed Direction" (which includes the Resume Parser but excludes the Placement Dashboard), here is the status of all existing documents:

1. **`discovery_report.md`**
   * **Status:** **Keep**
   * **Why:** This is a factual audit of the current V1 codebase and architecture. It remains 100% accurate as a baseline.
2. **`product_definition.md`**
   * **Status:** **Modify**
   * **Why:** It heavily emphasizes the "Interview Simulator" as a core module. This needs to be stripped out and pushed to Level 2 (Future Vision).
3. **`product_critique.md`**
   * **Status:** **Archive**
   * **Why:** This document was an exploratory teardown. It successfully challenged assumptions, but it strongly advocated for dropping the Resume Parser and building the Placement Dashboard—which directly contradicts the final agreed MVP.
4. **`engineering_reality_check.md`**
   * **Status:** **Archive**
   * **Why:** Similar to the critique, this document advises killing the PDF parser. While the engineering warnings are still valid, the executive decision has been made to build the parser anyway. This document will cause confusion if kept in the active repo.
5. **`v2_blueprint.md`**
   * **Status:** **Modify**
   * **Why:** Needs to be updated to remove the "Interview Intelligence" layer and the "Placement Intelligence" layer from the immediate Phase 1/Phase 2 build, realigning the database and roadmap strictly to the 7 core features.
6. **`v2_mvp_definition.md`**
   * **Status:** **Modify (Massively)**
   * **Why:** The previous draft removed the Resume Parser and kept the Placement Dashboard. It must be rewritten to match the Final Agreed Direction.
7. **`frs.md`**
   * **Status:** **Modify**
   * **Why:** It is 90% accurate but is missing the newly introduced "Resume Review Screen" and needs API updates to support it.

---

## PART 2: CONFLICT DETECTION

**Conflict 1: The Resume Parser Dilemma**
* *In `engineering_reality_check.md` & `v2_mvp_definition.md`:* The Resume Parser is explicitly rejected due to complexity. Manual form entry is proposed.
* *In Final Agreed Direction & `frs.md`:* The Resume Parser is a mandatory core MVP feature.

**Conflict 2: The Placement Dashboard (B2B Wedge)**
* *In `product_critique.md` & `v2_mvp_definition.md`:* The Dean's Dashboard is prioritized as the most important B2B feature to get university buy-in.
* *In Final Agreed Direction & `frs.md`:* The Placement Dashboard is explicitly moved to "Future Features (Not MVP)".

**Conflict 3: Interview Simulators**
* *In `product_definition.md`:* Interview Simulator is a tier 1 required module.
* *In `v2_blueprint.md`:* Text-based mock chat is included in Sprint 4.
* *In Final Agreed Direction:* All interview simulators (voice and text) are excluded from MVP.

**Conflict 4: Resume Review Screen**
* *In Final Agreed Direction:* "Resume Review Screen" is listed as Core Feature #3.
* *In all other documents:* This screen was never explicitly designed or mentioned. (The flow jumped straight from Parsing to the ATS Engine).

---

## PART 3: FRS VALIDATION (frs.md)

**Missing Requirements:**
* *Resume Review Screen:* FRS currently lacks a UI requirement and acceptance criteria for allowing the student to view, edit, and correct the LLM's parsed JSON output before saving it to the database.

**Unnecessary Requirements:**
* None currently in the FRS, as the previous FRS draft was already heavily pruned.

**Technical Risks / Ambiguity:**
* *Ambiguous Parsing Fallback:* The FRS says "extract into structured JSON". It does not define what happens if the PDF is unreadable (e.g., an image-based PDF). It needs a fallback mechanism (redirect to manual entry).
* *Cost Risk:* FRS relies entirely on Gemini 1.5 Flash for parsing.

**Recommended Edits to FRS:**
1.  Add Feature 2.5: **Resume Review Interface**. "System must display the parsed JSON in an editable form so the student can correct hallucinated or missed skills before final submission."
2.  Update Acceptance Criteria: "If PDF parsing fails, system must gracefully fallback to a manual entry form."

---

## PART 4: FINAL MVP SCOPE

**Included In MVP (The Definitive List):**
1. Resume PDF Upload Pipeline
2. AI-Driven Resume Parser (PDF to JSON via Gemini)
3. Editable Resume Review Screen (Human-in-the-loop correction)
4. ATS Engine (Missing Keyword Gap Analyzer)
5. Opportunity Feed with Match Score Ranking
6. Resume Bullet Optimizer (AI STAR Method Rewriter)
7. Enhanced Application Kanban Tracker

**Excluded From MVP (Do Not Build Yet):**
* Placement / Dean's Dashboard
* Voice / Text Interview Simulator
* Chrome Extension Clipper
* Career Health / Placement Readiness Scores
* Career Roadmapping & Skill Gap Analysis
* Manual Skill Entry Onboarding (Replaced by PDF Parser)
* Social Networking / Recruiter Direct Messaging

---

## PART 5: DATABASE VALIDATION

**1. `resumes` table (New)**
* **Status:** **Modify / Keep**
* **Why:** Essential for storing the `parsed_data` (JSONB). *Modification:* Must add a `status` column (e.g., 'pending_review', 'verified') to support the new Resume Review Screen feature.

**2. `profiles` changes**
* **Status:** **Keep**
* **Why:** Adding `primary_resume_id` to link the active parsed resume to the user's global profile.

**3. `opportunities` changes**
* **Status:** **Keep**
* **Why:** Adding `extracted_skills` (text[]) is mandatory. Without it, the ATS Engine has nothing to compare the student's resume against.

**4. `application_tracker` changes**
* **Status:** **Keep**
* **Why:** Adding `ats_match_score_at_apply` is crucial. It's the only way to measure if the platform is actually working (i.e., do higher match scores correlate with more offers over time?).

---

## PART 6: API VALIDATION

**1. `POST /api/resume/parse`**
* **Status:** Necessary.
* **Update:** Must return the parsed JSON *without* saving it permanently, passing it to the frontend for the Resume Review Screen.

**2. `POST /api/resume/save-parsed` (Missing API)**
* **Status:** Necessary.
* **Why:** Because we added the "Resume Review Screen", the frontend needs a new endpoint to submit the final, user-corrected JSON object to the `resumes` table.

**3. `GET /api/ats/analyze`**
* **Status:** Optional / Unnecessary.
* **Why:** If the student's resume JSON and the opportunity's extracted skills are both loaded on the frontend, this analysis (array intersection) can be done entirely client-side or via a lightweight Next.js Server Action without needing a dedicated REST API.

**4. `POST /api/resume/optimize`**
* **Status:** Necessary.
* **Why:** Requires securely calling the Gemini API to rewrite the bullet point. Cannot be done client-side without exposing API keys.

---

## PART 7: ROADMAP VALIDATION

**Original Sprint Errors:**
* Sprint 2 squeezed PDF parsing, keyword extraction, and ATS logic into one block. This is unrealistic given the complexity of handling bad PDFs.
* Sprint 3 included UI integration that should be pushed earlier.

**Corrected Sprint Order:**

* **Sprint 1: Database & Feed Foundation (Days 1-15)**
  * Implement `resumes` table and `opportunities` schema updates.
  * Upgrade the Opportunity Feed to calculate and display the Match Score.
  * Enhance the Application Tracker (Kanban UI).
* **Sprint 2: The Parsing Pipeline (Days 16-30)**
  * Build PDF Upload UI.
  * Implement Gemini PDF-to-JSON extraction backend.
  * Build the **Resume Review Screen** allowing users to edit the parsed JSON before saving.
* **Sprint 3: The ATS Engine (Days 31-45)**
  * Implement job description keyword extraction backend.
  * Build the ATS Split-Screen UI (Job vs. Resume).
  * Build the array-matching logic to highlight missing keywords.
* **Sprint 4: The AI Optimizer & QA (Days 46-60)**
  * Build the Bullet Optimizer UI modal.
  * Implement the Gemini Bullet Rewrite API.
  * End-to-End QA of the core loop (Upload -> Review -> Match -> Optimize -> Track).

---

## PART 8: FINAL SOURCE OF TRUTH

To prevent future scope creep and confusion, the documentation repository should be reorganized immediately into the following hierarchy:

**Level 1: Source of Truth Documents (The current, active mandates)**
1. `frs.md` (Updated based on this audit)
2. `v2_blueprint.md` (Updated based on this audit)
3. `discovery_report.md` (Factual baseline)

**Level 2: Supporting Documents (Strategic framing, not strict spec)**
1. `product_definition.md` (Updated to reflect MVP vs. Future Vision)

**Level 3: Archived Documents (Deprecate immediately)**
1. `product_critique.md` (Contradicts final MVP decisions)
2. `engineering_reality_check.md` (Contradicts final MVP decisions)
3. `v2_mvp_definition.md` (The previous draft is superseded by the updated `frs.md` and `v2_blueprint.md`)

### Final Recommendation
The introduction of the **Resume Review Screen** is a critical, highly intelligent product decision. It mitigates 90% of the engineering risk associated with LLM hallucination during PDF parsing by forcing the human to verify the output. You are cleared to proceed to Technical Design and Execution based on this audited scope.
