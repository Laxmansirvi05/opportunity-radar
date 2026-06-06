# Security Audit Checklist

## 1. Audit Purpose

Security audits are systematic evaluations of the Opportunity Radar platform's security controls to ensure they are correctly implemented and functioning as intended. 
* **Why audits are performed:** To validate that the system protects student data, enforces strict Role-Based Access Control (RBAC), and adheres to the `Security-Plan.md` and `AI-Agent-Security-Rules.md`.
* **When audits are required:** Audits must be executed before major milestones, specifically prior to the Beta launch and the Public Production launch.
* **Who performs audits:** Audits must be performed by a designated Security Owner, Lead Engineer, or an external Security Consultant who did not write the primary feature code.

## 2. Authentication Audit

- [ ] Email/password login and signup flow works securely.
- [ ] Google OAuth flow works securely.
- [ ] GitHub OAuth flow works securely.
- [ ] Password reset (magic link) flow works and invalidates old sessions.
- [ ] Sessions expire correctly after 7 days of inactivity.
- [ ] JWTs are strictly stored using `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- [ ] `localStorage` is completely free of any authentication tokens.
- [ ] `sessionStorage` is completely free of any authentication tokens.

## 3. Authorization Audit

- [ ] **Student access restrictions:** Verified that Students cannot access Moderator queues, Admin dashboards, or other users' profiles.
- [ ] **Moderator access restrictions:** Verified that Moderators can approve/reject submissions but cannot manage users, edit published opportunities directly, or view audit logs.
- [ ] **Admin access restrictions:** Verified that Admins have full access and that the role cannot be escalated by lower-privileged users.
- [ ] **Protected routes:** Verified that Next.js middleware successfully guards `/(protected)` and `/(admin)` paths.
- [ ] **Protected APIs:** Verified that all internal API routes check `supabase.auth.getUser()` and enforce role checks before execution.
- [ ] **Ownership validation:** Verified that users can only modify resources (e.g., tracker entries) where `user_id = auth.uid()`.

## 4. Database Security Audit

- [ ] RLS is actively enabled on every single PostgreSQL table.
- [ ] Explicit RLS policies exist for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on all tables.
- [ ] `auth.uid()` checks are actively enforced in RLS policies to guarantee data ownership.
- [ ] `service_role` key isolation is verified; the key is never exposed to the client and only used in secure server environments.
- [ ] Migration safety verified; all database changes are documented and executed via `.sql` migration files.

## 5. API Security Audit

- [ ] Zod schema validation is enforced on all incoming API request bodies and Next.js server actions.
- [ ] Sanitization is applied to all user-submitted text fields to prevent injection attacks.
- [ ] Proper HTTP status codes (400, 401, 403, 404, 405, 500) are returned correctly based on the failure context.
- [ ] Error handling fails securely; no stack traces or raw database errors are leaked to the client.
- [ ] Server-side authorization checks are strictly enforced before processing mutations.

## 6. Storage Security Audit

- [ ] Bucket permissions (RLS) are strictly enforced (e.g., only Admins can upload `company-logos`).
- [ ] MIME-type restrictions are actively enforced (only specific image formats allowed).
- [ ] File-size restrictions (maximum 2MB) are actively enforced on uploads.
- [ ] Upload policies correctly block executables, scripts, and active content.

## 7. Frontend Security Audit

- [ ] The codebase contains absolute zero instances of `dangerouslySetInnerHTML`.
- [ ] Content-Security-Policy (CSP) headers are actively configured and restricting unsafe inline scripts.
- [ ] Strict-Transport-Security (HSTS) is actively configured.
- [ ] Secure routing prevents unauthorized UI flickering or layout exposure on protected pages.
- [ ] Secret protection verified; no sensitive keys exist in client bundles (only `NEXT_PUBLIC_` keys).

## 8. Infrastructure Audit

- [ ] Vercel environment variables are correctly segregated between Preview and Production environments.
- [ ] HTTPS is enforced across all endpoints and domains.
- [ ] Secret management protocols are followed; no `.env.local` files are committed to the repository.
- [ ] Production configuration is optimized (e.g., debug logging disabled).
- [ ] Source maps are explicitly disabled in the production build to prevent source code leakage.

## 9. Monitoring & Logging Audit

- [ ] `audit_logs` table integrity verified (append-only ledger).
- [ ] Moderator actions (approving/rejecting submissions) are successfully logging.
- [ ] Admin actions (role changes, suspensions, direct edits) are successfully logging.
- [ ] Failed login monitoring is active and tracking anomalies.
- [ ] Security event monitoring correctly flags high-velocity failures.

## 10. Dependency Audit

- [ ] `npm audit` (or equivalent) passes with zero critical or high vulnerabilities.
- [ ] No critical vulnerabilities exist in the dependency tree.
- [ ] Only actively maintained packages are utilized.
- [ ] `package-lock.json` (or equivalent lockfile) is present and committed to version control.

## 11. Rate Limiting Audit

- [ ] Login limits verified (max 5 requests / 15 minutes).
- [ ] Signup limits verified (max 5 requests / 1 hour).
- [ ] Submission limits verified (max 5 requests / 24 hours per authenticated user).
- [ ] Report limits verified (max 10 broken link reports / 24 hours).
- [ ] General API limits verified (max 60 requests / 1 minute).

## 12. Penetration Testing Checklist

- [ ] SQL injection resistance verified across all input vectors.
- [ ] XSS (Cross-Site Scripting) resistance verified in all rendering components.
- [ ] CSRF (Cross-Site Request Forgery) protection verified.
- [ ] Privilege escalation attempts successfully blocked by backend authorization.
- [ ] IDOR (Insecure Direct Object Reference) attempts successfully blocked by RLS policies.
- [ ] Broken access control attempts successfully caught by middleware and API guards.

## 13. Pre-Beta Audit

*Target: Ensure the system is safe for closed beta testers.*
- [ ] Authentication Audit passes completely.
- [ ] Authorization Audit passes completely.
- [ ] Database Security Audit passes completely.
- [ ] Frontend Security Audit passes completely.
- [ ] Rate Limiting Audit passes completely.

## 14. Pre-Production Audit

*Target: Ensure the system is hardened for public release.*
- [ ] All Pre-Beta Audit items verified and re-tested.
- [ ] API Security Audit passes completely.
- [ ] Storage Security Audit passes completely.
- [ ] Infrastructure Audit passes completely.
- [ ] Monitoring & Logging Audit passes completely.
- [ ] Dependency Audit passes completely.
- [ ] Penetration Testing Checklist completed with zero Critical or High findings.

## 15. Critical Findings Policy

Findings during the audit are classified into the following severities:

- **Critical:** Remote code execution, database compromise, mass data exfiltration, or complete authentication bypass.
- **High:** Unauthorized access to sensitive data, privilege escalation, or widespread IDOR.
- **Medium:** Localized XSS, complex edge-case exploits, or moderate rate-limiting failures.
- **Low:** Informational findings, minor header misconfigurations, or best-practice deviations.

**Deployment Rules:**
* **Critical** findings strictly block all deployments (Beta and Production).
* **High** findings strictly block any Production release.
* **Medium** findings require a documented remediation plan prior to launch.
* **Low** findings are logged into the backlog for future sprint improvement.

## 16. Audit Sign-Off

**Security Audit Version:** v1.0

**Status:** (Select One)
- [ ] **Pass** (No Critical or High findings; Mediums have remediation plans)
- [ ] **Conditional Pass** (High findings exist but have documented, temporary mitigating controls approved by engineering leadership)
- [ ] **Fail** (Critical or High findings exist with no mitigation)

**Auditor Name:** ________________________  
**Date:** ________________________  
**Notes:**  
*(Add any specific context, exceptions, or remediation plan links here)*

## 17. Freeze Status

Security-Audit-Checklist Version: v1.0

Status: Frozen

Mandatory before Beta and Production releases.
