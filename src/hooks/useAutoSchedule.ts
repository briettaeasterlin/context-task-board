import { useMemo, useCallback } from 'react';
import type { Task } from '@/types/task';
import type { PlannedBlock, CalendarEvent } from '@/hooks/usePlanner';
import { scoreTasks, buildScoringContext, DURATION_MINUTES, estimateDuration, type ScoredTask } from '@/lib/task-scoring';
import { format, addDays, startOfWeek, endOfWeek, isWeekend } from 'date-fns';

export interface FreeSlot {
  startMinutes: number;
  durationMinutes: number;
}

export interface ScheduleSuggestion {
  task: ScoredTask;
  date: string;
  startMinutes: number;
  durationMinutes: number;
}

/**
 * Find free slots in a day between dayStartMinutes and dayEndMinutes,
 * avoiding existing blocks and calendar events.
 */
function findFreeSlots(
  existingBlocks: { startMinutes: number; durationMinutes: number }[],
  dayStartMinutes: number,
  dayEndMinutes: number,
  minSlotMinutes = 15,
): FreeSlot[] {
  const occupied = [...existingBlocks]
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const slots: FreeSlot[] = [];
  let cursor = dayStartMinutes;

  for (const block of occupied) {
    if (block.startMinutes > cursor) {
      const gap = block.startMinutes - cursor;
      if (gap >= minSlotMinutes) {
        slots.push({ startMinutes: cursor, durationMinutes: gap });
      }
    }
    cursor = Math.max(cursor, block.startMinutes + block.durationMinutes);
  }

  if (dayEndMinutes > cursor) {
    const gap = dayEndMinutes - cursor;
    if (gap >= minSlotMinutes) {
      slots.push({ startMinutes: cursor, durationMinutes: gap });
    }
  }

  return slots;
}

/** Calculate total free minutes for a date */
function calcDayFreeMinutes(
  date: string,
  existingBlocks: PlannedBlock[],
  calendarEvents: CalendarEvent[],
  dayStartHour: number,
  dayEndHour: number,
): number {
  const occupied = getOccupiedBlocks(date, existingBlocks, calendarEvents);
  const slots = findFreeSlots(occupied, dayStartHour * 60, dayEndHour * 60);
  return slots.reduce((sum, s) => sum + s.durationMinutes, 0);
}

function getOccupiedBlocks(
  targetDate: string,
  existingBlocks: PlannedBlock[],
  calendarEvents: CalendarEvent[],
): { startMinutes: number; durationMinutes: number }[] {
  const dayBlocks = existingBlocks.filter(b => b.date === targetDate);
  const dayEvents = calendarEvents.filter(ev => {
    if (ev.is_all_day) return false;
    const evDate = new Date(ev.start_time);
    const evDateStr = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`;
    return evDateStr === targetDate;
  });

  const occupied: { startMinutes: number; durationMinutes: number }[] = [];

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

/**
 * Auto-schedule top N tasks into free slots for a given day.
 */
export function autoSchedule(
  allTasks: Task[],
  existingBlocks: PlannedBlock[],
  calendarEvents: CalendarEvent[],
  targetDate: string,
  options: {
    maxTasks?: number;
    dayStartHour?: number;
    dayEndHour?: number;
    calendarUtilization?: number;
    workCutoffMinutes?: number;
  } = {}
): ScheduleSuggestion[] {
  const {
    maxTasks = 3,
    dayStartHour = 8,
    dayEndHour = 18,
    calendarUtilization,
    workCutoffMinutes = 16 * 60 + 30,
  } = options;

  // Skip weekends
  const targetDay = new Date(targetDate + 'T12:00:00').getDay();
  if (targetDay === 0 || targetDay === 6) return [];

  const occupied = getOccupiedBlocks(targetDate, existingBlocks, calendarEvents);
  const freeSlots = findFreeSlots(occupied, dayStartHour * 60, dayEndHour * 60);

  const isWorkTask = (t: Task) => t.area === 'Client' || t.area === 'Business';

  // Exclude tasks already scheduled on this day
  const scheduledIds = new Set(
    existingBlocks.filter(b => b.date === targetDate).map(b => b.task_id).filter(Boolean)
  );
  const candidateTasks = allTasks.filter(t =>
    (t.status === 'Today' || t.status === 'Next') &&
    !scheduledIds.has(t.id)
  );

  if (candidateTasks.length === 0 || freeSlots.length === 0) return [];

  const ctx = buildScoringContext(allTasks, calendarUtilization);
  const scored = scoreTasks(candidateTasks, allTasks, ctx);

  const suggestions: ScheduleSuggestion[] = [];
  const usedSlotTime: Map<number, number> = new Map();

  for (const task of scored) {
    if (suggestions.length >= maxTasks) break;

    const taskDuration = task.estimated_minutes ?? DURATION_MINUTES[task.estimatedDuration];

    for (let si = 0; si < freeSlots.length; si++) {
      const slot = freeSlots[si];
      const consumed = usedSlotTime.get(si) ?? 0;
      const availableStart = slot.startMinutes + consumed;
      const availableDuration = slot.durationMinutes - consumed;

      if (taskDuration <= availableDuration) {
        if (isWorkTask(task) && (availableStart + taskDuration) > workCutoffMinutes) {
          continue;
        }
        suggestions.push({
          task,
          date: targetDate,
          startMinutes: availableStart,
          durationMinutes: taskDuration,
        });
        usedSlotTime.set(si, consumed + taskDuration);
        break;
      }
    }
  }

  return suggestions;
}

/**
 * Auto-schedule across the remaining weekdays of the current week,
 * preferring days with the most free time.
 */
export function autoScheduleWeek(
  allTasks: Task[],
  existingBlocks: PlannedBlock[],
  calendarEvents: CalendarEvent[],
  options: {
    maxTasks?: number;
    dayStartHour?: number;
    dayEndHour?: number;
    calendarUtilization?: number;
    workCutoffMinutes?: number;
  } = {}
): ScheduleSuggestion[] {
  const {
    maxTasks = 3,
    dayStartHour = 8,
    dayEndHour = 18,
    calendarUtilization,
    workCutoffMinutes = 16 * 60 + 30,
  } = options;

  const today = new Date();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // Collect remaining weekdays from today through Friday
  const candidateDays: { date: string; freeMinutes: number }[] = [];
  let d = new Date(today);
  while (d <= weekEnd) {
    if (!isWeekend(d)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const freeMinutes = calcDayFreeMinutes(dateStr, existingBlocks, calendarEvents, dayStartHour, dayEndHour);
      candidateDays.push({ date: dateStr, freeMinutes });
    }
    d = addDays(d, 1);
  }

  // Sort days by most free time first
  candidateDays.sort((a, b) => b.freeMinutes - a.freeMinutes);

  // Get all schedulable tasks
  const allScheduledIds = new Set(
    existingBlocks.map(b => b.task_id).filter(Boolean)
  );
  const eligible = allTasks.filter(t =>
    (t.status === 'Today' || t.status === 'Next') &&
    !allScheduledIds.has(t.id)
  );

  if (eligible.length === 0) return [];

  const ctx = buildScoringContext(allTasks, calendarUtilization);
  const scored = scoreTasks(eligible, allTasks, ctx);

  const suggestions: ScheduleSuggestion[] = [];
  const placedTaskIds = new Set<string>();
  const isWorkTask = (t: Task) => t.area === 'Client' || t.area === 'Business';

  // For each day (emptiest first), fill free slots with top unplaced tasks
  for (const day of candidateDays) {
    if (suggestions.length >= maxTasks) break;

    const occupied = getOccupiedBlocks(day.date, existingBlocks, calendarEvents);
    // Also add any suggestions we've already placed on this day
    for (const s of suggestions) {
      if (s.date === day.date) {
        occupied.push({ startMinutes: s.startMinutes, durationMinutes: s.durationMinutes });
      }
    }
    const freeSlots = findFreeSlots(occupied, dayStartHour * 60, dayEndHour * 60);
    const usedSlotTime: Map<number, number> = new Map();

    for (const task of scored) {
      if (suggestions.length >= maxTasks) break;
      if (placedTaskIds.has(task.id)) continue;

      const taskDuration = task.estimated_minutes ?? DURATION_MINUTES[task.estimatedDuration];

      for (let si = 0; si < freeSlots.length; si++) {
        const slot = freeSlots[si];
        const consumed = usedSlotTime.get(si) ?? 0;
        const availableStart = slot.startMinutes + consumed;
        const availableDuration = slot.durationMinutes - consumed;

        if (taskDuration <= availableDuration) {
          if (isWorkTask(task) && (availableStart + taskDuration) > workCutoffMinutes) {
            continue;
          }
          suggestions.push({
            task,
            date: day.date,
            startMinutes: availableStart,
            durationMinutes: taskDuration,
          });
          usedSlotTime.set(si, consumed + taskDuration);
          placedTaskIds.add(task.id);
          break;
        }
      }
    }
  }

  return suggestions;
}

export function useAutoSchedule(
  allTasks: Task[],
  blocks: PlannedBlock[],
  events: CalendarEvent[],
  targetDate: string,
  calendarUtilization?: number,
) {
  const suggestions = useMemo(() =>
    autoSchedule(allTasks, blocks, events, targetDate, {
      maxTasks: 3,
      calendarUtilization,
    }),
    [allTasks, blocks, events, targetDate, calendarUtilization]
  );

  const weekSuggestions = useMemo(() =>
    autoScheduleWeek(allTasks, blocks, events, {
      maxTasks: 3,
      calendarUtilization,
    }),
    [allTasks, blocks, events, calendarUtilization]
  );

  return { suggestions, weekSuggestions };
}
