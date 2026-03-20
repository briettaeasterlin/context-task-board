import { useState } from 'react';
import type { Task } from '@/types/task';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scissors, Check, ArrowDownToLine, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TrimSuggestion {
  keep: { id: string; reason: string }[];
  defer: { id: string; reason: string }[];
  summary: string;
}

interface Props {
  tasks: Task[];
  projects: { id: string; name: string }[];
  onDemoteTask: (id: string) => void;
}

export function TrimRouteButton({ tasks, projects, onDemoteTask }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<TrimSuggestion | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const todayTasks = tasks.filter(t => t.status === 'Today' || t.status === 'Next');
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  const handleTrim = async () => {
    setLoading(true);
    setSuggestion(null);
    setApplied(new Set());

    try {
      const payload = todayTasks.map(t => ({
        id: t.id,
        title: t.title,
        area: t.area,
        estimated_minutes: t.estimated_minutes,
        due_date: t.due_date,
        project_name: t.project_id ? projectMap.get(t.project_id) ?? null : null,
        strategic_phase: t.strategic_phase,
        impact_score: t.impact_score ?? null,
      }));

      const { data, error } = await supabase.functions.invoke('ai-trim-route', {
        body: { tasks: payload },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setSuggestion(data as TrimSuggestion);
      setOpen(true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to get trim suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleDefer = (taskId: string) => {
    onDemoteTask(taskId);
    setApplied(prev => new Set(prev).add(taskId));
  };

  const handleDeferAll = () => {
    if (!suggestion) return;
    for (const item of suggestion.defer) {
      if (!applied.has(item.id)) {
        onDemoteTask(item.id);
      }
    }
    setApplied(new Set(suggestion.defer.map(d => d.id)));
    toast.success('Route trimmed');
  };

  const taskById = new Map(todayTasks.map(t => [t.id, t]));

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs font-semibold text-muted-foreground hover:text-foreground rounded-full min-h-[44px]"
        onClick={handleTrim}
        disabled={loading || todayTasks.length <= 3}
      >
        {loading ? (
          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Thinking...</>
        ) : (
          <><Scissors className="h-3.5 w-3.5 mr-1.5" /> Trim route</>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Scissors className="h-4 w-4 text-accent" /> Route Trim Suggestions
            </DialogTitle>
          </DialogHeader>

          {suggestion && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{suggestion.summary}</p>

              {/* Keep section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-accent" /> Keep today
                </h3>
                <div className="space-y-1.5">
                  {suggestion.keep.map(item => {
                    const task = taskById.get(item.id);
                    return (
                      <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg bg-mint/20 border border-accent/10">
                        <span className="w-[7px] h-[7px] rounded-full bg-accent mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task?.title ?? item.id}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{item.reason}</p>
                        </div>
                        {task?.due_date && (
                          <Badge variant="outline" className="text-[10px] font-mono rounded-full shrink-0">
                            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Defer section */}
              {suggestion.defer.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ArrowDownToLine className="h-3.5 w-3.5 text-destructive/70" /> Suggested deferrals
                  </h3>
                  <div className="space-y-1.5">
                    {suggestion.defer.map(item => {
                      const task = taskById.get(item.id);
                      const isApplied = applied.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-start gap-2 p-2 rounded-lg border transition-all',
                            isApplied
                              ? 'bg-muted/50 border-border opacity-50'
                              : 'bg-card border-border/60 hover:border-destructive/20'
                          )}
                        >
                          <span className="w-[7px] h-[7px] rounded-full border-2 border-muted-foreground/30 mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm truncate', isApplied && 'line-through text-muted-foreground')}>{task?.title ?? item.id}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{item.reason}</p>
                          </div>
                          {!isApplied && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs rounded-lg text-destructive hover:text-destructive shrink-0"
                              onClick={() => handleDefer(item.id)}
                            >
                              Defer
                            </Button>
                          )}
                          {isApplied && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">Deferred</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1 rounded-full text-xs font-semibold"
                      onClick={handleDeferAll}
                      disabled={suggestion.defer.every(d => applied.has(d.id))}
                    >
                      Defer all suggested ({suggestion.defer.filter(d => !applied.has(d.id)).length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => setOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}

              {suggestion.defer.length === 0 && (
                <div className="text-center py-3">
                  <p className="text-sm text-muted-foreground">Your route looks good — no deferrals needed.</p>
                  <Button variant="outline" size="sm" className="mt-3 rounded-full text-xs" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
