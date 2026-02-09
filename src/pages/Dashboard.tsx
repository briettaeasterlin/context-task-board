import { useState, useMemo, useCallback } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useMilestones } from '@/hooks/useProjects';
import { useSeedData } from '@/hooks/useSeedData';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import type { Task, TaskArea, TaskStatus, TaskUpdate, TaskInsert, Project } from '@/types/task';
import { AREAS } from '@/types/task';
import { QuickAdd } from '@/components/task/QuickAdd';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { BulkAddModal } from '@/components/task/BulkAddModal';
import { BulkActions } from '@/components/task/BulkActions';
import { FilterBar } from '@/components/task/FilterBar';
import { ProjectCard } from '@/components/project/ProjectCard';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  useSeedData();
  const { tasks, isLoading, createTask, createManyTasks, updateTask, bulkUpdateTasks, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const { clarifyQuestions } = useClarifyQuestions();

  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);

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
    return pTasks.some(t => t.status === 'Next' || t.status === 'Waiting');
  });

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => {
    createTask.mutate({ title, area, status, context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null }, {
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

  return (
    <AppShell>
      <div className="space-y-4">
        <QuickAdd defaultStatus="Next" projects={projects} onAdd={handleQuickAdd} />

        {activeProjects.length > 0 && (
          <section>
            <h2 className="font-mono text-xs font-semibold text-muted-foreground mb-2">Active Projects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeProjects.map(p => (
                <ProjectCard key={p.id} project={p} tasks={tasks.filter(t => t.project_id === p.id)}
                  clarifyCount={clarifyQuestions.filter(q => q.project_id === p.id && q.status === 'open').length}
                  onClick={() => window.location.href = `/projects/${p.id}`} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="font-mono text-xs font-semibold text-muted-foreground">Next — All Areas</h2>
            <div className="flex items-center gap-2">
              <BulkActions selectedCount={selectedIds.size} selectedTasks={nextTasks.filter(t => selectedIds.has(t.id))}
                onBulkUpdate={handleBulkUpdate} onClearSelection={() => setSelectedIds(new Set())} allTasks={tasks} projects={projects} />
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setBulkAddOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Bulk Add
              </Button>
            </div>
          </div>
          <FilterBar search={search} onSearchChange={setSearch} areaFilter={areaFilter} onAreaChange={setAreaFilter}
            projectFilter={projectFilter} onProjectChange={setProjectFilter} projects={projects} />
          <div className="mt-2">
            {isLoading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> :
              <TaskTable tasks={nextTasks} projects={projects} selectedIds={selectedIds} onToggleSelect={toggleSelect}
                onSelectAll={selectAll} onTaskClick={setDetailTask} onInlineUpdate={handleUpdate} />}
          </div>
        </section>

        {waitingTasks.length > 0 && (
          <section>
            <h2 className="font-mono text-xs font-semibold text-muted-foreground mb-2">What's blocking me?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(waitingByProject).map(([projectName, pTasks]) => (
                <Card key={projectName} className="p-3">
                  <h3 className="font-mono text-xs font-medium mb-2">{projectName}</h3>
                  <div className="space-y-1">
                    {pTasks.map(t => (
                      <div key={t.id} className="text-xs text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setDetailTask(t)}>
                        {t.title} {t.blocked_by && <span className="text-status-waiting">⏳ {t.blocked_by}</span>}
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
