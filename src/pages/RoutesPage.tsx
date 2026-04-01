import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, Project } from '@/types/task';

interface RouteLineProps {
  project: Project;
  tasks: Task[];
  onNavigate: (projectId: string) => void;
}

function RouteLine({ project, tasks, onNavigate }: RouteLineProps) {
  const [expanded, setExpanded] = useState(false);
  const color = project.line_color ?? '#3FAFA4';

  const doneTasks = tasks.filter(t => t.status === 'Done');
  const activeTasks = tasks.filter(t => t.status !== 'Done');
  const total = tasks.length;
  const doneCount = doneTasks.length;
  const allDone = total > 0 && doneCount === total;

  // First non-done task = "you are here"
  const youAreHereIdx = doneCount;

  return (
    <div className={cn("group", allDone && "opacity-50")}>
      <div
        className="flex items-center gap-4 py-3 px-4 rounded-xl cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Project label */}
        <div className="flex items-center gap-2.5 min-w-0 w-[180px] sm:w-[220px] flex-shrink-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold truncate">{project.name}</span>
        </div>

        {/* Route line visualization */}
        <div className="flex-1 flex items-center gap-0 overflow-hidden">
          {tasks.map((task, idx) => {
            const isDone = task.status === 'Done';
            const isYouAreHere = idx === youAreHereIdx;
            const isUpcoming = !isDone && !isYouAreHere;

            return (
              <div key={task.id} className="flex items-center">
                {idx > 0 && (
                  <div
                    className="h-[2px] w-3 sm:w-5 flex-shrink-0"
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
                      <div className="absolute w-5 h-5 rounded-full animate-ping opacity-20" style={{ backgroundColor: color }} />
                      <div className="w-3 h-3 rounded-full border-[2.5px]" style={{ borderColor: color, backgroundColor: `${color}30` }} />
                    </div>
                  ) : isDone ? (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full border-[2px]" style={{ borderColor: `${color}50`, opacity: 0.4 }} />
                  )}
                </div>
              </div>
            );
          })}
          {total === 0 && (
            <span className="text-xs text-muted-foreground font-mono">No stops</span>
          )}
        </div>

        {/* Progress fraction */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono text-muted-foreground">{doneCount}/{total}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="ml-8 sm:ml-12 pl-4 border-l-2 mb-2 space-y-1.5" style={{ borderColor: color }}>
          {tasks.map((task, idx) => {
            const isDone = task.status === 'Done';
            const isYouAreHere = idx === youAreHereIdx;
            return (
              <div key={task.id} className="flex items-center gap-2.5 py-1">
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
                )}>
                  {task.title}
                </span>
                {isYouAreHere && (
                  <Badge className="text-[9px] h-4 px-1.5 rounded-full" style={{ backgroundColor: color, color: '#fff' }}>
                    You are here
                  </Badge>
                )}
                {task.due_date && (
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{task.due_date}</span>
                )}
              </div>
            );
          })}
          <Button
            variant="ghost" size="sm"
            className="text-xs text-muted-foreground mt-1 h-7 rounded-lg"
            onClick={(e) => { e.stopPropagation(); onNavigate(project.id); }}
          >
            View Project →
          </Button>
        </div>
      )}
    </div>
  );
}

export default function RoutesPage() {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { tasks, hasMoreTasks, loadMore, isLoadingMore } = useTasks();

  // Auto-load all tasks for accurate progress
  useEffect(() => {
    if (hasMoreTasks && !isLoadingMore) loadMore();
  }, [hasMoreTasks, isLoadingMore, loadMore]);

  const sortedProjects = useMemo(() => {
    const withTasks = projects.map(p => ({
      project: p,
      projectTasks: tasks
        .filter(t => t.project_id === p.id)
        .sort((a, b) => {
          // Done first, then by sort_order
          if (a.status === 'Done' && b.status !== 'Done') return -1;
          if (b.status === 'Done' && a.status !== 'Done') return 1;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }),
    }));

    // Active projects first, then completed, sorted by most recently active
    return withTasks.sort((a, b) => {
      const aActive = a.projectTasks.some(t => t.status !== 'Done');
      const bActive = b.projectTasks.some(t => t.status !== 'Done');
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return new Date(b.project.updated_at).getTime() - new Date(a.project.updated_at).getTime();
    });
  }, [projects, tasks]);

  const totalDone = useMemo(() => tasks.filter(t => t.status === 'Done').length, [tasks]);
  const totalActive = useMemo(() => tasks.filter(t => t.status !== 'Done').length, [tasks]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Map className="h-5 w-5 text-accent" />
              Routes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sortedProjects.length} line{sortedProjects.length !== 1 ? 's' : ''} · {totalDone} stops cleared · {totalActive} ahead
            </p>
          </div>
          <Button size="sm" className="text-xs h-8 gap-1 rounded-xl" onClick={() => navigate('/projects')}>
            <Plus className="h-3.5 w-3.5" /> New Line
          </Button>
        </div>

        {/* Route Lines */}
        {sortedProjects.length === 0 ? (
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
            <p className="text-muted-foreground">No routes yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create a project to add your first line.</p>
          </Card>
        ) : (
          <Card className="rounded-2xl divide-y divide-border/50 overflow-hidden">
            {sortedProjects.map(({ project, projectTasks }) => (
              <RouteLine
                key={project.id}
                project={project}
                tasks={projectTasks}
                onNavigate={(id) => navigate(`/projects/${id}`)}
              />
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
