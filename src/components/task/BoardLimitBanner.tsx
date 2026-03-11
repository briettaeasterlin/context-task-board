import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BoardLimitWarning } from '@/hooks/useBoardLimits';
import type { TaskUpdate } from '@/types/task';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  warnings: BoardLimitWarning[];
  onUpdate: (id: string, updates: TaskUpdate) => void;
}

export function BoardLimitBanner({ warnings, onUpdate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map(w => (
        <Card key={w.status} className="border-status-waiting/40 bg-status-waiting/5 rounded-xl overflow-hidden">
          <button
            className="w-full p-3 flex items-center gap-3 text-left"
            onClick={() => setExpanded(expanded === w.status ? null : w.status)}
          >
            <AlertTriangle className="h-4 w-4 text-status-waiting shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {w.status} has {w.current} tasks (limit: {w.limit})
              </p>
              <p className="text-xs text-muted-foreground">
                {w.overflow} task{w.overflow !== 1 ? 's' : ''} should move to Backlog
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0 rounded-full">
              {w.current}/{w.limit}
            </Badge>
            {expanded === w.status ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expanded === w.status && w.suggestedDemotions.length > 0 && (
            <div className="px-3 pb-3 space-y-1.5 border-t border-status-waiting/20 pt-2">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Suggested moves to Backlog (lowest priority first)
              </p>
              {w.suggestedDemotions.map(task => (
                <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  <span className={cn(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded-full',
                    task.priorityScore >= 5 ? 'bg-status-next/10 text-status-next' : 'bg-muted text-muted-foreground'
                  )}>
                    score: {task.priorityScore}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] shrink-0"
                    onClick={() => {
                      onUpdate(task.id, { status: 'Backlog' });
                      toast.success(`${task.title} → Backlog`);
                    }}
                  >
                    <ArrowRight className="h-3 w-3 mr-0.5" /> Backlog
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs mt-1"
                onClick={() => {
                  w.suggestedDemotions.forEach(t => onUpdate(t.id, { status: 'Backlog' }));
                  toast.success(`${w.suggestedDemotions.length} tasks moved to Backlog`);
                  setExpanded(null);
                }}
              >
                Move all {w.suggestedDemotions.length} to Backlog
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
