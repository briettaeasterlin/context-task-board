import { useState, useMemo } from 'react';
import type { Task, Project, Milestone } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { isPast, isToday, format } from 'date-fns';

interface ProjectGroup {
  project: Project | null;
  tasks: Task[];
  totalTasks: number;
  doneTasks: number;
}

interface Props {
  nextTasks: Task[];
  allTasks: Task[];
  projects: Project[];
  milestones: Milestone[];
  onMarkDone: (id: string) => void;
  onSelect: (task: Task) => void;
  formatDueLabel: (d: string) => string;
}

export function FocusCardStack({ nextTasks, allTasks, projects, milestones, onMarkDone, onSelect, formatDueLabel }: Props) {
  // Track which task index is shown per project group
  const [activeIndexes, setActiveIndexes] = useState<Record<string, number>>({});

  const groups: ProjectGroup[] = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of nextTasks) {
      const key = t.project_id ?? '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }

    const result: ProjectGroup[] = [];
    for (const [key, tasks] of map) {
      const project = key === '__none__' ? null : projects.find(p => p.id === key) ?? null;
      const projectAllTasks = key === '__none__'
        ? allTasks.filter(t => !t.project_id)
        : allTasks.filter(t => t.project_id === key);
      result.push({
        project,
        tasks,
        totalTasks: projectAllTasks.length,
        doneTasks: projectAllTasks.filter(t => t.status === 'Done').length,
      });
    }

    // Sort groups: groups with highest-priority task first (by sort_order of first task)
    result.sort((a, b) => (a.tasks[0]?.sort_order ?? 0) - (b.tasks[0]?.sort_order ?? 0));
    return result;
  }, [nextTasks, allTasks, projects]);

  const getActiveIndex = (groupKey: string, maxLen: number) => {
    const idx = activeIndexes[groupKey] ?? 0;
    return Math.min(idx, maxLen - 1);
  };

  const navigate = (groupKey: string, delta: number, maxLen: number) => {
    setActiveIndexes(prev => {
      const cur = prev[groupKey] ?? 0;
      const next = Math.max(0, Math.min(maxLen - 1, cur + delta));
      return { ...prev, [groupKey]: next };
    });
  };

  if (groups.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">No tasks marked Next. Add one above or promote from Backlog.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const groupKey = group.project?.id ?? '__none__';
        const activeIdx = getActiveIndex(groupKey, group.tasks.length);
        const activeTask = group.tasks[activeIdx];
        const progress = group.totalTasks > 0 ? Math.round((group.doneTasks / group.totalTasks) * 100) : 0;

        return (
          <Card key={groupKey} className="relative overflow-hidden">
            {/* Project header */}
            <div className="px-4 pt-3 pb-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-mono text-xs font-semibold truncate">
                    {group.project?.name ?? 'Standalone Tasks'}
                  </h3>
                  {group.tasks.length > 1 && (
                    <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                      <Layers className="h-2.5 w-2.5 mr-0.5" />
                      {group.tasks.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono shrink-0">
                  <span>{group.doneTasks}/{group.totalTasks}</span>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
              {group.project?.summary && (
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{group.project.summary}</p>
              )}
            </div>

            {/* Active task card */}
            <div className="p-4">
              <div
                className="flex items-start gap-3 cursor-pointer group"
                onClick={() => onSelect(activeTask)}
              >
                {/* Done button */}
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0 h-7 w-7 rounded-full border-primary/30 hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={e => {
                    e.stopPropagation();
                    onMarkDone(activeTask.id);
                    // If we completed the last visible, step back
                    if (activeIdx >= group.tasks.length - 1 && activeIdx > 0) {
                      setActiveIndexes(prev => ({ ...prev, [groupKey]: activeIdx - 1 }));
                    }
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>

                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-medium group-hover:text-primary transition-colors">
                    {activeTask.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {activeTask.due_date && (
                      <Badge
                        variant={isPast(new Date(activeTask.due_date)) && !isToday(new Date(activeTask.due_date)) ? 'destructive' : 'outline'}
                        className="text-[10px] font-mono"
                      >
                        📅 {formatDueLabel(activeTask.due_date)}
                      </Badge>
                    )}
                    {activeTask.target_window && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-mono">
                        🎯 {activeTask.target_window}
                      </span>
                    )}
                    {activeTask.blocked_by && (
                      <span className="text-[10px] text-muted-foreground">⏳ {activeTask.blocked_by}</span>
                    )}
                    {activeTask.context && (
                      <span className="text-[10px] text-muted-foreground italic">{activeTask.context}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation for multiple tasks */}
              {group.tasks.length > 1 && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] font-mono"
                    disabled={activeIdx === 0}
                    onClick={() => navigate(groupKey, -1, group.tasks.length)}
                  >
                    <ChevronLeft className="h-3 w-3 mr-0.5" /> Prev
                  </Button>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {activeIdx + 1} of {group.tasks.length}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] font-mono"
                    disabled={activeIdx === group.tasks.length - 1}
                    onClick={() => navigate(groupKey, 1, group.tasks.length)}
                  >
                    Next <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Stacked card visual effect */}
            {group.tasks.length > 1 && (
              <>
                <div className="absolute bottom-0 left-2 right-2 h-1 bg-muted/60 rounded-b-lg -z-10 translate-y-1" />
                {group.tasks.length > 2 && (
                  <div className="absolute bottom-0 left-4 right-4 h-1 bg-muted/30 rounded-b-lg -z-20 translate-y-2" />
                )}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
