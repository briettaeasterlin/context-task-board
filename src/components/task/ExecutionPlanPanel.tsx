import type { DailyExecutionPlan, ExecutionPlanTask } from '@/lib/daily-execution-engine';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wand2, Coffee, Frown, Wrench, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionPlanPanelProps {
  plan: DailyExecutionPlan | null;
  onConfirm: () => void;
  onDismiss: () => void;
  isScheduling: boolean;
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

function PlanTaskRow({ item, icon, label, accentClass }: {
  item: ExecutionPlanTask;
  icon: React.ReactNode;
  label: string;
  accentClass: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-start gap-2 p-2 rounded-md border-l-4 bg-card",
            accentClass
          )}>
            <div className="mt-0.5 flex-shrink-0">{icon}</div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-medium truncate">{item.task.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-[9px] h-4 px-1">{label}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  {minutesToTimeStr(item.startMinutes)} · {item.durationMinutes}m
                </span>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px]">
          <p className="text-xs">{item.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ExecutionPlanPanel({ plan, onConfirm, onDismiss, isScheduling }: ExecutionPlanPanelProps) {
  if (!plan) return null;

  if (plan.skipped && plan.meetingLimited) {
    return (
      <Card className="p-3 border-dashed border-warning">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="font-mono">Meeting-heavy day ({plan.meetingCount} meetings) — auto-scheduling skipped.</span>
        </div>
      </Card>
    );
  }

  if (plan.skipped) return null;

  const totalTasks = (plan.frogTask ? 1 : 0) + plan.supportingTasks.length + (plan.warmupTask ? 1 : 0);
  if (totalTasks === 0) return null;

  return (
    <Card className="p-3 space-y-2 border-primary/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-xs font-semibold">NextMove Plan</h3>
        </div>
        {plan.meetingLimited && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 text-warning border-warning">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            {plan.meetingCount} meetings — limited
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        {plan.warmupTask && (
          <PlanTaskRow
            item={plan.warmupTask}
            icon={<Coffee className="h-3.5 w-3.5 text-muted-foreground" />}
            label="Warm-up"
            accentClass="border-l-muted-foreground/40"
          />
        )}

        {plan.frogTask && (
          <PlanTaskRow
            item={plan.frogTask}
            icon={<span className="text-sm">🐸</span>}
            label="Eat the Frog"
            accentClass="border-l-primary"
          />
        )}

        {plan.supportingTasks.map((st, i) => (
          <PlanTaskRow
            key={st.task.id}
            item={st}
            icon={<Wrench className="h-3.5 w-3.5 text-accent-foreground" />}
            label="Supporting"
            accentClass="border-l-accent"
          />
        ))}
      </div>

      {plan.frogTask?.task.project_id && plan.supportingTasks.some(s => s.task.project_id === plan.frogTask!.task.project_id) && (
        <p className="text-[10px] text-muted-foreground font-mono">
          Tasks grouped to maintain project momentum.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={onConfirm}
          disabled={isScheduling}
        >
          <Check className="h-3 w-3" />
          {isScheduling ? 'Scheduling...' : `Confirm ${totalTasks} tasks`}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px]"
          onClick={onDismiss}
          disabled={isScheduling}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
