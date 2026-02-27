import { useState, useMemo, useCallback, useRef } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { usePlannedBlocks, useCalendarEvents, usePlannerSettings } from '@/hooks/usePlanner';
import type { Task } from '@/types/task';
import type { PlannedBlock, CalendarEvent } from '@/hooks/usePlanner';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, GripVertical, Clock, Calendar, Lock, Unlock, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOUR_HEIGHT = 60; // px per hour
const SLOT_MINUTES = 30;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function minutesToTop(minutes: number): number {
  return ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function minutesToHeight(duration: number): number {
  return (duration / 60) * HOUR_HEIGHT;
}

export default function WeekPlannerPage() {
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return addDays(start, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
  [weekStart]);

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { blocks, createBlock, updateBlock, deleteBlock } = usePlannedBlocks(weekStartStr, weekEndStr);
  const { events } = useCalendarEvents(
    new Date(weekStartStr).toISOString(),
    new Date(weekEndStr + 'T23:59:59').toISOString()
  );
  const { settings } = usePlannerSettings();

  // Unscheduled tasks (Next status, not already in a block this week)
  const scheduledTaskIds = new Set(blocks.map(b => b.task_id).filter(Boolean));
  const unscheduledTasks = useMemo(() =>
    tasks.filter(t => t.status === 'Next' && !scheduledTaskIds.has(t.id))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  [tasks, scheduledTaskIds]);

  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: number; minutes: number } | null>(null);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredTasks = useMemo(() => {
    if (!search) return unscheduledTasks;
    const q = search.toLowerCase();
    return unscheduledTasks.filter(t => t.title.toLowerCase().includes(q));
  }, [unscheduledTasks, search]);

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
    const startTime = minutesToTime(dragOverSlot.minutes);
    const duration = draggingTask.estimated_minutes || 60;

    createBlock.mutate({
      task_id: draggingTask.id,
      date,
      start_time: startTime,
      duration_minutes: duration,
      source: 'manual',
      locked: false,
      notes: null,
    }, {
      onSuccess: () => toast.success(`Scheduled "${draggingTask.title}"`),
      onError: (e) => toast.error(e.message),
    });

    setDraggingTask(null);
    setDragOverSlot(null);
  }, [dragOverSlot, draggingTask, weekDays, createBlock]);

  const handleBlockDragStart = useCallback((e: React.DragEvent, block: PlannedBlock) => {
    e.dataTransfer.setData('application/block-id', block.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleBlockDrop = useCallback((e: React.DragEvent, dayIndex: number) => {
    const blockId = e.dataTransfer.getData('application/block-id');
    if (!blockId || !dragOverSlot) return;
    e.preventDefault();

    const date = format(weekDays[dayIndex], 'yyyy-MM-dd');
    const startTime = minutesToTime(dragOverSlot.minutes);

    updateBlock.mutate({ id: blockId, date, start_time: startTime }, {
      onSuccess: () => toast.success('Block moved'),
    });

    setDragOverSlot(null);
  }, [dragOverSlot, weekDays, updateBlock]);

  const getBlocksForDay = useCallback((dayStr: string) =>
    blocks.filter(b => b.date === dayStr),
  [blocks]);

  const getEventsForDay = useCallback((day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter(ev => {
      const evDate = format(new Date(ev.start_time), 'yyyy-MM-dd');
      return evDate === dayStr && !ev.is_all_day;
    });
  }, [events]);

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  return (
    <AppShell>
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Left sidebar: task drawer */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r pr-4">
          <h2 className="font-mono text-xs font-semibold text-muted-foreground mb-2">Unscheduled Tasks</h2>
          <Input
            placeholder="Filter tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-2 h-7 text-xs"
          />
          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-2">
              {filteredTasks.map(task => (
                <Card
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task)}
                  className="p-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs truncate">{task.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {task.project_id && (
                          <span className="text-[10px] text-primary truncate">
                            {projectMap.get(task.project_id)?.name}
                          </span>
                        )}
                        {task.estimated_minutes && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            {task.estimated_minutes}m
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {filteredTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {search ? 'No matching tasks' : 'All Next tasks scheduled!'}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Center: week grid */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Week header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-mono text-sm font-semibold">
                {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
              </h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setWeekOffset(0)}>
                  Today
                </Button>
              )}
            </div>
          </div>

          {/* Day headers */}
          <div className="flex">
            <div className="w-12 flex-shrink-0" /> {/* time gutter */}
            {weekDays.map((day, i) => (
              <div key={i} className={cn(
                "flex-1 text-center py-1 border-b text-xs font-mono",
                isToday(day) ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground"
              )}>
                <div>{format(day, 'EEE')}</div>
                <div className="text-[10px]">{format(day, 'MMM d')}</div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <ScrollArea className="flex-1">
            <div className="flex relative">
              {/* Time gutter */}
              <div className="w-12 flex-shrink-0">
                {HOURS.map(hour => (
                  <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-dashed flex items-start justify-end pr-1">
                    <span className="text-[10px] text-muted-foreground font-mono -mt-1.5">
                      {hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? 'a' : 'p'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIndex) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayBlocks = getBlocksForDay(dayStr);
                const dayEvents = getEventsForDay(day);

                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      "flex-1 relative border-l",
                      isToday(day) && "bg-accent/20"
                    )}
                    onDragOver={e => handleDragOver(e, dayIndex, DAY_START_HOUR + Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_HEIGHT))}
                    onDrop={e => {
                      handleDrop(e, dayIndex);
                      handleBlockDrop(e, dayIndex);
                    }}
                  >
                    {/* Hour lines */}
                    {HOURS.map(hour => (
                      <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-dashed" />
                    ))}

                    {/* Google Calendar events (fixed blocks) */}
                    {dayEvents.map(ev => {
                      const start = new Date(ev.start_time);
                      const end = new Date(ev.end_time);
                      const startMins = start.getHours() * 60 + start.getMinutes();
                      const durationMins = (end.getTime() - start.getTime()) / 60000;
                      const top = minutesToTop(startMins);
                      const height = minutesToHeight(durationMins);

                      return (
                        <div
                          key={ev.id}
                          className="absolute left-0.5 right-0.5 rounded bg-muted/80 border border-border px-1.5 py-0.5 overflow-hidden pointer-events-none z-10"
                          style={{ top, height: Math.max(height, 20) }}
                        >
                          <p className="text-[10px] font-mono font-medium truncate text-muted-foreground">{ev.title}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                          </p>
                        </div>
                      );
                    })}

                    {/* Planned task blocks */}
                    {dayBlocks.map(block => {
                      const startMins = timeToMinutes(block.start_time);
                      const top = minutesToTop(startMins);
                      const height = minutesToHeight(block.duration_minutes);
                      const task = block.task_id ? taskMap.get(block.task_id) : null;
                      const project = task?.project_id ? projectMap.get(task.project_id) : null;

                      return (
                        <div
                          key={block.id}
                          draggable={!block.locked}
                          onDragStart={e => handleBlockDragStart(e, block)}
                          className={cn(
                            "absolute left-0.5 right-0.5 rounded border px-1.5 py-0.5 overflow-hidden z-20 cursor-grab active:cursor-grabbing group",
                            "bg-primary/10 border-primary/30 hover:border-primary/60 transition-colors",
                            block.locked && "cursor-default opacity-80"
                          )}
                          style={{ top, height: Math.max(height, 24) }}
                        >
                          <div className="flex items-start justify-between gap-0.5">
                            <p className="text-[10px] font-mono font-medium truncate flex-1">
                              {task?.title ?? 'Untitled'}
                            </p>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => updateBlock.mutate({ id: block.id, locked: !block.locked })}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {block.locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                              </button>
                              <button
                                onClick={() => deleteBlock.mutate(block.id, { onSuccess: () => toast.success('Block removed') })}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                          {project && <p className="text-[9px] text-primary truncate">{project.name}</p>}
                          <p className="text-[9px] text-muted-foreground">
                            {minutesToTime(startMins).replace(/^0/, '')} · {block.duration_minutes}m
                          </p>
                        </div>
                      );
                    })}

                    {/* Drop preview */}
                    {dragOverSlot?.day === dayIndex && draggingTask && (
                      <div
                        className="absolute left-0.5 right-0.5 rounded border-2 border-dashed border-primary/50 bg-primary/5 z-30 pointer-events-none"
                        style={{
                          top: minutesToTop(dragOverSlot.minutes),
                          height: minutesToHeight(draggingTask.estimated_minutes || 60),
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </AppShell>
  );
}
