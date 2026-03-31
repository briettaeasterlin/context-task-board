import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useStreak } from '@/hooks/useStreak';
import type { Task, TaskUpdate } from '@/types/task';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Clock, Flame, BarChart3, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ReviewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tasks, updateTask } = useTasks();
  const { projects } = useProjects();
  const streak = useStreak(tasks);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Today's scorecard
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const completedToday = useMemo(() =>
    tasks.filter(t => t.status === 'Done' && new Date(t.updated_at) >= todayStart),
  [tasks, todayStart]);

  const incompleteToday = useMemo(() =>
    tasks.filter(t => (t.planned_date === todayStr || t.status === 'Today') && t.status !== 'Done'),
  [tasks, todayStr]);

  // Tomorrow preview
  const tomorrowPlan = useMemo(() =>
    tasks.filter(t => t.planned_date === tomorrowStr && t.status !== 'Done'),
  [tasks, tomorrowStr]);

  // Top project (most done tasks all time)
  const topProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status === 'Done' && t.project_id) {
        counts[t.project_id] = (counts[t.project_id] ?? 0) + 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    return projectMap.get(sorted[0][0]) ?? null;
  }, [tasks, projectMap]);

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

  const handleDrop = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Backlog', planned_date: null } as any, {
      onSuccess: () => toast.success('Moved to Backlog'),
    });
  }, [updateTask]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            Today's Review
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Scorecard */}
        <section>
          <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scorecard</h2>
          <div className="space-y-2">
            {/* Completed tasks */}
            {completedToday.map(task => {
              const taskProject = projectMap.get(task.project_id ?? '');
              return (
                <Card key={task.id} className="rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    {taskProject?.line_color && (
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                    )}
                    <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                    <span className="text-sm flex-1">{task.title}</span>
                    {taskProject && (
                      <span className="text-xs text-muted-foreground">{taskProject.name}</span>
                    )}
                  </div>
                </Card>
              );
            })}

            {/* Incomplete tasks with actions */}
            {incompleteToday.map(task => {
              const taskProject = projectMap.get(task.project_id ?? '');
              return (
                <Card key={task.id} className="rounded-xl overflow-hidden border-muted-foreground/20">
                  <div className="flex items-center gap-3 p-4">
                    {taskProject?.line_color && (
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                    )}
                    <div className="w-4 h-4 rounded-sm border-2 border-muted-foreground/30 flex-shrink-0" />
                    <span className="text-sm flex-1">{task.title}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg text-accent" onClick={() => handleDone(task.id)}>
                        Done
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg" onClick={() => handleTomorrow(task.id)}>
                        Tomorrow
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg text-muted-foreground" onClick={() => handleDrop(task.id)}>
                        Drop
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {completedToday.length === 0 && incompleteToday.length === 0 && (
              <Card className="p-6 text-center rounded-xl">
                <p className="text-sm text-muted-foreground">No moves planned or completed today.</p>
              </Card>
            )}
          </div>
        </section>

        {/* Weekly Stats */}
        <section>
          <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Weekly Stats</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 rounded-xl text-center">
              <div className="text-xs text-muted-foreground mb-1">This Week</div>
              <div className="text-2xl font-display font-bold text-accent">{streak.weekCleared}</div>
              <div className="text-xs text-muted-foreground">moves cleared</div>
            </Card>
            <Card className="p-4 rounded-xl text-center">
              <div className="text-xs text-muted-foreground mb-1">All Time</div>
              <div className="text-2xl font-display font-bold">{streak.totalDone}</div>
              <div className="text-xs text-muted-foreground">moves</div>
            </Card>
            <Card className="p-4 rounded-xl text-center">
              <div className="text-xs text-muted-foreground mb-1">Streak</div>
              <div className="text-2xl font-display font-bold flex items-center justify-center gap-1">
                <Flame className="h-5 w-5 text-orange-500" />
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
          {topProject && (
            <p className="text-xs text-muted-foreground font-mono mt-3 text-center">
              Top project: {topProject.name}
            </p>
          )}
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
            <Card className="p-6 text-center rounded-xl bg-[hsl(var(--mint)/0.1)]">
              <p className="text-sm text-muted-foreground mb-3">Tomorrow isn't planned yet.</p>
              <Button onClick={() => navigate('/plan')} className="rounded-xl font-display" size="sm">
                Plan Tomorrow <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Card>
          )}
        </section>
      </div>
    </AppShell>
  );
}
