import { useMemo, useCallback } from 'react';
import type { Task } from '@/types/task';
import type { PlannedBlock, CalendarEvent } from '@/hooks/usePlanner';
import { scoreTasks, buildScoringContext, DURATION_MINUTES, estimateDuration, type ScoredTask } from '@/lib/task-scoring';

export interface FreeSlot {
  startMinutes: number;
  durationMinutes: number;
}

export interface ScheduleSuggestion {
  task: ScoredTask;
  startMinutes: number;
  durationMinutes: number;
}

/**
 * Find free slots in a day between dayStartHour and dayEndHour,
 * avoiding existing blocks and calendar events.
 */
function findFreeSlots(
  existingBlocks: { startMinutes: number; durationMinutes: number }[],
  dayStartHour: number,
  dayEndHour: number,
  minSlotMinutes = 15,
): FreeSlot[] {
  const dayStart = dayStartHour * 60;
  const dayEnd = dayEndHour * 60;

  // Sort occupied blocks
  const occupied = [...existingBlocks]
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const slots: FreeSlot[] = [];
  let cursor = dayStart;

  for (const block of occupied) {
    if (block.startMinutes > cursor) {
      const gap = block.startMinutes - cursor;
      if (gap >= minSlotMinutes) {
        slots.push({ startMinutes: cursor, durationMinutes: gap });
      }
    }
    cursor = Math.max(cursor, block.startMinutes + block.durationMinutes);
  }

  // Trailing free time
  if (dayEnd > cursor) {
    const gap = dayEnd - cursor;
    if (gap >= minSlotMinutes) {
      slots.push({ startMinutes: cursor, durationMinutes: gap });
    }
  }

  return slots;
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
    /** Hard cutoff for work tasks (minutes from midnight). Default 16:30 = 990 */
    workCutoffMinutes?: number;
  } = {}
): ScheduleSuggestion[] {
  const {
    maxTasks = 3,
    dayStartHour = 8,
    dayEndHour = 18,
    calendarUtilization,
    workCutoffMinutes = 16 * 60 + 30, // 4:30 PM
  } = options;

  // Skip weekends entirely
  const targetDay = new Date(targetDate + 'T12:00:00').getDay(); // 0=Sun, 6=Sat
  if (targetDay === 0 || targetDay === 6) return [];

  // Build occupied blocks from existing planned blocks and calendar events
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

  const freeSlots = findFreeSlots(occupied, dayStartHour, dayEndHour);

  // Get schedulable tasks (Today or Next, not already scheduled today)
  const scheduledIds = new Set(dayBlocks.map(b => b.task_id).filter(Boolean));
  const candidateTasks = allTasks.filter(t =>
    (t.status === 'Today' || t.status === 'Next') &&
    !scheduledIds.has(t.id)
  );

  if (candidateTasks.length === 0 || freeSlots.length === 0) return [];

  // Score and sort
  const ctx = buildScoringContext(allTasks, calendarUtilization);
  const scored = scoreTasks(candidateTasks, allTasks, ctx);

  // Greedily assign top tasks to first fitting slot
  const suggestions: ScheduleSuggestion[] = [];
  const usedSlotTime: Map<number, number> = new Map(); // slotIndex -> consumed minutes

  for (const task of scored) {
    if (suggestions.length >= maxTasks) break;

    const taskDuration = task.estimated_minutes ?? DURATION_MINUTES[task.estimatedDuration];

    for (let si = 0; si < freeSlots.length; si++) {
      const slot = freeSlots[si];
      const consumed = usedSlotTime.get(si) ?? 0;
      const availableStart = slot.startMinutes + consumed;
      const availableDuration = slot.durationMinutes - consumed;

      if (taskDuration <= availableDuration) {
        suggestions.push({
          task,
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

  return { suggestions };
}
