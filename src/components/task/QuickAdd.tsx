import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS, STATUSES, type TaskArea, type TaskStatus } from '@/types/task';
import type { Project } from '@/types/task';
import { Plus } from 'lucide-react';

interface QuickAddProps {
  defaultStatus?: TaskStatus;
  projects?: Project[];
  defaultProjectId?: string;
  onAdd: (title: string, area: TaskArea, status: TaskStatus, projectId: string | null) => void;
}

export function QuickAdd({ defaultStatus = 'Next', projects = [], defaultProjectId, onAdd }: QuickAddProps) {
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<TaskArea>('Personal');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), area, status, projectId || null);
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-md border bg-card p-2">
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Add a task..."
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 font-mono text-sm"
      />
      <Select value={area} onValueChange={v => setArea(v as TaskArea)}>
        <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={status} onValueChange={v => setStatus(v as TaskStatus)}>
        <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      {projects.length > 0 && (
        <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </form>
  );
}
