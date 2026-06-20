# Opportunity Radar V2: MVP Definition

## PART 1: FINAL MVP FEATURES

**Surviving Features (The "Must-Haves"):**
1. **Application Tracker (Kanban):** Retained because it is the core retention loop for students. It creates a habit of returning weekly to update status.
2. **ATS Engine (Gap Analyzer):** Retained because it provides immediate, high-anxiety value. Comparing a student's skills against a job description is technically cheap but perceived as incredibly valuable.
3. **Resume Optimizer (Bullet Rewriter):** Retained because it is the "magic" AI feature. It solves the hardest part of applying: figuring out what to write.
4. **Smart Feed (Keyword Match Score):** Retained to replace the generic scrolling feed. It guarantees students see highly relevant jobs immediately.
5. **Placement Dashboard (Dean's Dashboard):** Retained because it is the only way a university Vice Chairman will mandate the platform. It provides institutional oversight.

**Rejected Features (The "Feature Bloat"):**
* *Resume PDF Parser:* Rejected. PDF parsing is an engineering nightmare full of edge cases. Force students to manually input their skills/experience to guarantee clean database JSON.
* *Interview Simulator:* Rejected. Requires massive engineering effort (state machines, latency) and is only used sporadically by students.
* *Chrome Extension:* Rejected for MVP. LinkedIn DOM scraping breaks weekly. It's a maintenance burden a 30-day team cannot afford.
* *Career Health Score / Roadmapping:* Rejected. Pure vanity metrics that do not help a student get an internship *today*.

---

## PART 2: MVP USER FLOW

**The Optimized Student Journey:**
1. **Student Signup:** OAuth via Google.
2. **Profile Creation (Manual):** Student completes a 60-second wizard: Major, Grad Year, Top 10 Skills, and 2 recent experiences (Role, Company, Description). *No PDF parsing.*
3. **Opportunity Matching:** Student lands on the Radar (Feed). Jobs are sorted by a basic "Match Score" based on their Top 10 Skills.
4. **ATS Analysis:** Student clicks a job. The UI shows a side-by-side: "You have 6/10 required skills." Missing keywords are highlighted in red.
5. **Resume Optimization:** Student clicks an existing experience bullet. The AI suggests a rewrite using the missing keywords and the STAR method.
6. **Application:** Student copies the optimized bullets to their resume, applies externally.
7. **Tracker:** Student clicks "Added to Tracker." The job moves to the Kanban board under "Applied."
8. **Success:** Student updates the Tracker to "Interview" and eventually "Offer," triggering a win state on the Placement Dashboard.

---

## PART 3: MVP SCREENS

1. **Career Command Center (Home)**
   * **Purpose:** The OS Desktop.
   * **Components:** Active Applications Summary, 3 Highest Match Jobs, Quick link to Profile.
   * **Actions:** View job, update tracker.

2. **The Radar (Opportunity Feed)**
   * **Purpose:** Curated discovery.
   * **Components:** List of opportunities, Match Score badge (e.g., 85%), Quick filters.
   * **Actions:** Save to tracker, click to view details.

3. **Opportunity Detail + ATS Center**
   * **Purpose:** Tailoring workflow.
   * **Components:** Split screen. Left: Job Description. Right: Student Skills & Experience. Middle: Missing Keywords list.
   * **Actions:** "Rewrite Bullet," "Add to Tracker."

4. **Application Tracker (The Pipeline)**
   * **Purpose:** Kanban board.
   * **Components:** Columns (Saved, Applied, Interview, Offer, Rejected).
   * **Actions:** Drag and drop cards, add notes.

5. **Student Profile**
   * **Purpose:** The master data record.
   * **Components:** Forms for Skills, Education, and Experiences.
   * **Actions:** Add/Edit/Delete experiences.

6. **Placement Dashboard (B2B)**
   * **Purpose:** University oversight.
   * **Components:** Aggregated stats (Total Apps, Offers), "Top Missing Skills" chart for the batch.
   * **Actions:** Export reports.

---

## PART 4: MVP DATABASE

**Existing Tables to Reuse (Keep it Simple):**
* `profiles`: Expand to store `skills` (text[]) more rigorously.
* `companies`: Reuse as-is.
* `opportunities`: Add `extracted_skills` (text[]) if not already present.
* `application_tracker`: Reuse as-is.

**New Tables Required (Absolute Minimum):**
* `profile_experiences`: `id`, `user_id`, `role`, `company`, `description`, `created_at`. (Instead of parsing PDFs, we store experiences natively to feed the Resume Optimizer).
* `universities`: `id`, `name`, `admin_id`. (To link students to a specific Placement Dashboard).

---

## PART 5: MVP AI SYSTEMS

**1. The Resume Optimizer Engine (The ONLY generative AI system in MVP)**
* **Inputs:** Target Job Description excerpt, User's raw experience description from `profile_experiences`, Missing Keywords.
* **Outputs:** 2 structured, professional bullet points using the STAR method.
* **Processing:** Simple API call to Gemini 1.5 Flash. Prompt: *"Rewrite this student's experience into a professional resume bullet point. Incorporate these missing keywords naturally: [Keywords]."*
* **Cost:** Extremely low. Gemini Flash is fractions of a cent per request.

*(Note: The ATS Engine and Match Score do NOT use AI. They use simple array intersections in code (e.g., `job.skills.filter(s => !user.skills.includes(s))`). This guarantees zero hallucination and zero API cost).*

---

## PART 6: MVP ROADMAP

**30 Day Plan: Core Workflows**
* Upgrade `profiles` schema to include `profile_experiences`.
* Enhance the Application Tracker (Kanban UI).
* Implement the basic Match Score algorithm (array overlap logic).

**60 Day Plan: The ATS & AI Magic**
* Build the ATS Center split-screen UI.
* Integrate the Gemini API for the Resume Optimizer Engine.
* Connect the ATS Center to the Tracker (one-click apply & track).

**90 Day Plan: The B2B Wedge**
* Build the `universities` table and association logic.
* Build the Dean's Dashboard (Read-only analytics for university admins).
* Polish UI, fix bugs, and deploy V2 MVP to production.

---

## PART 7: VICE CHAIRMAN TEST

**Would he recommend it?**
Yes.

**Why?**
Because for the first time, he has a dashboard that tells him *why* his students are failing to get interviews (the "Top Missing Skills" chart), and he can see the exact volume of applications his batch is sending out.

**What objections would remain?**
"Students hate filling out forms manually. Why can't they just upload their PDF?"

**What should be built after MVP?**
The Resume PDF Parser and the Chrome Extension Clipper. Once the core workflow is proven and university buy-in is secured, spend the engineering capital on the complex parsing and scraping features to reduce friction.

---

## PART 8: FINAL CTO DECISION

**If only ONE feature can be built first, which feature should it be and why?**

**The ATS Engine (Gap Analyzer).**

It is the beating heart of the Student Career OS. It fundamentally shifts the platform from a passive "Job Board" to an active "Career Tool." 

When a student clicks an opportunity and the system immediately highlights: *"You are missing Python and Docker, which are required for this role,"* it creates an undeniable "Aha!" moment. It provides clarity in a chaotic process. 

More importantly, it is mathematically simple to build (just string array comparisons) but provides immense perceived value, proving to the student that Opportunity Radar is actively fighting to get them hired. Build this first.
