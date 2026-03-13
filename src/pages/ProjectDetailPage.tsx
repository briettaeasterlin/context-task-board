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
import { ArrowLeft, FileText, CheckCircle2, MoreHorizontal, Pencil, Merge, MoveRight, Archive, Trash2, Plus, ClipboardPaste, Copy } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
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

  const exportSnapshot = () => {
    if (!project) return;
    const doneRecent = tasks.filter(t => t.status === 'Done');
    const nextT = tasks.filter(t => t.status === 'Next');
    const waitingT = tasks.filter(t => t.status === 'Waiting');
    const openQ = clarifyQuestions.filter(q => q.status === 'open');

    let text = `${project.name} — Weekly Snapshot\n${'='.repeat(40)}\n\n`;
    if (doneRecent.length) { text += `✅ Done\n${doneRecent.map(t => `  - ${t.title}`).join('\n')}\n\n`; }
    if (nextT.length) { text += `▶ In Progress (Next)\n${nextT.map(t => `  - ${t.title}`).join('\n')}\n\n`; }
    if (waitingT.length) { text += `⏳ Blocked (Waiting)\n${waitingT.map(t => `  - ${t.title}${t.blocked_by ? ` — waiting on ${t.blocked_by}` : ''}`).join('\n')}\n\n`; }
    if (openQ.length) { text += `❓ Open Questions\n${openQ.map(q => `  - ${q.question}`).join('\n')}\n\n`; }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project.name}-snapshot.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!project) return <AppShell><p className="text-muted-foreground text-sm py-8 text-center">Project not found.</p></AppShell>;

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
            <Button variant="outline" size="sm" className="text-xs h-7 hover:translate-x-px transition-all duration-150" onClick={exportSnapshot}>
              <FileText className="h-3 w-3 mr-1" /> Snapshot
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
