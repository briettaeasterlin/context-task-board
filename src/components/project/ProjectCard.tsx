import type { Project, Task, Milestone } from '@/types/task';
import { AreaBadge } from '@/components/task/AreaBadge';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Activity, Sparkles, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROJECT_EMOJIS: Record<string, string> = {};

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

  const emoji = PROJECT_EMOJIS[project.id] || guessEmoji(project.name);

  // Momentum indicator
  const momentum = isAtRisk ? { label: 'At risk', emoji: '⚠️', color: 'text-status-waiting' }
    : isDormant ? { label: 'Dormant', emoji: '💤', color: 'text-muted-foreground' }
    : next >= 3 ? { label: 'High activity', emoji: '🔥', color: 'text-destructive' }
    : isInProgress ? { label: 'Steady', emoji: '🌿', color: 'text-primary' }
    : null;

  return (
    <Card
      className={cn(
        "p-5 cursor-pointer shadow-card hover:shadow-elevated transition-all duration-200 rounded-xl group",
        "hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="text-lg flex-shrink-0">{emoji}</span>
          <div className="min-w-0">
            <h3 className="font-sans text-sm font-semibold group-hover:text-primary transition-colors truncate">
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

      <div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
          <span className="font-medium">{progress}% complete</span>
          <span>{done}/{total} tasks</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 animate-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 text-[11px]">
        {next > 0 && <span className="text-status-next font-medium">🎯 {next} next</span>}
        {waiting > 0 && <span className="text-status-waiting font-medium">⏳ {waiting} waiting</span>}
        {backlog > 0 && <span className="text-muted-foreground">{backlog} backlog</span>}
        {clarifyCount > 0 && <span className="text-destructive font-medium">❓ {clarifyCount}</span>}
      </div>
    </Card>
  );
}