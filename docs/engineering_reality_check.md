# Opportunity Radar V2: Engineering Reality Check

## PART 1: ENGINEERING REALITY CHECK

**1. Resume Parser**
*   **Build Complexity:** High (Handling bad PDFs is notoriously difficult).
*   **Engineering Effort:** 3-4 weeks.
*   **Dependencies:** Background worker system (cannot run on Vercel Edge).
*   **External APIs Required:** PDF.js/MuPDF for text extraction, OpenAI/Gemini for structuring into JSON.
*   **Estimated Cost:** Moderate (LLM API tokens per parse).
*   **Scalability Risk:** High CPU load on workers; requires strict rate limiting.

**2. ATS Engine**
*   **Build Complexity:** Medium.
*   **Engineering Effort:** 2 weeks.
*   **Dependencies:** Resume Parser output + Job Description text.
*   **External APIs Required:** None (can be done with `pgvector` or basic TF-IDF in code).
*   **Estimated Cost:** Low.
*   **Scalability Risk:** Low.

**3. Match Score**
*   **Build Complexity:** Medium.
*   **Engineering Effort:** 1 week (if heuristic), 4 weeks (if Vector DB).
*   **Dependencies:** Parsed student skills, parsed job skills.
*   **External APIs Required:** Supabase `pgvector`, OpenAI/Gemini Embeddings API.
*   **Estimated Cost:** Low (embeddings are cheap).
*   **Scalability Risk:** Medium (requires careful indexing in PostgreSQL).

**4. Resume Optimizer**
*   **Build Complexity:** Medium.
*   **Engineering Effort:** 2 weeks.
*   **Dependencies:** ATS Engine output.
*   **External APIs Required:** OpenAI/Gemini (Prompt: "Rewrite this using STAR method").
*   **Estimated Cost:** High (Generative LLM tokens per click).
*   **Scalability Risk:** Medium (API rate limits from OpenAI/Anthropic/Google).

**5. Interview Simulator (Text-based)**
*   **Build Complexity:** High.
*   **Engineering Effort:** 4 weeks.
*   **Dependencies:** Job description, user profile.
*   **External APIs Required:** Fast LLM API (e.g., Groq, Gemini Flash).
*   **Estimated Cost:** Moderate.
*   **Scalability Risk:** Medium (Managing stateful websocket/chat sessions).

**6. Chrome Extension**
*   **Build Complexity:** High (Chrome Manifest V3 restrictions, DOM scraping across different sites).
*   **Engineering Effort:** 3-5 weeks.
*   **Dependencies:** Auth sharing between web app and extension.
*   **External APIs Required:** None.
*   **Estimated Cost:** Free to host.
*   **Scalability Risk:** Low backend risk, but High maintenance burden (DOM changes on LinkedIn will break your scraper constantly).

**7. Placement Dashboard**
*   **Build Complexity:** Medium.
*   **Engineering Effort:** 2-3 weeks.
*   **Dependencies:** Complex SQL aggregations, robust RLS policies.
*   **External APIs Required:** None.
*   **Estimated Cost:** Free.
*   **Scalability Risk:** High database load for complex analytical queries across thousands of students.

**8. Placement Readiness Score (PRS)**
*   **Build Complexity:** Low.
*   **Engineering Effort:** 1 week.
*   **Dependencies:** Profile completeness, ATS average scores.
*   **External APIs Required:** None.
*   **Estimated Cost:** Free.
*   **Scalability Risk:** Low.

**9. Career Health Score / Skill Gap Analysis**
*   **Build Complexity:** Extreme.
*   **Engineering Effort:** 8+ weeks.
*   **Dependencies:** Massive ontology of jobs vs. skills, knowledge graph mapping.
*   **External APIs Required:** Specialized APIs (e.g., Lightcast) or massive custom LLM pipelines.
*   **Estimated Cost:** High.
*   **Scalability Risk:** High.

---

## PART 2: TEAM ANALYSIS (Small Student Team, Limited Budget)

**What can realistically be built in:**

*   **30 Days (Sprint 1): The Tracker & Basic Parsing**
    *   Enhance the Application Tracker UI.
    *   Implement basic heuristic Match Scores (array overlap).
    *   Implement Placement Readiness Score (simple math).

*   **60 Days (Sprint 2): Resume OS MVP**
    *   Implement PDF text extraction (using a free library).
    *   Send text to Gemini Flash for JSON structuring (Resume Parser).
    *   Build the ATS Engine (comparing parsed JSON to Job Description).

*   **90 Days (Sprint 3): The Optimization Loop**
    *   Implement Resume Optimizer (LLM rewrites bullets).
    *   Build the Placement Dashboard MVP (basic tables and charts).

*   **180 Days (Sprint 4): The Expansion**
    *   Chrome Extension MVP (LinkedIn scraping only).
    *   Text-based Interview Simulator.

---

## PART 3: FEATURE ROI MATRIX

| Feature | Student Value | Univ. Value | Recruiter Value | Implementation Cost | ROI Score |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ATS Engine** | High | High | High | Low | **Highest** |
| **Application Tracker** | High | Medium | Low | Low | **Highest** |
| **Placement Dashboard**| Low | High | Low | Medium | **High** |
| **Resume Optimizer** | High | Medium | Low | Medium | **High** |
| **Match Score** | High | Low | Medium | Low/Medium | **High** |
| **Chrome Extension** | High | Low | Low | High | Medium |
| **Interview Simulator**| Medium | High | High | High | Medium |
| **Resume Parser** | High | Low | Low | High | Medium |
| **Skill Gap Analysis** | Medium | Medium | Low | Extreme | **Lowest** |
| **Career Health Score**| Low | Low | Low | Extreme | **Lowest** |

**Top 5 Highest ROI Features:**
1. ATS Engine
2. Application Tracker (Core utility)
3. Resume Optimizer
4. Placement Dashboard (B2B sales key)
5. Match Score

---

## PART 4: MVP V2

If a small student team can only build 5 features in the next cycle, build these:

1.  **Application Tracker (Enhanced):** It costs $0 in API fees, is easy to build with Supabase, and forms the core retention loop for students.
2.  **Match Score:** Simple string/array matching to rank the feed. Easy to build, massively improves the user experience over a dumb chronological feed.
3.  **ATS Engine:** Compare a user's skills against a job description. High perceived value, easy to implement (just compare two arrays of text and highlight the missing ones).
4.  **Resume Optimizer:** The "magic" feature. One-click LLM call to rewrite a bullet point. Cheap to build using Gemini API, high "wow" factor for students.
5.  **Placement Dashboard:** The B2B wedge. Just build a simple Next.js admin page showing aggregate student stats. It is low technical effort but unlocks institutional partnerships.

**Why these 5?**
They require zero expensive infrastructure (no vector databases yet, no WebRTC, no complex background workers). They solve immediate pain points (customizing resumes, tracking applications, college oversight) with low engineering risk.

---

## PART 5: TECHNICAL RISKS

*   **Most Likely Failures:**
    *   **The Chrome Extension:** LinkedIn frequently changes its DOM structure specifically to break scrapers. You will spend 30% of your engineering time maintaining this.
    *   **Background Scraping Cron Jobs:** Vercel serverless functions will timeout. If you don't move to a dedicated worker (e.g., Render/Railway), data ingestion will fail silently.

*   **Most Expensive Features:**
    *   **Resume Optimizer & Parsing:** LLM token costs scale linearly with user base. Free users parsing 10 PDFs a day will bankrupt you if not rate-limited.
    *   **Semantic Vector Search:** Running `pgvector` queries on a large dataset requires significant RAM, forcing you onto expensive Supabase compute tiers.

*   **Features likely to be abandoned:**
    *   **Interview Simulator:** Students are lazy. Unless they have an interview tomorrow, they won't use it. It is high effort for low DAU.

*   **Features likely to create maintenance burden:**
    *   **Skill Gap Analysis:** Maintaining an accurate ontology of what skills map to what jobs across the entire tech industry is a full-time data engineering job.

---

## PART 6: CTO DECISION

As the CTO, here is my brutally practical advice:

**What would you build first?**
The **ATS Engine** combined with the **Application Tracker**. This creates the immediate loop: *Find Job -> Check Score -> Apply -> Track.*

**What would you delay?**
The **Resume Parser**. Stop trying to read messy PDFs via LLMs right now. Force the user to manually enter their top 10 skills during onboarding. It takes them 30 seconds and saves you 4 weeks of engineering nightmare. You can build the parser later when you have funding.
Delay **Vector Search**. Use basic keyword matching (`tsvector` in Postgres) for now.

**What would you remove completely?**
**Skill Gap Analysis**, **Career Health Score**, and the **Interview Simulator**. You are a small student team. Do not build AI novelty features. Build a reliable workflow tool.

**What is the shortest path to creating a product that a university would actually recommend?**
Build the **Placement Dashboard** fed by the **Application Tracker**. If you can walk into a Placement Cell and say, "We can show you exactly how many applications your CS batch sent out this week, and the top 5 skills they are failing ATS checks on," they will mandate the platform tomorrow.

**What would make students return weekly?**
An immaculate, fast, and satisfying **Kanban Tracker**. It becomes their single source of truth.

**What would make recruiters trust it?**
Do not over-engineer recruiter trust yet. Focus on generating high-quality applications. If students use the ATS Engine to apply with perfectly tailored resumes, recruiters will naturally prefer applications originating from your platform.

### Final Word on Execution
Stop acting like a Google X lab building AGI for careers. Act like an indie hacker.
Use cheap, reliable tech (Postgres, basic SQL, simple API calls). Hardcode solutions where possible. Your biggest enemy is not competitors; it is your own team burning out trying to maintain over-engineered AI pipelines on zero budget. Build the core workflow, sell it to one university, and survive.
