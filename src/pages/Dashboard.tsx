import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useMilestones } from '@/hooks/useProjects';
import { useSeedData } from '@/hooks/useSeedData';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { useBoardLimits } from '@/hooks/useBoardLimits';
import type { Task, TaskArea, TaskStatus, TaskUpdate, TaskInsert, Project } from '@/types/task';
import { QuickAdd } from '@/components/task/QuickAdd';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { BulkAddModal } from '@/components/task/BulkAddModal';
import { BulkActions } from '@/components/task/BulkActions';
import { FilterBar } from '@/components/task/FilterBar';
import { ProjectCard } from '@/components/project/ProjectCard';
import { StatusReviewPanel } from '@/components/review/StatusReviewPanel';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Copy, Check, Sparkles, CalendarDays } from 'lucide-react';
import { BoardLimitBanner } from '@/components/task/BoardLimitBanner';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  return { text: 'Good evening', emoji: '🌙' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useSeedData();
  const { tasks, isLoading, createTask, createManyTasks, updateTask, bulkUpdateTasks, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const { clarifyQuestions } = useClarifyQuestions();
  const { warnings: boardWarnings } = useBoardLimits(tasks);

  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const greeting = getGreeting();
  const openTasks = tasks.filter(t => t.status !== 'Done').length;
  const todayCount = tasks.filter(t => t.status === 'Today').length;
  const nextCount = tasks.filter(t => t.status === 'Next').length;
  const waitingCount = tasks.filter(t => t.status === 'Waiting').length;
  const doneToday = tasks.filter(t => {
    if (t.status !== 'Done') return false;
    const d = new Date(t.updated_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const nextTasks = useMemo(() => {
    let result = tasks.filter(t => t.status === 'Next');
    if (areaFilter !== 'all') result = result.filter(t => t.area === areaFilter);
    if (projectFilter) result = result.filter(t => t.project_id === projectFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.context?.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, areaFilter, projectFilter, search]);

  const waitingTasks = tasks.filter(t => t.status === 'Waiting');
  const waitingByProject = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    for (const t of waitingTasks) {
      const pName = t.project_id ? projects.find(p => p.id === t.project_id)?.name ?? 'No project' : 'No project';
      (grouped[pName] ??= []).push(t);
    }
    return grouped;
  }, [waitingTasks, projects]);

  const activeProjects = projects.filter(p => {
    const pTasks = tasks.filter(t => t.project_id === p.id);
    const pMilestones = milestones.filter(m => m.project_id === p.id);
    const pClarify = clarifyQuestions.filter(q => q.project_id === p.id && q.status === 'open');
    return pTasks.some(t => t.status === 'Next' || t.status === 'Waiting') || pClarify.length > 0 || pMilestones.some(m => !m.is_complete);
  });

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status, context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
      onSuccess: () => toast.success('Task added'),
      onError: (e) => toast.error(e.message),
    });
  }, [createTask]);

  const handleBulkAdd = useCallback((newTasks: Omit<TaskInsert, 'user_id'>[]) => {
    createManyTasks.mutate(newTasks, {
      onSuccess: (data) => toast.success(`${data.length} tasks added`),
      onError: (e) => toast.error(e.message),
    });
  }, [createManyTasks]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleBulkUpdate = useCallback((updates: TaskUpdate) => {
    const ids = Array.from(selectedIds);
    bulkUpdateTasks.mutate({ ids, updates }, { onSuccess: () => { toast.success(`${ids.length} tasks updated`); setSelectedIds(new Set()); } });
  }, [selectedIds, bulkUpdateTasks]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id, { onSuccess: () => toast.success('Task deleted') }); }, [deleteTask]);
  const toggleSelect = useCallback((id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, []);
  const selectAll = useCallback(() => { setSelectedIds(prev => prev.size === nextTasks.length ? new Set() : new Set(nextTasks.map(t => t.id))); }, [nextTasks]);
  const [copied, setCopied] = useState(false);

  const copyAllForAI = useCallback(() => {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const grouped: Record<string, { project?: Project; tasks: Task[] }> = {};
    for (const t of tasks) {
      const key = t.project_id || '__none__';
      if (!grouped[key]) grouped[key] = { project: t.project_id ? projectMap.get(t.project_id) : undefined, tasks: [] };
      grouped[key].tasks.push(t);
    }
    let text = `I need help doing a status review of my tasks. For each project/group below, please:\n1. Summarize the current state of the initiative\n2. For any task where the status is unclear or stale, ASK ME whether it has been completed, is still in progress, is waiting on someone, or should be deprioritized/removed entirely\n3. Suggest updated statuses where you're confident, but flag anything ambiguous as a question\n\nStatuses: Today (scheduled for today), Next (active but not scheduled), Waiting (blocked/waiting on someone), Backlog (known work not active), Closing (wrap-up tasks), Done (completed)\n\n`;
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return (grouped[a].project?.name ?? '').localeCompare(grouped[b].project?.name ?? '');
    });
    for (const key of sortedKeys) {
      const { project, tasks: groupTasks } = grouped[key];
      const name = project?.name ?? 'No Project';
      text += `## ${name}\n`;
      if (project?.summary) text += `Summary: ${project.summary}\n`;
      if (project?.scope_notes) text += `Scope: ${project.scope_notes}\n`;
      text += '\n';
      for (const t of groupTasks) {
        text += `- [${t.status}] ${t.title}`;
        if (t.area) text += ` (${t.area})`;
        if (t.blocked_by) text += ` — blocked by: ${t.blocked_by}`;
        if (t.context) text += ` — ${t.context}`;
        if (t.due_date) text += ` — due: ${t.due_date}`;
        if (t.notes) text += ` | notes: ${t.notes}`;
        text += '\n';
      }
      text += '\n';
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard — paste into ChatGPT or Claude');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [tasks, projects]);

  // Review mode
  if (reviewMode) {
    return (
      <AppShell>
        <StatusReviewPanel
          tasks={tasks}
          projects={projects}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => { setReviewMode(false); queryClient.invalidateQueries({ queryKey: ['tasks'] }); }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Greeting Banner */}
        <div className="rounded-2xl bg-accent/50 border border-accent p-6">
          <h1 className="text-2xl font-sans font-bold flex items-center gap-2">
            <span>{greeting.emoji}</span>
            {greeting.text}, Brietta
          </h1>
          <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="text-base">📌</span>
              <span className="font-medium text-foreground">{todayCount}</span> today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-base">🎯</span>
              <span className="font-medium text-foreground">{nextCount}</span> next
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-base">⏳</span>
              <span className="font-medium text-foreground">{waitingCount}</span> waiting
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-base">📋</span>
              <span className="font-medium text-foreground">{openTasks}</span> open
            </span>
            {doneToday > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="text-base">✅</span>
                <span className="font-medium text-status-done">{doneToday}</span> done today
              </span>
            )}
          </div>
        </div>

        <QuickAdd defaultStatus="Next" projects={projects} milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={handleQuickAdd}
          onTasksCreated={() => queryClient.invalidateQueries()} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8 rounded-lg" onClick={() => navigate('/planner')}>
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Plan My Week
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 rounded-lg" onClick={() => setReviewMode(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Run AI Status Review
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 rounded-lg" onClick={copyAllForAI}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? 'Copied!' : 'Copy All for AI'}
          </Button>
        </div>

        {activeProjects.length > 0 && (
          <section>
            <h2 className="font-sans text-lg font-semibold mb-3 flex items-center gap-2">
              <span>📁</span> Active Projects
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeProjects.map(p => (
                <ProjectCard key={p.id} project={p} tasks={tasks.filter(t => t.project_id === p.id)}
                  milestones={milestones}
                  clarifyCount={clarifyQuestions.filter(q => q.project_id === p.id && q.status === 'open').length}
                  onClick={() => window.location.href = `/projects/${p.id}`} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-sans text-lg font-semibold flex items-center gap-2">
              <span>🎯</span> Next — All Areas
            </h2>
            <div className="flex items-center gap-2">
              <BulkActions selectedCount={selectedIds.size} selectedTasks={nextTasks.filter(t => selectedIds.has(t.id))}
                onBulkUpdate={handleBulkUpdate} onBulkDelete={ids => ids.forEach(id => deleteTask.mutate(id, { onSuccess: () => setSelectedIds(new Set()) }))} onClearSelection={() => setSelectedIds(new Set())} allTasks={tasks} projects={projects} />
              <Button variant="outline" size="sm" className="text-xs h-8 rounded-lg" onClick={() => setBulkAddOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Bulk Add
              </Button>
            </div>
          </div>
          <FilterBar search={search} onSearchChange={setSearch} areaFilter={areaFilter} onAreaChange={setAreaFilter}
            projectFilter={projectFilter} onProjectChange={setProjectFilter} projects={projects} />
          <div className="mt-3">
            {isLoading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> :
              <TaskTable tasks={nextTasks} projects={projects} selectedIds={selectedIds} onToggleSelect={toggleSelect}
                onSelectAll={selectAll} onTaskClick={setDetailTask} onInlineUpdate={handleUpdate} />}
          </div>
        </section>

        {waitingTasks.length > 0 && (
          <section>
            <h2 className="font-sans text-lg font-semibold mb-3 flex items-center gap-2">
              <span>⏳</span> What's blocking me?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(waitingByProject).map(([projectName, pTasks]) => (
                <Card key={projectName} className="p-4 rounded-xl shadow-card">
                  <h3 className="font-sans text-sm font-semibold mb-3">{projectName}</h3>
                  <div className="space-y-2">
                    {pTasks.map(t => (
                      <div key={t.id} className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors rounded-lg p-2 hover:bg-muted/30" onClick={() => setDetailTask(t)}>
                        {t.title} {t.blocked_by && <span className="text-status-waiting font-medium">⏳ {t.blocked_by}</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
      <BulkAddModal open={bulkAddOpen} onClose={() => setBulkAddOpen(false)} onConfirm={handleBulkAdd} projects={projects} />
    </AppShell>
  );
}
