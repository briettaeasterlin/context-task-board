import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AREAS, STATUSES, type TaskArea, type TaskStatus, type Task, type TaskUpdate, type Project } from '@/types/task';
import { Download, X } from 'lucide-react';

interface Props {
  selectedCount: number;
  selectedTasks: Task[];
  onBulkUpdate: (updates: TaskUpdate) => void;
  onClearSelection: () => void;
  allTasks: Task[];
  projects?: Project[];
}

export function BulkActions({ selectedCount, selectedTasks, onBulkUpdate, onClearSelection, allTasks, projects = [] }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  const getProjectName = (t: Task) => t.project_id ? projectMap.get(t.project_id) ?? '' : '';

  const exportAsText = (tasks: Task[]) => {
    const text = tasks.map(t => {
      let line = t.title;
      line += ` [Area=${t.area}] [Status=${t.status}]`;
      const pName = getProjectName(t);
      if (pName) line += ` [Project=${pName}]`;
      if (t.context) line += ` — ${t.context}`;
      return line;
    }).join('\n');
    downloadFile(text, 'tasks.txt', 'text/plain');
  };

  const exportAsCsv = (tasks: Task[]) => {
    const headers = 'title,area,status,project,context';
    const rows = tasks.map(t =>
      [t.title, t.area, t.status, getProjectName(t), t.context ?? '']
        .map(v => `"${v.replace(/"/g, '""')}"`)
        .join(',')
    );
    downloadFile([headers, ...rows].join('\n'), 'tasks.csv', 'text/csv');
  };

  const exportSnapshot = () => {
    const nextAndWaiting = allTasks.filter(t => t.status === 'Next' || t.status === 'Waiting');
    const grouped: Record<string, Task[]> = {};
    for (const t of nextAndWaiting) {
      (grouped[t.area] ??= []).push(t);
    }
    let text = `Weekly Snapshot — ${new Date().toLocaleDateString()}\n${'='.repeat(40)}\n\n`;
    for (const area of AREAS) {
      const tasks = grouped[area];
      if (!tasks?.length) continue;
      text += `${area}\n${'-'.repeat(20)}\n`;
      for (const t of tasks) {
        text += `  [${t.status}] ${t.title}`;
        const pName = getProjectName(t);
        if (pName) text += ` (${pName})`;
        if (t.blocked_by) text += ` ⏳ ${t.blocked_by}`;
        text += '\n';
      }
      text += '\n';
    }
    downloadFile(text, 'weekly-snapshot.txt', 'text/plain');
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setExportOpen(true)}>
          <Download className="h-3 w-3 mr-1" /> Export
        </Button>
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="font-mono text-sm">Export Tasks</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-xs" onClick={() => { exportAsText(allTasks); setExportOpen(false); }}>All tasks as plain text</Button>
              <Button variant="outline" className="w-full justify-start text-xs" onClick={() => { exportAsCsv(allTasks); setExportOpen(false); }}>All tasks as CSV</Button>
              <Button variant="outline" className="w-full justify-start text-xs" onClick={() => { exportSnapshot(); setExportOpen(false); }}>Weekly Snapshot (Next + Waiting)</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-accent/50 px-3 py-1.5">
      <span className="text-xs font-mono font-medium">{selectedCount} selected</span>
      <Select onValueChange={v => onBulkUpdate({ status: v as TaskStatus })}>
        <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      <Select onValueChange={v => onBulkUpdate({ area: v as TaskArea })}>
        <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue placeholder="Area" /></SelectTrigger>
        <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
      </Select>
      {projects.length > 0 && (
        <Select onValueChange={v => onBulkUpdate({ project_id: v === 'none' ? null : v })}>
          <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClearSelection}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
