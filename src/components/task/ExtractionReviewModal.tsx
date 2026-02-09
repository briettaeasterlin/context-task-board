import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaBadge } from '@/components/task/AreaBadge';
import { StatusBadge } from '@/components/task/StatusBadge';
import { AREAS, STATUSES } from '@/types/task';
import type { Project, Milestone, TaskArea, TaskStatus } from '@/types/task';
import { Loader2, Check, X, Pencil, RefreshCw, FileText, HelpCircle, ArrowUpCircle } from 'lucide-react';

export interface ExtractedTask {
  title: string;
  area: TaskArea;
  status: TaskStatus;
  context: string | null;
  blockedBy: string | null;
  projectId: string | null;
  milestoneId: string | null;
  selected: boolean;
}

export interface ExtractedUpdate {
  description: string;
  matchHint: string | null;
  newStatus: TaskStatus | null;
  blockedBy: string | null;
  selected: boolean;
}

export interface ExtractedContext {
  content: string;
  targetHint: string | null;
  selected: boolean;
}

export interface ExtractedQuestion {
  question: string;
  reason: string | null;
  suggestedOptions: string[] | null;
  selected: boolean;
}

export interface ExtractionResult {
  summary: string | null;
  extractedTasks: ExtractedTask[];
  taskUpdates: ExtractedUpdate[];
  contextNotes: ExtractedContext[];
  extractedClarifyQuestions: ExtractedQuestion[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  result: ExtractionResult;
  onResultChange: (result: ExtractionResult) => void;
  projects: Project[];
  milestones?: Milestone[];
  saving: boolean;
  onConfirm: () => void;
}

export function ExtractionReviewModal({
  open, onClose, result, onResultChange, projects, milestones = [], saving, onConfirm,
}: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const toggleTask = (idx: number) => {
    onResultChange({
      ...result,
      extractedTasks: result.extractedTasks.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t),
    });
  };

  const updateTaskField = (idx: number, field: string, value: any) => {
    onResultChange({
      ...result,
      extractedTasks: result.extractedTasks.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    });
  };

  const toggleUpdate = (idx: number) => {
    onResultChange({
      ...result,
      taskUpdates: result.taskUpdates.map((u, i) => i === idx ? { ...u, selected: !u.selected } : u),
    });
  };

  const toggleContext = (idx: number) => {
    onResultChange({
      ...result,
      contextNotes: result.contextNotes.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c),
    });
  };

  const toggleQuestion = (idx: number) => {
    onResultChange({
      ...result,
      extractedClarifyQuestions: result.extractedClarifyQuestions.map((q, i) => i === idx ? { ...q, selected: !q.selected } : q),
    });
  };

  const totalSelected =
    result.extractedTasks.filter(t => t.selected).length +
    result.taskUpdates.filter(u => u.selected).length +
    result.contextNotes.filter(c => c.selected).length +
    result.extractedClarifyQuestions.filter(q => q.selected).length;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Review Extraction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Summary</Label>
              <p className="text-xs mt-0.5">{result.summary}</p>
            </div>
          )}

          {/* New Tasks */}
          {result.extractedTasks.length > 0 && (
            <Section icon={<Check className="h-3 w-3" />} label="New Tasks" count={result.extractedTasks.filter(t => t.selected).length} total={result.extractedTasks.length}>
              {result.extractedTasks.map((t, i) => (
                <div key={i} className="border rounded-md p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={t.selected} onCheckedChange={() => toggleTask(i)} />
                    {editingIdx === i ? (
                      <Input value={t.title} onChange={e => updateTaskField(i, 'title', e.target.value)}
                        className="h-6 text-xs font-mono flex-1" />
                    ) : (
                      <span className={`text-xs font-mono flex-1 ${!t.selected ? 'line-through text-muted-foreground' : ''}`}>{t.title}</span>
                    )}
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingIdx(editingIdx === i ? null : i)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 ml-6">
                    {editingIdx === i ? (
                      <>
                        <Select value={t.area} onValueChange={v => updateTaskField(i, 'area', v)}>
                          <SelectTrigger className="h-6 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={t.status} onValueChange={v => updateTaskField(i, 'status', v)}>
                          <SelectTrigger className="h-6 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={t.projectId || 'none'} onValueChange={v => updateTaskField(i, 'projectId', v === 'none' ? null : v)}>
                          <SelectTrigger className="h-6 text-[10px] w-[130px]"><SelectValue placeholder="Project" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No project</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
                        <AreaBadge area={t.area} className="text-[10px]" />
                        <StatusBadge status={t.status} className="text-[10px]" />
                        {t.projectId && <span className="text-[10px] text-primary font-mono">{projects.find(p => p.id === t.projectId)?.name}</span>}
                      </>
                    )}
                  </div>
                  {editingIdx === i && (
                    <div className="ml-6">
                      <Input value={t.context || ''} onChange={e => updateTaskField(i, 'context', e.target.value || null)}
                        placeholder="Context..." className="h-6 text-[10px]" />
                    </div>
                  )}
                  {editingIdx !== i && t.context && (
                    <p className="text-[10px] text-muted-foreground ml-6">{t.context}</p>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* Task Updates */}
          {result.taskUpdates.length > 0 && (
            <Section icon={<ArrowUpCircle className="h-3 w-3" />} label="Task Updates" count={result.taskUpdates.filter(u => u.selected).length} total={result.taskUpdates.length}>
              {result.taskUpdates.map((u, i) => (
                <div key={i} className="flex items-start gap-2 p-2 border rounded-md">
                  <Checkbox checked={u.selected} onCheckedChange={() => toggleUpdate(i)} className="mt-0.5" />
                  <div className="flex-1">
                    <p className={`text-xs ${!u.selected ? 'line-through text-muted-foreground' : ''}`}>
                      {u.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {u.matchHint && <span className="text-[10px] text-muted-foreground">Match: "{u.matchHint}"</span>}
                      {u.newStatus && <StatusBadge status={u.newStatus} className="text-[10px]" />}
                      {u.blockedBy && <span className="text-[10px] text-status-waiting">⏳ {u.blockedBy}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Context Notes */}
          {result.contextNotes.length > 0 && (
            <Section icon={<FileText className="h-3 w-3" />} label="Context to Attach" count={result.contextNotes.filter(c => c.selected).length} total={result.contextNotes.length}>
              {result.contextNotes.map((c, i) => (
                <div key={i} className="flex items-start gap-2 p-2 border rounded-md">
                  <Checkbox checked={c.selected} onCheckedChange={() => toggleContext(i)} className="mt-0.5" />
                  <div>
                    <p className={`text-xs ${!c.selected ? 'line-through text-muted-foreground' : ''}`}>{c.content}</p>
                    {c.targetHint && <span className="text-[10px] text-muted-foreground">→ {c.targetHint}</span>}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Clarify Questions */}
          {result.extractedClarifyQuestions.length > 0 && (
            <Section icon={<HelpCircle className="h-3 w-3" />} label="Clarifying Questions" count={result.extractedClarifyQuestions.filter(q => q.selected).length} total={result.extractedClarifyQuestions.length}>
              {result.extractedClarifyQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-2 border rounded-md">
                  <Checkbox checked={q.selected} onCheckedChange={() => toggleQuestion(i)} className="mt-0.5" />
                  <div>
                    <p className={`text-xs ${!q.selected ? 'line-through text-muted-foreground' : ''}`}>
                      <span className="text-primary mr-1">?</span> {q.question}
                    </p>
                    {q.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{q.reason}</p>}
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
            <X className="h-3 w-3 mr-1" /> Discard
          </Button>
          <Button size="sm" className="text-xs" onClick={onConfirm} disabled={saving || totalSelected === 0}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
            Confirm {totalSelected} items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, label, count, total, children }: { icon: React.ReactNode; label: string; count: number; total: number; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {icon} {label} ({count}/{total} selected)
      </Label>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </div>
  );
}
