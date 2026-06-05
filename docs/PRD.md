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
The MVP focuses purely on aggregation, tracking, and organization for the student. The complete, canonical list of what is and is not included in Version 1 is defined in **§17 (MVP Boundaries)**. That section is the single source of truth for scope decisions.

*Note: AI features, community forums, email/SMS notifications, and advanced recommendation engines are strictly deferred to future versions. See §17.*

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
10. **Notification System:** In-app alerts only (bell icon in dashboard) for approaching deadlines, submission approvals, and stale tracking reminders. Email and SMS notifications are deferred to a future version. See §26 for the canonical notification trigger list.

## 11. Functional Requirements
- **Data Ingestion:** The system must structure opportunities with standard metadata (Category, Dates, Links) regardless of source.
- **Time/Date Processing:** The backend must continuously calculate the difference between the current time and deadlines to power the Smart Deadline Tracker accurately across time zones.
- **User Authentication:** Secure sign-up/login system to persist user states (Bookmarks, Tracker).
- **Tracker State Machine:** Applications must have strict state transitions (Saved, Applied, Interviewing, etc.) that the user can manually update.
- **Resume Integration:** The app must render the existing Resume Toolkit components seamlessly, ideally sharing the same user session and authentication state.
- **Filtering Engine:** Queries must efficiently filter opportunities across multiple dimensions simultaneously without lag.

## 12. Non-Functional Requirements
- **Performance:** All pages must achieve a Time-to-Interactive (TTI) of under 2 seconds on a standard 4G connection. The Fresh Opportunities Feed must reflect newly published opportunities within 5 minutes of an Admin or Moderator clicking Publish.
- **Responsiveness:** The UI must be fully functional on screens as small as 375px wide (iPhone SE). Students predominantly browse on mobile devices; all core actions (browse, bookmark, track) must be one-thumb-reachable.
- **Security:**
  - All sessions use JWT with a 7-day expiry, refreshed on active use.
  - All user-submitted text fields (opportunity title, description, notes) are sanitized server-side before storage to prevent XSS.
  - Community submissions are rate-limited to a maximum of 5 per logged-in user per 24-hour period to prevent spam flooding the moderation queue.
  - All API endpoints require authentication except the public Opportunity Hub listing.
- **Scalability:** Database indexes must be defined on `status`, `deadline`, `category`, and `posted_at` fields to ensure filtering queries remain performant as the opportunity count grows beyond 10,000 records.
- **UI/UX:** Clean, modern, distraction-free interface emphasizing readability and quick actions. All critical interactive elements must have unique, descriptive IDs to support browser-based testing.

## 13. MVP Success Criteria
The following targets are set for the first 3 months post public launch. Targets are calibrated for a bootstrapped, campus-first go-to-market with no paid acquisition budget.

| Metric | Target | Rationale |
|---|---|---|
| Registered Users | 500 by end of Month 1; 2,000 by end of Month 3 | Achievable via campus ambassador program + LinkedIn content without paid ads |
| Active Opportunities Pool | 500 curated listings at launch; ≥ 20 new published per day | Sustainable with a part-time admin + community submissions |
| Bookmarks per Active User | ≥ 3 bookmarks per week | Conservative; any engagement above zero validates discovery value |
| Tracker Adoption | 20% of registered users move ≥ 1 opportunity to Applied within 30 days | Realistic first-action conversion for a manual tracking tool |
| D7 Retention | 25% | Benchmarked against B2B-adjacent student tools; 40% is top-tier consumer app territory and not realistic for MVP |
| D30 Retention | 15% | Students who complete one application cycle are the most likely to return |
| Operational: Approval Time | 100% of submissions reviewed within 24 hours | Requires at least one active Moderator |
| Operational: Broken Link Rate | < 2% of active listings | Crowd-sourced reports + daily spot-checks |

## 14. Risks and Mitigation
- **Data Sourcing & Freshness**
  - *Risk:* Relying on manual entry can lead to stale data.
  - *Mitigation:* Implement basic automated cron jobs to archive expired opportunities. Set strict expiration dates for manual entries.
  - *Phase:* MVP
  - *Complexity:* Medium
- **User Habituation**
  - *Risk:* Students may forget to update their application statuses, relying on existing habits like Notion or Excel.
  - *Mitigation:* Trigger an in-app "Stale Tracker" notification ("You saved [Opportunity] 7 days ago — have you applied yet?") via the in-app notification system. Keep the UI frictionless. Note: email/push reminders are a future enhancement.
  - *Phase:* MVP
  - *Complexity:* Low
- **Resume Toolkit Integration Feasibility**
  - *Risk:* The assumption that the Resume Toolkit has a modular, embeddable architecture is unvalidated. If it is a tightly coupled monolith, integration may require weeks of refactoring and could delay the entire MVP launch.
  - *Mitigation:* This must be treated as a **pre-Sprint 1 technical discovery task**. Before architecture design begins, conduct a spike (time-boxed investigation) to confirm integration feasibility. If the integration is not feasible, the Resume Toolkit section must be decoupled to a standalone link rather than an embedded component.
  - *Phase:* Pre-MVP (Discovery)
  - *Complexity:* High
- **Link Rot**
  - *Risk:* Opportunities closing early or changing URLs, leading to frustrating 404 errors for students.
  - *Mitigation:* Provide a "Report Broken Link" button on every opportunity card. Crowd-source data quality.
  - *Phase:* MVP
  - *Complexity:* Low
- **Competitor Response**
  - *Risk:* Generic job boards adding student-specific features.
  - *Mitigation:* Build a hyper-focused, student-first brand identity. Deeply integrate with college communities and the Resume Toolkit.
  - *Phase:* Future
  - *Complexity:* High

## 15. Assumptions
- Students will proactively update their application statuses manually. The Stale Tracker in-app notification (7-day nudge) is sufficient to maintain the habit without email/SMS.
- **[HIGH RISK — must be validated pre-Sprint 1]** The Resume Toolkit can be integrated as an embedded component or via a shared session link. If it is a tightly coupled monolith, it will be decoupled and surfaced as a standalone redirect link with no embedded component. This assumption is also captured as a named Risk in §14.
- The admin team can manually curate and publish ≥ 20 new opportunities per day from Day 1 using a combination of direct admin entry and community submission approvals.
- The target demographic uses modern web browsers (Chrome, Safari, Firefox — past 2 major versions) and has reliable internet access.

## 16. Future Roadmap (Beyond MVP)
- AI Career Assistant & Skill Gap Analysis.
- AI Learning Recommendations based on rejected applications or missing skills.
- Community Reviews for companies, internships, and hackathons.
- Student Discussion Forums.
- AI Opportunity Predictor (predicting when a company will likely post an internship based on historical data).
- Advanced Recommendation Engine tailored to a user's uploaded resume and tracked behavior.

## 17. MVP Boundaries (Crystal Clear — Canonical Source of Truth)
This is the definitive scope boundary document. All other sections defer to this list.

**In Scope (Version 1):**
- Opportunity Hub: viewing, searching, and filtering the full listings.
- Fresh Opportunities Feed (time-boxed: last 1h, 6h, 24h, this week).
- Smart Deadline Tracker with visual countdowns.
- Company Profile pages.
- Bookmark System (Save for Later).
- Application Tracker (manual status updates: Saved → Applied → Interview Scheduled → Selected → Rejected).
- Student Dashboard (saved opportunities, deadlines, application stats).
- Resume Toolkit Integration (linking to existing Resume Builder, ATS Checker, Download).
- In-app Notification System (bell icon — deadline alerts, submission approval, stale tracker nudge).
- User Authentication (sign-up, login, password reset, **account deletion**).
- RBAC (Student, Moderator, Admin roles).
- Admin moderation queue for community submissions.
- Community Submission form (logged-in Students only).
- **Terms of Service and Privacy Policy pages.**

**Out of Scope (Version 1 — Do NOT build):**
- Email or SMS notifications of any kind.
- Certification courses, learning hubs, or curated content.
- AI features (matching, resume parsing, cover letter generation, recommendations).
- Community forums, comments, social features, or user-to-user messaging.
- Direct in-app applications (always redirect to the official external link).
- Employer-facing dashboards or posting tools.
- Automated web scraping bots (all ingestion is human-verified for MVP).
- Paid subscriptions, payment gateways, or premium tiers.

## 18. Competitive Positioning
Unlike generic job boards (LinkedIn, Indeed) which cater to all professionals, Opportunity Radar is hyper-focused on the student lifecycle. Unlike niche platforms (Unstop for competitions, Wellfound for startups), this platform aggregates *everything* a student needs—jobs, internships, hackathons, and scholarships—into one place, while providing a dedicated application pipeline tracker that standard job boards lack.

## 19. Unique Value Proposition (UVP)
**"The only platform that combines real-time student opportunity discovery, end-to-end application tracking, and an integrated ATS Resume Toolkit in a single, unified dashboard."**

## 20. Product Launch Strategy
- **Phase 1: Alpha Testing:** Invite a closed group of 50-100 students from local university tech clubs to test the tracking pipeline, UX flows, and provide UI feedback.
- **Phase 2: Beta Launch:** Open registration to specific university campuses. Partner with student ambassadors and campus coding clubs (e.g., GDSC, ACM chapters) to drive initial adoption and trust.
- **Phase 3: Public Launch:** Leverage LinkedIn, Twitter, and Discord student communities. Create content around "How I organize my tech internship hunt" showcasing the platform's Dashboard and Fresh Opportunities feed.
- **Growth Loop:** Encourage users to share their ATS-checked resumes and "Application Pipeline" stats on social media, driving organic, product-led growth traffic back to the platform.

## 21. MVP Data Strategy
**Day 1 Goal:** Launch with 500 high-quality, manually curated opportunities.
- **How opportunities enter the system:**
  - **Manual Admin Entry (Core):** Admins manually input high-quality opportunities (e.g., FAANG internships, major hackathons).
  - **Community Submission Flow:** Any logged-in Student can submit an opportunity URL via a simple form. The student must provide the Category and Deadline. The submission enters a "Pending Review" queue.
- **Review Process:** Moderators review the queue, verify the source URL (checking for scams/agencies), and click "Approve" to publish.
- **Future Automation:** No web scrapers or ingestion bots in MVP. All data entry is human-verified to guarantee Day 1 quality.

## 22. Role Definitions and Permissions
The platform operates on a strict Role-Based Access Control (RBAC) model. Role is stored on the User record and enforced server-side on every API request.

| Permission | Student | Moderator | Admin |
|---|---|---|---|
| Browse, search, filter opportunities | ✅ | ✅ | ✅ |
| Bookmark an opportunity | ✅ | ✅ | ✅ |
| Update own application tracker | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ✅ | ✅ |
| Submit opportunity via community form (max 5/day) | ✅ | ✅ | ✅ |
| View moderation queue | ❌ | ✅ | ✅ |
| Approve / reject submissions | ❌ | ✅ | ✅ |
| Flag / report a broken link | ✅ | ✅ | ✅ |
| Create / edit / delete opportunities directly | ❌ | ❌ | ✅ |
| Manage company profiles | ❌ | ❌ | ✅ |
| View user list | ❌ | ❌ | ✅ |
| Suspend / restore user accounts | ❌ | ❌ | ✅ |
| Delete user accounts (hard or soft) | ❌ | ❌ | ✅ |
| Assign / revoke Moderator role | ❌ | ❌ | ✅ |
| View system analytics | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ✅ |

## 23. Product Logic: Opportunity Lifecycle
Every opportunity moves through a precise, unambiguous state machine. State transitions are enforced server-side; the UI reflects the current state.

| State | Who Triggers It | Publicly Visible? | Notes |
|---|---|---|---|
| **Draft** | Admin creates a record with incomplete data | ❌ | Only visible in Admin panel |
| **Pending Review** | Student submits via community form | ❌ | Visible in Moderator queue only |
| **Published** | Moderator approves OR Admin publishes directly | ✅ | Appears in Hub, Fresh Feed, Search |
| **Closing Soon** | Automated cron — fires when `deadline - now ≤ 48 hours` | ✅ | Badge overlay added to card; triggers DeadlineAlert notification for users who have it saved |
| **Expired** | Automated cron — fires when `now > deadline` | ❌ | Hidden from Hub and Search; remains visible in any student's Application Tracker where it was previously saved |
| **Rejected** | Moderator rejects a community submission | ❌ | Permanent terminal state; submitting student receives a "Submission Not Approved" in-app notification; record kept in DB for audit purposes |

**Transition Rules:**
- Draft → Published (Admin only, bypasses review queue)
- Draft → Pending Review (not applicable; Draft is Admin-only)
- Pending Review → Published (Moderator or Admin approval)
- Pending Review → Rejected (Moderator or Admin rejection)
- Published → Closing Soon (automated, no manual trigger)
- Published → Expired (automated, no manual trigger)
- Any state → Archived (Admin manual action, for spam/duplicate cleanup)

## 24. Product Logic: Source Verification System
To build absolute trust with students, each opportunity indicates its origin:
- **Verified Source (Blue Checkmark):** The URL domain exactly matches the company's official domain or a known enterprise ATS (e.g., Workday, Greenhouse, Lever).
- **Community Sourced:** Submitted by a user and verified by a Moderator, but hosted on a third-party site. 
- **Moderation Rule:** If a link redirects to a paid service, a generic staffing agency, or a scam, it is instantly rejected.

## 25. Product Logic: Duplicate Detection Strategy
- **Why it matters:** Duplicates destroy trust and bloat the database.
- **MVP Implementation:** When a URL is submitted, the backend strips common tracking parameters (e.g., `?utm_source=...`). The database enforces a `UNIQUE` constraint on the normalized URL. 
- **User Experience:** If a user submits an existing URL, the UI immediately rejects it with: "This opportunity is already on the radar." No complex fuzzy text matching is built for MVP.

## 26. Notification Scope
**Delivery:** In-app only (bell icon in the navigation bar). A numeric badge shows unread count. Email and SMS are strictly out of scope for MVP.

**Notification Types:**

| Type | Trigger Condition | Message | Frequency |
|---|---|---|---|
| `DeadlineAlert` | An opportunity the user has Saved reaches `Closing Soon` state (≤ 48 hours to deadline) | "⏰ [Title] closes in less than 48 hours. Don't miss it." | Once per opportunity per user |
| `SubmissionApproved` | A Moderator approves the user's community submission | "✅ Your submission '[Title]' is now live on Opportunity Radar." | Once per submission |
| `SubmissionRejected` | A Moderator rejects the user's community submission | "Your submission '[Title]' was not approved. Review our guidelines before resubmitting." | Once per submission |
| `StaleTrackerReminder` | An opportunity has been in `Saved` state for 7 consecutive days with no status update | "👋 You saved '[Title]' 7 days ago. Have you applied yet?" | Once per opportunity per user |

**UX Rules:**
- Each notification can be individually marked as read (click) or dismissed.
- A "Mark all as read" action is available in the notification panel.
- Notifications are stored in the database and persist across sessions until dismissed.
- No notification is sent more than once per triggering event per user (deduplication is enforced server-side).
- `DeadlineAlert` is NOT sent for opportunities the user has already moved past `Saved` (i.e., already marked Applied or further).

## 27. Privacy and Data Handling
- **User Profile Data:** Stored encrypted at rest. Never sold or shared with third parties. Profiles are entirely private — no other student, moderator, or public visitor can view another user's profile.
- **Application Tracker:** A student's full tracker board (statuses, notes, timestamps) is strictly private. Admins can only view anonymized aggregate metrics (e.g., "342 total saves on Google SWE Internship"). Individual board contents are inaccessible to any staff role.
- **Resume Link Storage (MVP):** Users paste an external URL (e.g., Google Drive, Dropbox, ATS link). The platform stores only the URL string. No resume files are uploaded or stored on platform servers in MVP.
- **Account Deletion:**
  - When a student requests account deletion, a **soft delete** is performed: `deleted_at` timestamp is set; the account is immediately inaccessible to the user and hidden from admin user lists.
  - All personal profile data (name, email, university, skills) is purged after a **30-day grace period**, allowing for accidental deletion recovery within that window.
  - Application Tracker entries are anonymized (user_id set to null) rather than deleted, so aggregate analytics remain accurate.
  - Bookmarks and notifications are permanently deleted at the time of the soft delete request.
- **Data Retention:** Platform retains anonymized opportunity engagement data (view counts, save counts) indefinitely for operational analytics. Personal user data is purged after the 30-day post-deletion grace period per the account deletion policy above.

## 28. Operational Success Metrics
To ensure the platform runs smoothly post-launch, the operations team is measured against:
- **Average Submission Approval Time:** < 24 hours from user submission to Moderator action.
- **Broken-Link Rate:** < 2% of active published opportunities.
- **Verified Source Ratio:** > 80% of active opportunities must come from direct company/official university domains.
- **Expired Cleanup Rate:** 100% of expired opportunities auto-archived within 24 hours of the deadline passing.
- **Feed Freshness:** At least 20 new opportunities published every 24 hours.
- **Moderation Escalation:** Any submission remaining in Pending Review for > 48 hours is automatically escalated and flagged for Admin attention.

## 29. Core Entity Definitions
The following minimum field sets are required for the database schema and must be treated as the canonical data contract between backend and frontend.

### Opportunity
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | String | Required |
| `category` | ENUM | Internship, Job, Hackathon, Workshop, Scholarship, Competition |
| `company_id` | UUID | FK to Company |
| `description` | Text | Sanitized before storage |
| `apply_url` | String | Normalized, UNIQUE constraint |
| `location` | String | City/Country or "Remote" |
| `mode` | ENUM | Remote, Hybrid, Onsite |
| `is_paid` | Boolean | |
| `posted_at` | Timestamp (UTC) | |
| `deadline` | Timestamp (UTC) | Nullable; defaults to posted_at + 30 days |
| `status` | ENUM | Draft, Pending Review, Published, Closing Soon, Expired |
| `source_type` | ENUM | Verified, Community Sourced |
| `skill_tags` | Array\<String\> | Many-to-many via join table |
| `experience_level` | ENUM | Fresher, Undergrad, Masters, Any |
| `submitted_by` | UUID | FK to User; nullable (null = Admin entry) |
| `report_count` | Integer | Auto-hides at 3; default 0 |

### Company
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | Required |
| `website_url` | String | |
| `careers_url` | String | |
| `industry` | String | |
| `logo_url` | String | CDN-hosted image path |
| `description` | Text | |

### Student Profile (User)
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | UNIQUE, required |
| `name` | String | Required |
| `university` | String | |
| `degree` | String | |
| `graduation_year` | Integer | |
| `skills` | Array\<String\> | Tag-based |
| `interests` | Array\<ENUM\> | Category interests |
| `resume_url` | String | Pasted link or signed S3 URL |
| `role` | ENUM | Student, Moderator, Admin |
| `created_at` | Timestamp | |
| `deleted_at` | Timestamp | Nullable; soft delete for account deletion |

### Application Tracker Entry
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to User |
| `opportunity_id` | UUID | FK to Opportunity |
| `status` | ENUM | Saved, Applied, Interview Scheduled, Selected, Rejected |
| `notes` | Text | Optional user notes |
| `saved_at` | Timestamp | |
| `applied_at` | Timestamp | Nullable |
| `updated_at` | Timestamp | |

### Notification
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to User |
| `type` | ENUM | DeadlineAlert, SubmissionApproved, SubmissionRejected, StaleTracker |
| `message` | String | Pre-rendered message text |
| `is_read` | Boolean | Default false |
| `created_at` | Timestamp (UTC) | |
| `related_opportunity_id` | UUID | Nullable; FK to Opportunity |

---

## 30. Timezone and Timestamp Rules
**Why it matters:** The platform serves students across multiple time zones. Inconsistent timestamp handling causes deadlines to display incorrectly, Fresh Feed ordering to be wrong, and countdown timers to drift. This is a critical, often-overlooked backend requirement.

**Rules:**
- All timestamps stored in the database are in **UTC** without exception. This applies to `posted_at`, `deadline`, `created_at`, `updated_at`, `deleted_at`, `saved_at`, `applied_at`.
- **Deadline display:** The frontend converts UTC deadlines to the user's local timezone using the browser's `Intl.DateTimeFormat` API. The user sees: *"Closes June 12, 2026 at 11:59 PM IST"* — not a raw UTC timestamp.
- **Fresh Feed ordering:** Sorted by `posted_at DESC` in UTC on the server. Time-box filters (last 1h, 6h, 24h) are calculated as `posted_at >= NOW() - INTERVAL` in UTC on the server, never on the client.
- **Countdown timers:** Calculated server-side and passed to the client as seconds-remaining. The client renders `HH:MM:SS` or `N days left` from this value. Never calculated purely on the client from a raw deadline string.
- **"Closing Soon" cron job:** Runs every 15 minutes in UTC. Compares `deadline` against `NOW()` in UTC.
- **"Expired" cron job:** Runs daily at 00:00 UTC.
- **Missing deadline fallback:** If `deadline` is NULL, the system sets an internal expiry of `posted_at + 30 days` for cron job purposes. The UI displays "Rolling deadline — apply early."

**Affects:** Backend (cron jobs, API response formatting), Frontend (timestamp rendering), Database (all timestamp columns).
**Phase:** MVP — non-negotiable.

---

## 31. Audit Log
**Why it matters:** For a platform where Admins and Moderators can publish, reject, or delete content affecting students' opportunity discovery, an immutable audit trail is essential for accountability, debugging, and trust. It also demonstrates production-grade operational maturity.

**Implementation:** A dedicated `AuditLog` table in the database. Append-only; no records are ever updated or deleted.

### AuditLog Entity
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `actor_id` | UUID | FK to User (Admin or Moderator who performed the action) |
| `actor_role` | ENUM | Admin, Moderator |
| `action` | ENUM | See action types below |
| `target_type` | ENUM | Opportunity, User, Company, Submission |
| `target_id` | UUID | ID of the affected record |
| `metadata` | JSON | Optional context (e.g., rejection reason, old vs new status) |
| `performed_at` | Timestamp (UTC) | |

**Logged Action Types:**
| Action | Description |
|---|---|
| `OPPORTUNITY_CREATED` | Admin creates a new opportunity (Draft or Published) |
| `OPPORTUNITY_EDITED` | Admin edits any field of a Published or Draft opportunity |
| `OPPORTUNITY_DELETED` | Admin hard-deletes or archives an opportunity |
| `OPPORTUNITY_EXPIRED` | System cron marks opportunity as Expired |
| `SUBMISSION_APPROVED` | Moderator or Admin approves a community submission |
| `SUBMISSION_REJECTED` | Moderator or Admin rejects a community submission |
| `USER_ROLE_CHANGED` | Admin promotes a Student to Moderator or demotes a Moderator |
| `USER_SUSPENDED` | Admin suspends a user account |
| `USER_RESTORED` | Admin restores a suspended account |
| `ACCOUNT_DELETED` | Admin or user initiates soft delete |
| `MODERATION_ESCALATED` | System auto-escalates a submission pending > 48 hours |
| `REPORT_RECEIVED` | A student submits a broken link report |

**Access:** Audit log is readable by Admin only. Moderators cannot view it. No pagination is required for MVP — a simple date-filtered table view is sufficient.
**Affects:** Database (new AuditLog table), Backend (log write on every admin/moderator action), Admin UI (read-only log viewer).
**Phase:** MVP — required before public launch for accountability.

---

## 32. Failure Handling Rules
**Why it matters:** Every system has edge cases. Without explicit failure rules, developers make independent decisions that produce inconsistent user experiences and operational blind spots.

| Failure Scenario | System Behavior | User-Facing Message |
|---|---|---|
| **Deadline is missing (NULL)** | System sets internal expiry = `posted_at + 30 days`. Listed as active. | UI displays: "Rolling deadline — apply early." No countdown shown. |
| **Source link is broken (reported ≥ 3 times)** | Opportunity status automatically reverts to `Pending Review`. Hidden from public feed. Admin and Moderators are notified. | Opportunity disappears from public view. Reporters see no confirmation (report is anonymous). |
| **Duplicate URL submitted** | Backend rejects at API level before hitting DB. No DB write occurs. | UI shows inline error: "This opportunity is already on Opportunity Radar." |
| **Submission pending > 48 hours** | System auto-escalates: flags the submission in the Admin dashboard with a visual indicator. Triggers a `MODERATION_ESCALATED` audit log entry. | No user-facing message. Submitter is not notified of the delay. |
| **Opportunity expires (deadline passes)** | Automated cron sets status to `Expired`. Removed from Hub, Search, Fresh Feed. | Students who had it Saved see it greyed out in their tracker with a label: "This opportunity has closed." They can still view their notes. |
| **Moderator rejects a submission** | Status set to `Rejected` (terminal). Submitting student receives a `SubmissionRejected` in-app notification. Record is retained in DB for audit purposes. | In-app: "Your submission '[Title]' was not approved. Review our submission guidelines." |
| **Cron job fails to run** | System must log the failure and alert the Admin dashboard with a banner: "Scheduled cleanup job failed. Manual review required." | No user-facing impact until the next successful cron run. |
| **User tries to submit after hitting 5/day rate limit** | API returns HTTP 429. No submission is created. | UI shows: "You've reached the daily submission limit (5 per day). Try again tomorrow." |

