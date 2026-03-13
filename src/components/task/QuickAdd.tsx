import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AREAS, STATUSES, type TaskArea, type TaskStatus } from '@/types/task';
import type { Project, Milestone } from '@/types/task';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ExtractionReviewModal, type ExtractionResult } from './ExtractionReviewModal';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface QuickAddProps {
  defaultStatus?: TaskStatus;
  projects?: Project[];
  milestones?: Milestone[];
  allTasks?: { id: string; title: string; status: string; area: string; project_id: string | null }[];
  defaultProjectId?: string;
  onAdd: (title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => void;
  onTasksCreated?: () => void;
}

const MULTILINE_THRESHOLD = 1; // lines > 1 triggers AI mode

export function QuickAdd({ defaultStatus = 'Next', projects = [], milestones = [], allTasks = [], defaultProjectId, onAdd, onTasksCreated }: QuickAddProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<TaskArea>('Personal');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [isMultiline, setIsMultiline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);

  const lineCount = title.split('\n').length;
  const shouldUseAI = lineCount > MULTILINE_THRESHOLD || title.length > 200;

  const handleChange = (value: string) => {
    setTitle(value);
    // Auto-expand to textarea if user pastes multi-line content
    if (!isMultiline && (value.includes('\n') || value.length > 200)) {
      setIsMultiline(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (shouldUseAI) {
      await handleAIExtract();
    } else {
      onAdd(title.trim(), area, status, projectId || null);
      setTitle('');
      setIsMultiline(false);
    }
  };

  const handleAIExtract = async () => {
    setLoading(true);
    try {
      const project = projects.find(p => p.id === projectId);
      const { data, error } = await supabase.functions.invoke('ai-extract', {
        body: {
          rawText: title,
          projectId: projectId || null,
          projectName: project?.name || null,
          source: 'task_bar',
          defaults: {
            area: area,
            status: status,
          },
          existingProjects: projects.map(p => ({ id: p.id, name: p.name, area: p.area })),
          existingTaskTitles: allTasks.slice(0, 100).map(t => ({ title: t.title, status: t.status, area: t.area })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({
        summary: data.summary ?? null,
        extractedTasks: (data.extractedTasks || []).map((t: any) => ({
          title: t.title,
          area: t.area || area,
          status: t.status || status,
          context: t.context || null,
          blockedBy: t.blockedBy || null,
          dueDate: t.dueDate || null,
          targetWindow: t.targetWindow || null,
          projectId: t.projectId || projectId || null,
          milestoneId: t.milestoneId || null,
          selected: true,
        })),
        taskUpdates: (data.taskUpdates || []).map((u: any) => ({
          description: u.description,
          matchHint: u.matchHint || null,
          newStatus: u.newStatus || null,
          blockedBy: u.blockedBy || null,
          selected: true,
        })),
        contextNotes: (data.contextNotes || []).map((c: any) => ({
          content: c.content,
          targetHint: c.targetHint || null,
          selected: true,
        })),
        extractedClarifyQuestions: (data.extractedClarifyQuestions || []).map((q: any) => ({
          question: q.question,
          reason: q.reason || null,
          suggestedOptions: q.suggestedOptions || null,
          selected: true,
        })),
        directives: (data.directives || []).map((d: any) => ({
          type: d.type,
          label: d.label,
          projectName: d.projectName || null,
          projectArea: d.projectArea || null,
          projectSummary: d.projectSummary || null,
          taskMatchHints: d.taskMatchHints || [],
          projectMatchHint: d.projectMatchHint || null,
          newArea: d.newArea || null,
          newStatus: d.newStatus || null,
          milestones: d.milestones || [],
          keepNextHints: d.keepNextHints || [],
          demoteToBacklog: d.demoteToBacklog ?? false,
          selected: true,
        })),
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to extract');
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!result || !user) return;
    setSaving(true);
    try {
      const selectedTasks = result.extractedTasks.filter(t => t.selected);
      const selectedUpdates = result.taskUpdates.filter(u => u.selected);
      const selectedContext = result.contextNotes.filter(c => c.selected);
      const selectedQuestions = result.extractedClarifyQuestions.filter(q => q.selected);
      const selectedDirectives = result.directives.filter(d => d.selected);

      // Log raw input as an Update record
      await supabase.from('updates').insert({
        user_id: user.id,
        project_id: projectId || null,
        source: 'task_bar' as any,
        content: title,
        extracted_summary: result.summary,
        extracted_tasks: selectedTasks,
      } as any);

      // Execute organizational directives
      const createdProjectIds: Record<string, string> = {};
      for (const d of selectedDirectives) {
        switch (d.type) {
          case 'create_project': {
            if (d.projectName) {
              const { data: newProj } = await supabase.from('projects').insert({
                user_id: user.id,
                name: d.projectName,
                area: d.projectArea || 'Personal',
                summary: d.projectSummary || null,
              } as any).select().single();
              if (newProj) createdProjectIds[d.projectName.toLowerCase()] = (newProj as any).id;
            }
            break;
          }
          case 'group_tasks': {
            // Resolve target project id
            let targetProjId: string | null = null;
            if (d.projectMatchHint) {
              const hint = d.projectMatchHint.toLowerCase();
              targetProjId = createdProjectIds[hint] || null;
              if (!targetProjId) {
                const match = projects.find(p => p.name.toLowerCase().includes(hint));
                targetProjId = match?.id || null;
              }
            }
            if (targetProjId && d.taskMatchHints.length > 0) {
              for (const hint of d.taskMatchHints) {
                const { data: matched } = await supabase.from('tasks').select('id')
                  .eq('user_id', user.id).ilike('title', `%${hint}%`).limit(3);
                if (matched) {
                  for (const m of matched) {
                    await supabase.from('tasks').update({ project_id: targetProjId } as any).eq('id', m.id);
                  }
                }
              }
            }
            break;
          }
          case 'reclassify': {
            if (d.taskMatchHints.length > 0) {
              for (const hint of d.taskMatchHints) {
                const { data: matched } = await supabase.from('tasks').select('id')
                  .eq('user_id', user.id).ilike('title', `%${hint}%`).limit(3);
                if (matched) {
                  const updates: any = {};
                  if (d.newArea) updates.area = d.newArea;
                  if (d.newStatus) updates.status = d.newStatus;
                  if (Object.keys(updates).length > 0) {
                    for (const m of matched) {
                      await supabase.from('tasks').update(updates).eq('id', m.id);
                    }
                  }
                }
              }
            }
            break;
          }
          case 'create_milestones': {
            let targetProjId: string | null = null;
            if (d.projectMatchHint) {
              const hint = d.projectMatchHint.toLowerCase();
              targetProjId = createdProjectIds[hint] || null;
              if (!targetProjId) {
                const match = projects.find(p => p.name.toLowerCase().includes(hint));
                targetProjId = match?.id || null;
              }
            }
            if (targetProjId && d.milestones.length > 0) {
              const msRows = d.milestones.map((ms, idx) => ({
                user_id: user.id,
                project_id: targetProjId,
                name: ms.name,
                description: ms.description || null,
                order_index: idx,
              }));
              await supabase.from('milestones').insert(msRows as any[]);
            }
            break;
          }
          case 'reorder_next': {
            if (d.demoteToBacklog) {
              // Get all Next tasks
              const { data: nextTasks } = await supabase.from('tasks').select('id, title')
                .eq('user_id', user.id).eq('status', 'Next');
              if (nextTasks) {
                const keepHints = d.keepNextHints.map(h => h.toLowerCase());
                for (const t of nextTasks) {
                  const shouldKeep = keepHints.some(h => (t as any).title.toLowerCase().includes(h));
                  if (!shouldKeep) {
                    await supabase.from('tasks').update({ status: 'Backlog' } as any).eq('id', t.id);
                  }
                }
              }
            }
            break;
          }
        }
      }

      // Create new tasks (link to newly-created projects if applicable)
      if (selectedTasks.length > 0) {
        const rows = selectedTasks.map(t => {
          let taskProjectId = t.projectId;
          // If task has no project but directives created one, try to link
          if (!taskProjectId && Object.keys(createdProjectIds).length > 0) {
            taskProjectId = Object.values(createdProjectIds)[0] || null;
          }
          return {
            user_id: user.id,
            title: t.title,
            area: t.area,
            status: t.status,
            context: t.context,
            blocked_by: t.blockedBy,
            due_date: t.dueDate,
            target_window: t.targetWindow,
            project_id: taskProjectId,
            milestone_id: t.milestoneId,
            notes: null,
            tags: [],
            source: 'task_bar',
          };
        });
        await supabase.from('tasks').insert(rows as any[]);
      }

      // Apply task updates (status changes to existing tasks)
      for (const u of selectedUpdates) {
        if (u.matchHint && u.newStatus) {
          const { data: matched } = await supabase
            .from('tasks')
            .select('id')
            .eq('user_id', user.id)
            .ilike('title', `%${u.matchHint}%`)
            .neq('status', 'Done')
            .limit(1);
          if (matched && matched.length > 0) {
            const updates: any = { status: u.newStatus };
            if (u.blockedBy) updates.blocked_by = u.blockedBy;
            await supabase.from('tasks').update(updates).eq('id', matched[0].id);
          }
        }
      }

      // Append context notes to project scope_notes
      if (selectedContext.length > 0 && projectId) {
        const { data: proj } = await supabase.from('projects').select('scope_notes').eq('id', projectId).single();
        const existing = proj?.scope_notes || '';
        const appended = selectedContext.map(c => c.content).join('\n');
        await supabase.from('projects').update({
          scope_notes: existing ? `${existing}\n\n${appended}` : appended,
        }).eq('id', projectId);
      }

      // Create clarify questions
      if (selectedQuestions.length > 0) {
        // Use projectId or first created project
        const qProjectId = projectId || Object.values(createdProjectIds)[0] || null;
        if (qProjectId) {
          const qRows = selectedQuestions.map(q => ({
            user_id: user.id,
            project_id: qProjectId,
            question: q.question,
            reason: q.reason,
            suggested_options: q.suggestedOptions,
            status: 'open',
          }));
          await supabase.from('clarify_questions').insert(qRows as any[]);
        }
      }

      const counts = [
        selectedDirectives.length && `${selectedDirectives.length} directives`,
        selectedTasks.length && `${selectedTasks.length} tasks`,
        selectedUpdates.length && `${selectedUpdates.length} updates`,
        selectedContext.length && `${selectedContext.length} notes`,
        selectedQuestions.length && `${selectedQuestions.length} questions`,
      ].filter(Boolean).join(', ');
      toast.success(`Created ${counts}`);

      setResult(null);
      setTitle('');
      setIsMultiline(false);
      onTasksCreated?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border bg-card p-2">
        <div className="flex items-start gap-2">
          <Plus className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
          {isMultiline ? (
            <Textarea
              value={title}
              onChange={e => handleChange(e.target.value)}
              placeholder="Add a task, update a project, reorganize work, or paste notes..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 font-mono text-sm min-h-[80px] resize-y"
              rows={4}
            />
          ) : (
            <Input
              value={title}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  // Let form submit handle it
                }
              }}
              placeholder="Add a task, update a project, reorganize work, or paste notes..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 font-mono text-sm"
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={area} onValueChange={v => setArea(v as TaskArea)}>
            <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={v => setStatus(v as TaskStatus)}>
            <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          {projects.length > 0 && (
            <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex-1" />
          {!isMultiline && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={() => setIsMultiline(true)}>
              Multi-line
            </Button>
          )}
          {isMultiline && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={() => { setIsMultiline(false); setTitle(title.split('\n')[0] || ''); }}>
              Single-line
            </Button>
          )}
          {shouldUseAI ? (
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={loading || !title.trim()}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Extract with AI
            </Button>
          ) : (
            <Button type="submit" size="sm" variant="secondary" className="h-7 text-xs" disabled={!title.trim()}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          )}
        </div>
      </form>

      {result && (
        <ExtractionReviewModal
          open={!!result}
          onClose={() => setResult(null)}
          result={result}
          onResultChange={setResult}
          projects={projects}
          milestones={milestones}
          saving={saving}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
