export interface VectorPayload {
  operation_id: string;
  timestamp: string;
  source: 'chatgpt' | 'claude' | 'manual';
  schema_version?: '1.0' | '1.1';

  tasks_completed?: Array<{
    task_id?: string;
    title: string;
    project?: string;
    confidence?: 'high' | 'medium' | 'low';
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
    confidence?: 'high' | 'medium' | 'low';
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
    confidence?: 'high' | 'medium' | 'low';
  }>;

  tasks_deleted?: Array<{
    task_id?: string;
    title: string;
    project?: string;
    confidence?: 'high' | 'medium' | 'low';
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
  schema_version?: string;
  processed_at: string;
  success: boolean;
  deduplicated?: boolean;
  original_operation_id?: string;
  message?: string;
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
  low_confidence_actions?: Array<{
    action_type: string;
    target_type: string;
    target_title: string;
  }>;
}

export interface OperationLogEntry {
  id: string;
  operation_id: string;
  user_id: string;
  source: string;
  payload: VectorPayload;
  result: PayloadProcessingResult | null;
  payload_hash: string | null;
  schema_version: string | null;
  processed_at: string;
  created_at: string;
}

export interface OperationAction {
  id: string;
  operation_log_id: string;
  user_id: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  target_title: string;
  confidence: string;
  detail: any;
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
  allowed_ips: string[];
}
