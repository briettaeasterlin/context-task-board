import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Clock, ArrowLeft, Loader2, Sparkles,
  AlertTriangle, Target, Trash2, PauseCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import type { Task, Project, TaskUpdate } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';

interface SuggestedAction {
  label: string;
  newStatus: 'Today' | 'Next' | 'Waiting' | 'Backlog' | 'Closing' | 'Done' | 'Remove';
  requiresInput?: boolean;
  inputLabel?: string;
}

interface TaskQuestion {
  taskId: string;
  taskTitle: string;
  currentStatus: string;
  reason: string;
  suggestedActions: SuggestedAction[];
}

interface ProjectSummary {
  projectId: string;
  projectName: string;
  momentum: string;
  bottlenecks?: string;
  strategicQuestions?: { question: string; options: string[] }[];
}

interface FocusItem {
  taskId: string;
  taskTitle: string;
  projectName: string;
  rationale: string;
}

interface ReviewData {
  projectSummaries: ProjectSummary[];
  taskQuestions: TaskQuestion[];
  suggestedFocus: FocusItem[];
  overallInsight: string;
}

interface Props {
  tasks: Task[];
  projects: Project[];
  onUpdate: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type ReviewStep = 'loading' | 'tasks' | 'projects' | 'focus' | 'done';

export function StatusReviewPanel({ tasks, projects, onUpdate, onDelete, onClose }: Props) {
  const [step, setStep] = useState<ReviewStep>('loading');
  const [review, setReview] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [focusAccepted, setFocusAccepted] = useState(false);
  const [changes, setChanges] = useState<{ taskId: string; action: string }[]>([]);

  const startReview = useCallback(async () => {
    setStep('loading');
    setError(null);
    try {
      const payload = {
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          area: t.area,
          project_id: t.project_id,
          blocked_by: t.blocked_by,
          context: t.context,
          notes: t.notes,
          due_date: t.due_date,
          updated_at: t.updated_at,
          created_at: t.created_at,
        })),
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          area: p.area,
          summary: p.summary,
          scope_notes: p.scope_notes,
        })),
      };

      const { data, error: fnError } = await supabase.functions.invoke('ai-status-review', { body: payload });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setReview(data);
      setStep(data.taskQuestions?.length > 0 ? 'tasks' : data.projectSummaries?.length > 0 ? 'projects' : 'focus');
    } catch (e: any) {
      console.error('Review error:', e);
      setError(e.message || 'Failed to generate review');
      setStep('loading');
    }
  }, [tasks, projects]);

  // Auto-start on mount
  useState(() => { startReview(); });

  const handleTaskAction = useCallback((taskId: string, action: SuggestedAction) => {
    if (action.requiresInput && !inputValues[`${taskId}-${action.label}`]) {
      // Show input first
      return;
    }

    if (action.newStatus === 'Remove') {
      onDelete(taskId);
      toast.success('Task removed');
    } else {
      const updates: TaskUpdate = { status: action.newStatus };
      if (action.newStatus === 'Waiting' && inputValues[`${taskId}-${action.label}`]) {
        updates.blocked_by = inputValues[`${taskId}-${action.label}`];
      }
      if (action.label === 'Add note' && inputValues[`${taskId}-${action.label}`]) {
        const task = tasks.find(t => t.id === taskId);
        const existingNotes = task?.notes || '';
        updates.notes = existingNotes ? `${existingNotes}\n${inputValues[`${taskId}-${action.label}`]}` : inputValues[`${taskId}-${action.label}`];
      }
      onUpdate(taskId, updates);
      toast.success(`Task updated → ${action.newStatus}`);
    }

    setAnswered(prev => new Set([...prev, taskId]));
    setChanges(prev => [...prev, { taskId, action: action.label }]);
  }, [inputValues, onUpdate, onDelete, tasks]);

  const handleAcceptFocus = useCallback(() => {
    if (!review) return;
    const focusIds = new Set(review.suggestedFocus.map(f => f.taskId));
    // Set suggested tasks to Next, demote others that are Next but not in focus
    let changeCount = 0;
    for (const f of review.suggestedFocus) {
      const task = tasks.find(t => t.id === f.taskId);
      if (task && task.status !== 'Next') {
        onUpdate(f.taskId, { status: 'Next' });
        changeCount++;
      }
    }
    setFocusAccepted(true);
    toast.success(`Focus plan applied (${review.suggestedFocus.length} tasks)`);
    setStep('done');
  }, [review, tasks, onUpdate]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'Next': return <Target className="h-3.5 w-3.5 text-primary" />;
      case 'Waiting': return <PauseCircle className="h-3.5 w-3.5 text-status-waiting" />;
      case 'Done': return <CheckCircle2 className="h-3.5 w-3.5 text-status-done" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const actionVariant = (label: string): 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' => {
    if (label === 'Done') return 'default';
    if (label === 'Remove') return 'destructive';
    return 'outline';
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
          <h2 className="font-display text-sm font-semibold">VectorHQ AI Review</h2>
        </div>
        <Card className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={startReview}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
          <h2 className="font-display text-sm font-semibold">VectorHQ AI Review</h2>
        </div>
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Analyzing {tasks.length} tasks across {projects.length} projects…</p>
          <p className="text-xs text-muted-foreground mt-1">This takes ~10 seconds</p>
        </Card>
      </div>
    );
  }

  if (!review) return null;

  const unansweredTasks = review.taskQuestions.filter(q => !answered.has(q.taskId));
  const progressPct = review.taskQuestions.length > 0
    ? Math.round(((review.taskQuestions.length - unansweredTasks.length) / review.taskQuestions.length) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">VectorHQ AI Review</h2>
        </div>
        <div className="flex items-center gap-2">
          {['tasks', 'projects', 'focus'].map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s as ReviewStep)}
              className={`font-mono text-xs px-2 py-1 rounded transition-colors ${step === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {i + 1}. {s === 'tasks' ? 'Tasks' : s === 'projects' ? 'Projects' : 'Focus'}
            </button>
          ))}
        </div>
      </div>

      {/* Overall insight */}
      <Card className="p-3 bg-accent/50 border-accent">
        <p className="text-xs text-accent-foreground">{review.overallInsight}</p>
      </Card>

      {/* Progress bar */}
      {step === 'tasks' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{review.taskQuestions.length - unansweredTasks.length} of {review.taskQuestions.length} reviewed</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Step: Task Questions */}
      {step === 'tasks' && (
        <div className="space-y-3">
          {review.taskQuestions.map(q => {
            const isAnswered = answered.has(q.taskId);
            return (
              <Card key={q.taskId} className={`p-4 transition-opacity ${isAnswered ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-2 mb-2">
                  {statusIcon(q.currentStatus)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{q.taskTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Currently: <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">{q.currentStatus}</Badge>
                    </p>
                  </div>
                  {isAnswered && <CheckCircle2 className="h-4 w-4 text-status-done shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mb-3 pl-5">{q.reason}</p>
                {!isAnswered && (
                  <div className="pl-5 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {q.suggestedActions.map(action => {
                        const inputKey = `${q.taskId}-${action.label}`;
                        const needsInput = action.requiresInput && !inputValues[inputKey];
                        return (
                          <Button
                            key={action.label}
                            variant={actionVariant(action.label)}
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              if (needsInput) {
                                setInputValues(prev => ({ ...prev, [inputKey]: '' }));
                              } else {
                                handleTaskAction(q.taskId, action);
                              }
                            }}
                          >
                            {action.label === 'Done' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {action.label === 'Remove' && <Trash2 className="h-3 w-3 mr-1" />}
                            {action.label === 'Waiting' && <PauseCircle className="h-3 w-3 mr-1" />}
                            {action.label}
                          </Button>
                        );
                      })}
                    </div>
                    {/* Expanded inputs */}
                    {q.suggestedActions.filter(a => a.requiresInput && inputValues[`${q.taskId}-${a.label}`] !== undefined).map(action => {
                      const inputKey = `${q.taskId}-${action.label}`;
                      return (
                        <div key={inputKey} className="flex gap-2">
                          <Input
                            placeholder={action.inputLabel || 'Enter details...'}
                            className="text-xs h-7 flex-1"
                            value={inputValues[inputKey] || ''}
                            onChange={e => setInputValues(prev => ({ ...prev, [inputKey]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleTaskAction(q.taskId, action); }}
                          />
                          <Button size="sm" className="text-xs h-7" onClick={() => handleTaskAction(q.taskId, action)}>Save</Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          {unansweredTasks.length === 0 && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-6 w-6 text-status-done mx-auto mb-2" />
              <p className="text-sm font-medium">All tasks reviewed!</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => setStep('projects')}>
                Continue to Projects →
              </Button>
            </div>
          )}
          {unansweredTasks.length > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStep('projects')}>
                Skip to Projects →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step: Project Summaries */}
      {step === 'projects' && (
        <div className="space-y-3">
          {review.projectSummaries.map(ps => {
            const isExpanded = expandedProjects.has(ps.projectId);
            return (
              <Card key={ps.projectId} className="p-4">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setExpandedProjects(prev => {
                    const next = new Set(prev);
                    if (next.has(ps.projectId)) next.delete(ps.projectId);
                    else next.add(ps.projectId);
                    return next;
                  })}
                >
                  <div>
                    <h3 className="text-sm font-semibold">{ps.projectName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{ps.momentum}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    {ps.bottlenecks && (
                      <div className="flex gap-2 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 text-status-waiting shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{ps.bottlenecks}</span>
                      </div>
                    )}
                    {ps.strategicQuestions?.map((sq, i) => (
                      <div key={i} className="space-y-1.5">
                        <p className="text-xs font-medium">{sq.question}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {sq.options.map(opt => (
                            <Button key={opt} variant="outline" size="sm" className="text-xs h-7"
                              onClick={() => toast.info(`Noted: ${opt}`)}>
                              {opt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setStep('focus')}>
              Continue to Focus Plan →
            </Button>
          </div>
        </div>
      )}

      {/* Step: Suggested Focus */}
      {step === 'focus' && (
        <div className="space-y-3">
          <h3 className="font-mono text-xs font-semibold text-muted-foreground">Suggested Focus — Next 14 Days</h3>
          {review.suggestedFocus.map((f, i) => (
            <Card key={f.taskId} className="p-3 flex items-start gap-3">
              <span className="font-mono text-xs font-bold text-primary mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{f.taskTitle}</p>
                <p className="text-xs text-muted-foreground">{f.projectName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 italic">{f.rationale}</p>
              </div>
            </Card>
          ))}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setStep('done'); toast.info('Focus plan skipped'); }}>
              Ignore
            </Button>
            <Button size="sm" className="text-xs" onClick={handleAcceptFocus}>
              <Target className="h-3 w-3 mr-1" /> Accept Focus Plan
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-status-done mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">Review Complete</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {changes.length} task{changes.length !== 1 ? 's' : ''} updated during this review.
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>Back to Dashboard</Button>
        </Card>
      )}
    </div>
  );
}
