import { useProposedChanges, type ProposedChange } from '@/hooks/useProposedChanges';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, GitMerge, ExternalLink, Bot, MessageSquare, Cpu, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useMemo } from 'react';

const SOURCE_ICONS: Record<string, React.ElementType> = {
  chatgpt: MessageSquare,
  claude: MessageSquare,
  system: Cpu,
  email: Mail,
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-accent/15 text-accent border-accent/30',
  medium: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

export function ChangesPanel() {
  const { pendingChanges, changes, isLoading, updateStatus } = useProposedChanges();
  const { projects } = useProjects();
  const { tasks } = useTasks();

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const appliedCount = changes.filter(c => c.status === 'applied').length;
  const rejectedCount = changes.filter(c => c.status === 'rejected').length;

  const handleAccept = (change: ProposedChange) => {
    updateStatus.mutate({ id: change.id, status: 'applied' }, {
      onSuccess: () => toast.success('Change applied'),
    });
  };

  const handleReject = (change: ProposedChange) => {
    updateStatus.mutate({ id: change.id, status: 'rejected' }, {
      onSuccess: () => toast.success('Change rejected'),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4 rounded-xl animate-pulse">
            <div className="h-4 bg-muted rounded w-2/3 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {(appliedCount > 0 || rejectedCount > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{pendingChanges.length} pending</span>
          <span>{appliedCount} applied</span>
          <span>{rejectedCount} rejected</span>
        </div>
      )}

      {/* Pending changes */}
      {pendingChanges.length === 0 ? (
        <Card className="p-8 text-center rounded-xl">
          <Bot className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium mb-1">No pending changes</p>
          <p className="text-xs text-muted-foreground">
            When AI or system tools suggest updates, they'll appear here for your review.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingChanges.map(change => {
            const SourceIcon = SOURCE_ICONS[change.source] ?? Bot;
            const task = change.target_task_id ? taskMap.get(change.target_task_id) : null;
            const project = change.target_project_id ? projectMap.get(change.target_project_id) : null;
            const confidenceClass = CONFIDENCE_COLORS[change.confidence] ?? CONFIDENCE_COLORS.medium;

            return (
              <Card key={change.id} className="rounded-xl overflow-hidden">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-muted flex-shrink-0">
                      <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{change.summary}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-md capitalize">
                          {change.change_type.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 rounded-md ${confidenceClass}`}>
                          {change.confidence}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground capitalize">{change.source}</span>
                      </div>
                    </div>
                  </div>

                  {/* Target info */}
                  {(task || project) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
                      {project?.line_color && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.line_color }} />
                      )}
                      {task && <span className="truncate">{task.title}</span>}
                      {task && project && <span>·</span>}
                      {project && <span className="truncate">{project.name}</span>}
                    </div>
                  )}

                  {/* Reasoning */}
                  {change.reasoning && (
                    <p className="text-xs text-muted-foreground pl-9 leading-relaxed">
                      {change.reasoning}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pl-9">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs rounded-lg text-accent hover:text-accent hover:bg-accent/10"
                      onClick={() => handleAccept(change)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(change)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
