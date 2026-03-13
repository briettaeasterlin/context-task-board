import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { usePlannedBlocks, useCalendarEvents } from '@/hooks/usePlanner';
import type { Task, TaskArea, TaskStatus, TaskUpdate } from '@/types/task';
import { QuickAdd } from '@/components/task/QuickAdd';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, Clock, CheckCircle2, CalendarDays, Navigation, AlertCircle } from 'lucide-react';
import { HabitSection } from '@/components/habit/HabitSection';
import { FocusCardStack } from '@/components/task/FocusCardStack';
import { RouteProgress } from '@/components/today/RouteProgress';
import { RouteBrief } from '@/components/today/RouteBrief';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, isPast, addDays, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimelineItem {
  type: 'event' | 'block';
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
  projectName?: string;
  task?: Task;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayPage() {
  const queryClient = useQueryClient();
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { blocks } = usePlannedBlocks(todayStr, todayStr);
  const { events } = useCalendarEvents(
    new Date(todayStr).toISOString(),
    new Date(todayStr + 'T23:59:59').toISOString()
  );

  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const greeting = getGreeting();

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const ev of events) {
      if (ev.is_all_day) continue;
      const start = new Date(ev.start_time);
      const end = new Date(ev.end_time);
      if (!isToday(start)) continue;
      items.push({
        type: 'event', id: ev.id, title: ev.title,
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        durationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
      });
    }
    for (const block of blocks) {
      const [h, m] = block.start_time.split(':').map(Number);
      const task = block.task_id ? taskMap.get(block.task_id) : null;
      const project = task?.project_id ? projectMap.get(task.project_id) : null;
      items.push({
        type: 'block', id: block.id, title: task?.title ?? 'Planned Block',
        startMinutes: h * 60 + m, durationMinutes: block.duration_minutes,
        projectName: project?.name, task: task ?? undefined,
      });
    }
    return items.sort((a, b) => a.startMinutes - b.startMinutes);
  }, [events, blocks, taskMap, projectMap]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const urgentDeadlines = useMemo(() => {
    const cutoff = addDays(new Date(), 2);
    return tasks
      .filter(t => t.status !== 'Done' && t.due_date)
      .filter(t => { const d = new Date(t.due_date!); return isBefore(d, cutoff) || isToday(d); })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [tasks]);

  const nextTasks = useMemo(() =>
    tasks.filter(t => t.status === 'Today' || t.status === 'Next').sort((a, b) => {
      if (a.status === 'Today' && b.status !== 'Today') return -1;
      if (b.status === 'Today' && a.status !== 'Today') return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    }),
  [tasks]);

  const upcomingDeadlines = useMemo(() => {
    const start = addDays(new Date(), 2);
    const end = addDays(new Date(), 8);
    return tasks
      .filter(t => t.status !== 'Done' && t.due_date)
      .filter(t => { const d = new Date(t.due_date!); return !isBefore(d, start) && isBefore(d, end); })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [tasks]);

  const nextIds = new Set(nextTasks.map(t => t.id));
  const urgentOnlyIds = urgentDeadlines.filter(t => !nextIds.has(t.id));

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status: 'Next', context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
      onSuccess: () => toast.success('Added to route'),
    });
  }, [createTask]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id, { onSuccess: () => toast.success('Removed from route') }); }, [deleteTask]);
  const handleMarkDone = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Done' }, { onSuccess: () => toast.success('Route cleared. Next move ready.') });
  }, [updateTask]);

  const handleHighlightTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) setDetailTask(task);
  }, [tasks]);

  const formatDueLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isPast(d) && !isToday(d)) return `Overdue · ${format(d, 'MMM d')}`;
    if (isToday(d)) return 'Due today';
    if (isTomorrow(d)) return 'Due tomorrow';
    return `Due ${format(d, 'EEE, MMM d')}`;
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Greeting */}
        <div className="pt-1">
          <h1 className="text-2xl font-display font-bold">
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono tracking-tight">
            {format(new Date(), 'EEEE, MMMM d')} · {nextTasks.length} stops on today's route
          </p>
        </div>

        {/* Route Brief */}
        <RouteBrief tasks={tasks} onHighlightTask={handleHighlightTask} />

        {/* Universal Command Field */}
        <QuickAdd defaultStatus="Next" projects={projects} milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={handleQuickAdd}
          onTasksCreated={() => queryClient.invalidateQueries()} />

        {/* Transit Path Timeline */}
        {timeline.length > 0 && (
          <section>
            <SectionHeader icon={<CalendarClock className="h-4 w-4" />} label="Timeline" />
            <div className="relative ml-3">
              {/* Transit path line */}
              <div className="absolute left-[3px] top-3 bottom-3 w-px bg-mint" />

              <div className="space-y-0">
                {timeline.map((item, idx) => {
                  const isPastItem = item.startMinutes + item.durationMinutes < nowMinutes;
                  const isCurrent = item.startMinutes <= nowMinutes && item.startMinutes + item.durationMinutes > nowMinutes;

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="relative flex items-start gap-4 py-2 group"
                    >
                      {/* Transit node */}
                      <div className={cn(
                        'relative z-10 mt-3 w-[7px] h-[7px] rounded-full border-2 flex-shrink-0 transition-all duration-150',
                        isCurrent
                          ? 'border-accent bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.4)]'
                          : isPastItem
                            ? 'border-muted-foreground/30 bg-muted-foreground/30'
                            : 'border-primary bg-background'
                      )} />

                      {/* Timeline card */}
                      <Card
                        className={cn(
                          "flex-1 p-3 flex items-center gap-3 transition-all duration-150 rounded-xl",
                          item.type === 'block' && "cursor-pointer hover:shadow-card hover:translate-x-px",
                          isPastItem && "opacity-40",
                          isCurrent && "border-accent/40 bg-mint/30 shadow-card"
                        )}
                        onClick={() => item.task && setDetailTask(item.task)}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground w-20 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.startMinutes)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground font-mono">{item.durationMinutes}m</span>
                            {item.projectName && <span className="text-xs text-accent font-medium">{item.projectName}</span>}
                            {item.type === 'event' && <Badge variant="outline" className="text-[10px] h-5 rounded-full font-mono">Cal</Badge>}
                          </div>
                        </div>
                        {isCurrent && (
                          <Badge className="text-[10px] h-5 bg-accent text-accent-foreground rounded-full font-mono">Now</Badge>
                        )}
                        {item.type === 'block' && item.task && (
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg hover:translate-x-px transition-all duration-150"
                            onClick={e => { e.stopPropagation(); handleMarkDone(item.task!.id); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Clear
                          </Button>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Wayfinding divider */}
        <div className="wayfinding-divider" />

        {/* Urgent Deadlines */}
        {urgentOnlyIds.length > 0 && (
          <section>
            <SectionHeader icon={<AlertCircle className="h-4 w-4" />} label="Imminent Deadlines" variant="destructive" />
            <div className="space-y-2">
              {urgentOnlyIds.map(t => (
                <Card key={t.id} className="p-3 flex items-center gap-3 cursor-pointer hover:shadow-card hover:translate-x-px transition-all duration-150 rounded-xl border-destructive/20" onClick={() => setDetailTask(t)}>
                  <span className="transit-node border-destructive bg-destructive" style={{ width: 6, height: 6, borderWidth: 0 }} />
                  <span className="text-sm flex-1 font-medium">{t.title}</span>
                  <Badge variant="destructive" className="text-[10px] font-mono rounded-full">{formatDueLabel(t.due_date!)}</Badge>
                  {t.project_id && <span className="text-xs text-accent font-medium">{projectMap.get(t.project_id)?.name}</span>}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Today's Route */}
        <section>
          <SectionHeader icon={<Navigation className="h-4 w-4" />} label="Today's Route" />
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8 font-mono">Loading route...</p>
          ) : (
            <FocusCardStack nextTasks={nextTasks} allTasks={tasks} projects={projects} milestones={milestones}
              onMarkDone={handleMarkDone} onSelect={setDetailTask} formatDueLabel={formatDueLabel} />
          )}
        </section>

        {/* Upcoming Stops */}
        {upcomingDeadlines.length > 0 && (
          <section>
            <SectionHeader icon={<CalendarDays className="h-4 w-4" />} label="Upcoming Stops" />
            <div className="space-y-2">
              {upcomingDeadlines.map(t => (
                <Card key={t.id} className="p-3 flex items-center gap-3 cursor-pointer hover:shadow-card hover:translate-x-px transition-all duration-150 rounded-xl" onClick={() => setDetailTask(t)}>
                  <span className="transit-node" />
                  <span className="text-sm flex-1 text-muted-foreground">{t.title}</span>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-full">{format(new Date(t.due_date!), 'EEE, MMM d')}</Badge>
                  {t.project_id && <span className="text-xs text-accent font-medium">{projectMap.get(t.project_id)?.name}</span>}
                </Card>
              ))}
            </div>
          </section>
        )}

        <div className="wayfinding-divider" />

        <RouteProgress tasks={tasks} />

        <div className="wayfinding-divider" />

        <HabitSection />
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
    </AppShell>
  );
}

/* Reusable section header with transit node */
function SectionHeader({ icon, label, variant }: { icon: React.ReactNode; label: string; variant?: 'destructive' }) {
  return (
    <h2 className={cn(
      "font-display text-xs font-semibold flex items-center gap-2.5 mb-3 uppercase tracking-[0.12em]",
      variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'
    )}>
      <span className={cn(
        'flex items-center justify-center w-6 h-6 rounded-full border-2',
        variant === 'destructive'
          ? 'border-destructive/40 text-destructive'
          : 'border-accent/40 text-accent'
      )}>
        {icon}
      </span>
      {label}
    </h2>
  );
}
