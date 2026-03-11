import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Merge, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import type { Project, Task } from '@/types/task';

// ─── Similarity helpers ───

function tokenize(name: string): Set<string> {
  return new Set(
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function taskOverlapScore(
  projectA: string,
  projectB: string,
  tasks: Task[]
): number {
  const tasksA = tasks.filter(t => t.project_id === projectA);
  const tasksB = tasks.filter(t => t.project_id === projectB);
  if (tasksA.length === 0 || tasksB.length === 0) return 0;

  const titlesB = new Set(tasksB.map(t => t.title.toLowerCase().trim()));
  let overlap = 0;
  for (const t of tasksA) {
    if (titlesB.has(t.title.toLowerCase().trim())) overlap++;
  }
  return overlap / Math.min(tasksA.length, tasksB.length);
}

export interface DuplicateCandidate {
  projectA: Project;
  projectB: Project;
  reason: string;
  confidence: 'high' | 'medium';
}

function detectSimilarProjects(projects: Project[], tasks: Task[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];
      const key = [a.id, b.id].sort().join(':');
      if (seen.has(key)) continue;

      // Exact normalized name match
      const normA = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normB = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normA === normB) {
        seen.add(key);
        candidates.push({ projectA: a, projectB: b, reason: 'Same name', confidence: 'high' });
        continue;
      }

      // Fuzzy name similarity
      const tokensA = tokenize(a.name);
      const tokensB = tokenize(b.name);
      const nameSim = jaccardSimilarity(tokensA, tokensB);

      // Task overlap
      const taskOverlap = taskOverlapScore(a.id, b.id, tasks);

      // Same area + high task overlap
      if (taskOverlap > 0.3) {
        seen.add(key);
        candidates.push({
          projectA: a, projectB: b,
          reason: `${Math.round(taskOverlap * 100)}% task overlap`,
          confidence: taskOverlap > 0.5 ? 'high' : 'medium',
        });
        continue;
      }

      // High name similarity
      if (nameSim > 0.4) {
        seen.add(key);
        candidates.push({
          projectA: a, projectB: b,
          reason: 'Similar names',
          confidence: nameSim > 0.6 ? 'high' : 'medium',
        });
        continue;
      }

      // Same area + similar summary keywords
      if (a.area === b.area && a.summary && b.summary) {
        const sumTokensA = tokenize(a.summary);
        const sumTokensB = tokenize(b.summary);
        const sumSim = jaccardSimilarity(sumTokensA, sumTokensB);
        if (sumSim > 0.4) {
          seen.add(key);
          candidates.push({
            projectA: a, projectB: b,
            reason: 'Similar descriptions',
            confidence: 'medium',
          });
        }
      }
    }
  }

  return candidates.sort((a, b) => (a.confidence === 'high' ? 0 : 1) - (b.confidence === 'high' ? 0 : 1));
}

// ─── Manual Merge UI ───

interface ManualMergeProps {
  projects: Project[];
  onMerge: (keepId: string, removeId: string) => Promise<void>;
}

function ManualMerge({ projects, onMerge }: ManualMergeProps) {
  const [projectA, setProjectA] = useState('');
  const [projectB, setProjectB] = useState('');
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    if (!projectA || !projectB || projectA === projectB) return;
    setMerging(true);
    try {
      await onMerge(projectA, projectB);
      setProjectA('');
      setProjectB('');
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card className="p-4 rounded-xl shadow-card border-border/50">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Merge className="h-4 w-4" /> Merge Two Projects
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Keep this project</label>
          <Select value={projectA} onValueChange={setProjectA}>
            <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="Select project…" /></SelectTrigger>
            <SelectContent>
              {projects.filter(p => p.id !== projectB).map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground self-center hidden sm:block">←</span>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Merge & remove this one</label>
          <Select value={projectB} onValueChange={setProjectB}>
            <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="Select project…" /></SelectTrigger>
            <SelectContent>
              {projects.filter(p => p.id !== projectA).map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-9 text-xs rounded-lg gap-1" disabled={!projectA || !projectB || projectA === projectB || merging} onClick={handleMerge}>
          <Merge className="h-3 w-3" /> {merging ? 'Merging…' : 'Merge'}
        </Button>
      </div>
    </Card>
  );
}

// ─── Main Component ───

export function DuplicateDetector() {
  const { projects, updateProject, deleteProject } = useProjects();
  const { tasks, updateTask } = useTasks();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState<string | null>(null);

  const candidates = useMemo(
    () => detectSimilarProjects(projects, tasks).filter(c => {
      const key = [c.projectA.id, c.projectB.id].sort().join(':');
      return !dismissed.has(key);
    }),
    [projects, tasks, dismissed]
  );

  const mergeProjects = useCallback(async (keepId: string, removeId: string) => {
    const keeper = projects.find(p => p.id === keepId);
    const removing = projects.find(p => p.id === removeId);
    if (!keeper || !removing) return;

    // Move all tasks from removed project to kept project
    const tasksToMove = tasks.filter(t => t.project_id === removeId);
    for (const t of tasksToMove) {
      await updateTask.mutateAsync({ id: t.id, project_id: keepId });
    }

    // Copy summary if keeper doesn't have one
    if (!keeper.summary && removing.summary) {
      await updateProject.mutateAsync({ id: keepId, summary: removing.summary });
    }

    // Soft-delete the removed project
    await deleteProject.mutateAsync(removeId);

    toast.success(`Merged "${removing.name}" into "${keeper.name}" (${tasksToMove.length} tasks moved)`);
  }, [projects, tasks, updateTask, updateProject, deleteProject]);

  const handleCandidateMerge = useCallback(async (candidate: DuplicateCandidate, keepId: string) => {
    const removeId = keepId === candidate.projectA.id ? candidate.projectB.id : candidate.projectA.id;
    const key = [candidate.projectA.id, candidate.projectB.id].sort().join(':');
    setMerging(key);
    try {
      await mergeProjects(keepId, removeId);
    } finally {
      setMerging(null);
    }
  }, [mergeProjects]);

  const dismiss = useCallback((candidate: DuplicateCandidate) => {
    const key = [candidate.projectA.id, candidate.projectB.id].sort().join(':');
    setDismissed(prev => new Set([...prev, key]));
  }, []);

  return (
    <div className="space-y-3">
      {/* AI-Suggested Duplicates */}
      {candidates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-status-waiting">
            <AlertTriangle className="h-4 w-4" />
            Possible Duplicates ({candidates.length})
          </h3>
          {candidates.map(c => {
            const key = [c.projectA.id, c.projectB.id].sort().join(':');
            const isMerging = merging === key;
            const taskCountA = tasks.filter(t => t.project_id === c.projectA.id).length;
            const taskCountB = tasks.filter(t => t.project_id === c.projectB.id).length;

            return (
              <Card key={key} className="p-4 rounded-xl border-status-waiting/30 bg-status-waiting/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{c.projectA.name}</span>
                      <Badge variant="outline" className="text-[10px]">{taskCountA} tasks</Badge>
                      <span className="text-xs text-muted-foreground">↔</span>
                      <span className="text-sm font-semibold">{c.projectB.name}</span>
                      <Badge variant="outline" className="text-[10px]">{taskCountB} tasks</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={c.confidence === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                        {c.confidence}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{c.reason}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Button size="sm" variant="default" className="h-7 text-xs gap-1 rounded-lg" disabled={isMerging}
                    onClick={() => handleCandidateMerge(c, taskCountA >= taskCountB ? c.projectA.id : c.projectB.id)}>
                    <Merge className="h-3 w-3" />
                    {isMerging ? 'Merging…' : `Keep "${taskCountA >= taskCountB ? c.projectA.name : c.projectB.name}"`}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-lg" disabled={isMerging}
                    onClick={() => handleCandidateMerge(c, taskCountA >= taskCountB ? c.projectB.id : c.projectA.id)}>
                    <Merge className="h-3 w-3" />
                    Keep "{taskCountA >= taskCountB ? c.projectB.name : c.projectA.name}"
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 rounded-lg" onClick={() => dismiss(c)}>
                    <X className="h-3 w-3" /> Not duplicates
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manual merge — always visible */}
      <ManualMerge projects={projects} onMerge={mergeProjects} />

      {candidates.length === 0 && (
        <p className="text-xs text-muted-foreground">No duplicate projects detected automatically. Use the merge tool above to combine projects with different names.</p>
      )}
    </div>
  );
}
