import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import type { Task, TaskArea, TaskStatus, TaskUpdate } from '@/types/task';
import { QuickAdd } from '@/components/task/QuickAdd';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Crosshair, AlertTriangle } from 'lucide-react';
import { HabitSection } from '@/components/habit/HabitSection';
import { FocusCardStack } from '@/components/task/FocusCardStack';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, isPast, addDays, isBefore } from 'date-fns';

export default function TodayPage() {
  const queryClient = useQueryClient();
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();

  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Tasks with imminent hard deadlines (today, tomorrow, or overdue) — not Done
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

  // All Next tasks sorted by sort_order (user's manual order)
  const nextTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'Next')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [tasks]);

  // Upcoming deadlines (next 7 days, not in urgent)
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

  // Merge urgent deadlines with Next tasks, deduplicating
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

  return (
    <AppShell>
      <div className="space-y-4">
        <QuickAdd defaultStatus="Next" projects={projects} milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={handleQuickAdd}
          onTasksCreated={() => queryClient.invalidateQueries()} />

        {/* Urgent Deadlines (not already in Next) */}
        {urgentOnlyIds.length > 0 && (
          <section>
            <h2 className="font-mono text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Imminent Deadlines
            </h2>
            <div className="space-y-1">
              {urgentOnlyIds.map(t => (
                <Card key={t.id} className="p-2 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailTask(t)}>
                  <span className="font-mono text-xs flex-1">{t.title}</span>
                  <Badge variant="destructive" className="text-[10px] font-mono">
                    {formatDueLabel(t.due_date!)}
                  </Badge>
                  {t.project_id && (
                    <span className="text-[10px] text-primary font-mono">{projects.find(p => p.id === t.project_id)?.name}</span>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Next Tasks — grouped by project as stacked cards */}
        <section>
          <h2 className="font-mono text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
            <Crosshair className="h-3.5 w-3.5" /> Next — Focus
          </h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <FocusCardStack
              nextTasks={nextTasks}
              allTasks={tasks}
              projects={projects}
              milestones={milestones}
              onMarkDone={handleMarkDone}
              onSelect={setDetailTask}
              formatDueLabel={formatDueLabel}
            />
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
                  <Badge variant="outline" className="text-[10px] font-mono">
                    📅 {format(new Date(t.due_date!), 'EEE, MMM d')}
                  </Badge>
                  {t.project_id && (
                    <span className="text-[10px] text-primary font-mono">{projects.find(p => p.id === t.project_id)?.name}</span>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Habit Intentions */}
        <HabitSection />
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
    </AppShell>
  );
}