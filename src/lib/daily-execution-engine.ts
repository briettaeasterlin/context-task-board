import type { Task } from '@/types/task';
import type { PlannedBlock, CalendarEvent } from '@/hooks/usePlanner';
import {
  scoreTasks,
  buildScoringContext,
  DURATION_MINUTES,
  estimateDuration,
  inferStrategicCategory,
  type ScoredTask,
  type ScoringContext,
} from '@/lib/task-scoring';
import { format } from 'date-fns';

// ─── Types ───

export type TaskRole = 'frog' | 'supporting' | 'warmup';

export interface ExecutionPlanTask {
  task: ScoredTask;
  role: TaskRole;
  reason: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
}

export interface DailyExecutionPlan {
  warmupTask: ExecutionPlanTask | null;
  frogTask: ExecutionPlanTask | null;
  supportingTasks: ExecutionPlanTask[];
  meetingCount: number;
  meetingLimited: boolean;
  skipped: boolean;
}

// ─── Meeting Detection ───

export function detectMeetingLoad(
  calendarEvents: CalendarEvent[],
  targetDate: string,
): number {
  return calendarEvents.filter(ev => {
    if (ev.is_all_day) return false;
    const evDate = new Date(ev.start_time);
    const evDateStr = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`;
    return evDateStr === targetDate;
  }).length;
}

// ─── Slot Finder (reused from auto-schedule) ───

interface OccupiedBlock {
  startMinutes: number;
  durationMinutes: number;
}

interface FreeSlot {
  startMinutes: number;
  durationMinutes: number;
}

function getOccupiedBlocks(
  targetDate: string,
  existingBlocks: PlannedBlock[],
  calendarEvents: CalendarEvent[],
): OccupiedBlock[] {
  const dayBlocks = existingBlocks.filter(b => b.date === targetDate);
  const dayEvents = calendarEvents.filter(ev => {
    if (ev.is_all_day) return false;
    const evDate = new Date(ev.start_time);
    const evDateStr = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`;
    return evDateStr === targetDate;
  });

  const occupied: OccupiedBlock[] = [];
  for (const b of dayBlocks) {
    const [h, m] = b.start_time.split(':').map(Number);
    occupied.push({ startMinutes: h * 60 + m, durationMinutes: b.duration_minutes });
  }
  for (const ev of dayEvents) {
    const start = new Date(ev.start_time);
    const end = new Date(ev.end_time);
    occupied.push({
      startMinutes: start.getHours() * 60 + start.getMinutes(),
      durationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
    });
  }
  return occupied;
}

function findFreeSlots(
  occupied: OccupiedBlock[],
  dayStartMinutes: number,
  dayEndMinutes: number,
  minSlotMinutes = 10,
): FreeSlot[] {
  const sorted = [...occupied].sort((a, b) => a.startMinutes - b.startMinutes);
  const slots: FreeSlot[] = [];
  let cursor = dayStartMinutes;

  for (const block of sorted) {
    if (block.startMinutes > cursor) {
      const gap = block.startMinutes - cursor;
      if (gap >= minSlotMinutes) slots.push({ startMinutes: cursor, durationMinutes: gap });
    }
    cursor = Math.max(cursor, block.startMinutes + block.durationMinutes);
  }
  if (dayEndMinutes > cursor) {
    const gap = dayEndMinutes - cursor;
    if (gap >= minSlotMinutes) slots.push({ startMinutes: cursor, durationMinutes: gap });
  }
  return slots;
}

function findSlotInWindow(
  slots: FreeSlot[],
  windowStartMin: number,
  windowEndMin: number,
  requiredMinutes: number,
): { startMinutes: number } | null {
  for (const slot of slots) {
    const slotEnd = slot.startMinutes + slot.durationMinutes;
    const effectiveStart = Math.max(slot.startMinutes, windowStartMin);
    const effectiveEnd = Math.min(slotEnd, windowEndMin);
    if (effectiveEnd - effectiveStart >= requiredMinutes) {
      return { startMinutes: effectiveStart };
    }
  }
  return null;
}

function findFirstFitSlot(
  slots: FreeSlot[],
  requiredMinutes: number,
  afterMinutes = 0,
  usedSlots: Map<number, number> = new Map(),
): { slotIndex: number; startMinutes: number } | null {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const consumed = usedSlots.get(i) ?? 0;
    const availStart = Math.max(slot.startMinutes + consumed, afterMinutes);
    const availEnd = slot.startMinutes + slot.durationMinutes;
    if (availEnd - availStart >= requiredMinutes) {
      return { slotIndex: i, startMinutes: availStart };
    }
  }
  return null;
}

// ─── Task Selection ───

function getTaskDuration(task: Task | ScoredTask): number {
  return task.estimated_minutes ?? DURATION_MINUTES[estimateDuration(task.title)];
}

function isAdminTask(task: Task): boolean {
  const cat = inferStrategicCategory(task);
  return cat === 'personal_admin' || cat === 'side_project';
}

function isBlocked(task: Task): boolean {
  return !!task.blocked_by;
}

export function selectFrogTask(
  scored: ScoredTask[],
  scheduledIds: Set<string>,
): ScoredTask | null {
  const candidates = scored.filter(t =>
    !scheduledIds.has(t.id) &&
    !isBlocked(t) &&
    !isAdminTask(t) &&
    getTaskDuration(t) >= 45
  );
  // Already sorted by priorityScore desc — first one wins
  return candidates[0] ?? null;
}

export function selectSupportingTasks(
  scored: ScoredTask[],
  frogProjectId: string | null,
  scheduledIds: Set<string>,
  max = 2,
): ScoredTask[] {
  const eligible = scored.filter(t =>
    !scheduledIds.has(t.id) &&
    !isBlocked(t) &&
    getTaskDuration(t) <= 45
  );

  const results: ScoredTask[] = [];

  // Prefer same project as frog
  if (frogProjectId) {
    const sameProject = eligible.filter(t => t.project_id === frogProjectId);
    for (const t of sameProject) {
      if (results.length >= max) break;
      results.push(t);
    }
  }

  // Fill remaining from other projects
  if (results.length < max) {
    const picked = new Set(results.map(t => t.id));
    for (const t of eligible) {
      if (results.length >= max) break;
      if (!picked.has(t.id)) results.push(t);
    }
  }

  return results;
}

export function selectWarmupTask(
  scored: ScoredTask[],
  scheduledIds: Set<string>,
): ScoredTask | null {
  const candidates = scored.filter(t =>
    !scheduledIds.has(t.id) &&
    !isBlocked(t) &&
    getTaskDuration(t) <= 20 &&
    (isAdminTask(t) || t.strategicValue <= 15)
  );
  return candidates[0] ?? null;
}

// ─── Main Engine ───

export function generateDailyExecutionPlan(
  allTasks: Task[],
  existingBlocks: PlannedBlock[],
  calendarEvents: CalendarEvent[],
  targetDate: string,
  options: {
    dayStartHour?: number;
    dayEndHour?: number;
    calendarUtilization?: number;
    workCutoffMinutes?: number;
  } = {},
): DailyExecutionPlan {
  const {
    dayStartHour = 8,
    dayEndHour = 18,
    calendarUtilization,
    workCutoffMinutes = 16 * 60 + 30,
  } = options;

  const emptyPlan: DailyExecutionPlan = {
    warmupTask: null,
    frogTask: null,
    supportingTasks: [],
    meetingCount: 0,
    meetingLimited: false,
    skipped: false,
  };

  // Skip weekends
  const targetDay = new Date(targetDate + 'T12:00:00').getDay();
  if (targetDay === 0 || targetDay === 6) return { ...emptyPlan, skipped: true };

  // Meeting load
  const meetingCount = detectMeetingLoad(calendarEvents, targetDate);
  if (meetingCount >= 4) {
    return { ...emptyPlan, meetingCount, meetingLimited: true, skipped: true };
  }

  const scheduledIds = new Set(
    existingBlocks.filter(b => b.date === targetDate).map(b => b.task_id).filter(Boolean) as string[]
  );

  const candidateTasks = allTasks.filter(t =>
    (t.status === 'Today' || t.status === 'Next') &&
    !scheduledIds.has(t.id)
  );

  if (candidateTasks.length === 0) return { ...emptyPlan, meetingCount };

  const ctx = buildScoringContext(allTasks, calendarUtilization);
  const scored = scoreTasks(candidateTasks, allTasks, ctx);

  const occupied = getOccupiedBlocks(targetDate, existingBlocks, calendarEvents);
  const freeSlots = findFreeSlots(occupied, dayStartHour * 60, dayEndHour * 60);
  const usedSlots = new Map<number, number>();

  const placedIds = new Set<string>(scheduledIds);

  // 1. Select & schedule Frog
  let frogTask: ExecutionPlanTask | null = null;
  const frog = selectFrogTask(scored, placedIds);
  if (frog) {
    const frogDuration = getTaskDuration(frog);
    // Try morning deep-work window 9:00-11:30
    let slot = findSlotInWindow(freeSlots, 9 * 60, 11 * 60 + 30, frogDuration);
    // Fallback: any slot >= 60 min
    if (!slot) {
      const fit = findFirstFitSlot(freeSlots, Math.max(frogDuration, 60), 0, usedSlots);
      if (fit) slot = { startMinutes: fit.startMinutes };
    }
    // Fallback: any slot that fits the actual duration
    if (!slot) {
      const fit = findFirstFitSlot(freeSlots, frogDuration, 0, usedSlots);
      if (fit) slot = { startMinutes: fit.startMinutes };
    }

    if (slot) {
      const reason = meetingCount >= 3
        ? 'MEETING-LIMITED DAY: only scheduling the most important task.'
        : 'EAT THE FROG: high strategic value and advances project completion.';

      frogTask = {
        task: frog,
        role: 'frog',
        reason,
        date: targetDate,
        startMinutes: slot.startMinutes,
        durationMinutes: frogDuration,
      };
      placedIds.add(frog.id);

      // Mark slot usage
      for (let i = 0; i < freeSlots.length; i++) {
        const s = freeSlots[i];
        if (slot.startMinutes >= s.startMinutes && slot.startMinutes < s.startMinutes + s.durationMinutes) {
          usedSlots.set(i, (usedSlots.get(i) ?? 0) + frogDuration);
          break;
        }
      }
    }
  }

  // If meeting-heavy, only schedule the frog
  if (meetingCount >= 3) {
    return {
      warmupTask: null,
      frogTask,
      supportingTasks: [],
      meetingCount,
      meetingLimited: true,
      skipped: false,
    };
  }

  // 2. Select & schedule warm-up
  let warmupTask: ExecutionPlanTask | null = null;
  const warmup = selectWarmupTask(scored, placedIds);
  if (warmup) {
    const warmupDuration = getTaskDuration(warmup);
    // Try 8:00–9:30 window
    const slot = findSlotInWindow(freeSlots, 8 * 60, 9 * 60 + 30, warmupDuration);
    if (slot) {
      warmupTask = {
        task: warmup,
        role: 'warmup',
        reason: 'WARM-UP: short admin task to start the day.',
        date: targetDate,
        startMinutes: slot.startMinutes,
        durationMinutes: warmupDuration,
      };
      placedIds.add(warmup.id);
    }
  }

  // 3. Select & schedule supporting tasks
  const supportingTasks: ExecutionPlanTask[] = [];
  const supporting = selectSupportingTasks(scored, frog?.project_id ?? null, placedIds);
  for (const st of supporting) {
    const dur = getTaskDuration(st);
    const fit = findFirstFitSlot(freeSlots, dur, 0, usedSlots);
    if (fit && (fit.startMinutes + dur) <= workCutoffMinutes) {
      const sameProject = frog?.project_id && st.project_id === frog.project_id;
      supportingTasks.push({
        task: st,
        role: 'supporting',
        reason: sameProject
          ? 'SUPPORTING TASK: grouped with the Frog project to maintain momentum.'
          : 'SUPPORTING TASK: next highest priority task.',
        date: targetDate,
        startMinutes: fit.startMinutes,
        durationMinutes: dur,
      });
      placedIds.add(st.id);
      usedSlots.set(fit.slotIndex, (usedSlots.get(fit.slotIndex) ?? 0) + dur);
    }
  }

  return {
    warmupTask,
    frogTask,
    supportingTasks,
    meetingCount,
    meetingLimited: false,
    skipped: false,
  };
}
