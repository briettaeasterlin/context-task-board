# Vector — AI-Powered Execution Planning

A personal task management system designed for deep work and strategic clarity. Vector uses AI to extract tasks from unstructured input, run weekly board reviews, and keep your focus tight.

**Live app**: [context-task-board.lovable.app](https://context-task-board.lovable.app)

---

## Features

- **Focus Mode** — Card-stack UI surfacing your highest-priority tasks
- **AI Extraction** — Paste meeting notes, emails, or status updates → Vector extracts tasks, updates, and clarifying questions
- **Weekly Board Review** — AI-powered review that flags stale tasks, suggests promotions, and enforces a strict Next limit (5–7 tasks)
- **Projects & Milestones** — Group tasks under projects with milestone tracking and roadmap timelines
- **Google Calendar Sync** — Two-way calendar integration with ICS overlay feed
- **Vector Sync API** — External LLMs (ChatGPT, Claude) can read your board state and push structured updates via API
- **Kanban & Table Views** — Multiple ways to view and manage your task board
- **Habit Tracking** — Daily/weekly/seasonal habit intentions

---

## Getting Started

### Prerequisites

- Node.js 18+ ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A Lovable account (for backend/database)

### Installation

```sh
# Clone the repository
git clone https://github.com/briettaeasterlin/context-task-board.git
cd context-task-board

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Authentication

Vector uses email/password authentication. Create an account on the login screen to get started. All data is scoped to your account — no one else can see your tasks or projects.

---

## Vector Sync API — Connecting ChatGPT & Claude

Vector exposes two edge function endpoints that let external LLMs read your board and push updates. This is designed for use with **ChatGPT Custom GPTs** and **Claude Projects/Scheduled Jobs**.

### 1. Generate an API Key

1. Open Vector and navigate to **Review → Vector Sync**
2. Click **Generate API Key**
3. Copy the key — you'll need it for your GPT/Claude configuration
4. The key supports two permissions: `vector:read` and `vector:ingest`

### 2. Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://izzjcdoysbcunsvgwmew.supabase.co/functions/v1/vector-read` | GET | Read current board state |
| `https://izzjcdoysbcunsvgwmew.supabase.co/functions/v1/vector-ingest` | POST | Push task changes |
| `https://izzjcdoysbcunsvgwmew.supabase.co/functions/v1/vector-ingest?action=schema` | GET | Discover payload schema |

### 3. Authentication

All API calls require the `X-API-Key` header:

```sh
curl -H "X-API-Key: your-api-key-here" \
  "https://izzjcdoysbcunsvgwmew.supabase.co/functions/v1/vector-read?scope=active"
```

### 4. Reading Board State (`vector-read`)

Returns a structured snapshot of your tasks, projects, and alerts.

**Query parameters:**

| Param | Values | Description |
|-------|--------|-------------|
| `scope` | `active` (default), `full`, `project` | Filter tasks by status |
| `project` | Project name | Required when `scope=project` |
| `include` | `milestones`, `clarify`, `updates`, `recent_ops` | Comma-separated extra data |
| `since` | ISO timestamp | Only tasks updated after this time |

**Example:**

```sh
curl -H "X-API-Key: YOUR_KEY" \
  "https://izzjcdoysbcunsvgwmew.supabase.co/functions/v1/vector-read?scope=active&include=milestones,clarify"
```

**Response includes:**
- `summary` — Task counts by status, overdue count, stale waiting count
- `projects_with_tasks` — Tasks grouped by project with metadata
- `alerts` — Automated warnings (stale waiting, overdue, focus overload)

### 5. Pushing Updates (`vector-ingest`)

Send a structured payload to create, update, complete, or delete tasks.

**Payload schema (v1.1):**

```json
{
  "operation_id": "unique-id-for-idempotency",
  "source": "chatgpt",
  "schema_version": "1.1",
  "tasks_completed": [
    { "title": "Ship landing page", "confidence": "high" }
  ],
  "tasks_created": [
    {
      "title": "Draft investor update",
      "status": "Next",
      "area": "Business",
      "project": "Fundraising",
      "context": "Q1 metrics ready",
      "due_date": "2026-03-15"
    }
  ],
  "tasks_updated": [
    { "title": "API integration", "status": "Waiting", "blocked_by": "Partner team" }
  ],
  "tasks_deleted": [
    { "title": "Old task to remove" }
  ],
  "project_updates": [
    { "project": "Vector", "summary": "Shipped security hardening and RLS fixes" }
  ],
  "clarify_questions_created": [
    { "project": "Vector", "question": "Should we add team features?", "reason": "Scope decision" }
  ]
}
```

**Key behaviors:**
- **Idempotent** — Same `operation_id` returns cached result
- **Deduplication** — Identical payloads within 24h are detected
- **Task matching** — Tasks are matched by exact title (case-sensitive) or UUID
- **Soft delete** — Deleted tasks are recoverable from the archive
- **Confidence scoring** — Set `"confidence": "low"` to flag actions for manual review
- **Rate limited** — 30 requests/minute per API key

### 6. ChatGPT Custom GPT Setup

1. Create a new GPT at [chat.openai.com/gpts](https://chat.openai.com/gpts)
2. Add an **Action** with the OpenAPI schema (use `?action=schema` to discover it)
3. Set the authentication to **API Key** with header name `X-API-Key`
4. Paste your Vector API key
5. In the GPT instructions, tell it to:
   - Call `vector-read` first to get current board state
   - Use the board context to make informed decisions
   - Push changes via `vector-ingest` with a unique `operation_id`
   - Set `"source": "chatgpt"`

**Example GPT instruction snippet:**

```
You are Vector, a task management assistant. Before making any changes:
1. Read the current board state: GET vector-read?scope=active&include=milestones,clarify
2. Analyze the user's request in context of existing tasks
3. Push changes via POST vector-ingest with source="chatgpt"
4. Always use unique operation_ids (e.g., "chatgpt-{timestamp}")
5. Set confidence="low" when you're unsure about a task match
```

### 7. Claude Project Setup

1. Create a new **Claude Project** at [claude.ai](https://claude.ai)
2. Add the Vector API endpoints as **Custom Tools** or use the MCP protocol
3. Include your API key in the tool configuration
4. Add project instructions similar to the GPT example above, but with `"source": "claude"`

For **Claude Scheduled Jobs** (automated daily/weekly syncs):
- Schedule a job that reads the board state and generates a status summary
- Use the ingestion API to mark completed tasks and create new ones based on the summary
- Set `"source": "claude"` in all payloads

---

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase)
- **AI**: Lovable AI Gateway (Gemini 3 Flash)
- **Auth**: Email/password with Row-Level Security
- **Calendar**: Google Calendar API with OAuth 2.0

---

## Security

- All data is isolated per user via Row-Level Security (RLS)
- API keys are stored as SHA-256 hashes with optional IP allowlisting
- Rate limiting (30 req/min) on the Vector Sync API
- HMAC-signed OAuth state for Google Calendar
- ICS feed tokens with 90-day rotation

---

## License

This project is open source. Fork it, remix it, make it yours.
