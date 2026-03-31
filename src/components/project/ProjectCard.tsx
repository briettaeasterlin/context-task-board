import type { Project, Task, Milestone, TaskArea } from '@/types/task';
import { AreaBadge } from '@/components/task/AreaBadge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Tube-line color per area — matches CSS variable names */
const AREA_LINE_COLORS: Record<TaskArea, string> = {
  Client: 'bg-line-piccadilly',
  Business: 'bg-line-metropolitan',
  Home: 'bg-line-district',
  Family: 'bg-line-bakerloo',
  Personal: 'bg-line-elizabeth',
};

const AREA_LINE_ACCENT: Record<TaskArea, string> = {
  Client: 'text-line-piccadilly',
  Business: 'text-line-metropolitan',
  Home: 'text-line-district',
  Family: 'text-line-bakerloo',
  Personal: 'text-line-elizabeth',
};

function guessEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('baby') || n.includes('birth') || n.includes('nursery')) return '👶';
  if (n.includes('career') || n.includes('learning') || n.includes('sprint')) return '🚀';
  if (n.includes('tax') || n.includes('legal') || n.includes('admin')) return '📝';
  if (n.includes('home') || n.includes('house') || n.includes('garage')) return '🏠';
  if (n.includes('client') || n.includes('consulting') || n.includes('portfolio')) return '💼';
  if (n.includes('report') || n.includes('dashboard') || n.includes('data')) return '📊';
  if (n.includes('ai') || n.includes('product') || n.includes('bootcamp')) return '🧠';
  if (n.includes('operation') || n.includes('business') || n.includes('finance')) return '⚙️';
  return '📌';
}

interface Props {
  project: Project;
  tasks: Task[];
  clarifyCount: number;
  milestones?: Milestone[];
  onClick: () => void;
}

export function ProjectCard({ project, tasks, clarifyCount, milestones = [], onClick }: Props) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const next = tasks.filter(t => t.status === 'Next').length;
  const waiting = tasks.filter(t => t.status === 'Waiting').length;
  const backlog = tasks.filter(t => t.status === 'Backlog').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const incompleteMilestones = milestones.filter(m => m.project_id === project.id && !m.is_complete).length;
  const isInProgress = next > 0 || clarifyCount > 0 || incompleteMilestones > 0;
  const isAtRisk = total > 0 && next === 0 && (waiting > 0 || clarifyCount >= 2);
  const isDormant = total > 0 && next === 0 && waiting === 0 && backlog > 0;

  const emoji = guessEmoji(project.name);
  const lineColor = AREA_LINE_COLORS[project.area];
  const lineAccent = AREA_LINE_ACCENT[project.area];

  const momentum = isAtRisk ? { label: 'At risk', emoji: '⚠️', color: 'text-status-waiting' }
    : isDormant ? { label: 'Dormant', emoji: '💤', color: 'text-muted-foreground' }
    : next >= 3 ? { label: 'High activity', emoji: '🔥', color: 'text-status-today' }
    : isInProgress ? { label: 'Steady', emoji: '🌿', color: 'text-status-done' }
    : null;

  // Build station dots for the route progress
  const stationCount = Math.min(total, 8);
  const filledStations = total > 0 ? Math.round((done / total) * stationCount) : 0;

  return (
    <Card
      className={cn(
        "cursor-pointer shadow-card hover:shadow-elevated transition-all duration-200 rounded-xl group overflow-hidden",
        "hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      {/* Colored line top bar */}
      <div className={cn("h-1.5 w-full", lineColor)} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-lg flex-shrink-0">{emoji}</span>
            <div className="min-w-0">
              <h3 className={cn("font-sans text-sm font-semibold transition-colors truncate", `group-hover:${lineAccent}`)}>
                {project.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <AreaBadge area={project.area} className="text-[10px] px-1.5 py-0" />
              </div>
            </div>
          </div>
          {momentum && (
            <span className={cn('flex items-center gap-1 text-[10px] font-medium flex-shrink-0', momentum.color)}>
              {momentum.emoji} {momentum.label}
            </span>
          )}
        </div>

        {project.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{project.summary}</p>
        )}

        {/* Station-dot route progress */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
            <span className={cn("font-semibold", lineAccent)}>{progress}% complete</span>
            <span>{done}/{total} stops</span>
          </div>

          {/* Tube line with station dots */}
          <div className="relative flex items-center gap-0 h-4">
            {/* Track line background */}
            <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-muted" />
            {/* Filled track */}
            <div
              className={cn("absolute left-1 top-1/2 -translate-y-1/2 h-[3px] rounded-full transition-all duration-500", lineColor)}
              style={{ width: `${Math.max(progress, 0)}%` }}
            />
            {/* Station dots */}
            {stationCount > 0 && Array.from({ length: stationCount }).map((_, i) => (
              <div
                key={i}
                className="flex-1 flex justify-center relative z-10"
              >
                <div className={cn(
                  "w-2 h-2 rounded-full border-2 transition-all",
                  i < filledStations
                    ? cn(lineColor, "border-transparent")
                    : "bg-card border-muted-foreground/30"
                )} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 text-[11px]">
          {next > 0 && <span className="text-status-next font-medium">🎯 {next} next</span>}
          {waiting > 0 && <span className="text-status-waiting font-medium">⏳ {waiting} waiting</span>}
          {backlog > 0 && <span className="text-muted-foreground">{backlog} backlog</span>}
          {clarifyCount > 0 && <span className="text-status-today font-medium">❓ {clarifyCount}</span>}
        </div>
      </div>
    </Card>
  );
}
