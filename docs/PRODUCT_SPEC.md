# NextMove — Product Specification

> **Version**: 1.0 · **Updated**: 2026-04-01
> **Live**: [getnextmove.io](https://getnextmove.io)

---

## 1. Product Overview

NextMove is a personal task management system designed for deep work and strategic clarity. It uses a **London Underground / Tube map metaphor** — projects are "routes," tasks are "stops," and your daily work is navigating the map. AI assists with extraction, planning, and review.

**Core philosophy**: Always know your next move. Surface the right task at the right time with zero friction.

---

## 2. Information Architecture

### 2.1 Data Model

#### Tasks
The atomic unit of work.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `title` | string | Task name |
| `status` | enum | `Today`, `Next`, `Waiting`, `Backlog`, `Closing`, `Done`, `Someday` |
| `area` | enum | `Client`, `Business`, `Home`, `Family`, `Personal` |
| `project_id` | UUID (nullable) | Parent project |
| `milestone_id` | UUID (nullable) | Parent milestone within project |
| `context` | text (nullable) | Why this task matters / additional context |
| `notes` | text (nullable) | Freeform notes |
| `tags` | string[] | Freeform tags |
| `blocked_by` | text (nullable) | What's blocking this task |
| `due_date` | date (nullable) | Hard deadline |
| `planned_date` | date (nullable) | Soft planned date for execution |
| `estimated_minutes` | int (nullable) | Time estimate |
| `context_tag` | string (nullable) | Context label (e.g., "deep work", "calls") |
| `strategic_phase` | enum (nullable) | `scoping`, `active_engagement`, `closed_followup`, `internal_ops` |
| `impact_score` | int (nullable) | 1-10 impact rating |
| `sort_order` | int | Manual ordering |
| `source` | string (nullable) | Where this task came from |
| `link` | URL (nullable) | Reference link |
| `target_window` | string (nullable) | Target completion window |
| `deleted_at` | timestamp (nullable) | Soft delete |

**Status Flow**: `Backlog` → `Next` → `Today` → `Done`. Side states: `Waiting` (blocked), `Closing` (wrapping up), `Someday` (maybe later).

#### Projects
Groups of related tasks forming a "route" on the map.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | string | Project name |
| `area` | enum | Same area enum as tasks |
| `summary` | text (nullable) | One-line description |
| `scope_notes` | text (nullable) | Detailed scope |
| `line_color` | varchar(7) (nullable) | Hex color from Tube palette |
| `route_group` | varchar (nullable) | `consulting`, `products`, `health`, `life`, `parked` |
| `project_state` | varchar (nullable) | `active`, `supporting`, `completed`, `parked` |
| `strategic_phase` | enum (nullable) | Strategic phase |
| `sort_order` | int | Manual ordering within route group |
| `deleted_at` | timestamp (nullable) | Soft delete |

#### Milestones
Checkpoints within a project.

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | UUID | Parent project |
| `name` | string | Milestone name |
| `order_index` | int | Sequence within project |
| `completion_rule` | enum | `manual` or `tasks_based` |
| `is_complete` | boolean | Whether milestone is done |

#### Other Tables
- **`updates`** — Ingested text (meeting notes, emails, etc.) with AI-extracted summaries and tasks
- **`clarify_questions`** — AI-generated clarifying questions tied to projects (status: `open`, `answered`, `dismissed`)
- **`proposed_changes`** — AI-suggested changes awaiting user approval (status: `pending`, `applied`, `rejected`)
- **`audit_log`** — Full change history for accountability
- **`api_keys`** — SHA-256 hashed API keys with permissions (`vector:read`, `vector:ingest`), IP allowlisting, expiry
- **`operation_log`** / **`operation_actions`** — Idempotent operation tracking for the Vector Sync API
- **`planned_task_blocks`** — Time-blocked task slots with start time, duration, date
- **`calendar_events_cache`** — Cached Google Calendar events
- **`user_planner_settings`** — Per-user config (workday hours, max Next tasks, GCal tokens, ICS feed tokens)
- **`habit_intentions`** / **`habit_completions`** — Daily/Weekly/Often/Seasonal habit tracking
- **`rate_limit_log`** / **`user_rate_limit_log`** — Rate limiting for API and AI functions

### 2.2 Color System

Every project gets a distinct color from the **London Underground palette** (13 colors):

| Line | Hex |
|------|-----|
| Central | `#E32017` (red) |
| Victoria | `#0098D4` (light blue) |
| District | `#00782A` (green) |
| Piccadilly | `#003688` (dark blue) |
| Northern | `#1A1A1A` (near-black) |
| Metropolitan | `#9B0056` (magenta) |
| Circle | `#FFD300` (yellow) |
| Bakerloo | `#B36305` (brown) |
| Jubilee | `#A0A5A9` (silver-grey) |
| Hammersmith | `#F3A9BB` (pink) |
| Elizabeth | `#6950A1` (purple) |
| Overground | `#EE7C0E` (orange) |
| Waterloo | `#95CDBA` (teal) |

New projects auto-assign the next unused color. Users can change colors via a swatch picker.

### 2.3 Route Groups

Projects are organized into life domains:

| Group | Emoji | Description |
|-------|-------|-------------|
| `consulting` | 💼 | Business & Career — revenue, clients, skills, growth |
| `products` | 🚀 | Build & Launch — products, experiments, learning by building |
| `health` | 🏃 | Health & Wellness — physical, mental, medical |
| `life` | 🏠 | Home & Family — time-bound, non-negotiable |
| `parked` | 📦 | Parked — revisit later |

### 2.4 Project States

| State | Meaning |
|-------|---------|
| `active` | Currently being worked on (prominent display) |
| `supporting` | Supports active projects, not daily focus (slightly muted) |
| `completed` | All tasks done — shown in Victories section |
| `parked` | Shelved, not active (collapsed by default) |

---

## 3. Screens & Navigation

### 3.1 Today (`/today`) — Daily Execution
The primary screen. Shows today's moves with a "Your Next Move" hero card.

**Task selection logic**:
1. Tasks with `planned_date = today`
2. Tasks with `status = 'Today'`
3. Next/Waiting tasks with `due_date = today`
4. Backfill from `Next` tasks if fewer than 3

**Features**:
- Hero card showing the top-priority task with project color accent
- Streak counter (consecutive days completing tasks)
- Task cards with project-colored left border (3px)
- Quick actions: Mark Done, Swap, Deprioritize, Move to Tomorrow, Delete
- Multi-color progress bar showing completion by project
- QuickAdd for fast task creation
- AI Helper panel for intelligent task suggestions
- Completion celebration animation

**Task scoring** (`src/lib/task-scoring.ts`):
- Factors: due date urgency, impact score, strategic phase, waiting duration, project priority
- Roles: `frog` (hardest/most important), `supporting`, `warmup` (easy starter)

**Daily Execution Engine** (`src/lib/daily-execution-engine.ts`):
- Builds a time-blocked execution plan
- Assigns warmup → frog → supporting task sequence
- Respects workday hours and calendar events

### 3.2 Plan (`/plan`) — Strategic Planning
AI-assisted daily/weekly planning.

**Features**:
- AI-generated execution plan with task recommendations
- Route brief showing which projects need attention
- Route progress visualization
- "Trim Route" — AI suggests tasks to defer or remove from overloaded projects
- Auto-schedule capability

### 3.3 Routes (`/routes`) — Life Map
Visual overview of all projects as a transit map.

**Layout**:
- Projects grouped by `route_group` with collapsible sections
- Each project shows a route line with ●/◉/○ stops (done/current/todo)
- Progress fraction (e.g., "13/29")
- Auto-generated context labels: `starting`, `early progress`, `in progress`, `home stretch`, `closing out`, `complete ✓`, `supporting`, `parked`, `blocked`, `stalled`
- Victories section (collapsed by default) for completed projects
- Parked section (collapsed by default)

**Interactions**:
- Click group header to collapse/expand
- Click project row to expand inline task list
- Click task to open detail drawer
- Color picker on project dot
- Drag-and-drop to reorder projects within groups
- Inline "Add Route" button per group

### 3.4 Guide (`/guide`)
Onboarding and help documentation.

### 3.5 Review (`/review`) — Weekly Review
AI-powered board review and status check.

**Sub-panels**:
- **Board Review** — AI analyzes your entire board: flags stale tasks, suggests status changes, enforces Next limit (5-7 tasks)
- **Status Review** — AI-generated status summary of all active projects
- **Changes Panel** — Review proposed changes from AI or API (approve/reject)
- **Wrap Up** — Weekly summary with stats
- **Vector Sync** — API key management for external LLM integration

### 3.6 Projects (`/projects`) — Project List
Card-based project browser with project creation.

### 3.7 Project Detail (`/projects/:id`)
Full project view with:
- Task list (filterable by status)
- Milestone timeline
- Project plan tab (AI-generated)
- Roadmap timeline visualization
- Tube map overview
- Duplicate task detector

### 3.8 Archive (`/archive`)
Completed and deleted tasks with restore capability.

### 3.9 Workload (`/workload`)
Workload analysis and capacity planning.

---

## 4. AI Capabilities

All AI calls use **Lovable AI Gateway** (no user API key required).

### 4.1 AI Extract (`ai-extract` edge function)
- Input: Freeform text (meeting notes, emails, status updates)
- Output: Extracted tasks, updates, clarifying questions
- Creates `proposed_changes` for user review

### 4.2 AI Board Review (`ai-board-review` edge function)
- Analyzes entire board state
- Flags: stale tasks, Next limit violations, status inconsistencies
- Generates proposed changes with confidence scores

### 4.3 AI Status Review (`ai-status-review` edge function)
- Generates narrative status summary per project
- Identifies blockers and risks

### 4.4 AI Project Plan (`ai-project-plan` edge function)
- Generates milestone and task plan for a project
- Based on project scope notes and existing tasks

### 4.5 AI Trim Route (`ai-trim-route` edge function)
- Suggests tasks to defer/remove from overloaded projects
- Respects strategic priorities

### Rate Limiting
- User-scoped: tracked in `user_rate_limit_log` by function name
- API-scoped: 30 requests/minute per API key

---

## 5. Vector Sync API — External LLM Integration

Two edge function endpoints let external LLMs (ChatGPT, Claude) read and write to the board.

### 5.1 Authentication
- `X-API-Key` header with SHA-256 hashed keys
- OR Bearer token (Supabase JWT)
- Keys support permissions: `vector:read`, `vector:ingest`
- Optional IP allowlisting

### 5.2 Read (`vector-read`)

```
GET /functions/v1/vector-read
```

**Query params**:
| Param | Values | Description |
|-------|--------|-------------|
| `scope` | `active` (default), `full`, `project` | Task filter |
| `project` | project name | Required when scope=project |
| `include` | `milestones`, `clarify`, `updates`, `recent_ops` | Comma-separated extras |
| `since` | ISO timestamp | Only tasks updated after this |

**Response**: `summary` (counts), `projects_with_tasks`, `alerts` (stale, overdue, focus overload).

### 5.3 Ingest (`vector-ingest`)

```
POST /functions/v1/vector-ingest
```

**Payload schema v1.1**:
```json
{
  "operation_id": "unique-id",
  "source": "chatgpt|claude",
  "schema_version": "1.1",
  "tasks_completed": [{ "title": "...", "confidence": "high|low" }],
  "tasks_created": [{ "title": "...", "status": "Next", "area": "Business", "project": "...", "context": "...", "due_date": "YYYY-MM-DD" }],
  "tasks_updated": [{ "title": "...", "status": "Waiting", "blocked_by": "..." }],
  "tasks_deleted": [{ "title": "..." }],
  "project_updates": [{ "project": "...", "summary": "..." }],
  "clarify_questions_created": [{ "project": "...", "question": "...", "reason": "..." }]
}
```

**Behaviors**: Idempotent (same `operation_id` → cached result), deduplication (identical payloads within 24h), task matching by exact title or UUID, soft delete, confidence scoring, rate limited (30 req/min).

### 5.4 Schema Discovery
```
GET /functions/v1/vector-ingest?action=schema
```
Returns OpenAPI-compatible schema for GPT Action setup.

---

## 6. Integrations

### 6.1 Google Calendar
- OAuth 2.0 flow via `gcal-auth` edge function
- Two-way sync via `gcal-sync` edge function
- ICS overlay feed via `tasks-overlay-ics` edge function (90-day token rotation)
- Calendar events cached in `calendar_events_cache`

### 6.2 Habit Tracking
- Intentions with cadence: `Daily`, `Weekly`, `Often`, `Seasonal`
- Completion tracking per day
- Displayed in a dedicated habit section

---

## 7. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| Styling | Tailwind CSS v3 + shadcn/ui |
| State | TanStack Query v5 (React Query) |
| Animation | Framer Motion |
| Drag & Drop | @dnd-kit |
| Routing | React Router v6 |
| Backend | Supabase (Lovable Cloud) |
| Auth | Email/password + Row-Level Security |
| AI | Lovable AI Gateway |
| Calendar | Google Calendar API (OAuth 2.0) |
| PWA | vite-plugin-pwa |

---

## 8. Security Model

- **Row-Level Security (RLS)**: All tables scoped to `auth.uid()`. Users can only access their own data.
- **API Keys**: SHA-256 hashed, permission-scoped, optional IP allowlisting, expiry dates
- **Rate Limiting**: 30 req/min on Vector API, per-function limits on AI calls
- **HMAC-signed OAuth state** for Google Calendar
- **ICS feed tokens** with 90-day rotation
- **Soft deletes** — data recoverable from archive

---

## 9. Enums Reference

```
task_status: Today | Next | Waiting | Backlog | Closing | Done | Someday
task_area: Client | Business | Home | Family | Personal
strategic_phase: scoping | active_engagement | closed_followup | internal_ops
clarify_status: open | answered | dismissed
proposed_change_status: pending | applied | rejected
completion_rule: manual | tasks_based
habit_cadence: Daily | Weekly | Often | Seasonal
update_source: chatgpt | meeting | email | call | doc
route_group: consulting | products | health | life | parked
project_state: active | supporting | completed | parked
```

---

## 10. Key Conventions

1. **Tube metaphor**: Projects = routes, tasks = stops, completion = "clearing stops"
2. **Next limit**: Keep 5-7 tasks in `Next` status. AI enforces this during board review.
3. **Your Next Move**: The hero card on Today always shows the single highest-priority task.
4. **Context labels**: Auto-generated per project based on progress and activity (starting → in progress → closing out → complete ✓)
5. **Color everywhere**: Project line color appears on task card borders, progress bars, badges, route lines
6. **Soft deletes**: `deleted_at` timestamp, recoverable from Archive
7. **Idempotent operations**: Vector API uses `operation_id` for safe retries
8. **Proposed changes**: AI and API changes go through a review queue before applying
