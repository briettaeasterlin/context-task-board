import type { Project, Task, Milestone, TaskArea } from '@/types/task';
import { AreaBadge } from '@/components/task/AreaBadge';
import { Card } from '@/components/ui/card';
import { TubeRoute } from '@/components/project/TubeRoute';
import { getTubeLineByHex, TUBE_LINES } from '@/lib/tube-colors';
import { cn } from '@/lib/utils';

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
  /** Index for fallback color assignment */
  colorIndex?: number;
}

export function ProjectCard({ project, tasks, clarifyCount, milestones = [], onClick, colorIndex = 0 }: Props) {
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
  const lineColor = project.line_color || TUBE_LINES[colorIndex % TUBE_LINES.length].hex;
  const lineName = getTubeLineByHex(lineColor).name;

  const momentum = isAtRisk ? { label: 'At risk', emoji: '⚠️' }
    : isDormant ? { label: 'Dormant', emoji: '💤' }
    : next >= 3 ? { label: 'High activity', emoji: '🔥' }
    : isInProgress ? { label: 'Steady', emoji: '🌿' }
    : null;

  return (
    <Card
      className={cn(
        "cursor-pointer shadow-card hover:shadow-elevated transition-all duration-200 rounded-xl group overflow-hidden",
        "hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      {/* Colored line top bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: lineColor }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: lineColor }}
            />
            <div className="min-w-0">
              <h3 className="font-sans text-sm font-semibold transition-colors truncate group-hover:text-foreground">
                {project.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <AreaBadge area={project.area} className="text-[10px] px-1.5 py-0" />
              </div>
            </div>
          </div>
          {momentum && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground flex-shrink-0">
              {momentum.emoji} {momentum.label}
            </span>
          )}
        </div>

        {project.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">{project.summary}</p>
        )}

        {/* Tube route visualization */}
        <div className="mb-2">
          <TubeRoute tasks={tasks} lineColor={lineColor} compact />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px]">
            {next > 0 && <span className="font-medium" style={{ color: lineColor }}>🎯 {next} next</span>}
            {waiting > 0 && <span className="text-muted-foreground font-medium">⏳ {waiting}</span>}
            {backlog > 0 && <span className="text-muted-foreground">{backlog} planned</span>}
            {clarifyCount > 0 && <span className="text-destructive font-medium">❓ {clarifyCount}</span>}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{done}/{total} stops</span>
        </div>
      </div>
    </Card>
  );
}
