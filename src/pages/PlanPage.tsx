import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { usePlannedBlocks, useCalendarEvents, usePlannerSettings } from '@/hooks/usePlanner';
import { useAutoSchedule } from '@/hooks/useAutoSchedule';
import { ExecutionPlanPanel } from '@/components/task/ExecutionPlanPanel';
import type { ExecutionPlanTask } from '@/lib/daily-execution-engine';
import { scoreTasks } from '@/lib/task-scoring';
import { useWorkload } from '@/hooks/useWorkload';
import type { Task, TaskArea, TaskStatus, TaskInsert } from '@/types/task';
import type { PlannedBlock } from '@/hooks/usePlanner';
import { QuickAdd } from '@/components/task/QuickAdd';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { BulkAddModal } from '@/components/task/BulkAddModal';
import { UpdateForm } from '@/components/inbox/UpdateForm';
import { ClarifyCard } from '@/components/inbox/ClarifyCard';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, GripVertical, Clock, ChevronLeft, ChevronRight, RefreshCw, Link2, Unlink, Lock, Unlock, Trash2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isToday, isSunday, getDay } from 'date-fns';
import { cn } from '@/lib/utils';

const HOUR_HEIGHT = 60;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const SLOT_MINUTES = 30;

function timeToMinutes(time: string): number { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
function minutesToTime(minutes: number): string { return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`; }
function minutesToTop(minutes: number): number { return ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT; }
function minutesToHeight(duration: number): number { return (duration / 60) * HOUR_HEIGHT; }

function getPlanMode(): 'tomorrow' | 'week' {
  const now = new Date();
  const day = getDay(now);
  // Sunday = weekly planning
  if (day === 0) return 'week';
  // Evenings (after 6pm) = tomorrow planning
  if (now.getHours() >= 18) return 'tomorrow';
  // Default to week
  return 'week';
}

function getRitualMessage(mode: 'tomorrow' | 'week'): string {
  if (mode === 'tomorrow') return 'Design tomorrow with intention. 🌙';
  return 'Shape your week with clarity. 🌿';
}

export default function PlanPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { tasks, createTask, createManyTasks, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const { clarifyQuestions, updateClarifyQuestion } = useClarifyQuestions();
  const { settings } = usePlannerSettings();

  const [planMode] = useState<'tomorrow' | 'week'>(getPlanMode);
  const [weekOffset, setWeekOffset] = useState(0);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: number; minutes: number } | null>(null);

  const weekStart = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return addDays(start, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    if (planMode === 'tomorrow') {
      const tomorrow = addDays(new Date(), 1);
      return [tomorrow];
    }
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart, planMode]);

  const weekStartStr = format(weekDays[0], 'yyyy-MM-dd');
  const weekEndStr = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd');

  const { blocks, createBlock, updateBlock, deleteBlock } = usePlannedBlocks(weekStartStr, weekEndStr);
  const { events } = useCalendarEvents(
    new Date(weekStartStr).toISOString(),
    new Date(weekEndStr + 'T23:59:59').toISOString()
  );

  // Workload & auto-schedule
  const workload = useWorkload(tasks, blocks);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { weekSuggestions: autoSuggestions, executionPlan } = useAutoSchedule(
    tasks, blocks, events, todayStr, workload.calendarUtilization
  );
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [showExecutionPlan, setShowExecutionPlan] = useState(true);

  const handleAutoSchedule = useCallback(async () => {
    if (autoSuggestions.length === 0) {
      toast.info('No tasks to auto-schedule — all slots filled or no eligible tasks');
      return;
    }
    setAutoScheduling(true);
    try {
      for (const suggestion of autoSuggestions) {
        const startH = Math.floor(suggestion.startMinutes / 60);
        const startM = suggestion.startMinutes % 60;
        const startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
        await createBlock.mutateAsync({
          task_id: suggestion.task.id,
          date: suggestion.date,
          start_time: startTime,
          duration_minutes: suggestion.durationMinutes,
          source: 'auto',
          locked: false,
          notes: null,
        });
      }
      const days = [...new Set(autoSuggestions.map(s => s.date))];
      const dayLabels = days.map(d => format(new Date(d + 'T12:00:00'), 'EEE')).join(', ');
      toast.success(`Auto-scheduled ${autoSuggestions.length} tasks across ${dayLabels}`);
    } catch (err: any) {
      toast.error(err.message || 'Auto-schedule failed');
    } finally {
      setAutoScheduling(false);
    }
  }, [autoSuggestions, createBlock]);

  const handleExecutionPlanConfirm = useCallback(async () => {
    if (!executionPlan) return;
    setAutoScheduling(true);
    try {
      const allPlanTasks: ExecutionPlanTask[] = [
        ...(executionPlan.warmupTask ? [executionPlan.warmupTask] : []),
        ...(executionPlan.frogTask ? [executionPlan.frogTask] : []),
        ...executionPlan.supportingTasks,
      ];
      for (const item of allPlanTasks) {
        const startH = Math.floor(item.startMinutes / 60);
        const startM = item.startMinutes % 60;
        const startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
        await createBlock.mutateAsync({
          task_id: item.task.id,
          date: item.date,
          start_time: startTime,
          duration_minutes: item.durationMinutes,
          source: 'auto',
          locked: false,
          notes: item.reason,
        });
      }
      toast.success(`NextMove created today's plan: ${allPlanTasks.length} tasks`);
      setShowExecutionPlan(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule execution plan');
    } finally {
      setAutoScheduling(false);
    }
  }, [executionPlan, createBlock]);

  // Check for gcal-connected redirect param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gcal') === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['planner_settings'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      toast.success('Google Calendar connected!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [queryClient]);

  const handleConnectGcal = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Not authenticated'); return; }
      const returnUrl = window.location.origin + '/plan?gcal=connected';
      const res = await supabase.functions.invoke('gcal-auth/authorize', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { returnUrl },
      });
      if (res.error) throw res.error;
      window.location.href = res.data.url;
    } catch (err: any) { toast.error(err.message || 'Failed to start Google auth'); }
  }, []);

  const handleDisconnectGcal = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke('gcal-auth/disconnect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      queryClient.invalidateQueries({ queryKey: ['planner_settings'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      toast.success('Google Calendar disconnected');
    } catch (err: any) { toast.error(err.message || 'Failed to disconnect'); }
  }, [queryClient]);

  const handleSyncGcal = useCallback(async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Not authenticated'); return; }
      const res = await supabase.functions.invoke('gcal-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { timeMin: new Date(weekStartStr).toISOString(), timeMax: new Date(weekEndStr + 'T23:59:59').toISOString() },
      });
      if (res.error) throw res.error;
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      toast.success(`Synced ${res.data.count} events`);
    } catch (err: any) { toast.error(err.message || 'Sync failed'); }
    finally { setSyncing(false); }
  }, [weekStartStr, weekEndStr, queryClient]);

  const scheduledTaskIds = new Set(blocks.map(b => b.task_id).filter(Boolean));
  const unscheduledTasks = useMemo(() => {
    const eligible = tasks.filter(t => t.status === 'Next' && !scheduledTaskIds.has(t.id));
    // Sort by priority score descending
    const scored = scoreTasks(eligible, tasks);
    return scored as Task[];
  }, [tasks, scheduledTaskIds]);

  const filteredTasks = useMemo(() => {
    if (!search) return unscheduledTasks;
    const q = search.toLowerCase();
    return unscheduledTasks.filter(t => t.title.toLowerCase().includes(q));
  }, [unscheduledTasks, search]);

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const openQuestions = clarifyQuestions.filter(q => q.status === 'open');
  const projectNameMap = new Map(projects.map(p => [p.id, p.name]));

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status, context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
      onSuccess: () => toast.success('Task added'),
    });
  }, [createTask]);

  const handleBulkAdd = useCallback((newTasks: Omit<TaskInsert, 'user_id'>[]) => {
    createManyTasks.mutate(newTasks, {
      onSuccess: (data) => toast.success(`${data.length} tasks added`),
    });
  }, [createManyTasks]);

  const handleAnswer = useCallback(async (id: string, answer: string) => {
    updateClarifyQuestion.mutate({ id, status: 'answered' as any, answer });
  }, [updateClarifyQuestion]);

  const handleDismiss = useCallback((id: string) => {
    updateClarifyQuestion.mutate({ id, status: 'dismissed' as any });
  }, [updateClarifyQuestion]);

  // Drag & drop
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggingTask(task);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dayIndex: number, hour: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotOffset = Math.floor(y / (HOUR_HEIGHT / 2)) * SLOT_MINUTES;
    const minutes = hour * 60 + slotOffset;
    setDragOverSlot({ day: dayIndex, minutes });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    if (!dragOverSlot || !draggingTask) return;
    const date = format(weekDays[dayIndex], 'yyyy-MM-dd');
    createBlock.mutate({
      task_id: draggingTask.id, date, start_time: minutesToTime(dragOverSlot.minutes),
      duration_minutes: draggingTask.estimated_minutes || 60, source: 'manual', locked: false, notes: null,
    }, { onSuccess: () => toast.success(`Scheduled "${draggingTask.title}"`) });
    setDraggingTask(null); setDragOverSlot(null);
  }, [dragOverSlot, draggingTask, weekDays, createBlock]);

  const handleBlockDragStart = useCallback((e: React.DragEvent, block: PlannedBlock) => {
    e.dataTransfer.setData('application/block-id', block.id);
  }, []);

  const handleBlockDrop = useCallback((e: React.DragEvent, dayIndex: number) => {
    const blockId = e.dataTransfer.getData('application/block-id');
    if (!blockId || !dragOverSlot) return;
    e.preventDefault();
    updateBlock.mutate({ id: blockId, date: format(weekDays[dayIndex], 'yyyy-MM-dd'), start_time: minutesToTime(dragOverSlot.minutes) });
    setDragOverSlot(null);
  }, [dragOverSlot, weekDays, updateBlock]);

  const getBlocksForDay = useCallback((dayStr: string) => blocks.filter(b => b.date === dayStr), [blocks]);
  const getEventsForDay = useCallback((day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter(ev => format(new Date(ev.start_time), 'yyyy-MM-dd') === dayStr && !ev.is_all_day);
  }, [events]);

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-sans font-bold flex items-center gap-2">
            <span>🗓️</span> {planMode === 'tomorrow' ? 'Plan Tomorrow' : 'Plan Your Week'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 italic">{getRitualMessage(planMode)}</p>
        </div>

        <Tabs defaultValue="planner" className="space-y-4">
          <TabsList className="rounded-lg">
            <TabsTrigger value="planner" className="text-sm rounded-lg">🗓️ Planner</TabsTrigger>
            <TabsTrigger value="inbox" className="text-sm rounded-lg">
              📥 Inbox {openQuestions.length > 0 && <Badge variant="destructive" className="ml-1.5 text-[9px] h-4 px-1 rounded-full">{openQuestions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="add" className="text-sm rounded-lg">➕ Add Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="planner">
            <div className="flex gap-4 h-[calc(100vh-14rem)]">
              {/* Task drawer */}
              <div className="w-56 flex-shrink-0 flex flex-col border-r pr-3">
                <h3 className="font-sans text-xs font-semibold text-muted-foreground mb-2">Unscheduled</h3>
                <Input placeholder="Filter..." value={search} onChange={e => setSearch(e.target.value)} className="mb-2 h-7 text-xs rounded-lg" />
                <ScrollArea className="flex-1">
                  <div className="space-y-1.5 pr-2">
                    {filteredTasks.map((task, index) => (
                      <Card key={task.id} draggable onDragStart={e => handleDragStart(e, task)}
                        className="p-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors rounded-xl shadow-card group relative">
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetailTask(task)}>
                            <p className="text-xs font-medium truncate">{task.title}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[9px] h-4 px-1 rounded-full font-mono">#{index + 1}</Badge>
                              {task.project_id && <span className="text-[10px] text-primary truncate">{projectMap.get(task.project_id)?.name}</span>}
                              {task.estimated_minutes && <Badge variant="outline" className="text-[9px] h-4 px-1 rounded-full"><Clock className="h-2.5 w-2.5 mr-0.5" />{task.estimated_minutes}m</Badge>}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteTask.mutate(task.id, { onSuccess: () => toast.success('Task deleted') }); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
                            title="Delete task"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </Card>
                    ))}
                    {filteredTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{search ? 'No match' : 'All scheduled! 🎉'}</p>}
                  </div>
                </ScrollArea>
              </div>

              {/* Calendar grid */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Controls */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {planMode === 'week' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                        <h2 className="font-sans text-sm font-semibold">{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</h2>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        {weekOffset !== 0 && <Button variant="outline" size="sm" className="h-6 text-[10px] rounded-lg" onClick={() => setWeekOffset(0)}>Today</Button>}
                      </>
                    )}
                    {planMode === 'tomorrow' && (
                      <h2 className="font-sans text-sm font-semibold">{format(weekDays[0], 'EEEE, MMMM d')}</h2>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-6 text-[10px] gap-1 rounded-lg"
                      onClick={handleAutoSchedule}
                      disabled={autoScheduling || autoSuggestions.length === 0}
                    >
                      <Wand2 className={cn("h-3 w-3", autoScheduling && "animate-spin")} />
                      {autoScheduling ? 'Planning...' : `Plan My Day (${autoSuggestions.length} tasks)`}
                    </Button>
                    {settings?.gcal_connected ? (
                      <>
                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 rounded-lg" onClick={handleSyncGcal} disabled={syncing}>
                          <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} /> {syncing ? 'Syncing...' : 'Sync'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground rounded-lg" onClick={handleDisconnectGcal}>
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 rounded-lg" onClick={handleConnectGcal}>
                        <Link2 className="h-3 w-3" /> Connect Calendar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Execution Plan Panel */}
                {showExecutionPlan && (
                  <ExecutionPlanPanel
                    plan={executionPlan}
                    onConfirm={handleExecutionPlanConfirm}
                    onDismiss={() => setShowExecutionPlan(false)}
                    isScheduling={autoScheduling}
                  />
                )}

                {/* Day headers */}
                <div className="flex">
                  <div className="w-12 flex-shrink-0" />
                  {weekDays.map((day, i) => (
                    <div key={i} className={cn(
                      "flex-1 text-center py-1.5 border-b text-xs font-sans",
                      isToday(day) ? "bg-accent text-accent-foreground font-semibold rounded-t-lg" : "text-muted-foreground"
                    )}>
                      <div className="font-medium">{format(day, 'EEE')}</div>
                      <div className="text-[10px]">{format(day, 'MMM d')}</div>
                    </div>
                  ))}
                </div>

                {/* Time grid */}
                <ScrollArea className="flex-1">
                  <div className="flex relative">
                    <div className="w-12 flex-shrink-0">
                      {HOURS.map(hour => (
                        <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-dashed flex items-start justify-end pr-1">
                          <span className="text-[10px] text-muted-foreground font-mono -mt-1.5">
                            {hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? 'a' : 'p'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {weekDays.map((day, dayIndex) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const dayBlocks = getBlocksForDay(dayStr);
                      const dayEvents = getEventsForDay(day);
                      return (
                        <div key={dayIndex} className={cn("flex-1 relative border-l", isToday(day) && "bg-accent/20")}
                          onDragOver={e => handleDragOver(e, dayIndex, DAY_START_HOUR + Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_HEIGHT))}
                          onDrop={e => { handleDrop(e, dayIndex); handleBlockDrop(e, dayIndex); }}>
                          {HOURS.map(hour => <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-dashed" />)}
                          {dayEvents.map(ev => {
                            const start = new Date(ev.start_time); const end = new Date(ev.end_time);
                            const startMins = start.getHours() * 60 + start.getMinutes();
                            const durationMins = (end.getTime() - start.getTime()) / 60000;
                            return (
                              <div key={ev.id} className="absolute left-0.5 right-0.5 rounded-lg bg-muted/80 border px-1.5 py-0.5 overflow-hidden pointer-events-none z-10"
                                style={{ top: minutesToTop(startMins), height: Math.max(minutesToHeight(durationMins), 20) }}>
                                <p className="text-[10px] font-medium truncate text-muted-foreground">{ev.title}</p>
                              </div>
                            );
                          })}
                          {dayBlocks.map(block => {
                            const startMins = timeToMinutes(block.start_time);
                            const task = block.task_id ? taskMap.get(block.task_id) : null;
                            const project = task?.project_id ? projectMap.get(task.project_id) : null;
                            return (
                              <div key={block.id} draggable={!block.locked} onDragStart={e => handleBlockDragStart(e, block)}
                                onClick={() => { if (task) setDetailTask(task); }}
                                className={cn("absolute left-0.5 right-0.5 rounded-lg border px-1.5 py-0.5 overflow-hidden z-20 cursor-pointer group",
                                  "bg-primary/10 border-primary/30 hover:border-primary/60 transition-colors", block.locked && "opacity-80")}
                                style={{ top: minutesToTop(startMins), height: Math.max(minutesToHeight(block.duration_minutes), 24) }}>
                                <div className="flex items-start justify-between gap-0.5">
                                  <p className="text-[10px] font-medium truncate flex-1">{task?.title ?? 'Untitled'}</p>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); updateBlock.mutate({ id: block.id, locked: !block.locked }); }} className="text-muted-foreground hover:text-foreground">
                                      {block.locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteBlock.mutate(block.id); }} className="text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                </div>
                                {project && <p className="text-[9px] text-primary truncate">{project.name}</p>}
                                <p className="text-[9px] text-muted-foreground">{block.duration_minutes}m</p>
                                {block.notes && block.source === 'auto' && (
                                  <p className="text-[9px] text-muted-foreground/70 truncate italic">{block.notes}</p>
                                )}
                              </div>
                            );
                          })}
                          {dragOverSlot?.day === dayIndex && draggingTask && (
                            <div className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 z-30 pointer-events-none"
                              style={{ top: minutesToTop(dragOverSlot.minutes), height: minutesToHeight(draggingTask.estimated_minutes || 60) }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inbox">
            <div className="max-w-2xl space-y-6">
              <section>
                <h2 className="font-sans text-lg font-semibold mb-3 flex items-center gap-2"><span>📥</span> Paste an Update</h2>
                <UpdateForm projects={projects} milestones={milestones} existingTasks={tasks} onCreated={() => queryClient.invalidateQueries()} />
              </section>
              <section>
                <h2 className="font-sans text-lg font-semibold mb-3 flex items-center gap-2">
                  <span>❓</span> Clarify Queue {openQuestions.length > 0 && <span className="text-muted-foreground font-normal text-sm">({openQuestions.length} open)</span>}
                </h2>
                {openQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No open questions. 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {openQuestions.map(q => (
                      <ClarifyCard key={q.id} question={q} projectName={projectNameMap.get(q.project_id)} onAnswer={handleAnswer} onDismiss={handleDismiss} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="add">
            <div className="max-w-2xl space-y-4">
              <QuickAdd defaultStatus="Next" projects={projects} milestones={milestones}
                allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
                onAdd={handleQuickAdd}
                onTasksCreated={() => queryClient.invalidateQueries()} />
              <Button variant="outline" size="sm" className="text-xs rounded-lg" onClick={() => setBulkAddOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Bulk Add Tasks
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={(id, u) => updateTask.mutate({ id, ...u })} onDelete={(id) => { deleteTask.mutate(id, { onSuccess: () => { setDetailTask(null); toast.success('Task deleted'); } }); }} projects={projects} milestones={milestones} />
      <BulkAddModal open={bulkAddOpen} onClose={() => setBulkAddOpen(false)} onConfirm={handleBulkAdd} projects={projects} />
    </AppShell>
  );
}
