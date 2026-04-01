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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckCircle2, ArrowRight, Flame, Clock, Navigation, Trophy, MessageSquare, ArrowDownToLine, Trash2, RefreshCw, CalendarArrowDown } from 'lucide-react';
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

    // Sort: due today first, then by sort_order
    primary.sort((a, b) => {
      const aUrgent = a.due_date === todayStr ? 0 : 1;
      const bUrgent = b.due_date === todayStr ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    // Backfill if < 3
    if (primary.length < 3) {
      const primaryIds = new Set(primary.map(t => t.id));
      const backfill = tasks
        .filter(t =>
          t.status === 'Next' &&
          !primaryIds.has(t.id) &&
          t.planned_date !== todayStr
        )
        .sort((a, b) => {
          // Due date soonest first, then created_at
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

  const estimatedMinutes = todayMoves.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
  const displayName = useMemo(() => {
    const meta = user?.user_metadata;
    const fullName = meta?.display_name || meta?.full_name || meta?.name;
    if (fullName) {
      return fullName.split(' ')[0];
    }
    const emailPrefix = user?.email?.split('@')[0] ?? '';
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }, [user]);

  // Next Move = first task in list
  const nextMoveTask = todayMoves[0] ?? null;
  const nextMoveProject = nextMoveTask ? projectMap.get(nextMoveTask.project_id ?? '') : null;

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

  const handleDeprioritize = useCallback((task: Task) => {
    updateTask.mutate({ id: task.id, status: 'Backlog', planned_date: null } as any, {
      onSuccess: () => toast('Moved to Backlog'),
    });
  }, [updateTask]);

  const handleBumpTomorrow = useCallback((task: Task) => {
    updateTask.mutate({ id: task.id, status: 'Next', planned_date: tomorrowStr } as any, {
      onSuccess: () => toast('Moved to tomorrow'),
    });
  }, [updateTask, tomorrowStr]);

  const handleSwapIn = useCallback((oldTask: Task, newTask: Task) => {
    // Move old task back to Next, bring new task into Today
    updateTask.mutate({ id: oldTask.id, status: 'Next', planned_date: null } as any);
    updateTask.mutate({ id: newTask.id, status: 'Today', planned_date: format(new Date(), 'yyyy-MM-dd') } as any, {
      onSuccess: () => toast.success(`Swapped in: ${newTask.title}`),
    });
  }, [updateTask]);

  // Get swap candidates for a task (same project or same route_group, not already in today)
  const getSwapCandidates = useCallback((task: Task) => {
    const todayIds = new Set(todayMoves.map(t => t.id));
    const taskProject = task.project_id ? projectMap.get(task.project_id) : null;
    const routeGroup = taskProject?.route_group;

    return tasks.filter(t => {
      if (t.id === task.id || todayIds.has(t.id)) return false;
      if (t.status === 'Done' || t.status === 'Someday' || t.status === 'Closing') return false;
      // Same project first, or same route group
      if (task.project_id && t.project_id === task.project_id) return true;
      if (routeGroup && t.project_id) {
        const tp = projectMap.get(t.project_id);
        if (tp?.route_group === routeGroup) return true;
      }
      return false;
    }).sort((a, b) => {
      // Prefer same project
      const aMatch = a.project_id === task.project_id ? 0 : 1;
      const bMatch = b.project_id === task.project_id ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      // Then by status (Next first)
      if (a.status === 'Next' && b.status !== 'Next') return -1;
      if (b.status === 'Next' && a.status !== 'Next') return 1;
      // Then by due date
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return 0;
    }).slice(0, 8);
  }, [tasks, todayMoves, projectMap]);

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
        subtitle: `You have ${todayMoves.length} move${todayMoves.length !== 1 ? 's' : ''} today.`,
      };
    }
    if (timeOfDay === 'afternoon') {
      return {
        greeting: `Good afternoon${displayName ? `, ${displayName}` : ''}.`,
        subtitle: `${completedCount} of ${totalMoves} moves complete.${completedCount > 0 ? ' You\'re on track.' : ''}`,
      };
    }
    return {
      greeting: `Good evening${displayName ? `, ${displayName}` : ''}.`,
      subtitle: todayMoves.length > 0 ? `${todayMoves.length} move${todayMoves.length !== 1 ? 's' : ''} remaining.` : 'Let\'s close out your day.',
      cta: todayMoves.length > 0 ? undefined : 'Review Your Day',
      ctaAction: todayMoves.length > 0 ? undefined : () => navigate('/review'),
    };
  }, [timeOfDay, displayName, todayMoves, completedCount, totalMoves, allDone, streak, navigate]);

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
        {/* Hero Panel */}
        <Card className="p-4 sm:p-8 rounded-2xl bg-[hsl(var(--mint)/0.15)] border-[hsl(var(--accent)/0.2)]">
          <h1 className="text-xl sm:text-3xl font-display font-bold text-foreground">
            {heroContent.greeting}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2">
            {heroContent.subtitle}
          </p>
          {heroContent.ctaAction && (
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <Button onClick={heroContent.ctaAction} className="rounded-xl font-display" size="sm">
                {heroContent.cta} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              {heroContent.secondaryCta && heroContent.secondaryAction && (
                <Button variant="outline" onClick={heroContent.secondaryAction} className="rounded-xl font-display" size="sm">
                  {heroContent.secondaryCta}
                </Button>
              )}
            </div>
          )}

          {/* Streak indicator */}
          {streak.streak > 0 && (
            <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-[#FFD300]" />
                {streak.streak}-day streak
              </span>
              <span>·</span>
              <span>This week: {streak.weekCleared}/{streak.weekPlanned} moves cleared</span>
            </div>
          )}
        </Card>

        {/* Multi-color Progress Bar */}
        {totalMoves > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{completedCount} of {totalMoves} moves complete</span>
              <span className="font-mono">{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
              {progressSegments.map((seg, i) => (
                <div
                  key={i}
                  className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Next Move Hero Card */}
        {nextMoveTask && !allDone && (
          <Card
            className="rounded-2xl overflow-hidden cursor-pointer group hover:shadow-card transition-shadow"
            onClick={() => setDetailTask(nextMoveTask)}
          >
            <div className="flex items-stretch">
              <div
                className="w-2 flex-shrink-0"
                style={{ backgroundColor: nextMoveProject?.line_color ?? 'hsl(var(--accent))' }}
              />
              <div className="p-4 sm:p-6 flex-1">
                <p className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 sm:mb-3">
                  Your Next Move
                </p>
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <span
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: nextMoveProject?.line_color ?? 'hsl(var(--accent))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-display font-bold text-foreground leading-snug">
                      {nextMoveTask.title}
                    </p>
                    {nextMoveProject && (
                      <p className="text-sm text-muted-foreground mt-1">{nextMoveProject.name}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 sm:mt-4">
                  <Button
                    size="sm"
                    className="rounded-xl font-display bg-accent hover:bg-accent/90 text-accent-foreground min-h-[44px]"
                    onClick={(e) => { e.stopPropagation(); setDetailTask(nextMoveTask); }}
                  >
                    Start This <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
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

              {/* Active tasks (skip first since it's in the hero card) */}
              {todayMoves.map((task, idx) => {
                const isCurrentTask = idx === 0;
                const taskProject = projectMap.get(task.project_id ?? '');
                const justCompleted = completedIds.has(task.id);

                return (
                  <Card
                    key={task.id}
                    className={cn(
                      "rounded-xl overflow-hidden transition-all duration-300 cursor-pointer group",
                      isCurrentTask && "ring-1 ring-accent/20",
                      justCompleted && "animate-slide-right-fade"
                    )}
                    onClick={() => setDetailTask(task)}
                  >
                    <div className="flex items-stretch">
                      {taskProject?.line_color && (
                        <div className="w-1 flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                      )}
                      <div className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 flex-1 min-w-0">
                        {/* ●/◉/○ indicator */}
                        <div className="relative flex-shrink-0">
                          {isCurrentTask ? (
                            <div className="relative flex items-center justify-center">
                              <div className="absolute w-7 h-7 rounded-full animate-ping opacity-20" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }} />
                              <div className="w-4 h-4 rounded-full border-[3px]" style={{ borderColor: taskProject?.line_color ?? 'hsl(var(--accent))', backgroundColor: `${taskProject?.line_color ?? 'hsl(var(--accent))'}20` }} />
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

                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {/* Done */}
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-accent"
                            title="Mark done"
                            onClick={e => { e.stopPropagation(); handleMarkDone(task); }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>

                          {/* Swap */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost" size="sm"
                                className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
                                title="Swap task"
                                onClick={e => e.stopPropagation()}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0 rounded-xl" align="end" onClick={e => e.stopPropagation()}>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2 border-b bg-muted/20">
                                Swap with
                              </p>
                              <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                                {getSwapCandidates(task).length === 0 ? (
                                  <p className="text-xs text-muted-foreground p-3">No swap candidates found.</p>
                                ) : (
                                  getSwapCandidates(task).map(candidate => {
                                    const cp = projectMap.get(candidate.project_id ?? '');
                                    return (
                                      <button
                                        key={candidate.id}
                                        className="w-full flex items-center gap-2.5 p-2.5 hover:bg-muted/30 transition-colors text-left"
                                        onClick={() => handleSwapIn(task, candidate)}
                                      >
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cp?.line_color ?? 'hsl(var(--muted-foreground))' }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm truncate">{candidate.title}</p>
                                          {cp && <p className="text-[10px] text-muted-foreground">{cp.name}</p>}
                                        </div>
                                        <Badge variant="outline" className="text-[9px] rounded-full shrink-0">{candidate.status}</Badge>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                          {/* Deprioritize */}
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-orange-500"
                            title="Deprioritize to Backlog"
                            onClick={e => { e.stopPropagation(); handleDeprioritize(task); }}
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-destructive"
                            title="Delete task"
                            onClick={e => { e.stopPropagation(); handleDelete(task.id); toast('Task deleted'); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* All-done celebration */}
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
