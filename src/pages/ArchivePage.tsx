import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { FilterBar } from '@/components/task/FilterBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw } from 'lucide-react';
import type { Task, TaskArea, TaskUpdate, Project } from '@/types/task';
import { toast } from 'sonner';

type SortOption = 'date_completed' | 'project' | 'area';
type ArchiveTab = 'completed' | 'deleted_tasks' | 'deleted_projects';

export default function ArchivePage() {
  const { user } = useAuth();
  const { tasks, updateTask, deleteTask } = useTasks();
  const { projects, updateProject } = useProjects();
  const { milestones } = useMilestones();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('date_completed');
  const [tab, setTab] = useState<ArchiveTab>('completed');

  // Fetch soft-deleted tasks
  const deletedTasksQuery = useQuery({
    queryKey: ['deleted-tasks', user?.id],
    queryFn: async (): Promise<Task[]> => {
      if (!user) return [];
      const { data, error } = await supabase.from('tasks').select('*')
        .eq('user_id', user.id).not('deleted_at', 'is', null)
        .order('deleted_at' as any, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
    enabled: !!user,
  });

  // Fetch soft-deleted projects
  const deletedProjectsQuery = useQuery({
    queryKey: ['deleted-projects', user?.id],
    queryFn: async (): Promise<Project[]> => {
      if (!user) return [];
      const { data, error } = await supabase.from('projects').select('*')
        .eq('user_id', user.id).not('deleted_at', 'is', null)
        .order('deleted_at' as any, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Project[];
    },
    enabled: !!user,
  });

  const deletedTasks = deletedTasksQuery.data ?? [];
  const deletedProjects = deletedProjectsQuery.data ?? [];

  // All projects for lookups (active + deleted)
  const allProjects = useMemo(() => [...projects, ...deletedProjects], [projects, deletedProjects]);
  const projectMap = useMemo(() => new Map(allProjects.map(p => [p.id, p])), [allProjects]);

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

  const filteredDeletedTasks = useMemo(() => {
    let result = [...deletedTasks];
    if (areaFilter !== 'all') result = result.filter(t => t.area === areaFilter);
    if (search) { const q = search.toLowerCase(); result = result.filter(t => t.title.toLowerCase().includes(q)); }
    return result;
  }, [deletedTasks, areaFilter, search]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const toggleSelect = useCallback((id: string) => { setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);

  const restoreTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('tasks').update({ deleted_at: null } as any).eq('id', id);
    if (error) { toast.error('Failed to restore'); return; }
    toast.success('Task restored');
    deletedTasksQuery.refetch();
  }, [deletedTasksQuery]);

  const restoreProject = useCallback(async (id: string) => {
    const { error } = await supabase.from('projects').update({ deleted_at: null } as any).eq('id', id);
    if (error) { toast.error('Failed to restore'); return; }
    toast.success('Project restored');
    deletedProjectsQuery.refetch();
  }, [deletedProjectsQuery]);

  const formatPacific = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-sans font-bold flex items-center gap-2">
            <span>📦</span> Archive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {doneTasks.length} completed · {deletedTasks.length} deleted tasks · {deletedProjects.length} deleted projects
          </p>
        </div>

        <Tabs value={tab} onValueChange={v => setTab(v as ArchiveTab)}>
          <TabsList>
            <TabsTrigger value="completed" className="text-xs">
              ✅ Completed ({doneTasks.length})
            </TabsTrigger>
            <TabsTrigger value="deleted_tasks" className="text-xs">
              🗑️ Deleted Tasks ({deletedTasks.length})
            </TabsTrigger>
            <TabsTrigger value="deleted_projects" className="text-xs">
              🗑️ Deleted Projects ({deletedProjects.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'completed' && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <FilterBar search={search} onSearchChange={setSearch} areaFilter={areaFilter} onAreaChange={setAreaFilter}
                  projectFilter={projectFilter} onProjectChange={setProjectFilter} projects={allProjects} />
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

            <TaskTable tasks={doneTasks} projects={allProjects} selectedIds={selectedIds} onToggleSelect={toggleSelect}
              onSelectAll={() => setSelectedIds(prev => prev.size === doneTasks.length ? new Set() : new Set(doneTasks.map(t => t.id)))}
              onTaskClick={setDetailTask} onInlineUpdate={handleUpdate} showCompletedAt />
          </>
        )}

        {tab === 'deleted_tasks' && (
          <>
            <FilterBar search={search} onSearchChange={setSearch} areaFilter={areaFilter} onAreaChange={setAreaFilter}
              projectFilter="" onProjectChange={() => {}} projects={[]} />
            <div className="space-y-2">
              {filteredDeletedTasks.length === 0 && (
                <Card className="p-8 text-center rounded-xl">
                  <p className="text-sm text-muted-foreground">No deleted tasks.</p>
                </Card>
              )}
              {filteredDeletedTasks.map(task => (
                <Card key={task.id} className="p-3 flex items-center gap-3 rounded-xl opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-through">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] rounded-full">{task.area}</Badge>
                      <Badge variant="secondary" className="text-[10px] rounded-full">{task.status}</Badge>
                      {task.project_id && projectMap.get(task.project_id) && (
                        <span className="text-[10px] text-muted-foreground">{projectMap.get(task.project_id)!.name}</span>
                      )}
                      {(task as any).deleted_at && (
                        <span className="text-[10px] text-muted-foreground font-mono">Deleted {formatPacific((task as any).deleted_at)}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs rounded-lg shrink-0"
                    onClick={() => restoreTask(task.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Restore
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === 'deleted_projects' && (
          <div className="space-y-2">
            {deletedProjects.length === 0 && (
              <Card className="p-8 text-center rounded-xl">
                <p className="text-sm text-muted-foreground">No deleted projects.</p>
              </Card>
            )}
            {deletedProjects.map(project => (
              <Card key={project.id} className="p-4 flex items-center gap-3 rounded-xl opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-through">{project.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] rounded-full">{project.area}</Badge>
                    {project.summary && <span className="text-xs text-muted-foreground truncate">{project.summary}</span>}
                    {(project as any).deleted_at && (
                      <span className="text-[10px] text-muted-foreground font-mono">Deleted {formatPacific((project as any).deleted_at)}</span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs rounded-lg shrink-0"
                  onClick={() => restoreProject(project.id)}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Restore
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={id => deleteTask.mutate(id, { onSuccess: () => toast.success('Deleted') })} projects={allProjects} milestones={milestones} />
    </AppShell>
  );
}
