# AI Voice Interview — Integration Contract

**For the team building the voice interview module.** This is what Opportunity
Radar can provide, what it expects back, and the constraints your module has to
live inside. Building to this means the handover is a drop-in; building around
it means rework.

Written the same way the internship agent's own `INTEGRATION_GUIDE.md` was
written for us — concrete, and honest about limits.

---

## 1. What Opportunity Radar is

Next.js 16 (App Router) on Vercel · Supabase (Postgres + Auth + Storage) ·
Tailwind v4 with a Material-3 token set · deployed at
`opportunity-radar-six.vercel.app`.

Students sign in with Supabase Auth. Every page under `app/(protected)/` is
gated twice — once optimistically in `proxy.ts`, once authoritatively in the
route group's layout.

---

## 2. Deliver a folder, not a project

Ideal shape:

```
voice-interview/
├── components/          # client components, default-exported
├── lib/                 # provider clients, scoring, prompts
├── api/                 # route handlers we can mount under app/api/interview/
├── migrations/          # SQL for any tables you need
└── README.md            # env vars, how to run, how to test
```

Please do **not** ship: your own auth, your own Supabase client bootstrap, a
second Tailwind config, or a `package.json` that pins different React/Next
majors. We will wire those up.

---

## 3. What we give you

### Session and identity
Use our server client — never construct your own:

```ts
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

Assume `user` is present in any protected route; the layout has already
enforced it. Still check it in API routes — those are not covered by the layout.

### The student's resume
Already in the system, so do not build another uploader:

- `resumes` table — `id, user_id, file_url, file_name, parsed_data, status`
- `parsed_data` is structured JSON: `name, email, skills[], experience[],
  education[], projects[]`
- PDFs live in the private `resumes` storage bucket; use `createSignedUrl`

Prefer `parsed_data` over re-parsing the PDF. It is already extracted.

### LLM access
Use our gateway rather than calling a provider directly:

```ts
import { callAI } from '@/lib/ai-gateway'
const res = await callAI(
  { systemPrompt, userPrompt, outputFormat: 'json', maxTokens: 2000 },
  { feature: 'voice_interview', userId: user.id }
)
```

It handles provider failover across Gemini → OpenRouter → Groq → Cloudflare →
Ollama, health-based circuit breaking, timeouts and usage logging. Add
`voice_interview` to `RATE_LIMITS` in `lib/ai-gateway/index.ts` with a sensible
per-student cap.

### Design tokens
Use the semantic classes, never raw hex — the codebase already has 163
hardcoded colours we are trying not to add to:

`bg-surface` · `bg-surface-container-lowest` · `text-on-surface` ·
`text-on-surface-variant` · `border-outline-variant` · `bg-primary` ·
`text-on-primary` · `bg-error-container` · `text-on-error-container`

Icons are Material Symbols: `<span className="material-symbols-outlined">mic</span>`

---

## 4. Constraints you must design around

### Vercel cannot hold a long connection
Serverless functions are request/response with a hard ceiling — **300s on
Hobby**. A 10–15 minute interview cannot live inside one invocation.

Two workable shapes:

1. **Turn-based (recommended).** Browser captures speech → sends text → API
   returns the next question → browser speaks it. Each call is short, so it
   runs on Vercel unchanged. Uses the Web Speech API, which costs nothing.
2. **Realtime streaming.** Needs a persistent WebSocket/WebRTC session, which
   means a separate always-on host. Materially more expensive to run.

**We are deploying for demonstration on free tiers. Choose (1) unless there is a
reason (2) is essential** — and if it is, say so early, because it changes
hosting.

### Microphone requires HTTPS
`getUserMedia` only works in a secure context. Fine on `vercel.app` and
`localhost`; it will silently fail over plain HTTP on an IP address.

Already prepared on our side:
- `Permissions-Policy: microphone=(self)`
- CSP `connect-src` allows `blob:` and `wss://*.supabase.co`; `media-src`
  allows `self blob: data:`

**If you need another origin — a speech or realtime provider — tell us the exact
hostnames.** CSP will block them otherwise, and the failure looks like a bug in
your code rather than a policy problem.

### Browser support
The Web Speech API's recognition half is Chrome/Edge only. Acceptable for a
demo, but detect it and show an honest message rather than a broken mic button.

---

## 5. Interface we expect

### Route
We will mount your entry component at `/interview`. Export a default client
component taking no required props:

```tsx
export default function VoiceInterview() { /* … */ }
```

### API routes
Anything under `api/` we mount at `app/api/interview/*`. Each must resolve the
session itself and return 401 without one.

### Storage
If you persist sessions, ship a migration following our conventions:

```sql
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id  UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    /* … */
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sessions"
  ON public.interview_sessions FOR SELECT USING (auth.uid() = user_id);
```

**RLS on every table, keyed on `auth.uid()`.** Also filter by `user_id`
explicitly in queries — RLS is the backstop, not the only control.

### The scored report
Whatever shape you use, it must include enough to render honestly:

```ts
interface InterviewReport {
  overall_score: number          // 0–100
  dimensions: { name: string; score: number; comment: string }[]
  strengths: string[]
  improvements: string[]
  transcript: { role: 'interviewer' | 'candidate'; text: string; at: string }[]
}
```

---

## 6. Two rules we will hold you to

These are the mistakes that have already cost this project real time.

**1. Never fabricate.** Nine ingestion providers in this repo turned out to
generate synthetic listings when their source was unreachable — fake companies,
dead apply links. All nine were deleted. If a provider fails, return an error or
an empty result. Never invent a score, a question, or feedback.

**2. Never show a placeholder as data.** If a dimension could not be scored,
omit it or say so. Do not render `0`, `N/A` or a stubbed score as though it were
a measurement. A student acting on a fabricated interview score is worse than a
student seeing nothing.

---

## 7. Checklist before handover

- [ ] Runs on Vercel with no persistent connection, or its hosting need is stated
- [ ] Uses `@/lib/supabase/server` and `@/lib/ai-gateway`, not its own clients
- [ ] Every API route checks the session and returns 401 without one
- [ ] Migrations include RLS keyed on `auth.uid()`
- [ ] Design tokens only — no hardcoded hex
- [ ] Any extra origins needed for CSP are listed in the README
- [ ] Graceful message on browsers without speech recognition
- [ ] Nothing fabricated when a provider fails
- [ ] README lists every env var it needs
