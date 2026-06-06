# Opportunity Radar Architecture

## Overview
Opportunity Radar utilizes a modular, feature-based architecture built on the Next.js 15 App Router and powered by Supabase.

## Frontend Architecture (`frontend/`)

- **`app/`**: Next.js App Router definitions. Handles all routing, layouts, and page-level server/client rendering boundaries.
- **`proxy.ts`**: Handles Next.js edge middleware (e.g., Supabase session refresh). Note: Replaces `middleware.ts` per Next.js 16.2+ conventions.
- **`components/`**: UI components categorized by responsibility.
  - `ui/`: shadcn/ui primitive components.
  - `shared/`: Generic components used across features (e.g., Headers, Footers).
  - `layouts/`: Page layout wrappers.
  - `providers/`: Context providers (e.g., React Query, Theme).
- **`features/`**: Domain-driven feature slices. Each domain (auth, opportunities, tracker, etc.) encapsulates its own specific logic, hooks, and local components.
- **`lib/`**: Core utilities and configurations.
  - `supabase/`: Supabase client singletons and server utilities (`@supabase/ssr`).
  - `utils/`: Helper functions.
  - `validations/`: Zod schemas for all API and form validation.
- **`types/`**: Global TypeScript definitions.

## Backend Architecture (`backend/`)

- **`migrations/`**: Version-controlled Supabase SQL migration files to safely manage database schema evolution.
- **`seeds/`**: Seed scripts for local database population.
- **`policies/`**: Standalone documentation or SQL snippets representing RLS logic definitions prior to migration.

## Security & Access
Security is strictly enforced via Row Level Security (RLS) policies at the database layer and server-side authorization checks within Next.js Route Handlers. Role-Based Access Control (RBAC) spans Students, Moderators, and Admins.

For detailed documentation, refer to `TRD.md` and `Security-Plan.md`.
