export const AREAS = ['Client', 'Business', 'Home', 'Family', 'Personal'] as const;
export type TaskArea = typeof AREAS[number];

export const STATUSES = ['Backlog', 'Next', 'Waiting', 'Done'] as const;
export type TaskStatus = typeof STATUSES[number];

export interface Task {
  id: string;
  user_id: string;
  title: string;
  area: TaskArea;
  status: TaskStatus;
  context: string | null;
  notes: string | null;
  tags: string[];
  project: string | null;
  blocked_by: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at'>;
export type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type ViewTab = 'next' | 'kanban' | 'waiting' | 'done' | 'all';

export function parseTaskLine(line: string, defaultArea: TaskArea = 'Personal', defaultStatus: TaskStatus = 'Backlog'): Omit<TaskInsert, 'user_id'> {
  let remaining = line.trim();
  let area: TaskArea = defaultArea;
  let status: TaskStatus = defaultStatus;
  let project: string | null = null;
  let context: string | null = null;

  // Extract context after " — " or " - "
  const dashIdx = remaining.indexOf(' — ');
  const hyphenIdx = dashIdx === -1 ? remaining.indexOf(' - ') : -1;
  const contextIdx = dashIdx !== -1 ? dashIdx : hyphenIdx;
  if (contextIdx !== -1) {
    context = remaining.slice(contextIdx + 3).trim() || null;
    remaining = remaining.slice(0, contextIdx).trim();
  }

  // Extract tokens [Key=Value]
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
    project,
    blocked_by: null,
    source: null,
  };
}
