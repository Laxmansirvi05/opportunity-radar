# Security Plan: Opportunity Radar

## 1. Security Philosophy

- **Security-first development:** Security is integrated natively into the software development life cycle (SDLC) from day one.
- **Least privilege access:** Users, services, and database operations run with the absolute minimum permissions necessary to function.
- **Defense in depth:** Security controls exist at multiple layers (UI, API, Middleware, Database). If one layer fails, another will catch the unauthorized action.
- **Secure-by-default architecture:** All tables deny access by default. RLS policies must be explicitly written to grant access.
- **AI-agent coding safety:** AI coding assistants must strictly adhere to project security boundaries. They are explicitly forbidden from exposing secrets, bypassing validation, or relaxing Row Level Security without human approval.

## 2. Authentication Security

- **Email/password security:** Handled exclusively via Supabase Auth with enforced minimum complexity.
- **OAuth security:** Supported via Google OAuth and GitHub OAuth using official Supabase integrations with state validation.
- **Session management:** Sessions are managed via JWTs issued securely by Supabase.
- **HttpOnly cookies:** JWTs are stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies via the `@supabase/ssr` package.
- **Explicit prohibition:** Storing authentication tokens in `localStorage` or `sessionStorage` is strictly prohibited due to XSS vulnerability risks.
- **Password reset security:** Handled securely through Supabase magic links to prevent token hijacking.
- **Account recovery:** Verification via the user's registered email address.
- **Session expiration:** Tokens expire after 7 days and are automatically refreshed on user activity.

## 3. Authorization & RBAC

- **Student permissions:** Can view published opportunities, update their own profile, manage their personal application tracker, and submit opportunities (max 5/day).
- **Moderator permissions:** Can view the moderation queue and approve or reject community submissions.
- **Admin permissions:** Full CRUD authority over opportunities, companies, and users. Exclusive access to the immutable audit log and platform analytics.
- **Server-side role verification:** Middleware and Route Handlers check the role directly from the `profiles` table (or secure JWT `app_metadata`) before executing logic.
- **Route protection:** Next.js Middleware acts as the primary gatekeeper, returning 403 or redirecting to `/login` for unauthorized route attempts.
- **API protection:** All Next.js Route Handlers invoke `supabase.auth.getUser()` and role validation server-side.
- **Ownership checks:** Modifications require a strict match between the resource's `user_id` and the session's `auth.uid()`.

## 4. Database Security

- **Row Level Security:** Every table in the PostgreSQL database requires RLS to be enabled.
- **Policy design principles:** Default deny all. Explicit policies define `SELECT`, `INSERT`, `UPDATE`, and `DELETE` access per role.
- **auth.uid() usage:** RLS policies must explicitly use `auth.uid()` to verify data ownership for user-specific records.
- **service_role restrictions:** The `SUPABASE_SERVICE_ROLE_KEY` completely bypasses RLS. It must NEVER be exposed to the client. It is restricted to secure server actions (e.g., writing to the audit log).
- **Audit logging:** All admin and moderator actions write to an append-only `audit_logs` table via the service role key.
- **Migration safety:** Database schema changes must be executed through version-controlled `.sql` migration files.

## 5. API Security

- **Server-side validation:** The client is never trusted. Every incoming API request payload must be validated.
- **Zod schemas:** Strict Zod parsing is required for all request bodies and server actions.
- **Request sanitization:** User inputs (e.g., descriptions, text notes) are sanitized to prevent XSS and SQL injection.
- **Error handling:** APIs fail securely. Generic error messages are sent to the client to prevent leaking stack traces or database schema details.
- **HTTP method rules:** Endpoints enforce strict REST methods. Unsupported methods return a 405 error.
- **Authentication checks:** Unauthorized API requests immediately return a 401.
- **Authorization checks:** Authenticated but unprivileged API requests immediately return a 403.

## 6. Rate Limiting Strategy

Official limits enforced to protect against brute-force and spam:

- **Login:** 5 requests / 15 min
- **Signup:** 5 requests / hour
- **Submissions:** 5 requests / day (enforced per authenticated user).
- **Broken Reports:** 10 requests / day
- **General API:** 60 requests / minute

**Enforcement strategy:** Limits are enforced via Vercel Edge Middleware or Next.js server-side logic using a Redis store (e.g., Upstash) tracking by IP for public routes or `user_id` for authenticated endpoints.

## 7. File & Storage Security

- **Resume links:** The MVP relies on external URL links for resumes. No direct resume document uploads are permitted.
- **Supabase Storage:** Storage buckets are utilized exclusively for `company-logos`.
- **MIME validation:** Enforced checking to allow only specific image formats (e.g., `image/png`, `image/jpeg`).
- **File size validation:** Uploads are strictly limited to a maximum of 2MB.
- **Storage policies:** RLS must be enabled on storage buckets. Only Admins may upload/modify logos; public read access is permitted for UI rendering.
- **Upload restrictions:** Complete prohibition of executable files, scripts, or any active content.

## 8. Frontend Security

- **XSS prevention:** Relies on React's default auto-escaping string mechanisms.
- **no dangerouslySetInnerHTML:** The use of `dangerouslySetInnerHTML` is strictly prohibited across the codebase.
- **CSP recommendations:** A strict Content Security Policy (CSP) header must be configured to restrict script execution, framing, and external resource loading.
- **React safety:** Sensitive tokens or API keys must never be passed as props to Client Components.
- **Secure routing:** Utilize Next.js middleware to manage routing state securely and prevent UI flickering on protected pages.
- **Secret handling:** Only keys explicitly prefixed with `NEXT_PUBLIC_` (e.g., the Supabase Anon Key) are exposed to the browser. All other secrets remain server-side.

## 9. Infrastructure Security

- **Vercel deployment:** Benefits from Vercel's immutable infrastructure and default DDoS protection.
- **Environment variables:** Secrets are securely managed in the Vercel dashboard. `.env.local` files containing secrets must never be committed to version control.
- **Secret rotation:** Establish documented protocols for rotating Supabase database passwords, JWT secrets, and OAuth client keys.
- **HTTPS enforcement:** Strict Transport Security (HSTS) and HTTPS are enforced across all domains and endpoints.
- **Production configuration:** Verbose error logging, source maps, and debug modes must be disabled in the production environment.

## 10. Monitoring & Logging

- **audit_logs:** An immutable database ledger tracks all critical operational events.
- **Moderator actions:** Submissions approved or rejected are logged with the actor's ID.
- **Admin actions:** Role changes, account suspensions, and manual opportunity edits are permanently logged.
- **Security events:** Monitoring systems track high-velocity failures (e.g., credential stuffing attacks).
- **Failed logins:** Excessive failed login attempts trigger alerts and temporary lockouts.
- **Anomaly tracking:** Unhandled server exceptions (500 errors) are routed to a centralized error tracking system for immediate triage.

## 11. Incident Response

- **Vulnerability discovery process:** A clear channel for reporting, internally triaging, and rapidly patching identified security flaws.
- **Credential compromise process:** Protocols established to instantly invalidate all active user sessions and rotate affected system secrets.
- **Rollback process:** Immediate utilization of Vercel's instant rollback feature to revert to the last known secure deployment in the event of a malicious release.
- **Escalation process:** Defined contact protocols and chains of command for handling incidents involving data breaches or PII exposure.

## 12. AI-Agent Security Rules Integration

Reference: `AI-Agent-Security-Rules.md`

AI coding agents actively assisting with this project must comply with the `AI-Agent-Security-Rules.md` at all times. Agents are expressly forbidden from bypassing authentication middlewares, relaxing database RLS policies, hardcoding sensitive credentials, or overriding Zod validation schemas. Any code generated by an AI that touches authorization, authentication, or infrastructure secrets requires mandatory human security review before merging.

## 13. Security Validation Checklist

**Pre-Deployment Checklist:**
- [ ] **Authentication:** Email/Password, Google OAuth, and GitHub OAuth flows validated. `HttpOnly` cookie storage confirmed.
- [ ] **Authorization:** RBAC logic fully tested for Student, Moderator, and Admin boundaries.
- [ ] **RLS:** All tables verified to have Row Level Security enabled with explicit, restrictive policies applied.
- [ ] **Storage:** Bucket RLS policies verified. File size (2MB) and MIME type limits actively enforced.
- [ ] **API Validation:** All incoming data payloads routed through strict Zod schema validation.
- [ ] **Rate Limiting:** Limits successfully enforced for Login, Signup, Submissions, Reports, and General API.
- [ ] **Monitoring:** `audit_logs` securely appending records bypassing RLS using `service_role`.
- [ ] **Deployment:** Vercel environment variables verified. No protected secrets exposed in `NEXT_PUBLIC_` variables.

## 14. HTTP Security Headers

- **Content-Security-Policy (CSP):** Mitigates XSS by whitelisting trusted sources for scripts, styles, and other resources.
- **X-Frame-Options: DENY:** Prevents clickjacking by blocking the application from being embedded in iframes on other domains.
- **X-Content-Type-Options: nosniff:** Prevents MIME-sniffing vulnerabilities by forcing the browser to respect the declared content type.
- **Referrer-Policy: strict-origin-when-cross-origin:** Protects user privacy and prevents leakage of sensitive URL parameters to external sites.
- **Permissions-Policy:** Restricts the use of browser features (e.g., camera, microphone, geolocation) to reduce the attack surface.
- **Strict-Transport-Security (HSTS):** Enforces secure (HTTPS) connections to the server, protecting against man-in-the-middle attacks.

## 15. CORS Security

**Development:**
- Restricted to `localhost` only.

**Production:**
- Restricted to Official Opportunity Radar domains only.

**Rules:**
- No wildcard (`*`) origins are permitted.
- Credentials (cookies, authorization headers) are strictly allowed only with explicitly approved origins.

## 16. Dependency Security

- **npm audit before deployment:** An automated audit step must pass before any deployment to production.
- **Lockfile required:** `package-lock.json` must be committed to ensure deterministic and secure dependency resolution.
- **Dependency review process:** Any new dependencies added to the project require manual review for security and maintenance health.
- **No abandoned packages:** Packages with no updates in the last 12 months or explicitly marked as deprecated must be replaced.
- **Monthly security updates:** A routine maintenance schedule is enforced to update core dependencies (Next.js, Supabase, React) and patch vulnerabilities.

## 17. Security Severity Classification

- **Critical:** Vulnerabilities that allow remote code execution, database compromise, or mass data exfiltration.
- **High:** Vulnerabilities that allow unauthorized access to sensitive data or privilege escalation for specific users.
- **Medium:** Vulnerabilities that require complex scenarios or user interaction to exploit (e.g., localized XSS).
- **Low:** Informational findings, minor misconfigurations, or best-practice deviations.

**Deployment rule:**
- **Critical** findings block deployment immediately.
- **High** findings must be fixed before a production release.

## 18. Security Freeze Status

Security Plan Version: v1.0

Status: Frozen

Ready for Development
