# Opportunity Radar V2: Master Blueprint

## SECTION 1: PRODUCT BLUEPRINT

**Mission:** To engineer an unfair advantage for students entering the workforce by bridging the gap between academic capability and hiring realities.
**Vision:** To be the definitive Student Career Operating System—the unified infrastructure where universities manage placements, students execute their job hunt, and recruiters find verified, interview-ready talent.
**Positioning Statement:** For ambitious college students overwhelmed by the chaotic job hunt, Opportunity Radar is the Career Operating System that centralizes job discovery, AI-driven application prep, and pipeline tracking in one zero-prompt workflow.

**Core User Loop:**
1. **Discover:** Opportunity drops on Radar with an 85%+ Match Score.
2. **Tailor:** ATS Engine highlights gaps and AI optimizes the resume with one click.
3. **Apply & Track:** Export, apply, and save to Pipeline (Tracker).
4. **Practice:** 5-minute Mock Chat session for the specific company while waiting.

**Product Pillars:**
1. Zero-Prompt Intelligence (Invisible AI)
2. Workflow Aggregation (End-to-end tooling)
3. Institutional Alignment (Built for placement cells too)

**Target Audiences:**
* **Primary Customer:** College Students (Freshmen to Seniors)
* **Secondary Customer:** University Placement Cells
* **Tertiary Customer:** Recruiters & Talent Acquisition

**Success Metrics:**
* **North Star Metric:** Placement Readiness Score (PRS) improvement delta (Pre vs. Post platform use).
* **Secondary Metrics:** Applications tracked per week, ATS score improvements, Day 0/1 campus placement rates (B2B).

---

## SECTION 2: USER FLOWS

### FLOW 1: Student Journey
1. **Student Signup:** OAuth via Google/University Email.
2. **Profile Creation:** Inputs major, graduation year, and top 3 target roles.
3. **Resume Upload:** Uploads existing PDF.
4. **Resume Parsing:** Backend extracts structured JSON (Skills, Edu, Exp) and populates Profile.
5. **Opportunity Matching:** Feed auto-filters based on parsed skills, calculating Match Scores.
6. **ATS Analysis:** Student clicks a job. Engine compares Profile JSON to Job JSON, returning a score (e.g., 65%).
7. **Resume Optimization:** Student clicks "Optimize." Engine rewrites 2 weak bullet points using the STAR method. Score hits 85%.
8. **Application:** Student exports the tailored PDF and applies on the company site.
9. **Tracker:** Opportunity is auto-saved to "Applied" on the Kanban board.
10. **Interview Preparation:** Student clicks "Practice" on the tracker card. A timed text chat asks 3 behavioral questions based on the job.
11. **Offer:** Student moves card to "Offer Accepted." System recalculates placement stats.

### FLOW 2: Placement Officer Journey
1. **Dashboard Login:** Officer logs into the "Dean's Dashboard."
2. **Batch Analysis:** Views Placement Readiness Score (PRS) averages across the batch.
3. **Identify Gaps:** Sees that 40% of CS students fail ATS checks due to missing "Docker" skills.
4. **Campus Drive Creation:** Posts an exclusive "On-Campus" opportunity.
5. **Targeted Blast:** Sends the opportunity only to students with a PRS > 80.
6. **Tracking:** Monitors real-time application and interview conversion rates.

### FLOW 3: Recruiter Journey
1. **Direct Sourcing:** Recruiter logs in to view a verified talent pool.
2. **Filter by PRS:** Recruiter filters for students with an ATS score > 90% for a specific role profile.
3. **View Portfolio:** Reviews the student's dynamic profile and verified skills.
4. **Outreach:** One-click message to the student inviting them to an interview.

### FLOW 4: Chrome Extension Journey
1. **Browsing:** Student finds a job on LinkedIn or Wellfound.
2. **Parsing:** Extension scrapes the job description and title.
3. **Match Preview:** Extension displays an overlay: "Opportunity Radar Match: 75%."
4. **Save to OS:** Student clicks "Save." The job is instantly added to their Opportunity Radar Tracker under "Saved."

---

## SECTION 3: FEATURE ARCHITECTURE

**LAYER 1: Career Intelligence**
* **Purpose:** Core data layer for the student.
* **Features:** Dynamic Profile, Resume Parser.
* **Inputs:** PDF Resumes, manual profile updates.
* **Outputs:** Structured JSON Profile, Extracted Skills array.

**LAYER 2: Opportunity Intelligence**
* **Purpose:** High-signal job aggregation.
* **Features:** Smart Feed, Opportunity Match Score.
* **Inputs:** Scraping pipelines, manual employer posts.
* **Outputs:** Ranked opportunity feed per user.

**LAYER 3: Resume Intelligence**
* **Purpose:** Application optimization.
* **Features:** ATS Scoring Engine, Resume Bullet Optimizer, PDF Exporter.
* **Inputs:** Target Job Description, Student Profile JSON.
* **Outputs:** ATS Score (0-100), AI-rewritten bullet points, Tailored PDF.

**LAYER 4: Interview Intelligence**
* **Purpose:** Mock interview prep.
* **Features:** Text-based Mock Chat.
* **Inputs:** Target Job Description, Student Resume.
* **Outputs:** 3 custom questions, post-chat feedback scorecard.

**LAYER 5: Application Intelligence**
* **Purpose:** Pipeline management.
* **Features:** Kanban Tracker, Chrome Extension Clipper.
* **Inputs:** User drags/drops cards, Extension triggers.
* **Outputs:** Organized application funnel.

**LAYER 6: Placement Intelligence**
* **Purpose:** B2B oversight.
* **Features:** Dean's Dashboard, Batch Analytics, Placement Readiness Score (PRS).
* **Inputs:** Aggregated student metrics.
* **Outputs:** University-level reports, Campus Drive listings.

---

## SECTION 4: PRIORITY MATRIX

**PHASE 1: Critical (Build Now)**
* Dynamic Student Profile (Schema update)
* Chrome Extension Clipper (Growth loop)
* Application Tracker (Core retention)
* Smart Feed (Basic keyword matching)

**PHASE 2: Important (Build Next)**
* Resume Parser (PDF to JSON)
* ATS Scoring Engine (Comparing Resume vs Job)
* Opportunity Match Score (UI integration)

**PHASE 3: Advanced (Differentiators)**
* Resume Bullet Optimizer (AI rewrites)
* Text-based Mock Chat
* Placement Command Center (Dean's Dashboard)

**PHASE 4: Future (Do Not Build Yet)**
* Voice/Video Interview Simulator
* Career Roadmapping
* Recruiter Direct Messaging
* Complex Analytics

---

## SECTION 5: SCREEN ARCHITECTURE

**1. Career Command Center (Home)**
* **Purpose:** The OS Desktop.
* **Widgets:** Placement Readiness Score (PRS) gauge, Top 3 Recommended Jobs, Upcoming Deadlines, Active Applications count.
* **Navigation Flow:** Click jobs -> Detail, Click PRS -> Resume OS.

**2. Opportunity Feed (The Radar)**
* **Purpose:** Curated discovery.
* **Widgets:** Infinite scroll list, Match Score badge (e.g., 85%), Quick Save button.

**3. Opportunity Detail**
* **Purpose:** Deep dive on a role.
* **Widgets:** Job description, ATS Gap Analysis (Missing keywords), "Optimize Resume" CTA, "Add to Tracker" CTA.

**4. Resume OS**
* **Purpose:** The master record.
* **Widgets:** Parsed JSON visualizer (Edu, Exp, Skills), "Upload New Version" button, PDF Export preview.

**5. ATS Center**
* **Purpose:** Tailoring workflow.
* **Widgets:** Side-by-side view (Job Description vs. Resume), AI Bullet suggestions, Real-time score meter.

**6. Application Tracker (The Pipeline)**
* **Purpose:** Kanban board.
* **Widgets:** Columns (Saved, Applied, Interview, Offer, Rejected), Card with job title and company logo, "Practice Interview" CTA on cards in the "Interview" column.

**7. Interview Center (Mock Chat)**
* **Purpose:** Practice area.
* **Widgets:** Chat interface, Timer, Post-chat scorecard (Clarity, Relevance, Technical accuracy).

**8. Placement Dashboard (B2B)**
* **Purpose:** University oversight.
* **Widgets:** Batch PRS average, Top missing skills table, Application velocity chart.

---

## SECTION 6: DATABASE BLUEPRINT

**Existing Tables To Keep:**
* `profiles`, `companies`, `opportunity_tags`, `bookmarks`, `notifications`, `audit_log`

**Existing Tables To Modify:**
* `opportunities`: Add `match_criteria` (JSONB) for scoring, `embedding` (vector) for semantic search.
* `application_tracker`: Add `ats_score_at_apply` (int), `interview_score` (int).

**New Tables Required:**
* `resumes`: `id`, `user_id`, `parsed_data` (JSONB), `is_master` (boolean), `created_at`.
* `mock_interviews`: `id`, `user_id`, `opportunity_id`, `transcript` (JSONB), `feedback_score` (JSONB), `created_at`.
* `universities` (For B2B): `id`, `name`, `domain`, `admin_id`.
* `campus_drives`: `id`, `university_id`, `opportunity_id`, `min_prs_required`.

**Data Flow:**
Upload PDF -> Serverless Function -> LLM Parser -> `resumes.parsed_data` -> Sync to `profiles`.

---

## SECTION 7: AI ARCHITECTURE

**1. Resume Parser Engine**
* **Logic:** Use Gemini 1.5 Flash. Pass PDF text. Prompt: "Extract into rigorous JSON schema: Education, Experience, Projects, Skills."
* **Storage:** Save to `resumes.parsed_data`.

**2. ATS Scoring Engine**
* **Logic:** Heuristic + Vector match. Compare `resumes.parsed_data.skills` with `opportunities.skills`. Calculate percentage overlap.
* **Output:** Int (0-100) + Array of missing keywords.

**3. Resume Optimizer Engine**
* **Logic:** Triggered by user. Pass Target Job + Weak Resume Bullet to Gemini. Prompt: "Rewrite this bullet using the STAR method incorporating [Missing Keyword]."
* **Output:** 3 string options for the user to select.

**4. Interview Engine**
* **Logic:** System prompt primes Gemini as a strict technical recruiter for [Company] hiring for [Role]. State machine handles 3 turns of conversation.
* **Output:** Final JSON scorecard evaluating the user's responses.

---

## SECTION 8: SYSTEM ARCHITECTURE

**Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui.
**Backend:** Next.js API Routes (Server Actions) + Supabase PostgREST.
**Database:** PostgreSQL (Supabase) + `pgvector` for semantic embeddings.
**Queue/Worker System:** **MANDATORY ADDITION.** Move off Vercel Serverless for ingestion and AI parsing. Use **Inngest** or **Trigger.dev** (or Railway/Render background workers) to handle long-running PDF parsing and web scraping without timeouts.
**File Storage:** Supabase Storage (PDFs, Avatars).
**Search System:** Migrate from `pg_trgm` FTS to `pgvector` hybrid search (keyword + semantic).

**Scalability Breakdown:**
* **100 - 1000 users/day:** Supabase compute handles this trivially. Vercel handles frontend trivially. Worker system easily processes PDF uploads.
* **5000 users/day:** Vector search on 10,000+ opportunities starts consuming CPU. Need to upgrade Supabase compute tier and implement Redis caching for the "Smart Feed."

---

## SECTION 9: IMPLEMENTATION ROADMAP

**Sprint 1: The OS Foundation**
* **Goals:** Restructure the database and UI to fit the OS paradigm.
* **Features:** Command Center UI, Chrome Extension Clipper (MVP), update `profiles` and `tracker` schema.
* **Risk Level:** Low.

**Sprint 2: Resume Intelligence**
* **Goals:** PDF parsing and the ATS Engine.
* **Features:** Upload PDF -> Parse to JSON pipeline via worker. ATS scoring algorithm (compare JSON vs Job).
* **Risk Level:** High (LLM parsing accuracy and latency).

**Sprint 3: Opportunity Intelligence**
* **Goals:** Smart Feed and vector search.
* **Features:** Enable `pgvector`, generate embeddings for existing 4,700 opportunities, implement Match Score UI.
* **Risk Level:** Medium (Database migration).

**Sprint 4: Application & Interview Intelligence**
* **Goals:** The optimization loop.
* **Features:** Resume Bullet Optimizer (AI rewrites), Text-based Mock Chat.
* **Risk Level:** Medium (Prompt engineering).

**Sprint 5: Institutional Alignment (B2B)**
* **Goals:** The Placement Dashboard.
* **Features:** Dean's Dashboard UI, batch analytics, Campus Drive logic.
* **Risk Level:** Low.

---

## SECTION 10: FINAL CTO REVIEW

**What should be built first?**
The Chrome Extension Clipper and the Resume Parser. The clipper solves the immediate problem of tracking external jobs, and the parser locks their identity into your database.

**What should never be built?**
A Voice/Video Real-Time Interview Bot. The infrastructure cost will bankrupt you before you hit Series A, and students will hate the latency. Stick to text-based mock chats.

**What is the highest ROI feature?**
The **ATS Scoring Engine**. It creates instant anxiety ("I have a 45% match!") and provides an immediate solution ("Click here to optimize to 85%"). It drives the entire loop.

**What is the biggest technical risk?**
Vercel Serverless timeouts. Scraping Internshala/LinkedIn and parsing PDFs takes longer than 10-60 seconds. You *must* move these to a background worker system (Inngest, Railway, etc.) or the platform will collapse under load.

**What is the biggest product risk?**
"AI Fatigue." If the AI generates hallucinated skills or generic corporate buzzwords, recruiters will blacklist resumes originating from Opportunity Radar, killing your reputation.

**What would make a university officially recommend this platform?**
The Dean's Dashboard. If you can show a Placement Officer exactly which students are slacking, which skills the cohort is missing, and provide a single portal to run their campus drives, they will mandate it.

**What would make students return weekly?**
The Kanban Tracker powered by the Chrome Extension. Once it becomes their source of truth for their job hunt, they have to return to move cards and check statuses.

**What would make recruiters trust it?**
The "Placement Readiness Score" (PRS). If you prove that a student with an 85+ PRS has verified skills and an ATS-proof resume, recruiters will use the platform to source top-tier, pre-vetted talent.
