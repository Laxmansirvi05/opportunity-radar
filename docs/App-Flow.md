# App Flow Document: Opportunity Radar
**Version:** 1.2  
**Status:** Final — Ready for UI/UX Design and Implementation  
**Derived From:** PRD v1.0 + TRD v1.0 + App Flow v1.1 (June 2026)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Roles](#2-user-roles)
3. [Page Map](#3-page-map)
4. [Navigation Map](#4-navigation-map)
5. [Student Flow](#5-student-flow)
6. [Moderator Flow](#6-moderator-flow)
7. [Admin Flow](#7-admin-flow)
8. [Empty States](#8-empty-states)
9. [Loading States](#9-loading-states)
10. [Error States](#10-error-states)
11. [Mobile Flow](#11-mobile-flow)
12. [State Transition Summary](#12-state-transition-summary)
13. [Notes for UI/UX Design](#13-notes-for-uiux-design)
    - 13.9 [Sort Order Rules](#139-sort-order-rules)
    - 13.10 [Profile Privacy Rules](#1310-profile-privacy-rules)

---

## 1. Executive Summary

This document describes every screen, user journey, action, transition, and state in the Opportunity Radar MVP. It is the single source of truth for designers and developers building the user interface and frontend logic.

The app has three distinct user experiences that share the same visual shell but expose different capabilities:

- **Visitors and Students** interact with the opportunity discovery and tracking layer.
- **Moderators** interact with the content review layer (submission queue).
- **Admins** interact with the full operational layer (CRUD, user management, audit logs).

The guiding UX principle is: **the most important action on every screen must be reachable in one tap on mobile.** The app is mobile-first. Every page must feel useful without requiring a tutorial.

---

## 2. User Roles

### 2.1 Visitor (Unauthenticated)
- Can browse the Opportunity Hub and use search/filter.
- Can view individual opportunity detail pages.
- Can view company profile pages.
- **Cannot** bookmark, track, submit, or receive notifications.
- Sees a persistent, non-intrusive "Sign up free" prompt on interactive actions.

### 2.2 Student (Authenticated — default role)
All visitor capabilities, plus:
- Bookmark opportunities.
- Add opportunities to the Application Tracker and update their status.
- Receive and manage in-app notifications.
- Submit community opportunities (max 5 per 24 hours).
- Edit their profile.
- Request account deletion.

### 2.3 Moderator (Authenticated — elevated role)
All Student capabilities, plus:
- View the moderation submission queue.
- Approve or reject community-submitted opportunities.
- Flag reported broken links for review.
- Moderators cannot manage users, companies, or platform settings.

### 2.4 Admin (Authenticated — superuser role)
All Moderator capabilities, plus:
- Create, edit, delete, and archive opportunities directly.
- Manage company profiles.
- View and manage all registered users.
- Change user roles, suspend, and restore accounts.
- View the full immutable audit log.
- View aggregate platform analytics.

---

## 3. Page Map

### 3.1 Public Pages (No Login Required)

| Page | Route | Description |
|---|---|---|
| Landing / Opportunity Hub | `/` | Main listing of published opportunities with search, filters, and Fresh Feed |
| Opportunity Detail | `/opportunities/[id]` | Full details of a single opportunity |
| Company Profile | `/companies/[id]` | Company info and all their active opportunities |
| Login | `/login` | Email/password, Google, and GitHub OAuth login |
| Signup | `/signup` | New account creation |
| Terms of Service | `/terms` | Legal terms page |
| Privacy Policy | `/privacy` | Privacy policy page |

### 3.2 Protected Pages (Login Required — Student+)

| Page | Route | Description |
|---|---|---|
| Student Dashboard | `/dashboard` | Personalized overview: saved items, deadlines, notifications summary |
| Application Tracker | `/tracker` | List view of all tracked opportunities by status (list-only in MVP) |
| Notifications | `/notifications` | Full notification history with read/dismiss controls |
| Profile | `/profile` | View and edit user profile, skills, interests, resume link |
| Community Submission | `/submit` | Form to submit a new opportunity to the moderation queue |

### 3.3 Admin Pages (Login Required — Moderator or Admin)

| Page | Route | Access |
|---|---|---|
| Admin Overview | `/admin` | Admin only |
| Submission Queue | `/admin/submissions` | Moderator + Admin |
| Opportunity Management | `/admin/opportunities` | Admin only |
| Opportunity Edit/Create | `/admin/opportunities/[id]` | Admin only |
| Company Management | `/admin/companies` | Admin only |
| User Management | `/admin/users` | Admin only |
| Audit Log | `/admin/audit-log` | Admin only |
| Analytics | `/admin/analytics` | Admin only |

---

## 4. Navigation Map

### 4.1 Top Navigation Bar (All Pages)

The top navbar is always visible and fixed to the top of the screen.

**Left side:**
- Logo / Brand name → links to `/`

**Center (Desktop only):**
- Search bar → triggers search on the Opportunity Hub (if on `/`, filters in place; if on another page, navigates to `/` with the search query)

**Right side — Logged Out:**
- "Log in" button → `/login`
- "Sign up" button (primary CTA) → `/signup`

**Right side — Logged In (Student):**
- Notification Bell icon with unread badge count → `/notifications`
- User avatar / initials → dropdown menu: Dashboard, Tracker, Profile, Submit, Log out

**Right side — Logged In (Moderator):**
- All Student items, plus:
- "Moderation" link in avatar dropdown → `/admin/submissions`

**Right side — Logged In (Admin):**
- All Student items, plus:
- "Admin Panel" link in avatar dropdown → `/admin`

> **Role-Based Nav Visibility Rule:** Navigation items that a role cannot access must be **hidden entirely** — not shown and then blocked. A Student must never see a "Moderation" link. A Moderator must never see an "Admin Panel" link. Role is checked server-side in Middleware; the nav renders conditionally based on the session role claim. There are no disabled/greyed-out nav items — if you cannot access it, you do not see it.

### 4.2 Student Sidebar / Bottom Nav (Mobile)

On mobile, the primary navigation becomes a bottom tab bar with 5 items:

| Tab | Icon | Destination |
|---|---|---|
| Discover | 🔍 | `/` (Opportunity Hub) |
| Dashboard | 🏠 | `/dashboard` |
| Tracker | 📋 | `/tracker` |
| Notifications | 🔔 | `/notifications` (with badge) |
| Profile | 👤 | `/profile` |

On desktop, this becomes a persistent left sidebar on protected pages only. Public pages (`/`, `/opportunities/[id]`, `/companies/[id]`) use only the top navbar.

### 4.3 Admin Sidebar

Admin pages have their own dedicated left sidebar, separate from the student sidebar. Each item is rendered only if the logged-in user has the required role — Moderator-only items are hidden for Students, Admin-only items are hidden for Moderators:

- Overview → `/admin` *(Admin only)*
- Submission Queue → `/admin/submissions` *(Moderator + Admin)* with pending count badge
- Opportunities → `/admin/opportunities` *(Admin only)*
- Companies → `/admin/companies` *(Admin only)*
- Users → `/admin/users` *(Admin only)*
- Audit Log → `/admin/audit-log` *(Admin only)*
- Analytics → `/admin/analytics` *(Admin only)*
- ← Back to App → `/`

### 4.4 Route Access and Redirect Behavior

| Scenario | Behavior |
|---|---|
| Logged-out user visits `/dashboard` | Redirect to `/login?next=/dashboard` |
| After login, user is sent to | The `next` param destination, or `/dashboard` if no `next` param |
| Student visits `/admin/users` | Redirect to `/` with no error message shown (silent 403 redirect) |
| Moderator visits `/admin/users` | Redirect to `/` (same — insufficient role) |
| Logged-in user visits `/login` or `/signup` | Redirect to `/dashboard` |
| Admin visits any admin page | Renders normally |

### 4.5 Back Button Behavior

- Browser native back button always works (standard Next.js routing behavior).
- Opportunity detail pages show an explicit `← Back to Opportunities` link in the top-left corner of the content area.
- Admin edit pages show `← Back to Opportunities` or `← Back to Companies`.
- No custom back button overrides that break browser history.

---

## 5. Student Flow

### 5.1 First-Time Visitor Journey

```
Landing on / (Opportunity Hub)
       │
       ▼
Sees the Opportunity Hub immediately — real listings, no hero gate
Sees opportunity cards with category badge, deadline, mode tag
       │
       ├── Scrolls and browses → opens Opportunity Detail page
       │
       ├── Uses search bar → sees filtered results in place
       │
       ├── Clicks Filter → filter panel slides in/opens → applies filters
       │
       └── Clicks Bookmark or "Save"
                │
                ▼
           Not logged in →
           Toast appears: "Sign in to save opportunities"
           [Sign in] button in toast → /login?next=[current-full-URL-with-params]
           (preserves search query and active filters in the redirect destination)
```

**Assumption:** The Opportunity Hub is fully functional without login. A visitor can browse, search, and filter without any gate. The gate appears only on interactive write actions. There is no separate marketing landing page — the homepage IS the product.

---

### 5.2 Signup Flow

```
/signup  (also receives ?next=[url] param if user was redirected here)
   │
   ├── Enter name, email, password → Click "Create Account"
   │       │
   │       └── Supabase Auth creates user → profile row auto-created
   │               │
   │               └── Redirect to ?next param value, or /dashboard if no ?next
   │                       │
   │                       └── [First-time dashboard] → Shows onboarding empty state
   │                           "Welcome! Start by exploring opportunities."
   │                           CTA button: "Browse Opportunities" → /
   │
   ├── "Continue with Google" → Supabase OAuth flow
   │       │
   │       └── On OAuth callback → redirect to ?next param value, or /dashboard if no ?next
   │           (The ?next param must be passed through the OAuth state parameter)
   │
   └── "Continue with GitHub" → Supabase OAuth flow
           │
           └── On OAuth callback → redirect to ?next param value, or /dashboard if no ?next
               (The ?next param must be passed through the OAuth state parameter)
```

**Assumption:** Email verification is not required in MVP to reduce friction. Users are immediately active after signup.

---

### 5.3 Login Flow

```
/login  (also receives ?next=[url] param if redirected from a protected route)
   │
   ├── Enter email + password → Click "Log in"
   │       │
   │       ├── Success → redirect to ?next param value, or /dashboard if no ?next
   │       │
   │       └── Failure → inline error below password field: "Invalid email or password"
   │               └── Do NOT clear the email field on failure
   │
   ├── "Continue with Google" → Supabase OAuth flow
   │       └── On OAuth callback → redirect to ?next param value, or /dashboard if no ?next
   │           (The ?next param must be passed through the OAuth state parameter)
   │
   ├── "Continue with GitHub" → Supabase OAuth flow
   │       └── On OAuth callback → redirect to ?next param value, or /dashboard if no ?next
   │           (The ?next param must be passed through the OAuth state parameter)
   │
   └── "Forgot password?" link → Supabase sends password reset email
           │
           └── User clicks email link → redirected to /login?mode=reset
               → Reset password form appears in place of login form
               → On success → redirect to /dashboard
```

---

### 5.4 Browsing the Opportunity Hub

```
/ (Opportunity Hub — Server Component, ISR)
│
├── Page Sections (top to bottom):
│   ├── [Search Bar] — always visible at top
│   ├── [Filter Bar] — category chips + Mode + Paid/Free + Experience level
│   ├── [Fresh Feed Toggle] — "Last 1h | 6h | 24h | Last 7 days" tab group
│   └── [Opportunity Grid] — cards in responsive grid
│
├── Each Opportunity Card shows:
│   ├── Company logo (small, left)
│   ├── Opportunity title (bold)
│   ├── Company name
│   ├── Category badge (color-coded: Internship=blue, Hackathon=purple, etc.)
│   ├── Mode badge (Remote / Hybrid / Onsite)
│   ├── Deadline label ("2 days left" / "Closing today" / "Rolling deadline")
│   ├── Paid/Free tag
│   └── Bookmark icon (top-right of card)
│
├── Clicking anywhere on the card body → /opportunities/[id]
├── Clicking Bookmark icon (logged in) → immediate optimistic UI toggle
│       (bookmark added/removed without page reload)
├── Clicking Bookmark icon (logged out) → toast: "Sign in to save"
│
└── Scroll to bottom → loads next page (cursor-based or offset pagination, 20 per page)
```

---

### 5.5 Search and Filter Flow

```
User types in Search Bar
       │
       ▼
[300ms debounce — no request fires until typing pauses]
       │
       ▼
URL updates: /?q=software+engineer
(URL is the single source of truth for all filter and search state)
Results re-render in the opportunity grid (Client Component, reads from URL params)
       │
       ├── Results found → grid updates with matching opportunities
       └── No results → EmptyState: "No results for 'software engineer'"
               └── CTA: [Clear search] button — removes only q param, keeps active filters

User applies a filter (e.g., Category = Hackathon)
       │
       ▼
URL updates: /?q=...&category=Hackathon
Results re-filter in place — search query is preserved alongside filters
       │
       └── Multiple filters combine with AND logic

User applies Fresh Feed time-box (e.g., Last 24h)
       │
       ▼
URL updates: /?fresh=24h  (can combine with other filters: /?fresh=24h&category=Internship)

User clicks "Clear All Filters"
       │
       ▼
URL removes ALL filter params but PRESERVES the q (search) param
Result: /?q=software+engineer (search remains, all filters cleared)

User clicks "Clear Search" (✕ on search input)
       │
       ▼
URL removes only the q param, preserves active filters
Result: /?category=Hackathon (filters remain, search cleared)

User clicks "Reset All" (clears everything)
       │
       ▼
URL resets to /
Full opportunity grid reloads with default view
```

**Filter state preservation (critical for back button and deep links):**
- All search and filter state lives in the URL query string only. No component-local state for filters.
- When a user opens an opportunity detail page and then presses the browser back button, they return to the exact URL they left — including all active filters and the search query. The grid re-renders from the URL params.
- The `← Back to Opportunities` link on the detail page uses `router.back()` (not a hard `/` link) to ensure filter state is restored.
- Sharing a filtered URL (e.g., `/?category=Hackathon&fresh=24h`) produces the exact same view for any visitor.

**Filter Panel behavior:**
- On desktop: filter bar is always visible horizontally below search
- On mobile: filters are behind a "Filters" button that opens a bottom sheet drawer
- Active filter count is shown as a badge on the Filters button: "Filters (2)"
- Each active filter chip shows a ✕ to remove that filter individually

---

### 5.5.1 Default Sort Order

Sort order is one of the most consequential decisions for the Opportunity Hub. The wrong default buries urgent opportunities and de-prioritises fresh content. The following rules apply to all views.

**Rule: The URL is the source of truth for sort order, exactly like filters.**  
Default sort is applied server-side when no `sort` param is present in the URL.

#### Default Sort — Opportunity Hub (no search query)

Priority order (applied as a composite `ORDER BY`):

```
1. CLOSING SOON first   — status = 'Closing Soon' floated to top (deadline ≤ 48h)
2. THEN by posted_at DESC — newest published opportunities next
   (ties broken by UUID, which is deterministic)
```

**Why this order:**  
Students visiting the hub have two competing needs: urgency (act before it closes) and freshness (see what's new). Floating Closing Soon items is the highest-value signal — a student who misses a closing-soon deadline cannot recover. After that, newest first ensures the page always feels current. Pure "relevance" ranking requires ML and is out of scope for MVP.

**Concrete SQL equivalent:**
```sql
ORDER BY
  CASE WHEN status = 'Closing Soon' THEN 0 ELSE 1 END ASC,
  posted_at DESC
```

#### Default Sort — Search Results (q param present)

```
1. CLOSING SOON first   — same urgency float as default
2. THEN by posted_at DESC — newest first within non-closing results
```

**Why not relevance-first when searching?**  
PostgreSQL `plainto_tsquery` full-text search returns all rows that match the query — it does not produce a scored ranking useful enough to sort by. `ts_rank` exists but varies significantly by description length and produces non-intuitive results for short-description opportunities. For MVP, recency + urgency is simpler, more predictable, and equally useful.

**Future:** Add `sort=relevance` as a URL param once a proper search layer (e.g. Typesense) provides reliable ranking scores.

#### Sort When Filters Are Applied (no search query)

Filters do not change the sort order. The same composite sort applies:
```
Closing Soon first → newest first
```
Filtered results sorted the same way feel natural — a student filtering for "Hackathons" still wants to see what's closing soon at the top.

#### Sort for Fresh Feed (fresh param present)

When a time-box is active (`?fresh=24h`), sort order is:
```
posted_at DESC only — no Closing Soon float
```
**Why:** The Fresh Feed is explicitly about recency. Floating closing-soon items inside a "last 6 hours" feed would re-surface older items and break the chronological contract of the feed.

#### Tracker Sort Order (`/tracker`)

```
Default: deadline ASC (soonest deadline at top)
Null-deadline items (rolling deadline): sorted to bottom
Within same deadline date: alphabetical by title
```
This matches the Upcoming Deadlines section on the Dashboard and creates one consistent mental model.

#### Tie-Breaking Rule

Whenever two rows have identical sort values (e.g., two opportunities posted at the exact same second), they are broken by `id ASC` (UUID alphabetical). This is deterministic across page refreshes and pagination — no random reordering.

#### Sort URL Parameter (future-proofing)

In MVP, sort order is not user-configurable. There is no sort dropdown. The URL param `sort` is reserved but not implemented.  
When added in v2, valid values will be: `sort=closing` | `sort=newest` | `sort=relevance`.

---

### 5.6 Opportunity Detail Page

```
/opportunities/[id]
│
├── ← Back to Opportunities (top-left link)
│
├── Content sections:
│   ├── Company logo + name (links to /companies/[id])
│   ├── Opportunity title (H1)
│   ├── Badges row: Category | Mode | Paid/Free | Experience Level
│   ├── Source badge: "✓ Verified Source" OR "Community Sourced"
│   ├── Location
│   ├── Posted date (e.g., "Posted 2 days ago")
│   ├── Deadline block:
│   │   ├── If deadline exists: "Closes June 12, 2026 · 4 days left" (local timezone)
│   │   └── If no deadline: "Rolling deadline — apply early"
│   ├── Full description (sanitized text/markdown)
│   ├── Skill tags list
│   │
│   └── Action Bar (sticky on mobile, fixed at bottom):
│       ├── [Bookmark] toggle button — left
│       └── [Apply Now] primary CTA button — right
│           → Opens official apply_url in a new tab
│           → NEVER navigates away from the platform
│
└── Related section (below fold):
    └── "More from [Company Name]" → 3 other active opportunities from same company
```

**"Apply Now" behavior:**
- Opens `apply_url` in a new browser tab using `target="_blank"` and `rel="noopener noreferrer"`.
- The platform **never performs any part of the application** on the user's behalf. The button is purely a redirect.
- The user always stays on the Opportunity Radar detail page in their original tab. Clicking Apply Now never navigates away from the platform.
- If the user is logged in and has this opportunity in their tracker at `Saved` status, a non-blocking inline prompt appears **below the Apply Now button** after it is clicked: *"Have you applied? Update your tracker."* with two options:
  - [Yes, I applied] → moves tracker status to `Applied` (sets `applied_at` timestamp) → prompt dismisses
  - [Not yet] → dismisses the prompt with no change
- If the tracker status is already `Applied` or further, this prompt does not appear.

---

### 5.7 Company Profile Page

```
/companies/[id]
│
├── Company header:
│   ├── Logo
│   ├── Company name (H1)
│   ├── Industry tag
│   ├── Website link (external) + Careers page link (external)
│   └── Description
│
└── Active Opportunities from this Company
    └── List of opportunity cards (same card component as Opportunity Hub)
        ├── If 0 active → EmptyState: "No active opportunities from [Company] right now"
        └── Each card links to /opportunities/[id]
```

---

### 5.8 Student Dashboard

```
/dashboard  (Protected — login required)
│
├── First-time user (no bookmarks, no tracker items):
│   └── Onboarding empty state:
│       "Welcome to Opportunity Radar 👋"
│       "Start by exploring opportunities and saving ones you like."
│       [Browse Opportunities] button → /
│
└── Returning user:
    ├── Section 1: "Your Upcoming Deadlines"
    │   └── List of tracker items (status = Saved or Applied) with deadlines
    │       within the next 7 days, sorted by deadline ascending
    │       └── Each row: title, company, deadline countdown, current status
    │           → click → /opportunities/[id]
    │
    ├── Section 2: "Fresh Today" (last 24h)
    │   └── 3–5 most recently published opportunities (mini cards)
    │       [See all fresh] → / with 24h fresh filter active
    │
    ├── Section 3: "Your Tracker Summary"
    │   └── Status count pills: Saved (N) | Applied (N) | Interview (N) | Selected (N) | Rejected (N)
    │       → Click any pill → /tracker?status=Applied (filters tracker by status)
    │
    └── Section 4: "Recent Notifications" (last 3 unread)
        └── Mini notification list
            [See all] → /notifications
```

---

### 5.9 Application Tracker Flow

```
/tracker  (Protected)
│
├── Header: "My Application Tracker"
│   └── Sort/filter options: All | Saved | Applied | Interview | Selected | Rejected
│
├── Tracker View (List layout — default):
│   └── Each tracker item card shows:
│       ├── Opportunity title + company name
│       ├── Category + Mode badges
│       ├── Current status (color-coded pill)
│       ├── Deadline (greyed out if expired: "This opportunity has closed")
│       ├── Notes preview (truncated to 1 line)
│       └── Action menu (⋮): Change Status | Edit Notes | Remove from Tracker
│
├── Changing Status:
│   User clicks ⋮ → "Change Status" → opens a small status selector modal
│   Selects new status → optimistic UI update → API call
│   If moving to "Applied" for the first time → sets applied_at timestamp
│
├── Editing Notes:
│   User clicks ⋮ → "Edit Notes" → opens inline text area
│   User types → clicks "Save" → API PATCH call → note updates
│
├── Removing from Tracker:
│   User clicks ⋮ → "Remove from Tracker" → confirmation dialog
│   "Are you sure? This will delete your tracker entry."
│   [Cancel] | [Remove]
│   On confirm → tracker entry deleted → card disappears from list
│
└── Adding to Tracker from Opportunity Detail:
    (There is no separate "Add to Tracker" button — Bookmarking IS the initial "Saved" state)
    │
    └── When student bookmarks an opportunity:
        → Creates a tracker entry with status = "Saved"
        → Bookmark icon turns filled/active
        → Toast: "Saved to your tracker"
```

**Assumption:** Bookmarking and adding to tracker are the same action. There is no separate "bookmark" vs "tracker" distinction for the student. When they save an opportunity, it appears in their tracker as "Saved." This simplifies the UX significantly.

---

### 5.10 Notification Flow

```
/notifications  (Protected)
│
├── Notification Bell (in navbar):
│   └── Shows unread count badge (number, max "9+")
│   → Click → /notifications (full page) OR dropdown panel (desktop)
│
├── Notification Types displayed:
│   ├── ⏰ DeadlineAlert: "[Title] closes in less than 48 hours."
│   ├── ✅ SubmissionApproved: "Your submission '[Title]' is now live."
│   ├── ❌ SubmissionRejected: "Your submission '[Title]' was not approved."
│   └── 👋 StaleTracker: "You saved '[Title]' 7 days ago. Applied yet?"
│
├── Each notification row:
│   ├── Icon (based on type)
│   ├── Message text
│   ├── Relative timestamp ("2 hours ago")
│   ├── Unread indicator (blue dot on left)
│   └── Actions: [Mark as read] [Dismiss ✕]
│       → Clicking the notification body (if related to an opportunity) → /opportunities/[id]
│
├── "Mark all as read" button → top-right of notification list
│   → All notifications get is_read = true → blue dots disappear
│
└── Empty state: "You're all caught up! 🎉"
    "No notifications right now. Keep applying!"
```

---

### 5.11 Profile Edit Flow

```
/profile  (Protected)
│
├── Display mode (default):
│   ├── Avatar / initials
│   ├── Name, University, Degree, Graduation Year
│   ├── Skills (tag list)
│   ├── Interests (category chips: Internship, Hackathon, etc.)
│   ├── Resume link (if set: "View Resume ↗")
│   └── [Edit Profile] button
│
├── Edit mode (on click [Edit Profile]):
│   ├── Inline form replaces display
│   ├── Fields: Name, University, Degree, Graduation Year, Skills (tag input),
│   │   Interests (multi-select chips), Resume URL (text input)
│   ├── [Save Changes] button → PATCH /api/profile → success toast → back to display mode
│   └── [Cancel] → discards changes → back to display mode
│
└── Danger Zone (below fold):
    └── [Delete My Account] button (red, outlined)
        → Confirmation dialog:
            "Are you sure you want to delete your account?
            Your data will be permanently deleted after 30 days.
            This action cannot be undone."
            [Cancel] | [Delete Account]
        → On confirm → soft delete → session terminated → redirect to /
            → Banner on / : "Your account has been scheduled for deletion."
```

---

### 5.11.1 Student Profile Privacy Rules

**Rule: Student profiles are private by default. There are no public student profiles in MVP.**

This rule applies to every part of the platform:

| Data Field | Visibility |
|---|---|
| Name | Account owner only (via `/profile`) |
| University / Degree / Graduation Year | Account owner only |
| Skills | Account owner only |
| Interests | Account owner only |
| Resume URL | Account owner only — never exposed in any API response to other users |
| Email address | Account owner only — never shown anywhere in the UI, including admin panels (admin sees name + masked email: `l***@gmail.com`) |
| Profile photo / initials avatar | Account owner only |
| Tracker entries | Account owner only — fully private |
| Bookmark list | Account owner only — fully private |
| Submission history | Moderators/Admins see submitter name only (not email), for moderation context |

**Route-level enforcement:**
- `/profile` is a protected route. Only the currently authenticated user can access it.
- There is no `/profile/[id]` or `/users/[id]` public route in MVP. No student can navigate to another student's profile.
- The Supabase RLS policy on the `profiles` table enforces `auth.uid() = id` for all SELECT/UPDATE operations from student-role sessions.
- Admin sessions use the service role for user management — they see names and masked emails in `/admin/users` only.

**Why private by default:**  
Opportunity Radar is a tool, not a social network. Students are sharing personal information (resume links, graduation year, skills) that must be protected. There is no feature in MVP that requires one student to see another student's profile. Keeping profiles private eliminates a whole category of privacy risk with zero UX cost.

---

### 5.12 Community Submission Flow

```
/submit  (Protected — Student+)
│
├── Page header: "Submit an Opportunity"
│   Subtitle: "Know about an internship, hackathon, or scholarship?
│   Share it with the Opportunity Radar community."
│
├── Submission Form fields:
│   ├── Opportunity Title* (text input)
│   ├── Category* (dropdown: Internship / Job / Hackathon / Workshop / Scholarship / Competition)
│   ├── Company or Organization Name* (text input)
│   ├── Official Application Link* (URL input)
│   ├── Application Mode* (Remote / Hybrid / Onsite)
│   ├── Paid? (Yes / No toggle)
│   ├── Experience Level (Fresher / Undergrad / Masters / Any)
│   ├── Application Deadline (date picker — optional, shows "Rolling deadline" if left blank)
│   └── Additional Notes (optional textarea, max 500 chars)
│
├── Submit button behavior:
│   ├── Client-side Zod validation first → inline field errors if invalid
│   ├── On submit → POST /api/submissions
│   │
│   ├── SUCCESS:
│   │   → Toast: "Submitted! Our team will review it within 24 hours."
│   │   → Form resets
│   │   → Remaining daily submissions counter updates: "4 submissions remaining today"
│   │
│   ├── DUPLICATE URL:
│   │   → Inline error on the URL field:
│   │     "This opportunity is already on Opportunity Radar."
│   │
│   └── RATE LIMIT (5/day exceeded):
│       → Toast error: "You've reached your daily submission limit (5 per day).
│         Try again tomorrow."
│       → Submit button disabled for rest of the day
│
└── Below form:
    └── "Submission Guidelines" accordion:
        - Link must go directly to the official application page
        - No paid services, recruitment agencies, or MLM links
        - Submissions are reviewed by our moderation team within 24 hours
```

---

## 6. Moderator Flow

Moderators access the admin panel only for the submission queue. They use the same student-facing app for all other features.

### 6.1 Accessing the Moderation Queue

```
Moderator logs in → lands on /dashboard (same as student)
       │
       ▼
Avatar dropdown → "Moderation" → /admin/submissions
       │
       OR
       ▼
Direct URL: /admin/submissions
```

### 6.2 Submission Queue Page

```
/admin/submissions  (Moderator + Admin)
│
├── Page header: "Submission Queue"
│   └── Badge showing total pending count: "12 Pending"
│
├── Filter tabs: All | Pending | Approved | Rejected
│   (default view: Pending)
│
├── Each submission row shows:
│   ├── Submitted timestamp ("3 hours ago")
│   ├── Opportunity title
│   ├── Category badge
│   ├── Submitted by (user name — not email — for privacy context only)
│   ├── Application URL (truncated, clickable — opens in new tab for verification)
│   ├── Deadline (if provided)
│   └── Action buttons: [Approve ✓] [Reject ✗]
│
└── Escalated submissions (pending > 48 hours):
    └── Highlighted with a yellow border and label: "⚠ Pending > 48 hours"
```

### 6.3 Approve a Submission

```
Moderator clicks [Approve] on a submission row
       │
       ▼
Confirmation dialog:
"Approve this opportunity?
[Title] will be published immediately and appear in the Fresh Feed."
[Cancel] | [Approve]
       │
       ▼
On confirm:
├── PATCH /api/admin/submissions/[id]/approve
├── Opportunity status → Published
├── Submitting student receives SubmissionApproved notification
├── Audit log entry: SUBMISSION_APPROVED (actor: moderator ID)
├── Submission row disappears from Pending tab
└── Success toast: "Opportunity published successfully."
```

### 6.4 Reject a Submission

```
Moderator clicks [Reject] on a submission row
       │
       ▼
Rejection dialog:
"Reject this submission?
[Optional] Reason: ________________________ (text field, max 200 chars)
Note: The submitter will only be told it was not approved. Reason is for audit purposes only."
[Cancel] | [Reject]
       │
       ▼
On confirm:
├── PATCH /api/admin/submissions/[id]/reject (body: { reason })
├── Opportunity status → Rejected (terminal)
├── Submitting student receives SubmissionRejected notification
├── Audit log entry: SUBMISSION_REJECTED (actor: moderator ID, metadata: { reason })
├── Submission row moves to "Rejected" tab
└── Success toast: "Submission rejected."
```

---

## 7. Admin Flow

Admins have full access to the admin panel. They see everything a Moderator sees, plus all management screens.

### 7.1 Admin Overview Page

```
/admin  (Admin only)
│
├── Page header: "Admin Overview"
│
└── Summary cards row:
    ├── Total Active Opportunities (count)
    ├── Pending Submissions (count, links to /admin/submissions)
    ├── Registered Users (count)
    ├── Opportunities Added Today (count)
    └── System Health: Last cron job run status
        └── If cron failed → red banner: "⚠ Scheduled cleanup job failed. Manual review required."
```

### 7.2 Opportunity Management

```
/admin/opportunities  (Admin only)
│
├── Header: "Manage Opportunities"
│   └── [+ Create Opportunity] button (top right)
│
├── Filter tabs: All | Draft | Published | Closing Soon | Expired | Archived
│
├── Table view (each row):
│   ├── Title
│   ├── Category
│   ├── Company
│   ├── Status badge
│   ├── Deadline
│   ├── Posted date
│   └── Actions: [Edit ✏] [Archive 🗃] [Delete 🗑]
│
├── [Edit] → /admin/opportunities/[id] (edit form)
│   ├── All opportunity fields editable
│   ├── Status can be manually changed (e.g., Draft → Published)
│   ├── [Save] → PATCH → audit log: OPPORTUNITY_EDITED → toast: "Saved"
│   └── [Cancel] → back to /admin/opportunities
│
├── [Archive] → confirmation dialog
│   "Archive this opportunity? It will be hidden from students."
│   [Cancel] | [Archive]
│   → status → Archived → audit log: OPPORTUNITY_ARCHIVED
│   (Archive is a reversible soft-hide. The record is not deleted.)
│
└── [Delete] → confirmation dialog (stronger warning)
    "Permanently delete this opportunity?
    This cannot be undone. Students with it in their tracker will see it as closed."
    [Cancel] | [Delete Permanently]
    → hard delete from database → audit log: OPPORTUNITY_DELETED

[+ Create Opportunity] button:
→ /admin/opportunities/new
├── Same form as edit, all fields blank
├── Status defaults to Draft
├── Admin can set to Published directly (bypasses review queue)
└── [Publish] → status = Published → audit log: OPPORTUNITY_CREATED
    [Save as Draft] → status = Draft → audit log: OPPORTUNITY_CREATED
```

### 7.3 Company Management

```
/admin/companies  (Admin only)
│
├── Header: "Manage Companies"
│   └── [+ Add Company] button
│
├── Table: Name | Industry | Website | Opportunities Count | Actions: [Edit] [Delete]
│
├── [Edit] → company edit form (inline or separate page)
│   Fields: Name, Website URL, Careers URL, Industry, Description, Logo upload
│   → Logo upload → Supabase Storage → returns logo_url for the record
│   [Save] → audit log: COMPANY_EDITED (target_type: company)
│
└── [+ Add Company] → blank company form → [Save] → audit log: COMPANY_CREATED (target_type: company)
```

### 7.4 User Management

```
/admin/users  (Admin only)
│
├── Header: "Manage Users"
│
├── Table: Name | Email | Role | Joined | Status | Actions
│   Status: Active | Suspended | Deleted (soft)
│
├── Per-user actions (⋮ menu):
│   ├── [Change Role]
│   │   → Dropdown: Student | Moderator
│   │   (Admin cannot promote to Admin via UI — done directly in DB)
│   │   → Confirmation: "Change [Name] to Moderator?"
│   │   → PATCH → audit log: USER_ROLE_CHANGED → toast: "Role updated"
│   │
│   ├── [Suspend Account]
│   │   → Confirmation: "Suspend [Name]? They will not be able to log in."
│   │   → Sets suspended_at → audit log: USER_SUSPENDED
│   │   → Toast: "Account suspended"
│   │
│   ├── [Restore Account] (visible if suspended)
│   │   → Clears suspended_at → audit log: USER_RESTORED
│   │
│   └── [Delete Account] (Admin-initiated — rare)
│       → Strong confirmation dialog
│       → Soft delete (sets deleted_at) → audit log: ACCOUNT_DELETED
│
└── Search bar at top: search users by name or email
```

### 7.5 Audit Log

```
/admin/audit-log  (Admin only)
│
├── Header: "Audit Log"
│   └── Date range filter (default: last 7 days)
│
├── Table (reverse chronological):
│   ├── Timestamp (local timezone display)
│   ├── Actor (name + role)
│   ├── Action (e.g., SUBMISSION_APPROVED)
│   ├── Target Type (Opportunity / User / Company / System)
│   ├── Target (truncated title or ID)
│   └── [View Details] → expands row to show full metadata JSON
│
└── Filter by: Actor | Action Type | Target Type
    No delete or edit controls — audit log is read-only
```

---

## 8. Empty States

Every empty state must communicate clearly what the user should do next. Empty states are never just blank white space.

| Screen | Empty State Message | CTA |
|---|---|---|
| Opportunity Hub (no filter results) | "No opportunities match your filters." | "Clear all filters" button |
| Opportunity Hub (search no results) | "No results for '[query]'." | "Clear search" button |
| Student Dashboard (first-time user) | "Welcome! Start exploring opportunities." | "Browse Opportunities" → `/` |
| Upcoming Deadlines section | "You have no upcoming deadlines. Keep applying!" | "Discover Opportunities" → `/` |
| Application Tracker (no items) | "You haven't saved any opportunities yet." | "Start Browsing" → `/` |
| Tracker filtered by status (e.g., no Applied items) | "No opportunities with this status." | "View All" → clears filter |
| Notifications (none) | "You're all caught up! 🎉 No notifications right now." | None (informational only) |
| Company profile (no active opportunities) | "No active opportunities from [Company] right now." | "Back to Opportunities" → `/` |
| Admin Submission Queue (empty) | "No pending submissions. Great job! ✓" | None |
| Admin Opportunities list (empty category) | "No opportunities in this category." | "Create One" → create form |
| Admin User list (no search results) | "No users found matching '[query]'." | "Clear search" |

---

## 9. Loading States

### 9.1 Page Loading
- Next.js Server Components stream progressively — the shell (navbar, sidebar) renders first while content loads.
- Loading UI is defined using Next.js `loading.tsx` files — these show skeleton UI automatically during navigation.

### 9.2 Skeleton UI
Skeleton screens mirror the layout of the actual content:

| Page | Skeleton Pattern |
|---|---|
| Opportunity Hub | 6 card-shaped grey rectangles in a grid |
| Opportunity Detail | Title skeleton + description lines + button placeholders |
| Application Tracker | 4 list-item skeletons with status pill placeholders |
| Notifications | 3 row skeletons with icon placeholder + text lines |
| Admin Tables | 5 row skeletons full width |

Skeletons use a left-to-right shimmer animation (standard CSS animation). They are never shown for more than 2 seconds under normal network conditions.

### 9.3 Pending Action States
When the user triggers a write action (bookmark, tracker update, form submit), the UI must:

1. **Disable the triggering button immediately** — prevents double-clicks and double-submits.
2. **Show a spinner inside the button** — "Saving..." / "Submitting..." / "Approving..."
3. **Apply optimistic UI where safe:**
   - Bookmark toggle: immediately flips the icon state before the API confirms.
   - Notification read: immediately clears the blue dot before API confirms.
   - Tracker status change: immediately updates the status pill before API confirms.
4. **On success:** show a brief toast notification, re-enable button.
5. **On failure:** revert the optimistic UI, re-enable button, show error toast.

### 9.4 Form Submit States
All form submit buttons:
- Disabled while submitting.
- Text changes to "Saving..." with a spinner icon.
- All form fields become read-only while the request is in flight.
- On success: toast + form resets or navigates.
- On failure: fields re-enable, error message appears.

---

## 10. Error States

### 10.1 Network Failure

```
API call fails due to network error
       │
       ▼
Toast appears (bottom of screen, red):
"Something went wrong. Please check your connection and try again."
[Retry] button in toast (retries the same action once)
       │
       └── On retry failure → same toast + dismiss
```

The page does NOT crash. Existing content remains visible.

### 10.2 Unauthorized User (401)

```
User's session expires mid-session
       │
       ▼
Next API call returns 401
       │
       ▼
Middleware detects expired token → clears session cookie
       │
       ▼
Redirect to /login?next=[current-path]
       │
       ▼
Toast on login page: "Your session expired. Please sign in again."
```

### 10.3 Insufficient Role (403)

```
Student/Moderator navigates directly to /admin/users
       │
       ▼
Middleware checks role → insufficient
       │
       ▼
Silent redirect to /
(No error page shown — students should not know admin routes exist)
```

### 10.4 Duplicate Submission

```
Student submits a URL that already exists in the database
       │
       ▼
API returns 409 Conflict
       │
       ▼
Inline error appears under the URL field (not a toast):
"This opportunity is already on Opportunity Radar."
Form stays filled (user can correct the URL or abandon)
```

### 10.5 Rate Limit Exceeded (429)

```
Student submits their 6th opportunity in 24 hours
       │
       ▼
API returns 429 Too Many Requests
       │
       ▼
Submit button remains disabled
Toast: "You've reached the daily submission limit (5 per day). Try again tomorrow."
The remaining submissions counter on the page reads: "0 submissions remaining today"
```

### 10.6 Missing Deadline Display

```
Opportunity has NULL deadline field
       │
       ▼
No countdown shown
Deadline block shows: "Rolling deadline — apply early"
"Closing Soon" badge is NOT shown for rolling-deadline opportunities
```

### 10.7 Broken Link / Report Submission

```
Student clicks "Report broken link" on an opportunity card or detail page
       │
       ▼
A small popover/tooltip appears:
"Thanks for reporting. Our team will review this."
[OK] button closes the popover
POST /api/reports → report_count incremented
       │
       ├── If report_count reaches 3:
       │   → Opportunity status reverts to "Pending Review"
       │   → Opportunity disappears from public feed
       │   → Moderators see it in the queue
       │
       └── User sees no further feedback (report is anonymous)
```

### 10.8 Server Error (500)

```
Unexpected server error
       │
       ▼
Toast: "Something went wrong on our end. Please try again in a moment."
Error logged to Sentry
Sentry alert triggers if > 5 errors/minute from same endpoint
```

---

## 11. Mobile Flow

### 11.1 Core Principle

The app is designed mobile-first. Every primary user action must be reachable without zooming, horizontal scrolling, or hunting for buried menus.

**Target viewport:** 375px minimum width (iPhone SE). All layouts must be functional and non-broken at this size.

### 11.2 Mobile Navigation

**Bottom Tab Bar** (always visible on mobile for logged-in users):
- 5 fixed tabs: Discover | Dashboard | Tracker | Notifications | Profile
- Active tab highlighted (filled icon + colored label)
- Notification tab shows unread badge
- Bottom tab bar sits above device home gesture area (safe area inset)

**Logged-out mobile users:**
- No bottom tab bar
- Top navbar: Logo (left) + "Sign In" (right)
- Sign Up CTA appears as a floating button on the Opportunity Hub

### 11.3 Opportunity Hub on Mobile

```
Full-width search bar at top
Filter chips scroll horizontally (single row, no wrapping)
"Filters" button at end of chip row → opens bottom sheet with all filter options
Fresh Feed tab bar → full width, scrollable tabs

Opportunity cards:
- Stack vertically (1 column)
- Full width card
- Bookmark icon in top-right corner of each card (large enough tap target: 44x44px minimum)
- "Apply" action only visible on the detail page (not on mobile card)
```

### 11.4 Opportunity Detail on Mobile

```
Sticky header: ← back button + title (truncated)
Scroll content: all detail sections
Sticky action bar at bottom (above tab bar):
├── [🔖 Save] button (outlined) — left 50% width
└── [Apply Now →] button (filled, primary color) — right 50% width
```

### 11.5 Application Tracker on Mobile

```
List view (no Kanban on mobile — Kanban is desktop-only enhancement)
Each item is a full-width card
Status pill on the left edge (color-coded vertical stripe)
Tap card → expands to show notes + action menu
⋮ button → bottom sheet: Change Status | Edit Notes | Remove
```

### 11.6 Admin Panel on Mobile

The admin panel is accessible on mobile but is designed for operational triage, not heavy admin work. Key behaviors:
- Admin sidebar becomes a hamburger menu (☰) at the top-left, slides in as a drawer overlay
- Tables scroll horizontally (do not truncate or reflow table columns)
- In the **Submission Queue** — the most critical mobile admin task — Approve and Reject are displayed as full-width primary and secondary buttons on each card (not in overflow menus)
- In **Opportunity and User management tables**, actions (Edit, Archive, Delete / Change Role, Suspend) remain in a ⋮ overflow menu per row — these are not critical real-time actions and overflow menus are acceptable here
- The audit log is read-only on all devices; the date filter and expandable rows work on mobile

### 11.7 Community Submission Form on Mobile

```
Single-column form layout
Each field is full width
Date picker uses native mobile date input (input type="date")
Submit button is full-width, fixed to bottom of form
Submission guidelines accordion collapses by default to reduce scroll
```

### 11.8 Notifications on Mobile

```
Full-page view /notifications (same as desktop, but full-width rows)
Swipe-to-dismiss gesture on each notification (left swipe → dismiss)
"Mark all as read" button fixed at top-right
```

---

## 12. State Transition Summary

### 12.1 Opportunity Lifecycle

```
           [Admin creates]
                │
                ▼
             DRAFT
          (admin-only)
                │
                │ Admin publishes directly
                │ ─────────────────────────────────────────────┐
                │                                              │
                │ [Not applicable — Draft is admin-only]       │
                ▼                                              ▼
        PENDING REVIEW ──── Moderator/Admin approves ──▶  PUBLISHED
       (community sub)       (creates notification)          │     │
                │                                            │     │
                │ Moderator/Admin rejects                    │     │
                ▼    (creates notification)          [cron, every 15m]
            REJECTED                                          │
          (terminal)                                          ▼
                                                       CLOSING SOON
                                                    (deadline ≤ 48h away)
                                                          (creates DeadlineAlert
                                                       for users with it Saved)
                                                              │
                                                    [cron, daily 00:00 UTC]
                                                              │
                                                              ▼
                                                          EXPIRED
                                              (hidden from public, visible in
                                               student trackers as "closed")
                                                              │
                                              [Admin manual action only]
                                                              │
                                                              ▼
                                                          ARCHIVED
                                                      (fully removed)
```

State table: any state can transition to ARCHIVED via Admin manual action.

### 12.2 Application Tracker Status Lifecycle

```
[Student bookmarks/saves opportunity]
              │
              ▼
            SAVED
              │
    ──────────┼──────────
    │                   │
    ▼                   ▼
  APPLIED            (Removed from tracker — deleted)
    │
    │
    ▼
INTERVIEW SCHEDULED
    │
    ├──────────────────────┐
    ▼                      ▼
SELECTED               REJECTED
(terminal)             (terminal)
```

- Transitions are manual — the student always drives status changes.
- Any status can jump to any other status (the student is in full control).
- "Rejected" in the tracker is the student's own application outcome, not an admin action.
- A tracker item in "Saved" state that has been unchanged for 7 days triggers a `StaleTracker` notification.

### 12.3 Notification Lifecycle

```
Trigger event occurs (deadline, submission approved/rejected, stale tracker)
              │
              ▼
        Notification created in DB (is_read = FALSE)
              │
              ▼
        Bell icon badge increments (+1)
              │
    ──────────┼──────────────────────────────────────────
    │                          │                        │
    ▼                          ▼                        ▼
User clicks            User clicks               User clicks
notification body      [Mark as read]         "Mark all as read"
is_read = TRUE         is_read = TRUE         (all) is_read = TRUE
Bell badge decrement   Bell badge decrement    Bell badge → 0
    │                      │
    └──────────────────────┘
              │
    Notification still exists in DB (only is_read changed)
              │
              ▼
    User clicks [Dismiss ✕] on any read or unread notification
              │
              ▼
    Notification permanently deleted from DB
    (dismiss = delete; mark-as-read = just clears the dot)
```

**Deduplication rule:** The system never creates a second notification of the same type for the same opportunity and user. If a `DeadlineAlert` already exists for `opportunity_id=X` and `user_id=Y`, no second one is created by the cron job.

### 12.4 Community Submission Lifecycle

```
Student submits form
       │
       ▼
  PENDING REVIEW
  (hidden from public)
       │
   ────┼──────────────────────────────────────────────────────
   │                                                         │
   │ [> 48 hours pass]                          Moderator/Admin acts
   ▼                                              │         │
 System escalates                                 ▼         ▼
 (audit log: MODERATION_ESCALATED)          PUBLISHED   REJECTED
 (flagged in admin dashboard)              (notification  (notification
  ↓                                      to submitter)  to submitter)
  Still in PENDING REVIEW
  (escalation = flag only, not auto-action)
```

---

## 13. Notes for UI/UX Design

### 13.1 Visual Hierarchy Priorities

On the Opportunity Hub (the most visited page), the visual hierarchy must be:
1. **Search bar** — most prominent element on the page
2. **Fresh Feed filter tabs** — second most prominent
3. **Opportunity cards** — clear, scannable, consistent grid
4. **Filters** — accessible but secondary (chips on desktop, behind button on mobile)

### 13.2 Color System for Badges

Use consistent colors across all pages for category and status badges:

| Category | Suggested Color |
|---|---|
| Internship | Blue |
| Job | Indigo |
| Hackathon | Purple |
| Workshop | Teal |
| Scholarship | Amber |
| Competition | Orange |

| Status | Suggested Color |
|---|---|
| Published | Green |
| Closing Soon | Red |
| Expired | Grey |
| Pending Review | Yellow |
| Draft | Light Grey |
| Rejected | Dark Red |

| Tracker Status | Suggested Color |
|---|---|
| Saved | Blue |
| Applied | Purple |
| Interview Scheduled | Amber |
| Selected | Green |
| Rejected | Grey |

### 13.3 Deadline Display Rules

| Time Remaining | Display Text | Color |
|---|---|---|
| > 7 days | "12 days left" | Green |
| 2–7 days | "5 days left" | Amber |
| < 48 hours | "Closing today" / "X hours left" + ⚡ icon | Red |
| Already expired | "Closed" | Grey (muted) |
| NULL deadline | "Rolling deadline" | Blue (muted) |

### 13.4 Toast Notifications

- Appear at the bottom-center of the screen (mobile) or top-right (desktop)
- Auto-dismiss after 4 seconds
- Can be manually closed with ✕
- 3 types: Success (green), Error (red), Informational (blue)
- Never show more than 2 toasts simultaneously — queue them

### 13.5 Confirmation Dialogs

Use confirmation dialogs only for **destructive or irreversible actions**:
- Deleting an opportunity (admin)
- Rejecting a submission (moderator)
- Deleting a user account
- Removing from tracker

For safe/reversible actions (bookmark toggle, marking notification read, status changes), use optimistic UI with no confirmation dialog.

### 13.6 Action Feedback Timing

| Action | Expected Response Time | UI Behavior |
|---|---|---|
| Bookmark toggle | < 300ms (optimistic) | Immediate icon state change |
| Tracker status change | < 300ms (optimistic) | Immediate pill color change |
| Form submit | 500ms–1500ms (real API call) | Button spins, fields lock |
| Search results update | 300ms debounce + 200–500ms query | Skeleton appears after 300ms |
| Page navigation | < 1000ms (Next.js ISR) | Skeleton layout during stream |

### 13.7 Key Design Assumptions

1. **Bookmark = Tracker entry.** There is one action: "Save." Students do not have separate "bookmarks" and "tracker" lists. Saving puts it in the tracker at "Saved" status. This is simpler to build, simpler to explain, and more useful.

2. **No Kanban on mobile.** The tracker is a list on mobile. A Kanban board is a desktop-only progressive enhancement. Do not build a broken mobile Kanban.

3. **Admin panel is not visually polished.** The admin panel is a functional tool for the operator. It does not need to be as visually refined as the student-facing app. Prioritize clarity and efficiency over aesthetics in the admin panel.

4. **No avatar image upload in MVP.** The profile photo is a generated initials avatar (first letter of name). Logo uploads are in scope for companies (Supabase Storage), but not for student profile photos, to avoid storage complexity.

5. **Opportunity Hub is the homepage.** There is no separate marketing landing page in MVP. The homepage IS the product. Students arriving from a Google search or social share should see real opportunities immediately — not a hero section with a "Get Started" button.

6. **Filter state is URL-only.** No filter state is stored in component memory, localStorage, or any other mechanism. The URL is the single source of truth. This ensures back-button, refresh, and deep-link behavior all work correctly without custom logic.

7. **?next param is end-to-end.** The `?next` redirect param must survive OAuth flows by being passed through Supabase's `redirectTo` + OAuth state parameter. Losing `?next` during OAuth is a broken experience — the user ends up at `/dashboard` instead of the page they wanted.

---

### 13.8 Accessibility and Usability Rules

These rules are non-negotiable for a production-quality app:

**Tap Targets:**
- All interactive elements (buttons, links, icons) must have a minimum touch target of **44×44px** on mobile, even if the visible element is smaller. Use padding to extend the target without changing visual size.
- The Bookmark icon on opportunity cards must meet the 44×44px minimum — it is a frequent one-handed action.

**Keyboard Navigation:**
- All interactive elements must be reachable and operable via keyboard (Tab, Enter, Space, Arrow keys where appropriate).
- Modals and dialogs must trap focus while open. When closed, focus returns to the triggering element.
- The notification panel, filter bottom sheet, and status selector modal must all support keyboard dismiss (Escape key).

**ARIA and Semantic HTML:**
- Opportunity cards must use semantic `<article>` elements.
- Status badges, category badges, and notification type icons must have `aria-label` values for screen readers.
- The notification bell badge must use `aria-label="N unread notifications"` (updated live).
- Form fields must have visible `<label>` elements — placeholder text alone is not a label.
- All confirmation dialogs must use `role="dialog"` with `aria-modal="true"` and a descriptive `aria-labelledby`.

**Color Contrast:**
- All badge text and background color combinations must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text).
- Status colors (green, amber, red, grey) must not be the **only** differentiator — pair color with a text label or icon.

**Readability:**
- Opportunity card titles must not be truncated to fewer than 2 lines on mobile. Use `line-clamp: 2` with full title in a tooltip or on the detail page.
- Deadline countdowns must be legible at the default system font size (do not use font sizes below 14px for any data).

---

### 13.9 Sort Order Rules (Summary)

This is a condensed reference for designers and developers. Full logic is in §5.5.1.

| Context | Sort Order |
|---|---|
| Opportunity Hub (default, no query) | Closing Soon first → newest `posted_at` DESC |
| Search results (q param present) | Closing Soon first → newest `posted_at` DESC |
| Fresh Feed (fresh param present) | `posted_at` DESC only — no urgency float |
| Filters applied (no query) | Same as default — Closing Soon first → newest DESC |
| Application Tracker | Deadline ASC → rolling-deadline items at bottom → title alpha |
| Dashboard Upcoming Deadlines | Deadline ASC (soonest first, within 7 days) |
| Company profile opportunities | `posted_at` DESC (newest from that company first) |
| Admin opportunity table | `created_at` DESC by default; any column is sortable by header click |

**Tie-breaking:** All ties broken by `id ASC` (deterministic, prevents reordering on pagination).

**User-configurable sort:** Not in MVP. The `sort` URL param is reserved for v2.

---

### 13.10 Profile Privacy Rules (Summary)

This is a condensed reference. Full rules are in §5.11.1.

- **Student profiles are private.** No public profile pages exist in MVP.
- **There is no `/profile/[id]` route.** Only `/profile` exists, accessible only by the authenticated account owner.
- **Resume links are private.** Never returned in any API response visible to other users.
- **Admin view of users** shows name and masked email only (`l***@gmail.com`). No admin can read a student's resume URL or tracker entries through the admin panel.
- **RLS enforces privacy at the database layer.** Application-layer privacy alone is not sufficient.
- **Moderator submission view** shows submitter name only (not email) for moderation context.
- **No student's data is visible to other students.** This includes tracker entries, bookmarks, submission history, and profile fields.

---

*App Flow Document complete. The next document to produce is the UI/UX Brief (`UI-UX-Brief.md`).*
