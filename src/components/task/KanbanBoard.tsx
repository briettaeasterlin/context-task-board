import type { Task, TaskStatus, Project } from '@/types/task';
import { STATUSES } from '@/types/task';
import { AreaBadge } from './AreaBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Clock, CalendarDays } from 'lucide-react';

interface Props {
  tasks: Task[];
  projects?: Project[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

const columnConfig: Record<TaskStatus, { emoji: string; bg: string; headerBg: string }> = {
  Today: { emoji: '📌', bg: 'bg-status-today/5', headerBg: 'bg-status-today/8' },
  Next: { emoji: '🎯', bg: 'bg-status-next/5', headerBg: 'bg-status-next/8' },
  Waiting: { emoji: '⏳', bg: 'bg-status-waiting/5', headerBg: 'bg-status-waiting/8' },
  Backlog: { emoji: '📋', bg: 'bg-muted/20', headerBg: 'bg-status-backlog/5' },
  Closing: { emoji: '🏁', bg: 'bg-status-closing/5', headerBg: 'bg-status-closing/8' },
  Done: { emoji: '✅', bg: 'bg-status-done/5', headerBg: 'bg-status-done/8' },
  Someday: { emoji: '💭', bg: 'bg-muted/20', headerBg: 'bg-muted/10' },
};

export function KanbanBoard({ tasks, projects = [], selectedIds, onToggleSelect, onTaskClick, onStatusChange }: Props) {
  const projectMap = new Map(projects.map(p => [p.id, p.name]));
  const columns = STATUSES.map(status => ({
    status,
    tasks: tasks.filter(t => t.status === status),
  }));

  return (
    <div className="grid grid-cols-6 gap-3 min-h-[400px]">
      {columns.map(col => {
        const config = columnConfig[col.status];
        return (
          <div key={col.status} className={cn('rounded-xl border overflow-hidden', config.bg)}>
            <div className={cn('px-4 py-3 border-b', config.headerBg)}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-sans text-sm font-semibold">
                  <span>{config.emoji}</span>
                  {col.status}
                </span>
                <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  {col.tasks.length}
                </span>
              </div>
            </div>
            <div className="p-2.5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {col.tasks.map(task => (
                <div
                  key={task.id}
                  className={cn(
                    'rounded-xl border bg-card p-3 cursor-pointer shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200',
                    selectedIds.has(task.id) && 'ring-2 ring-primary/40',
                    task.status === 'Done' && 'opacity-60'
                  )}
                  onClick={() => onTaskClick(task)}
                >
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={() => onToggleSelect(task.id)}
                      onClick={e => e.stopPropagation()}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-relaxed">{task.title}</p>
                      {task.context && <p className="text-[10px] text-muted-foreground mt-1 truncate">{task.context}</p>}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <AreaBadge area={task.area} className="text-[9px] px-1.5 py-0" />
                        {task.project_id && (
                          <span className="text-[10px] text-muted-foreground truncate">{projectMap.get(task.project_id)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {task.estimated_minutes && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" /> {task.estimated_minutes}m
                          </span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <CalendarDays className="h-2.5 w-2.5" /> {task.due_date}
                          </span>
                        )}
                      </div>
                      {task.status === 'Waiting' && task.blocked_by && (
                        <p className="text-[10px] text-status-waiting mt-1.5 font-medium">⏳ {task.blocked_by}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {col.tasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No tasks here
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}