import { useMemo } from 'react';
import type { Task } from '@/types/task';
import { format, subDays, startOfDay, isToday, getDay } from 'date-fns';

export function useStreak(tasks: Task[]) {
  return useMemo(() => {
    // Get all dates where at least one task was marked Done
    const doneDates = new Set<string>();
    const doneByDate: Record<string, number> = {};
    const doneByDow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    for (const t of tasks) {
      if (t.status === 'Done') {
        const d = format(new Date(t.updated_at), 'yyyy-MM-dd');
        doneDates.add(d);
        doneByDate[d] = (doneByDate[d] ?? 0) + 1;
        doneByDow[getDay(new Date(t.updated_at))] += 1;
      }
    }

    // Calculate streak (consecutive days ending today or yesterday)
    let streak = 0;
    const today = startOfDay(new Date());
    let checkDate = today;
    
    // Start from today; if today has no completions, start from yesterday
    const todayStr = format(today, 'yyyy-MM-dd');
    if (!doneDates.has(todayStr)) {
      checkDate = subDays(today, 1);
      const yesterdayStr = format(checkDate, 'yyyy-MM-dd');
      if (!doneDates.has(yesterdayStr)) {
        // No streak
        streak = 0;
      } else {
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

    // Weekly stats (last 7 days)
    const weekStart = subDays(today, 6);
    let weekPlanned = 0;
    let weekCleared = 0;
    for (let i = 0; i < 7; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      const count = doneByDate[d] ?? 0;
      weekCleared += count;
      // Rough "planned" = tasks that were either done or are currently planned for today-ish
      weekPlanned += Math.max(count, 0);
    }

    // Best day of week
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let bestDow = 0;
    let bestDowCount = 0;
    for (let i = 0; i < 7; i++) {
      if (doneByDow[i] > bestDowCount) {
        bestDowCount = doneByDow[i];
        bestDow = i;
      }
    }

    // Total all time
    const totalDone = tasks.filter(t => t.status === 'Done').length;

    // Done today
    const doneToday = doneByDate[todayStr] ?? 0;

    return {
      streak,
      weekCleared,
      weekPlanned: Math.max(weekPlanned, weekCleared),
      weekCompletionRate: weekPlanned > 0 ? Math.round((weekCleared / Math.max(weekPlanned, 1)) * 100) : 0,
      bestDay: dowNames[bestDow],
      totalDone,
      doneToday,
    };
  }, [tasks]);
}
