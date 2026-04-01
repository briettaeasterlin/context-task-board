import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import type { Task } from '@/types/task';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ArrowRight, X, Plus, Search, Clock, Sparkles, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';

type PlanStep = 'suggest' | 'adjust' | 'confirmed';

export default function PlanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);

  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Check if tomorrow is already planned
  const existingPlan = useMemo(() => {
    return tasks.filter(t => t.planned_date === tomorrowStr && t.status !== 'Done');
  }, [tasks, tomorrowStr]);

  const [step, setStep] = useState<PlanStep>(existingPlan.length > 0 ? 'confirmed' : 'suggest');
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [adjustMode, setAdjustMode] = useState(false);
  const [search, setSearch] = useState('');

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Suggestion algorithm per spec:
  // 1. Already planned for tomorrow
  // 2. Tasks with status='Next' and due_date closest to tomorrow
  // 3. Tasks with status='Next' and no due_date, ordered by created_at ASC
  // 4. Carry-forward: planned_date = today but status ≠ 'Done'
  // Never suggest Done, Someday, or Closing
  const suggestedTasks = useMemo(() => {
    const result: Task[] = [];
    const usedIds = new Set<string>();

    // 1. Already planned for tomorrow
    for (const t of tasks) {
      if (t.planned_date === tomorrowStr && t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing') {
        result.push(t);
        usedIds.add(t.id);
      }
    }

    // 4. Carry-forward from today (incomplete)
    for (const t of tasks) {
      if (usedIds.has(t.id)) continue;
      if (t.planned_date === todayStr && t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing') {
        result.push(t);
        usedIds.add(t.id);
      }
    }

    // 2. Next with due_date soonest
    const nextWithDue = tasks
      .filter(t => !usedIds.has(t.id) && t.status === 'Next' && t.due_date)
      .sort((a, b) => (a.due_date!).localeCompare(b.due_date!));
    for (const t of nextWithDue) {
      if (result.length >= 5) break;
      result.push(t);
      usedIds.add(t.id);
    }

    // 3. Next without due_date, by created_at ASC
    const nextNoDue = tasks
      .filter(t => !usedIds.has(t.id) && t.status === 'Next' && !t.due_date)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const t of nextNoDue) {
      if (result.length >= 5) break;
      result.push(t);
      usedIds.add(t.id);
    }

    return result.slice(0, 5);
  }, [tasks, tomorrowStr, todayStr]);

  // Initialize selected tasks from suggestions
  const displayTasks = useMemo(() => {
    if (step === 'confirmed') return existingPlan;
    if (selectedTasks.length > 0) return selectedTasks;
    return suggestedTasks;
  }, [step, selectedTasks, suggestedTasks, existingPlan]);

  // Backlog tasks for adjustment — show grouped by project
  const backlogTasks = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    const selectedIds = new Set(displayTasks.map(t => t.id));
    return tasks
      .filter(t => t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing' && !selectedIds.has(t.id) && t.title.toLowerCase().includes(q))
      .slice(0, 10);
  }, [tasks, search, displayTasks]);

  const estimatedMinutes = displayTasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);

  const handleConfirm = useCallback(async () => {
    const tasksToConfirm = selectedTasks.length > 0 ? selectedTasks : suggestedTasks;
    for (const task of tasksToConfirm) {
      await updateTask.mutateAsync({ id: task.id, planned_date: tomorrowStr, status: task.status === 'Backlog' ? 'Next' : task.status } as any);
    }
    setStep('confirmed');
    toast.success(`Tomorrow is set. ${tasksToConfirm.length} moves locked in.`);
  }, [selectedTasks, suggestedTasks, updateTask, tomorrowStr]);

  const handleAddTask = useCallback((task: Task) => {
    setSelectedTasks(prev => {
      const existing = prev.length > 0 ? prev : [...suggestedTasks];
      if (existing.find(t => t.id === task.id)) return existing;
      if (existing.length >= 5) return existing;
      return [...existing, task];
    });
    setSearch('');
  }, [suggestedTasks]);

  const handleRemoveTask = useCallback((taskId: string) => {
    setSelectedTasks(prev => {
      const existing = prev.length > 0 ? prev : [...suggestedTasks];
      return existing.filter(t => t.id !== taskId);
    });
  }, [suggestedTasks]);

  const handleAdjust = useCallback(() => {
    if (step === 'confirmed') {
      setSelectedTasks(existingPlan);
      setStep('suggest');
    }
    setAdjustMode(true);
  }, [step, existingPlan]);

  const firstTask = displayTasks[0];
  const firstTaskProject = firstTask ? projectMap.get(firstTask.project_id ?? '') : null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Confirmed state */}
        {step === 'confirmed' && (
          <>
            <Card className="p-6 sm:p-8 rounded-2xl bg-accent/5 border-accent/20 text-center">
              <Moon className="h-8 w-8 text-accent mx-auto mb-3 opacity-60" />
              <h1 className="text-2xl font-display font-bold">✅ Tomorrow is set.</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {existingPlan.length} move{existingPlan.length !== 1 ? 's' : ''} locked in.
                {estimatedMinutes > 0 && ` Estimated: ${estimatedMinutes >= 60 ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ''}` : `${estimatedMinutes}m`}.`}
              </p>
              {existingPlan[0] && (
                <p className="text-sm text-muted-foreground mt-2">
                  You'll start with: <span className="font-semibold text-foreground">{existingPlan[0].title}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4 font-mono">Close your laptop. You're good.</p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <Button variant="outline" onClick={() => navigate('/today')} className="rounded-xl font-display" size="sm">
                  View Tomorrow <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <Button variant="ghost" onClick={handleAdjust} className="rounded-xl text-xs text-muted-foreground" size="sm">
                  Adjust
                </Button>
              </div>
            </Card>

            {/* Show planned tasks */}
            <section>
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tomorrow's Route</h2>
              <div className="space-y-2">
                {existingPlan.map((task, idx) => {
                  const taskProject = projectMap.get(task.project_id ?? '');
                  return (
                    <Card key={task.id} className="rounded-xl overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setDrawerTask(task)}>
                      <div className="flex items-stretch">
                        {taskProject?.line_color && (
                          <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                        )}
                        <div className="flex items-center gap-3 p-4 flex-1">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{task.title}</p>
                            {taskProject && (
                              <p className="text-xs text-muted-foreground mt-0.5">{taskProject.name}</p>
                            )}
                          </div>
                          {task.estimated_minutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono flex-shrink-0">
                              <Clock className="h-3 w-3" />{task.estimated_minutes}m
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Suggest / Adjust state */}
        {step !== 'confirmed' && (
          <>
            <div>
              <h1 className="text-2xl font-display font-bold">
                <Sparkles className="h-5 w-5 inline mr-2 text-accent" />
                Plan Tomorrow
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Here's what would move things forward tomorrow:
              </p>
            </div>

            {/* Suggested / selected tasks */}
            {displayTasks.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full border-2 border-muted-foreground/30" />
                    <span className="w-8 h-px bg-muted-foreground/20" />
                    <span className="w-2 h-2 rounded-full border-2 border-muted-foreground/30" />
                    <span className="w-8 h-px bg-muted-foreground/20" />
                    <span className="w-2 h-2 rounded-full border-2 border-muted-foreground/30" />
                  </div>
                </div>
                <p className="text-muted-foreground mb-1">No tasks to suggest.</p>
                <p className="text-sm text-muted-foreground">Add some tasks first, then come back to plan.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {displayTasks.map((task, idx) => {
                  const taskProject = projectMap.get(task.project_id ?? '');
                  return (
                    <Card key={task.id} className="rounded-xl overflow-hidden group cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setDrawerTask(task)}>
                      <div className="flex items-stretch">
                        {taskProject?.line_color && (
                          <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                        )}
                        <div className="flex items-center gap-3 p-4 flex-1">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: taskProject?.line_color ?? 'hsl(var(--accent))' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{task.title}</p>
                            {taskProject && (
                              <p className="text-xs text-muted-foreground mt-0.5">{taskProject.name}</p>
                            )}
                          </div>
                          {task.estimated_minutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono flex-shrink-0">
                              <Clock className="h-3 w-3" />{task.estimated_minutes}m
                            </span>
                          )}
                          {adjustMode && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); handleRemoveTask(task.id); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {estimatedMinutes > 0 && (
              <p className="text-xs text-muted-foreground font-mono">
                Estimated: {estimatedMinutes >= 60 ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ''}` : `${estimatedMinutes}m`}
              </p>
            )}

            {/* Adjust mode: search & add */}
            {adjustMode && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks to add..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 rounded-xl text-sm"
                  />
                </div>
                {backlogTasks.length > 0 && (
                  <div className="border rounded-xl divide-y divide-border/50 overflow-hidden">
                    {backlogTasks.map(task => {
                      const tp = projectMap.get(task.project_id ?? '');
                      return (
                        <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => handleAddTask(task)}>
                          <Plus className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tp?.line_color ?? 'hsl(var(--muted-foreground))' }} />
                          <span className="text-sm flex-1 truncate">{task.title}</span>
                          {tp && (
                            <Badge variant="outline" className="text-[10px] rounded-full" style={{ borderColor: tp.line_color ?? undefined, color: tp.line_color ?? undefined }}>
                              {tp.name}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {displayTasks.length > 0 && (
              <div className="flex items-center gap-3">
                <Button onClick={handleConfirm} className="rounded-xl font-display" size="sm">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {adjustMode ? 'Confirm Route' : 'Looks good'}
                </Button>
                {!adjustMode && (
                  <Button variant="outline" onClick={() => setAdjustMode(true)} className="rounded-xl text-xs" size="sm">
                    Let me adjust
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <TaskDetailDrawer
        task={drawerTask}
        open={!!drawerTask}
        onClose={() => setDrawerTask(null)}
        onUpdate={(id, updates) => updateTask.mutate({ id, ...updates } as any)}
        onDelete={(id) => deleteTask.mutate(id)}
        projects={projects}
      />
    </AppShell>
  );
}
