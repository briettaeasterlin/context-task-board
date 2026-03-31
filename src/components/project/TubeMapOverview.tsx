import { useMemo } from 'react';
import type { Project, Task } from '@/types/task';
import { getTubeLineByHex, TUBE_LINES } from '@/lib/tube-colors';
import { cn } from '@/lib/utils';

interface Props {
  projects: Project[];
  tasks: Task[];
  onProjectClick: (projectId: string) => void;
}

export function TubeMapOverview({ projects, tasks, onProjectClick }: Props) {
  const projectRoutes = useMemo(() => {
    return projects.map((p, idx) => {
      const projectTasks = tasks.filter(t => t.project_id === p.id);
      const total = projectTasks.length;
      const done = projectTasks.filter(t => t.status === 'Done').length;
      const next = projectTasks.filter(t => t.status === 'Next' || t.status === 'Today');
      const color = (p as any).line_color || TUBE_LINES[idx % TUBE_LINES.length].hex;
      const lineName = getTubeLineByHex(color).name;
      const progress = total > 0 ? done / total : 0;
      const firstActiveIdx = total > 0 ? Math.min(done, total - 1) : 0;

      return {
        project: p,
        total,
        done,
        nextCount: next.length,
        color,
        lineName,
        progress,
        firstActiveIdx,
      };
    }).filter(r => r.total > 0);
  }, [projects, tasks]);

  if (projectRoutes.length === 0) return null;

  return (
    <div className="space-y-3">
      {projectRoutes.map(route => {
        const maxDots = Math.min(route.total, 14);
        const filledDots = Math.round(route.progress * maxDots);
        const youAreHereIdx = filledDots < maxDots ? filledDots : -1;

        return (
          <div
            key={route.project.id}
            className="flex items-center gap-4 group cursor-pointer py-2 px-3 rounded-xl hover:bg-muted/40 transition-all"
            onClick={() => onProjectClick(route.project.id)}
          >
            {/* Project name with line dot */}
            <div className="flex items-center gap-2 w-[180px] shrink-0 min-w-0">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: route.color }}
              />
              <span className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                {route.project.name}
              </span>
            </div>

            {/* Route line with dots */}
            <div className="flex-1 flex items-center gap-0 h-5 relative min-w-[120px]">
              {/* Track background */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-muted" />
              {/* Filled track */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full transition-all duration-500"
                style={{
                  width: `${route.progress * 100}%`,
                  backgroundColor: route.color,
                }}
              />
              {/* Remaining dashed track */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                style={{
                  left: `${route.progress * 100}%`,
                  right: 0,
                  backgroundImage: `repeating-linear-gradient(90deg, ${route.color}30, ${route.color}30 4px, transparent 4px, transparent 8px)`,
                }}
              />
              {/* Station dots */}
              {Array.from({ length: maxDots }).map((_, i) => {
                const isYouAreHere = i === youAreHereIdx;
                const isFilled = i < filledDots;

                return (
                  <div key={i} className="flex-1 flex justify-center relative z-10">
                    {isYouAreHere ? (
                      <div className="relative flex items-center justify-center">
                        <div
                          className="absolute w-4 h-4 rounded-full animate-pulse opacity-30"
                          style={{ backgroundColor: route.color }}
                        />
                        <div
                          className="w-3 h-3 rounded-full border-2"
                          style={{
                            borderColor: route.color,
                            backgroundColor: `${route.color}33`,
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full border-2 transition-all",
                          isFilled ? "border-transparent" : "bg-card"
                        )}
                        style={
                          isFilled
                            ? { backgroundColor: route.color }
                            : { borderColor: `${route.color}40` }
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress label */}
            <span className="text-[11px] text-muted-foreground font-mono w-14 text-right shrink-0">
              {route.done}/{route.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
