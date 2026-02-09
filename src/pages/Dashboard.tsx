import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useSeedData } from '@/hooks/useSeedData';
import type { Task, TaskArea, TaskStatus, TaskUpdate, ViewTab, TaskInsert } from '@/types/task';
import { QuickAdd } from '@/components/task/QuickAdd';
import { TaskTable } from '@/components/task/TaskTable';
import { KanbanBoard } from '@/components/task/KanbanBoard';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { BulkAddModal } from '@/components/task/BulkAddModal';
import { BulkActions } from '@/components/task/BulkActions';
import { FilterBar } from '@/components/task/FilterBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';

const TABS: { value: ViewTab; label: string }[] = [
  { value: 'next', label: 'Next' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All Tasks' },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { tasks, isLoading, createTask, createManyTasks, updateTask, bulkUpdateTasks, deleteTask } = useTasks();
  useSeedData();

  const [activeTab, setActiveTab] = useState<ViewTab>('next');
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);

  const projects = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => { if (t.project) set.add(t.project); });
    return Array.from(set).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks;

    // Tab filter
    if (activeTab === 'next') result = result.filter(t => t.status === 'Next');
    else if (activeTab === 'waiting') result = result.filter(t => t.status === 'Waiting');
    else if (activeTab === 'done') result = result.filter(t => t.status === 'Done');
    // kanban and all show everything

    // Area filter
    if (areaFilter !== 'all') result = result.filter(t => t.area === areaFilter);

    // Project filter
    if (projectFilter) result = result.filter(t => t.project === projectFilter);

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.context?.toLowerCase().includes(q)) ||
        (t.project?.toLowerCase().includes(q))
      );
    }

    return result;
  }, [tasks, activeTab, areaFilter, projectFilter, search]);

  const handleQuickAdd = useCallback((title: string, area: TaskArea, status: TaskStatus) => {
    createTask.mutate({ title, area, status, context: null, notes: null, tags: [], project: null, blocked_by: null, source: null }, {
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

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => {
    updateTask.mutate({ id, ...updates });
  }, [updateTask]);

  const handleBulkUpdate = useCallback((updates: TaskUpdate) => {
    const ids = Array.from(selectedIds);
    bulkUpdateTasks.mutate({ ids, updates }, {
      onSuccess: () => { toast.success(`${ids.length} tasks updated`); setSelectedIds(new Set()); },
    });
  }, [selectedIds, bulkUpdateTasks]);

  const handleDelete = useCallback((id: string) => {
    deleteTask.mutate(id, { onSuccess: () => toast.success('Task deleted') });
  }, [deleteTask]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map(t => t.id))
    );
  }, [filtered]);

  const defaultStatus: TaskStatus = activeTab === 'waiting' ? 'Waiting' : activeTab === 'done' ? 'Done' : 'Next';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tight">Task OS</h1>
            <p className="text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-xs">
            <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Tabs */}
        <nav className="flex items-center gap-1 border-b">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setSelectedIds(new Set()); }}
              className={cn(
                'px-3 py-2 text-xs font-medium font-mono border-b-2 transition-colors -mb-[1px]',
                activeTab === tab.value
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            areaFilter={areaFilter}
            onAreaChange={setAreaFilter}
            projectFilter={projectFilter}
            onProjectChange={setProjectFilter}
            projects={projects}
          />
          <div className="flex items-center gap-2">
            <BulkActions
              selectedCount={selectedIds.size}
              selectedTasks={filtered.filter(t => selectedIds.has(t.id))}
              onBulkUpdate={handleBulkUpdate}
              onClearSelection={() => setSelectedIds(new Set())}
              allTasks={tasks}
            />
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setBulkAddOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Bulk Add
            </Button>
          </div>
        </div>

        {/* Quick Add */}
        <QuickAdd defaultStatus={defaultStatus} onAdd={handleQuickAdd} />

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading tasks...</div>
        ) : activeTab === 'kanban' ? (
          <KanbanBoard
            tasks={filtered}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onTaskClick={setDetailTask}
            onStatusChange={(id, status) => handleUpdate(id, { status })}
          />
        ) : (
          <TaskTable
            tasks={filtered}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onTaskClick={setDetailTask}
            onInlineUpdate={handleUpdate}
          />
        )}
      </main>

      {/* Modals */}
      <TaskDetailDrawer
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
      <BulkAddModal
        open={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)}
        onConfirm={handleBulkAdd}
      />
    </div>
  );
}
