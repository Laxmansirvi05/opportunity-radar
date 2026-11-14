# Dead Code and Cleanup Candidates — Opportunity Radar

Audit date: 14 Nov 2026 · Commit `d9d74e0`.
**Nothing has been deleted.** This is a proposal list for review.

Method: `npx knip@5.66.0` (reported 145 unused files, 10 unused dependencies, 72 unused exports), then a manual check of each candidate:
- static imports via `grep`,
- dynamic `import()` usage,
- tests that import it,
- npm scripts,
- the Next.js file-system routing convention (routes count as used only if something calls them).

knip false positives that were **excluded**:
- `proxy.ts` (Next 16 middleware entry point)
- `packages/*/vitest.config.ts` (package-local configs)
- Lingui-dependent tests

Classification key: **DU** = definitely unused · **PU** = probably unused · **INF / CFG / TEST / FEAT** = required for infrastructure / configuration / testing / an active feature · **MAN** = needs manual investigation.

## A. Proposed deletion list (highest confidence first)

| # | Path | Why it looks unnecessary | Static importers | Dynamic refs | Tests depend? | Scripts? | Size | Risk | Class | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `frontend/features/resume-toolkit/components/engine/` (22 files) | Old résumé renderer; superseded by `features/resume/*` + `@react-pdf` | none outside itself | none | no | no | 108 KB | Low. Also removes 12 unsanitised `dangerouslySetInnerHTML` sinks | **DU** | Delete |
| 2 | `frontend/features/resume-toolkit/components/builder/` (5 files) | Old builder UI | none | none | no | no | 84 KB | Low | **DU** | Delete |
| 3 | `frontend/features/resume-toolkit/lib/schema/{index,page,icons}.ts`, `resume/{index,sample}.ts` | Only used by #1/#2 | none (knip) | none | no | no | small | Low | **DU** | Delete with #1/#2 |
| 4 | `frontend/app/api/ats/analyze/route.ts` + `frontend/lib/ats-engine/` | Duplicate ATS engine (v1); the UI uses `/api/resume/ats-check` + `lib/ats-checker` | route has no frontend caller | none | `tests/ats-engine.test.ts` | no | 36 KB | Low–Med: confirm no external client (mobile app, script) calls it | **PU** | Delete route + engine + its test |
| 5 | `frontend/app/api/resume/optimize/route.ts` | Bullet rewriter (AI cost); superseded by `/api/resume/optimization` | no caller | none | no | no | 8 KB | Low–Med | **PU** | Delete |
| 6 | `frontend/app/api/resume/save/route.ts`, `frontend/app/api/resume/upload/route.ts` | No frontend caller | none | none | no | no | 16 KB | Medium: confirm with the owner | **PU** | Delete after confirmation |
| 7 | `frontend/src/providers/opportunities/ingestion/QueueProducerService.ts`, `QueueConsumerService.ts`, `frontend/scripts/run-producer.ts`, `run-worker.ts`, `run-cron.ts` (+ npm `cron:consume`) | Queue architecture never adopted: `ingestion_queue` has 0 rows, crons call `runPipeline` directly | only scripts | none | no | `cron:consume` | ~30 KB | Low. **But** a queue is the planned fix for ingestion timeouts (see roadmap); decide first | **MAN** | Keep until the ingestion redesign decision |
| 8 | `frontend/lib/recommendation-engine/` | Not imported by the dashboard or any route | none (tests only) | none | `tests/recommendation-engine.test.ts` | no | 20 KB | — | **MAN** | **Do not delete; wire it into the dashboard** (personalisation is a core need) |
| 9 | `frontend/lib/resume-parser/parser.ts` | Unused file (schema + pdf-extractor are used) | none | none | no (`tests/resume-parser.test.ts` imports only `schema` and `pdf-extractor`) | no | 4 KB | Low | **DU** | Delete |
| 10 | `frontend/src/providers/opportunities/providers/UnstopCompetitionsProvider.ts` | Not wired to any cron | none | none | no | no | 12 KB | — | **MAN** | **Do not delete; wire it in** (competitions/scholarships are under-supplied: 13 and 2 live) |
| 11 | `frontend/components/animation/count-up.tsx`, `components/input/github-stars-button.tsx`, `components/ui/{accordion,avatar,dropdown-menu}.tsx`, `features/opportunities/components/opportunity-detail/back-button.tsx` | Unused UI | none | none | no | no | small | Low | **DU** | Delete |
| 12 | `frontend/packages/ui/src/components/{alert,card,checkbox,context-menu,progress,sheet,sidebar,skeleton,tabs}.tsx`, `packages/ui/src/hooks/*` (5), `packages/utils/src/{date,level,rate-limit,sanitize,url,html,monorepo.node,url-security.node}.ts`, `packages/schema/src/{page,resume/analysis}.ts`, `packages/resume/src/{icons,patch}.ts`, `packages/pdf/src/server.tsx` | Vendored Reactive Resume code never imported | none | none | their own (never-run) tests | no | part of 1.7 MB `packages/` | Low | **DU** | Delete with their tests. Keep the licence (see C) |
| 13 | 55 `*.test.ts` files under `features/`, `libs/`, `packages/`, `lib/` | **Never executed** (vitest `include` mismatch) | — | — | — | — | — | — | **MAN** | Either add them to vitest `include` (and fix what fails) or delete them together with the dead code they test. Do not leave silent tests |
| 14 | `frontend/public/templates/pdf/` (15 PDFs) | No code references `templates/pdf` | none | none | no | no | **4.5 MB** | Low | **PU** | Delete (the JPG previews *are* used) |
| 15 | `frontend/features/resume/public/{pdf-viewer,public-resume}.tsx`, `features/resume/preview/{pdf-thumbnail,resume-thumbnail.shared}.ts`, `features/resume/lib/{make-section-item,section-actions}.ts`, `libs/resume/{move-item,section-title}.ts` | Unused (public résumé sharing never shipped) | none | none | never-run tests | no | small | Low | **DU** | Delete |
| 16 | `frontend/lib/supabase/check-session.ts`, `lib/landing/utils.ts`, `lib/ai-gateway/types.ts` | Unused | none | none | no | no | small | Low | **DU** | Delete |
| 17 | 72 unused exports (see knip) | e.g. `lib/certifications/ingest.ts` exports 17 fetchers used only internally | — | — | — | — | — | None | — | Un-export, no deletion |

**Estimated reduction:** about 6–7 MB of repository content (4.5 MB PDFs, ~1 MB vendored packages, ~0.3 MB source), plus 4 deployed API endpoints and roughly 120 files.

## B. Unused dependencies (knip, verified by grep)

| Package | Type | Evidence | Action |
|---|---|---|---|
| `dompurify` | dep | no import (also has a **critical** advisory) | Remove |
| `fast-json-patch` | dep | no import | Remove |
| `@phosphor-icons/web` | dep | no import (`@phosphor-icons/react` is used) | Remove |
| `@fontsource-variable/ibm-plex-sans` | dep | `@import` at `app/globals.css:4` | **CFG**: keep (knip false positive) |
| `tw-animate-css` | dep | `@import` at `app/globals.css:2` | **CFG**: keep (knip false positive) |
| `tailwindcss` | devDep | Tailwind v4 via `@tailwindcss/postcss` | **CFG**: keep |
| `@tailwindcss/typography` | devDep | **no `@plugin` in `globals.css`**, so `prose` classes used in markdown/notes render unstyled | MAN: either register the plugin (if `prose` styling is intended) or remove |
| `@lingui/swc-plugin` | devDep | referenced in `next.config.ts` | **CFG**: keep (knip false positive) |
| `shadcn` | devDep | CLI tool only; pulls vulnerable `deepmerge`/`zod` | Remove or move to `npx` usage |
| `@typescript/native-preview` | devDep | not used by any script | Remove |
| Unlisted: `@splinetool/runtime`, `@tiptap/core` | — | imported but not declared (transitive) | **Add** to `package.json` explicitly |

## C. Repository-level clutter

| Path | Size | Purpose | Recommendation |
|---|---|---|---|
| `designs/` (20 design folders + `DESIGN.md`) | 7.7 MB | Stitch design exports, including screens never built (moderation-center, submit_opportunity, company-intelligence, trust dashboard) | Move to a separate design repo or Git LFS. **MAN** |
| `project-report/`, `design-resume-library/` | 2.3 MB + 2.2 MB | Generated HTML reports and canvases | Move out of the app repo. **MAN** |
| `docs/` (18 files) | 508 KB | PRD/TRD/plans. Several are stale vs code (e.g. claims of features never shipped) | Keep; mark stale docs. **MAN** |
| `designs/.DS_Store`, `docs/.DS_Store` | tiny | tracked despite `.gitignore` | Remove from index |
| `supabase/seed.sql` | 125 lines | fake listings under real brand names | Keep for local only; rename `seed.local.sql`, document "never run on prod" |
| Vendored `packages/*` (Reactive Resume) | 1.7 MB | **No LICENSE / NOTICE retained** | Add the upstream licence notice (Reactive Resume is understood to be MIT; verify) before any cleanup. **Licence obligation** |

## D. Do NOT remove (looks unused, but is required)

- `proxy.ts`: Next 16 middleware.
- `instrumentation.ts`: Next instrumentation hook.
- `frontend/.env.example`: documents required variables.
- `supabase/migrations/*`: even unrecorded ones (reconcile, don't delete).
- `lib/recommendation-engine`, `UnstopCompetitionsProvider`: unused today, but they serve the core vision; wire them in.
- `app/api/cron/health/route.ts`: unscheduled, but useful. Add it to `vercel.json` or an uptime monitor rather than deleting it.
