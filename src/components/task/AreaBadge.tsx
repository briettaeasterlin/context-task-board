import type { TaskArea } from '@/types/task';
import { cn } from '@/lib/utils';

const areaConfig: Record<TaskArea, { bg: string; text: string; label: string }> = {
  Client: { bg: 'bg-line-piccadilly/10', text: 'text-line-piccadilly', label: 'Piccadilly' },
  Business: { bg: 'bg-line-metropolitan/10', text: 'text-line-metropolitan', label: 'Metropolitan' },
  Home: { bg: 'bg-line-district/10', text: 'text-line-district', label: 'District' },
  Family: { bg: 'bg-line-bakerloo/10', text: 'text-line-bakerloo', label: 'Bakerloo' },
  Personal: { bg: 'bg-line-elizabeth/10', text: 'text-line-elizabeth', label: 'Elizabeth' },
};

export function AreaBadge({ area, className }: { area: TaskArea; className?: string }) {
  const config = areaConfig[area];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium font-mono transition-colors',
      config.bg, config.text, className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.text, "bg-current")} />
      {area}
    </span>
  );
}
