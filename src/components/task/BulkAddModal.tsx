import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS, STATUSES, type TaskArea, type TaskStatus, parseTaskLine, type TaskInsert, type Project } from '@/types/task';
import { AreaBadge } from './AreaBadge';
import { StatusBadge } from './StatusBadge';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (tasks: Omit<TaskInsert, 'user_id'>[]) => void;
  projects?: Project[];
}

export function BulkAddModal({ open, onClose, onConfirm, projects = [] }: Props) {
  const [text, setText] = useState('');
  const [defaultArea, setDefaultArea] = useState<TaskArea>('Personal');
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('Next');
  const [projectId, setProjectId] = useState('');

  const parsed = text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const task = parseTaskLine(l, defaultArea, defaultStatus);
    return { ...task, project_id: projectId || null };
  });

  const handleConfirm = () => {
    if (parsed.length === 0) return;
    onConfirm(parsed);
    setText('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">Bulk Add Tasks</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Default Area</Label>
              <Select value={defaultArea} onValueChange={v => setDefaultArea(v as TaskArea)}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Default Status</Label>
              <Select value={defaultStatus} onValueChange={v => setDefaultStatus(v as TaskStatus)}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {projects.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Paste tasks (one per line)</Label>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={8} className="font-mono text-xs"
              placeholder={"Buy groceries [Area=Home]\nReceive JSON [Area=Client] [Status=Waiting] — Waiting on S3"} />
          </div>
          {parsed.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Preview ({parsed.length} tasks)</Label>
              <div className="rounded border bg-muted/30 max-h-[200px] overflow-y-auto">
                {parsed.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 text-xs">
                    <span className="font-mono flex-1 truncate">{t.title}</span>
                    <AreaBadge area={t.area} className="text-[10px]" />
                    <StatusBadge status={t.status} className="text-[10px]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={parsed.length === 0}>Add {parsed.length} tasks</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
