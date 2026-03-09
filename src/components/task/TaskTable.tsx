import { useMemo } from 'react';
import type { Task, TaskArea, TaskStatus, TaskUpdate, Project } from '@/types/task';
import { AREAS, STATUSES } from '@/types/task';
import { AreaBadge } from './AreaBadge';
import { StatusBadge } from './StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { scoreTasks, type ScoredTask } from '@/lib/task-scoring';

interface Props {
  tasks: Task[];
  projects?: Project[];
  allTasks?: Task[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onTaskClick: (task: Task) => void;
  onInlineUpdate: (id: string, updates: TaskUpdate) => void;
  showCompletedAt?: boolean;
  showScoring?: boolean;
}

function formatPacific(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
}

const impactColors: Record<number, string> = {
  5: 'text-destructive font-semibold',
  4: 'text-status-next font-semibold',
  3: 'text-foreground',
  2: 'text-muted-foreground',
  1: 'text-muted-foreground/60',
};

export function TaskTable({ tasks, projects = [], allTasks, selectedIds, onToggleSelect, onSelectAll, onTaskClick, onInlineUpdate, showCompletedAt = false, showScoring = false }: Props) {
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  const scored: ScoredTask[] = useMemo(() => {
    if (!showScoring) return [];
    return scoreTasks(tasks, allTasks ?? tasks);
  }, [tasks, allTasks, showScoring]);

  const displayTasks = showScoring ? scored : tasks;

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
            {showScoring && (
              <>
                <th className="text-center p-2 font-medium text-muted-foreground text-xs w-[60px]">⏱️ Est</th>
                <th className="text-center p-2 font-medium text-muted-foreground text-xs w-[60px]">💥 Impact</th>
                <th className="text-center p-2 font-medium text-muted-foreground text-xs w-[60px]">🏆 Score</th>
              </>
            )}
            <th className="text-left p-2 font-medium text-muted-foreground text-xs w-[120px]">Project</th>
            {showCompletedAt && <th className="text-left p-2 font-medium text-muted-foreground text-xs w-[140px]">Completed</th>}
          </tr>
        </thead>
        <tbody>
          {displayTasks.map(task => {
            const st = showScoring ? (task as ScoredTask) : null;
            return (
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
                {showScoring && st && (
                  <>
                    <td className="p-2 text-center">
                      <span className="text-[11px] font-mono text-muted-foreground">{st.estimatedDuration}</span>
                    </td>
                    <td className="p-2 text-center">
                      <span className={cn('text-[11px] font-mono', impactColors[st.impactScore] || 'text-foreground')}>
                        {st.impactScore}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <span className={cn(
                        'text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full',
                        st.priorityScore >= 8 ? 'bg-destructive/10 text-destructive' :
                        st.priorityScore >= 5 ? 'bg-status-next/10 text-status-next' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {st.priorityScore}
                      </span>
                    </td>
                  </>
                )}
                <td className="p-2 text-xs text-muted-foreground" onClick={() => onTaskClick(task)}>
                  {task.project_id ? projectMap.get(task.project_id) ?? '—' : '—'}
                </td>
                {showCompletedAt && (
                  <td className="p-2 text-xs text-muted-foreground font-mono" onClick={() => onTaskClick(task)}>
                    {task.status === 'Done' ? formatPacific(task.updated_at) : '—'}
                  </td>
                )}
              </tr>
            );
          })}
          {tasks.length === 0 && (
            <tr><td colSpan={showScoring ? 8 : (showCompletedAt ? 6 : 5)} className="p-8 text-center text-muted-foreground text-sm">No tasks found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
