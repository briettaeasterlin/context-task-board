import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { ProjectCard } from '@/components/project/ProjectCard';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS, type TaskArea, type Project } from '@/types/task';
import { Plus, AlertTriangle, Merge, X, TrendingUp, Briefcase, Settings, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { inferStrategicCategory } from '@/lib/task-scoring';

// ─── Work Categories ───

type WorkCategory = 'pipeline' | 'client' | 'business' | 'personal';

interface CategoryConfig {
  label: string;
  icon: React.ReactNode;
  borderClass: string;
  bgClass: string;
  headerClass: string;
  dotClass: string;
}

const CATEGORY_CONFIG: Record<WorkCategory, CategoryConfig> = {
  pipeline: {
    label: '📈 Pipeline',
    icon: <TrendingUp className="h-4 w-4" />,
    borderClass: 'border-l-[hsl(var(--cat-pipeline))]',
    bgClass: 'bg-[hsl(var(--cat-pipeline)/0.04)]',
    headerClass: 'text-[hsl(var(--cat-pipeline))]',
    dotClass: 'bg-[hsl(var(--cat-pipeline))]',
  },
  client: {
    label: '💼 Client Work',
    icon: <Briefcase className="h-4 w-4" />,
    borderClass: 'border-l-[hsl(var(--cat-client))]',
    bgClass: 'bg-[hsl(var(--cat-client)/0.04)]',
    headerClass: 'text-[hsl(var(--cat-client))]',
    dotClass: 'bg-[hsl(var(--cat-client))]',
  },
  business: {
    label: '⚙️ Business / Admin / Finance',
    icon: <Settings className="h-4 w-4" />,
    borderClass: 'border-l-[hsl(var(--cat-business))]',
    bgClass: 'bg-[hsl(var(--cat-business)/0.04)]',
    headerClass: 'text-[hsl(var(--cat-business))]',
    dotClass: 'bg-[hsl(var(--cat-business))]',
  },
  personal: {
    label: '💜 Personal / Family',
    icon: <Heart className="h-4 w-4" />,
    borderClass: 'border-l-[hsl(var(--cat-personal))]',
    bgClass: 'bg-[hsl(var(--cat-personal)/0.04)]',
    headerClass: 'text-[hsl(var(--cat-personal))]',
    dotClass: 'bg-[hsl(var(--cat-personal))]',
  },
};

const CATEGORY_ORDER: WorkCategory[] = ['pipeline', 'client', 'business', 'personal'];

function classifyProject(project: Project, tasks: { area: TaskArea; title: string; context: string | null; notes: string | null }[]): WorkCategory {
  // Check if project has strategic_phase set
  const phase = (project as any).strategic_phase;
  if (phase === 'scoping' || phase === 'closed_followup') return 'pipeline';
  if (phase === 'active_engagement') return 'client';
  if (phase === 'internal_ops') return 'business';

  // Fall back to area-based mapping
  if (project.area === 'Client') return 'client';
  if (project.area === 'Personal' || project.area === 'Home' || project.area === 'Family') return 'personal';
  if (project.area === 'Business') {
    // Check if any tasks suggest pipeline work
    const hasPipeline = tasks.some(t => {
      const cat = inferStrategicCategory(t as any);
      return cat === 'pipeline_relationship' || cat === 'revenue_generation';
    });
    if (hasPipeline) return 'pipeline';
    return 'business';
  }
  return 'personal';
}

// ─── Duplicate Detection ───

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

// ─── Page ───

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, createProject, updateProject, deleteProject } = useProjects();
  const { tasks, updateTask } = useTasks();
  const { clarifyQuestions } = useClarifyQuestions();
  const [search, setSearch] = useState('');
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
      const projectTaskCounts = group.projects.map(p => ({
        project: p,
        taskCount: tasks.filter(t => t.project_id === p.id).length,
      }));
      projectTaskCounts.sort((a, b) => b.taskCount - a.taskCount || new Date(a.project.created_at).getTime() - new Date(b.project.created_at).getTime());

      const keeper = projectTaskCounts[0].project;
      const dupes = projectTaskCounts.slice(1).map(p => p.project);

      for (const dup of dupes) {
        const dupTasks = tasks.filter(t => t.project_id === dup.id);
        for (const t of dupTasks) {
          await updateTask.mutateAsync({ id: t.id, project_id: keeper.id });
        }
        await deleteProject.mutateAsync(dup.id);
      }

      if (!keeper.summary) {
        const donorSummary = dupes.find(d => d.summary)?.summary;
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

  // Group projects by work category
  const groupedProjects = useMemo(() => {
    const filtered = projects.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    );

    const groups: Record<WorkCategory, Project[]> = {
      pipeline: [], client: [], business: [], personal: [],
    };

    for (const p of filtered) {
      const projectTasks = tasks.filter(t => t.project_id === p.id);
      const cat = classifyProject(p, projectTasks);
      groups[cat].push(p);
    }

    return groups;
  }, [projects, tasks, search]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProject.mutate({ name: newName.trim(), area: newArea, summary: newSummary || null, scope_notes: null }, {
      onSuccess: () => { toast.success('Project created'); setCreateOpen(false); setNewName(''); setNewSummary(''); },
      onError: e => toast.error(e.message),
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
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
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1 rounded-lg" disabled={merging} onClick={() => handleMerge(group)}>
                        <Merge className="h-3 w-3" /> Merge into one
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 rounded-lg" onClick={() => setDismissedDuplicates(prev => new Set([...prev, group.normalizedName]))}>
                        <X className="h-3 w-3" /> Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Projects</h1>
          <div className="flex gap-2 items-center">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="h-8 text-sm w-[180px]" />
            <Button size="sm" className="text-xs h-8 gap-1" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Project
            </Button>
          </div>
        </div>

        {/* Category Sections */}
        {CATEGORY_ORDER.map(cat => {
          const config = CATEGORY_CONFIG[cat];
          const catProjects = groupedProjects[cat];
          if (catProjects.length === 0) return null;

          return (
            <section key={cat}>
              <div className={cn(
                "rounded-2xl border-l-4 overflow-hidden",
                config.borderClass,
                config.bgClass,
              )}>
                {/* Section header */}
                <div className="px-5 py-3 flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", config.dotClass)} />
                  <h2 className={cn("font-display font-semibold text-sm", config.headerClass)}>
                    {config.label}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] h-4 rounded-full ml-1">
                    {catProjects.length}
                  </Badge>
                </div>

                {/* Project cards */}
                <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catProjects.map(p => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      tasks={tasks.filter(t => t.project_id === p.id)}
                      clarifyCount={clarifyQuestions.filter(q => q.project_id === p.id && q.status === 'open').length}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No projects yet. Create one to get started.</p>
        )}
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
