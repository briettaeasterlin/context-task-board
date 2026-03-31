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
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, ArrowRight, Flame, Clock, Navigation, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { QuickAdd } from '@/components/task/QuickAdd';

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
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const timeOfDay = getTimeOfDay();
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Today's moves: tasks with planned_date = today OR status = 'Today'
  const todayMoves = useMemo(() => {
    return tasks
      .filter(t => (t.planned_date === todayStr || t.status === 'Today') && t.status !== 'Done')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [tasks, todayStr]);

  // Also show done-today for progress
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

  const estimatedMinutes = todayMoves.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
  const displayName = user?.email?.split('@')[0] ?? '';

  // Find current task (first non-done)
  const currentTaskIdx = 0;

  const handleMarkDone = useCallback((id: string) => {
    setCompletedIds(prev => new Set(prev).add(id));
    const remaining = todayMoves.filter(t => t.id !== id).length;
    
    // Contextual feedback
    if (remaining === 0) {
      setFeedbackMsg('Route complete for today! 🎉');
    } else if (completedCount === 0) {
      setFeedbackMsg('Nice — that moved things forward.');
    } else {
      setFeedbackMsg(`${completedCount + 1} down, ${remaining} to go.`);
    }
    setTimeout(() => setFeedbackMsg(null), 3000);

    updateTask.mutate({ id, status: 'Done' }, {
      onSuccess: () => toast.success('Move cleared'),
    });
  }, [updateTask, todayMoves, completedCount]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id); }, [deleteTask]);

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status: 'Today', context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null, planned_date: todayStr }, {
      onSuccess: () => toast.success('Added to today\'s moves'),
    });
  }, [createTask, todayStr]);

  // Hero content based on time of day
  const heroContent = useMemo(() => {
    if (allDone) {
      return {
        greeting: `Route complete.`,
        subtitle: `You cleared all ${completedCount} moves today.${streak.streak > 1 ? ` Streak: ${streak.streak} days.` : ''}`,
        cta: 'Plan Tomorrow',
        ctaAction: () => navigate('/plan'),
        secondaryCta: 'View Review',
        secondaryAction: () => navigate('/review'),
      };
    }
    if (timeOfDay === 'morning') {
      return {
        greeting: `Good morning${displayName ? `, ${displayName}` : ''}.`,
        subtitle: `You have ${todayMoves.length} move${todayMoves.length !== 1 ? 's' : ''} today.${estimatedMinutes > 0 ? ` Estimated time: ${estimatedMinutes >= 60 ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ''}` : `${estimatedMinutes}m`}.` : ''}`,
        cta: 'Start Your Day',
        ctaAction: todayMoves[0] ? () => setDetailTask(todayMoves[0]) : undefined,
      };
    }
    if (timeOfDay === 'afternoon') {
      return {
        greeting: `Good afternoon${displayName ? `, ${displayName}` : ''}.`,
        subtitle: `${completedCount} of ${totalMoves} moves complete.${completedCount > 0 ? ' You\'re on track.' : ''}`,
        cta: 'Continue',
        ctaAction: todayMoves[0] ? () => setDetailTask(todayMoves[0]) : undefined,
      };
    }
    return {
      greeting: `Good evening${displayName ? `, ${displayName}` : ''}.`,
      subtitle: `Your day is almost done.${todayMoves.length > 0 ? ` ${todayMoves.length} move${todayMoves.length !== 1 ? 's' : ''} remaining.` : ' Let\'s close out and set up tomorrow.'}`,
      cta: todayMoves.length > 0 ? 'Continue' : 'Review Your Day',
      ctaAction: todayMoves.length > 0 ? () => setDetailTask(todayMoves[0]) : () => navigate('/review'),
      secondaryCta: 'Plan Tomorrow',
      secondaryAction: () => navigate('/plan'),
    };
  }, [timeOfDay, displayName, todayMoves, completedCount, totalMoves, estimatedMinutes, allDone, streak, navigate]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Hero Panel */}
        <Card className="p-6 sm:p-8 rounded-2xl bg-[hsl(var(--mint)/0.15)] border-[hsl(var(--accent)/0.2)]">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            {heroContent.greeting}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {heroContent.subtitle}
          </p>
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {heroContent.ctaAction && (
              <Button onClick={heroContent.ctaAction} className="rounded-xl font-display" size="sm">
                {heroContent.cta} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
            {heroContent.secondaryCta && heroContent.secondaryAction && (
              <Button variant="outline" onClick={heroContent.secondaryAction} className="rounded-xl font-display" size="sm">
                {heroContent.secondaryCta}
              </Button>
            )}
          </div>

          {/* Streak indicator */}
          {streak.streak > 0 && (
            <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                {streak.streak}-day streak
              </span>
              <span>|</span>
              <span>This week: {streak.weekCleared} moves cleared</span>
            </div>
          )}
        </Card>

        {/* Progress Bar */}
        {totalMoves > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{completedCount} of {totalMoves} moves complete</span>
              <span className="font-mono">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5 bg-muted" />
          </div>
        )}

        {/* Feedback message */}
        {feedbackMsg && (
          <div className="text-center text-sm text-accent font-medium animate-fade-in">
            {feedbackMsg}
          </div>
        )}

        {/* Today's Moves */}
        <section>
          <h2 className="font-display text-sm font-semibold flex items-center gap-2 mb-4 text-muted-foreground uppercase tracking-wider">
            <Navigation className="h-4 w-4 text-accent" />
            Today's Moves
          </h2>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8 font-mono">Loading route...</p>
          ) : todayMoves.length === 0 && doneToday.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl">
              <p className="text-muted-foreground mb-2">No moves planned for today.</p>
              <p className="text-sm text-muted-foreground mb-4">Plan your day to get started.</p>
              <Button onClick={() => navigate('/plan')} className="rounded-xl font-display" size="sm">
                Plan Today <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Done tasks (muted) */}
              {doneToday.map(task => {
                const taskProject = projectMap.get(task.project_id ?? '');
                return (
                  <Card key={task.id} className="rounded-xl overflow-hidden opacity-50">
                    <div className="flex items-center gap-3 p-4">
                      {taskProject?.line_color && (
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                      )}
                      <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                      </div>
                      <span className="text-sm flex-1 line-through text-muted-foreground">{task.title}</span>
                      {taskProject && (
                        <Badge variant="outline" className="text-[10px] rounded-full" style={{ borderColor: taskProject.line_color ?? undefined, color: taskProject.line_color ?? undefined }}>
                          {taskProject.name}
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}

              {/* Active tasks */}
              {todayMoves.map((task, idx) => {
                const isCurrentTask = idx === currentTaskIdx;
                const taskProject = projectMap.get(task.project_id ?? '');
                const justCompleted = completedIds.has(task.id);

                return (
                  <Card
                    key={task.id}
                    className={cn(
                      "rounded-xl overflow-hidden transition-all duration-300 cursor-pointer group",
                      isCurrentTask && "ring-2 ring-accent/30 shadow-card",
                      justCompleted && "animate-slide-right-fade"
                    )}
                    onClick={() => setDetailTask(task)}
                  >
                    <div className="flex items-stretch">
                      {/* Project color stripe */}
                      {taskProject?.line_color && (
                        <div className="w-1 flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                      )}
                      <div className="flex items-center gap-3 p-4 flex-1 min-w-0">
                        {/* Status indicator */}
                        <div className="relative flex-shrink-0">
                          {isCurrentTask ? (
                            <div className="relative flex items-center justify-center">
                              <div className="absolute w-7 h-7 rounded-full animate-ping opacity-20 bg-accent" />
                              <div className="w-5 h-5 rounded-full border-[3px] border-accent bg-accent/10" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 bg-card" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            isCurrentTask && "text-foreground font-semibold"
                          )}>
                            {task.title}
                          </p>
                          {taskProject && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color ?? undefined }} />
                              {taskProject.name}
                            </p>
                          )}
                        </div>

                        {task.estimated_minutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono flex-shrink-0">
                            <Clock className="h-3 w-3" />{task.estimated_minutes}m
                          </span>
                        )}

                        <Button
                          variant="ghost" size="sm"
                          className="h-8 w-8 p-0 shrink-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-accent"
                          onClick={e => { e.stopPropagation(); handleMarkDone(task.id); }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Overflow indicator */}
          {todayMoves.length > 5 && (
            <p className="text-xs text-muted-foreground font-mono mt-3 text-center">
              Showing all {todayMoves.length} moves · Consider trimming to 3-5
            </p>
          )}
        </section>

        {/* All-done celebration */}
        {allDone && (
          <Card className="p-6 rounded-2xl text-center bg-[hsl(var(--mint)/0.1)] border-accent/20">
            <Trophy className="h-8 w-8 text-accent mx-auto mb-3" />
            <p className="font-display font-bold text-lg">Route complete.</p>
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

        {/* Quick Add */}
        <QuickAdd defaultStatus="Today" projects={projects} milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={handleQuickAdd}
          onTasksCreated={() => queryClient.invalidateQueries()} />
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
    </AppShell>
  );
}
