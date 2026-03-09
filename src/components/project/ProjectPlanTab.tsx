import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Target, Clock, CheckCircle2, ChevronRight, Plus, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { Task, Project, Milestone, TaskUpdate } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { estimateDuration, DURATION_MINUTES } from '@/lib/task-scoring';
import { cn } from '@/lib/utils';

interface Phase {
  name: string;
  description: string;
  taskIds: string[];
}

interface Dependency {
  taskId: string;
  taskTitle: string;
  blockedBy: string;
}

interface DecompositionSuggestion {
  taskId: string;
  taskTitle: string;
  suggestedSubtasks: string[];
}

interface PlanData {
  objective: string;
  healthStatus: 'On Track' | 'At Risk' | 'Blocked';
  healthReason: string;
  completionPercent: number;
  phases: Phase[];
  dependencies: Dependency[];
  suggestedMilestones?: { name: string; description?: string }[];
  decompositionSuggestions?: DecompositionSuggestion[];
}

interface Props {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  onTaskClick: (task: Task) => void;
  onCreateTask: (title: string) => void;
}

export function ProjectPlanTab({ project, tasks, milestones, onTaskClick, onCreateTask }: Props) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        project: { id: project.id, name: project.name, summary: project.summary, scope_notes: project.scope_notes, area: project.area },
        tasks: tasks.map(t => ({
          id: t.id, title: t.title, status: t.status, blocked_by: t.blocked_by,
          due_date: t.due_date, updated_at: t.updated_at, notes: t.notes,
          impact_score: (t as any).impact_score,
        })),
        milestones: milestones.map(m => ({ id: m.id, name: m.name, description: m.description, is_complete: m.is_complete })),
      };
      const { data, error: fnError } = await supabase.functions.invoke('ai-project-plan', { body: payload });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setPlan(data);
    } catch (e: any) {
      setError(e.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  }, [project, tasks, milestones]);

  // Auto-generate on mount
  useEffect(() => {
    if (tasks.length > 0) generatePlan();
  }, []);  // intentionally run once

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  // Estimated remaining work
  const remainingWork = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'Done');
    return active.map(t => ({
      task: t,
      duration: estimateDuration(t.title),
      minutes: DURATION_MINUTES[estimateDuration(t.title)],
    })).sort((a, b) => b.minutes - a.minutes);
  }, [tasks]);

  const totalMinutes = remainingWork.reduce((sum, w) => sum + w.minutes, 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  if (loading) {
    return (
      <Card className="p-12 text-center rounded-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Generating project plan…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center rounded-xl">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={generatePlan}>Try Again</Button>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="p-8 text-center rounded-xl">
        <Target className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-3">Generate an AI execution plan for this project.</p>
        <Button size="sm" onClick={generatePlan}>
          <Zap className="h-3.5 w-3.5 mr-1.5" /> Generate Plan
        </Button>
      </Card>
    );
  }

  const healthColor = plan.healthStatus === 'On Track' ? 'text-status-done' : plan.healthStatus === 'At Risk' ? 'text-status-waiting' : 'text-destructive';
  const healthBg = plan.healthStatus === 'On Track' ? 'bg-status-done/10' : plan.healthStatus === 'At Risk' ? 'bg-status-waiting/10' : 'bg-destructive/10';

  return (
    <div className="space-y-6">
      {/* Health + Objective */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Card className={cn('p-4 rounded-xl flex-1', healthBg)}>
          <div className="flex items-center gap-2 mb-1">
            {plan.healthStatus === 'On Track' ? <CheckCircle2 className={cn('h-4 w-4', healthColor)} /> :
             plan.healthStatus === 'At Risk' ? <AlertTriangle className={cn('h-4 w-4', healthColor)} /> :
             <AlertTriangle className={cn('h-4 w-4', healthColor)} />}
            <span className={cn('text-sm font-semibold', healthColor)}>Project Health: {plan.healthStatus}</span>
          </div>
          <p className="text-xs text-muted-foreground">{plan.healthReason}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${plan.completionPercent}%` }} />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{plan.completionPercent}%</span>
          </div>
        </Card>
        <Card className="p-4 rounded-xl flex-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Objective</h3>
          <p className="text-sm">{plan.objective}</p>
        </Card>
      </div>

      {/* Regenerate button */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-xs" onClick={generatePlan}>
          <Zap className="h-3 w-3 mr-1" /> Regenerate Plan
        </Button>
      </div>

      {/* Execution Phases */}
      <section>
        <h2 className="font-sans text-base font-semibold mb-3">Execution Phases</h2>
        <div className="space-y-3">
          {plan.phases.map((phase, i) => {
            const phaseTasks = phase.taskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];
            const donePhaseTasks = phaseTasks.filter(t => t.status === 'Done').length;
            const phaseProgress = phaseTasks.length > 0 ? Math.round((donePhaseTasks / phaseTasks.length) * 100) : 0;

            return (
              <Card key={i} className="p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">Phase {i + 1}</Badge>
                    <h3 className="text-sm font-semibold">{phase.name}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">{donePhaseTasks}/{phaseTasks.length} done</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{phase.description}</p>
                <div className="h-1 rounded-full bg-muted overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${phaseProgress}%` }} />
                </div>
                <div className="space-y-1">
                  {phaseTasks.map(t => (
                    <div key={t.id}
                      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/30 cursor-pointer transition-colors text-sm"
                      onClick={() => onTaskClick(t)}>
                      {t.status === 'Done' ?
                        <CheckCircle2 className="h-3.5 w-3.5 text-status-done shrink-0" /> :
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className={t.status === 'Done' ? 'line-through text-muted-foreground' : ''}>{t.title}</span>
                      <span className="text-[10px] font-mono text-muted-foreground ml-auto">{estimateDuration(t.title)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Dependencies */}
      {plan.dependencies.length > 0 && (
        <section>
          <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-status-waiting" /> Dependencies
          </h2>
          <Card className="p-4 rounded-xl space-y-2">
            {plan.dependencies.map(dep => (
              <div key={dep.taskId} className="flex items-center gap-2 text-sm">
                <span className="text-status-waiting">⏳</span>
                <span className="flex-1">{dep.taskTitle}</span>
                <span className="text-xs text-muted-foreground">Waiting on: {dep.blockedBy}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Estimated Remaining Work */}
      <section>
        <h2 className="font-sans text-base font-semibold mb-3">Estimated Work Remaining</h2>
        <Card className="p-4 rounded-xl">
          <div className="space-y-1.5 mb-3">
            {remainingWork.slice(0, 8).map(({ task, duration }) => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-[10px] font-mono w-8 justify-center shrink-0">{duration}</Badge>
                <span className="truncate flex-1">{task.title}</span>
              </div>
            ))}
            {remainingWork.length > 8 && (
              <p className="text-xs text-muted-foreground">+ {remainingWork.length - 8} more tasks</p>
            )}
          </div>
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Total Estimated Time</span>
            <Badge className="font-mono">{totalHours}h</Badge>
          </div>
        </Card>
      </section>

      {/* Decomposition Suggestions */}
      {plan.decompositionSuggestions && plan.decompositionSuggestions.length > 0 && (
        <section>
          <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" /> Task Decomposition Suggestions
          </h2>
          <div className="space-y-3">
            {plan.decompositionSuggestions.map(ds => (
              <Card key={ds.taskId} className="p-4 rounded-xl">
                <h3 className="text-sm font-semibold mb-2">{ds.taskTitle}</h3>
                <p className="text-xs text-muted-foreground mb-2">Could be broken into:</p>
                <div className="space-y-1">
                  {ds.suggestedSubtasks.map((sub, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground font-mono">{i + 1}.</span>
                      <span className="flex-1">{sub}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => { onCreateTask(sub); toast.success(`Task created: ${sub}`); }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
