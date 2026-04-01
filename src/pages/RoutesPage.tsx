import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, ChevronDown, ChevronUp, Plus, Trophy, GripVertical, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, Project, RouteGroup } from '@/types/task';
import { RouteColorPicker } from '@/components/project/RouteColorPicker';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { ROUTE_GROUP_META as GROUP_META, ROUTE_GROUPS } from '@/types/task';
import { RoutesSkeleton } from '@/components/loading/TubeSkeletons';
import { toast } from 'sonner';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { format, isToday, isBefore, addDays, startOfDay } from 'date-fns';

/** Compute a context label for a project based on task data */
function getContextLabel(project: Project, projectTasks: Task[]): { text: string; className: string } | null {
  const total = projectTasks.length;
  if (total === 0) return null;

  const done = projectTasks.filter(t => t.status === 'Done').length;
  const pct = total > 0 ? done / total : 0;
  const hasWaiting = projectTasks.some(t => t.status === 'Waiting');
  const hasNext = projectTasks.some(t => t.status === 'Next' || t.status === 'Today');

  if (project.project_state === 'supporting') return { text: 'supporting', className: 'italic text-muted-foreground' };
  if (project.project_state === 'parked') return { text: 'parked', className: 'text-muted-foreground' };

  if (hasWaiting && !hasNext && done < total) return { text: 'blocked', className: 'text-destructive font-medium' };

  const lastUpdate = new Date(project.updated_at);
  const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 14 && done < total) return { text: 'stalled', className: 'text-[hsl(var(--accent))]' };

  if (done === total) return { text: 'complete ✓', className: 'text-[#00782A] font-medium' };
  if (pct > 0.75) return { text: 'closing out', className: 'text-[#00782A] font-medium' };
  if (pct > 0.25) return { text: 'in progress', className: 'text-foreground' };
  if (pct > 0) return { text: 'early progress', className: 'text-muted-foreground' };
  return { text: 'starting', className: 'text-muted-foreground' };
}

/** Compute smart priority score for a project */
function getProjectPriority(projectTasks: Task[]): number {
  const today = startOfDay(new Date());
  const weekFromNow = addDays(today, 7);

  const hasPlannedToday = projectTasks.some(t => t.planned_date && isToday(new Date(t.planned_date)) && t.status !== 'Done');
  if (hasPlannedToday) return 1;

  const hasDueSoon = projectTasks.some(t => {
    if (!t.due_date || t.status === 'Done') return false;
    const d = new Date(t.due_date);
    return d >= today && d <= weekFromNow;
  });
  if (hasDueSoon) return 2;

  const total = projectTasks.length;
  const done = projectTasks.filter(t => t.status === 'Done').length;
  const pct = total > 0 ? done / total : 0;

  if (pct >= 0.75) return 3;
  if (pct >= 0.25) return 4;
  if (done > 0) return 5;
  return 6;
}

/** Get nearest due date for a project's undone tasks */
function getNearestDueDate(projectTasks: Task[]): Date | null {
  let nearest: Date | null = null;
  for (const t of projectTasks) {
    if (t.due_date && t.status !== 'Done') {
      const d = new Date(t.due_date);
      if (!nearest || d < nearest) nearest = d;
    }
  }
  return nearest;
}

/** Smart sort comparator for projects within a group */
function smartSortCompare(
  a: { project: Project; tasks: Task[] },
  b: { project: Project; tasks: Task[] }
): number {
  const prioA = getProjectPriority(a.tasks);
  const prioB = getProjectPriority(b.tasks);
  if (prioA !== prioB) return prioA - prioB;

  // Within same priority: nearest due date first
  const dueA = getNearestDueDate(a.tasks);
  const dueB = getNearestDueDate(b.tasks);
  if (dueA && dueB) {
    const diff = dueA.getTime() - dueB.getTime();
    if (diff !== 0) return diff;
  }
  if (dueA && !dueB) return -1;
  if (!dueA && dueB) return 1;

  // Then sort_order
  const orderA = a.project.sort_order ?? 999;
  const orderB = b.project.sort_order ?? 999;
  if (orderA !== orderB) return orderA - orderB;

  // Then alphabetical
  return a.project.name.localeCompare(b.project.name);
}

interface SortableRouteLineProps {
  project: Project;
  tasks: Task[];
  onNavigate: (projectId: string) => void;
  onColorChange: (projectId: string, color: string) => void;
  onTaskClick: (task: Task) => void;
  isSupporting?: boolean;
  compact?: boolean;
}

function SortableRouteLine({ project, tasks, onNavigate, onColorChange, onTaskClick, isSupporting, compact }: SortableRouteLineProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const [expanded, setExpanded] = useState(false);
  const color = project.line_color ?? '#3FAFA4';
  const doneTasks = tasks.filter(t => t.status === 'Done');
  const total = tasks.length;
  const doneCount = doneTasks.length;
  const youAreHereIdx = doneCount;
  const contextLabel = getContextLabel(project, tasks);

  return (
    <div ref={setNodeRef} style={style} className={cn("group", isSupporting && "opacity-80")}>
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 rounded-xl cursor-pointer hover:bg-muted/30 transition-colors",
          compact ? "py-2 px-3" : "py-2.5 px-3 sm:px-4"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Drag handle */}
        {!compact && (
          <button
            className="touch-none p-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        <div className={cn("flex items-center gap-2 min-w-0 flex-shrink-0", compact ? "w-[80px] sm:w-[180px]" : "w-[90px] sm:w-[200px]")}>
          {compact ? (
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          ) : (
            <RouteColorPicker currentColor={color} onColorChange={(c) => onColorChange(project.id, c)} />
          )}
          <span className={cn("text-sm truncate", compact ? "font-semibold" : isSupporting ? "font-normal" : "font-semibold")}>{project.name}</span>
        </div>

        <div className="flex-1 flex items-center gap-0 overflow-hidden">
          {tasks.slice(0, compact ? 12 : 20).map((task, idx) => {
            const isDone = task.status === 'Done';
            const isYouAreHere = idx === youAreHereIdx;
            const isUpcoming = !isDone && !isYouAreHere;
            return (
              <div key={task.id} className="flex items-center">
                {idx > 0 && (
                  <div
                    className={cn("h-[2px] flex-shrink-0", compact ? "w-1.5 sm:w-3" : "w-2 sm:w-4")}
                    style={{
                      backgroundColor: isDone || idx <= youAreHereIdx ? color : undefined,
                      borderTop: isUpcoming ? `2px dashed ${color}40` : undefined,
                      opacity: isUpcoming ? 0.4 : 1,
                    }}
                  />
                )}
                <div className="relative flex-shrink-0">
                  {isYouAreHere ? (
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-4 h-4 rounded-full animate-ping opacity-20" style={{ backgroundColor: color }} />
                      <div className={cn("rounded-full border-[2px]", compact ? "w-2 h-2" : "w-2.5 h-2.5")} style={{ borderColor: color, backgroundColor: `${color}30` }} />
                    </div>
                  ) : isDone ? (
                    <div className={cn("rounded-full", compact ? "w-1.5 h-1.5" : "w-2 h-2")} style={{ backgroundColor: color }} />
                  ) : (
                    <div className={cn("rounded-full border-[1.5px]", compact ? "w-1.5 h-1.5" : "w-2 h-2")} style={{ borderColor: `${color}50`, opacity: 0.4 }} />
                  )}
                </div>
              </div>
            );
          })}
          {total === 0 && <span className="text-xs text-muted-foreground font-mono">No stops</span>}
          {total > (compact ? 12 : 20) && <span className="text-[10px] text-muted-foreground ml-1">+{total - (compact ? 12 : 20)}</span>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {contextLabel && (
            <span className={cn("text-[10px] hidden sm:inline", contextLabel.className)}>{contextLabel.text}</span>
          )}
          <span className="text-xs font-mono text-muted-foreground">{doneCount}/{total}</span>
          {!compact && (expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
        </div>
      </div>

      {expanded && !compact && (
        <div className="ml-8 sm:ml-12 pl-3 border-l-2 mb-2 space-y-1" style={{ borderColor: color }}>
          {tasks.map((task, idx) => {
            const isDone = task.status === 'Done';
            const isYouAreHere = idx === youAreHereIdx;
            return (
              <div key={task.id} className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-muted/20 rounded-md px-1 -mx-1 transition-colors" onClick={() => onTaskClick(task)}>
                {isDone ? (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                ) : isYouAreHere ? (
                  <span className="w-2 h-2 rounded-full border-2 flex-shrink-0" style={{ borderColor: color, backgroundColor: `${color}30` }} />
                ) : (
                  <span className="w-2 h-2 rounded-full border-[1.5px] flex-shrink-0 opacity-40" style={{ borderColor: color }} />
                )}
                <span className={cn(
                  "text-sm",
                  isDone && "line-through text-muted-foreground",
                  isYouAreHere && "font-semibold text-foreground",
                  !isDone && !isYouAreHere && "text-muted-foreground"
                )}>{task.title}</span>
                {isYouAreHere && (
                  <Badge className="text-[9px] h-4 px-1.5 rounded-full" style={{ backgroundColor: color, color: '#fff' }}>You are here</Badge>
                )}
                {task.due_date && <span className="text-[10px] text-muted-foreground font-mono ml-auto">{task.due_date}</span>}
              </div>
            );
          })}
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground mt-1 h-7 rounded-lg" onClick={(e) => { e.stopPropagation(); onNavigate(project.id); }}>
            View Project →
          </Button>
        </div>
      )}
    </div>
  );
}

/** Inline form for adding a new route to a group */
function AddRouteInline({ groupKey, onAdd }: { groupKey: RouteGroup; onAdd: (name: string, group: RouteGroup) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), groupKey);
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        className="flex items-center gap-2 py-2 px-3 sm:px-4 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-xl transition-colors w-full"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3" /> Add route
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 px-3 sm:px-4">
      <Input
        autoFocus
        placeholder="New project name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setOpen(false); setName(''); }
        }}
        className="h-8 text-sm rounded-lg flex-1"
      />
      <Button size="sm" className="h-8 rounded-lg text-xs" onClick={handleSubmit} disabled={!name.trim()}>
        Add
      </Button>
      <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => { setOpen(false); setName(''); }}>
        Cancel
      </Button>
    </div>
  );
}

const GROUP_ORDER: RouteGroup[] = ['consulting', 'products', 'health', 'life'];

export default function RoutesPage() {
  const navigate = useNavigate();
  const { projects, updateProject, createProject, reorderProjects, isLoading: projectsLoading } = useProjects();
  const { tasks, hasMoreTasks, loadMore, isLoadingMore, isLoading, updateTask, deleteTask } = useTasks();
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(['victories', 'parked']));
  const [showAll, setShowAll] = useState(false);

  const handleColorChange = useCallback((projectId: string, color: string) => {
    updateProject.mutate({ id: projectId, line_color: color } as any);
  }, [updateProject]);

  const handleAddRoute = useCallback((name: string, group: RouteGroup) => {
    createProject.mutate({
      name,
      area: group === 'life' ? 'Home' : group === 'consulting' ? 'Client' : 'Personal',
      summary: null,
      scope_notes: null,
    } as any, {
      onSuccess: (created) => {
        updateProject.mutate({ id: (created as any).id, route_group: group, project_state: 'active' } as any);
        toast.success(`Added route: ${name}`);
      },
    });
  }, [createProject, updateProject]);

  useEffect(() => {
    if (hasMoreTasks && !isLoadingMore) loadMore();
  }, [hasMoreTasks, isLoadingMore, loadMore]);

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }, []);

  // Build project-tasks map
  const projectTasksMap = useMemo(() => {
    const map: Map<string, Task[]> = new Map();
    for (const p of projects) map.set(p.id, []);
    for (const t of tasks) {
      if (t.project_id && map.has(t.project_id)) {
        map.get(t.project_id)!.push(t);
      }
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (a.status === 'Done' && b.status !== 'Done') return -1;
        if (b.status === 'Done' && a.status !== 'Done') return 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    }
    return map;
  }, [projects, tasks]);

  // Group projects with smart sorting
  const grouped = useMemo(() => {
    const groups: Record<string, { active: { project: Project; tasks: Task[] }[]; supporting: { project: Project; tasks: Task[] }[] }> = {};
    const victories: { project: Project; tasks: Task[] }[] = [];
    const parked: { project: Project; tasks: Task[] }[] = [];

    for (const group of GROUP_ORDER) groups[group] = { active: [], supporting: [] };

    for (const p of projects) {
      const pTasks = projectTasksMap.get(p.id) ?? [];
      const entry = { project: p, tasks: pTasks };

      if (p.project_state === 'completed') {
        victories.push(entry);
      } else if (p.project_state === 'parked') {
        parked.push(entry);
      } else {
        const group = p.route_group ?? 'life';
        if (!groups[group]) groups[group] = { active: [], supporting: [] };
        if (p.project_state === 'supporting') {
          groups[group].supporting.push(entry);
        } else {
          groups[group].active.push(entry);
        }
      }
    }

    // Smart sort within groups
    for (const g of Object.values(groups)) {
      g.active.sort(smartSortCompare);
      g.supporting.sort(smartSortCompare);
    }

    return { groups, victories, parked };
  }, [projects, projectTasksMap]);

  // "Right Now" section: top 3 active projects by priority
  const rightNowProjects = useMemo(() => {
    const today = startOfDay(new Date());
    const weekFromNow = addDays(today, 7);

    const candidates = projects
      .filter(p => p.project_state === 'active')
      .map(p => {
        const pTasks = projectTasksMap.get(p.id) ?? [];
        const total = pTasks.length;
        const done = pTasks.filter(t => t.status === 'Done').length;
        if (total === 0) return null;

        const plannedTodayCount = pTasks.filter(t => t.planned_date && isToday(new Date(t.planned_date)) && t.status !== 'Done').length;
        const nearestDue = getNearestDueDate(pTasks);
        const hasDueSoon = nearestDue && nearestDue >= today && nearestDue <= weekFromNow;
        const pct = done / total;

        let score = 0;
        if (plannedTodayCount > 0) score = 1000 + plannedTodayCount;
        else if (hasDueSoon) score = 500 + (7 - Math.floor((nearestDue!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        else if (pct > 0) score = Math.round(pct * 100);

        if (score === 0) return null;

        return { project: p, tasks: pTasks, score };
      })
      .filter(Boolean) as { project: Project; tasks: Task[]; score: number }[];

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 3);
  }, [projects, projectTasksMap]);

  // Smart filtering: always applied unless showAll is true
  const { filteredGroups, overdueHiddenCount } = useMemo(() => {
    if (showAll) return { filteredGroups: grouped.groups, overdueHiddenCount: 0 };

    const today = startOfDay(new Date());
    const weekFromNow = addDays(today, 7);
    const filtered: typeof grouped.groups = {};
    let overdueCount = 0;

    for (const [key, group] of Object.entries(grouped.groups)) {
      const filteredSupporting = group.supporting.filter(entry => {
        const hasUpcoming = entry.tasks.some(t => {
          if (t.status === 'Done') return false;
          if (t.status === 'Today' || t.status === 'Next') return true;
          if (t.due_date) {
            const d = new Date(t.due_date);
            return d <= weekFromNow;
          }
          return false;
        });
        if (!hasUpcoming) {
          const hasOverdue = entry.tasks.some(t =>
            t.due_date && t.status !== 'Done' && isBefore(new Date(t.due_date), today)
          );
          if (hasOverdue) overdueCount++;
        }
        return hasUpcoming;
      });
      filtered[key] = { active: group.active, supporting: filteredSupporting };
    }

    return { filteredGroups: filtered, overdueHiddenCount: overdueCount };
  }, [showAll, grouped.groups]);

  const handleDragEnd = useCallback((groupKey: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const group = filteredGroups[groupKey];
    if (!group) return;

    const allInGroup = [...group.active, ...group.supporting];
    const oldIndex = allInGroup.findIndex(e => e.project.id === active.id);
    const newIndex = allInGroup.findIndex(e => e.project.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(allInGroup, oldIndex, newIndex);
    const updates = reordered.map((e, i) => ({ id: e.project.id, sort_order: i }));
    reorderProjects.mutate(updates);
  }, [filteredGroups, reorderProjects]);

  // Stats
  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.project_state !== 'parked' && p.project_state !== 'completed');
    const activeGroups = new Set(activeProjects.map(p => p.route_group).filter(Boolean));
    const totalDone = tasks.filter(t => t.status === 'Done').length;
    return { activeGroups: activeGroups.size, activeLines: activeProjects.length, totalDone };
  }, [projects, tasks]);

  if (isLoading || projectsLoading) return <AppShell><RoutesSkeleton /></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto px-1 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent" />
              Routes
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              {stats.activeGroups} group{stats.activeGroups !== 1 ? 's' : ''} · {stats.activeLines} line{stats.activeLines !== 1 ? 's' : ''} · {stats.totalDone} cleared
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={focusMode ? 'default' : 'outline'}
              className={cn(
                "text-xs h-8 gap-1.5 rounded-full min-h-[44px] sm:min-h-0 transition-colors",
                focusMode && "bg-primary text-primary-foreground"
              )}
              onClick={toggleFocusMode}
            >
              <Focus className="h-3.5 w-3.5" />
              Focus {focusMode ? 'ON' : 'OFF'}
            </Button>
            <Button size="sm" className="text-xs h-8 gap-1 rounded-xl min-h-[44px] sm:min-h-0" onClick={() => navigate('/projects')}>
              <Plus className="h-3.5 w-3.5" /> New Line
            </Button>
          </div>
        </div>

        {/* Overdue safeguard alert */}
        {focusMode && overdueHiddenCount > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/20">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
              <span className="text-muted-foreground">
                {overdueHiddenCount} hidden project{overdueHiddenCount !== 1 ? 's have' : ' has'} overdue tasks
              </span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 rounded-lg" onClick={toggleFocusMode}>
              Show all →
            </Button>
          </div>
        )}

        {projects.length === 0 ? (
          <Card className="p-8 text-center rounded-2xl">
            <div className="flex flex-col items-center gap-1 mb-4">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/30" />
              <div className="w-px h-6 bg-muted-foreground/15" />
              <span className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/30" />
              <div className="w-px h-6 bg-muted-foreground/15" />
              <span className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground font-medium">No lines yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first project to start mapping progress.</p>
            <Button onClick={() => navigate('/projects')} className="rounded-xl font-display mt-4" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Line
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 🎯 Right Now Section */}
            {rightNowProjects.length > 0 && (
              <Card className="rounded-2xl overflow-hidden border-primary/20 shadow-md bg-card">
                <div className="px-4 py-3 border-b border-border/40">
                  <h2 className="text-base font-display font-bold flex items-center gap-2">
                    🎯 Right Now
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Where your energy should go</p>
                </div>
                <div className="divide-y divide-border/30">
                  {rightNowProjects.map(({ project, tasks: pTasks }) => (
                    <div
                      key={project.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <SortableRouteLine
                        project={project}
                        tasks={pTasks}
                        onNavigate={(id) => navigate(`/projects/${id}`)}
                        onColorChange={handleColorChange}
                        onTaskClick={setDetailTask}
                        compact
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Active groups */}
            {GROUP_ORDER.map(groupKey => {
              const group = filteredGroups[groupKey];
              if (!group || (group.active.length === 0 && group.supporting.length === 0)) return null;
              const meta = GROUP_META[groupKey];
              const isCollapsed = collapsedGroups.has(groupKey);
              const groupTasks = [...group.active, ...group.supporting].flatMap(e => e.tasks);
              const groupDone = groupTasks.filter(t => t.status === 'Done').length;
              const groupTotal = groupTasks.length;
              const allProjectIds = [...group.active, ...group.supporting].map(e => e.project.id);

              return (
                <Card key={groupKey} className="rounded-2xl overflow-hidden">
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <div>
                      <h2 className="text-base font-display font-bold flex items-center gap-2">
                        <span>{meta.emoji}</span> {meta.label}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meta.description} · {group.active.length + group.supporting.length} line{group.active.length + group.supporting.length !== 1 ? 's' : ''} · {groupDone}/{groupTotal} stops
                      </p>
                    </div>
                    {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {!isCollapsed && (
                    <div>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleDragEnd(groupKey)}
                      >
                        <SortableContext items={allProjectIds} strategy={verticalListSortingStrategy}>
                          <div className="divide-y divide-border/40">
                            {group.active.map(({ project, tasks: pTasks }) => (
                              <SortableRouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} />
                            ))}
                            {group.supporting.map(({ project, tasks: pTasks }) => (
                              <SortableRouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} isSupporting />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                      <AddRouteInline groupKey={groupKey} onAdd={handleAddRoute} />
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Victories */}
            {grouped.victories.length > 0 && (
              <Card className="rounded-2xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => toggleGroup('victories')}
                >
                  <div>
                    <h2 className="text-base font-display font-bold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#FFD300]" /> Victories
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {focusMode
                        ? `${grouped.victories.length} route${grouped.victories.length !== 1 ? 's' : ''}`
                        : `Completed routes — proof of progress · ${grouped.victories.length} line${grouped.victories.length !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                  {collapsedGroups.has('victories') ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                </div>
                {!collapsedGroups.has('victories') && (
                  <div className="divide-y divide-border/40 opacity-60">
                    {grouped.victories.map(({ project, tasks: pTasks }) => (
                      <SortableRouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Parked */}
            {grouped.parked.length > 0 && (
              <Card className="rounded-2xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => toggleGroup('parked')}
                >
                  <div>
                    <h2 className="text-base font-display font-bold flex items-center gap-2">
                      📦 Parked
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {grouped.parked.length} route{grouped.parked.length !== 1 ? 's' : ''} shelved
                    </p>
                  </div>
                  {collapsedGroups.has('parked') ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                </div>
                {!collapsedGroups.has('parked') && (
                  <div className="divide-y divide-border/40 opacity-50">
                    {grouped.parked.map(({ project, tasks: pTasks }) => (
                      <SortableRouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} />
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>

      <TaskDetailDrawer
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onUpdate={(id, updates) => updateTask.mutate({ id, ...updates } as any)}
        onDelete={(id) => deleteTask.mutate(id)}
        projects={projects}
      />
    </AppShell>
  );
}
