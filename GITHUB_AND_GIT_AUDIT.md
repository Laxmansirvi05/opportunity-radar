# Git and GitHub Audit — Opportunity Radar

Audit date: 14 Nov 2026 · Method: read-only git commands, plus a read-only Vercel deployment listing.

## Important scope note

This audit ran in a **fresh cloud clone** of `github.com/Laxmansirvi05/opportunity-radar`, not on the developer's own laptop. Anything that exists only on the developer's machine (uncommitted edits, unpushed branches, a `.env.local`) is **invisible here and NOT TESTED**. To check that, run the commands in the last section on the laptop.

## Summary table

| Metric | Result |
|---|---|
| Total project files (excl. `.git`, `node_modules`, `.next`) | 1,013 |
| Git-tracked files | 1,011 |
| Untracked files | 0 |
| Modified files | 0 |
| Staged files | 0 |
| Deleted files | 0 |
| Total commits (all branches, after `git fetch --unshallow`) | 371 (first commit 4 Jun 2026) |
| Commits ahead of GitHub (`HEAD...origin/main`) | 0 |
| Commits behind GitHub | 0 |
| Local unpushed work | None in this clone |
| Remote-only work | None on `main`; one remote branch exists for this audit session |
| Current branch | `claude/practical-cray-iye6a1` (created from `main`) |
| Remote repository | `https://github.com/Laxmansirvi05/opportunity-radar` |
| Default branch | `main` |
| Latest local commit | `d9d74e0` — 2026-10-09 21:28 IST — "Merge pull request #9 … fix/assistant-provider-order" |
| Latest remote commit | `d9d74e0` (identical) |
| Git synchronization | **In sync** (0 ahead / 0 behind) |
| Pack size | 21.25 MiB |

## Deployment distinction (verified, read-only)

| Item | Value | Evidence |
|---|---|---|
| Provider | Vercel, project `opportunity-radar` | `frontend/vercel.json`, Vercel project listing |
| Production branch | `main` | deployment meta `githubCommitRef: main` |
| Current production deployment | `dpl_BS8v9is1wHbsaF7uBpVTC8vwFAaA`, state READY | Vercel `list_deployments` (production) |
| Commit deployed | `d9d74e07e445…` | deployment meta `githubCommitSha` |
| Matches repo HEAD? | **Yes** | same SHA |
| Function region | `iad1` (US East) | live response header `x-vercel-id: iad1::iad1::…` |

No deployment was started.

## Commit quality

| Question | Finding |
|---|---|
| Committed regularly? | Yes from Jun to Oct 2026 (Aug 23, Sep 31, Oct 36 commits on `main`). **No commits since 9 Oct 2026 (5 weeks).** |
| Meaningful messages? | Yes. Conventional-commit style (`fix(scope): …`) with descriptive bodies. |
| Major features in history? | Yes: ingestion, ATS, notes, hub, interview, resume builder all appear. |
| Unfinished changes? | None in this clone. |
| Large files committed? | No single large binary found; `.DS_Store` files are tracked (`designs/.DS_Store`, `docs/.DS_Store`) despite being in `.gitignore`. |
| Secrets in history? | **None found.** Pattern scan across all 371 commits (JWT, Google `AIza…`, Groq `gsk_`, OpenRouter `sk-or-`, Supabase `sb_secret_`, GitHub `ghp_`, PEM private keys, `SERVICE_ROLE_KEY=ey…`). Only hits were test fixtures (`'verif…'`, `'Secur…'`) in test files. |
| Lockfile committed? | Yes, `frontend/package-lock.json`. `npm ci` succeeded, so it agrees with `package.json`. |
| Deployment/config files tracked? | Yes: `vercel.json`, `next.config.ts`, `.github/workflows/ci.yml`, `.env.example`. |

## Findings

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| GIT-01 | Medium | **The database schema is not reproducible from the repo.** 18 migration files in `supabase/migrations/` are not recorded in the production migration history; several were applied by hand under different timestamps. 2 migrations in production (`note_folder_counts_view`, `deepinterview_sessions_grants`) have no file in the repo. | `list_migrations` compared with filenames (see the database audit) |
| GIT-02 | Medium | A committed migration was **never applied**: `20260816090000_fix_new_user_name_metadata_key.sql`. Production `handle_new_user()` still reads only `raw_user_meta_data->>'name'`. | `pg_get_functiondef('handle_new_user')` |
| GIT-03 | Low | `supabase/config.toml`, `supabase/seed.sql` and two `.DS_Store` files are tracked even though `.gitignore` lists them. They contain no secrets: `seed.sql` holds fictional demo companies and `config.toml` holds local-dev defaults. | `git ls-files -i --exclude-standard -c` |
| GIT-04 | Low | `seed.sql` seeds fake opportunities for real brand names (Google, OpenAI …) with `logo.clearbit.com` logos. It is harmless locally, but must never run against production. | `supabase/seed.sql` |
| GIT-05 | Info | CI (`.github/workflows/ci.yml`) runs `npm ci`, type-check, unit tests and lint on PRs. It does **not** run `next build` or Playwright e2e, so a build-only break would still reach `main`. | ci.yml |

## Commands to run on the developer laptop (not executed here)

```bash
git status --short
```

```bash
git fetch origin && git rev-list --left-right --count HEAD...origin/main
```

```bash
git stash list
```

```bash
git branch -vv
```
