import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, Check, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIImportPanel } from '@/components/import/AIImportPanel';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const { projects } = useProjects();
  const { tasks, updateTask } = useTasks();

  // Step 2: active project selection
  const [activeProjectIds, setActiveProjectIds] = useState<Set<string>>(new Set());

  // Step 3: selected tasks for today's route
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // When moving to step 2 after import, pre-select projects
  const handleImportComplete = useCallback(() => {
    setTimeout(() => {
      queryClient.invalidateQueries();
      setStep(2);
    }, 500);
  }, [queryClient]);

  // When entering step 2, auto-select all projects (up to 6)
  const handleEnterStep2 = useCallback(() => {
    const ids = new Set(projects.slice(0, 6).map(p => p.id));
    setActiveProjectIds(ids);
    setStep(2);
  }, [projects]);

  // When entering step 3, suggest tasks from active projects
  const suggestedTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'Next' || t.status === 'Today' || t.status === 'Backlog')
      .filter(t => !t.project_id || activeProjectIds.has(t.project_id))
      .sort((a, b) => {
        // Prioritize Next, then Today, then Backlog
        const statusOrder: Record<string, number> = { Next: 0, Today: 1, Backlog: 2 };
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      })
      .slice(0, 8);
  }, [tasks, activeProjectIds]);

  const handleEnterStep3 = useCallback(() => {
    const ids = new Set(suggestedTasks.slice(0, 5).map(t => t.id));
    setSelectedTaskIds(ids);
    setStep(3);
  }, [suggestedTasks]);

  const handleConfirmRoute = useCallback(async () => {
    // Mark selected tasks as "Next" (today's route)
    for (const id of selectedTaskIds) {
      updateTask.mutate({ id, status: 'Next' });
    }
    toast.success('Route plotted. You\'re ready.');
    setStep(4);
  }, [selectedTaskIds, updateTask]);

  const toggleProject = (id: string) => {
    setActiveProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTask = (id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn(
              "w-3 h-3 rounded-full transition-colors",
              s <= step ? "bg-accent" : "bg-muted"
            )} />
          ))}
        </div>

        {/* ── STEP 1: Import ── */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">What are you currently working on?</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Paste a task list, project ideas, or notes. Or copy this prompt into ChatGPT or Claude and paste back the result.
              </p>
            </div>

            <AIImportPanel source="onboarding" onImportComplete={handleImportComplete} compact />

            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setStep(2)}
            >
              Skip — I'll add things manually
            </Button>
          </div>
        )}

        {/* ── STEP 2: Identify Active Projects ── */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">Which initiatives are currently active?</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Select the projects you're actively working on. Unselected projects move to the background.
              </p>
            </div>

            {projects.length === 0 ? (
              <Card className="p-6 rounded-2xl shadow-card text-center">
                <p className="text-sm text-muted-foreground">No projects imported yet. Continue to set up your first route.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {projects.map(p => (
                  <Card
                    key={p.id}
                    className={cn(
                      "p-4 rounded-xl cursor-pointer transition-all duration-150 hover:translate-x-px",
                      activeProjectIds.has(p.id)
                        ? "border-accent/40 bg-mint/10 shadow-card"
                        : "shadow-card"
                    )}
                    onClick={() => toggleProject(p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={activeProjectIds.has(p.id)}
                        onCheckedChange={() => toggleProject(p.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.summary && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.summary}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] rounded-full">{p.area}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={handleEnterStep3} className="flex-1 rounded-xl font-display">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Plot Today's Route ── */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">Here's your first route.</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                NextMove suggests these tasks to start with. Confirm, edit, or remove.
              </p>
            </div>

            {suggestedTasks.length === 0 ? (
              <Card className="p-6 rounded-2xl shadow-card text-center">
                <p className="text-sm text-muted-foreground">No tasks to suggest yet. You can add them after setup.</p>
              </Card>
            ) : (
              <Card className="p-5 rounded-2xl shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Navigation className="h-4 w-4 text-accent" />
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Today's Route</span>
                </div>
                <div className="relative ml-2">
                  <div className="absolute left-[3px] top-1 bottom-1 w-px bg-mint" />
                  <div className="space-y-2.5">
                    {suggestedTasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 relative cursor-pointer"
                        onClick={() => toggleTask(task.id)}
                      >
                        <span className={cn(
                          'relative z-10 w-[7px] h-[7px] rounded-full border-2 flex-shrink-0',
                          selectedTaskIds.has(task.id)
                            ? 'border-accent bg-accent'
                            : 'border-primary/40 bg-background'
                        )} />
                        <span className={cn(
                          "text-sm flex-1 truncate",
                          selectedTaskIds.has(task.id) ? 'text-foreground' : 'text-muted-foreground'
                        )}>{task.title}</span>
                        <Checkbox
                          checked={selectedTaskIds.has(task.id)}
                          onCheckedChange={() => toggleTask(task.id)}
                          className="shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={handleConfirmRoute} className="flex-1 rounded-xl font-display">
                Confirm route <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Start Moving ── */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">Your route is ready.</h2>
              <p className="text-sm text-muted-foreground mt-2">
                NextMove has organized your work. Here's where to go.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card
                className="p-6 rounded-2xl shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer text-center"
                onClick={() => navigate('/today')}
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-accent bg-accent/10 mx-auto mb-3">
                  <Navigation className="h-5 w-5 text-accent" />
                </span>
                <h3 className="font-display font-semibold mb-1">Start your route</h3>
                <p className="text-xs text-muted-foreground mb-3">See today's stops and begin moving.</p>
                <Button size="sm" className="rounded-xl font-display text-xs">
                  Go to Today <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Card>

              <Card
                className="p-6 rounded-2xl shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer text-center"
                onClick={() => navigate('/projects')}
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary/30 bg-muted mx-auto mb-3">
                  <Check className="h-5 w-5 text-primary" />
                </span>
                <h3 className="font-display font-semibold mb-1">Explore NextMove</h3>
                <p className="text-xs text-muted-foreground mb-3">Browse your projects and plan ahead.</p>
                <Button variant="outline" size="sm" className="rounded-xl font-display text-xs">
                  View Projects <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
