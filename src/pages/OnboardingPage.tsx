import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TaskArea } from '@/types/task';

const INITIATIVE_EXAMPLES = [
  { emoji: '🚀', label: 'Launching a product' },
  { emoji: '💼', label: 'Running a consulting business' },
  { emoji: '🏡', label: 'Managing personal projects' },
  { emoji: '👨‍👩‍👦', label: 'Family and home life' },
];

interface Initiative {
  name: string;
  emoji: string;
  projects: { name: string }[];
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { createProject } = useProjects();
  const { createTask } = useTasks();

  const [step, setStep] = useState(1);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [newInitiative, setNewInitiative] = useState('');
  const [tasks, setTasks] = useState<{ title: string; projectIndex: number }[]>([]);
  const [newTask, setNewTask] = useState('');
  const [focusIds, setFocusIds] = useState<Set<number>>(new Set());

  const addInitiative = () => {
    if (!newInitiative.trim() || initiatives.length >= 5) return;
    setInitiatives(prev => [...prev, { name: newInitiative.trim(), emoji: '📌', projects: [] }]);
    setNewInitiative('');
  };

  const removeInitiative = (i: number) => {
    setInitiatives(prev => prev.filter((_, idx) => idx !== i));
  };

  const addProject = (initIndex: number, name: string) => {
    setInitiatives(prev => prev.map((init, i) =>
      i === initIndex ? { ...init, projects: [...init.projects, { name }] } : init
    ));
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { title: newTask.trim(), projectIndex: 0 }]);
    setNewTask('');
  };

  const toggleFocus = (i: number) => {
    setFocusIds(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else if (next.size < 6) next.add(i);
      return next;
    });
  };

  const handleComplete = useCallback(async () => {
    try {
      // Create projects for each initiative's projects
      const allProjects: { name: string; area: TaskArea }[] = [];
      for (const init of initiatives) {
        for (const proj of init.projects) {
          allProjects.push({ name: proj.name, area: 'Personal' });
        }
        // Also create the initiative itself as a project if no sub-projects
        if (init.projects.length === 0) {
          allProjects.push({ name: init.name, area: 'Personal' });
        }
      }

      for (const proj of allProjects) {
        await createProject.mutateAsync({ name: proj.name, area: proj.area, summary: null, scope_notes: null });
      }

      // Create tasks
      for (let i = 0; i < tasks.length; i++) {
        const isFocus = focusIds.has(i);
        await createTask.mutateAsync({
          title: tasks[i].title,
          area: 'Personal',
          status: isFocus ? 'Next' : 'Backlog',
          context: null,
          notes: null,
          tags: [],
          project_id: null,
          milestone_id: null,
          blocked_by: null,
          source: null,
          due_date: null,
          target_window: null,
        });
      }

      toast.success('Welcome to VectorHQ! 🎯');
      navigate('/today');
    } catch (e: any) {
      toast.error(e.message || 'Setup failed');
    }
  }, [initiatives, tasks, focusIds, createProject, createTask, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn(
              "w-3 h-3 rounded-full transition-colors",
              s <= step ? "bg-accent" : "bg-muted"
            )} />
          ))}
        </div>

        {/* Step 1: Initiatives */}
        {step === 1 && (
          <Card className="p-8 rounded-2xl shadow-elevated animate-fade-in">
            <h2 className="font-display text-2xl font-bold mb-2">What are the major things you're working toward?</h2>
            <p className="text-sm text-muted-foreground mb-6">These are your initiatives — the big areas of focus in your life right now.</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {INITIATIVE_EXAMPLES.map(ex => (
                <button
                  key={ex.label}
                  onClick={() => {
                    if (initiatives.length < 5 && !initiatives.find(i => i.name === ex.label)) {
                      setInitiatives(prev => [...prev, { name: ex.label, emoji: ex.emoji, projects: [] }]);
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted/50 transition-colors"
                >
                  {ex.emoji} {ex.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Add your own..."
                value={newInitiative}
                onChange={e => setNewInitiative(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addInitiative()}
                className="rounded-xl"
              />
              <Button onClick={addInitiative} size="icon" variant="outline" className="rounded-xl shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 mb-6">
              {initiatives.map((init, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
                  <span>{init.emoji}</span>
                  <span className="text-sm font-medium flex-1">{init.name}</span>
                  <button onClick={() => removeInitiative(i)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <Button onClick={() => setStep(2)} disabled={initiatives.length === 0} className="w-full rounded-xl font-display">
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Card>
        )}

        {/* Step 2: Projects */}
        {step === 2 && (
          <Card className="p-8 rounded-2xl shadow-elevated animate-fade-in">
            <h2 className="font-display text-2xl font-bold mb-2">Break each initiative into projects.</h2>
            <p className="text-sm text-muted-foreground mb-6">Projects are the concrete workstreams within each initiative.</p>

            <div className="space-y-6 mb-6">
              {initiatives.map((init, initIdx) => (
                <InitiativeProjectInput
                  key={initIdx}
                  initiative={init}
                  onAddProject={(name) => addProject(initIdx, name)}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 rounded-xl font-display">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Tasks */}
        {step === 3 && (
          <Card className="p-8 rounded-2xl shadow-elevated animate-fade-in">
            <h2 className="font-display text-2xl font-bold mb-2">What are the first tasks you should complete?</h2>
            <p className="text-sm text-muted-foreground mb-6">Just brain-dump a few tasks to get started.</p>

            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Add a task..."
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                className="rounded-xl"
              />
              <Button onClick={addTask} size="icon" variant="outline" className="rounded-xl shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 mb-6">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
                  <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 flex-shrink-0" />
                  <span className="text-sm flex-1">{task.title}</span>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No tasks yet. Add your first task above.</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(4)} disabled={tasks.length === 0} className="flex-1 rounded-xl font-display">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4: Plan Week */}
        {step === 4 && (
          <Card className="p-8 rounded-2xl shadow-elevated animate-fade-in">
            <h2 className="font-display text-2xl font-bold mb-2">What do you want to accomplish this week?</h2>
            <p className="text-sm text-muted-foreground mb-6">Mark 3–6 tasks to focus on this week.</p>

            <div className="space-y-2 mb-6">
              {tasks.map((task, i) => {
                const isFocused = focusIds.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleFocus(i)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl w-full text-left transition-all",
                      isFocused ? "bg-accent/10 border-2 border-accent" : "bg-muted/30 border-2 border-transparent hover:border-muted"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                      isFocused ? "bg-accent text-accent-foreground" : "border-2 border-muted-foreground/30"
                    )}>
                      {isFocused && <Check className="h-3 w-3" />}
                    </div>
                    <span className="text-sm font-medium">{task.title}</span>
                    {isFocused && <Badge className="ml-auto text-[10px] bg-accent/20 text-accent border-0">Focus</Badge>}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center mb-4">
              {focusIds.size} of {tasks.length} selected
            </p>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={handleComplete} disabled={focusIds.size === 0} className="flex-1 rounded-xl font-display font-semibold">
                Launch VectorHQ 🚀
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function InitiativeProjectInput({ initiative, onAddProject }: { initiative: Initiative; onAddProject: (name: string) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    if (!input.trim()) return;
    onAddProject(input.trim());
    setInput('');
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span>{initiative.emoji}</span>
        <h3 className="font-display font-semibold text-sm">{initiative.name}</h3>
      </div>
      <div className="ml-6 space-y-2">
        {initiative.projects.map((p, i) => (
          <div key={i} className="text-sm text-muted-foreground flex items-center gap-2 p-2 rounded-lg bg-muted/20">
            <span className="text-xs">📁</span> {p.name}
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="Add a project..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            className="h-8 text-xs rounded-lg"
          />
          <Button onClick={add} size="sm" variant="ghost" className="h-8 text-xs">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
