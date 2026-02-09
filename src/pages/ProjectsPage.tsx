import { useState, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS, type TaskArea } from '@/types/task';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, createProject } = useProjects();
  const { tasks } = useTasks();
  const { clarifyQuestions } = useClarifyQuestions();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState<TaskArea>('Personal');
  const [newSummary, setNewSummary] = useState('');

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
