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
import { Clock, CheckCircle2, Zap, CalendarCheck } from 'lucide-react';
import { HabitSection } from '@/components/habit/HabitSection';
import { FocusCardStack } from '@/components/task/FocusCardStack';
import { toast } from 'sonner';
import { format, isToday, isPast, isTomorrow, addDays, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { generateDailyPlan, getQuickWins, type ScoredTask } from '@/lib/task-scoring';

interface TimelineItem {
  type: 'event' | 'block';
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
  projectName?: string;
  task?: Task;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  return { text: 'Good evening', emoji: '🌙' };
}

function getRitualMessage(): string {
  return 'One thing at a time.';
}

export default function FocusPage() {
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

  // Timeline for today
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

  const nextTasks = useMemo(() =>
    tasks.filter(t => t.status === 'Today' || t.status === 'Next').sort((a, b) => {
      if (a.status === 'Today' && b.status !== 'Today') return -1;
      if (b.status === 'Today' && a.status !== 'Today') return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    }),
  [tasks]);

  // Waiting follow-ups (brief)
  const waitingTasks = useMemo(() => tasks.filter(t => t.status === 'Waiting'), [tasks]);

  // Urgent deadlines (today + tomorrow)
  const urgentDeadlines = useMemo(() => {
    const cutoff = addDays(new Date(), 2);
    return tasks
      .filter(t => t.status !== 'Done' && t.due_date)
      .filter(t => { const d = new Date(t.due_date!); return isBefore(d, cutoff) || isToday(d); })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [tasks]);

  const nextIds = new Set(nextTasks.map(t => t.id));
  const urgentOnly = urgentDeadlines.filter(t => !nextIds.has(t.id));

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status: 'Next', context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
      onSuccess: () => toast.success('Task added'),
    });
  }, [createTask]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id, { onSuccess: () => toast.success('Task deleted') }); }, [deleteTask]);
  const handleMarkDone = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Done' }, { onSuccess: () => toast.success('Task complete. Momentum builds momentum.') });
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
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Greeting */}
        <div className="pt-2">
          <h1 className="text-2xl font-sans font-bold flex items-center gap-2">
            <span>{greeting.emoji}</span>
            {greeting.text}, Brietta
          </h1>
          <p className="text-sm text-muted-foreground mt-1 italic">
            {getRitualMessage()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d')} · {nextTasks.length} tasks in focus
          </p>
        </div>

        <QuickAdd defaultStatus="Next" projects={projects} milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={handleQuickAdd}
          onTasksCreated={() => queryClient.invalidateQueries()} />

        {/* Today's Timeline */}
        {timeline.length > 0 && (
          <section>
            <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3">
              <span>📅</span> Timeline
            </h2>
            <div className="space-y-2">
              {timeline.map((item) => {
                const isPastItem = item.startMinutes + item.durationMinutes < nowMinutes;
                const isCurrent = item.startMinutes <= nowMinutes && item.startMinutes + item.durationMinutes > nowMinutes;
                return (
                  <Card
                    key={`${item.type}-${item.id}`}
                    className={cn(
                      "p-3 flex items-center gap-3 transition-all duration-200 rounded-xl shadow-card",
                      item.type === 'block' && "cursor-pointer hover:shadow-elevated hover:-translate-y-0.5",
                      isPastItem && "opacity-40",
                      isCurrent && "border-primary/50 bg-accent/40 shadow-elevated"
                    )}
                    onClick={() => item.task && setDetailTask(item.task)}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground w-20 flex-shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(item.startMinutes)}
                    </div>
                    <div className={cn(
                      "w-1 h-7 rounded-full flex-shrink-0",
                      item.type === 'event' ? "bg-muted-foreground/30" : "bg-primary/60"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{item.durationMinutes}m</span>
                        {item.projectName && <span className="text-xs text-primary">{item.projectName}</span>}
                        {item.type === 'event' && <Badge variant="outline" className="text-[10px] h-5 rounded-full">Calendar</Badge>}
                      </div>
                    </div>
                    {isCurrent && <Badge variant="default" className="text-[10px] h-5 bg-primary rounded-full">Now</Badge>}
                    {item.type === 'block' && item.task && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs rounded-lg"
                        onClick={e => { e.stopPropagation(); handleMarkDone(item.task!.id); }}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Urgent */}
        {urgentOnly.length > 0 && (
          <section>
            <h2 className="font-sans text-lg font-semibold text-destructive flex items-center gap-2 mb-3">
              <span>🚨</span> Imminent
            </h2>
            <div className="space-y-2">
              {urgentOnly.map(t => (
                <Card key={t.id} className="p-3 flex items-center gap-3 cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 rounded-xl shadow-card border-destructive/20" onClick={() => setDetailTask(t)}>
                  <span className="text-sm flex-1 font-medium">{t.title}</span>
                  <Badge variant="destructive" className="text-[10px] font-mono rounded-full">{formatDueLabel(t.due_date!)}</Badge>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Focus Tasks */}
        <section>
          <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3">
            <span>🎯</span> Focus
          </h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <FocusCardStack nextTasks={nextTasks} allTasks={tasks} projects={projects} milestones={milestones}
              onMarkDone={handleMarkDone} onSelect={setDetailTask} formatDueLabel={formatDueLabel} />
          )}
        </section>

        {/* Daily Plan Generator */}
        <DailyPlanSection tasks={tasks} onSelect={setDetailTask} onMarkDone={handleMarkDone} />

        {/* Quick Wins */}
        <QuickWinsSection tasks={tasks} onSelect={setDetailTask} onMarkDone={handleMarkDone} />

        {/* Waiting follow-ups (minimal) */}
        {waitingTasks.length > 0 && (
          <section>
            <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-2 text-muted-foreground">
              <span>⏳</span> Waiting on others ({waitingTasks.length})
            </h2>
            <div className="space-y-1">
              {waitingTasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors rounded-lg p-2 hover:bg-muted/30"
                  onClick={() => setDetailTask(t)}>
                  <span className="truncate flex-1">{t.title}</span>
                  {t.blocked_by && <span className="text-xs text-status-waiting shrink-0">⏳ {t.blocked_by}</span>}
                </div>
              ))}
              {waitingTasks.length > 5 && (
                <p className="text-xs text-muted-foreground pl-2">+{waitingTasks.length - 5} more</p>
              )}
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

// ─── Daily Plan Generator ───

const TIME_BUDGETS = [
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
  { label: 'Full day', minutes: 480 },
];

function DailyPlanSection({ tasks, onSelect, onMarkDone }: { tasks: Task[]; onSelect: (t: Task) => void; onMarkDone: (id: string) => void }) {
  const [budget, setBudget] = useState<number | null>(null);

  const plan = useMemo(() => {
    if (budget === null) return [];
    return generateDailyPlan(tasks, budget, tasks);
  }, [tasks, budget]);

  const totalMinutes = plan.reduce((sum, t) => sum + t.estimatedMinutesCalc, 0);

  return (
    <section>
      <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3">
        <CalendarCheck className="h-5 w-5 text-primary" /> Daily Plan
      </h2>
      <div className="flex gap-2 mb-3">
        {TIME_BUDGETS.map(b => (
          <Button
            key={b.minutes}
            variant={budget === b.minutes ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 rounded-lg"
            onClick={() => setBudget(budget === b.minutes ? null : b.minutes)}
          >
            {b.label}
          </Button>
        ))}
      </div>
      {budget !== null && (
        <Card className="p-4 rounded-xl shadow-card space-y-2">
          {plan.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No Next tasks to fill this time budget.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {totalMinutes}m planned of {budget}m budget
                </span>
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (totalMinutes / budget) * 100)}%` }} />
                </div>
              </div>
              {plan.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => onSelect(t)}>
                  <span className="text-xs text-muted-foreground font-mono w-5">{i + 1}.</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => { e.stopPropagation(); onMarkDone(t.id); }}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-sm font-medium flex-1 truncate">{t.title}</span>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">{t.estimatedDuration}</span>
                  <span className={cn(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0',
                    t.priorityScore >= 8 ? 'bg-destructive/10 text-destructive' :
                    t.priorityScore >= 5 ? 'bg-status-next/10 text-status-next' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {t.priorityScore}
                  </span>
                </div>
              ))}
            </>
          )}
        </Card>
      )}
    </section>
  );
}

// ─── Quick Wins ───

function QuickWinsSection({ tasks, onSelect, onMarkDone }: { tasks: Task[]; onSelect: (t: Task) => void; onMarkDone: (id: string) => void }) {
  const quickWins = useMemo(() => getQuickWins(tasks, tasks), [tasks]);

  if (quickWins.length === 0) return null;

  return (
    <section>
      <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-2 text-muted-foreground">
        <Zap className="h-4 w-4 text-status-waiting" /> Quick Wins ({quickWins.length})
      </h2>
      <div className="space-y-1">
        {quickWins.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 transition-colors rounded-lg p-2 group"
            onClick={() => onSelect(t)}>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); onMarkDone(t.id); }}>
              <CheckCircle2 className="h-3 w-3" />
            </Button>
            <span className="flex-1 truncate">{t.title}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{t.estimatedDuration}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
