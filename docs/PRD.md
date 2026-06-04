# Product Requirements Document (PRD): Opportunity Radar

## 1. Executive Summary
Opportunity Radar is a centralized platform designed to empower students and recent graduates by aggregating internships, jobs, hackathons, workshops, scholarships, and competitions into a single, intuitive dashboard. Recognizing the fragmented nature of student opportunities across the internet, this product serves as a single source of truth, enabling users to discover, track, and act on career-defining opportunities efficiently. The integration of an existing Resume Toolkit further solidifies its position as an end-to-end career preparation and application management hub.

## 2. Problem Statement
Currently, students face significant friction in discovering and managing career and learning opportunities. Information is siloed: internships on LinkedIn or Wellfound, hackathons on Devpost or Unstop, and scholarships on university portals. Consequently, students spend hours context-switching and repeatedly checking platforms, leading to missed deadlines, uncertainty about active opportunities, and a disorganized, anxiety-inducing application process.

## 3. Vision Statement
> "A student should never miss an opportunity to learn, compete, gain experience, or get hired."

## 4. Product Goals
- **Centralization:** Create a unified, single-pane-of-glass dashboard for all student-focused opportunities.
- **Efficiency:** Drastically reduce the time students spend searching for opportunities by providing a real-time "Fresh Opportunities" feed.
- **Organization:** Empower students to track their applications from initial discovery to final outcome.
- **Synergy:** Seamlessly integrate with the existing Resume Toolkit to provide a holistic career prep experience without reinventing the wheel.

## 5. Target Audience
**Primary Users:**
- College and University Students (especially Engineering/Tech students)
- Fresh Graduates (Freshers)
- Internship and Job Seekers

**Secondary Users:**
- Student Clubs and Educational Communities
- Training Organizations
- Workshop and Hackathon Organizers

## 6. User Personas
**Persona 1: The Hustling Junior (Alex)**
- **Background:** 3rd-year CS student looking for summer internships and hackathons to build his portfolio.
- **Pain Point:** Keeps a messy Google Sheet of application links; often forgets deadlines and misses out on early-bird registrations.
- **Goal:** Needs a system that reminds him of deadlines and tracks his application statuses effortlessly.

**Persona 2: The Anxious Fresher (Priya)**
- **Background:** Recent graduate actively seeking entry-level software engineering roles.
- **Pain Point:** Spends 4 hours a day refreshing 10 different job boards. Can't easily tell which postings are active, newly posted, or stale.
- **Goal:** Wants a real-time feed of the freshest jobs and an integrated ATS resume checker to validate her resume before applying.

## 7. User Pain Points
- **Scattered Information:** Opportunities are spread across dozens of disparate websites and newsletters.
- **Missed Deadlines:** Lack of a centralized tracking and reminder system.
- **Stale Data:** Inability to distinguish between active, newly posted opportunities and outdated, saturated ones.
- **Application Chaos:** Struggling to remember where they applied and the current status of each application.
- **Repetitive Searches:** Wasting time running the same queries across multiple platforms every day.

## 8. User Stories
- **As a student**, I want to see a feed of opportunities posted in the last 24 hours, so I can apply early and increase my chances.
- **As a job seeker**, I want to filter opportunities by "Remote" and "Paid", so I find roles that fit my financial and geographical criteria.
- **As an applicant**, I want to move an opportunity from "Saved" to "Applied", so I can track my progress through the hiring funnel.
- **As a user**, I want to see exactly how many days and hours are left before a deadline, so I can prioritize my applications.
- **As a fresher**, I want to view a company's profile to see all their active openings, so I can target specific employers I admire.

## 9. MVP Scope (Version 1)
The MVP focuses purely on aggregation, tracking, and organization for the student. It includes the Opportunity Hub, Fresh Opportunities feed, Smart Deadline Tracker, Company Profiles, Search/Filtering, Bookmarking, Application Tracking, Student Dashboard, and Notification System, alongside the integration of the existing Resume Toolkit. 

*Note: AI features, community forums, and advanced recommendation engines are strictly deferred to future versions.*

## 10. Feature Breakdown
1. **Opportunity Hub:** The core listing interface displaying title, category, company info, location, mode (online/offline), dates, and descriptions.
2. **Fresh Opportunities:** Time-boxed feeds (last 1h, 2h, 6h, 12h, 24h, this week) to prioritize early applications.
3. **Smart Deadline Tracker:** Visual countdowns (e.g., "Closing today", "2 days left") and status indicators.
4. **Company Information Page:** Dedicated pages for organizations detailing their profile, website, and active listings.
5. **Search and Filtering:** Faceted search by category, location, company, skills required, remote/hybrid/onsite, and paid/free.
6. **Bookmark System:** "Save for later" functionality.
7. **Application Tracker:** A Kanban-style or list-based pipeline (Saved → Applied → Interview Scheduled → Selected → Rejected).
8. **Student Dashboard:** A personalized hub summarizing upcoming deadlines, saved items, application stats, and fresh alerts.
9. **Resume Toolkit Integration:** Surfacing the existing Resume Builder, ATS Score Checker, and Download tools within the platform.
10. **Notification System:** In-app alerts (and optionally email) for new matches, approaching deadlines, and application updates.

## 11. Functional Requirements
- **Data Ingestion:** The system must structure opportunities with standard metadata (Category, Dates, Links) regardless of source.
- **Time/Date Processing:** The backend must continuously calculate the difference between the current time and deadlines to power the Smart Deadline Tracker accurately across time zones.
- **User Authentication:** Secure sign-up/login system to persist user states (Bookmarks, Tracker).
- **Tracker State Machine:** Applications must have strict state transitions (Saved, Applied, Interviewing, etc.) that the user can manually update.
- **Resume Integration:** The app must render the existing Resume Toolkit components seamlessly, ideally sharing the same user session and authentication state.
- **Filtering Engine:** Queries must efficiently filter opportunities across multiple dimensions simultaneously without lag.

## 12. Non-Functional Requirements
- **Performance:** Pages must load in under 2 seconds. The "Fresh Opportunities" feed must update with minimal latency.
- **Responsiveness:** The UI must be fully optimized for mobile devices, as students predominantly browse on their phones between classes.
- **Security:** Standard JWT or session-based authentication; secure handling of any user data (especially resumes and application data).
- **Scalability:** The architecture (e.g., database indexing, caching for the Fresh feed) must support rapid scaling if a specific listing goes viral on campus.
- **UI/UX:** Clean, modern, distraction-free interface emphasizing readability, typography, and quick actions.

## 13. Success Metrics
- **User Engagement:** Daily Active Users (DAU) and Weekly Active Users (WAU).
- **Feature Adoption:** Average number of opportunities bookmarked per user; Number of items moved to "Applied" in the tracker.
- **Retention:** Percentage of users returning within 7 days of their first visit (D7 Retention).
- **Time-to-Value:** Average time from account creation to the first bookmarked opportunity.
- **Tool Usage:** Percentage of active users utilizing the Resume Toolkit / ATS Checker before applying.

## 14. Risks and Challenges
- **Data Sourcing & Freshness:** Relying on manual entry, curation, or web scraping can lead to stale or incomplete data if not managed properly. 
- **User Habituation:** Overcoming inertia to get students to switch from their existing tracking methods (Notion, Excel, Notes app) to this platform.
- **Link Rot:** Opportunities closing early or changing URLs without notifying aggregators.

## 15. Assumptions
- Students will proactively use the platform to track their status manually, finding enough value in the dashboard to maintain the habit.
- The existing Resume Toolkit has a modular architecture (APIs, embeddable components) that allows for seamless integration into this new frontend.
- We can reliably source enough high-quality opportunity data to make the MVP valuable and "sticky" on day one.
- The target demographic has reliable internet access and modern web browsers.

## 16. Future Roadmap (Beyond MVP)
- AI Career Assistant & Skill Gap Analysis.
- AI Learning Recommendations based on rejected applications or missing skills.
- Community Reviews for companies, internships, and hackathons.
- Student Discussion Forums.
- AI Opportunity Predictor (predicting when a company will likely post an internship based on historical data).
- Advanced Recommendation Engine tailored to a user's uploaded resume and tracked behavior.

## 17. Out of Scope Features (For MVP)
- In-app messaging or social networking features.
- Direct applications through the platform (users will be redirected to the official link).
- Employer dashboards and employer-facing posting tools (MVP focuses purely on the student/consumer experience).
- Payment gateways or premium student subscriptions.

## 18. Competitive Positioning
Unlike generic job boards (LinkedIn, Indeed) which cater to all professionals, Opportunity Radar is hyper-focused on the student lifecycle. Unlike niche platforms (Unstop for competitions, Wellfound for startups), this platform aggregates *everything* a student needs—jobs, internships, hackathons, and scholarships—into one place, while providing a dedicated application pipeline tracker that standard job boards lack.

## 19. Unique Value Proposition (UVP)
**"The only platform that combines real-time student opportunity discovery, end-to-end application tracking, and an integrated ATS Resume Toolkit in a single, unified dashboard."**

## 20. Product Launch Strategy
- **Phase 1: Alpha Testing:** Invite a closed group of 50-100 students from local university tech clubs to test the tracking pipeline, UX flows, and provide UI feedback.
- **Phase 2: Beta Launch:** Open registration to specific university campuses. Partner with student ambassadors and campus coding clubs (e.g., GDSC, ACM chapters) to drive initial adoption and trust.
- **Phase 3: Public Launch:** Leverage LinkedIn, Twitter, and Discord student communities. Create content around "How I organize my tech internship hunt" showcasing the platform's Dashboard and Fresh Opportunities feed.
- **Growth Loop:** Encourage users to share their ATS-checked resumes and "Application Pipeline" stats on social media, driving organic, product-led growth traffic back to the platform.
