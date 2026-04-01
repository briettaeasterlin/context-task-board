import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronDown, ChevronUp, Plus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, Project, RouteGroup, ROUTE_GROUP_META } from '@/types/task';
import { RouteColorPicker } from '@/components/project/RouteColorPicker';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { ROUTE_GROUP_META as GROUP_META } from '@/types/task';
import { RoutesSkeleton } from '@/components/loading/TubeSkeletons';

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

  // Check for blocked: has Waiting but no Next tasks
  if (hasWaiting && !hasNext && done < total) return { text: 'blocked', className: 'text-destructive font-medium' };

  // Check staleness
  const lastUpdate = new Date(project.updated_at);
  const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 14 && done < total) return { text: 'stalled', className: 'text-[#EE7C0E]' };

  if (done === total) return { text: 'complete ✓', className: 'text-[#00782A] font-medium' };
  if (pct > 0.75) return { text: 'closing out', className: 'text-[#00782A] font-medium' };
  if (pct > 0.25) return { text: 'in progress', className: 'text-foreground' };
  if (pct > 0) return { text: 'early progress', className: 'text-muted-foreground' };
  return { text: 'starting', className: 'text-muted-foreground' };
}

interface RouteLineProps {
  project: Project;
  tasks: Task[];
  onNavigate: (projectId: string) => void;
  onColorChange: (projectId: string, color: string) => void;
  onTaskClick: (task: Task) => void;
  isSupporting?: boolean;
}

function RouteLine({ project, tasks, onNavigate, onColorChange, onTaskClick, isSupporting }: RouteLineProps) {
  const [expanded, setExpanded] = useState(false);
  const color = project.line_color ?? '#3FAFA4';
  const doneTasks = tasks.filter(t => t.status === 'Done');
  const total = tasks.length;
  const doneCount = doneTasks.length;
  const youAreHereIdx = doneCount;
  const contextLabel = getContextLabel(project, tasks);

  return (
    <div className={cn("group", isSupporting && "opacity-80")}>
      <div
        className="flex items-center gap-3 py-2.5 px-3 sm:px-4 rounded-xl cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0 w-[100px] sm:w-[200px] flex-shrink-0">
          <RouteColorPicker currentColor={color} onColorChange={(c) => onColorChange(project.id, c)} />
          <span className={cn("text-sm font-semibold truncate", isSupporting && "text-sm font-normal")}>{project.name}</span>
        </div>

        <div className="flex-1 flex items-center gap-0 overflow-hidden">
          {tasks.slice(0, 20).map((task, idx) => {
            const isDone = task.status === 'Done';
            const isYouAreHere = idx === youAreHereIdx;
            const isUpcoming = !isDone && !isYouAreHere;
            return (
              <div key={task.id} className="flex items-center">
                {idx > 0 && (
                  <div
                    className="h-[2px] w-2 sm:w-4 flex-shrink-0"
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
                      <div className="w-2.5 h-2.5 rounded-full border-[2px]" style={{ borderColor: color, backgroundColor: `${color}30` }} />
                    </div>
                  ) : isDone ? (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  ) : (
                    <div className="w-2 h-2 rounded-full border-[1.5px]" style={{ borderColor: `${color}50`, opacity: 0.4 }} />
                  )}
                </div>
              </div>
            );
          })}
          {total === 0 && <span className="text-xs text-muted-foreground font-mono">No stops</span>}
          {total > 20 && <span className="text-[10px] text-muted-foreground ml-1">+{total - 20}</span>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {contextLabel && (
            <span className={cn("text-[10px] hidden sm:inline", contextLabel.className)}>{contextLabel.text}</span>
          )}
          <span className="text-xs font-mono text-muted-foreground">{doneCount}/{total}</span>
          {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="ml-6 sm:ml-10 pl-3 border-l-2 mb-2 space-y-1" style={{ borderColor: color }}>
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

const GROUP_ORDER: RouteGroup[] = ['consulting', 'products', 'career', 'life'];

export default function RoutesPage() {
  const navigate = useNavigate();
  const { projects, updateProject } = useProjects();
  const { tasks, hasMoreTasks, loadMore, isLoadingMore, isLoading, updateTask, deleteTask } = useTasks();
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(['victories', 'parked']));

  const handleColorChange = useCallback((projectId: string, color: string) => {
    updateProject.mutate({ id: projectId, line_color: color } as any);
  }, [updateProject]);

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
    // Sort tasks within each project
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (a.status === 'Done' && b.status !== 'Done') return -1;
        if (b.status === 'Done' && a.status !== 'Done') return 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    }
    return map;
  }, [projects, tasks]);

  // Group projects
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

    // Sort within groups by most recently updated
    const sortFn = (a: { project: Project }, b: { project: Project }) =>
      new Date(b.project.updated_at).getTime() - new Date(a.project.updated_at).getTime();
    for (const g of Object.values(groups)) {
      g.active.sort(sortFn);
      g.supporting.sort(sortFn);
    }
    victories.sort(sortFn);

    return { groups, victories, parked };
  }, [projects, projectTasksMap]);

  // Stats
  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.project_state !== 'parked' && p.project_state !== 'completed');
    const activeGroups = new Set(activeProjects.map(p => p.route_group).filter(Boolean));
    const totalDone = tasks.filter(t => t.status === 'Done').length;
    const totalActive = tasks.filter(t => t.status !== 'Done').length;
    return { activeGroups: activeGroups.size, activeLines: activeProjects.length, totalDone, totalActive };
  }, [projects, tasks]);

  if (isLoading) return <AppShell><RoutesSkeleton /></AppShell>;

  return (
    <AppShell>
      <div className="space-y-5 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Map className="h-5 w-5 text-accent" />
              Routes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.activeGroups} active group{stats.activeGroups !== 1 ? 's' : ''} · {stats.activeLines} active line{stats.activeLines !== 1 ? 's' : ''} · {stats.totalDone} stops cleared
            </p>
          </div>
          <Button size="sm" className="text-xs h-8 gap-1 rounded-xl" onClick={() => navigate('/projects')}>
            <Plus className="h-3.5 w-3.5" /> New Line
          </Button>
        </div>

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
            {/* Active groups */}
            {GROUP_ORDER.map(groupKey => {
              const group = grouped.groups[groupKey];
              if (!group || (group.active.length === 0 && group.supporting.length === 0)) return null;
              const meta = GROUP_META[groupKey];
              const isCollapsed = collapsedGroups.has(groupKey);
              const groupTasks = [...group.active, ...group.supporting].flatMap(e => e.tasks);
              const groupDone = groupTasks.filter(t => t.status === 'Done').length;
              const groupTotal = groupTasks.length;

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
                    <div className="divide-y divide-border/40">
                      {group.active.map(({ project, tasks: pTasks }) => (
                        <RouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} />
                      ))}
                      {group.supporting.map(({ project, tasks: pTasks }) => (
                        <RouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} isSupporting />
                      ))}
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
                      Completed routes — proof of progress · {grouped.victories.length} line{grouped.victories.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {collapsedGroups.has('victories') ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                </div>
                {!collapsedGroups.has('victories') && (
                  <div className="divide-y divide-border/40 opacity-60">
                    {grouped.victories.map(({ project, tasks: pTasks }) => (
                      <RouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} />
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
                      <RouteLine key={project.id} project={project} tasks={pTasks} onNavigate={(id) => navigate(`/projects/${id}`)} onColorChange={handleColorChange} onTaskClick={setDetailTask} />
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
