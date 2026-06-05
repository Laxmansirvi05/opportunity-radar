import re

with open("/Users/laxmansirvi/Opportunity radar/docs/PRD.md", "r") as f:
    content = f.read()

# Replace Out of Scope
content = re.sub(
    r"## 17\. Out of Scope Features \(For MVP\).*?## 18\. Competitive Positioning",
    """## 17. MVP Boundaries (Crystal Clear)
To guarantee a fast time-to-market and focused user experience, the MVP boundaries are strictly enforced. 
**In Scope (Version 1):** 
- Viewing opportunities, bookmarking, manual application tracking (Saved -> Applied).
- User authentication (Student, Admin, Moderator).
- Admin moderation queue for community submissions.
- Basic search and filtering.
- Linking out to official platforms to apply.

**Out of Scope (Version 1 - Do NOT build):**
- Certification courses or learning hubs.
- AI features (AI matching, AI resume parsing, AI cover letter generation).
- Community forums, social features, or commenting systems.
- Direct in-app applications.
- Employer-facing dashboards or posting tools.
- Automated web scraping bots (ingestion is manual/community-driven for MVP).
- Email or SMS notifications.
- Paid subscriptions or payment gateways.

## 18. Competitive Positioning""",
    content,
    flags=re.DOTALL
)

# Replace 21-28 with the refined sections
refined_sections = """## 21. MVP Data Strategy
**Day 1 Goal:** Launch with 500 high-quality, manually curated opportunities.
- **How opportunities enter the system:**
  - **Manual Admin Entry (Core):** Admins manually input high-quality opportunities (e.g., FAANG internships, major hackathons).
  - **Community Submission Flow:** Any logged-in Student can submit an opportunity URL via a simple form. The student must provide the Category and Deadline. The submission enters a "Pending Review" queue.
- **Review Process:** Moderators review the queue, verify the source URL (checking for scams/agencies), and click "Approve" to publish.
- **Future Automation:** No web scrapers or ingestion bots in MVP. All data entry is human-verified to guarantee Day 1 quality.

## 22. Role Definitions
The platform operates on a strict Role-Based Access Control (RBAC) model:
- **Student (End User):** Can view, filter, bookmark opportunities, and track applications on their Kanban board. Can edit their profile and submit links via the community form. Cannot publish or moderate.
- **Moderator (Staff):** Can view the submission queue, approve/reject community submissions, and flag broken links. Cannot manage users or platform settings.
- **Admin (Superuser):** Has full access. Can manage users, manage company profiles, assign Moderator roles, hard-delete records, and view system analytics.

## 23. Product Logic: Opportunity Lifecycle
Every opportunity moves through a precise state machine:
- **Draft:** Admin-only state. Data is incomplete.
- **Pending Review:** Submitted by a Student. Awaiting Moderator approval. Not visible publicly.
- **Published:** Live, searchable, and appears in the Fresh Feed.
- **Closing Soon:** Automated flag applied when `deadline - current_timestamp <= 48 hours`.
- **Expired:** Automatically triggered when `current_timestamp > deadline`. The opportunity is hidden from public feeds and search results, but remains visible in a Student's Application Tracker if they had previously saved it.

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
- **In-App Notifications Only:** A notification bell icon in the dashboard. Email and SMS are strictly out of scope for MVP to save costs and reduce engineering time.
- **Triggers:**
  - **Approaching Deadline:** "You have 48 hours left to apply for [Saved Opportunity]."
  - **Submission Approved:** "Your submitted opportunity [Title] was published."
  - **Stale Tracking Reminder:** "You saved [Opportunity] 7 days ago. Have you applied yet?"

## 27. Privacy and Data Handling
- **User Profile Data:** Stored securely. Not sold to third parties. Profiles are entirely private (no public viewing).
- **Application Tracking:** A student's application board is strictly private. Admins can view aggregate metrics (e.g., "150 total applications to Google") but cannot view an individual student's board.
- **Resume Link Storage:** Users paste their ATS resume link. If a file upload is supported later, it must be stored in secure cloud storage (e.g., AWS S3) with signed URLs ensuring only the user can access their resume.

## 28. Operational Success Metrics
To ensure the platform runs smoothly post-launch, the operations team is measured against:
- **Average Submission Approval Time:** < 24 hours from user submission to Moderator action.
- **Broken-Link Rate:** < 2% of active published opportunities.
- **Verified Source Ratio:** > 80% of active opportunities must come from direct company/official university domains.
- **Expired Cleanup Rate:** 100% of expired opportunities auto-archived within 24 hours of the deadline passing.
- **Feed Freshness:** At least 20 new opportunities published every 24 hours.
"""

content = re.sub(r"## 21\. Opportunity Acquisition Strategy.*", refined_sections, content, flags=re.DOTALL)

with open("/Users/laxmansirvi/Opportunity radar/docs/PRD.md", "w") as f:
    f.write(content)

