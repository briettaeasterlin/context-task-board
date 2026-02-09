import type { TaskArea } from '@/types/task';
import { cn } from '@/lib/utils';

const areaStyles: Record<TaskArea, string> = {
  Client: 'bg-area-client/15 text-area-client',
  Business: 'bg-area-business/15 text-area-business',
  Home: 'bg-area-home/15 text-area-home',
  Family: 'bg-area-family/15 text-area-family',
  Personal: 'bg-area-personal/15 text-area-personal',
};

export function AreaBadge({ area, className }: { area: TaskArea; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium font-mono', areaStyles[area], className)}>
      {area}
    </span>
  );
}
