import type { TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';

const statusConfig: Record<TaskStatus, { bg: string; text: string; emoji: string }> = {
  Today: { bg: 'bg-status-today/12', text: 'text-status-today', emoji: '📌' },
  Next: { bg: 'bg-status-next/12', text: 'text-status-next', emoji: '🎯' },
  Waiting: { bg: 'bg-status-waiting/12', text: 'text-status-waiting', emoji: '⏳' },
  Backlog: { bg: 'bg-status-backlog/10', text: 'text-status-backlog', emoji: '📋' },
  Closing: { bg: 'bg-status-closing/12', text: 'text-status-closing', emoji: '🏁' },
  Done: { bg: 'bg-status-done/12', text: 'text-status-done', emoji: '✅' },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const config = statusConfig[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-mono transition-colors',
      config.bg, config.text, className
    )}>
      <span className="text-[10px]">{config.emoji}</span>
      {status}
    </span>
  );
}