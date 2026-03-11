import { useMemo } from 'react';
import type { Task } from '@/types/task';
import { scoreTasks, type ScoredTask } from '@/lib/task-scoring';

export const BOARD_LIMITS = {
  Today: 3,
  Next: 10,
} as const;

export interface BoardLimitWarning {
  status: 'Today' | 'Next';
  current: number;
  limit: number;
  overflow: number;
  suggestedDemotions: ScoredTask[];
}

export function useBoardLimits(tasks: Task[]) {
  const warnings = useMemo(() => {
    const result: BoardLimitWarning[] = [];

    const todayTasks = tasks.filter(t => t.status === 'Today');
    if (todayTasks.length > BOARD_LIMITS.Today) {
      const scored = scoreTasks(todayTasks, tasks);
      result.push({
        status: 'Today',
        current: todayTasks.length,
        limit: BOARD_LIMITS.Today,
        overflow: todayTasks.length - BOARD_LIMITS.Today,
        suggestedDemotions: scored.slice(BOARD_LIMITS.Today), // lowest priority
      });
    }

    const nextTasks = tasks.filter(t => t.status === 'Next');
    if (nextTasks.length > BOARD_LIMITS.Next) {
      const scored = scoreTasks(nextTasks, tasks);
      result.push({
        status: 'Next',
        current: nextTasks.length,
        limit: BOARD_LIMITS.Next,
        overflow: nextTasks.length - BOARD_LIMITS.Next,
        suggestedDemotions: scored.slice(BOARD_LIMITS.Next),
      });
    }

    return result;
  }, [tasks]);

  const hasWarnings = warnings.length > 0;

  return { warnings, hasWarnings };
}
