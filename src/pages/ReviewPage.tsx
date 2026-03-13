import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import type { Task, TaskArea, TaskStatus, TaskUpdate, Project } from '@/types/task';
import { ProjectCard } from '@/components/project/ProjectCard';
import { DuplicateDetector } from '@/components/project/DuplicateDetector';
import { TaskTable } from '@/components/task/TaskTable';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { FilterBar } from '@/components/task/FilterBar';
import { BulkActions } from '@/components/task/BulkActions';
import { KanbanBoard } from '@/components/task/KanbanBoard';
import { StatusReviewPanel } from '@/components/review/StatusReviewPanel';
import { BoardReviewPanel } from '@/components/review/BoardReviewPanel';
import { QuickAdd } from '@/components/task/QuickAdd';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Copy, Check, Plus, Zap, Upload } from 'lucide-react';
import { AIImportPanel } from '@/components/import/AIImportPanel';
import { toast } from 'sonner';
import { differenceInDays, format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS } from '@/types/task';
const VectorSyncPanel = lazy(() => import('@/components/vector/VectorSyncPanel'));

function getRitualMessage(): string {
  const day = new Date().getDay();
  if (day === 5) return "Let's close the week well 🌿";
  return 'Clarity comes from reflection.';
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tasks, createTask, updateTask, bulkUpdateTasks, deleteTask } = useTasks();
  const { projects, createProject } = useProjects();
  const { milestones } = useMilestones();
  const { clarifyQuestions } = useClarifyQuestions();

  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewMode, setReviewMode] = useState(false);
  const [boardReviewMode, setBoardReviewMode] = useState(false);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState<TaskArea>('Personal');
  const [newSummary, setNewSummary] = useState('');

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleBulkUpdate = useCallback((updates: TaskUpdate) => {
    const ids = Array.from(selectedIds);
    bulkUpdateTasks.mutate({ ids, updates }, { onSuccess: () => { toast.success(`${ids.length} updated`); setSelectedIds(new Set()); } });
  }, [selectedIds, bulkUpdateTasks]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id, { onSuccess: () => toast.success('Removed from route') }); }, [deleteTask]);
  const toggleSelect = useCallback((id: string) => { setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);

  // Section 1: What happened
  const doneThisWeek = useMemo(() => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return tasks.filter(t => t.status === 'Done' && new Date(t.updated_at) >= weekAgo);
  }, [tasks]);

  const doneByProject = useMemo(() => {
    const map: Record<string, { project: Project | null; tasks: Task[] }> = {};
    for (const t of doneThisWeek) {
      const key = t.project_id || '__none__';
      if (!map[key]) map[key] = { project: projects.find(p => p.id === t.project_id) ?? null, tasks: [] };
      map[key].tasks.push(t);
    }
    return Object.values(map).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [doneThisWeek, projects]);

  // Section 2: What's stuck
  const staleWaiting = useMemo(() =>
    tasks.filter(t => t.status === 'Waiting' && differenceInDays(new Date(), new Date(t.updated_at)) > 7),
  [tasks]);
  const overloadedNext = useMemo(() => tasks.filter(t => t.status === 'Next'), [tasks]);
  const staleBacklog = useMemo(() =>
    tasks.filter(t => t.status === 'Backlog' && differenceInDays(new Date(), new Date(t.updated_at)) > 30),
  [tasks]);
  const waitingTasks = useMemo(() => tasks.filter(t => t.status === 'Waiting'), [tasks]);

  // Filtered for kanban/table
  const filtered = useMemo(() => {
    let result = tasks;
    if (areaFilter !== 'all') result = result.filter(t => t.area === areaFilter);
    if (projectFilter) result = result.filter(t => t.project_id === projectFilter);
    if (search) { const q = search.toLowerCase(); result = result.filter(t => t.title.toLowerCase().includes(q)); }
    return result;
  }, [tasks, areaFilter, projectFilter, search]);

  const copyAllForAI = useCallback(() => {
    const projectMapLocal = new Map(projects.map(p => [p.id, p]));
    const grouped: Record<string, { project?: Project; tasks: Task[] }> = {};
    for (const t of tasks) {
      const key = t.project_id || '__none__';
      if (!grouped[key]) grouped[key] = { project: t.project_id ? projectMapLocal.get(t.project_id) : undefined, tasks: [] };
      grouped[key].tasks.push(t);
    }
    let text = `Status review of my tasks:\n\n`;
    for (const [, { project, tasks: groupTasks }] of Object.entries(grouped).sort((a, b) => (a[1].project?.name ?? '').localeCompare(b[1].project?.name ?? ''))) {
      text += `## ${project?.name ?? 'No Project'}\n`;
      for (const t of groupTasks) {
        text += `- [${t.status}] ${t.title}`;
        if (t.blocked_by) text += ` — blocked by: ${t.blocked_by}`;
        text += '\n';
      }
      text += '\n';
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000);
    });
  }, [tasks, projects]);

  const handleCreateProject = () => {
    if (!newName.trim()) return;
    createProject.mutate({ name: newName.trim(), area: newArea, summary: newSummary || null, scope_notes: null }, {
      onSuccess: () => { toast.success('Project created'); setCreateOpen(false); setNewName(''); setNewSummary(''); },
    });
  };

  // AI Review mode
  if (reviewMode) {
    return (
      <AppShell>
        <StatusReviewPanel tasks={tasks} projects={projects} onUpdate={handleUpdate} onDelete={handleDelete}
          onClose={() => { setReviewMode(false); queryClient.invalidateQueries({ queryKey: ['tasks'] }); }} />
      </AppShell>
    );
  }

  // Board Review mode
  if (boardReviewMode) {
    return (
      <AppShell>
        <BoardReviewPanel tasks={tasks} projects={projects} onUpdate={handleUpdate} onDelete={handleDelete}
          onClose={() => { setBoardReviewMode(false); queryClient.invalidateQueries({ queryKey: ['tasks'] }); }} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-sans font-bold flex items-center gap-2">
            <span>🔁</span> Route Review
          </h1>
          <p className="text-sm text-muted-foreground mt-1 italic">{getRitualMessage()}</p>
        </div>

        {/* Command input — paste status updates, sprint reports, or high-level direction */}
        <QuickAdd
          defaultStatus="Backlog"
          projects={projects}
          milestones={milestones}
          allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, area: t.area, project_id: t.project_id }))}
          onAdd={(title, area, status, projectId) => {
            createTask.mutate({ title, area, status, context: null, notes: null, tags: [], project_id: projectId, milestone_id: null, blocked_by: null, source: null, due_date: null, target_window: null }, {
              onSuccess: () => toast.success('Added to route'),
            });
          }}
          onTasksCreated={() => queryClient.invalidateQueries()}
        />

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" className="text-xs rounded-lg" onClick={() => setBoardReviewMode(true)}>
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Weekly Route Review
          </Button>
          <Button variant="outline" size="sm" className="text-xs rounded-lg" onClick={() => setReviewMode(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Route Review
          </Button>
          <Button variant="outline" size="sm" className="text-xs rounded-lg" onClick={copyAllForAI}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? 'Copied!' : 'Copy for ChatGPT'}
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="rounded-lg">
            <TabsTrigger value="overview" className="text-sm rounded-lg">📊 Overview</TabsTrigger>
            <TabsTrigger value="stuck" className="text-sm rounded-lg">🚧 What's Stuck</TabsTrigger>
            <TabsTrigger value="projects" className="text-sm rounded-lg">📁 Projects</TabsTrigger>
            <TabsTrigger value="kanban" className="text-sm rounded-lg">🗂️ Kanban</TabsTrigger>
            <TabsTrigger value="import" className="text-sm rounded-lg"><Upload className="h-3.5 w-3.5 mr-1" /> Import</TabsTrigger>
            <TabsTrigger value="vector" className="text-sm rounded-lg">📡 NextMove Sync</TabsTrigger>
          </TabsList>

          {/* Overview: What happened */}
          <TabsContent value="overview">
            <div className="space-y-6">
              <section>
                <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3">
                  <span>✅</span> Completed This Week ({doneThisWeek.length})
                </h2>
                {doneThisWeek.length === 0 ? (
                  <Card className="p-6 text-center rounded-xl shadow-card">
                    <p className="text-sm text-muted-foreground">No tasks completed this week yet.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {doneByProject.map((group, i) => (
                      <Card key={i} className="p-4 rounded-xl shadow-card">
                        <h3 className="font-sans text-sm font-semibold mb-2">{group.project?.name ?? 'Standalone'}</h3>
                        <div className="space-y-1">
                          {group.tasks.map(t => (
                            <div key={t.id} className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="text-status-done">✅</span> {t.title}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-4 rounded-xl shadow-card text-center">
                  <div className="text-2xl font-bold text-status-done">{doneThisWeek.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Done this week</div>
                </Card>
                <Card className="p-4 rounded-xl shadow-card text-center">
                  <div className="text-2xl font-bold text-status-next">{overloadedNext.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">In focus</div>
                </Card>
                <Card className="p-4 rounded-xl shadow-card text-center">
                  <div className="text-2xl font-bold text-status-waiting">{waitingTasks.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Waiting</div>
                </Card>
                <Card className="p-4 rounded-xl shadow-card text-center">
                  <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'Backlog').length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Backlog</div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* What's stuck */}
          <TabsContent value="stuck">
            <div className="space-y-6">
              {staleWaiting.length > 0 && (
                <section>
                  <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3 text-status-waiting">
                    <span>⏳</span> Waiting &gt; 7 Days ({staleWaiting.length})
                  </h2>
                  <div className="space-y-2">
                    {staleWaiting.map(t => (
                      <Card key={t.id} className="p-3 rounded-xl shadow-card cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 transition-all border-status-waiting/20"
                        onClick={() => setDetailTask(t)}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{t.title}</span>
                          <span className="text-xs text-status-waiting">⏳ {t.blocked_by || 'Unknown'} · {differenceInDays(new Date(), new Date(t.updated_at))}d</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {overloadedNext.length > 8 && (
                <section>
                  <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3 text-destructive">
                    <span>🔥</span> Focus Overload ({overloadedNext.length} tasks in Next)
                  </h2>
                  <Card className="p-4 rounded-xl shadow-card">
                    <p className="text-sm text-muted-foreground">You have {overloadedNext.length} tasks marked "Next". Consider moving some to Backlog to reduce cognitive load.</p>
                  </Card>
                </section>
              )}

              {staleBacklog.length > 0 && (
                <section>
                  <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-3 text-muted-foreground">
                    <span>💤</span> Stale Backlog ({staleBacklog.length} untouched &gt; 30d)
                  </h2>
                  <div className="space-y-1">
                    {staleBacklog.slice(0, 10).map(t => (
                      <div key={t.id} className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/30"
                        onClick={() => setDetailTask(t)}>
                        {t.title} <span className="text-xs">· {differenceInDays(new Date(), new Date(t.updated_at))}d ago</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {staleWaiting.length === 0 && overloadedNext.length <= 8 && staleBacklog.length === 0 && (
                <Card className="p-8 text-center rounded-xl shadow-card">
                  <p className="text-sm text-muted-foreground">Nothing stuck! Looking good 🌿</p>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects">
            <div className="space-y-4">
              {/* Duplicate Detection & Merge */}
              <DuplicateDetector />

              <div className="flex items-center justify-between">
                <h2 className="font-sans text-lg font-semibold flex items-center gap-2"><span>📁</span> All Projects</h2>
                <Button size="sm" className="text-xs rounded-lg" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> New Project
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.map(p => (
                  <ProjectCard key={p.id} project={p} tasks={tasks.filter(t => t.project_id === p.id)} milestones={milestones}
                    clarifyCount={clarifyQuestions.filter(q => q.project_id === p.id && q.status === 'open').length}
                    onClick={() => navigate(`/projects/${p.id}`)} />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Kanban */}
          <TabsContent value="kanban">
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <BulkActions selectedCount={selectedIds.size} selectedTasks={filtered.filter(t => selectedIds.has(t.id))}
                  onBulkUpdate={handleBulkUpdate} onBulkDelete={ids => ids.forEach(id => deleteTask.mutate(id, { onSuccess: () => setSelectedIds(new Set()) }))}
                  onClearSelection={() => setSelectedIds(new Set())} allTasks={tasks} projects={projects} />
              </div>
              <FilterBar search={search} onSearchChange={setSearch} areaFilter={areaFilter} onAreaChange={setAreaFilter}
                projectFilter={projectFilter} onProjectChange={setProjectFilter} projects={projects} />
              <KanbanBoard tasks={filtered} projects={projects} selectedIds={selectedIds}
                onToggleSelect={toggleSelect} onTaskClick={setDetailTask}
                onStatusChange={(id, status) => handleUpdate(id, { status })} />
            </div>
          </TabsContent>

          {/* Import */}
          <TabsContent value="import">
            <Card className="p-6 rounded-xl shadow-card">
              <AIImportPanel
                compact
                source="review-import"
                onImportComplete={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
              />
            </Card>
          </TabsContent>

          {/* Vector Sync */}
          <TabsContent value="vector">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
              <VectorSyncPanel />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-sans text-sm">New Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} className="text-sm" /></div>
            <div className="space-y-1"><Label className="text-xs">Area</Label>
              <Select value={newArea} onValueChange={v => setNewArea(v as TaskArea)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Summary</Label><Textarea value={newSummary} onChange={e => setNewSummary(e.target.value)} rows={2} className="text-sm" /></div>
          </div>
          <DialogFooter><Button onClick={handleCreateProject} disabled={!newName.trim()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
