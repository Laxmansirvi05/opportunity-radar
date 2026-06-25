# Opportunity Radar V1 - Bug Backlog

This document consolidates findings from the Functional, E2E, and Security Audits into a prioritized backlog for the V1 release.

---

## P0 - Must Fix Before Release
*Issues that block core functionality, compromise security, or cause critical user journey failures.*

### 1. Auth Recovery Placeholders
* **Description:** The `/forgot-password` and `/verify-email` forms use simulated frontend `setTimeout` timeouts instead of actual backend logic.
* **Why it matters:** Completely breaks the user recovery lifecycle. Users cannot reset forgotten passwords, leading to permanent account lockouts.
* **Estimated effort:** Medium
* **Dependencies:** Supabase Auth setup (SMTP or Magic Links).
* **Files likely affected:** 
  * `frontend/app/(auth)/forgot-password/page.tsx`
  * `frontend/app/(auth)/verify-email/page.tsx`

### 2. High-Severity Dependency Vulnerabilities
* **Description:** 4 vulnerabilities identified via `npm audit` (2 High, 2 Moderate), affecting `undici`, `hono`, and `postcss`.
* **Why it matters:** Introduces theoretical attack vectors (queue poisoning, Set-Cookie manipulation) into the server runtime.
* **Estimated effort:** Small
* **Dependencies:** None.
* **Files likely affected:** 
  * `frontend/package.json`
  * `frontend/package-lock.json`

---

## P1 - Should Fix
*Issues that significantly degrade the user experience or present moderate security risks but don't strictly block the MVP core paths.*

### 3. Missing Security Headers
* **Description:** The `next.config.ts` does not implement standard security headers (CSP, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options).
* **Why it matters:** Leaves the application susceptible to Clickjacking and makes XSS exploitation easier if a vulnerability is ever introduced.
* **Estimated effort:** Small
* **Dependencies:** None.
* **Files likely affected:** 
  * `frontend/next.config.ts`

### 4. Dead Notification Link (404)
* **Description:** Clicking the bell icon in the Dashboard header attempts to navigate to `/notifications`, which results in a 404 page.
* **Why it matters:** Broken primary navigation links heavily degrade trust and perceived application stability.
* **Estimated effort:** Small (if hiding the icon) / Medium (if building the page).
* **Dependencies:** None.
* **Files likely affected:** 
  * `frontend/components/layouts/dashboard-header.tsx`

---

## P2 - Nice to Have
*Minor UX polish, console warnings, and trivial navigational fixes.*

### 5. Hardcoded '#' Anchor Links
* **Description:** The Terms, Privacy, Support, and Contact links on the auth recovery pages and opportunity detail footers are hardcoded to `href="#"`.
* **Why it matters:** Clicking them jumps the user to the top of the page instead of opening the legal/support documents.
* **Estimated effort:** Small
* **Dependencies:** None.
* **Files likely affected:** 
  * `frontend/app/(auth)/forgot-password/page.tsx`
  * `frontend/app/(auth)/verify-email/page.tsx`
  * `frontend/app/(protected)/opportunities/[id]/page.tsx`

### 6. The Hub Redirect
* **Description:** Navigating to `/hub` immediately executes a server-side redirect to `/search`.
* **Why it matters:** Wastes a route and creates disjointed navigation if any internal links point to the Hub expecting a unique view.
* **Estimated effort:** Small
* **Dependencies:** None.
* **Files likely affected:** 
  * `frontend/app/(protected)/hub/page.tsx`

### 7. React DOM Prop Warning (Settings Toggle)
* **Description:** A console warning appears on the `/settings` page: `Warning: React does not recognize the 'xyz' prop on a DOM element.` originating from the `@base-ui/react` toggle component.
* **Why it matters:** Clutters the developer console. Not user-facing, but represents unclean component prop passing.
* **Estimated effort:** Small
* **Dependencies:** None.
* **Files likely affected:** 
  * `frontend/app/(protected)/settings/page.tsx`
  * Custom Toggle component (if abstracted).

---

## P3 - Version 2
*Missing features or architectural improvements slated for post-V1.*

### 8. Strict Form Validation (Zod Integration)
* **Description:** The frontend relies primarily on HTML5 validation instead of strict schema validation utilizing Zod + React Hook Form (dependencies which exist but are unused).
* **Why it matters:** HTML5 validation can be bypassed easily. Server actions/APIs must be rock solid to compensate.
* **Estimated effort:** Large
* **Dependencies:** Refactoring existing forms.
* **Files likely affected:** 
  * `frontend/features/auth/components/*`

### 9. Company Pages
* **Description:** There is no dedicated route to browse all active opportunities grouped by a specific company.
* **Why it matters:** A major feature requirement for users wanting to research specific employers.
* **Estimated effort:** Large
* **Dependencies:** New database queries and UI views.
* **Files likely affected:** 
  * `frontend/app/(protected)/companies/*` (New)

### 10. Admin curation and Dashboard
* **Description:** No interfaces exist for Admins or Moderators to review "Pending" opportunities or handle reported content.
* **Why it matters:** Required for platform scale and data quality management.
* **Estimated effort:** Large
* **Dependencies:** RLS policies are ready, needs frontend implementation.
* **Files likely affected:** 
  * `frontend/app/admin/*` (New)
