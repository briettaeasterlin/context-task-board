import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { Project, TaskArea, TaskStatus, Milestone, Task } from '@/types/task';
import { AREAS, STATUSES, UPDATE_SOURCES } from '@/types/task';
import { AreaBadge } from '@/components/task/AreaBadge';
import { StatusBadge } from '@/components/task/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Sparkles, Check, X, Pencil, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ExtractedTask {
  title: string;
  area: TaskArea;
  status: TaskStatus;
  context: string | null;
  blockedBy: string | null;
  projectId: string | null;
  milestoneId: string | null;
  selected: boolean;
}

interface ExtractedUpdate {
  description: string;
  matchHint: string | null;
  newStatus: TaskStatus | null;
  blockedBy: string | null;
  matchedTaskId: string | null;
  selected: boolean;
}

interface ExtractedQuestion {
  question: string;
  reason: string | null;
  suggestedOptions: string[] | null;
  selected: boolean;
}

interface ExtractResult {
  summary: string | null;
  extractedTasks: ExtractedTask[];
  taskUpdates: ExtractedUpdate[];
  extractedClarifyQuestions: ExtractedQuestion[];
}

interface Props {
  projects: Project[];
  milestones?: Milestone[];
  existingTasks?: Task[];
  defaultProjectId?: string;
  onCreated?: () => void;
}

export function UpdateForm({ projects, milestones = [], existingTasks = [], defaultProjectId, onCreated }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [source, setSource] = useState<string>('chatgpt');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Fuzzy match: find existing task whose title best matches a hint
  const fuzzyMatchTask = (hint: string | null): Task | undefined => {
    if (!hint) return undefined;
    const lower = hint.toLowerCase();
    // Exact substring match first
    const exact = existingTasks.find(t => t.title.toLowerCase().includes(lower));
    if (exact) return exact;
    // Word overlap match
    const hintWords = lower.split(/\s+/);
    let bestTask: Task | undefined;
    let bestScore = 0;
    for (const task of existingTasks) {
      const titleWords = task.title.toLowerCase().split(/\s+/);
      const score = hintWords.filter(w => titleWords.some(tw => tw.includes(w) || w.includes(tw))).length;
      if (score > bestScore && score >= Math.ceil(hintWords.length * 0.4)) {
        bestScore = score;
        bestTask = task;
      }
    }
    return bestTask;
  };

  const handleExtract = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const project = projects.find(p => p.id === projectId);
      const existingTaskTitles = existingTasks.map(t => t.title);
      const { data, error } = await supabase.functions.invoke('ai-extract', {
        body: {
          rawText: content,
          projectId: projectId || null,
          projectName: project?.name || null,
          source: source || null,
          existingTaskTitles,
          existingProjects: projects.map(p => ({ id: p.id, name: p.name })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({
        summary: data.summary,
        extractedTasks: (data.extractedTasks || []).map((t: any) => ({
          ...t,
          area: t.area || 'Personal',
          status: t.status || 'Backlog',
          context: t.context || null,
          blockedBy: t.blockedBy || null,
          projectId: t.projectId || projectId || null,
          milestoneId: t.milestoneId || null,
          selected: true,
        })),
        taskUpdates: (data.taskUpdates || []).map((u: any) => {
          const matched = fuzzyMatchTask(u.matchHint);
          return {
            description: u.description,
            matchHint: u.matchHint || null,
            newStatus: u.newStatus || null,
            blockedBy: u.blockedBy || null,
            matchedTaskId: matched?.id || null,
            selected: !!matched, // auto-select only if we found a match
          };
        }),
        extractedClarifyQuestions: (data.extractedClarifyQuestions || []).map((q: any) => ({
          ...q,
          reason: q.reason || null,
          suggestedOptions: q.suggestedOptions || null,
          selected: true,
        })),
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to extract');
    }
    setLoading(false);
  };

  const toggleTask = (idx: number) => {
    setResult(prev => prev ? { ...prev, extractedTasks: prev.extractedTasks.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t) } : null);
  };

  const toggleUpdate = (idx: number) => {
    setResult(prev => prev ? { ...prev, taskUpdates: prev.taskUpdates.map((u, i) => i === idx ? { ...u, selected: !u.selected } : u) } : null);
  };

  const toggleQuestion = (idx: number) => {
    setResult(prev => prev ? { ...prev, extractedClarifyQuestions: prev.extractedClarifyQuestions.map((q, i) => i === idx ? { ...q, selected: !q.selected } : q) } : null);
  };

  const updateTaskField = (idx: number, field: string, value: any) => {
    setResult(prev => prev ? { ...prev, extractedTasks: prev.extractedTasks.map((t, i) => i === idx ? { ...t, [field]: value } : t) } : null);
  };

  const handleConfirm = async () => {
    if (!result || !user) return;
    const selectedTasks = result.extractedTasks.filter(t => t.selected);
    const selectedUpdates = result.taskUpdates.filter(u => u.selected && u.matchedTaskId);
    const selectedQuestions = result.extractedClarifyQuestions.filter(q => q.selected);
    if (selectedTasks.length === 0 && selectedUpdates.length === 0 && selectedQuestions.length === 0) {
      toast.error('Select at least one item');
      return;
    }
    setSaving(true);
    try {
      // Save update record
      await supabase.from('updates').insert({
        user_id: user.id,
        project_id: projectId || null,
        source: source || null,
        content,
        extracted_summary: result.summary,
        extracted_tasks: selectedTasks,
      } as any);

      // Create selected tasks
      if (selectedTasks.length > 0) {
        const taskRows = selectedTasks.map(t => ({
          user_id: user.id,
          title: t.title,
          area: t.area,
          status: t.status,
          context: t.context,
          blocked_by: t.blockedBy,
          project_id: t.projectId,
          milestone_id: t.milestoneId,
          notes: null,
          tags: [],
          source: null,
        }));
        await supabase.from('tasks').insert(taskRows as any[]);
      }

      // Apply task updates (mark done, change status, etc.)
      if (selectedUpdates.length > 0) {
        const updatePromises = selectedUpdates.map(u => {
          const updates: Record<string, any> = {};
          if (u.newStatus) updates.status = u.newStatus;
          if (u.blockedBy) updates.blocked_by = u.blockedBy;
          return supabase.from('tasks').update(updates as any).eq('id', u.matchedTaskId!);
        });
        await Promise.all(updatePromises);
      }

      // Create selected clarify questions
      if (selectedQuestions.length > 0) {
        const resolvedProjectId = projectId || null;
        if (resolvedProjectId) {
          const qRows = selectedQuestions.map(q => ({
            user_id: user.id,
            project_id: resolvedProjectId,
            question: q.question,
            reason: q.reason,
            suggested_options: q.suggestedOptions,
            status: 'open',
          }));
          await supabase.from('clarify_questions').insert(qRows as any[]);
        }
      }

      const parts: string[] = [];
      if (selectedTasks.length > 0) parts.push(`${selectedTasks.length} tasks created`);
      if (selectedUpdates.length > 0) parts.push(`${selectedUpdates.length} tasks updated`);
      if (selectedQuestions.length > 0) parts.push(`${selectedQuestions.length} questions`);
      toast.success(parts.join(', '));
      onCreated?.();
      setContent('');
      setResult(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    setResult(null);
  };

  const projectMilestones = milestones.filter(m => {
    if (editingIdx === null || !result) return false;
    const task = result.extractedTasks[editingIdx];
    return task?.projectId ? m.project_id === task.projectId : false;
  });

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Paste an update</Label>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={5}
          className="font-mono text-xs"
          placeholder="Paste meeting notes, ChatGPT output, email updates..."
          maxLength={50000}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Link to project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {UPDATE_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 text-xs" onClick={handleExtract} disabled={loading || !content.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Extract tasks
        </Button>
      </div>

      {result && (
        <Card className="p-4 space-y-4 border-primary/30">
          {/* Summary */}
          {result.summary && (
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Summary</Label>
              <p className="text-xs mt-0.5">{result.summary}</p>
            </div>
          )}

          {/* Extracted Tasks */}
          {result.extractedTasks.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Extracted Tasks ({result.extractedTasks.filter(t => t.selected).length}/{result.extractedTasks.length} selected)
              </Label>
              <div className="mt-1.5 space-y-1.5">
                {result.extractedTasks.map((t, i) => (
                  <div key={i} className="border rounded-md p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={t.selected} onCheckedChange={() => toggleTask(i)} />
                      {editingIdx === i ? (
                        <Input value={t.title} onChange={e => updateTaskField(i, 'title', e.target.value)}
                          className="h-6 text-xs font-mono flex-1" />
                      ) : (
                        <span className={`text-xs font-mono flex-1 ${!t.selected ? 'line-through text-muted-foreground' : ''}`}>{t.title}</span>
                      )}
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingIdx(editingIdx === i ? null : i)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 ml-6">
                      {editingIdx === i ? (
                        <>
                          <Select value={t.area} onValueChange={v => updateTaskField(i, 'area', v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={t.status} onValueChange={v => updateTaskField(i, 'status', v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={t.projectId || 'none'} onValueChange={v => updateTaskField(i, 'projectId', v === 'none' ? null : v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[130px]"><SelectValue placeholder="Project" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No project</SelectItem>
                              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <>
                          <AreaBadge area={t.area} className="text-[10px]" />
                          <StatusBadge status={t.status} className="text-[10px]" />
                          {t.projectId && <span className="text-[10px] text-primary font-mono">{projects.find(p => p.id === t.projectId)?.name}</span>}
                        </>
                      )}
                    </div>
                    {editingIdx === i && (
                      <div className="ml-6">
                        <Input value={t.context || ''} onChange={e => updateTaskField(i, 'context', e.target.value || null)}
                          placeholder="Context..." className="h-6 text-[10px]" />
                      </div>
                    )}
                    {editingIdx !== i && t.context && (
                      <p className="text-[10px] text-muted-foreground ml-6">{t.context}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task Updates (mark done, change status) */}
          {result.taskUpdates.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <ArrowUpCircle className="h-3 w-3" /> Task Updates ({result.taskUpdates.filter(u => u.selected).length}/{result.taskUpdates.length} selected)
              </Label>
              <div className="mt-1.5 space-y-1.5">
                {result.taskUpdates.map((u, i) => {
                  const matchedTask = u.matchedTaskId ? existingTasks.find(t => t.id === u.matchedTaskId) : undefined;
                  return (
                    <div key={i} className="flex items-start gap-2 p-2 border rounded-md">
                      <Checkbox checked={u.selected} onCheckedChange={() => toggleUpdate(i)} className="mt-0.5" disabled={!u.matchedTaskId} />
                      <div className="flex-1">
                        <p className={`text-xs ${!u.selected ? 'line-through text-muted-foreground' : ''}`}>
                          {u.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {matchedTask ? (
                            <span className="text-[10px] text-primary font-mono">→ {matchedTask.title}</span>
                          ) : (
                            <span className="text-[10px] text-destructive">⚠ No matching task found{u.matchHint ? ` for "${u.matchHint}"` : ''}</span>
                          )}
                          {u.newStatus && <StatusBadge status={u.newStatus} className="text-[10px]" />}
                          {u.blockedBy && <span className="text-[10px] text-muted-foreground">⏳ {u.blockedBy}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.extractedClarifyQuestions.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Clarifying Questions ({result.extractedClarifyQuestions.filter(q => q.selected).length}/{result.extractedClarifyQuestions.length} selected)
              </Label>
              <div className="mt-1.5 space-y-1">
                {result.extractedClarifyQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 border rounded-md">
                    <Checkbox checked={q.selected} onCheckedChange={() => toggleQuestion(i)} className="mt-0.5" />
                    <div>
                      <p className={`text-xs ${!q.selected ? 'line-through text-muted-foreground' : ''}`}>
                        <span className="text-primary mr-1">?</span> {q.question}
                      </p>
                      {q.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{q.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {!projectId && (
                <p className="text-[10px] text-destructive mt-1">⚠ Select a project above to create clarify questions</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t">
            <Button size="sm" className="text-xs" onClick={handleConfirm} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Confirm selected
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={handleDiscard}>
              <X className="h-3 w-3 mr-1" /> Discard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
