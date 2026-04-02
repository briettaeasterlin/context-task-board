import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { getNextAvailableColor } from '@/lib/tube-colors';
import { toast } from 'sonner';
import { format } from 'date-fns';
import logoSrc from '@/assets/nextmove-logo-dark.svg';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const { projects, createProject } = useProjects();
  const { tasks, createTask } = useTasks();

  const [projectName, setProjectName] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [createdProject, setCreatedProject] = useState<{ id: string; name: string; color: string } | null>(null);
  const [createdTask, setCreatedTask] = useState<{ title: string } | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const skipToToday = useCallback(() => {
    localStorage.setItem('nextmove_onboarded', 'true');
    navigate('/today');
  }, [navigate]);

  const handleCreateProject = useCallback(async () => {
    if (!projectName.trim()) return;
    const color = getNextAvailableColor(projects.map(p => p.line_color));
    try {
      const result = await createProject.mutateAsync({ name: projectName.trim(), line_color: color } as any);
      setCreatedProject({ id: result.id, name: result.name, color: result.line_color ?? color });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setStep(4);
    } catch (e) {
      toast.error('Failed to create project');
    }
  }, [projectName, projects, createProject, queryClient]);

  const handleCreateTask = useCallback(async () => {
    if (!taskTitle.trim() || !createdProject) return;
    try {
      await createTask.mutateAsync({
        title: taskTitle.trim(),
        area: 'Personal',
        status: 'Next',
        context: null,
        notes: null,
        tags: [],
        project_id: createdProject.id,
        milestone_id: null,
        blocked_by: null,
        source: null,
        due_date: null,
        target_window: null,
        planned_date: todayStr,
      });
      setCreatedTask({ title: taskTitle.trim() });
      setStep(5);
    } catch (e) {
      toast.error('Failed to create task');
    }
  }, [taskTitle, createdProject, createTask, todayStr]);

  const handleFinish = useCallback(() => {
    localStorage.setItem('nextmove_onboarded', 'true');
    navigate('/today');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              s <= step ? "bg-accent scale-110" : "bg-muted"
            )} />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6 animate-fade-in">
            <img src={logoSrc} alt="NextMove" className="h-16 w-16 mx-auto" />
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Welcome to NextMove.</h1>
              <p className="text-muted-foreground mt-3 text-lg">Your AI-powered execution system.</p>
              <p className="text-sm text-muted-foreground mt-2">Three touches a day. That's all it takes.</p>
            </div>
            <Button onClick={() => setStep(2)} className="rounded-xl font-display px-8" size="lg" style={{ backgroundColor: '#3FAFA4' }}>
              Let's go <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <div>
              <button onClick={skipToToday} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Skip setup →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: The Loop */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-2xl font-display font-bold">The Daily Loop</h2>
              <p className="text-sm text-muted-foreground mt-2">Three simple touches keep everything moving.</p>
            </div>

            <div className="relative ml-8">
              {/* Vertical tube line */}
              <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-[#0098D4] via-[#E32017] to-[#003688]" />
              
              <div className="space-y-8">
                <div className="flex items-start gap-4 relative">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 z-10 mt-0.5" style={{ backgroundColor: '#0098D4' }} />
                  <div>
                    <p className="font-display font-bold text-sm">Today</p>
                    <p className="text-xs text-muted-foreground mt-0.5">See your plan, do your work</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 relative">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 z-10 mt-0.5" style={{ backgroundColor: '#E32017' }} />
                  <div>
                    <p className="font-display font-bold text-sm">Plan</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Set tomorrow's moves</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 relative">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 z-10 mt-0.5" style={{ backgroundColor: '#003688' }} />
                  <div>
                    <p className="font-display font-bold text-sm">Review</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Reflect & improve</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              The app plans and reviews. Your AI executes and captures.<br />Together, they keep you moving.
            </p>

            <div className="flex flex-col items-center gap-2">
              <Button onClick={() => setStep(3)} className="rounded-xl font-display px-8" size="sm">
                Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <button onClick={skipToToday} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Skip setup →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Create first project */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-2xl font-display font-bold">Create your first line.</h2>
              <p className="text-sm text-muted-foreground mt-2">What are you working on?</p>
            </div>

            <div className="space-y-3">
              <Input
                placeholder='e.g., "Job Search", "Product Launch", "Side Project"'
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="rounded-xl text-sm"
                onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                autoFocus
              />
              <Button
                onClick={handleCreateProject}
                disabled={!projectName.trim() || createProject.isPending}
                className="w-full rounded-xl font-display"
                size="sm"
              >
                Create Line <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>

            <div className="text-center">
              <button onClick={skipToToday} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Skip setup →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Add first task */}
        {step === 4 && createdProject && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: createdProject.color }} />
                <span className="font-display font-bold text-sm">{createdProject.name}</span>
              </div>
              <h2 className="text-2xl font-display font-bold">Nice — {createdProject.name} is on the map.</h2>
              <p className="text-sm text-muted-foreground mt-2">What's one thing you need to do for it?</p>
            </div>

            <div className="space-y-3">
              <Input
                placeholder='e.g., "Update my resume", "Set up landing page"'
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                className="rounded-xl text-sm"
                onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                autoFocus
              />
              <Button
                onClick={handleCreateTask}
                disabled={!taskTitle.trim() || createTask.isPending}
                className="w-full rounded-xl font-display"
                size="sm"
              >
                Add to Route <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>

            <div className="text-center">
              <button onClick={skipToToday} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Skip setup →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Your first move */}
        {step === 5 && createdProject && createdTask && (
          <div className="space-y-6 animate-fade-in text-center">
            <div>
              <h2 className="text-2xl font-display font-bold">Your route is set.</h2>
            </div>

            <Card className="rounded-xl overflow-hidden mx-auto max-w-sm">
              <div className="flex items-stretch">
                <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: createdProject.color }} />
                <div className="flex items-center gap-3 p-4 flex-1">
                  <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: createdProject.color }} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{createdTask.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{createdProject.name}</p>
                  </div>
                </div>
              </div>
            </Card>

            <p className="text-sm text-muted-foreground">
              This is your first move. When you finish it,<br />mark it done — and feel the progress.
            </p>

            <Button onClick={handleFinish} className="rounded-xl font-display px-8" size="lg" style={{ backgroundColor: '#3FAFA4' }}>
              Start My Day <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
