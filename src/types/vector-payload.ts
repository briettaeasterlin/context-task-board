export interface VectorPayload {
  operation_id: string;
  timestamp: string;
  source: 'chatgpt' | 'claude' | 'manual';

  tasks_completed?: Array<{
    task_id?: string;
    title: string;
    project?: string;
  }>;

  tasks_created?: Array<{
    title: string;
    project: string;
    status: 'Backlog' | 'Next' | 'Waiting' | 'Done' | 'Someday';
    area?: 'Client' | 'Business' | 'Home' | 'Family' | 'Personal';
    context?: string;
    notes?: string;
    tags?: string[];
    blocked_by?: string;
    due_date?: string;
    target_window?: string;
    estimated_minutes?: number;
    milestone?: string;
  }>;

  tasks_updated?: Array<{
    task_id?: string;
    title: string;
    project?: string;
    status?: string;
    context?: string;
    notes?: string;
    blocked_by?: string | null;
    due_date?: string | null;
    target_window?: string | null;
    tags?: string[];
    milestone?: string | null;
  }>;

  tasks_deleted?: Array<{
    task_id?: string;
    title: string;
    project?: string;
  }>;

  project_updates?: Array<{
    project: string;
    summary: string;
    source?: string;
  }>;

  clarify_questions_created?: Array<{
    project: string;
    question: string;
    reason?: string;
    suggested_options?: string[];
  }>;

  clarify_questions_resolved?: Array<{
    question_id?: string;
    question: string;
    project?: string;
    status: 'answered' | 'dismissed';
    answer?: string;
  }>;

  tomorrow_priorities?: string[];
}

export interface PayloadProcessingResult {
  operation_id: string;
  processed_at: string;
  success: boolean;
  actions: {
    tasks_completed: number;
    tasks_created: number;
    tasks_updated: number;
    tasks_deleted: number;
    project_updates_logged: number;
    clarify_questions_created: number;
    clarify_questions_resolved: number;
  };
  errors: Array<{ action: string; title_or_id: string; message: string }>;
  warnings: Array<{ action: string; title_or_id: string; message: string }>;
}

export interface OperationLogEntry {
  id: string;
  operation_id: string;
  user_id: string;
  source: string;
  payload: VectorPayload;
  result: PayloadProcessingResult | null;
  processed_at: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  label: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}
