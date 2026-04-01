import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowUpRight, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { useTaskUpdates, type TaskUpdateTag } from '@/hooks/useTaskUpdates';
import { formatDistanceToNow } from 'date-fns';

const TAG_CONFIG: Record<TaskUpdateTag, { label: string; icon: React.ReactNode; className: string }> = {
  progress: { label: 'Progress', icon: <ArrowUpRight className="h-3 w-3" />, className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  blocker: { label: 'Blocker', icon: <AlertTriangle className="h-3 w-3" />, className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  decision: { label: 'Decision', icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  next_step: { label: 'Next Step', icon: <Lightbulb className="h-3 w-3" />, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
};

interface Props {
  taskId: string | null;
}

export function TaskUpdatesFeed({ taskId }: Props) {
  const { updates, isLoading, addUpdate, deleteUpdate } = useTaskUpdates(taskId);
  const [content, setContent] = useState('');
  const [tag, setTag] = useState<TaskUpdateTag | 'none'>('none');
  const [showInput, setShowInput] = useState(false);

  const handleSubmit = () => {
    if (!content.trim()) return;
    addUpdate.mutate(
      { content: content.trim(), tag: tag === 'none' ? null : tag },
      { onSuccess: () => { setContent(''); setTag('none'); setShowInput(false); } }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Updates</span>
        {!showInput && (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => setShowInput(true)}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </div>

      {showInput && (
        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What happened?"
            rows={2}
            className="text-sm resize-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Select value={tag} onValueChange={v => setTag(v as TaskUpdateTag | 'none')}>
              <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue placeholder="Tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No tag</SelectItem>
                {(Object.keys(TAG_CONFIG) as TaskUpdateTag[]).map(t => (
                  <SelectItem key={t} value={t}>{TAG_CONFIG[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowInput(false); setContent(''); setTag('none'); }}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={!content.trim() || addUpdate.isPending}>
              {addUpdate.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : updates.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No updates yet. Track progress as you work.</p>
      ) : (
        <div className="space-y-1">
          {updates.map(u => (
            <div key={u.id} className="group flex gap-2 py-2 px-2 rounded-md hover:bg-muted/40 transition-colors">
              <div className="w-1 shrink-0 rounded-full bg-border mt-1 self-stretch" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm leading-snug">{u.content}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </span>
                  {u.tag && (
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 gap-0.5 font-normal ${TAG_CONFIG[u.tag].className}`}>
                      {TAG_CONFIG[u.tag].icon}
                      {TAG_CONFIG[u.tag].label}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => deleteUpdate.mutate(u.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
