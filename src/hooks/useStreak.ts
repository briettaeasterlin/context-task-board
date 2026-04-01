import { useMemo } from 'react';
import type { Task } from '@/types/task';
import { format, subDays, startOfDay, startOfWeek, endOfWeek, getDay } from 'date-fns';

export function useStreak(tasks: Task[]) {
  return useMemo(() => {
    const doneDates = new Set<string>();
    const doneByDate: Record<string, number> = {};
    const doneByDow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const weekStartDate = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const weekEndDate = endOfWeek(today, { weekStartsOn: 1 });
    const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');
    const weekEndStr = format(weekEndDate, 'yyyy-MM-dd');

    // Track week-level planned and cleared
    let weekCleared = 0;
    const weekPlannedIds = new Set<string>();

    for (const t of tasks) {
      if (t.status === 'Done') {
        const d = format(new Date(t.updated_at), 'yyyy-MM-dd');
        doneDates.add(d);
        doneByDate[d] = (doneByDate[d] ?? 0) + 1;
        doneByDow[getDay(new Date(t.updated_at))] += 1;

        // Count cleared this week
        if (d >= weekStartStr && d <= weekEndStr) {
          weekCleared++;
          weekPlannedIds.add(t.id);
        }
      }

      // Count tasks that had planned_date in this week (whether done or not)
      if (t.planned_date && t.planned_date >= weekStartStr && t.planned_date <= weekEndStr) {
        weekPlannedIds.add(t.id);
      }
    }

    const weekPlanned = weekPlannedIds.size;

    // Calculate streak
    let streak = 0;
    let checkDate = today;

    if (!doneDates.has(todayStr)) {
      checkDate = subDays(today, 1);
      const yesterdayStr = format(checkDate, 'yyyy-MM-dd');
      if (doneDates.has(yesterdayStr)) {
        streak = 1;
        checkDate = subDays(checkDate, 1);
        while (doneDates.has(format(checkDate, 'yyyy-MM-dd'))) {
          streak++;
          checkDate = subDays(checkDate, 1);
        }
      }
    } else {
      streak = 1;
      checkDate = subDays(today, 1);
      while (doneDates.has(format(checkDate, 'yyyy-MM-dd'))) {
        streak++;
        checkDate = subDays(checkDate, 1);
      }
    }

    // Best day of week (this week only)
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekDoneByDow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const t of tasks) {
      if (t.status === 'Done') {
        const d = format(new Date(t.updated_at), 'yyyy-MM-dd');
        if (d >= weekStartStr && d <= weekEndStr) {
          weekDoneByDow[getDay(new Date(t.updated_at))] += 1;
        }
      }
    }
    let bestDow = 1;
    let bestDowCount = 0;
    for (let i = 0; i < 7; i++) {
      if (weekDoneByDow[i] > bestDowCount) {
        bestDowCount = weekDoneByDow[i];
        bestDow = i;
      }
    }

    const totalDone = tasks.filter(t => t.status === 'Done').length;
    const doneToday = doneByDate[todayStr] ?? 0;

    return {
      streak,
      weekCleared,
      weekPlanned: Math.max(weekPlanned, weekCleared),
      weekCompletionRate: weekPlanned > 0 ? Math.round((weekCleared / Math.max(weekPlanned, 1)) * 100) : 0,
      bestDay: bestDowCount > 0 ? dowNames[bestDow] : '—',
      totalDone,
      doneToday,
    };
  }, [tasks]);
}
