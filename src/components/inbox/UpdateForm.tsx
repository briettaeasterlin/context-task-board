import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import type { Project, TaskArea } from '@/types/task';
import { UPDATE_SOURCES } from '@/types/task';
import { AreaBadge } from '@/components/task/AreaBadge';
import { StatusBadge } from '@/components/task/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Sparkles, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ExtractResult {
  summary: string;
  tasks: Array<{ title: string; area?: string; status?: string; context?: string; blockedBy?: string }>;
  questions: Array<{ question: string; reason?: string }>;
}

interface Props {
  projects: Project[];
  defaultProjectId?: string;
  onCreated?: () => void;
}

export function UpdateForm({ projects, defaultProjectId, onCreated }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [source, setSource] = useState<string>('chatgpt');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleExtract = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const project = projects.find(p => p.id === projectId);
      const { data, error } = await supabase.functions.invoke('ai-extract', {
        body: { content, projectId: projectId || null, projectName: project?.name || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to extract');
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!result || !user) return;
    setLoading(true);
    try {
      // Save update record
      await supabase.from('updates').insert({
        user_id: user.id,
        project_id: projectId || null,
        source: source || null,
        content,
        extracted_summary: result.summary,
        extracted_tasks: result.tasks,
      } as any);

      // Create extracted tasks
      if (result.tasks.length > 0) {
        const taskRows = result.tasks.map(t => ({
          user_id: user.id,
          title: t.title,
          area: t.area || 'Personal',
          status: t.status || 'Next',
          context: t.context || null,
          blocked_by: t.blockedBy || null,
          project_id: projectId || null,
          milestone_id: null,
          notes: null,
          tags: [],
          source: null,
        }));
        await supabase.from('tasks').insert(taskRows as any[]);
      }

      // Create clarify questions
      if (result.questions.length > 0 && projectId) {
        const qRows = result.questions.map(q => ({
          user_id: user.id,
          project_id: projectId,
          question: q.question,
          reason: q.reason || null,
          status: 'open',
        }));
        await supabase.from('clarify_questions').insert(qRows as any[]);
      }

      setConfirmed(true);
      toast.success(`Created ${result.tasks.length} tasks${result.questions.length > 0 ? ` and ${result.questions.length} questions` : ''}`);
      onCreated?.();
      setContent('');
      setResult(null);
      setConfirmed(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Paste an update</Label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={5}
            className="font-mono text-xs"
            placeholder="Paste meeting notes, ChatGPT output, email updates..."
          />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Link to project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {UPDATE_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 text-xs" onClick={handleExtract} disabled={loading || !content.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Extract tasks
        </Button>
      </div>

      {result && (
        <Card className="p-3 space-y-3 border-primary/30">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Summary</Label>
            <p className="text-xs mt-0.5">{result.summary}</p>
          </div>
          {result.tasks.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Extracted Tasks ({result.tasks.length})</Label>
              <div className="mt-1 space-y-1">
                {result.tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Plus className="h-3 w-3 text-primary shrink-0" />
                    <span className="font-mono flex-1">{t.title}</span>
                    {t.area && <AreaBadge area={t.area as TaskArea} className="text-[10px]" />}
                    {t.status && <StatusBadge status={t.status as any} className="text-[10px]" />}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.questions.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Clarifying Questions ({result.questions.length})</Label>
              <div className="mt-1 space-y-1">
                {result.questions.map((q, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-primary mr-1">?</span> {q.question}
                    {q.reason && <span className="text-muted-foreground ml-1">— {q.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button size="sm" className="text-xs" onClick={handleConfirm} disabled={loading || confirmed}>
            {confirmed ? <><Check className="h-3 w-3 mr-1" /> Saved</> : <><Plus className="h-3 w-3 mr-1" /> Confirm & create</>}
          </Button>
        </Card>
      )}
    </div>
  );
}
