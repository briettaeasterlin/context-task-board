import type { Task, TaskArea, TaskStatus, TaskUpdate, Project } from '@/types/task';
import { AREAS, STATUSES } from '@/types/task';
import { AreaBadge } from './AreaBadge';
import { StatusBadge } from './StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Props {
  tasks: Task[];
  projects?: Project[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onTaskClick: (task: Task) => void;
  onInlineUpdate: (id: string, updates: TaskUpdate) => void;
}

export function TaskTable({ tasks, projects = [], selectedIds, onToggleSelect, onSelectAll, onTaskClick, onInlineUpdate }: Props) {
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="w-10 p-2">
              <Checkbox checked={tasks.length > 0 && selectedIds.size === tasks.length} onCheckedChange={onSelectAll} />
            </th>
            <th className="text-left p-2 font-medium text-muted-foreground text-xs">Title</th>
            <th className="text-left p-2 font-medium text-muted-foreground text-xs w-[90px]">Area</th>
            <th className="text-left p-2 font-medium text-muted-foreground text-xs w-[90px]">Status</th>
            <th className="text-left p-2 font-medium text-muted-foreground text-xs w-[120px]">Project</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr
              key={task.id}
              className={cn(
                'border-b last:border-0 hover:bg-surface-hover transition-colors cursor-pointer',
                selectedIds.has(task.id) && 'bg-accent/50',
                task.status === 'Done' && 'opacity-60'
              )}
            >
              <td className="p-2" onClick={e => e.stopPropagation()}>
                <Checkbox checked={selectedIds.has(task.id)} onCheckedChange={() => onToggleSelect(task.id)} />
              </td>
              <td className="p-2 font-mono text-sm" onClick={() => onTaskClick(task)}>
                {task.title}
                {task.context && (
                  <span className="ml-2 text-muted-foreground text-xs font-sans">— {task.context.slice(0, 50)}{task.context.length > 50 ? '...' : ''}</span>
                )}
                {task.status === 'Waiting' && task.blocked_by && (
                  <span className="ml-2 text-status-waiting text-[10px]">⏳ {task.blocked_by}</span>
                )}
              </td>
              <td className="p-2" onClick={e => e.stopPropagation()}>
                <Select value={task.area} onValueChange={v => onInlineUpdate(task.id, { area: v as TaskArea })}>
                  <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 w-auto">
                    <AreaBadge area={task.area} />
                  </SelectTrigger>
                  <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="p-2" onClick={e => e.stopPropagation()}>
                <Select value={task.status} onValueChange={v => onInlineUpdate(task.id, { status: v as TaskStatus })}>
                  <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 w-auto">
                    <StatusBadge status={task.status} />
                  </SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="p-2 text-xs text-muted-foreground" onClick={() => onTaskClick(task)}>
                {task.project_id ? projectMap.get(task.project_id) ?? '—' : '—'}
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No tasks found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
