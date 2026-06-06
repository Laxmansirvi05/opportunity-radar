# Opportunity Radar

Opportunity Radar is a student-focused SaaS application built to help students discover, evaluate, track, and contribute career opportunities without information overload.

## Architecture

The project strictly follows a feature-driven Next.js App Router architecture with Supabase as the backend service. For comprehensive architectural details, deployment instructions, and security guidelines, see the `docs/` directory.

- [PRD.md](./docs/PRD.md)
- [TRD.md](./docs/TRD.md)
- [Implementation-Plan.md](./docs/Implementation-Plan.md)
- [Security-Plan.md](./docs/Security-Plan.md)
- [AI-Agent-Security-Rules.md](./docs/AI-Agent-Security-Rules.md)
- [Security-Audit-Checklist.md](./docs/Security-Audit-Checklist.md)
- [Release-Deployment-Guide.md](./docs/Release-Deployment-Guide.md)

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend/Auth:** Supabase (PostgreSQL, Auth, RLS, Storage)
- **Validation:** Zod

## Setup Instructions

1. Ensure you have Node.js LTS (v20+) installed.
2. Navigate to the `frontend/` directory.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy the environment variables template and configure your Supabase details:
   ```bash
   cp .env.example .env.local
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

Development strictly follows Phase-by-Phase implementation as defined in `docs/Implementation-Plan.md`. 
Ensure that all code passes TypeScript compilation, ESLint, and adheres to the Security Rules before committing.

```bash
npm run type-check
npm run lint
npm run build
```