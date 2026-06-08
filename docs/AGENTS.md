# Opportunity Radar - Agent Rules

## Project Status
- Database deployed successfully
- Supabase Auth working
- RLS configured
- Storage buckets configured
- Type generation completed

## Authority Order
1. PRD.md
2. TRD.md
3. App-Flow.md
4. UI-SCREEN-MAP.md
5. Backend-Schema.md
6. UI-UX-Brief.md

## Design Authority
Primary design source:
designs/stitch_opportunity_hub/

Available files:
- search design.jpeg
- tracker design.jpeg
- profile design.jpeg
- command-center design.jpeg
- corresponding code.html files

Follow designs exactly.
Do not redesign layouts, spacing, colors, or component structure.

## Database Rules
Database already deployed.

Never:
- create migrations
- alter schema
- rename tables
- modify RLS
- modify storage policies

unless explicitly instructed.

## Architecture Rules
Use:

UI
→ Hooks
→ Services
→ Supabase

Keep business logic out of components.

## Current Development Phase
Phase 3: Frontend Feature Implementation

Completed:
- Authentication
- Database deployment
- Profile UI
- Search UI
- Tracker UI
- Command Center UI

Pending:
- Search functionality
- Hub functionality
- Tracker functionality
- Profile functionality
- Notifications
- Settings
- Support

## Development Workflow
For every task:

1. Read AGENTS.md first
2. Open only required files
3. Do not reread all documents
4. Follow existing architecture
5. Implement one feature at a time
6. Verify TypeScript build passes

## Route Status

Implemented:
/profile
/command-center

Missing:
/search
/tracker
/hub

Create missing routes if required.

## Token Optimization
Do not scan all documentation.

Only read:
- AGENTS.md
- feature-specific design files
- files directly related to the task

Read PRD/TRD only if required information is missing.

Token Rules:

- Read AGENTS.md first
- Read PROJECT_STATE.md second
- Read CURRENT_TASK.md third
- Never scan entire repository
- Never reread PRD/TRD unless information is missing
- Only open files directly related to current task

## Stop Conditions

After completing a task:

- stop
- summarize completed files
- summarize remaining work
- wait for approval

Do not automatically start the next feature.

## File Reading Rules

Maximum files to read: 10

Never:
- scan entire repository
- search all files
- reread completed features

Only open:
- files directly required for current task

Build Rules:

Before creating new files:
1. Check if file already exists
2. Reuse existing components
3. Avoid duplicate hooks
4. Avoid duplicate services

Prefer modification over creation.

PRODUCT MODEL

Opportunity Radar is an Opportunity Aggregation Platform.

The platform does NOT rely on companies posting opportunities.

The system:

1. Discovers opportunities from external sources.
2. Aggregates opportunities.
3. Normalizes opportunity data.
4. Removes duplicates.
5. Indexes opportunities for search.
6. Presents opportunities to students.

Do not implement employer dashboards, recruiter portals, or company posting workflows unless explicitly requested.