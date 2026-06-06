# Release and Deployment Guide

## 1. Purpose

This guide outlines the definitive methodology for how Opportunity Radar is developed, tested, deployed, released, monitored, and maintained. 
* **Why this guide exists:** To establish a single source of truth for the deployment lifecycle, preventing configuration drift, deployment failures, and production outages.
* **Release management goals:** Ensure every release is predictable, safe, and verifiable.
* **Deployment philosophy:** We prioritize Reliability, Repeatability, and Low-risk releases over speed. Infrastructure changes and deployments must be strictly procedural and boring.

## 2. Development Workflow

**Development Process:**
1. **Implement one feature at a time:** Keep pull requests small and reviewable.
2. **Verify feature locally:** Confirm expected behavior in the local browser.
3. **Run security checks:** Ensure no secrets are leaked and RLS is respected.
4. **Run TypeScript validation:** Execute `npm run type-check`.
5. **Run linting:** Execute `npm run lint` to enforce code quality.
6. **Commit changes:** Write clear, descriptive commit messages.
7. **Test again:** Run integration tests and verify no regressions exist.
8. **Deploy:** Merge to the development branch for staging deployment.

**State:**
* **Never build the entire application at once.**
* Development must strictly follow `Implementation-Plan.md` phase by phase.

## 3. Branch Strategy

The repository utilizes a strict branching model:
* `main`: The production-ready branch. Code here is actively deployed to users.
* `development`: The integration branch. Code here is deployed to a staging environment for pre-release validation.
* `feature/*`: Short-lived branches for individual tasks or fixes (e.g., `feature/google-oauth`).

**Rules:**
* Production deploys **only** trigger from the `main` branch.
* All feature work must be developed in `feature/*` branches.
* **No direct commits to `main`.** All merges to `main` require a Pull Request from `development`.

## 4. Local Environment Setup

**Required software:**
* Node.js LTS (v20+)
* npm (v10+)
* Git
* VS Code (with Prettier and ESLint extensions)
* Supabase CLI

**Verification steps & Expected commands:**
```bash
node -v      # Expected: v20.x.x
npm -v       # Expected: 10.x.x
git --version # Expected: git version 2.x
supabase -v  # Expected: 1.x.x
```

## 5. Environment Variables

**Categories:**
* **Authentication:** OAuth client IDs and secrets.
* **Database:** Database connection strings, Supabase Service Role key.
* **Storage:** Bucket configurations.
* **Application:** Base URLs, API keys.

**Rules:**
* **Private variables:** Database URIs, Service Role Keys, and OAuth client secrets MUST remain private. They exist only in server-side contexts.
* **Public variables:** Only variables prefixed with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are exposed to the browser.
* **Explicit prohibition:** Hardcoding or exposing secrets in client bundles is strictly prohibited and blocks deployment.

## 6. Supabase Setup

* **Project creation:** Initialize via the Supabase Dashboard in the target organization.
* **Database initialization:** Apply the `Backend-Schema.md` definitions.
* **Migration workflow:** Manage all database changes locally via `supabase migration new` and deploy via the CLI or GitHub Actions.
* **Storage buckets:** Create the `company-logos` bucket and configure its RLS policies.
* **RLS verification:** Ensure every table has RLS enabled with explicit access policies.
* **OAuth provider setup:** 
  * **Google OAuth:** Configure Client ID and Secret in Supabase Auth settings. Set authorized redirect URIs.
  * **GitHub OAuth:** Configure Client ID and Secret in Supabase Auth settings. Set authorized redirect URIs.

## 7. Database Migration Workflow

* **Migration creation:** Generate `.sql` files using the Supabase CLI (`supabase migration new <name>`).
* **Migration review:** Peer review the SQL script for correctness and security (e.g., verifying RLS policies).
* **Migration execution:** Apply to staging (`supabase db push`) and then production via CI/CD.
* **Rollback procedure:** Identify the last stable migration state and issue a corrective migration. Manual rollbacks are discouraged.

**Rules:**
* **No manual production schema changes.** All schema alterations must exist in version control as a migration file.

## 8. Testing Workflow

* **Local Testing:** Manual verification of the feature against local Supabase instances.
* **Integration Testing:** Ensuring the Next.js frontend properly communicates with Supabase Auth, Database, and Storage.
* **Security Validation:** Verifying `AI-Agent-Security-Rules.md` adherence.
* **Pre-release Validation:** Executing the `Security-Audit-Checklist.md` against the staging environment.

**Requirements for Merge:**
* Build passes (`npm run build`).
* TypeScript passes (`tsc --noEmit`).
* Security checklist passes.

## 9. Pre-Deployment Checklist

Before merging to `main`, verify the following:
- [ ] Authentication flows (Email, Google, GitHub)
- [ ] Authorization middleware and RBAC
- [ ] Row Level Security (RLS) is active on all tables
- [ ] API payload validation via Zod
- [ ] Storage bucket policies and limits
- [ ] Rate limiting enforcement
- [ ] Monitoring endpoints are active
- [ ] Audit logging is capturing admin/moderator events
- [ ] Vercel Environment variables are correctly mapped
- [ ] Production Build Success

## 10. Production Deployment Process

* **Vercel deployment flow:** Code is merged into `main`, triggering an automatic Vercel deployment.
* **Production build:** Vercel installs dependencies, runs `npm run build`, and optimizes assets.
* **Environment verification:** Vercel validates that all required environment variables are present.
* **Domain verification:** Vercel maps the deployment to the custom production domain.
* **Deployment approval:** (Optional/If configured) Vercel awaits manual approval for `main` branch deployments.
* **Smoke testing:** Immediate post-deployment checks by the release manager to confirm system health.

## 11. Post-Deployment Validation

Immediately after production release, verify:
- [ ] Homepage renders correctly.
- [ ] Authentication (Login/Signup/Logout) functions.
- [ ] Opportunity Hub displays published listings.
- [ ] Tracker updates user applications successfully.
- [ ] Notifications trigger correctly.
- [ ] Profile management updates database rows.
- [ ] Community Submission Flow processes new entries.
- [ ] Moderation Flow allows approvals/rejections.
- [ ] Admin Operations execute correctly and write to `audit_logs`.
- [ ] Audit Logs reflect recent high-privilege actions.

## 12. Rollback Procedure

* **When rollback is required:** If a deployment introduces a critical regression, broken authentication, complete API failure, or an immediate security vulnerability.
* **How rollback is performed:** Use the **Vercel rollback process**. Navigate to the Vercel Dashboard -> Deployments -> Select the last known good deployment -> Click "Promote to Production" (or "Rollback").
* **How validation occurs after rollback:** Repeat the Post-Deployment Validation checklist (Section 11) to confirm stability. Investigate the faulty commit locally.

## 13. Incident Handling

* **Production outage:** Check Vercel status and Supabase status. Check Vercel runtime logs for 500 errors.
* **Database issues:** Check Supabase database health, connection limits, and query performance.
* **OAuth issues:** Verify Google/GitHub developer console credentials and callback URIs.
* **Broken deployment:** Initiate immediate Vercel Rollback (Section 12).
* **Security incident:** Immediately invalidate active sessions, rotate compromised secrets, and lock deployments.
* **Escalation process:** Notify the Engineering Lead and Security Consultant. Issue a post-mortem within 48 hours.

## 14. Release Freeze Rules

A deployment to production is **strictly blocked** if:
* Critical security findings exist.
* High severity findings exist.
* Authentication flows are broken.
* Row Level Security (RLS) fails or is disabled.
* The production build step fails.
* Database migrations fail to apply.

## 15. Release Sign-Off Checklist

- [ ] **Engineering Sign-Off:** Lead engineer confirms code quality and architecture.
- [ ] **Security Sign-Off:** Security checklist completed and approved.
- [ ] **Deployment Approval:** Staging environment verified by product owner.
- [ ] **Production Validation:** Smoke tests passed post-deployment.
- [ ] **Release Notes:** Documented user-facing changes published.

## 16. Success Criteria

Opportunity Radar is considered successfully released when:
* Production deployment succeeds without errors.
* Authentication (Email, Google, GitHub) works flawlessly.
* Search and filtering function correctly.
* The Application Tracker operates as expected.
* Moderation queue workflows function correctly.
* Admin operations execute and log properly.
* The Security Audit checklist passes.
* Zero critical issues remain in the backlog.

## 17. Release Freeze Status

Release-Deployment-Guide Version: v1.0

Status: Frozen

Ready For Development
## Definition of Done

A feature is considered complete only when:

- UI implemented
- Responsive on mobile and desktop
- TypeScript passes
- Lint passes
- Security rules followed
- RLS verified (if applicable)
- API validation implemented
- Error states implemented
- Loading states implemented
- Documentation updated (if required)
- Feature tested locally
- No critical or high severity findings exist