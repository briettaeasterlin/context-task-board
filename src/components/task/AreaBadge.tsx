import type { TaskArea } from '@/types/task';
import { cn } from '@/lib/utils';

const areaConfig: Record<TaskArea, { bg: string; text: string; emoji: string }> = {
  Client: { bg: 'bg-area-client/8', text: 'text-area-client', emoji: '💼' },
  Business: { bg: 'bg-area-business/8', text: 'text-area-business', emoji: '📊' },
  Home: { bg: 'bg-area-home/8', text: 'text-area-home', emoji: '🏠' },
  Family: { bg: 'bg-area-family/8', text: 'text-area-family', emoji: '👨‍👩‍👧' },
  Personal: { bg: 'bg-area-personal/8', text: 'text-area-personal', emoji: '🌿' },
};

export function AreaBadge({ area, className }: { area: TaskArea; className?: string }) {
  const config = areaConfig[area];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-mono transition-colors',
      config.bg, config.text, className
    )}>
      <span className="text-[10px]">{config.emoji}</span>
      {area}
    </span>
  );
}