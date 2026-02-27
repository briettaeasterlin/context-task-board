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
import { CalendarClock, Crosshair, AlertTriangle, Clock, CheckCircle2, ArrowRight, CalendarDays } from 'lucide-react';
import { HabitSection } from '@/components/habit/HabitSection';
import { FocusCardStack } from '@/components/task/FocusCardStack';
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

  // Build timeline
  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    // Calendar events
    for (const ev of events) {
      if (ev.is_all_day) continue;
      const start = new Date(ev.start_time);
      const end = new Date(ev.end_time);
      if (!isToday(start)) continue;
      items.push({
        type: 'event',
        id: ev.id,
        title: ev.title,
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        durationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
      });
    }

    // Planned blocks
    for (const block of blocks) {
      const [h, m] = block.start_time.split(':').map(Number);
      const task = block.task_id ? taskMap.get(block.task_id) : null;
      const project = task?.project_id ? projectMap.get(task.project_id) : null;
      items.push({
        type: 'block',
        id: block.id,
        title: task?.title ?? 'Planned Block',
        startMinutes: h * 60 + m,
        durationMinutes: block.duration_minutes,
        projectName: project?.name,
        task: task ?? undefined,
      });
    }

    return items.sort((a, b) => a.startMinutes - b.startMinutes);
  }, [events, blocks, taskMap, projectMap]);

  // Now indicator
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Urgent deadlines
  const urgentDeadlines = useMemo(() => {
    const cutoff = addDays(new Date(), 2);
    return tasks
      .filter(t => t.status !== 'Done' && t.due_date)
      .filter(t => {
        const d = new Date(t.due_date!);
        return isBefore(d, cutoff) || isToday(d);
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [tasks]);

  const nextTasks = useMemo(() =>
    tasks.filter(t => t.status === 'Next').sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  [tasks]);

  const upcomingDeadlines = useMemo(() => {
    const start = addDays(new Date(), 2);
    const end = addDays(new Date(), 8);
    return tasks
      .filter(t => t.status !== 'Done' && t.due_date)
      .filter(t => {
        const d = new Date(t.due_date!);
        return !isBefore(d, start) && isBefore(d, end);
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [tasks]);

  const nextIds = new Set(nextTasks.map(t => t.id));
  const urgentOnlyIds = urgentDeadlines.filter(t => !nextIds.has(t.id));

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status: 'Next', context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
      onSuccess: () => toast.success('Task added'),
    });
  }, [createTask]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id, { onSuccess: () => toast.success('Task deleted') }); }, [deleteTask]);
  const handleMarkDone = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Done' }, { onSuccess: () => toast.success('Marked done') });
  }, [updateTask]);

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
      <div className="space-y-4">
        <QuickAdd defaultStatus="Next" projects={projects} milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={handleQuickAdd}
          onTasksCreated={() => queryClient.invalidateQueries()} />

        {/* Today's Timeline */}
        {timeline.length > 0 && (
          <section>
            <h2 className="font-mono text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
              <CalendarDays className="h-3.5 w-3.5" /> Today's Timeline
            </h2>
            <div className="space-y-1">
              {timeline.map((item, idx) => {
                const isPast = item.startMinutes + item.durationMinutes < nowMinutes;
                const isCurrent = item.startMinutes <= nowMinutes && item.startMinutes + item.durationMinutes > nowMinutes;

                return (
                  <Card
                    key={`${item.type}-${item.id}`}
                    className={cn(
                      "p-2 flex items-center gap-3 transition-colors",
                      item.type === 'block' && "cursor-pointer hover:bg-muted/50",
                      isPast && "opacity-50",
                      isCurrent && "border-primary/50 bg-accent/30"
                    )}
                    onClick={() => item.task && setDetailTask(item.task)}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground w-20 flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatTime(item.startMinutes)}
                    </div>
                    <div className={cn(
                      "w-1 h-6 rounded-full flex-shrink-0",
                      item.type === 'event' ? "bg-muted-foreground/40" : "bg-primary/60"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">{item.durationMinutes}m</span>
                        {item.projectName && <span className="text-[10px] text-primary">{item.projectName}</span>}
                        {item.type === 'event' && <Badge variant="outline" className="text-[9px] h-4">Calendar</Badge>}
                      </div>
                    </div>
                    {isCurrent && (
                      <Badge variant="default" className="text-[9px] h-4 bg-primary">Now</Badge>
                    )}
                    {item.type === 'block' && item.task && (
                      <Button
                        variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                        onClick={e => { e.stopPropagation(); handleMarkDone(item.task!.id); }}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Done
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Urgent Deadlines */}
        {urgentOnlyIds.length > 0 && (
          <section>
            <h2 className="font-mono text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Imminent Deadlines
            </h2>
            <div className="space-y-1">
              {urgentOnlyIds.map(t => (
                <Card key={t.id} className="p-2 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailTask(t)}>
                  <span className="font-mono text-xs flex-1">{t.title}</span>
                  <Badge variant="destructive" className="text-[10px] font-mono">{formatDueLabel(t.due_date!)}</Badge>
                  {t.project_id && <span className="text-[10px] text-primary font-mono">{projectMap.get(t.project_id)?.name}</span>}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Next Tasks */}
        <section>
          <h2 className="font-mono text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
            <Crosshair className="h-3.5 w-3.5" /> Next — Focus
          </h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <FocusCardStack nextTasks={nextTasks} allTasks={tasks} projects={projects} milestones={milestones}
              onMarkDone={handleMarkDone} onSelect={setDetailTask} formatDueLabel={formatDueLabel} />
          )}
        </section>

        {/* Upcoming Deadlines */}
        {upcomingDeadlines.length > 0 && (
          <section>
            <h2 className="font-mono text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
              <CalendarClock className="h-3.5 w-3.5" /> Coming Up (7 days)
            </h2>
            <div className="space-y-1">
              {upcomingDeadlines.map(t => (
                <Card key={t.id} className="p-2 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailTask(t)}>
                  <span className="font-mono text-xs flex-1 text-muted-foreground">{t.title}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">📅 {format(new Date(t.due_date!), 'EEE, MMM d')}</Badge>
                  {t.project_id && <span className="text-[10px] text-primary font-mono">{projectMap.get(t.project_id)?.name}</span>}
                </Card>
              ))}
            </div>
          </section>
        )}

        <HabitSection />
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
    </AppShell>
  );
}
