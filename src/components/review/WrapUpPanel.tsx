import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useStreak } from '@/hooks/useStreak';
import type { Task, TaskUpdate } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Flame, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { CompletionCelebration } from '@/components/task/CompletionCelebration';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';

export function WrapUpPanel() {
  const navigate = useNavigate();
  const { tasks, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const streak = useStreak(tasks);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const [celebration, setCelebration] = useState<{ task: Task; doneToday: number; totalToday: number } | null>(null);

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  // Today's scorecard: planned_date = today OR marked Done today
  const scorecardTasks = useMemo(() => {
    const result: Task[] = [];
    const ids = new Set<string>();
    for (const t of tasks) {
      if (ids.has(t.id)) continue;
      const isPlannedToday = t.planned_date === todayStr || t.status === 'Today';
      const isDoneToday = t.status === 'Done' && new Date(t.updated_at) >= todayStart;
      if (isPlannedToday || isDoneToday) {
        result.push(t);
        ids.add(t.id);
      }
    }
    return result;
  }, [tasks, todayStr, todayStart]);

  const completedToday = useMemo(() => scorecardTasks.filter(t => t.status === 'Done'), [scorecardTasks]);
  const incompleteToday = useMemo(() => scorecardTasks.filter(t => t.status !== 'Done'), [scorecardTasks]);

  // Tomorrow preview
  const tomorrowPlan = useMemo(() =>
    tasks.filter(t => t.planned_date === tomorrowStr && t.status !== 'Done').slice(0, 5),
  [tasks, tomorrowStr]);

  const handleDone = useCallback((task: Task) => {
    const newDoneCount = completedToday.length + 1;
    setCelebration({ task, doneToday: newDoneCount, totalToday: scorecardTasks.length });
    updateTask.mutate({ id: task.id, status: 'Done' }, {
      onSuccess: () => toast.success('Move cleared'),
    });
  }, [updateTask, completedToday.length, scorecardTasks.length]);

  const handleTomorrow = useCallback((id: string) => {
    updateTask.mutate({ id, planned_date: tomorrowStr, status: 'Next' } as any, {
      onSuccess: () => toast.success('Added to tomorrow'),
    });
  }, [updateTask, tomorrowStr]);

  const handleDrop = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Backlog', planned_date: null } as any, {
      onSuccess: () => toast.success('Dropped to Backlog'),
    });
  }, [updateTask]);

  return (
    <div className="space-y-6">
      {/* Today's date */}
      <p className="text-sm text-muted-foreground font-mono">{format(new Date(), 'MMMM d, yyyy')}</p>

      {/* Scorecard */}
      <section>
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Today's Scorecard
        </h2>
        <div className="space-y-2">
          {completedToday.map(task => {
            const tp = projectMap.get(task.project_id ?? '');
            return (
              <Card key={task.id} className="rounded-xl overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setDetailTask(task)}>
                <div className="flex items-stretch">
                  {tp?.line_color && <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: tp.line_color }} />}
                  <div className="flex items-center gap-3 p-4 flex-1">
                    <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm line-through text-muted-foreground">{task.title}</span>
                      {tp && <p className="text-[11px] text-muted-foreground mt-0.5">{tp.name}</p>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {incompleteToday.map(task => {
            const tp = projectMap.get(task.project_id ?? '');
            return (
              <Card key={task.id} className="rounded-xl overflow-hidden border-muted-foreground/20 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setDetailTask(task)}>
                <div className="flex items-stretch">
                  {tp?.line_color && <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: tp.line_color }} />}
                  <div className="flex items-center gap-3 p-4 flex-1">
                    <div className="w-4 h-4 rounded-sm border-2 border-muted-foreground/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{task.title}</span>
                      {tp && <p className="text-[11px] text-muted-foreground mt-0.5">{tp.name}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg text-accent" onClick={(e) => { e.stopPropagation(); handleDone(task); }}>
                        Done
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg" onClick={(e) => { e.stopPropagation(); handleTomorrow(task.id); }}>
                        Tomorrow
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg text-muted-foreground" onClick={(e) => { e.stopPropagation(); handleDrop(task.id); }}>
                        Drop
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {scorecardTasks.length === 0 && (
            <Card className="p-6 text-center rounded-xl">
              <p className="text-muted-foreground font-medium mb-1">Nothing to wrap up today.</p>
              <p className="text-sm text-muted-foreground mb-3">Complete a task to start tracking progress.</p>
              <Button variant="outline" size="sm" className="rounded-xl font-display text-xs" onClick={() => navigate('/today')}>
                Go to Today <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
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
            <div className="text-xs text-muted-foreground">{streak.streak === 0 ? "Today's a good day to start." : 'days'}</div>
          </Card>
          <Card className="p-4 rounded-xl text-center">
            <div className="text-xs text-muted-foreground mb-1">Best Day</div>
            <div className="text-2xl font-display font-bold">{streak.bestDay}</div>
            <div className="text-xs text-muted-foreground">this week</div>
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
              <span className="text-sm font-mono text-muted-foreground">{projectDone[topId!]} moves</span>
            </Card>
          );
        })()}
      </section>

      {/* Tomorrow Preview */}
      <section>
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tomorrow</h2>
        {tomorrowPlan.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">Tomorrow's route is ready:</p>
            <div className="space-y-2">
              {tomorrowPlan.map((task, idx) => {
                const tp = projectMap.get(task.project_id ?? '');
                return (
                  <Card key={task.id} className="rounded-xl overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setDetailTask(task)}>
                    <div className="flex items-stretch">
                      {tp?.line_color && <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: tp.line_color }} />}
                      <div className="flex items-center gap-3 p-3 flex-1">
                        <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                        <span className="text-sm flex-1">{task.title}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <Button variant="outline" size="sm" className="rounded-xl text-xs mt-3" onClick={() => navigate('/plan')}>
              View Plan <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
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

      {/* Completion Celebration */}
      {celebration && (
        <CompletionCelebration
          task={celebration.task}
          project={projectMap.get(celebration.task.project_id ?? '')}
          allTasksForProject={tasks.filter(t => t.project_id === celebration.task.project_id)}
          doneToday={celebration.doneToday}
          totalToday={celebration.totalToday}
          onDismiss={() => setCelebration(null)}
        />
      )}

      <TaskDetailDrawer
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onUpdate={(id, updates) => updateTask.mutate({ id, ...updates } as any)}
        onDelete={(id) => deleteTask.mutate(id)}
        projects={projects}
        milestones={milestones}
      />
    </div>
}

