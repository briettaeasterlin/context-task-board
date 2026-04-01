import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import type { Task, Project } from '@/types/task';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ArrowRight, X, Plus, Search, Clock, Sparkles, Moon, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

type PlanStep = 'suggest' | 'adjust' | 'confirmed';

const MAX_PLAN_TASKS = 7;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPlanInput(raw: string) {
  let title = raw.trim();
  let targetWindow: string | null = null;

  const timeMatch = title.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (timeMatch) {
    targetWindow = timeMatch[1].trim();
    title = title.replace(timeMatch[0], ' ');
  }

  title = title.replace(/\btomorrow\b/gi, ' ');
  title = title.replace(/\s+/g, ' ').trim();

  return { title, targetWindow };
}

function inferProjectForText(input: string, projects: Project[]) {
  const normalized = normalizeText(input);
  const words = new Set(normalized.split(' ').filter(Boolean));

  const groupHints: Record<string, string[]> = {
    consulting: ['client', 'proposal', 'meeting', 'deliverable', 'consulting', 'pitch', 'deck'],
    products: ['app', 'build', 'launch', 'product', 'feature', 'prototype'],
    health: ['doctor', 'medical', 'therapy', 'wellness', 'health', 'workout', 'gym'],
    life: ['home', 'nursery', 'baby', 'organizer', 'legal', 'admin', 'finance', 'family', 'insurance', 'tax'],
    parked: [],
  };

  const specialHints = [
    { pattern: /(nursery|baby|shower|crib|postpartum)/i, matcher: /baby/i, score: 9 },
    { pattern: /(organizer|organize|organization|declutter|closet|garage|house|home)/i, matcher: /home improvement|organization/i, score: 8 },
    { pattern: /(insurance|budget|finance|bank|bill|money)/i, matcher: /finance/i, score: 8 },
    { pattern: /(tax|irs)/i, matcher: /tax/i, score: 9 },
    { pattern: /(legal|paperwork|dmv|license|admin)/i, matcher: /admin|legal/i, score: 8 },
    { pattern: /(doctor|medical|wellness|therapy|checkup|dentist|health)/i, matcher: /health|wellness/i, score: 8 },
  ];

  let best: { project: Project; score: number } | null = null;

  for (const project of projects) {
    let score = 0;
    const projectName = normalizeText(project.name);
    const projectWords = projectName.split(' ').filter(Boolean);

    if (normalized.includes(projectName) && projectName.length > 3) score += 10;

    for (const word of projectWords) {
      if (word.length > 2 && words.has(word)) score += 2;
    }

    const routeHints = project.route_group ? groupHints[project.route_group] ?? [] : [];
    for (const hint of routeHints) {
      if (words.has(hint)) score += 1;
    }

    for (const hint of specialHints) {
      if (hint.pattern.test(normalized) && hint.matcher.test(project.name)) score += hint.score;
    }

    if (project.project_state === 'active') score += 0.5;

    if (!best || score > best.score) {
      best = { project, score };
    }
  }

  return best && best.score >= 2 ? best.project : null;
}

interface SortableTaskCardProps {
  task: Task;
  taskProject?: Project;
  isSwapTarget?: boolean;
  adjustMode?: boolean;
  onRemove?: (id: string) => void;
  onSwap?: (id: string) => void;
  onClick?: (task: Task) => void;
  isConfirmed?: boolean;
  displayCount: number;
}

function SortableTaskCard({ task, taskProject, isSwapTarget, adjustMode, onRemove, onSwap, onClick, isConfirmed, displayCount }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl overflow-hidden group cursor-pointer transition-colors',
        isSwapTarget ? 'ring-2 ring-accent bg-accent/10' : 'hover:bg-muted/30',
        isDragging && 'shadow-lg'
      )}
      onClick={() => {
        if (adjustMode && isSwapTarget) {
          onSwap?.('');
        } else if (adjustMode && displayCount >= MAX_PLAN_TASKS) {
          onSwap?.(task.id);
          toast('Now press Enter to add the replacement.');
        } else {
          onClick?.(task);
        }
      }}
    >
      <div className="flex items-stretch">
        {taskProject?.line_color && <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />}
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 flex-1">
          <button
            className="touch-none p-1 -ml-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{task.title}</p>
            {taskProject && <p className="text-xs text-muted-foreground mt-0.5">{taskProject.name}</p>}
          </div>
          {task.target_window && <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{task.target_window}</span>}
          {task.estimated_minutes && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono flex-shrink-0">
              <Clock className="h-3 w-3" />{task.estimated_minutes}m
            </span>
          )}
          {adjustMode && onRemove && (
            <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-6 sm:w-6 p-0 rounded-full sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onRemove(task.id); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function PlanPage() {
  const navigate = useNavigate();
  const { tasks, createTask, updateTask, deleteTask, reorderTasks } = useTasks();
  const { projects } = useProjects();
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);

  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const existingPlan = useMemo(() => {
    return tasks.filter(t => t.planned_date === tomorrowStr && t.status !== 'Done');
  }, [tasks, tomorrowStr]);

  const [step, setStep] = useState<PlanStep>(existingPlan.length > 0 ? 'confirmed' : 'suggest');
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [adjustMode, setAdjustMode] = useState(false);
  const [search, setSearch] = useState('');
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const suggestedTasks = useMemo(() => {
    const result: Task[] = [];
    const usedIds = new Set<string>();

    for (const t of tasks) {
      if (t.planned_date === tomorrowStr && t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing') {
        result.push(t);
        usedIds.add(t.id);
      }
    }

    for (const t of tasks) {
      if (usedIds.has(t.id)) continue;
      if (t.planned_date === todayStr && t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing') {
        result.push(t);
        usedIds.add(t.id);
      }
    }

    const nextWithDue = tasks
      .filter(t => !usedIds.has(t.id) && t.status === 'Next' && t.due_date)
      .sort((a, b) => (a.due_date!).localeCompare(b.due_date!));
    for (const t of nextWithDue) {
      if (result.length >= 5) break;
      result.push(t);
      usedIds.add(t.id);
    }

    const nextNoDue = tasks
      .filter(t => !usedIds.has(t.id) && t.status === 'Next' && !t.due_date)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const t of nextNoDue) {
      if (result.length >= 5) break;
      result.push(t);
      usedIds.add(t.id);
    }

    return result.slice(0, 5);
  }, [tasks, tomorrowStr, todayStr]);

  const displayTasks = useMemo(() => {
    if (step === 'confirmed') return existingPlan;
    if (selectedTasks.length > 0) return selectedTasks;
    return suggestedTasks;
  }, [step, selectedTasks, suggestedTasks, existingPlan]);

  const normalizedSearch = useMemo(() => normalizeText(search), [search]);

  const backlogTasks = useMemo(() => {
    if (!search.trim()) return [];
    const selectedIds = new Set(displayTasks.map(t => t.id));
    return tasks
      .filter(t => t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing' && !selectedIds.has(t.id) && normalizeText(t.title).includes(normalizedSearch))
      .slice(0, 10);
  }, [tasks, search, displayTasks, normalizedSearch]);

  const exactSearchMatch = useMemo(() => {
    return backlogTasks.find(task => normalizeText(task.title) === normalizedSearch) ?? null;
  }, [backlogTasks, normalizedSearch]);

  const inferredProject = useMemo(() => {
    if (!search.trim()) return null;
    return inferProjectForText(search, projects);
  }, [search, projects]);

  const estimatedMinutes = displayTasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);

  const handleConfirm = useCallback(async () => {
    const tasksToConfirm = selectedTasks.length > 0 ? selectedTasks : suggestedTasks;
    const keepIds = new Set(tasksToConfirm.map(task => task.id));
    const tasksToClear = tasks.filter(task => task.planned_date === tomorrowStr && task.status !== 'Done' && !keepIds.has(task.id));

    await Promise.all([
      ...tasksToConfirm.map(task =>
        updateTask.mutateAsync({
          id: task.id,
          planned_date: tomorrowStr,
          status: task.status === 'Backlog' ? 'Next' : task.status,
        } as any)
      ),
      ...tasksToClear.map(task =>
        updateTask.mutateAsync({ id: task.id, planned_date: null } as any)
      ),
    ]);

    setStep('confirmed');
    setAdjustMode(false);
    setSwapTargetId(null);
    toast.success(`Tomorrow is set. ${tasksToConfirm.length} moves locked in.`);
  }, [selectedTasks, suggestedTasks, tasks, updateTask, tomorrowStr]);

  const handleAddTask = useCallback((task: Task) => {
    setSelectedTasks(prev => {
      const existing = prev.length > 0 ? prev : [...suggestedTasks];
      if (existing.find(t => t.id === task.id)) return existing;

      if (swapTargetId) {
        const updated = existing.map(t => t.id === swapTargetId ? task : t);
        setSwapTargetId(null);
        return updated;
      }

      if (existing.length >= MAX_PLAN_TASKS) {
        toast.error('Tap a planned task to swap it out, then press Enter.');
        return existing;
      }
      return [...existing, task];
    });
    setSearch('');
  }, [suggestedTasks, swapTargetId]);

  const handleCreateFromSearch = useCallback(async () => {
    const raw = search.trim();
    if (!raw) return;

    if (exactSearchMatch) {
      handleAddTask(exactSearchMatch);
      return;
    }

    if (displayTasks.length >= MAX_PLAN_TASKS && !swapTargetId) {
      toast.error('Tap a planned task to swap it out first.');
      return;
    }

    const { title, targetWindow } = extractPlanInput(raw);
    if (!title) {
      toast.error('Add a task name first.');
      return;
    }

    const routedProject = inferProjectForText(raw, projects);
    const createdTask = await createTask.mutateAsync({
      title,
      area: routedProject?.area ?? 'Personal',
      status: 'Next',
      context: null,
      notes: targetWindow ? `Planned window: ${targetWindow}` : null,
      tags: [],
      project_id: routedProject?.id ?? null,
      milestone_id: null,
      blocked_by: null,
      source: 'plan',
      due_date: null,
      target_window: targetWindow,
      planned_date: null,
    } as any);

    handleAddTask(createdTask);
    toast.success(routedProject ? `Added to tomorrow • routed to ${routedProject.name}` : 'Added to tomorrow');
  }, [search, exactSearchMatch, displayTasks.length, swapTargetId, projects, createTask, handleAddTask]);

  const handleRemoveTask = useCallback((taskId: string) => {
    setSelectedTasks(prev => {
      const existing = prev.length > 0 ? prev : [...suggestedTasks];
      return existing.filter(t => t.id !== taskId);
    });
    if (swapTargetId === taskId) setSwapTargetId(null);
  }, [suggestedTasks, swapTargetId]);

  const handleAdjust = useCallback(() => {
    if (step === 'confirmed') {
      setSelectedTasks(existingPlan);
      setStep('suggest');
    }
    setAdjustMode(true);
  }, [step, existingPlan]);

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto px-1 sm:px-0">
        {step === 'confirmed' && (
          <>
            <Card className="p-4 sm:p-8 rounded-2xl bg-accent/5 border-accent/20 text-center">
              <Moon className="h-6 w-6 sm:h-8 sm:w-8 text-accent mx-auto mb-2 sm:mb-3 opacity-60" />
              <h1 className="text-xl sm:text-2xl font-display font-bold">✅ Tomorrow is set.</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {existingPlan.length} move{existingPlan.length !== 1 ? 's' : ''} locked in.
                {estimatedMinutes > 0 && ` Estimated: ${estimatedMinutes >= 60 ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ''}` : `${estimatedMinutes}m`}.`}
              </p>
              {existingPlan[0] && (
                <p className="text-sm text-muted-foreground mt-2">
                  You'll start with: <span className="font-semibold text-foreground">{existingPlan[0].title}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4 font-mono">Close your laptop. You're good.</p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <Button variant="outline" onClick={() => navigate('/today')} className="rounded-xl font-display" size="sm">
                  View Tomorrow <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <Button variant="ghost" onClick={handleAdjust} className="rounded-xl text-xs text-muted-foreground" size="sm">
                  Adjust
                </Button>
              </div>
            </Card>

            <section>
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tomorrow's Route</h2>
              <div className="space-y-2">
                {existingPlan.map(task => {
                  const taskProject = projectMap.get(task.project_id ?? '');
                  return (
                    <Card key={task.id} className="rounded-xl overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setDrawerTask(task)}>
                      <div className="flex items-stretch">
                        {taskProject?.line_color && <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />}
                        <div className="flex items-center gap-3 p-4 flex-1">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{task.title}</p>
                            {taskProject && <p className="text-xs text-muted-foreground mt-0.5">{taskProject.name}</p>}
                          </div>
                          {task.target_window && <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{task.target_window}</span>}
                          {task.estimated_minutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono flex-shrink-0">
                              <Clock className="h-3 w-3" />{task.estimated_minutes}m
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {step !== 'confirmed' && (
          <>
            <div>
              <h1 className="text-2xl font-display font-bold">
                <Sparkles className="h-5 w-5 inline mr-2 text-accent" />
                Plan Tomorrow
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Here's what would move things forward tomorrow:
              </p>
            </div>

            {displayTasks.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full border-2 border-muted-foreground/30" />
                    <span className="w-8 h-px bg-muted-foreground/20" />
                    <span className="w-2 h-2 rounded-full border-2 border-muted-foreground/30" />
                    <span className="w-8 h-px bg-muted-foreground/20" />
                    <span className="w-2 h-2 rounded-full border-2 border-muted-foreground/30" />
                  </div>
                </div>
                <p className="text-muted-foreground mb-1">No tasks to suggest.</p>
                <p className="text-sm text-muted-foreground">Add some tasks first, then come back to plan.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {displayTasks.map(task => {
                  const taskProject = projectMap.get(task.project_id ?? '');
                  return (
                    <Card
                      key={task.id}
                      className={cn(
                        'rounded-xl overflow-hidden group cursor-pointer transition-colors',
                        swapTargetId === task.id ? 'ring-2 ring-accent bg-accent/10' : 'hover:bg-muted/30'
                      )}
                      onClick={() => {
                        if (adjustMode && swapTargetId === task.id) {
                          setSwapTargetId(null);
                        } else if (adjustMode && displayTasks.length >= MAX_PLAN_TASKS) {
                          setSwapTargetId(task.id);
                          toast('Now press Enter to add the replacement.');
                        } else {
                          setDrawerTask(task);
                        }
                      }}
                    >
                      <div className="flex items-stretch">
                        {taskProject?.line_color && <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />}
                        <div className="flex items-center gap-3 p-4 flex-1">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{task.title}</p>
                            {taskProject && <p className="text-xs text-muted-foreground mt-0.5">{taskProject.name}</p>}
                          </div>
                          {task.target_window && <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{task.target_window}</span>}
                          {task.estimated_minutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono flex-shrink-0">
                              <Clock className="h-3 w-3" />{task.estimated_minutes}m
                            </span>
                          )}
                          {adjustMode && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-6 sm:w-6 p-0 rounded-full sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleRemoveTask(task.id); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {estimatedMinutes > 0 && (
              <p className="text-xs text-muted-foreground font-mono">
                Estimated: {estimatedMinutes >= 60 ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ''}` : `${estimatedMinutes}m`}
              </p>
            )}

            {adjustMode && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search or type a new obligation..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && search.trim()) {
                        e.preventDefault();
                        if (exactSearchMatch) {
                          handleAddTask(exactSearchMatch);
                        } else {
                          await handleCreateFromSearch();
                        }
                      }
                    }}
                    className="pl-9 rounded-xl text-sm"
                  />
                </div>

                {swapTargetId && (
                  <p className="text-xs text-accent font-medium animate-pulse">
                    Tap the highlighted task again to cancel, or press Enter to swap in the new one.
                  </p>
                )}

                {search.trim() && !exactSearchMatch && (
                  <button
                    type="button"
                    className="w-full border rounded-xl p-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => { void handleCreateFromSearch(); }}
                  >
                    <div className="flex items-center gap-3">
                      <Plus className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Create “{search.trim()}”</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {inferredProject ? `Route to ${inferredProject.name}` : 'Add as a new planned task'}
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {backlogTasks.length > 0 && (
                  <div className="border rounded-xl divide-y divide-border/50 overflow-hidden">
                    {backlogTasks.map(task => {
                      const tp = projectMap.get(task.project_id ?? '');
                      return (
                        <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => handleAddTask(task)}>
                          <Plus className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tp?.line_color ?? 'hsl(var(--muted-foreground))' }} />
                          <span className="text-sm flex-1 truncate">{task.title}</span>
                          {tp && (
                            <Badge variant="outline" className="text-[10px] rounded-full" style={{ borderColor: tp.line_color ?? undefined, color: tp.line_color ?? undefined }}>
                              {tp.name}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {displayTasks.length > 0 && (
              <div className="flex items-center gap-3">
                <Button onClick={handleConfirm} className="rounded-xl font-display" size="sm">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {adjustMode ? 'Confirm Route' : 'Looks good'}
                </Button>
                {!adjustMode && (
                  <Button variant="outline" onClick={() => setAdjustMode(true)} className="rounded-xl text-xs" size="sm">
                    Let me adjust
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <TaskDetailDrawer
        task={drawerTask}
        open={!!drawerTask}
        onClose={() => setDrawerTask(null)}
        onUpdate={(id, updates) => updateTask.mutate({ id, ...updates } as any)}
        onDelete={(id) => deleteTask.mutate(id)}
        projects={projects}
      />
    </AppShell>
  );
}
