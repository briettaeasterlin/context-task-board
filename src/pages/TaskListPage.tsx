import { useState, useMemo, useCallback } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useProjects';
import { useMilestones } from '@/hooks/useProjects';
import { AppShell } from '@/components/layout/AppShell';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { FilterBar } from '@/components/task/FilterBar';
import { BulkActions } from '@/components/task/BulkActions';
import type { Task, TaskArea, TaskStatus, TaskUpdate } from '@/types/task';
import { toast } from 'sonner';

interface Props {
  filterStatus: TaskStatus;
}

export default function TaskListPage({ filterStatus }: Props) {
  const { tasks, updateTask, bulkUpdateTasks, deleteTask, hasMoreTasks, isLoadingMore, loadMore } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    let result = tasks.filter(t => t.status === filterStatus);
    if (areaFilter !== 'all') result = result.filter(t => t.area === areaFilter);
    if (projectFilter) result = result.filter(t => t.project_id === projectFilter);
    if (search) { const q = search.toLowerCase(); result = result.filter(t => t.title.toLowerCase().includes(q) || t.context?.toLowerCase().includes(q)); }
    return result;
  }, [tasks, filterStatus, areaFilter, projectFilter, search]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleBulkUpdate = useCallback((updates: TaskUpdate) => {
    const ids = Array.from(selectedIds);
    bulkUpdateTasks.mutate({ ids, updates }, { onSuccess: () => { toast.success(`${ids.length} updated`); setSelectedIds(new Set()); } });
  }, [selectedIds, bulkUpdateTasks]);
  const toggleSelect = useCallback((id: string) => { setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-mono text-sm font-semibold">{filterStatus} Tasks</h2>
          <BulkActions selectedCount={selectedIds.size} selectedTasks={filtered.filter(t => selectedIds.has(t.id))}
            onBulkUpdate={handleBulkUpdate} onBulkDelete={ids => ids.forEach(id => deleteTask.mutate(id, { onSuccess: () => setSelectedIds(new Set()) }))} onClearSelection={() => setSelectedIds(new Set())} allTasks={tasks} projects={projects} />
        </div>
        <FilterBar search={search} onSearchChange={setSearch} areaFilter={areaFilter} onAreaChange={setAreaFilter}
          projectFilter={projectFilter} onProjectChange={setProjectFilter} projects={projects} />
        <TaskTable tasks={filtered} projects={projects} allTasks={tasks} selectedIds={selectedIds} onToggleSelect={toggleSelect}
          onSelectAll={() => setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(t => t.id)))}
          onTaskClick={setDetailTask} onInlineUpdate={handleUpdate} showScoring />
        {hasMoreTasks && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? 'Loading…' : 'Load more tasks'}
            </Button>
          </div>
        )}
      </div>
      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={id => deleteTask.mutate(id)} projects={projects} milestones={milestones} />
    </AppShell>
  );
}
