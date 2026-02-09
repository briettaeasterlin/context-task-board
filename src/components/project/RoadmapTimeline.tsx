import type { Milestone, Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { Check, Circle, ArrowRight } from 'lucide-react';

interface Props {
  milestones: Milestone[];
  tasks: Task[];
}

export function RoadmapTimeline({ milestones, tasks }: Props) {
  const sorted = [...milestones].sort((a, b) => a.order_index - b.order_index);
  const firstIncompleteIdx = sorted.findIndex(m => !m.is_complete);

  return (
    <div className="space-y-0">
      {sorted.map((milestone, idx) => {
        const linkedTasks = tasks.filter(t => t.milestone_id === milestone.id);
        const doneCount = linkedTasks.filter(t => t.status === 'Done').length;
        const totalCount = linkedTasks.length;
        const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : milestone.is_complete ? 100 : 0;
        const isNow = idx === firstIncompleteIdx;
        const isComplete = milestone.is_complete || (totalCount > 0 && doneCount === totalCount);
        const isInProgress = !isComplete && linkedTasks.some(t => t.status === 'Next' || t.status === 'Waiting');

        return (
          <div key={milestone.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors',
                isComplete ? 'border-status-done bg-status-done/10' :
                isNow ? 'border-primary bg-primary/10' :
                isInProgress ? 'border-status-waiting bg-status-waiting/10' :
                'border-muted-foreground/30 bg-muted'
              )}>
                {isComplete ? <Check className="h-3.5 w-3.5 text-status-done" /> :
                 isNow ? <ArrowRight className="h-3.5 w-3.5 text-primary" /> :
                 <Circle className="h-2.5 w-2.5 text-muted-foreground/50" />}
              </div>
              {idx < sorted.length - 1 && (
                <div className={cn('w-0.5 flex-1 min-h-[32px]', isComplete ? 'bg-status-done/30' : 'bg-border')} />
              )}
            </div>
            <div className="pb-6 flex-1">
              <div className="flex items-center gap-2">
                <h4 className={cn('font-mono text-xs font-medium', isComplete && 'line-through text-muted-foreground')}>
                  {milestone.name}
                </h4>
                {isNow && <span className="text-[10px] font-semibold text-primary bg-accent px-1.5 py-0.5 rounded">NOW</span>}
              </div>
              {milestone.description && <p className="text-[10px] text-muted-foreground mt-0.5">{milestone.description}</p>}
              {totalCount > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden max-w-[120px]">
                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{doneCount}/{totalCount}</span>
                </div>
              )}
              {linkedTasks.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {linkedTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-1.5 text-[10px]">
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        t.status === 'Done' ? 'bg-status-done' :
                        t.status === 'Next' ? 'bg-status-next' :
                        t.status === 'Waiting' ? 'bg-status-waiting' :
                        'bg-status-backlog'
                      )} />
                      <span className={cn('text-muted-foreground', t.status === 'Done' && 'line-through')}>{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {sorted.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No milestones yet.</p>}
    </div>
  );
}
