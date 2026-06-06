# Production-Ready UI Screen Map
**Derived From:** App-Flow.md, PRD.md, TRD.md, UI-UX-Brief.md, and Finalized Design Folders
**Primary Source of Truth:** App-Flow.md

---

## 1. Public Pages (No Login Required)

### 1.1 Landing / Opportunity Hub
- **Screen Name:** Opportunity Hub Discovery Experience
- **Route:** `/`
- **Access Role:** Visitor (Unauthenticated), Student, Moderator, Admin
- **Design Folder Mapping:** `landing_page`, `opportunity_hub_discovery_experience`, `opportunity_radar`
- **Navigation Relationships:** 
  - Top Navigation Bar (Search, Login/Signup for Visitors; Avatar/Notifications for Students+)
  - Mobile: Primary "Discover" tab on the bottom nav.
  - Links out to `/opportunities/[id]` and `/companies/[id]`.
- **User Journey Mapping:** 
  - *First-Time Visitor:* Lands on `/` -> Browses opportunity cards -> Applies filters (URL updates) -> Clicks Bookmark -> Redirected to Sign In prompt.

### 1.2 Search Experience
- **Screen Name:** Search & Filter Interface
- **Route:** `/?q=[query]&category=[filter]`
- **Access Role:** All Users
- **Design Folder Mapping:** `search`
- **Navigation Relationships:** Rendered seamlessly within the Opportunity Hub. Updates URL parameters.
- **User Journey Mapping:** 
  - Types in Search bar -> URL updates -> Grid re-renders. Filter combinations apply AND logic.

### 1.3 Opportunity Detail
- **Screen Name:** Opportunity Detail Page
- **Route:** `/opportunities/[id]`
- **Access Role:** All Users
- **Design Folder Mapping:** `opportunity_detail`
- **Navigation Relationships:** 
  - `← Back to Opportunities` uses browser back to preserve filter/search state.
  - Links to `/companies/[id]`.
- **User Journey Mapping:** 
  - User reviews details -> Clicks "Apply Now" (opens in new tab) -> If tracked as "Saved", prompted to move status to "Applied".

### 1.4 Company Profile
- **Screen Name:** Company Intelligence
- **Route:** `/companies/[id]`
- **Access Role:** All Users
- **Design Folder Mapping:** `company-intelligence`
- **Navigation Relationships:** Links back to all active opportunities from the company.
- **User Journey Mapping:** 
  - Student researches organization -> Views active listings -> Navigates to individual opportunity.

### 1.5 Authentication
- **Screen Name:** Login & Signup
- **Route:** `/login`, `/signup`, `/terms`, `/privacy`
- **Access Role:** Visitor (Logged out)
- **Design Folder Mapping:** Included in core design system / `opportunity_radar`
- **Navigation Relationships:** Reachable from Top Navbar. Returns to `?next=` destination upon success.
- **User Journey Mapping:** 
  - User clicks Bookmark while logged out -> Directed to `/login?next=...` -> Authenticates -> Returned to previous context with Bookmark saved.

---

## 2. Protected Pages (Login Required — Student+)

### 2.1 Student Dashboard
- **Screen Name:** Student Command Center
- **Route:** `/dashboard`
- **Access Role:** Student, Moderator, Admin
- **Design Folder Mapping:** `dashboard`, `student_command_center`
- **Navigation Relationships:** 
  - Mobile: "Dashboard" tab (bottom nav).
  - Avatar dropdown option.
- **User Journey Mapping:** 
  - *Returning Student:* Logs in -> Lands on Dashboard -> Sees Upcoming Deadlines, Fresh Feed, and Recent Notifications.

### 2.2 Application Tracker
- **Screen Name:** Application Tracker
- **Route:** `/tracker`
- **Access Role:** Student, Moderator, Admin
- **Design Folder Mapping:** `application_tracker`
- **Navigation Relationships:** Mobile "Tracker" tab. Links from Dashboard status pills.
- **User Journey Mapping:** 
  - User bookmarks an opportunity -> Appears here as "Saved" -> User changes status via dropdown (Saved -> Applied -> Interview -> Selected/Rejected).

### 2.3 Notifications Center
- **Screen Name:** Notifications
- **Route:** `/notifications`
- **Access Role:** Student, Moderator, Admin
- **Design Folder Mapping:** `notifications`
- **Navigation Relationships:** Top Navbar Bell icon. Mobile "Notifications" tab.
- **User Journey Mapping:** 
  - Receives deadline alert -> Clicks notification body -> Navigates to `/opportunities/[id]`. Can mark all as read.

### 2.4 User Profile Settings
- **Screen Name:** Profile & Preferences
- **Route:** `/profile`
- **Access Role:** Student, Moderator, Admin
- **Design Folder Mapping:** `user_profile_settings`
- **Navigation Relationships:** Avatar dropdown menu. Mobile "Profile" tab.
- **User Journey Mapping:** 
  - Clicks Edit Profile -> Updates university, skills, resume link -> Saves. Profiles are strictly private (no public view).

### 2.5 Submit Opportunity
- **Screen Name:** Community Submission
- **Route:** `/submit`
- **Access Role:** Student, Moderator, Admin
- **Design Folder Mapping:** `submit_opportunity`
- **Navigation Relationships:** Reachable from Avatar dropdown.
- **User Journey Mapping:** 
  - Student finds a hackathon -> Goes to `/submit` -> Fills details -> Receives validation toast -> Opportunity is sent to Moderation Queue.

### 2.6 Report Broken Opportunity
- **Screen Name:** Report Broken Center
- **Route:** Inline modal or `/report` (tied to Opportunity Detail)
- **Access Role:** Student, Moderator, Admin
- **Design Folder Mapping:** `report_broken_center`
- **User Journey Mapping:** 
  - Student clicks "Report" on detail page -> Submits reason -> Flagged for Moderator review.

---

## 3. Admin Pages (Login Required — Moderator or Admin)

### 3.1 Moderation Center
- **Screen Name:** Submission Queue
- **Route:** `/admin/submissions`
- **Access Role:** Moderator, Admin
- **Design Folder Mapping:** `moderation-center`
- **Navigation Relationships:** Avatar dropdown -> "Moderation". Dedicated Admin Sidebar.
- **User Journey Mapping:** 
  - Moderator views pending items -> Approves an item -> Item is published and Student receives a notification.

### 3.2 Trust & Platform Operations Dashboard
- **Screen Name:** Admin Overview
- **Route:** `/admin` (plus `/admin/opportunities`, `/admin/companies`, `/admin/users`, `/admin/audit-log`, `/admin/analytics`)
- **Access Role:** Admin only
- **Design Folder Mapping:** `trust_platform_operations_dashboard`
- **Navigation Relationships:** Avatar dropdown -> "Admin Panel". Dedicated Admin Sidebar.
- **User Journey Mapping:** 
  - Admin oversees platform health, manages user roles, or edits listings directly bypassing the moderation queue.

---

## 4. Redirect & Access Rules

| Scenario | Behavior |
| --- | --- |
| Logged-out user visits protected route (`/dashboard`) | Redirect to `/login?next=[url]` |
| After successful login/signup | Redirect to `?next` param destination, or `/dashboard` if missing |
| Logged-in user visits `/login` or `/signup` | Redirect to `/dashboard` |
| Student visits `/admin/users` or `/admin/submissions` | Redirect to `/` (silent 403, no error message) |
| Moderator visits Admin-only route (`/admin/users`) | Redirect to `/` (silent 403, no error message) |
| Role-based Navigation Item Visibility | If a role cannot access a route, the navigation link is **completely hidden** (never greyed out). |

---

## 5. Global State & Context Rules

- **Sort Order:** Defined purely by the server/URL. Opportunities prioritize "Closing Soon" items first, then by "Newest" (`posted_at DESC`).
- **Filter State:** Kept strictly within URL parameters (e.g., `/?category=Internship&fresh=24h`) so that the browser Back button perfectly restores previous states.
- **Privacy Rule:** All Student profiles are completely private. No `/profile/[id]` route exists for the public or other students. Admins see masked emails.

## 6. Screen Development Priority

### Phase 1 - Core MVP
1. Authentication
2. Opportunity Hub
3. Search
4. Opportunity Detail
5. Dashboard
6. Tracker

### Phase 2 - Engagement
7. Notifications
8. Profile
9. Company Intelligence

### Phase 3 - Community
10. Submit Opportunity
11. Report Broken Opportunity

### Phase 4 - Operations
12. Moderation Center
13. Trust & Platform Operations Dashboard