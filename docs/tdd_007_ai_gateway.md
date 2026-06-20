# TDD-007: AI Gateway Layer
**Project:** Opportunity Radar V2
**Stack:** Next.js 16, TypeScript, Supabase PostgreSQL
**Purpose:** Centralised AI infrastructure — single interface for all AI calls across the platform
**Version:** 1.0

---

## SECTION 1: FEATURE OVERVIEW

### Purpose

All AI calls in Opportunity Radar V2 (Resume Optimizer, Skill Extraction) must flow through a single, centralised AI Gateway. This prevents provider lock-in, enables seamless failover between Gemini and Groq, enforces rate limits, tracks costs, and provides a single place to add monitoring, logging, and future provider support.

Without a Gateway, each feature would implement its own retry logic, timeout handling, and provider switching — creating fragmented, hard-to-maintain code.

### Consumers

| Consumer | TDD | Use Case |
| :--- | :--- | :--- |
| Resume Optimizer | TDD-004 | Bullet point rewriting (STAR format) |
| Skill Extraction | TDD-006 | Job description keyword extraction |

### Non-Consumers (By Design)

- ATS Engine: Deterministic. No AI.
- Recommendation Engine: Deterministic. No AI.
- Application Tracker: No AI.

### Success Criteria

* All AI features use the Gateway exclusively (no direct provider SDK calls outside Gateway).
* Failover from Gemini to Groq is automatic and transparent to the caller.
* Cost per provider is visible in the `ai_usage_log` table within 1 minute of the call.
* Adding a new AI provider requires changes to ONE file only.

---

## SECTION 2: PROVIDER INTERFACE

### Core TypeScript Interface

```typescript
// lib/ai-gateway/types.ts

export interface AIRequest {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number      // Default: 500
  temperature?: number    // Default: 0.3 (low for deterministic-ish output)
  format?: 'text' | 'json'
}

export interface AIResponse {
  content: string
  provider: 'gemini' | 'groq'
  model: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  latencyMs: number
  success: true
}

export interface AIError {
  success: false
  provider: 'gemini' | 'groq' | 'all'
  reason: 'timeout' | 'rate_limit' | 'invalid_response' | 'provider_error' | 'all_failed'
  latencyMs: number
}

export type AIResult = AIResponse | AIError
```

### Gateway Function Signature

```typescript
// lib/ai-gateway/index.ts

export async function callAI(
  request: AIRequest,
  context: {
    feature: 'resume_optimizer' | 'skill_extraction'
    userId?: string
    opportunityId?: string
  }
): Promise<AIResult>
```

---

## SECTION 3: SERVICE ARCHITECTURE

### File Structure

```
lib/
  ai-gateway/
    index.ts          ← Main entry point: callAI()
    types.ts          ← Interfaces (above)
    providers/
      gemini.ts       ← Gemini Flash adapter
      groq.ts         ← Groq Llama-3 adapter
    middleware/
      rate-limiter.ts ← Per-user and global rate limiting
      logger.ts       ← Writes to ai_usage_log table
    config.ts         ← Provider settings, timeouts, costs
```

### Main Gateway Logic (`index.ts`)

```typescript
export async function callAI(request: AIRequest, context: GatewayContext): Promise<AIResult> {
  // 1. Check rate limit
  const rateLimitResult = await checkRateLimit(context.userId, context.feature)
  if (!rateLimitResult.allowed) {
    return { success: false, reason: 'rate_limit', provider: 'all', latencyMs: 0 }
  }

  // 2. Try primary provider (Gemini)
  const geminiResult = await callGemini(request)
  if (geminiResult.success) {
    await logUsage(geminiResult, context)
    return geminiResult
  }

  // 3. Fallback to Groq
  console.warn(`[AI Gateway] Gemini failed (${geminiResult.reason}). Falling back to Groq.`)
  const groqResult = await callGroq(request)
  if (groqResult.success) {
    await logUsage(groqResult, context)
    return groqResult
  }

  // 4. Both failed
  await logUsage({ ...groqResult, provider: 'all' }, context)
  return { success: false, reason: 'all_failed', provider: 'all', latencyMs: geminiResult.latencyMs + groqResult.latencyMs }
}
```

---

## SECTION 4: PROVIDER ADAPTERS

### Gemini Adapter (`providers/gemini.ts`)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function callGemini(request: AIRequest): Promise<AIResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)  // 10,000ms

  try {
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: request.systemPrompt + '\n\n' + request.userPrompt }] }
      ],
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 500,
        temperature: request.temperature ?? 0.3,
      }
    })

    clearTimeout(timeout)
    const text = result.response.text()
    const usage = result.response.usageMetadata

    return {
      success: true,
      content: text,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      tokensUsed: {
        input: usage?.promptTokenCount ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
        total: usage?.totalTokenCount ?? 0
      },
      latencyMs: Date.now() - start
    }
  } catch (err: any) {
    clearTimeout(timeout)
    return {
      success: false,
      provider: 'gemini',
      reason: err.name === 'AbortError' ? 'timeout' : 'provider_error',
      latencyMs: Date.now() - start
    }
  }
}
```

### Groq Adapter (`providers/groq.ts`)

```typescript
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function callGroq(request: AIRequest): Promise<AIResult> {
  const start = Date.now()

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt }
      ],
      max_tokens: request.maxTokens ?? 500,
      temperature: request.temperature ?? 0.3,
    }, { timeout: GROQ_TIMEOUT_MS })  // 8,000ms

    const content = completion.choices[0]?.message?.content ?? ''
    const usage = completion.usage

    return {
      success: true,
      content,
      provider: 'groq',
      model: 'llama3-8b-8192',
      tokensUsed: {
        input: usage?.prompt_tokens ?? 0,
        output: usage?.completion_tokens ?? 0,
        total: usage?.total_tokens ?? 0
      },
      latencyMs: Date.now() - start
    }
  } catch (err: any) {
    return {
      success: false,
      provider: 'groq',
      reason: 'provider_error',
      latencyMs: Date.now() - start
    }
  }
}
```

---

## SECTION 5: LOGGING

### `ai_usage_log` Table

```sql
CREATE TABLE ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature         TEXT NOT NULL,          -- 'resume_optimizer' | 'skill_extraction'
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL,          -- 'gemini' | 'groq' | 'all'
  model           TEXT,
  tokens_input    INT DEFAULT 0,
  tokens_output   INT DEFAULT 0,
  tokens_total    INT DEFAULT 0,
  latency_ms      INT,
  success         BOOLEAN NOT NULL,
  failure_reason  TEXT,
  estimated_cost  NUMERIC(10, 8),         -- USD
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_log_feature ON ai_usage_log(feature, created_at DESC);
CREATE INDEX idx_ai_log_user ON ai_usage_log(user_id, created_at DESC);
```

### Cost Calculation on Log Write

```typescript
function estimateCost(provider: string, tokensInput: number, tokensOutput: number): number {
  if (provider === 'gemini') {
    return (tokensInput * 0.000000075) + (tokensOutput * 0.0000003)
  }
  if (provider === 'groq') {
    return 0  // Free tier for MVP
  }
  return 0
}
```

---

## SECTION 6: MONITORING

### Daily Health Dashboard Query

```sql
SELECT
  DATE(created_at)        AS day,
  feature,
  provider,
  COUNT(*)                AS requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successes,
  ROUND(AVG(latency_ms))  AS avg_latency_ms,
  SUM(estimated_cost)     AS total_cost_usd
FROM ai_usage_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), feature, provider
ORDER BY day DESC, feature;
```

### Alert Thresholds

| Metric | Alert Trigger |
| :--- | :--- |
| Gemini success rate < 90% over 1 hour | Switch default to Groq temporarily |
| Daily AI cost > $5 | Email alert to admin |
| P95 latency > 8s | Investigate + reduce prompt length |
| `all_failed` count > 10 in 1 hour | Page on-call (future) |

---

## SECTION 7: RATE LIMITING

### Strategy: Database-Backed Counter (MVP)

For MVP, rate limits are enforced by counting recent rows in `ai_usage_log` per user per feature per window. This is simple and requires no additional infrastructure.

```typescript
async function checkRateLimit(
  userId: string | undefined,
  feature: 'resume_optimizer' | 'skill_extraction'
): Promise<{ allowed: boolean; remaining: number }> {
  if (!userId) return { allowed: true, remaining: 999 }  // Server-side (extraction pipeline)

  const limits = {
    resume_optimizer: { max: 20, windowHours: 24 },
    skill_extraction: { max: 999, windowHours: 1 },  // No real user limit
  }

  const { max, windowHours } = limits[feature]
  const windowStart = new Date(Date.now() - windowHours * 3600 * 1000)

  const { count } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('success', true)
    .gte('created_at', windowStart.toISOString())

  const used = count ?? 0
  return { allowed: used < max, remaining: Math.max(0, max - used) }
}
```

**Future upgrade path:** Replace DB counter with Upstash Redis for sub-millisecond rate limit checks at high scale.

---

## SECTION 8: SECURITY

- **API Keys:** `GEMINI_API_KEY` and `GROQ_API_KEY` stored in environment variables (Vercel env for production, `.env.local` for development). Never committed to source control.
- **Server-Side Only:** Gateway is a server-side module. No API keys are ever sent to the client.
- **Prompt Isolation:** Each call receives an isolated prompt object. No shared mutable state between concurrent calls.
- **Log Privacy:** `ai_usage_log` never stores prompt text or response content — only metadata (tokens, latency, cost). No PII stored.
- **RLS on `ai_usage_log`:** Users can only read their own rows. Admin role can read all.

```sql
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_log_own" ON ai_usage_log
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
```

---

## SECTION 9: COST CONTROLS

### Hard Limits

1. **Per-user daily limit** (20 calls/day for resume_optimizer) prevents runaway costs from a single user.
2. **Gemini API Budget Alert** at $20/month via Google Cloud console.
3. **Daily cost query** in monitoring section surfaces unexpected spikes.

### Environment Configuration (`config.ts`)

```typescript
export const GATEWAY_CONFIG = {
  gemini: {
    model: 'gemini-1.5-flash',
    timeoutMs: 10_000,
    maxRetries: 1,
    costPer1MInputTokens: 0.075,
    costPer1MOutputTokens: 0.30,
  },
  groq: {
    model: 'llama3-8b-8192',
    timeoutMs: 8_000,
    maxRetries: 0,
    costPer1MInputTokens: 0,  // Free tier
    costPer1MOutputTokens: 0,
  }
}
```

---

## SECTION 10: IMPLEMENTATION PLAN

**Estimated Effort:** 3 Days (must be built FIRST before TDD-004 and TDD-006)

1. **Day 1: Core Types + Adapters**
   - Create `lib/ai-gateway/` folder structure.
   - Implement `types.ts`, `config.ts`.
   - Implement `providers/gemini.ts` and `providers/groq.ts`.
   - Test both adapters in isolation with sample prompts.

2. **Day 2: Gateway + Middleware**
   - Implement `index.ts` with failover logic.
   - Implement `middleware/logger.ts`.
   - Create `ai_usage_log` table in Supabase.
   - Implement `middleware/rate-limiter.ts`.

3. **Day 3: Integration Testing**
   - Write integration tests simulating Gemini timeout → Groq fallback.
   - Verify `ai_usage_log` rows are written correctly for both success and failure cases.
   - Verify cost calculation is correct against known token counts.

**This TDD must be fully implemented before TDD-004 or TDD-006.**

---

## SECTION 11: CTO REVIEW

**Approved:**
- Single Gateway module: non-negotiable. Provider sprawl is a maintenance disaster.
- Database-backed rate limiting for MVP: correct. Redis is premature optimization.
- Logging without storing prompt/response text: correct. Privacy-first architecture.
- Groq free tier as fallback: correct. Zero cost redundancy is the right choice at student-team scale.
- `temperature: 0.3` as default: correct. Low temperature produces more consistent, reproducible outputs.

**Rejected:**
- OpenAI as a provider: three providers is too many for MVP. Two is the right number for a student team to manage.
- Streaming responses: adds complexity. For bullet rewriting (< 200 output tokens), streaming provides no meaningful UX benefit. Rejected.
- Redis rate limiting at MVP: premature. DB counter handles 1,000 users easily.

**Risks:**
- Groq free tier has monthly token limits: Monitor. If exceeded, Groq calls will fail and there is no tertiary fallback. Mitigation: Set Groq usage alert at 50% of free tier.
- Both providers could be down simultaneously: Accepted risk. Extremely rare. User sees error toast; no data is lost.

**Verdict: ✅ Cleared for implementation. Build this FIRST.**
