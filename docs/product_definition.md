# Opportunity Radar V2: Product Definition Exercise

## PART 1: IDENTITY

**What exactly is Opportunity Radar V2?**

**Selection:** 3. Career Operating System

**Justification:**
An "Opportunity Discovery Platform" only focuses on finding the job (the current state). A "Career Assistant" or "AI Copilot" implies an external helper rather than a foundational platform. A "Student Success Platform" is too broad and often implies academic success. 
A **Career Operating System** perfectly encapsulates the vision. An operating system is the central infrastructure that manages all resources and workflows. For a student, Opportunity Radar V2 is the central hub where their entire professional life is built, managed, and executed—from their resume and skill development to interview prep and application tracking. It is the underlying engine for their career progression.

---

## PART 2: USER JOURNEY

**1. New Student → Creates Account**
The student lands on the platform and creates an account using their university email. During onboarding, they provide their major, graduation year, and broad career interests. The system instantly creates their baseline "Student Profile."

**2. Uploads Resume**
The student uploads their existing resume (or creates one from scratch). The system parses the document, scores it against industry ATS standards, and extracts their current skills, projects, and experiences into the "Resume OS."

**3. Discovers Opportunities**
Based on the parsed skills and onboarding preferences, the "Opportunity Intelligence" engine surfaces highly relevant, curated internships, hackathons, and jobs. The feed is personalized—no generic scrolling.

**4. Improves Resume**
The student selects a target opportunity. The "ATS Engine" compares their current parsed resume against the job description, highlights missing keywords, and the "AI Career Coach" suggests tailored bullet points to increase their match percentage.

**5. Practices Interview**
Once the application is ready, the student uses the "Interview Simulator" to conduct a mock audio/text interview. The AI asks behavioral and technical questions specific to the job description and the student's resume, providing real-time feedback on pacing and content.

**6. Applies**
The student applies directly to the opportunity, armed with a highly tailored resume and interview confidence.

**7. Tracks Progress**
The application is automatically logged in the "Application Tracker." The student moves it through stages (Applied, Interviewing, Offered) via a Kanban board, centralizing their entire pipeline.

**8. Gets Offer**
The student accepts an offer. The "Career Roadmap" recalculates their long-term trajectory, logging this success and suggesting the next tier of skills to acquire for their eventual full-time role.

---

## PART 3: CORE MODULES

### Required Modules:

**1. Opportunity Intelligence**
* **Purpose:** The aggregator and recommendation engine for jobs, internships, and hackathons.
* **User Value:** Saves hours of manual searching by delivering highly curated, relevant roles.
* **Business Value:** Drives daily active users (DAU) and platform stickiness. The core hook.

**2. Resume OS & ATS Engine**
* **Purpose:** A centralized, dynamic resume builder and parser that scores resumes against specific job descriptions.
* **User Value:** Eliminates the "black hole" of applying by ensuring their resume passes ATS filters.
* **Business Value:** High-value, monetizable feature. Transforms the platform from a "job board" to a "career tool."

**3. Application Tracker**
* **Purpose:** A Kanban-style board to track the status of all applications, deadlines, and follow-ups.
* **User Value:** Reduces anxiety and organizational chaos during peak application seasons.
* **Business Value:** Increases retention by becoming the system of record for the student's job hunt.

**4. Interview Simulator**
* **Purpose:** An AI-driven module to practice behavioral and technical interviews tailored to specific roles.
* **User Value:** Builds confidence and drastically improves conversion rates from interview to offer.
* **Business Value:** A massive competitive differentiator that colleges and students value deeply.

**5. Student Profile (Digital Portfolio)**
* **Purpose:** The centralized identity of the student, storing their verified skills, projects, and experiences.
* **User Value:** A single source of truth to power all other modules (resumes, recommendations, tracking).
* **Business Value:** Rich first-party data for the platform.

### Deprioritized Modules (For now):
* **AI Career Coach** (Too abstract; better integrated directly into Resume and Interview modules)
* **Career Roadmap** (Too long-term; focus on the immediate pain point of getting the *first* offer)
* **Analytics** (Can be delayed; basic tracking is sufficient initially)

---

## PART 4: FEATURE PRIORITIZATION

### Tier 1: Must Have (The Core Loop)
* **Smart Opportunity Feed:** Aggregation and personalized filtering.
* **Resume Parser & Scorer:** Upload a PDF, get an ATS score and extracted data.
* **Application Tracker:** Basic Kanban board linked to opportunities.
* **Dynamic Student Profile:** The underlying data model storing skills and experiences.

### Tier 2: Should Have (The Differentiators)
* **Resume Tailoring:** AI suggestions to tweak resume bullets for a specific job description.
* **Mock Interview Chatbot:** Text-based behavioral interview prep tailored to a job.
* **Automated Deadline Tracking:** Notifications for upcoming application closes.

### Tier 3: Nice To Have (The Expansions)
* **Voice-based Interview Simulator:** Real-time audio conversations with AI.
* **Automated Follow-up Drafter:** AI-generated email drafts for reaching out to recruiters.
* **Skill Gap Analysis:** Highlighting missing skills across the entire target industry.
* **Public Portfolios:** A shareable link of the student's profile.

---

## PART 5: UNIQUE VALUE

**Why use Opportunity Radar instead of...**

* **LinkedIn:** LinkedIn is a generic social network for seasoned professionals. It is noisy, intimidating for students with no experience, and not optimized for the student workflow (hackathons, entry-level internships).
* **Internshala / Unstop:** These are purely transactional job boards. You find a job and leave. They do not help you prepare, improve your resume, or practice for the interview.
* **Wellfound:** Heavily startup-focused and lacks the tooling to help students actually win the job.
* **ChatGPT:** ChatGPT is a generic text box. It requires immense prompt engineering from the student. Opportunity Radar embeds the AI into a structured workflow (upload resume → click job → auto-generate tailored bullets).

**The Unique Value Proposition:**
Opportunity Radar is the *only* end-to-end ecosystem built exclusively for students. It doesn't just show them the door (job board); it builds the key (resume), prepares them for the conversation (interview prep), and manages the journey (tracker) all in one unified operating system.

---

## PART 6: STARTUP TEST

If a college vice chairman is going to mandate one platform for their students, they are looking for **measurable student success (placement rates).**

**What must Opportunity Radar provide?**
A guarantee that students are applying with high-quality resumes and are prepared for interviews, resulting in higher placement rates for the university.

**What features are essential?**
* **Resume ATS Scoring:** Ensures the university's students aren't failing automated filters.
* **Interview Prep:** Ensures they can pass the behavioral and technical screens.
* **Verified Opportunities:** High-quality, scam-free entry-level jobs and internships.

**What features are unnecessary?**
* **Social Networking/Feeds:** Universities already have alumni networks; they don't need another generic social feed.
* **Generic Career Content:** Articles and blog posts about "How to dress for an interview." Focus on actionable tooling.

---

## PART 7: FINAL PRODUCT DEFINITION

### Mission
To empower every student to navigate the transition from campus to career with confidence, clarity, and precision.

### Vision
To be the foundational Operating System for the global student workforce—the single platform where every collegiate career is built, managed, and launched.

### Positioning Statement
For ambitious college students overwhelmed by the chaotic job hunt, Opportunity Radar is the Career Operating System that centralizes job discovery, AI-driven application prep, and pipeline tracking. Unlike traditional job boards or generic AI tools, Opportunity Radar provides an end-to-end workflow tailored specifically for early-career success.

### Product Pillars
1. **Intelligent Discovery:** High-signal, low-noise curation of student-focused opportunities.
2. **Actionable Preparation:** Tools that actively improve the user's odds (ATS scoring, tailored resumes, mock interviews).
3. **Frictionless Organization:** Seamless management of the entire application lifecycle.

### Core User Loop
1. **Discover** a highly relevant opportunity.
2. **Tailor** the resume using AI to match the job description.
3. **Apply** and instantly move it to the Tracker.
4. **Practice** via the Interview Simulator while waiting for the callback.
