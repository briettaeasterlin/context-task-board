import { useMemo, useState } from 'react';
import type { Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, ArrowRight, ChevronDown, ChevronUp, ArrowDownToLine, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tasks: Task[];
  onHighlightTask?: (taskId: string) => void;
  onDemoteTask?: (taskId: string) => void;
  onMarkDone?: (taskId: string) => void;
}

export function RouteBrief({ tasks, onHighlightTask, onDemoteTask, onMarkDone }: Props) {
  const now = new Date();
  const isEvening = now.getHours() >= 18;
  const [expanded, setExpanded] = useState(false);

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

    const nextMove = todayStops.sort((a, b) => {
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

    return { clearedYesterday, todayStops, todayStopsCount: todayStops.length, doneToday, nextMove, projectsAdvanced, allDone };
  }, [tasks]);

  if (stats.todayStopsCount === 0 && stats.doneToday === 0 && stats.clearedYesterday === 0) return null;

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

  const isTooMany = stats.todayStopsCount > 6;

  // Standard morning/day variant
  return (
    <Card className="rounded-xl border-accent/10 overflow-hidden">
      <div className="p-5">
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
            <span className="font-semibold text-accent">{stats.todayStopsCount}</span> stop{stats.todayStopsCount !== 1 ? 's' : ''} on today's route.
            {isTooMany && (
              <span className="text-muted-foreground text-xs ml-2 font-mono">That's a lot — consider trimming.</span>
            )}
          </p>
        </div>

        {/* Expand / collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>Hide route <ChevronUp className="h-3.5 w-3.5 ml-1" /></>
          ) : (
            <>Preview & edit route <ChevronDown className="h-3.5 w-3.5 ml-1" /></>
          )}
        </Button>
      </div>

      {/* Expandable route list */}
      {expanded && (
        <div className="border-t border-border/40 px-5 py-3 max-h-[400px] overflow-y-auto">
          <div className="relative ml-2">
            <div className="absolute left-[3px] top-1 bottom-1 w-px bg-mint" />
            <div className="space-y-1">
              {stats.todayStops
                .sort((a, b) => {
                  if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                  if (a.due_date) return -1;
                  if (b.due_date) return 1;
                  return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                })
                .map((task, idx) => (
                  <div
                    key={task.id}
                    className="group flex items-center gap-3 relative py-1.5 rounded-lg hover:bg-muted/40 px-1 -mx-1 transition-colors"
                  >
                    <span className={cn(
                      'relative z-10 w-[7px] h-[7px] rounded-full border-2 flex-shrink-0',
                      idx === 0
                        ? 'border-accent bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.4)]'
                        : 'border-primary/40 bg-card'
                    )} />
                    <span
                      className="text-sm flex-1 truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onHighlightTask?.(task.id)}
                    >
                      {task.title}
                    </span>
                    {task.due_date && (
                      <Badge variant="outline" className="text-[10px] font-mono rounded-full shrink-0">
                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {onMarkDone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-accent"
                          title="Mark done"
                          onClick={(e) => { e.stopPropagation(); onMarkDone(task.id); }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDemoteTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-destructive"
                          title="Move to Backlog"
                          onClick={(e) => { e.stopPropagation(); onDemoteTask(task.id); }}
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          {isTooMany && (
            <p className="text-[11px] text-muted-foreground font-mono mt-3 ml-5">
              Tip: aim for 3–6 stops per day. Use ↓ to move items to Backlog.
            </p>
          )}
        </div>
      )}

      {/* Next move */}
      {stats.nextMove && !expanded && (
        <div className="px-5 pb-5">
          <div className="pt-3 border-t border-border/40">
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
        </div>
      )}
    </Card>
  );
}
