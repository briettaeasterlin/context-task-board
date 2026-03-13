import { useMemo } from 'react';
import type { Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tasks: Task[];
  onHighlightTask?: (taskId: string) => void;
}

export function RouteBrief({ tasks, onHighlightTask }: Props) {
  const now = new Date();
  const isEvening = now.getHours() >= 18;

  const stats = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clearedYesterday = tasks.filter(t =>
      t.status === 'Done' &&
      new Date(t.updated_at) >= yesterday &&
      new Date(t.updated_at) < today
    ).length;

    const todayStops = tasks.filter(t => t.status === 'Next' || t.status === 'Today');
    const doneToday = tasks.filter(t =>
      t.status === 'Done' &&
      new Date(t.updated_at) >= today
    ).length;

    // Next move: first Next task sorted by overdue → due_date → sort_order
    const nextMove = todayStops.sort((a, b) => {
      // Overdue first
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    })[0];

    const projectsAdvanced = new Set(
      tasks
        .filter(t => t.status === 'Done' && t.project_id && new Date(t.updated_at) >= today)
        .map(t => t.project_id)
    ).size;

    const allDone = todayStops.length === 0 && doneToday > 0;

    return { clearedYesterday, todayStops: todayStops.length, doneToday, nextMove, projectsAdvanced, allDone };
  }, [tasks]);

  if (stats.todayStops === 0 && stats.doneToday === 0 && stats.clearedYesterday === 0) return null;

  // Evening / all-done variant
  if (isEvening || stats.allDone) {
    return (
      <Card className="p-5 rounded-xl border-accent/20 bg-mint/5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-accent/40 text-accent">
            <Navigation className="h-3.5 w-3.5" />
          </span>
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Route Review</h3>
        </div>
        <p className="text-sm text-foreground">
          You cleared <span className="font-semibold text-accent">{stats.doneToday}</span> stop{stats.doneToday !== 1 ? 's' : ''} today.
          {stats.projectsAdvanced > 0 && (
            <> <span className="font-semibold text-accent">{stats.projectsAdvanced}</span> project{stats.projectsAdvanced !== 1 ? 's' : ''} advanced.</>
          )}
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-2 mb-3">Tomorrow's route is ready.</p>
        <Button variant="outline" size="sm" className="rounded-full text-xs font-semibold hover:translate-x-px transition-all duration-150">
          Review tomorrow <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </Card>
    );
  }

  // Standard morning/day variant
  return (
    <Card className="p-5 rounded-xl border-accent/10">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-accent/40 text-accent">
          <Navigation className="h-3.5 w-3.5" />
        </span>
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Today's Route</h3>
      </div>
      <div className="space-y-1 text-sm">
        {stats.clearedYesterday > 0 && (
          <p className="text-muted-foreground">
            You cleared <span className="text-foreground font-medium">{stats.clearedYesterday}</span> stop{stats.clearedYesterday !== 1 ? 's' : ''} yesterday.
          </p>
        )}
        <p className="text-foreground">
          <span className="font-semibold text-accent">{stats.todayStops}</span> stop{stats.todayStops !== 1 ? 's' : ''} on today's route.
        </p>
      </div>
      {stats.nextMove && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Next move</p>
          <p className="text-sm font-medium text-foreground">{stats.nextMove.title}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-full text-xs font-semibold hover:translate-x-px transition-all duration-150"
            onClick={() => onHighlightTask?.(stats.nextMove!.id)}
          >
            Start here <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}
    </Card>
  );
}
