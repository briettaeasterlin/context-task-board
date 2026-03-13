import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useUpdates } from '@/hooks/useUpdates';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { RoadmapTimeline } from '@/components/project/RoadmapTimeline';
import { ProjectPlanTab } from '@/components/project/ProjectPlanTab';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { QuickAdd } from '@/components/task/QuickAdd';
import { UpdateForm } from '@/components/inbox/UpdateForm';
import { ClarifyCard } from '@/components/inbox/ClarifyCard';
import { AreaBadge } from '@/components/task/AreaBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskArea, TaskStatus, TaskUpdate } from '@/types/task';
import { AREAS } from '@/types/task';
import { ArrowLeft, FileText, CheckCircle2, MoreHorizontal, Pencil, Merge, MoveRight, Archive, Trash2, Plus, ClipboardPaste, Copy, Loader2, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ExtractionReviewModal, type ExtractionResult } from '@/components/task/ExtractionReviewModal';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { scoreTasks } from '@/lib/task-scoring';
import { cn } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { projects, updateProject, deleteProject } = useProjects();
  const { milestones, createMilestone } = useMilestones(id);
  const { tasks, createTask, updateTask, deleteTask } = useTasks(id);
  const allTasksHook = useTasks();
  const { updates } = useUpdates(id);
  const { clarifyQuestions, updateClarifyQuestion } = useClarifyQuestions(id);

  const project = projects.find(p => p.id === id);
  const otherProjects = projects.filter(p => p.id !== id);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clarifyFilter, setClarifyFilter] = useState<'open' | 'answered' | 'dismissed'>('open');

  // Action modals
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteSaving, setPasteSaving] = useState(false);
  const [pasteResult, setPasteResult] = useState<ExtractionResult | null>(null);

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleUpdate = useCallback((taskId: string, updates: TaskUpdate) => { updateTask.mutate({ id: taskId, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((taskId: string) => { deleteTask.mutate(taskId); }, [deleteTask]);
  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status, context: null, notes: null, tags: [], project_id: id!, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
      onSuccess: () => toast.success('Added to route'),
    });
  }, [createTask, id]);

  // ── Rename ──
  const handleRename = useCallback(() => {
    if (!renameValue.trim() || !id) return;
    updateProject.mutate({ id, name: renameValue.trim() }, {
      onSuccess: () => { toast.success('Route renamed'); setRenameOpen(false); },
    });
  }, [renameValue, id, updateProject]);

  // ── Merge ──
  const handleMerge = useCallback(async () => {
    if (!mergeTargetId || !id || !user) return;
    // Move all tasks to target project
    for (const task of tasks) {
      await supabase.from('tasks').update({ project_id: mergeTargetId } as any).eq('id', task.id);
    }
    // Move milestones to target project
    for (const ms of milestones) {
      await supabase.from('milestones').update({ project_id: mergeTargetId } as any).eq('id', ms.id);
    }
    // Archive the current project
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    queryClient.invalidateQueries();
    toast.success('Routes merged');
    navigate('/projects');
  }, [mergeTargetId, id, user, tasks, milestones, queryClient, navigate]);

  // ── Move Tasks ──
  const handleMoveTasks = useCallback(async () => {
    if (!moveTargetId || !id) return;
    for (const task of tasks) {
      await supabase.from('tasks').update({ project_id: moveTargetId } as any).eq('id', task.id);
    }
    queryClient.invalidateQueries();
    toast.success(`${tasks.length} tasks moved`);
    setMoveOpen(false);
  }, [moveTargetId, id, tasks, queryClient]);

  // ── Archive ──
  const handleArchive = useCallback(() => {
    if (!id) return;
    deleteProject.mutate(id, {
      onSuccess: () => { toast.success('Route archived'); navigate('/projects'); },
    });
  }, [id, deleteProject, navigate]);

  // ── Delete (permanent) ──
  const handlePermanentDelete = useCallback(async () => {
    if (!id || deleteConfirm !== 'DELETE') return;
    // Delete all tasks in the project
    for (const task of tasks) {
      await supabase.from('tasks').delete().eq('id', task.id);
    }
    // Delete milestones
    for (const ms of milestones) {
      await supabase.from('milestones').delete().eq('id', ms.id);
    }
    // Delete project permanently
    await supabase.from('projects').delete().eq('id', id);
    queryClient.invalidateQueries();
    toast.success('Route permanently deleted');
    navigate('/projects');
  }, [id, deleteConfirm, tasks, milestones, queryClient, navigate]);

  const handleAnswer = useCallback(async (qId: string, answer: string, followOn?: { updateScope: boolean; createTask: boolean; createMilestone: boolean }) => {
    const question = clarifyQuestions.find(q => q.id === qId);
    updateClarifyQuestion.mutate({ id: qId, status: 'answered' as any, answer });

    if (followOn && question && user) {
      if (followOn.updateScope && id) {
        const { data: proj } = await supabase.from('projects').select('scope_notes').eq('id', id).single();
        const existing = proj?.scope_notes || '';
        const line = `Q: ${question.question}\nA: ${answer}`;
        await supabase.from('projects').update({
          scope_notes: existing ? `${existing}\n\n${line}` : line,
        } as any).eq('id', id);
        toast.success('Scope notes updated');
      }
      if (followOn.createTask) {
        createTask.mutate({
          title: answer.slice(0, 80),
          area: 'Personal',
          status: 'Backlog',
          context: `From clarify: ${question.question}`,
          notes: null,
          tags: [],
          project_id: id || null,
          milestone_id: null,
          blocked_by: null,
          source: 'clarify',
          due_date: null,
          target_window: null,
        }, { onSuccess: () => toast.success('Task created from answer') });
      }
      if (followOn.createMilestone && id) {
        await supabase.from('milestones').insert({
          user_id: user.id,
          project_id: id,
          name: answer.slice(0, 80),
          description: `From clarify: ${question.question}`,
          order_index: 0,
        } as any);
        toast.success('Milestone created from answer');
        queryClient.invalidateQueries({ queryKey: ['milestones'] });
      }
    }
  }, [updateClarifyQuestion, clarifyQuestions, user, id, createTask, queryClient]);

  const handleDismiss = useCallback((qId: string) => {
    updateClarifyQuestion.mutate({ id: qId, status: 'dismissed' as any });
  }, [updateClarifyQuestion]);

  const buildSnapshotText = () => {
    if (!project) return '';
    const byStatus = (s: string) => tasks.filter(t => t.status === s);
    const todayT = byStatus('Today');
    const nextT = byStatus('Next');
    const waitingT = byStatus('Waiting');
    const backlogT = byStatus('Backlog');
    const closingT = byStatus('Closing');
    const somedayT = byStatus('Someday');
    const doneT = byStatus('Done');
    const openQ = clarifyQuestions.filter(q => q.status === 'open');

    let text = `${project.name} — Full Project Snapshot\n${'='.repeat(50)}\n\n`;

    // Project metadata
    text += `Area: ${project.area}\n`;
    if ((project as any).strategic_phase) text += `Phase: ${(project as any).strategic_phase}\n`;
    text += `Progress: ${progress}% (${done}/${total} tasks done)\n`;
    if (project.summary) text += `Summary: ${project.summary}\n`;
    if (project.scope_notes) text += `\nScope Notes:\n${project.scope_notes}\n`;
    text += '\n';

    // Milestones
    if (milestones.length > 0) {
      text += `📍 Milestones\n${'-'.repeat(30)}\n`;
      milestones.forEach((ms, i) => {
        const msTasks = tasks.filter(t => t.milestone_id === ms.id);
        const msDone = msTasks.filter(t => t.status === 'Done').length;
        text += `  ${ms.is_complete ? '✅' : '○'} ${ms.name}${ms.description ? ` — ${ms.description}` : ''} (${msDone}/${msTasks.length} tasks)\n`;
      });
      text += '\n';
    }

    // Tasks by status
    const statusSections: [string, string, Task[]][] = [
      ['🔴', 'Today', todayT],
      ['▶', 'Next', nextT],
      ['⏳', 'Waiting', waitingT],
      ['📋', 'Backlog', backlogT],
      ['🔄', 'Closing', closingT],
      ['💤', 'Someday', somedayT],
      ['✅', 'Done', doneT],
    ];

    for (const [icon, label, items] of statusSections) {
      if (items.length === 0) continue;
      text += `${icon} ${label} (${items.length})\n${'-'.repeat(30)}\n`;
      items.forEach(t => {
        let line = `  - ${t.title}`;
        const meta: string[] = [];
        if (t.due_date) meta.push(`due: ${t.due_date}`);
        if (t.blocked_by) meta.push(`blocked: ${t.blocked_by}`);
        if (t.estimated_minutes) meta.push(`${t.estimated_minutes}m`);
        if (t.context) meta.push(t.context);
        if (t.target_window) meta.push(`window: ${t.target_window}`);
        if (meta.length) line += ` [${meta.join(' | ')}]`;
        if (t.notes) line += `\n    Notes: ${t.notes.slice(0, 120)}`;
        text += line + '\n';
      });
      text += '\n';
    }

    // Open questions
    if (openQ.length > 0) {
      text += `❓ Open Questions (${openQ.length})\n${'-'.repeat(30)}\n`;
      openQ.forEach(q => {
        text += `  - ${q.question}`;
        if (q.reason) text += ` (${q.reason})`;
        text += '\n';
      });
      text += '\n';
    }

    text += `\nExported: ${new Date().toISOString()}\n`;
    return text;
  };

  const exportSnapshot = () => {
    const text = buildSnapshotText();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project!.name}-snapshot.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const copySnapshot = () => {
    const text = buildSnapshotText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Snapshot copied to clipboard');
  };

  const handlePasteExtract = useCallback(async () => {
    if (!pasteContent.trim() || !user || !id) return;
    setPasteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-extract', {
        body: {
          rawText: pasteContent,
          projectId: id,
          projectName: project?.name || null,
          source: 'paste_update',
          defaults: { area: project?.area || 'Personal' },
          existingProjects: projects.map(p => ({ id: p.id, name: p.name, area: p.area })),
          existingTaskTitles: tasks.slice(0, 200).map(t => ({ title: t.title, status: t.status, area: t.area })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPasteResult({
        summary: data.summary ?? null,
        extractedTasks: (data.extractedTasks || []).map((t: any) => ({
          title: t.title,
          area: t.area || project?.area || 'Personal',
          status: t.status || 'Backlog',
          context: t.context || null,
          blockedBy: t.blockedBy || null,
          dueDate: t.dueDate || null,
          targetWindow: t.targetWindow || null,
          projectId: t.projectId || id,
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
      setPasteOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to extract');
    }
    setPasteLoading(false);
  }, [pasteContent, user, id, project, projects, tasks]);

  const handlePasteConfirm = useCallback(async () => {
    if (!pasteResult || !user || !id) return;
    setPasteSaving(true);
    try {
      const selectedTasks = pasteResult.extractedTasks.filter(t => t.selected);
      const selectedUpdates = pasteResult.taskUpdates.filter(u => u.selected);
      const selectedContext = pasteResult.contextNotes.filter(c => c.selected);
      const selectedQuestions = pasteResult.extractedClarifyQuestions.filter(q => q.selected);
      const selectedDirectives = pasteResult.directives.filter(d => d.selected);

      // Log raw input as an Update record
      await supabase.from('updates').insert({
        user_id: user.id,
        project_id: id,
        source: 'doc' as any,
        content: pasteContent,
        extracted_summary: pasteResult.summary,
        extracted_tasks: selectedTasks,
      } as any);

      // Execute directives
      const createdProjectIds: Record<string, string> = {};
      for (const d of selectedDirectives) {
        if (d.type === 'create_project' && d.projectName) {
          const { data: newProj } = await supabase.from('projects').insert({
            user_id: user.id, name: d.projectName, area: d.projectArea || 'Personal', summary: d.projectSummary || null,
          } as any).select().single();
          if (newProj) createdProjectIds[d.projectName.toLowerCase()] = (newProj as any).id;
        }
        if (d.type === 'reclassify' && d.taskMatchHints.length > 0) {
          for (const hint of d.taskMatchHints) {
            const { data: matched } = await supabase.from('tasks').select('id').eq('user_id', user.id).ilike('title', `%${hint}%`).limit(3);
            if (matched) {
              const updates: any = {};
              if (d.newArea) updates.area = d.newArea;
              if (d.newStatus) updates.status = d.newStatus;
              if (Object.keys(updates).length > 0) {
                for (const m of matched) await supabase.from('tasks').update(updates).eq('id', m.id);
              }
            }
          }
        }
        if (d.type === 'create_milestones' && d.milestones.length > 0) {
          let targetProjId = id;
          if (d.projectMatchHint) {
            const hint = d.projectMatchHint.toLowerCase();
            const match = projects.find(p => p.name.toLowerCase().includes(hint));
            if (match) targetProjId = match.id;
          }
          const msRows = d.milestones.map((ms, idx) => ({
            user_id: user.id, project_id: targetProjId, name: ms.name, description: ms.description || null, order_index: idx,
          }));
          await supabase.from('milestones').insert(msRows as any[]);
        }
      }

      // Create new tasks
      if (selectedTasks.length > 0) {
        const rows = selectedTasks.map(t => ({
          user_id: user.id, title: t.title, area: t.area, status: t.status,
          context: t.context, blocked_by: t.blockedBy, due_date: t.dueDate,
          target_window: t.targetWindow, project_id: t.projectId || id,
          milestone_id: t.milestoneId, notes: null, tags: [], source: 'paste_update',
        }));
        await supabase.from('tasks').insert(rows as any[]);
      }

      // Apply task updates (status changes)
      for (const u of selectedUpdates) {
        if (u.matchHint && u.newStatus) {
          const { data: matched } = await supabase.from('tasks').select('id')
            .eq('user_id', user.id).ilike('title', `%${u.matchHint}%`).limit(1);
          if (matched && matched.length > 0) {
            const updates: any = { status: u.newStatus };
            if (u.blockedBy) updates.blocked_by = u.blockedBy;
            await supabase.from('tasks').update(updates).eq('id', matched[0].id);
          }
        }
      }

      // Append context notes to scope_notes
      if (selectedContext.length > 0) {
        const { data: proj } = await supabase.from('projects').select('scope_notes').eq('id', id).single();
        const existing = proj?.scope_notes || '';
        const appended = selectedContext.map(c => c.content).join('\n');
        await supabase.from('projects').update({
          scope_notes: existing ? `${existing}\n\n${appended}` : appended,
        }).eq('id', id);
      }

      // Create clarify questions
      if (selectedQuestions.length > 0) {
        const qRows = selectedQuestions.map(q => ({
          user_id: user.id, project_id: id, question: q.question, reason: q.reason,
          suggested_options: q.suggestedOptions, status: 'open',
        }));
        await supabase.from('clarify_questions').insert(qRows as any[]);
      }

      const counts = [
        selectedDirectives.length && `${selectedDirectives.length} directives`,
        selectedTasks.length && `${selectedTasks.length} tasks`,
        selectedUpdates.length && `${selectedUpdates.length} updates`,
        selectedContext.length && `${selectedContext.length} notes`,
        selectedQuestions.length && `${selectedQuestions.length} questions`,
      ].filter(Boolean).join(', ');
      toast.success(`Applied: ${counts}`);

      queryClient.invalidateQueries();
      setPasteResult(null);
      setPasteContent('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
    setPasteSaving(false);
  }, [pasteResult, pasteContent, user, id, projects, queryClient]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 px-2 hover:translate-x-px transition-all duration-150" onClick={() => navigate('/review')}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-sm font-semibold">{project.name}</h2>
              <AreaBadge area={project.area} />
            </div>
            {project.summary && <p className="text-xs text-muted-foreground mt-0.5">{project.summary}</p>}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <div className="text-[10px] text-muted-foreground">{progress}% complete</div>
              <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7 hover:translate-x-px transition-all duration-150" onClick={copySnapshot}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 hover:translate-x-px transition-all duration-150" onClick={exportSnapshot}>
              <FileText className="h-3 w-3 mr-1" /> Export
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 hover:translate-x-px transition-all duration-150" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-3 w-3 mr-1" /> Paste Update
            </Button>

            {/* Route Controls Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 hover:translate-x-px transition-all duration-150">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => { setRenameValue(project.name); setRenameOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Rename project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMergeTargetId(''); setMergeOpen(true); }}>
                  <Merge className="h-3.5 w-3.5 mr-2" /> Merge with another project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMoveTargetId(''); setMoveOpen(true); }}>
                  <MoveRight className="h-3.5 w-3.5 mr-2" /> Move tasks to another project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                  <Archive className="h-3.5 w-3.5 mr-2" /> Archive project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDeleteConfirm(''); setDeleteOpen(true); }} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs defaultValue="roadmap">
          <TabsList>
            <TabsTrigger value="roadmap" className="text-xs">Roadmap</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="plan" className="text-xs">Plan</TabsTrigger>
            <TabsTrigger value="updates" className="text-xs">Updates ({updates.length})</TabsTrigger>
            <TabsTrigger value="clarify" className="text-xs">Clarify ({clarifyQuestions.filter(q => q.status === 'open').length})</TabsTrigger>
          </TabsList>
          <TabsContent value="roadmap" className="mt-4 space-y-6">
            <RoadmapTimeline
              milestones={milestones}
              tasks={tasks}
              onAddMilestone={createMilestone ? (name: string) => createMilestone.mutate({
                project_id: id!,
                name,
                order_index: milestones.length,
                is_complete: false,
                completion_rule: 'manual' as any,
                description: null,
              }) : undefined}
              onMerge={() => { setMergeTargetId(''); setMergeOpen(true); }}
              onArchive={() => setArchiveOpen(true)}
            />
            <RecommendedOrder tasks={tasks} allTasks={allTasksHook.tasks} onSelect={setDetailTask}
              onMarkDone={(id) => updateTask.mutate({ id, status: 'Done' }, { onSuccess: () => toast.success('Route cleared ✨') })} />
          </TabsContent>
          <TabsContent value="tasks" className="mt-4 space-y-3">
            <QuickAdd defaultStatus="Next" projects={projects} defaultProjectId={id} onAdd={handleQuickAdd} />
            <TaskTable tasks={tasks} projects={projects} selectedIds={selectedIds}
              onToggleSelect={tid => setSelectedIds(prev => { const n = new Set(prev); if (n.has(tid)) n.delete(tid); else n.add(tid); return n; })}
              onSelectAll={() => setSelectedIds(prev => prev.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id)))}
              onTaskClick={setDetailTask} onInlineUpdate={handleUpdate} />
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
            <ProjectPlanTab project={project} tasks={tasks} milestones={milestones}
              onTaskClick={setDetailTask}
              onCreateTask={(title) => createTask.mutate({
                title, area: project.area, status: 'Backlog', context: null, notes: null,
                tags: [], project_id: id!, milestone_id: null, blocked_by: null,
                source: 'decomposition', due_date: null, target_window: null,
              })} />
          </TabsContent>
          <TabsContent value="updates" className="mt-4 space-y-4">
            <UpdateForm projects={projects} defaultProjectId={id} onCreated={() => queryClient.invalidateQueries()} />
            {updates.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-mono text-xs text-muted-foreground">Previous Updates</h3>
                {updates.map(u => (
                  <Card key={u.id} className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {u.source && <span className="text-[10px] text-muted-foreground font-mono uppercase">{u.source}</span>}
                      <span className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap">{u.content.slice(0, 300)}{u.content.length > 300 ? '...' : ''}</p>
                    {u.extracted_summary && <p className="text-xs text-primary mt-1">📋 {u.extracted_summary}</p>}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="clarify" className="mt-4 space-y-3">
            <div className="flex gap-1">
              {(['open', 'answered', 'dismissed'] as const).map(f => (
                <Button
                  key={f}
                  variant={clarifyFilter === f ? 'default' : 'outline'}
                  size="sm"
                  className="text-[10px] h-6 capitalize"
                  onClick={() => setClarifyFilter(f)}
                >
                  {f} ({clarifyQuestions.filter(q => q.status === f).length})
                </Button>
              ))}
            </div>
            {clarifyQuestions.filter(q => q.status === clarifyFilter).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No {clarifyFilter} questions.
              </p>
            )}
            <div className="space-y-2">
              {clarifyQuestions
                .filter(q => q.status === clarifyFilter)
                .map(q => (
                  <ClarifyCard
                    key={q.id}
                    question={q}
                    projectName={project.name}
                    onAnswer={handleAnswer}
                    onDismiss={handleDismiss}
                    showAnswered={clarifyFilter !== 'open'}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Rename Modal ── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Rename Project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            placeholder="Project name"
            className="rounded-xl"
            onKeyDown={e => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()} className="rounded-xl">Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Merge Modal ── */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Merge Project</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Select another project to merge this route into. All tasks, milestones, and notes will be moved.
            </DialogDescription>
          </DialogHeader>
          <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {otherProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleMerge} disabled={!mergeTargetId} className="rounded-xl">Merge routes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move Tasks Modal ── */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Move Tasks</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Move all {tasks.length} tasks from this project to another project.
            </DialogDescription>
          </DialogHeader>
          <Select value={moveTargetId} onValueChange={setMoveTargetId}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {otherProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleMoveTasks} disabled={!moveTargetId} className="rounded-xl">Move tasks</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Archive Modal ── */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Archive Project</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This route will be removed from active work but can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleArchive} className="rounded-xl">Archive route</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Modal ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">Delete Project</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {tasks.length > 0
                ? `Deleting this route will permanently remove ${tasks.length} task${tasks.length !== 1 ? 's' : ''}.`
                : 'This project will be permanently deleted.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm:</p>
            <Input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="rounded-xl font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={deleteConfirm !== 'DELETE'} className="rounded-xl">
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Paste Update Modal ── */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Paste Update</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Paste output from ChatGPT, Claude, or any external tool. This will be saved as a project update you can review and act on.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={pasteContent}
            onChange={e => setPasteContent(e.target.value)}
            placeholder="Paste status update, task list, meeting notes, or AI output here..."
            className="rounded-xl min-h-[200px] text-sm font-mono"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handlePasteUpdate} disabled={!pasteContent.trim()} className="rounded-xl">
              <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" /> Save Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
    </AppShell>
  );
}

// ─── Recommended Order ───

function RecommendedOrder({ tasks, allTasks, onSelect, onMarkDone }: { tasks: Task[]; allTasks: Task[]; onSelect: (t: Task) => void; onMarkDone: (id: string) => void }) {
  const recommended = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'Done');
    return scoreTasks(active, allTasks).slice(0, 7);
  }, [tasks, allTasks]);

  if (recommended.length === 0) return null;

  return (
    <section>
      <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-3">
        <span>🏆</span> Recommended Order
      </h2>
      <Card className="p-3 rounded-xl shadow-card space-y-1">
        {recommended.map((t, i) => (
          <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={() => onSelect(t)}>
            <span className="text-xs text-muted-foreground font-mono w-5">{i + 1}.</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => { e.stopPropagation(); onMarkDone(t.id); }}>
              <CheckCircle2 className="h-3 w-3" />
            </Button>
            <span className="text-sm flex-1 truncate">{t.title}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{t.estimatedDuration}</span>
            <span className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded-full',
              t.priorityScore >= 8 ? 'bg-destructive/10 text-destructive' :
              t.priorityScore >= 5 ? 'bg-status-next/10 text-status-next' :
              'bg-muted text-muted-foreground'
            )}>
              {t.priorityScore}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}
