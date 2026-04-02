import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { useStreak } from '@/hooks/useStreak';
import type { Task, TaskArea, TaskStatus, TaskUpdate } from '@/types/task';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Flame, Clock, Navigation, Trophy, MessageSquare, CalendarArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { QuickAdd } from '@/components/task/QuickAdd';
import { CompletionCelebration } from '@/components/task/CompletionCelebration';
import { AIHelperPanel } from '@/components/today/AIHelperPanel';
import { TodaySkeleton } from '@/components/loading/TubeSkeletons';

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function TodayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const streak = useStreak(tasks);

  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<{ task: Task; doneToday: number; totalToday: number } | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const timeOfDay = getTimeOfDay();
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Today's moves: planned_date = today, OR status = 'Today', OR (Next/Waiting with due_date = today)
  // Then backfill from Next tasks if fewer than 3
  const todayMoves = useMemo(() => {
    const primary = tasks.filter(t =>
      t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing' && (
        t.planned_date === todayStr ||
        t.status === 'Today' ||
        ((t.status === 'Next' || t.status === 'Waiting') && t.due_date === todayStr)
      )
    );

    primary.sort((a, b) => {
      const aUrgent = a.due_date === todayStr ? 0 : 1;
      const bUrgent = b.due_date === todayStr ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    if (primary.length < 3) {
      const primaryIds = new Set(primary.map(t => t.id));
      const backfill = tasks
        .filter(t =>
          t.status === 'Next' &&
          !primaryIds.has(t.id) &&
          t.planned_date !== todayStr
        )
        .sort((a, b) => {
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          return a.created_at.localeCompare(b.created_at);
        });
      const needed = 3 - primary.length;
      primary.push(...backfill.slice(0, needed));
    }

    return primary.slice(0, 5);
  }, [tasks, todayStr]);

  // Done today for progress
  const doneToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter(t =>
      t.status === 'Done' &&
      (t.planned_date === todayStr || new Date(t.updated_at) >= today)
    );
  }, [tasks, todayStr]);

  const totalMoves = todayMoves.length + doneToday.length;
  const completedCount = doneToday.length;
  const progressPct = totalMoves > 0 ? Math.round((completedCount / totalMoves) * 100) : 0;
  const allDone = todayMoves.length === 0 && completedCount > 0;

  const displayName = useMemo(() => {
    const meta = user?.user_metadata;
    const fullName = meta?.display_name || meta?.full_name || meta?.name;
    if (fullName) {
      return fullName.split(' ')[0];
    }
    const emailPrefix = user?.email?.split('@')[0] ?? '';
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }, [user]);

  const handleMarkDone = useCallback((task: Task) => {
    setCompletedIds(prev => new Set(prev).add(task.id));
    setCelebration({ task, doneToday: completedCount + 1, totalToday: totalMoves });

    updateTask.mutate({ id: task.id, status: 'Done' }, {
      onSuccess: () => toast.success('Move cleared'),
    });
  }, [updateTask, completedCount, totalMoves]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id); }, [deleteTask]);

  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const handleBumpTomorrow = useCallback((task: Task) => {
    updateTask.mutate({ id: task.id, status: 'Next', planned_date: tomorrowStr } as any, {
      onSuccess: () => toast('Moved to tomorrow'),
    });
  }, [updateTask, tomorrowStr]);

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status: 'Today', context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null, planned_date: todayStr }, {
      onSuccess: () => toast.success('Added to today\'s moves'),
    });
  }, [createTask, todayStr]);

  // Greeting line
  const greetingText = useMemo(() => {
    if (allDone) return 'Route complete.';
    const prefix = timeOfDay === 'morning' ? 'Good morning' : timeOfDay === 'afternoon' ? 'Good afternoon' : 'Good evening';
    return `${prefix}${displayName ? `, ${displayName}` : ''}.`;
  }, [timeOfDay, displayName, allDone]);

  const statusText = useMemo(() => {
    if (allDone) return `You cleared all ${completedCount} moves today.`;
    return `${completedCount} of ${totalMoves} moves`;
  }, [allDone, completedCount, totalMoves]);

  // Multi-color progress bar segments
  const progressSegments = useMemo(() => {
    if (doneToday.length === 0 || totalMoves === 0) return [];
    const segments: { color: string; width: number }[] = [];
    const segWidth = 100 / totalMoves;
    for (const t of doneToday) {
      const proj = projectMap.get(t.project_id ?? '');
      segments.push({ color: proj?.line_color ?? 'hsl(var(--accent))', width: segWidth });
    }
    return segments;
  }, [doneToday, totalMoves, projectMap]);

  if (isLoading) {
    return <AppShell><TodaySkeleton /></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto px-1 sm:px-0">
        {/* Compact header line */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
            <h1 className="text-lg sm:text-xl font-display font-bold text-foreground">
              {greetingText}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {!allDone && <span className="font-mono">{statusText}</span>}
              {streak.streak > 0 && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-[#FFD300]" />
                  {streak.streak}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalMoves > 0 && (
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
              {progressSegments.map((seg, i) => (
                <div
                  key={i}
                  className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
                />
              ))}
            </div>
          )}
        </div>

        {/* All-done CTA */}
        {allDone && (
          <Card className="p-4 sm:p-6 rounded-2xl text-center bg-[hsl(var(--mint)/0.1)] border-accent/20">
            <Trophy className="h-8 w-8 text-accent mx-auto mb-3" />
            <p className="font-display font-bold text-lg">🎉 Route Complete</p>
            <p className="text-sm text-muted-foreground mt-1">
              You cleared all {completedCount} moves today.
              {streak.streak > 1 && ` Streak: ${streak.streak} days.`}
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button onClick={() => navigate('/plan')} className="rounded-xl font-display" size="sm">
                Plan Tomorrow <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/review')} className="rounded-xl font-display" size="sm">
                View Review
              </Button>
            </div>
          </Card>
        )}

        {/* Today's Moves */}
        <section>
          <h2 className="font-display text-sm font-semibold flex items-center gap-2 mb-4 text-muted-foreground uppercase tracking-wider">
            <Navigation className="h-4 w-4 text-accent" />
            Today's Moves
          </h2>

          {todayMoves.length === 0 && doneToday.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl">
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/20" />
                  <span className="w-10 h-px border-t-2 border-dashed border-muted-foreground/15" />
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/20" />
                  <span className="w-10 h-px border-t-2 border-dashed border-muted-foreground/15" />
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/20" />
                </div>
              </div>
              <p className="text-muted-foreground font-medium mb-1">No stops on today's route.</p>
              <p className="text-sm text-muted-foreground mb-4">Plan your day to get moving.</p>
              <Button onClick={() => navigate('/plan')} className="rounded-xl font-display" size="sm">
                Plan your day <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Done tasks (muted) */}
              {doneToday.map(task => {
                const taskProject = projectMap.get(task.project_id ?? '');
                return (
                  <Card key={task.id} className="rounded-xl overflow-hidden opacity-50 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setDetailTask(task)}>
                    <div className="flex items-stretch">
                      {taskProject?.line_color && (
                        <div className="w-1 flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                      )}
                      <div className="flex items-center gap-3 p-4 flex-1">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }}>
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm flex-1 line-through text-muted-foreground">{task.title}</span>
                        {taskProject && (
                          <Badge variant="outline" className="text-[10px] rounded-full" style={{ borderColor: taskProject.line_color ?? undefined, color: taskProject.line_color ?? undefined }}>
                            {taskProject.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Active tasks */}
              {todayMoves.map((task, idx) => {
                const isFirstTask = idx === 0;
                const taskProject = projectMap.get(task.project_id ?? '');
                const justCompleted = completedIds.has(task.id);

                return (
                  <Card
                    key={task.id}
                    className={cn(
                      "rounded-xl overflow-hidden transition-all duration-300 cursor-pointer group",
                      isFirstTask && "ring-1 ring-accent/20",
                      justCompleted && "animate-slide-right-fade"
                    )}
                    onClick={() => setDetailTask(task)}
                  >
                    <div className="flex items-stretch">
                      {taskProject?.line_color && (
                        <div className="w-1 flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                      )}
                      <div className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 flex-1 min-w-0">
                        {/* Indicator */}
                        <div className="relative flex-shrink-0">
                          {isFirstTask ? (
                            <div className="relative flex items-center justify-center">
                              <div className="absolute w-7 h-7 rounded-full animate-ping opacity-20" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }} />
                              <div className="w-4 h-4 rounded-full border-[3px]" style={{ borderColor: taskProject?.line_color ?? 'hsl(var(--accent))', backgroundColor: `${taskProject?.line_color ?? 'hsl(var(--accent))'}20` }} />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 bg-card" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            isFirstTask && "text-base font-semibold text-foreground"
                          )}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {taskProject && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color ?? undefined }} />
                                {taskProject.name}
                              </span>
                            )}
                            {task.estimated_minutes && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                                <Clock className="h-3 w-3" />{task.estimated_minutes}m
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Only 2 action buttons: Done + Tomorrow */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-accent"
                            title="Mark done"
                            onClick={e => { e.stopPropagation(); handleMarkDone(task); }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-primary"
                            title="Move to tomorrow"
                            onClick={e => { e.stopPropagation(); handleBumpTomorrow(task); }}
                          >
                            <CalendarArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* AI Helper Button */}
        {!allDone && todayMoves.length > 0 && (
          <Button variant="outline" onClick={() => setAiPanelOpen(true)} className="w-full rounded-xl text-sm font-display min-h-[44px]" size="sm">
            <MessageSquare className="h-3.5 w-3.5 mr-2" />
            Talk to your AI about today
          </Button>
        )}

        {/* Quick Add */}
        <QuickAdd defaultStatus="Today" projects={projects} milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={handleQuickAdd}
          onTasksCreated={() => queryClient.invalidateQueries()} />
      </div>

      <AIHelperPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        todayTasks={todayMoves}
        doneTodayTasks={doneToday}
        projects={projects}
        allTasks={tasks}
        streak={streak.streak}
        weekCleared={streak.weekCleared}
      />

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />

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
    </AppShell>
  );
}
