import { useState, useMemo, useCallback } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { AppShell } from '@/components/layout/AppShell';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { FilterBar } from '@/components/task/FilterBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Task, TaskArea, TaskUpdate } from '@/types/task';
import { toast } from 'sonner';

type SortOption = 'date_completed' | 'project' | 'area';

export default function ArchivePage() {
  const { tasks, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('date_completed');

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const doneTasks = useMemo(() => {
    let result = tasks.filter(t => t.status === 'Done');
    if (areaFilter !== 'all') result = result.filter(t => t.area === areaFilter);
    if (projectFilter) result = result.filter(t => t.project_id === projectFilter);
    if (search) { const q = search.toLowerCase(); result = result.filter(t => t.title.toLowerCase().includes(q)); }

    switch (sortBy) {
      case 'date_completed':
        return result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      case 'project':
        return result.sort((a, b) => {
          const pA = a.project_id ? (projectMap.get(a.project_id)?.name ?? '') : 'zzz';
          const pB = b.project_id ? (projectMap.get(b.project_id)?.name ?? '') : 'zzz';
          return pA.localeCompare(pB) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      case 'area':
        return result.sort((a, b) => a.area.localeCompare(b.area) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      default:
        return result;
    }
  }, [tasks, areaFilter, projectFilter, search, sortBy, projectMap]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const toggleSelect = useCallback((id: string) => { setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-sans font-bold flex items-center gap-2">
            <span>📦</span> Archive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{doneTasks.length} completed tasks</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <FilterBar search={search} onSearchChange={setSearch} areaFilter={areaFilter} onAreaChange={setAreaFilter}
              projectFilter={projectFilter} onProjectChange={setProjectFilter} projects={projects} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_completed">Date Completed</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="area">Area</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TaskTable tasks={doneTasks} projects={projects} selectedIds={selectedIds} onToggleSelect={toggleSelect}
          onSelectAll={() => setSelectedIds(prev => prev.size === doneTasks.length ? new Set() : new Set(doneTasks.map(t => t.id)))}
          onTaskClick={setDetailTask} onInlineUpdate={handleUpdate} />
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={id => deleteTask.mutate(id, { onSuccess: () => toast.success('Deleted') })} projects={projects} milestones={milestones} />
    </AppShell>
  );
}
