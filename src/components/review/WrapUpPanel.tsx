import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useStreak } from '@/hooks/useStreak';
import type { Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Flame, BarChart3, Clock, Hourglass } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, subDays } from 'date-fns';

export function WrapUpPanel() {
  const navigate = useNavigate();
  const { tasks, updateTask } = useTasks();
  const { projects } = useProjects();
  const streak = useStreak(tasks);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  // Planned tasks for today (completed + incomplete)
  const plannedToday = useMemo(() =>
    tasks.filter(t => t.planned_date === todayStr || t.status === 'Today'),
  [tasks, todayStr]);

  const completedToday = useMemo(() =>
    plannedToday.filter(t => t.status === 'Done'),
  [plannedToday]);

  const incompleteToday = useMemo(() =>
    plannedToday.filter(t => t.status !== 'Done'),
  [plannedToday]);

  // If no planned tasks, show recently active tasks
  const recentlyActive = useMemo(() => {
    if (plannedToday.length > 0) return [];
    const weekAgo = subDays(new Date(), 7).toISOString();
    return tasks
      .filter(t => t.status !== 'Done' && t.status !== 'Someday' && t.updated_at >= weekAgo)
      .slice(0, 5);
  }, [plannedToday, tasks]);

  const showRecent = plannedToday.length === 0 && recentlyActive.length > 0;

  // Summary counts
  const movedForward = completedToday.length;
  const waitingCount = useMemo(() =>
    plannedToday.filter(t => t.status === 'Waiting').length,
  [plannedToday]);

  // Tomorrow preview
  const tomorrowPlan = useMemo(() =>
    tasks.filter(t => t.planned_date === tomorrowStr && t.status !== 'Done').slice(0, 5),
  [tasks, tomorrowStr]);

  const handleDone = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Done' }, {
      onSuccess: () => toast.success('Move cleared'),
    });
  }, [updateTask]);

  const handleTomorrow = useCallback((id: string) => {
    updateTask.mutate({ id, planned_date: tomorrowStr, status: 'Next' } as any, {
      onSuccess: () => toast.success('Added to tomorrow'),
    });
  }, [updateTask, tomorrowStr]);

  const handleBacklog = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Backlog', planned_date: null } as any, {
      onSuccess: () => toast.success('Moved to Backlog'),
    });
  }, [updateTask]);

  const handleWaiting = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Waiting', planned_date: null } as any, {
      onSuccess: () => toast.success('Marked as Waiting'),
    });
  }, [updateTask]);

  const renderTaskCard = (task: Task, isComplete: boolean) => {
    const taskProject = projectMap.get(task.project_id ?? '');
    return (
      <Card key={task.id} className={`rounded-xl overflow-hidden ${isComplete ? '' : 'border-muted-foreground/20'}`}>
        <div className="flex items-center gap-3 p-4">
          {taskProject?.line_color && (
            <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
          )}
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-sm border-2 border-muted-foreground/30 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className={`text-sm ${isComplete ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
            {taskProject && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{taskProject.name}</p>
            )}
          </div>
          {!isComplete && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg text-accent" onClick={() => handleDone(task.id)}>
                Done
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg" onClick={() => handleTomorrow(task.id)}>
                Tomorrow
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg text-muted-foreground" onClick={() => handleBacklog(task.id)}>
                Backlog
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg text-muted-foreground" onClick={() => handleWaiting(task.id)}>
                Waiting
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Scorecard */}
      <section>
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {showRecent ? 'Recently Active' : 'Today\'s Moves'}
        </h2>
        <div className="space-y-2">
          {completedToday.map(t => renderTaskCard(t, true))}
          {incompleteToday.map(t => renderTaskCard(t, false))}
          {showRecent && recentlyActive.map(t => renderTaskCard(t, false))}
          {plannedToday.length === 0 && recentlyActive.length === 0 && (
            <Card className="p-6 text-center rounded-xl">
              <p className="text-sm text-muted-foreground">No moves planned or active today.</p>
            </Card>
          )}
        </div>
      </section>

      {/* Daily summary */}
      {plannedToday.length > 0 && (
        <section className="grid grid-cols-3 gap-3">
          <Card className="p-3 rounded-xl text-center">
            <div className="text-lg font-display font-bold text-accent">{movedForward}</div>
            <div className="text-[11px] text-muted-foreground">completed</div>
          </Card>
          <Card className="p-3 rounded-xl text-center">
            <div className="text-lg font-display font-bold">{incompleteToday.length}</div>
            <div className="text-[11px] text-muted-foreground">remaining</div>
          </Card>
          <Card className="p-3 rounded-xl text-center">
            <div className="text-lg font-display font-bold">{waitingCount}</div>
            <div className="text-[11px] text-muted-foreground">waiting</div>
          </Card>
        </section>
      )}

      {/* Weekly Stats */}
      <section>
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Weekly Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 rounded-xl text-center">
            <div className="text-xs text-muted-foreground mb-1">This Week</div>
            <div className="text-2xl font-display font-bold text-accent">{streak.weekCleared}/{streak.weekPlanned}</div>
            <div className="text-xs text-muted-foreground">cleared · {streak.weekCompletionRate}%</div>
          </Card>
          <Card className="p-4 rounded-xl text-center">
            <div className="text-xs text-muted-foreground mb-1">All Time</div>
            <div className="text-2xl font-display font-bold">{streak.totalDone}</div>
            <div className="text-xs text-muted-foreground">moves</div>
          </Card>
          <Card className="p-4 rounded-xl text-center">
            <div className="text-xs text-muted-foreground mb-1">Streak</div>
            <div className="text-2xl font-display font-bold flex items-center justify-center gap-1">
              <Flame className="h-5 w-5 text-[#FFD300]" />
              {streak.streak}
            </div>
            <div className="text-xs text-muted-foreground">days</div>
          </Card>
          <Card className="p-4 rounded-xl text-center">
            <div className="text-xs text-muted-foreground mb-1">Best Day</div>
            <div className="text-2xl font-display font-bold">{streak.bestDay}</div>
            <div className="text-xs text-muted-foreground">most productive</div>
          </Card>
        </div>
        {/* Top project */}
        {(() => {
          const projectDone: Record<string, number> = {};
          for (const t of tasks) {
            if (t.status === 'Done' && t.project_id) {
              projectDone[t.project_id] = (projectDone[t.project_id] ?? 0) + 1;
            }
          }
          const topId = Object.entries(projectDone).sort(([,a],[,b]) => b - a)[0]?.[0];
          const topProject = topId ? projectMap.get(topId) : null;
          if (!topProject) return null;
          return (
            <Card className="p-4 rounded-xl mt-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: topProject.line_color ?? undefined }} />
              <div className="flex-1">
                <span className="text-xs text-muted-foreground">Top project</span>
                <p className="text-sm font-semibold">{topProject.name}</p>
              </div>
              <span className="text-sm font-mono text-muted-foreground">{projectDone[topId]} moves</span>
            </Card>
          );
        })()}
      </section>

      {/* Tomorrow Preview */}
      <section>
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tomorrow</h2>
        {tomorrowPlan.length > 0 ? (
          <>
            <div className="space-y-2">
              {tomorrowPlan.map((task, idx) => {
                const taskProject = projectMap.get(task.project_id ?? '');
                return (
                  <Card key={task.id} className="rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      {taskProject?.line_color && (
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                      )}
                      <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                      <span className="text-sm flex-1">{task.title}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate('/plan')}>
                Adjust
              </Button>
            </div>
          </>
        ) : (
          <Card className="p-6 text-center rounded-xl bg-accent/5">
            <p className="text-sm text-muted-foreground mb-3">Tomorrow isn't planned yet.</p>
            <Button onClick={() => navigate('/plan')} className="rounded-xl font-display" size="sm">
              Plan Tomorrow <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Card>
        )}
      </section>
    </div>
  );
}
