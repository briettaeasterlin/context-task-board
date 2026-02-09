import type { Project, Task } from '@/types/task';
import { AreaBadge } from '@/components/task/AreaBadge';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  project: Project;
  tasks: Task[];
  clarifyCount: number;
  onClick: () => void;
}

export function ProjectCard({ project, tasks, clarifyCount, onClick }: Props) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const next = tasks.filter(t => t.status === 'Next').length;
  const waiting = tasks.filter(t => t.status === 'Waiting').length;
  const backlog = tasks.filter(t => t.status === 'Backlog').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const isAtRisk = total > 0 && next === 0 && waiting > 0;

  return (
    <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow" onClick={onClick}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-mono text-sm font-semibold">{project.name}</h3>
          <AreaBadge area={project.area} className="mt-1" />
        </div>
        {isAtRisk && (
          <span className="flex items-center gap-1 text-[10px] text-status-waiting font-medium">
            <AlertTriangle className="h-3 w-3" /> At risk
          </span>
        )}
      </div>
      {project.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.summary}</p>}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>{progress}%</span>
          <span>{done}/{total} tasks</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px]">
        <span className="text-status-next">{next} next</span>
        <span className="text-status-waiting">{waiting} waiting</span>
        <span className="text-status-backlog">{backlog} backlog</span>
        {clarifyCount > 0 && <span className="text-destructive">{clarifyCount} ?</span>}
      </div>
    </Card>
  );
}
