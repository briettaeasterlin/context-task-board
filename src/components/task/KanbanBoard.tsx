import type { Task, TaskStatus, Project } from '@/types/task';
import { STATUSES } from '@/types/task';
import { AreaBadge } from './AreaBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface Props {
  tasks: Task[];
  projects?: Project[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, projects = [], selectedIds, onToggleSelect, onTaskClick, onStatusChange }: Props) {
  const projectMap = new Map(projects.map(p => [p.id, p.name]));
  const columns = STATUSES.map(status => ({
    status,
    tasks: tasks.filter(t => t.status === status),
  }));

  const statusColors: Record<TaskStatus, string> = {
    Backlog: 'border-t-status-backlog',
    Next: 'border-t-status-next',
    Waiting: 'border-t-status-waiting',
    Done: 'border-t-status-done',
  };

  return (
    <div className="grid grid-cols-4 gap-3 min-h-[400px]">
      {columns.map(col => (
        <div key={col.status} className={cn('rounded-md border border-t-2 bg-muted/30', statusColors[col.status])}>
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold">{col.status}</span>
              <span className="text-xs text-muted-foreground">{col.tasks.length}</span>
            </div>
          </div>
          <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {col.tasks.map(task => (
              <div
                key={task.id}
                className={cn(
                  'rounded border bg-card p-2.5 cursor-pointer hover:shadow-sm transition-shadow',
                  selectedIds.has(task.id) && 'ring-1 ring-primary',
                  task.status === 'Done' && 'opacity-60'
                )}
                onClick={() => onTaskClick(task)}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedIds.has(task.id)}
                    onCheckedChange={() => onToggleSelect(task.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs leading-snug truncate">{task.title}</p>
                    {task.context && <p className="text-[10px] text-muted-foreground mt-1 truncate">{task.context}</p>}
                    <div className="flex items-center gap-1.5 mt-2">
                      <AreaBadge area={task.area} className="text-[10px] px-1 py-0" />
                      {task.project_id && <span className="text-[10px] text-muted-foreground">{projectMap.get(task.project_id)}</span>}
                    </div>
                    {task.status === 'Waiting' && task.blocked_by && (
                      <p className="text-[10px] text-status-waiting mt-1">⏳ {task.blocked_by}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {col.tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
