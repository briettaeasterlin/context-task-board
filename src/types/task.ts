export const AREAS = ['Client', 'Business', 'Home', 'Family', 'Personal'] as const;
export type TaskArea = typeof AREAS[number];

export const STATUSES = ['Today', 'Next', 'Waiting', 'Backlog', 'Closing', 'Done'] as const;
export type TaskStatus = typeof STATUSES[number];

export const STRATEGIC_PHASES = ['scoping', 'active_engagement', 'closed_followup', 'internal_ops'] as const;
export type StrategicPhase = typeof STRATEGIC_PHASES[number];

export const STRATEGIC_PHASE_LABELS: Record<StrategicPhase, string> = {
  scoping: '🔍 Scoping / Negotiation',
  active_engagement: '🔥 Active Engagement',
  closed_followup: '✅ Closed / Follow-up',
  internal_ops: '⚙️ Internal / Ops',
};

export const UPDATE_SOURCES = ['chatgpt', 'meeting', 'email', 'call', 'doc'] as const;
export type UpdateSource = typeof UPDATE_SOURCES[number];

export const CLARIFY_STATUSES = ['open', 'answered', 'dismissed'] as const;
export type ClarifyStatus = typeof CLARIFY_STATUSES[number];

export interface Task {
  id: string;
  user_id: string;
  title: string;
  area: TaskArea;
  status: TaskStatus;
  context: string | null;
  notes: string | null;
  tags: string[];
  project_id: string | null;
  milestone_id: string | null;
  blocked_by: string | null;
  source: string | null;
  due_date: string | null;
  target_window: string | null;
  sort_order: number;
  estimated_minutes: number | null;
  context_tag: string | null;
  strategic_phase: StrategicPhase | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  area: TaskArea;
  summary: string | null;
  scope_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  description: string | null;
  order_index: number;
  completion_rule: 'manual' | 'tasks_based';
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Update {
  id: string;
  user_id: string;
  project_id: string | null;
  source: UpdateSource | null;
  content: string;
  extracted_summary: string | null;
  extracted_tasks: any | null;
  created_at: string;
}

export interface ClarifyQuestion {
  id: string;
  user_id: string;
  project_id: string;
  question: string;
  reason: string | null;
  suggested_options: string[] | null;
  status: ClarifyStatus;
  answer: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'sort_order' | 'estimated_minutes' | 'context_tag'> & { sort_order?: number; estimated_minutes?: number | null; context_tag?: string | null };
export type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export function parseTaskLine(line: string, defaultArea: TaskArea = 'Personal', defaultStatus: TaskStatus = 'Backlog'): Omit<TaskInsert, 'user_id'> {
  let remaining = line.trim();
  let area: TaskArea = defaultArea;
  let status: TaskStatus = defaultStatus;
  let project: string | null = null;
  let context: string | null = null;

  const dashIdx = remaining.indexOf(' — ');
  const hyphenIdx = dashIdx === -1 ? remaining.indexOf(' - ') : -1;
  const contextIdx = dashIdx !== -1 ? dashIdx : hyphenIdx;
  if (contextIdx !== -1) {
    context = remaining.slice(contextIdx + 3).trim() || null;
    remaining = remaining.slice(0, contextIdx).trim();
  }

  const tokenRegex = /\[(\w+)=([^\]]+)\]/g;
  let match;
  while ((match = tokenRegex.exec(remaining)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2].trim();
    if (key === 'area' && (AREAS as readonly string[]).includes(val)) area = val as TaskArea;
    else if (key === 'status' && (STATUSES as readonly string[]).includes(val)) status = val as TaskStatus;
    else if (key === 'project') project = val;
  }
  remaining = remaining.replace(tokenRegex, '').trim();

  return {
    title: remaining,
    area,
    status,
    context,
    notes: null,
    tags: [],
    project_id: null,
    milestone_id: null,
    blocked_by: null,
    source: null,
    due_date: null,
    target_window: null,
  };
}
