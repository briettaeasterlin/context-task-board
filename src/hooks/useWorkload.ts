import { useMemo } from 'react';
import type { Task } from '@/types/task';
import type { PlannedBlock } from '@/hooks/usePlanner';
import { DURATION_MINUTES, estimateDuration, inferStrategicCategory, type StrategicCategory } from '@/lib/task-scoring';
import { differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

export const WEEKLY_CONSULTING_ADMIN_CAP = 20 * 60; // 20 hours in minutes

export interface WorkloadBreakdown {
  consultingAdminMinutes: number;
  productMinutes: number;
  pipelineMinutes: number;
  personalMinutes: number;
  totalMinutes: number;
  consultingAdminCapMinutes: number;
  isOverCapacity: boolean;
  calendarUtilization: number; // 0-1
  weeklyCapacityMinutes: number; // total available (40h default)
  pipelineStaleDays: number; // days since last pipeline task completed
  shouldBoostPipeline: boolean;
}

const CATEGORY_BUCKET: Record<StrategicCategory, keyof Pick<WorkloadBreakdown, 'consultingAdminMinutes' | 'productMinutes' | 'pipelineMinutes' | 'personalMinutes'>> = {
  client_delivery: 'consultingAdminMinutes',
  revenue_generation: 'consultingAdminMinutes',
  pipeline_relationship: 'pipelineMinutes',
  business_infrastructure: 'productMinutes',
  personal_admin: 'personalMinutes',
  side_project: 'personalMinutes',
};

export function useWorkload(tasks: Task[], blocks: PlannedBlock[], weeklyCapacityHours = 40): WorkloadBreakdown {
  return useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekInterval = { start: weekStart, end: weekEnd };

    // Calculate from planned blocks this week
    const weekBlocks = blocks.filter(b => {
      const d = new Date(b.date);
      return isWithinInterval(d, weekInterval);
    });

    const taskMap = new Map(tasks.map(t => [t.id, t]));

    let consultingAdminMinutes = 0;
    let productMinutes = 0;
    let pipelineMinutes = 0;
    let personalMinutes = 0;

    for (const block of weekBlocks) {
      const task = block.task_id ? taskMap.get(block.task_id) : null;
      const mins = block.duration_minutes;
      if (task) {
        const cat = inferStrategicCategory(task);
        const bucket = CATEGORY_BUCKET[cat];
        switch (bucket) {
          case 'consultingAdminMinutes': consultingAdminMinutes += mins; break;
          case 'productMinutes': productMinutes += mins; break;
          case 'pipelineMinutes': pipelineMinutes += mins; break;
          case 'personalMinutes': personalMinutes += mins; break;
        }
      } else {
        personalMinutes += mins; // unlinked blocks count as personal
      }
    }

    // Also count Done tasks this week that weren't in blocks
    const doneTasks = tasks.filter(t =>
      t.status === 'Done' &&
      isWithinInterval(new Date(t.updated_at), weekInterval)
    );
    const blockedTaskIds = new Set(weekBlocks.map(b => b.task_id).filter(Boolean));
    for (const t of doneTasks) {
      if (blockedTaskIds.has(t.id)) continue; // already counted
      const mins = t.estimated_minutes ?? DURATION_MINUTES[estimateDuration(t.title)];
      const cat = inferStrategicCategory(t);
      const bucket = CATEGORY_BUCKET[cat];
      switch (bucket) {
        case 'consultingAdminMinutes': consultingAdminMinutes += mins; break;
        case 'productMinutes': productMinutes += mins; break;
        case 'pipelineMinutes': pipelineMinutes += mins; break;
        case 'personalMinutes': personalMinutes += mins; break;
      }
    }

    const totalMinutes = consultingAdminMinutes + productMinutes + pipelineMinutes + personalMinutes;
    const weeklyCapacityMinutes = weeklyCapacityHours * 60;
    const calendarUtilization = weeklyCapacityMinutes > 0 ? totalMinutes / weeklyCapacityMinutes : 0;

    // Pipeline staleness
    const pipelineDoneTasks = tasks.filter(t => {
      if (t.status !== 'Done') return false;
      return inferStrategicCategory(t) === 'pipeline_relationship';
    });
    let pipelineStaleDays = 999;
    if (pipelineDoneTasks.length > 0) {
      const latest = pipelineDoneTasks.reduce((a, b) =>
        new Date(a.updated_at) > new Date(b.updated_at) ? a : b
      );
      pipelineStaleDays = differenceInDays(now, new Date(latest.updated_at));
    }

    const shouldBoostPipeline = pipelineStaleDays >= 5 || calendarUtilization < 0.7;

    return {
      consultingAdminMinutes,
      productMinutes,
      pipelineMinutes,
      personalMinutes,
      totalMinutes,
      consultingAdminCapMinutes: WEEKLY_CONSULTING_ADMIN_CAP,
      isOverCapacity: consultingAdminMinutes > WEEKLY_CONSULTING_ADMIN_CAP,
      calendarUtilization,
      weeklyCapacityMinutes,
      pipelineStaleDays,
      shouldBoostPipeline,
    };
  }, [tasks, blocks, weeklyCapacityHours]);
}
