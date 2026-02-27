import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useUpdates } from '@/hooks/useUpdates';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { RoadmapTimeline } from '@/components/project/RoadmapTimeline';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { QuickAdd } from '@/components/task/QuickAdd';
import { UpdateForm } from '@/components/inbox/UpdateForm';
import { ClarifyCard } from '@/components/inbox/ClarifyCard';
import { AreaBadge } from '@/components/task/AreaBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskArea, TaskStatus, TaskUpdate } from '@/types/task';
import { AREAS } from '@/types/task';
import { ArrowLeft, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { projects } = useProjects();
  const { milestones } = useMilestones(id);
  const { tasks, createTask, updateTask, deleteTask } = useTasks(id);
  const allTasksHook = useTasks();
  const { updates } = useUpdates(id);
  const { clarifyQuestions, updateClarifyQuestion } = useClarifyQuestions(id);

  const project = projects.find(p => p.id === id);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clarifyFilter, setClarifyFilter] = useState<'open' | 'answered' | 'dismissed'>('open');

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleUpdate = useCallback((taskId: string, updates: TaskUpdate) => { updateTask.mutate({ id: taskId, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((taskId: string) => { deleteTask.mutate(taskId); }, [deleteTask]);
  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status, context: null, notes: null, tags: [], project_id: id!, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
      onSuccess: () => toast.success('Task added'),
    });
  }, [createTask, id]);

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
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigate('/review')}>
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
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={exportSnapshot}>
              <FileText className="h-3 w-3 mr-1" /> Snapshot
            </Button>
          </div>
        </div>

        <Tabs defaultValue="roadmap">
          <TabsList>
            <TabsTrigger value="roadmap" className="text-xs">Roadmap</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="updates" className="text-xs">Updates ({updates.length})</TabsTrigger>
            <TabsTrigger value="clarify" className="text-xs">Clarify ({clarifyQuestions.filter(q => q.status === 'open').length})</TabsTrigger>
          </TabsList>
          <TabsContent value="roadmap" className="mt-4">
            <RoadmapTimeline milestones={milestones} tasks={tasks} />
          </TabsContent>
          <TabsContent value="tasks" className="mt-4 space-y-3">
            <QuickAdd defaultStatus="Next" projects={projects} defaultProjectId={id} onAdd={handleQuickAdd} />
            <TaskTable tasks={tasks} projects={projects} selectedIds={selectedIds}
              onToggleSelect={tid => setSelectedIds(prev => { const n = new Set(prev); if (n.has(tid)) n.delete(tid); else n.add(tid); return n; })}
              onSelectAll={() => setSelectedIds(prev => prev.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id)))}
              onTaskClick={setDetailTask} onInlineUpdate={handleUpdate} />
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
      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
    </AppShell>
  );
}
