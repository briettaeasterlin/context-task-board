import { useMemo, useCallback, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { usePlannedBlocks } from '@/hooks/usePlanner';
import { useWorkload } from '@/hooks/useWorkload';
import { useProjectCompletion } from '@/hooks/useProjectCompletion';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, TrendingUp, Plus, Zap } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { scoreTasks, buildScoringContext, type ScoredTask } from '@/lib/task-scoring';

export default function WorkloadPage() {
  const { tasks, createTask } = useTasks();
  const { projects } = useProjects();

  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { blocks } = usePlannedBlocks(weekStart, weekEnd);

  const workload = useWorkload(tasks, blocks);
  const nearingCompletion = useProjectCompletion(tasks, projects);

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Top scored tasks for the "Suggested Next" section
  const topTasks = useMemo(() => {
    const ctx = buildScoringContext(tasks, workload.calendarUtilization);
    const active = tasks.filter(t => t.status === 'Next' || t.status === 'Backlog');
    return scoreTasks(active, tasks, ctx).slice(0, 5);
  }, [tasks, workload.calendarUtilization]);

  // Pipeline tasks recommendation
  const pipelineTasks = useMemo(() => {
    const ctx = buildScoringContext(tasks, workload.calendarUtilization);
    const pipeline = tasks.filter(t =>
      t.status !== 'Done' &&
      (t.area === 'Client' || /\b(follow.?up|prospect|nurture|lead|pipeline|outreach|relationship)\b/i.test(t.title + ' ' + (t.context ?? '')))
    );
    return scoreTasks(pipeline, tasks, ctx).slice(0, 3);
  }, [tasks, workload.calendarUtilization]);

  const handleAddClosingTask = useCallback((projectId: string, title: string) => {
    createTask.mutate({
      title,
      area: 'Business',
      status: 'Closing',
      context: null,
      notes: null,
      tags: [],
      project_id: projectId,
      milestone_id: null,
      blocked_by: null,
      source: null,
      due_date: null,
      target_window: null,
    }, {
      onSuccess: () => toast.success(`Added closing task: ${title}`),
    });
  }, [createTask]);

  const capPercent = Math.min(100, Math.round((workload.consultingAdminMinutes / workload.consultingAdminCapMinutes) * 100));
  const utilizationPercent = Math.round(workload.calendarUtilization * 100);

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="pt-2">
          <h1 className="text-3xl font-display font-bold">📊 Workload Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Week of {format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')} – {format(endOfWeek(now, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </p>
        </div>

        {/* Capacity Warning */}
        {workload.isOverCapacity && (
          <Card className="p-4 rounded-2xl border-destructive/40 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">Consulting/Admin capacity exceeded</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatHours(workload.consultingAdminMinutes)} of {formatHours(workload.consultingAdminCapMinutes)} used. Consider deferring non-critical consulting work.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Work Balance Cards */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">⚖️ Work Balance</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Consulting / Admin',
                minutes: workload.consultingAdminMinutes,
                cap: workload.consultingAdminCapMinutes,
                color: 'text-status-waiting',
                bgColor: 'bg-status-waiting/10',
                progressColor: workload.isOverCapacity ? 'bg-destructive' : 'bg-status-waiting',
                showCap: true,
              },
              {
                label: 'Product Dev',
                minutes: workload.productMinutes,
                color: 'text-primary',
                bgColor: 'bg-primary/10',
                progressColor: 'bg-primary',
              },
              {
                label: 'Pipeline',
                minutes: workload.pipelineMinutes,
                color: 'text-accent',
                bgColor: 'bg-accent/10',
                progressColor: 'bg-accent',
              },
              {
                label: 'Personal',
                minutes: workload.personalMinutes,
                color: 'text-muted-foreground',
                bgColor: 'bg-muted/30',
                progressColor: 'bg-muted-foreground',
              },
            ].map(item => (
              <Card key={item.label} className={cn("p-5 rounded-2xl shadow-card", item.bgColor)}>
                <div className={cn("text-2xl font-display font-bold", item.color)}>
                  {formatHours(item.minutes)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                {'showCap' in item && item.showCap && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{capPercent}%</span>
                      <span>/ {formatHours(item.cap!)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-500", item.progressColor)}
                        style={{ width: `${Math.min(capPercent, 100)}%` }} />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
          <Card className="mt-4 p-4 rounded-2xl shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Calendar Utilization</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatHours(workload.totalMinutes)} of {formatHours(workload.weeklyCapacityMinutes)} capacity used
                </p>
              </div>
              <span className={cn(
                "text-2xl font-display font-bold",
                utilizationPercent > 90 ? "text-destructive" : utilizationPercent > 70 ? "text-status-waiting" : "text-success"
              )}>
                {utilizationPercent}%
              </span>
            </div>
            <Progress value={utilizationPercent} className="mt-3 h-2" />
          </Card>
        </section>

        {/* Pipeline Protection */}
        {workload.shouldBoostPipeline && (
          <section>
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Pipeline Alert
            </h2>
            <Card className="p-5 rounded-2xl shadow-card border-accent/30 bg-accent/5">
              <p className="text-sm font-medium mb-1">
                {workload.pipelineStaleDays >= 5
                  ? `⚠️ No pipeline task completed in ${workload.pipelineStaleDays} days`
                  : `📈 Calendar utilization is ${utilizationPercent}% — room for pipeline work`
                }
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Pipeline tasks are boosted in priority scoring. Consider scheduling one of these:
              </p>
              {pipelineTasks.length > 0 ? (
                <div className="space-y-2">
                  {pipelineTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-xl bg-background/50">
                      <span className="text-sm">{t.title}</span>
                      <Badge variant="outline" className="text-[10px] rounded-full">
                        Score: {t.priorityScore}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No pipeline tasks found. Consider adding: follow-up with prospect, relationship nurture, proposal work, or lead research.
                </p>
              )}
            </Card>
          </section>
        )}

        {/* Project Completion Detector */}
        {nearingCompletion.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Nearing Completion
            </h2>
            <div className="space-y-4">
              {nearingCompletion.map(nc => (
                <Card key={nc.project.id} className="p-5 rounded-2xl shadow-card border-success/20 bg-success/5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-semibold text-sm">{nc.project.name}</h3>
                    <Badge variant="outline" className="text-[10px] rounded-full">
                      {nc.openTasks.length} task{nc.openTasks.length !== 1 ? 's' : ''} remaining
                    </Badge>
                  </div>
                  <div className="space-y-1 mb-4">
                    {nc.openTasks.map(t => (
                      <div key={t.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-waiting shrink-0" />
                        {t.title}
                      </div>
                    ))}
                  </div>
                  {nc.suggestedClosingTasks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Suggested closing tasks:</p>
                      <div className="flex flex-wrap gap-2">
                        {nc.suggestedClosingTasks.map(suggestion => (
                          <Button
                            key={suggestion}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 rounded-full gap-1"
                            onClick={() => handleAddClosingTask(nc.project.id, suggestion)}
                          >
                            <Plus className="h-3 w-3" /> {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Top Priority Tasks */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Highest Priority
          </h2>
          <div className="space-y-2">
            {topTasks.map((t, i) => (
              <Card key={t.id} className="p-4 rounded-2xl shadow-card flex items-center gap-3">
                <span className="text-lg font-display font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {t.deadlineWeight > 0 && (
                      <Badge variant="destructive" className="text-[9px] h-4 rounded-full">🔥 +{t.deadlineWeight}</Badge>
                    )}
                    {t.projectCompletionWeight > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 rounded-full">🏁 +{t.projectCompletionWeight}</Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] h-4 rounded-full">
                      {t.strategicCategory.replace('_', ' ')} +{t.strategicValue}
                    </Badge>
                    {t.pipelineBoost > 0 && (
                      <Badge className="text-[9px] h-4 rounded-full bg-accent text-accent-foreground">📈 +{t.pipelineBoost}</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">Age +{t.taskAgeScore}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-display font-bold text-primary">{t.priorityScore}</span>
                  <p className="text-[10px] text-muted-foreground">score</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
