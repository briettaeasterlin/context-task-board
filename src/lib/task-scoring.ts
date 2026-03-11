import type { Task } from '@/types/task';
import { differenceInHours } from 'date-fns';

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

const TIME_COST: Record<EstimatedDuration, number> = {
  '5m': 0,
  '15m': 1,
  '30m': 2,
  '1h': 3,
  '2h': 4,
};

// ─── Impact Score ───

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
  return 3; // default: useful progress
}

// ─── Priority Score ───

export interface ScoredTask extends Task {
  estimatedDuration: EstimatedDuration;
  estimatedMinutesCalc: number;
  impactScore: number;
  priorityScore: number;
}

export function scoreTask(task: Task, allTasks: Task[]): ScoredTask {
  const duration = task.estimated_minutes
    ? closestDuration(task.estimated_minutes)
    : estimateDuration(task.title);

  // Impact: use manual override (stored in estimated_minutes field as impact_score hack)
  // Actually we'll use a convention: if the task has a context_tag starting with "impact:", parse it
  // Better: we added impact_score column
  const impactScore = (task as any).impact_score ?? suggestImpactScore(task.title);

  // Blocker bonus: +3 if this task is blocking other tasks
  const blockerBonus = allTasks.some(t =>
    t.blocked_by && t.id !== task.id &&
    t.blocked_by.toLowerCase().includes(task.title.toLowerCase().slice(0, 20))
  ) ? 3 : 0;

  // Deadline urgency
  let deadlineUrgency = 0;
  if (task.due_date) {
    const hoursUntilDue = differenceInHours(new Date(task.due_date), new Date());
    if (hoursUntilDue <= 48) deadlineUrgency = 2;
    else if (hoursUntilDue <= 168) deadlineUrgency = 1; // 7 days
  }

  const timeCost = TIME_COST[duration];

  const priorityScore = (impactScore * 2) + blockerBonus + deadlineUrgency - timeCost;

  return {
    ...task,
    estimatedDuration: duration,
    estimatedMinutesCalc: DURATION_MINUTES[duration],
    impactScore,
    priorityScore,
  };
}

function closestDuration(minutes: number): EstimatedDuration {
  if (minutes <= 10) return '5m';
  if (minutes <= 20) return '15m';
  if (minutes <= 45) return '30m';
  if (minutes <= 90) return '1h';
  return '2h';
}

export function scoreTasks(tasks: Task[], allTasks?: Task[]): ScoredTask[] {
  const all = allTasks ?? tasks;
  return tasks.map(t => scoreTask(t, all)).sort((a, b) => b.priorityScore - a.priorityScore);
}

// ─── Daily Plan Generator ───

export function generateDailyPlan(
  tasks: Task[],
  availableMinutes: number,
  allTasks: Task[]
): ScoredTask[] {
  const nextTasks = tasks.filter(t => t.status === 'Today' || t.status === 'Next');
  const scored = scoreTasks(nextTasks, allTasks);
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
