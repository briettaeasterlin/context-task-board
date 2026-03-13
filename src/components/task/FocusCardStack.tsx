import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Project, Milestone } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronLeft, ChevronRight, Layers, ExternalLink } from 'lucide-react';
import { isPast, isToday, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProjectGroup {
  project: Project | null;
  areaLabel: string | null;
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

const AREA_EMOJI: Record<string, string> = {
  Personal: '🧘',
  Business: '💼',
  Home: '🏠',
  Family: '👨‍👩‍👧',
  Client: '🤝',
};

function guessEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('launch') || n.includes('release') || n.includes('ship')) return '🚀';
  if (n.includes('growth') || n.includes('learning') || n.includes('framework')) return '📈';
  if (n.includes('legal') || n.includes('admin') || n.includes('ops')) return '📝';
  if (n.includes('home') || n.includes('house') || n.includes('life')) return '🏠';
  if (n.includes('client') || n.includes('customer') || n.includes('onboarding')) return '💼';
  if (n.includes('report') || n.includes('dashboard') || n.includes('data')) return '📊';
  if (n.includes('ai') || n.includes('product') || n.includes('feature')) return '🧠';
  if (n.includes('operation') || n.includes('business') || n.includes('finance')) return '⚙️';
  if (n.includes('market') || n.includes('analysis') || n.includes('research')) return '🔍';
  return '📌';
}

export function FocusCardStack({ nextTasks, allTasks, projects, milestones, onMarkDone, onSelect, formatDueLabel }: Props) {
  const [activeIndexes, setActiveIndexes] = useState<Record<string, number>>({});

  const groups: ProjectGroup[] = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of nextTasks) {
      // Group by project_id, or by area for standalone tasks
      const key = t.project_id ?? `__area__${t.area}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }

    const result: ProjectGroup[] = [];
    for (const [key, tasks] of map) {
      if (key.startsWith('__area__')) {
        const area = key.replace('__area__', '');
        const areaAllTasks = allTasks.filter(t => !t.project_id && t.area === area);
        result.push({ project: null, areaLabel: area, tasks, totalTasks: areaAllTasks.length, doneTasks: areaAllTasks.filter(t => t.status === 'Done').length });
      } else {
        const project = projects.find(p => p.id === key) ?? null;
        const projectAllTasks = allTasks.filter(t => t.project_id === key);
        result.push({ project, areaLabel: null, tasks, totalTasks: projectAllTasks.length, doneTasks: projectAllTasks.filter(t => t.status === 'Done').length });
      }
    }
    result.sort((a, b) => (a.tasks[0]?.sort_order ?? 0) - (b.tasks[0]?.sort_order ?? 0));
    return result;
  }, [nextTasks, allTasks, projects]);

  const getActiveIndex = (groupKey: string, maxLen: number) => Math.min(activeIndexes[groupKey] ?? 0, maxLen - 1);

  const navigate = (groupKey: string, delta: number, maxLen: number) => {
    const dir = delta > 0 ? 'left' : 'right';
    setSlideDir(prev => ({ ...prev, [groupKey]: dir }));
    setActiveIndexes(prev => {
      const cur = prev[groupKey] ?? 0;
      const next = Math.max(0, Math.min(maxLen - 1, cur + delta));
      return { ...prev, [groupKey]: next };
    });
    setTimeout(() => setSlideDir(prev => ({ ...prev, [groupKey]: null })), 300);
  };

  const touchStartRef = useRef<number | null>(null);
  const [slideDir, setSlideDir] = useState<Record<string, 'left' | 'right' | null>>({});

  const makeSwipeHandlers = (groupKey: string, maxLen: number) => ({
    onTouchStart: (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchStartRef.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartRef.current;
      touchStartRef.current = null;
      if (Math.abs(diff) > 50) navigate(groupKey, diff < 0 ? 1 : -1, maxLen);
    },
  });

  if (groups.length === 0) {
    return (
      <Card className="p-8 text-center rounded-xl shadow-card">
        <p className="text-sm text-muted-foreground">No tasks marked Next. Add one above or promote from Backlog. 🌿</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const groupKey = group.project?.id ?? `__area__${group.areaLabel}`;
        const activeIdx = getActiveIndex(groupKey, group.tasks.length);
        const activeTask = group.tasks[activeIdx];
        const progress = group.totalTasks > 0 ? Math.round((group.doneTasks / group.totalTasks) * 100) : 0;
        const swipe = makeSwipeHandlers(groupKey, group.tasks.length);
        const emoji = group.project ? guessEmoji(group.project.name) : (group.areaLabel ? AREA_EMOJI[group.areaLabel] ?? '📌' : '📌');
        const groupName = group.project?.name ?? (group.areaLabel ? `${group.areaLabel} Tasks` : 'Tasks');

        return (
          <Card key={groupKey} className="relative overflow-hidden rounded-xl shadow-card hover:shadow-elevated transition-all duration-200">
            {/* Project header */}
            <div className="px-5 pt-4 pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base">{emoji}</span>
                  <h3 className="font-sans text-sm font-semibold truncate">
                    {groupName}
                  </h3>
                  {group.tasks.length > 1 && (
                    <Badge variant="secondary" className="text-[10px] font-mono shrink-0 rounded-full">
                      <Layers className="h-2.5 w-2.5 mr-0.5" />
                      {group.tasks.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                  <span className="font-medium">{group.doneTasks}/{group.totalTasks}</span>
                  <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-500 animate-progress-fill"
                      style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
              {group.project?.summary && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 leading-relaxed">{group.project.summary}</p>
              )}
            </div>

            {/* Active task card */}
            <div className="p-5 overflow-hidden" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
              <div
                key={activeTask.id}
                className={cn(
                  "flex items-start gap-3 cursor-pointer group transition-all duration-300 ease-out",
                  slideDir[groupKey] ? "animate-fade-in" : ""
                )}
                style={slideDir[groupKey] ? { animationDuration: '0.25s' } : undefined}
                onClick={() => onSelect(activeTask)}
              >
                <Button
                  size="icon" variant="outline"
                  className="shrink-0 h-8 w-8 rounded-full border-primary/30 hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                  onClick={e => {
                    e.stopPropagation();
                    onMarkDone(activeTask.id);
                    if (activeIdx >= group.tasks.length - 1 && activeIdx > 0)
                      setActiveIndexes(prev => ({ ...prev, [groupKey]: activeIdx - 1 }));
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-relaxed group-hover:text-primary transition-colors">
                    {activeTask.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {activeTask.due_date && (
                      <Badge
                        variant={isPast(new Date(activeTask.due_date)) && !isToday(new Date(activeTask.due_date)) ? 'destructive' : 'outline'}
                        className="text-[10px] font-mono rounded-full"
                      >
                        📅 {formatDueLabel(activeTask.due_date)}
                      </Badge>
                    )}
                    {activeTask.target_window && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-mono">
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

              {group.tasks.length > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                  <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs rounded-lg"
                    disabled={activeIdx === 0} onClick={() => navigate(groupKey, -1, group.tasks.length)}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Prev
                  </Button>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {activeIdx + 1} of {group.tasks.length}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs rounded-lg"
                    disabled={activeIdx === group.tasks.length - 1} onClick={() => navigate(groupKey, 1, group.tasks.length)}>
                    Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Stacked card visual */}
            {group.tasks.length > 1 && (
              <>
                <div className="absolute bottom-0 left-3 right-3 h-1.5 bg-muted/50 rounded-b-xl -z-10 translate-y-1" />
                {group.tasks.length > 2 && (
                  <div className="absolute bottom-0 left-5 right-5 h-1.5 bg-muted/25 rounded-b-xl -z-20 translate-y-2" />
                )}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}