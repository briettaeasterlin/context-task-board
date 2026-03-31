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
import { CheckCircle2, ArrowRight, X, Plus, Search, GripVertical, Clock, Sparkles, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { scoreTasks } from '@/lib/task-scoring';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';

type PlanStep = 'suggest' | 'adjust' | 'confirmed';

export default function PlanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks, updateTask, deleteTask } = useTasks();
  const { projects, milestones } = useProjects();
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

  // AI-suggested tasks based on priority scoring
  const suggestedTasks = useMemo(() => {
    const candidates = tasks.filter(t =>
      t.status !== 'Done' && t.status !== 'Someday' && t.status !== 'Closing' &&
      !t.planned_date // not already planned
    );
    // Prioritize: due dates, 'Next' status, incomplete Today tasks
    const todayIncomplete = candidates.filter(t => t.status === 'Today');
    const nextTasks = candidates.filter(t => t.status === 'Next');
    const withDueDates = candidates.filter(t => t.due_date && t.status !== 'Today' && t.status !== 'Next');
    
    const scored = scoreTasks([...todayIncomplete, ...nextTasks, ...withDueDates], tasks);
    return scored.slice(0, 5);
  }, [tasks]);

  // Initialize selected tasks from suggestions
  const displayTasks = useMemo(() => {
    if (step === 'confirmed') return existingPlan;
    if (selectedTasks.length > 0) return selectedTasks;
    return suggestedTasks.slice(0, 3);
  }, [step, selectedTasks, suggestedTasks, existingPlan]);

  // Backlog tasks for adjustment
  const backlogTasks = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    const selectedIds = new Set(displayTasks.map(t => t.id));
    return tasks
      .filter(t => t.status !== 'Done' && !selectedIds.has(t.id) && t.title.toLowerCase().includes(q))
      .slice(0, 10);
  }, [tasks, search, displayTasks]);

  const estimatedMinutes = displayTasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);

  const handleConfirm = useCallback(async () => {
    const tasksToConfirm = selectedTasks.length > 0 ? selectedTasks : suggestedTasks.slice(0, 3);
    for (const task of tasksToConfirm) {
      await updateTask.mutateAsync({ id: task.id, planned_date: tomorrowStr, status: task.status === 'Backlog' ? 'Next' : task.status } as any);
    }
    setStep('confirmed');
    toast.success(`Tomorrow is set. ${tasksToConfirm.length} moves locked in.`);
  }, [selectedTasks, suggestedTasks, updateTask, tomorrowStr]);

  const handleAddTask = useCallback((task: Task) => {
    setSelectedTasks(prev => {
      const existing = prev.length > 0 ? prev : suggestedTasks.slice(0, 3);
      if (existing.find(t => t.id === task.id)) return existing;
      return [...existing, task];
    });
    setSearch('');
  }, [suggestedTasks]);

  const handleRemoveTask = useCallback((taskId: string) => {
    setSelectedTasks(prev => {
      const existing = prev.length > 0 ? prev : suggestedTasks.slice(0, 3);
      return existing.filter(t => t.id !== taskId);
    });
  }, [suggestedTasks]);

  const handleAdjust = useCallback(() => {
    if (step === 'confirmed') {
      // Re-enter planning mode
      setSelectedTasks(existingPlan);
      setStep('suggest');
    }
    setAdjustMode(true);
  }, [step, existingPlan]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Confirmed state */}
        {step === 'confirmed' && (
          <>
            <Card className="p-6 sm:p-8 rounded-2xl bg-[hsl(var(--mint)/0.15)] border-accent/20 text-center">
              <Moon className="h-8 w-8 text-accent mx-auto mb-3 opacity-60" />
              <h1 className="text-2xl font-display font-bold">Tomorrow is ready.</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {existingPlan.length} move{existingPlan.length !== 1 ? 's' : ''} locked in.
                {estimatedMinutes > 0 && ` Estimated: ${estimatedMinutes >= 60 ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ''}` : `${estimatedMinutes}m`}.`}
              </p>
              <p className="text-xs text-muted-foreground mt-3 font-mono">Close your laptop. You're good.</p>
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
                    <Card key={task.id} className="rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 p-4">
                        {taskProject?.line_color && (
                          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                        )}
                        <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                        <span className="text-sm font-medium flex-1">{task.title}</span>
                        {taskProject && (
                          <Badge variant="outline" className="text-[10px] rounded-full" style={{ borderColor: taskProject.line_color ?? undefined, color: taskProject.line_color ?? undefined }}>
                            {taskProject.name}
                          </Badge>
                        )}
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
                Here's what would move things forward:
              </p>
            </div>

            {/* Suggested / selected tasks */}
            <div className="space-y-2">
              {displayTasks.map((task, idx) => {
                const taskProject = projectMap.get(task.project_id ?? '');
                return (
                  <Card key={task.id} className="rounded-xl overflow-hidden group">
                    <div className="flex items-center gap-3 p-4">
                      {taskProject?.line_color && (
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: taskProject.line_color }} />
                      )}
                      <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {taskProject && (
                          <p className="text-xs text-muted-foreground mt-0.5">{taskProject.name}</p>
                        )}
                      </div>
                      {task.estimated_minutes && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />{task.estimated_minutes}m
                        </span>
                      )}
                      {adjustMode && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100"
                          onClick={() => handleRemoveTask(task.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

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
                  <div className="border rounded-xl divide-y">
                    {backlogTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleAddTask(task)}>
                        <Plus className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                        <span className="text-sm flex-1 truncate">{task.title}</span>
                        <Badge variant="outline" className="text-[10px] rounded-full">{task.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
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
          </>
        )}
      </div>
    </AppShell>
  );
}
