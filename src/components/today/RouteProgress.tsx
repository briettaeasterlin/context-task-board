import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tasks: Task[];
}

export function RouteProgress({ tasks }: Props) {
  const stats = useMemo(() => {
    const todayAndNext = tasks.filter(t => t.status === 'Today' || t.status === 'Next' || t.status === 'Done');
    const done = tasks.filter(t => t.status === 'Done').length;
    const inProgress = tasks.filter(t => t.status === 'Today').length;
    const upcoming = tasks.filter(t => t.status === 'Next').length;
    const total = done + inProgress + upcoming;
    const completionRatio = total > 0 ? done / total : 0;
    return { done, inProgress, upcoming, total, completionRatio };
  }, [tasks]);

  // Tomorrow's suggested moves: Next tasks + incomplete Today tasks, top 4
  const tomorrowMoves = useMemo(() => {
    const candidates = tasks
      .filter(t => t.status === 'Next' || t.status === 'Today')
      .sort((a, b) => {
        // Prioritize: Today status first (incomplete from today), then by sort_order
        if (a.status === 'Today' && b.status !== 'Today') return -1;
        if (b.status === 'Today' && a.status !== 'Today') return 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    return candidates.slice(0, 4);
  }, [tasks]);

  const routeNearlyComplete = stats.total > 0 && stats.completionRatio >= 0.7;

  const getMessage = () => {
    if (stats.total === 0) return null;
    if (stats.completionRatio >= 1) return 'Route complete. Well navigated.';
    if (stats.completionRatio >= 0.7) return 'Your route is nearly complete.';
    if (stats.completionRatio >= 0.3) return 'Your route is moving forward.';
    return 'Route plotted. Moving forward.';
  };

  const message = getMessage();
  if (stats.total === 0 && tomorrowMoves.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Route Progress */}
      {stats.total > 0 && (
        <Card className="p-5 rounded-xl">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-4 flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-accent/40 text-accent">
              <Navigation className="h-4 w-4" />
            </span>
            Today's Route
          </h3>

          {/* Transit-style progress nodes */}
          <div className="flex items-center gap-3 ml-1 mb-4">
            <div className="relative flex items-center gap-0">
              {/* Completed nodes */}
              {stats.done > 0 && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-xs font-mono text-foreground ml-1">{stats.done} cleared</span>
                </div>
              )}
              {stats.inProgress > 0 && (
                <div className="flex items-center gap-1 ml-4">
                  <span className="w-2 h-2 rounded-full border-2 border-accent bg-accent shadow-[0_0_4px_hsl(var(--accent)/0.4)]" />
                  <span className="text-xs font-mono text-foreground ml-1">{stats.inProgress} active</span>
                </div>
              )}
              {stats.upcoming > 0 && (
                <div className="flex items-center gap-1 ml-4">
                  <span className="w-2 h-2 rounded-full border-2 border-primary/40 bg-card" />
                  <span className="text-xs font-mono text-muted-foreground ml-1">{stats.upcoming} upcoming</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-muted overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${Math.round(stats.completionRatio * 100)}%` }}
            />
          </div>

          {message && (
            <p className="text-xs text-muted-foreground font-mono tracking-tight">{message}</p>
          )}
        </Card>
      )}

      {/* Next Move Preview — Tomorrow */}
      {tomorrowMoves.length > 0 && (
        <Card className="p-5 rounded-xl">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1">
            Next Move
          </h3>
          <p className="text-xs text-muted-foreground font-mono mb-4">
            Tomorrow already has direction:
          </p>

          <div className="relative ml-2">
            {/* Transit path */}
            <div className="absolute left-[3px] top-1 bottom-1 w-px bg-mint" />

            <div className="space-y-2.5">
              {tomorrowMoves.map((task, idx) => (
                <div key={task.id} className="flex items-center gap-3 relative">
                  <span className={cn(
                    'relative z-10 w-[7px] h-[7px] rounded-full border-2 flex-shrink-0',
                    idx === 0
                      ? 'border-accent bg-accent'
                      : 'border-primary/40 bg-card'
                  )} />
                  <span className="text-sm text-foreground truncate">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Day-end closure prompt */}
      {routeNearlyComplete && (
        <Card className="p-5 rounded-xl border-accent/20 bg-mint/10">
          <p className="text-sm text-foreground mb-1">
            Your route for today is nearly complete.
          </p>
          <p className="text-xs text-muted-foreground font-mono mb-4">
            Would you like to plot tomorrow's next move?
          </p>
          <Link to="/plan">
            <Button variant="outline" size="sm" className="rounded-full text-xs font-semibold hover:translate-x-px transition-all duration-150">
              Plan Tomorrow <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
