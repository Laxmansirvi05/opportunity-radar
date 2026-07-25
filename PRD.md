# CURRENT ENGINEERING OBJECTIVE
Complete the implementation, integration, and stabilization of ATS V2.1 (Recruiter/HR Intelligence).

## PRODUCT VISION
The ATS should approximate how a competent recruiter/HR reviewer evaluates a candidate for a SPECIFIC job. The final score must remain deterministic. AI/semantic reasoning may interpret evidence, but must not arbitrarily generate the final score. 

The system must distinguish:
NONE → learning/familiarity → listed-only skill → project application → professional/internship application → strong repeated evidence → quantified real-world impact.

## TASKS (ATS V2.1 PRIORITIES)

### P0 — SAME-INPUT STABILITY
Identical Resume + JD + configuration must produce stable evidence classifications and effectively stable ATS scores.
Investigate benchmark variation (e.g., Aarav marker test varying by +13).

### P1 — QUANTIFIED IMPACT EVALUATION
Ensure the system accurately differentiates between "wrote code" and "wrote code that scaled to 85,000+ records, 30% reporting-time reduction" and appropriate impact recognition. Metrics must only receive impact credit when semantically connected to the relevant accomplishment.

### P2 — SEMANTIC RETRIEVAL
Improve legitimate semantic matching. 
- "Integrated Stripe, OpenWeather and GitHub APIs" should support "API integration".
- But Vercel MUST NOT automatically become AWS. Docker MUST NOT become Kubernetes. Vue MUST NOT become React. Power BI MUST NOT become Tableau.
Semantic matching must improve recall without increasing hallucination.

### P3 — HARD REQUIREMENTS
Replace primitive hard-requirement detection where necessary.
Explicit requirements (degree, graduation status, work authorisation, required certification, minimum experience) must be evaluated using grounded resume evidence. Unknown must remain UNKNOWN rather than being invented as PASS. Do not infer protected/sensitive characteristics.

### P4 — USER-FACING SCORE CLARITY
Determine whether legacy V3 Keyword Coverage is still visible beside ATS V2. The primary user-facing result should represent recruiter-style ATS V2. Do not allow users to confuse legacy keyword scoring with the V2 HR evaluation. Preserve V3 internally only if required for compatibility.

### P5 — THREE-RESUME ACCEPTANCE BENCHMARK
Use the existing benchmark resumes (Aarav Mehta, Emily Carter, Daniel Kim) and their profession-appropriate JDs. 
Validation markers (Nimbus Cedar 47, Quartz Finch 82, Aurora Maple 95) must have zero meaningful scoring influence. Do NOT force predetermined ATS scores. Cross-profession scores should fall appropriately when capability evidence is absent.

### P6 — PLAYWRIGHT FINAL ACCEPTANCE
After backend/reasoning tests pass, use Playwright to verify: Resume upload → extraction → JD → ATS analysis → ATS V2 result → evidence → gaps → recruiter recommendations. Inspect console, network, and runtime errors.
