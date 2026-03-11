import type { Task } from '@/types/task';
import { differenceInHours, differenceInDays } from 'date-fns';

// ─── Duration Estimation ───

export type EstimatedDuration = '5m' | '15m' | '30m' | '1h' | '2h';

const DURATION_KEYWORDS: [RegExp, EstimatedDuration][] = [
  [/\b(send|email|message|confirm|ask|slack|reply|respond|text)\b/i, '5m'],
  [/\b(review|check|verify|validate|read|scan|skim)\b/i, '15m'],
  [/\b(update|fix|adjust|polish|tweak|edit|refine|clean|organize|document)\b/i, '30m'],
  [/\b(implement|build|design|integrate|create|develop|write|configure|set\s?up)\b/i, '1h'],
  [/\b(ship|launch|define|plan|architect|migrate|refactor|redesign)\b/i, '2h'],
];

export function estimateDuration(title: string): EstimatedDuration {
  for (const [regex, duration] of DURATION_KEYWORDS) {
    if (regex.test(title)) return duration;
  }
  return '30m';
}

export const DURATION_MINUTES: Record<EstimatedDuration, number> = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
};

// ─── Strategic Value Categories ───

export type StrategicCategory =
  | 'client_delivery'
  | 'revenue_generation'
  | 'pipeline_relationship'
  | 'business_infrastructure'
  | 'personal_admin'
  | 'side_project';

const STRATEGIC_VALUES: Record<StrategicCategory, number> = {
  client_delivery: 35,
  revenue_generation: 30,
  pipeline_relationship: 25,
  business_infrastructure: 15,
  personal_admin: 10,
  side_project: 5,
};

export function inferStrategicCategory(task: Task): StrategicCategory {
  const t = (task.title + ' ' + (task.context ?? '') + ' ' + (task.notes ?? '')).toLowerCase();
  const area = task.area;

  if (area === 'Client') return 'client_delivery';
  if (/\b(invoice|billing|payment|revenue|contract|proposal|quote|pricing)\b/.test(t)) return 'revenue_generation';
  if (/\b(follow.?up|prospect|nurture|lead|pipeline|outreach|relationship|networking)\b/.test(t)) return 'pipeline_relationship';
  if (/\b(deploy|infra|server|domain|auth|security|policy|setup|config|ci|cd)\b/.test(t)) return 'business_infrastructure';
  if (area === 'Personal' || area === 'Home' || area === 'Family') return 'personal_admin';
  if (area === 'Business') return 'business_infrastructure';
  return 'personal_admin';
}

// ─── Priority Score (v2) ───

export interface ScoredTask extends Task {
  estimatedDuration: EstimatedDuration;
  estimatedMinutesCalc: number;
  impactScore: number;
  priorityScore: number;
  strategicCategory: StrategicCategory;
  deadlineWeight: number;
  projectCompletionWeight: number;
  strategicValue: number;
  taskAgeScore: number;
  effortFitBonus: number;
  pipelineBoost: number;
}

export interface ScoringContext {
  /** Fraction of weekly capacity used (0-1) */
  calendarUtilization?: number;
  /** Available minutes for effort-fit scoring */
  availableMinutes?: number;
  /** Project task counts: projectId -> { open, total } */
  projectTaskCounts?: Map<string, { open: number; total: number }>;
}

export function scoreTask(task: Task, allTasks: Task[], ctx: ScoringContext = {}): ScoredTask {
  const duration = task.estimated_minutes
    ? closestDuration(task.estimated_minutes)
    : estimateDuration(task.title);

  const estimatedMins = task.estimated_minutes ?? DURATION_MINUTES[duration];
  const strategicCategory = inferStrategicCategory(task);

  // 1. Deadline Weight
  let deadlineWeight = 0;
  if (task.due_date) {
    const hoursUntilDue = differenceInHours(new Date(task.due_date), new Date());
    if (hoursUntilDue < 0) deadlineWeight = 100; // overdue
    else if (hoursUntilDue <= 72) deadlineWeight = 60; // <3 days
    else if (hoursUntilDue <= 168) deadlineWeight = 40; // <7 days
  }

  // 2. Project Completion Weight
  let projectCompletionWeight = 0;
  if (task.project_id && ctx.projectTaskCounts) {
    const counts = ctx.projectTaskCounts.get(task.project_id);
    if (counts && counts.open > 0 && counts.open <= 3) {
      projectCompletionWeight = 40;
    }
  }

  // 3. Strategic Value
  const strategicValue = STRATEGIC_VALUES[strategicCategory];

  // 4. Task Age (+1 per day since last activity)
  const taskAgeScore = Math.min(
    differenceInDays(new Date(), new Date(task.updated_at)),
    30 // cap at 30
  );

  // 5. Effort Fit bonus
  let effortFitBonus = 0;
  if (ctx.availableMinutes != null) {
    if (estimatedMins <= ctx.availableMinutes && estimatedMins >= ctx.availableMinutes * 0.5) {
      effortFitBonus = 15; // perfect fit
    } else if (estimatedMins <= ctx.availableMinutes) {
      effortFitBonus = 5;
    }
  }

  // 6. Pipeline Boost
  let pipelineBoost = 0;
  if (strategicCategory === 'pipeline_relationship' && ctx.calendarUtilization != null) {
    if (ctx.calendarUtilization < 0.5) pipelineBoost = 30;
    else if (ctx.calendarUtilization < 0.7) pipelineBoost = 20;
  }

  const impactScore = (task as any).impact_score ?? suggestImpactScore(task.title);

  const priorityScore =
    deadlineWeight +
    projectCompletionWeight +
    strategicValue +
    taskAgeScore +
    effortFitBonus +
    pipelineBoost;

  return {
    ...task,
    estimatedDuration: duration,
    estimatedMinutesCalc: estimatedMins,
    impactScore,
    priorityScore,
    strategicCategory,
    deadlineWeight,
    projectCompletionWeight,
    strategicValue,
    taskAgeScore,
    effortFitBonus,
    pipelineBoost,
  };
}

function closestDuration(minutes: number): EstimatedDuration {
  if (minutes <= 10) return '5m';
  if (minutes <= 20) return '15m';
  if (minutes <= 45) return '30m';
  if (minutes <= 90) return '1h';
  return '2h';
}

// ─── Impact Score (legacy, still used for display) ───

const IMPACT_KEYWORDS: [RegExp, number][] = [
  [/\b(ship|launch|deploy|release)\b/i, 5],
  [/\b(implement|build|integrate|create|develop)\b/i, 4],
  [/\b(fix|update|improve|enhance|refine)\b/i, 3],
  [/\b(review|verify|check|validate|test)\b/i, 2],
  [/\b(organize|clean|document|archive|tidy)\b/i, 1],
];

export function suggestImpactScore(title: string): number {
  for (const [regex, score] of IMPACT_KEYWORDS) {
    if (regex.test(title)) return score;
  }
  return 3;
}

// ─── Batch Scoring ───

export function buildScoringContext(
  allTasks: Task[],
  calendarUtilization?: number,
  availableMinutes?: number,
): ScoringContext {
  const projectTaskCounts = new Map<string, { open: number; total: number }>();
  for (const t of allTasks) {
    if (!t.project_id) continue;
    const entry = projectTaskCounts.get(t.project_id) ?? { open: 0, total: 0 };
    entry.total++;
    if (t.status !== 'Done') entry.open++;
    projectTaskCounts.set(t.project_id, entry);
  }
  return { calendarUtilization, availableMinutes, projectTaskCounts };
}

export function scoreTasks(tasks: Task[], allTasks?: Task[], ctx?: ScoringContext): ScoredTask[] {
  const all = allTasks ?? tasks;
  const context = ctx ?? buildScoringContext(all);
  return tasks.map(t => scoreTask(t, all, context)).sort((a, b) => b.priorityScore - a.priorityScore);
}

// ─── Daily Plan Generator ───

export function generateDailyPlan(
  tasks: Task[],
  availableMinutes: number,
  allTasks: Task[]
): ScoredTask[] {
  const ctx = buildScoringContext(allTasks, undefined, availableMinutes);
  const nextTasks = tasks.filter(t => t.status === 'Today' || t.status === 'Next');
  const scored = scoreTasks(nextTasks, allTasks, ctx);
  const plan: ScoredTask[] = [];
  let remaining = availableMinutes;

  for (const task of scored) {
    if (task.estimatedMinutesCalc <= remaining) {
      plan.push(task);
      remaining -= task.estimatedMinutesCalc;
    }
  }

  return plan;
}

// ─── Quick Wins ───

export function getQuickWins(tasks: Task[], allTasks: Task[]): ScoredTask[] {
  const activeTasks = tasks.filter(t => t.status === 'Today' || t.status === 'Next' || t.status === 'Backlog');
  const scored = scoreTasks(activeTasks, allTasks);
  return scored
    .filter(t => DURATION_MINUTES[t.estimatedDuration] <= 15)
    .slice(0, 8);
}
