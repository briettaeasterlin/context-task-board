import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { ProjectCard } from '@/components/project/ProjectCard';
import { AppShell } from '@/components/layout/AppShell';
import { FilterBar } from '@/components/task/FilterBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS, type TaskArea, type Project } from '@/types/task';
import { Plus, AlertTriangle, Merge, X } from 'lucide-react';
import { toast } from 'sonner';

interface DuplicateGroup {
  normalizedName: string;
  projects: Project[];
}

function detectDuplicates(projects: Project[]): DuplicateGroup[] {
  const groups = new Map<string, Project[]>();
  for (const p of projects) {
    const key = p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const existing = groups.get(key) ?? [];
    existing.push(p);
    groups.set(key, existing);
  }
  return Array.from(groups.entries())
    .filter(([, ps]) => ps.length > 1)
    .map(([normalizedName, projects]) => ({ normalizedName, projects }));
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, createProject, updateProject, deleteProject } = useProjects();
  const { tasks, updateTask } = useTasks();
  const { clarifyQuestions } = useClarifyQuestions();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState<TaskArea>('Personal');
  const [newSummary, setNewSummary] = useState('');
  const [dismissedDuplicates, setDismissedDuplicates] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

  const duplicates = useMemo(() =>
    detectDuplicates(projects).filter(g => !dismissedDuplicates.has(g.normalizedName)),
    [projects, dismissedDuplicates]
  );

  const handleMerge = useCallback(async (group: DuplicateGroup) => {
    setMerging(true);
    try {
      // Keep the project with the most tasks; break ties by oldest
      const projectTaskCounts = group.projects.map(p => ({
        project: p,
        taskCount: tasks.filter(t => t.project_id === p.id).length,
      }));
      projectTaskCounts.sort((a, b) => b.taskCount - a.taskCount || new Date(a.project.created_at).getTime() - new Date(b.project.created_at).getTime());

      const keeper = projectTaskCounts[0].project;
      const duplicates = projectTaskCounts.slice(1).map(p => p.project);

      // Move all tasks from duplicates to keeper
      for (const dup of duplicates) {
        const dupTasks = tasks.filter(t => t.project_id === dup.id);
        for (const t of dupTasks) {
          await updateTask.mutateAsync({ id: t.id, project_id: keeper.id });
        }
        // Soft-delete the duplicate project
        await deleteProject.mutateAsync(dup.id);
      }

      // Merge summaries if keeper has no summary but a duplicate does
      if (!keeper.summary) {
        const donorSummary = duplicates.find(d => d.summary)?.summary;
        if (donorSummary) {
          await updateProject.mutateAsync({ id: keeper.id, summary: donorSummary });
        }
      }

      toast.success(`Merged ${group.projects.length} "${keeper.name}" projects into one`);
    } catch (err: any) {
      toast.error(err.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  }, [tasks, updateTask, deleteProject, updateProject]);

  const filtered = projects.filter(p => {
    if (areaFilter !== 'all' && p.area !== areaFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProject.mutate({ name: newName.trim(), area: newArea, summary: newSummary || null, scope_notes: null }, {
      onSuccess: () => { toast.success('Project created'); setCreateOpen(false); setNewName(''); setNewSummary(''); },
      onError: e => toast.error(e.message),
    });
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Duplicate Detection Banner */}
        {duplicates.length > 0 && (
          <div className="space-y-2">
            {duplicates.map(group => (
              <Card key={group.normalizedName} className="p-4 rounded-2xl border-status-waiting/40 bg-status-waiting/5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-status-waiting shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      Duplicate detected: <span className="font-semibold">"{group.projects[0].name}"</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {group.projects.length} projects with this name.
                      {group.projects.map(p => {
                        const count = tasks.filter(t => t.project_id === p.id).length;
                        return ` ${p.area}: ${count} task${count !== 1 ? 's' : ''}`;
                      }).join(' ·')}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1 rounded-lg"
                        disabled={merging}
                        onClick={() => handleMerge(group)}
                      >
                        <Merge className="h-3 w-3" /> Merge into one
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 rounded-lg"
                        onClick={() => setDismissedDuplicates(prev => new Set([...prev, group.normalizedName]))}
                      >
                        <X className="h-3 w-3" /> Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold">Projects</h2>
          <Button size="sm" className="text-xs h-7" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> New Project
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="h-8 text-sm max-w-[250px]" />
          <Select value={areaFilter} onValueChange={v => setAreaFilter(v as TaskArea | 'all')}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} tasks={tasks.filter(t => t.project_id === p.id)}
              clarifyCount={clarifyQuestions.filter(q => q.project_id === p.id && q.status === 'open').length}
              onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">No projects yet.</p>}
        </div>
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-mono text-sm">New Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} className="text-sm" /></div>
            <div className="space-y-1"><Label className="text-xs">Area</Label>
              <Select value={newArea} onValueChange={v => setNewArea(v as TaskArea)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Summary</Label><Textarea value={newSummary} onChange={e => setNewSummary(e.target.value)} rows={2} className="text-sm" placeholder="What does success look like?" /></div>
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
