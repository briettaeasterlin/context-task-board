import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';
import { Check, Clock, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  tasks: Task[];
  lineColor: string;
  onTaskClick?: (task: Task) => void;
  onMarkDone?: (taskId: string) => void;
  compact?: boolean;
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  Done: 0, Today: 1, Next: 2, Waiting: 3, Closing: 4, Backlog: 5, Someday: 6,
};

const STATUS_LABELS: Partial<Record<TaskStatus, string>> = {
  Done: 'Cleared', Next: 'You Are Here', Today: 'You Are Here',
  Waiting: 'Upcoming', Backlog: 'Planned', Someday: 'On the Map', Closing: 'Closing',
};

export function TubeRoute({ tasks, lineColor, onTaskClick, onMarkDone, compact = false }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 5;
      const sb = STATUS_ORDER[b.status] ?? 5;
      if (sa !== sb) return sa - sb;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [tasks]);

  const firstActiveIdx = sortedTasks.findIndex(t => t.status !== 'Done');
  const youAreHereIdx = firstActiveIdx >= 0 ? firstActiveIdx : sortedTasks.length;

  if (sortedTasks.length === 0) {
    return (
      <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
        <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: lineColor }} />
        <span>No stops on this route yet</span>
      </div>
    );
  }

  if (compact) {
    // Mini route for dashboard/cards — just the line with dots
    const maxDots = Math.min(sortedTasks.length, 12);
    const doneCount = sortedTasks.filter(t => t.status === 'Done').length;
    const filledCount = Math.round((doneCount / sortedTasks.length) * maxDots);

    return (
      <div className="flex items-center gap-0 h-5 relative">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-muted" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full transition-all duration-500"
          style={{ width: `${(doneCount / sortedTasks.length) * 100}%`, backgroundColor: lineColor }}
        />
        {/* Station dots */}
        {Array.from({ length: maxDots }).map((_, i) => {
          const isYouAreHere = i === filledCount && filledCount < maxDots;
          return (
            <div key={i} className="flex-1 flex justify-center relative z-10">
              <div
                className={cn(
                  "rounded-full border-2 transition-all",
                  i < filledCount
                    ? "w-2 h-2 border-transparent"
                    : isYouAreHere
                    ? "w-3 h-3 border-2 animate-pulse"
                    : "w-2 h-2 bg-card border-muted-foreground/30"
                )}
                style={
                  i < filledCount
                    ? { backgroundColor: lineColor }
                    : isYouAreHere
                    ? { borderColor: lineColor, backgroundColor: `${lineColor}33` }
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Full route visualization
  return (
    <div className="relative py-4">
      {/* Route line */}
      <div className="space-y-0">
        {sortedTasks.map((task, idx) => {
          const isDone = task.status === 'Done';
          const isYouAreHere = idx === youAreHereIdx;
          const isPast = idx < youAreHereIdx;
          const isHovered = hoveredId === task.id;

          return (
            <div
              key={task.id}
              className={cn(
                "relative flex items-start gap-4 group cursor-pointer",
                "transition-all duration-200",
                compact ? "py-1" : "py-2"
              )}
              onMouseEnter={() => setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onTaskClick?.(task)}
            >
              {/* Station node + connecting line */}
              <div className="relative flex flex-col items-center flex-shrink-0 w-6">
                {/* Connecting line above */}
                {idx > 0 && (
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-[3px] h-4"
                    style={{
                      backgroundColor: isPast || isDone ? lineColor : undefined,
                      borderLeft: !isPast && !isDone ? `3px dashed ${lineColor}40` : undefined,
                    }}
                  />
                )}

                {/* Station circle */}
                {isYouAreHere ? (
                  <div className="relative z-10 flex items-center justify-center">
                    {/* Outer pulse ring */}
                    <div
                      className="absolute w-7 h-7 rounded-full animate-ping opacity-20"
                      style={{ backgroundColor: lineColor }}
                    />
                    <div
                      className="absolute w-6 h-6 rounded-full opacity-30 animate-pulse"
                      style={{ backgroundColor: lineColor }}
                    />
                    {/* Inner circle */}
                    <div
                      className="relative w-4 h-4 rounded-full border-[3px] z-10"
                      style={{ borderColor: lineColor, backgroundColor: `${lineColor}44` }}
                    />
                  </div>
                ) : isDone ? (
                  <div
                    className="relative z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: lineColor }}
                  >
                    <Check className="h-2 w-2 text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "relative z-10 w-3 h-3 rounded-full border-2",
                      task.status === 'Someday' ? "opacity-40" : ""
                    )}
                    style={{
                      borderColor: `${lineColor}66`,
                      backgroundColor: isHovered ? `${lineColor}22` : 'hsl(var(--card))',
                    }}
                  />
                )}

                {/* Connecting line below */}
                {idx < sortedTasks.length - 1 && (
                  <div
                    className="absolute top-6 left-1/2 -translate-x-1/2 w-[3px] h-4"
                    style={{
                      backgroundColor: isPast ? lineColor : undefined,
                      borderLeft: !isPast ? `3px dashed ${lineColor}40` : undefined,
                    }}
                  />
                )}
              </div>

              {/* Task content */}
              <div className={cn(
                "flex-1 min-w-0 rounded-xl px-3 py-2 transition-all duration-150",
                isYouAreHere ? "ring-1 ring-offset-1" : "",
                isHovered ? "bg-muted/40" : "",
                isDone ? "opacity-60" : ""
              )}
              style={isYouAreHere ? { ringColor: lineColor, boxShadow: `0 0 12px ${lineColor}20` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium truncate",
                    isDone && "line-through text-muted-foreground",
                    isYouAreHere && "font-semibold"
                  )}>
                    {task.title}
                  </span>
                  {isYouAreHere && (
                    <Badge
                      className="text-[9px] px-1.5 py-0 rounded-full font-mono border-0 shrink-0"
                      style={{ backgroundColor: `${lineColor}20`, color: lineColor }}
                    >
                      YOU ARE HERE
                    </Badge>
                  )}
                </div>

                {/* Expanded info on hover or for "you are here" */}
                {(isHovered || isYouAreHere) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                    {task.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {task.due_date}
                      </span>
                    )}
                    {task.estimated_minutes && (
                      <span className="text-[10px] text-muted-foreground">
                        {task.estimated_minutes}m
                      </span>
                    )}
                    {onMarkDone && !isDone && (
                      <button
                        className="text-[10px] font-medium hover:underline ml-auto"
                        style={{ color: lineColor }}
                        onClick={(e) => { e.stopPropagation(); onMarkDone(task.id); }}
                      >
                        Mark cleared
                      </button>
                    )}
                  </div>
                )}

                {/* Notes preview on hover */}
                {isHovered && task.notes && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {task.notes.slice(0, 100)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
