import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS, STATUSES, type Task, type TaskArea, type TaskStatus, type TaskUpdate, type Project, type Milestone } from '@/types/task';
import { Trash2 } from 'lucide-react';
import { estimateDuration, suggestImpactScore, DURATION_MINUTES } from '@/lib/task-scoring';

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  projects?: Project[];
  milestones?: Milestone[];
}

export function TaskDetailDrawer({ task, open, onClose, onUpdate, onDelete, projects = [], milestones = [] }: Props) {
  const [form, setForm] = useState({
    title: '', context: '', notes: '', blocked_by: '',
    area: 'Personal' as TaskArea, status: 'Backlog' as TaskStatus,
    project_id: '', milestone_id: '',
    due_date: '', target_window: '',
    impact_score: '' as string,
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        context: task.context ?? '',
        notes: task.notes ?? '',
        blocked_by: task.blocked_by ?? '',
        area: task.area,
        status: task.status,
        project_id: task.project_id ?? '',
        milestone_id: task.milestone_id ?? '',
        due_date: task.due_date ?? '',
        target_window: task.target_window ?? '',
        impact_score: (task as any).impact_score?.toString() ?? '',
      });
    }
  }, [task]);

  if (!task) return null;

  const projectMilestones = milestones.filter(m => m.project_id === form.project_id);

  const save = () => {
    onUpdate(task.id, {
      title: form.title,
      context: form.context || null,
      notes: form.notes || null,
      blocked_by: form.blocked_by || null,
      area: form.area,
      status: form.status,
      project_id: form.project_id || null,
      milestone_id: form.milestone_id || null,
      due_date: form.due_date || null,
      target_window: form.target_window || null,
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">Edit Task</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="font-mono text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Area</Label>
              <Select value={form.area} onValueChange={v => setForm(f => ({ ...f, area: v as TaskArea }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TaskStatus }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Select value={form.project_id || 'none'} onValueChange={v => setForm(f => ({ ...f, project_id: v === 'none' ? '' : v, milestone_id: '' }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {projectMilestones.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Milestone</Label>
              <Select value={form.milestone_id || 'none'} onValueChange={v => setForm(f => ({ ...f, milestone_id: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="No milestone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No milestone</SelectItem>
                  {projectMilestones.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Context</Label>
            <Textarea value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} rows={3} className="text-sm" placeholder="Clarifying details..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="text-sm" />
          </div>
          {form.status === 'Waiting' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Blocked by</Label>
              <Input value={form.blocked_by} onChange={e => setForm(f => ({ ...f, blocked_by: e.target.value }))} className="text-sm" />
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="text-sm" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Target Window</Label>
              <Input value={form.target_window} onChange={e => setForm(f => ({ ...f, target_window: e.target.value }))} className="text-sm" placeholder="e.g. this week, next month" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} className="flex-1">Save</Button>
            <Button variant="outline" onClick={() => { onUpdate(task.id, { status: 'Next' }); onClose(); }} className="text-xs">→ Next</Button>
            <Button variant="outline" onClick={() => { onUpdate(task.id, { status: 'Done' }); onClose(); }} className="text-xs">✓ Done</Button>
          </div>
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs" onClick={() => { onDelete(task.id); onClose(); }}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete task
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2 font-mono">
              Created {new Date(task.created_at).toLocaleDateString()} · Updated {new Date(task.updated_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
