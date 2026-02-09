import type { TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';

const statusStyles: Record<TaskStatus, string> = {
  Backlog: 'bg-status-backlog/15 text-status-backlog',
  Next: 'bg-status-next/15 text-status-next',
  Waiting: 'bg-status-waiting/15 text-status-waiting',
  Done: 'bg-status-done/15 text-status-done',
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium font-mono', statusStyles[status], className)}>
      {status}
    </span>
  );
}
