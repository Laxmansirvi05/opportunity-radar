# Opportunity Radar: Technical Discovery Report

## Executive Summary
This report presents a comprehensive discovery and architectural audit of **Opportunity Radar**, documenting its current state as a foundational opportunity aggregation platform. This analysis serves as the baseline for transforming the platform into a comprehensive **Student Career Operating System**.

---

## SECTION 1: CURRENT SYSTEM INVENTORY

The current platform is a Next.js (App Router) web application backed by Supabase.

### 1. Authentication & Onboarding
* **Status**: Complete
* **Frontend Pages**: `/(auth)/login`, `/(auth)/register`, `/(auth)/callback`
* **Backend APIs**: Supabase GoTrue Auth
* **Database Tables**: `profiles`, `auth.users`
* **External Services**: Supabase Auth

### 2. Opportunity Hub & Search
* **Status**: Complete
* **Frontend Pages**: `/(protected)/opportunities`, `/(protected)/search`, `/(protected)/hub`
* **Backend APIs**: Direct PostgREST queries, Next.js Server Actions
* **Database Tables**: `opportunities`, `companies`, `opportunity_tags`
* **External Services**: Supabase Database (PostgreSQL Full-Text Search)

### 3. Application Tracker
* **Status**: Complete
* **Frontend Pages**: `/(protected)/tracker`
* **Backend APIs**: Next.js Server Action (`tracker.ts`)
* **Database Tables**: `application_tracker`, `opportunities`
* **External Services**: None

### 4. User Profile Management
* **Status**: Complete
* **Frontend Pages**: `/(protected)/profile`, `/(protected)/settings`
* **Backend APIs**: Next.js Server Action (`settings.ts`)
* **Database Tables**: `profiles`
* **External Services**: Supabase Storage (Avatars)

### 5. Automated Data Ingestion
* **Status**: Complete (but architecturally constrained)
* **Frontend Pages**: None (Background Jobs)
* **Backend APIs**: `/api/cron/refresh-internshala`, `/api/cron/refresh-unstop`, `/api/cron/refresh-providers`
* **Database Tables**: `opportunities`, `companies`
* **External Services**: Vercel Cron, external provider APIs/websites

### 6. Moderation & Admin
* **Status**: Partial
* **Frontend Pages**: `/(protected)/dashboard`, `/admin`, `/moderation` (Features exist, UI incomplete/fragmented)
* **Backend APIs**: Supabase direct queries using RLS policies
* **Database Tables**: `reports`, `audit_log`, `opportunities` (status = 'Pending Review')
* **External Services**: None

---

## SECTION 2: DATABASE INVENTORY

The current database runs on PostgreSQL (Supabase).

### Existing Tables & Schema
1. **`profiles`**: `id`, `email`, `name`, `university`, `degree`, `graduation_year`, `skills` (text[]), `interests` (text[]), `resume_url`, `role` (student/moderator/admin), timestamps.
2. **`companies`**: `id`, `name`, `website_url`, `careers_url`, `industry`, `logo_url`, `description`, timestamps.
3. **`opportunities`**: `id`, `title`, `category`, `company_id`, `description`, `apply_url`, `location`, `mode`, `is_paid`, `experience_level`, `posted_at`, `deadline`, `status`, `source_type`, `submitted_by`, `report_count`, `skills`, `responsibilities`, recruiter info, `trust_score`, timestamps, `fts` (tsvector for search).
4. **`opportunity_tags`**: `opportunity_id`, `tag_name`.
5. **`bookmarks`**: `id`, `user_id`, `opportunity_id`, timestamps.
6. **`application_tracker`**: `id`, `user_id`, `opportunity_id`, `status` (Saved, Applied, Interview, etc.), `notes`, timestamps.
7. **`notifications`**: `id`, `user_id`, `type`, `message`, `is_read`, `related_opportunity_id`, timestamps.
8. **`reports`**: `id`, `opportunity_id`, `reported_by`, timestamps.
9. **`audit_log`**: `id`, `actor_id`, `actor_role`, `action`, `target_type`, `target_id`, `metadata`, timestamps.

### Missing Tables for Future OS Transition

* **Missing for AI Features**:
  * `ai_conversations`, `ai_messages` (Chatbot state)
  * `llm_generations_log` (Cost and rate-limit tracking)
* **Missing for Resume Features**:
  * `resumes` (Master record per user)
  * `resume_versions` (History of edits)
  * `resume_sections` (Structured JSON: Education, Experience, Projects)
  * `resume_feedback` (AI ATS scores and suggestions)
* **Missing for Interview Features**:
  * `mock_interviews` (Session tracking)
  * `interview_questions` (Bank of questions by role)
  * `interview_recordings` (Audio/video blob references)
  * `interview_feedback` (AI analysis on pacing, filler words, technical accuracy)
* **Missing for Recommendation Features**:
  * `user_preferences` (Desired roles, locations, minimum salary)
  * `recommendation_vectors` (pgvector table for embeddings)
  * `interaction_logs` (Clicks, views, dismissals for ML weighting)

---

## SECTION 3: API INVENTORY

The platform relies heavily on Supabase PostgREST for CRUD operations, supplemented by Next.js endpoints.

### API Routes
* **`/api/cron/health`**:
  * **Purpose**: System health check.
  * **Auth**: Public or Cron Secret.
* **`/api/cron/refresh-internshala`** | **`/api/cron/refresh-unstop`** | **`/api/cron/refresh-providers`**:
  * **Purpose**: Trigger ingestion pipelines to fetch external opportunities.
  * **Inputs**: Triggered via cron (GET/POST with auth header).
  * **Outputs**: Scraping status, row insertion counts.
  * **Auth**: Bearer token (Cron Secret).
  * **Performance Concerns**: HIGH. Running heavy web scrapers and data ingestion inside serverless functions will hit Vercel timeout limits (10s on hobby, 60s on pro).

### Next.js Server Actions (RPCs)
* **`tracker.ts`**:
  * **Purpose**: Update application status in the tracker.
  * **Inputs**: `opportunity_id`, `status`, `notes`.
  * **Auth**: Requires valid Supabase Server Session.
* **`settings.ts`**:
  * **Purpose**: Update user profile settings.
  * **Inputs**: Profile object (`skills`, `university`, etc.).
  * **Auth**: Requires valid Supabase Server Session.

---

## SECTION 4: INFRASTRUCTURE INVENTORY

### Current Architecture
* **Frontend Architecture**: Next.js 16.x App Router, React 19, Tailwind CSS v4. Highly modern stack utilizing server components and shadcn/base-ui.
* **Backend Architecture**: Serverless setup. Next.js API Routes handle backend logic, while direct Supabase PostgREST endpoints handle standard data fetching.
* **Database Architecture**: PostgreSQL (Supabase) leveraging Row Level Security (RLS) and triggers for complex workflows.
* **Search Architecture**: PostgreSQL Full-Text Search (FTS) via `to_tsvector` and `tsquery` on the `opportunities` table.
* **Authentication Architecture**: Supabase GoTrue (JWT-based). Session is passed securely to Next.js middleware to protect `/(protected)` routes.
* **Deployment Architecture**: Vercel for Frontend and API hosting. Supabase for database, auth, and storage.

### Infrastructure Limitations
1. **Ingestion Constraints**: Vercel Serverless is not designed for long-running web scraping or heavy data processing. The current cron setup is brittle.
2. **Search Bottleneck**: Postgres FTS is excellent for simple lookups, but lacks semantic understanding, typo tolerance, and complex faceting at scale compared to dedicated search engines.
3. **No Stateful AI Backend**: The current architecture has no provision for long-running AI inference, WebSocket connections (required for real-time voice interviews), or vector storage.

---

## SECTION 5: AI READINESS AUDIT

| Feature | Supported? | Existing Infrastructure | Missing Infrastructure | Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **1. Resume Parsing** | No | File storage for PDF resumes | PDF extraction service, structured DB schema, LLM extraction prompt | Medium |
| **2. ATS Scoring** | No | Opportunities table with required skills | Prompt pipeline to compare Resume JSON vs Opportunity JSON | Low |
| **3. Resume Generation** | No | Basic user profile fields | PDF/LaTeX rendering engine, dynamic block schema | High |
| **4. Resume Improvement** | No | None | Context-aware LLM rewrite pipeline, diff-view UI | Medium |
| **5. Opp. Recommendation** | Partial | Simple array overlap on `skills` column | `pgvector` for semantic search, embedding generation pipeline | Medium |
| **6. Personalized Feed** | Partial | Basic SQL filtering | Relevance ranking algorithm, interaction feedback loop | Medium |
| **7. Voice Interview** | No | None | WebRTC/WebSockets, Text-to-Speech (TTS), Speech-to-Text (STT) | Extreme |
| **8. Mock Interview** | No | None | Question generation LLM, State machine for chat logic | High |
| **9. Skill Gap Analysis** | No | `skills` array on profile | Knowledge graph mapping, missing skill identification logic | Medium |
| **10. Career Roadmap** | No | None | Multi-step LLM planning agents, hierarchical roadmap UI | High |

---

## SECTION 6: SCALABILITY AUDIT

### Current Capacity Estimates
* **Database**: PostgreSQL (Supabase default) easily handles ~10GB of data and thousands of concurrent connections.
* **API/Frontend**: Vercel Edge network scales almost infinitely for static and standard server-rendered pages.
* **Ingestion**: **Failing scale**. Will break if scraping target providers takes longer than the serverless execution limit.

### Scale Milestones
* **100 users/day**: No issues. Current architecture handles this effortlessly.
* **500 users/day**: No issues for read traffic. Postgres FTS indexes (`idx_opportunities_fts`) will keep search fast.
* **1000 users/day**: Read/Write is fine. However, if these 1,000 users upload PDFs for resume parsing, Vercel API limits and LLM rate limits will begin to bottleneck.
* **5000 users/day**: 
  * Postgres FTS will show significant latency degradation on complex queries. 
  * Connection pooling (PgBouncer/Supavisor) must be heavily utilized.
  * Real-time features (Notifications, AI Chats) will saturate standard WebSocket connection limits.

---

## SECTION 7: FUTURE PRODUCT TRANSFORMATION

Transitioning from an "Opportunity Aggregation Platform" to a "Student Career Operating System".

* **Modules to Reuse**: 
  * Authentication system.
  * Core database tables (`profiles`, `companies`, `opportunities`, `tracker`).
  * Current React component library (shadcn/base-ui is highly adaptable).
* **Modules to Redesign**:
  * **Dashboard**: Move from a "feed" to a "command center" (widgets for applications, upcoming interviews, AI roadmap progress).
  * **Search**: Migrate to semantic/vector search for natural language queries (e.g., "remote react jobs for freshmen").
  * **Profile**: Expand from a simple form to a comprehensive "Digital Portfolio" underlying the AI resume builder.
* **Modules to Remove**:
  * Vercel-based Serverless Ingestion (`/api/cron/*`).
* **Modules to Add**:
  * Vector Database (enable `pgvector` in Supabase).
  * Standalone Worker Service (for AI inference, web scraping, and PDF parsing).
  * Real-time WebSocket server (for voice/mock interviews).
  * Canvas/Editor UI (for building and editing generated resumes).

---

## SECTION 8: ARCHITECT RECOMMENDATIONS

If acting as CTO for the next iteration, my technical strategy would be:

### 1. What to Keep
* Keep **Supabase** as the primary source of truth (PostgreSQL + Auth + Storage).
* Keep **Next.js 16 & React 19** for the frontend, utilizing Server Components for performance.

### 2. What to Rebuild
* **Rebuild the Data Pipeline**: Move all scraping scripts out of Next.js `/api/cron` into a dedicated background worker environment (e.g., Python/Node workers on Railway, Render, or AWS ECS).
* **Rebuild Search**: Enable `pgvector` in Supabase. Generate embeddings for all opportunities and user profiles to allow for semantic matching and intelligent recommendations, rather than relying solely on keyword overlap.

### 3. What to Prioritize First
1. **Data Pipeline Stability**: Ensure the foundation (opportunities) is rock solid and decoupled from the frontend web server.
2. **AI Resume Parser & ATS Scorer**: This is the highest ROI feature. It immediately transitions the platform from a "job board" to a "career tool."
3. **OS Interface Redesign**: Revamp the UX to introduce the "Operating System" paradigm (sidebars, split views, widgets) before piling on new features.

### 4. Mandatory Architectural Changes
* **Enable Vector Storage**: Run `CREATE EXTENSION vector;` in Supabase immediately.
* **Asynchronous AI Processing**: Integrate a queue system (e.g., Redis + BullMQ or Inngest) for long-running AI tasks like Resume Generation and Roadmap creation to prevent frontend request timeouts.
* **Event-Driven Architecture**: Implement Webhooks/Database Triggers to auto-generate embeddings whenever a new opportunity is ingested or a user updates their profile.
