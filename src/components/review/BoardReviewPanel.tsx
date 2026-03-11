import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, CheckCircle2, ArrowUpCircle, Clock,
  AlertTriangle, Archive, Target, Activity, Zap, Ghost
} from 'lucide-react';
import { toast } from 'sonner';
import type { Task, Project, TaskUpdate } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { estimateDuration } from '@/lib/task-scoring';

// ─── Types ───

interface PromoteItem {
  taskId: string;
  taskTitle: string;
  projectName: string;
  reason: string;
}

interface PossiblyCompletedItem {
  taskId: string;
  taskTitle: string;
  currentStatus: string;
  reason: string;
}

interface WaitingItem {
  taskId: string;
  taskTitle: string;
  daysWaiting: number;
  blockedBy?: string;
  suggestedAction: string;
}

interface StaleItem {
  taskId: string;
  taskTitle: string;
  currentStatus: string;
  daysSinceUpdate: number;
  suggestedAction: 'Backlog' | 'Archive' | 'Keep';
}

interface BoardHealth {
  activeInitiatives: number;
  tasksInNext: number;
  recommendedNextMax: number;
  tasksBlocked: number;
  highImpactPending: number;
  totalTasks: number;
  healthNote: string;
}

interface FocusGroup {
  projectName: string;
  tasks: { taskId: string; taskTitle: string; estimatedTime?: string }[];
}

interface BoardReviewData {
  promoteToNext: PromoteItem[];
  possiblyCompleted: PossiblyCompletedItem[];
  waitingTooLong: WaitingItem[];
  staleTasks: StaleItem[];
  boardHealth: BoardHealth;
  weeklyFocus: FocusGroup[];
  executiveSummary: string;
}

interface Props {
  tasks: Task[];
  projects: Project[];
  onUpdate: (id: string, updates: TaskUpdate) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function BoardReviewPanel({ tasks, projects, onUpdate, onDelete, onClose }: Props) {
  const [review, setReview] = useState<BoardReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [changeCount, setChangeCount] = useState(0);

  const markApplied = useCallback((key: string) => {
    setApplied(prev => new Set([...prev, key]));
    setChangeCount(c => c + 1);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = {
          tasks: tasks.map(t => ({
            id: t.id, title: t.title, status: t.status, area: t.area,
            project_id: t.project_id, blocked_by: t.blocked_by,
            due_date: t.due_date, updated_at: t.updated_at, created_at: t.created_at,
            impact_score: (t as any).impact_score,
            notes: t.notes,
          })),
          projects: projects.map(p => ({ id: p.id, name: p.name, area: p.area, summary: p.summary })),
        };
        const { data, error: fnError } = await supabase.functions.invoke('ai-board-review', { body: payload });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        setReview(data);
      } catch (e: any) {
        console.error('Board review error:', e);
        setError(e.message || 'Failed to generate review');
      } finally {
        setLoading(false);
      }
    })();
  }, [tasks, projects]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Header onClose={onClose} />
        <Card className="p-12 text-center rounded-xl">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">VectorHQ AI is reviewing your board…</p>
          <p className="text-xs text-muted-foreground mt-1">Analyzing {tasks.length} tasks across {projects.length} projects</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Header onClose={onClose} />
        <Card className="p-6 text-center rounded-xl">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (!review) return null;

  const { promoteToNext, possiblyCompleted, waitingTooLong, staleTasks, boardHealth, weeklyFocus, executiveSummary } = review;

  return (
    <div className="space-y-6">
      <Header onClose={onClose} changeCount={changeCount} />

      {/* Executive Summary */}
      <Card className="p-4 bg-accent/50 border-accent rounded-xl">
        <p className="text-sm text-accent-foreground">{executiveSummary}</p>
      </Card>

      {/* Board Health */}
      <section>
        <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" /> Board Health
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Projects" value={boardHealth.activeInitiatives} />
          <StatCard label="Total Tasks" value={boardHealth.totalTasks} />
          <StatCard label="In Next" value={boardHealth.tasksInNext}
            alert={boardHealth.tasksInNext > boardHealth.recommendedNextMax}
            note={boardHealth.tasksInNext > boardHealth.recommendedNextMax ? `Reduce to ${boardHealth.recommendedNextMax}` : undefined} />
          <StatCard label="Blocked" value={boardHealth.tasksBlocked} alert={boardHealth.tasksBlocked > 5} />
          <StatCard label="High Impact" value={boardHealth.highImpactPending} />
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Card className="p-3 rounded-xl h-full flex items-center">
              <p className="text-xs text-muted-foreground">{boardHealth.healthNote}</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Promote to Next */}
      {promoteToNext.length > 0 && (
        <ReviewSection icon={<ArrowUpCircle className="h-4 w-4 text-primary" />} title="Promote to Next" count={promoteToNext.length}>
          {promoteToNext.map(item => (
            <SuggestionCard key={item.taskId} applied={applied.has(`promote-${item.taskId}`)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.taskTitle}</p>
                <p className="text-xs text-muted-foreground">{item.projectName} · {item.reason}</p>
              </div>
              {!applied.has(`promote-${item.taskId}`) && (
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" className="text-xs h-7" onClick={() => {
                    onUpdate(item.taskId, { status: 'Next' });
                    markApplied(`promote-${item.taskId}`);
                    toast.success(`${item.taskTitle} → Next`);
                  }}>Promote</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markApplied(`promote-${item.taskId}`)}>Skip</Button>
                </div>
              )}
            </SuggestionCard>
          ))}
        </ReviewSection>
      )}

      {/* Possibly Completed */}
      {possiblyCompleted.length > 0 && (
        <ReviewSection icon={<CheckCircle2 className="h-4 w-4 text-status-done" />} title="Possibly Completed" count={possiblyCompleted.length}>
          {possiblyCompleted.map(item => (
            <SuggestionCard key={item.taskId} applied={applied.has(`done-${item.taskId}`)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.taskTitle}</p>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
              </div>
              {!applied.has(`done-${item.taskId}`) && (
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" className="text-xs h-7" onClick={() => {
                    onUpdate(item.taskId, { status: 'Done' });
                    markApplied(`done-${item.taskId}`);
                    toast.success(`${item.taskTitle} → Done`);
                  }}>Mark Done</Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                    markApplied(`done-${item.taskId}`);
                  }}>Keep {item.currentStatus}</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                    onUpdate(item.taskId, { status: 'Backlog' });
                    markApplied(`done-${item.taskId}`);
                    toast.success(`${item.taskTitle} → Backlog`);
                  }}>→ Backlog</Button>
                </div>
              )}
            </SuggestionCard>
          ))}
        </ReviewSection>
      )}

      {/* Waiting Too Long */}
      {waitingTooLong.length > 0 && (
        <ReviewSection icon={<Clock className="h-4 w-4 text-status-waiting" />} title="Waiting Too Long" count={waitingTooLong.length}>
          {waitingTooLong.map(item => (
            <SuggestionCard key={item.taskId} applied={applied.has(`waiting-${item.taskId}`)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.taskTitle}</p>
                <p className="text-xs text-muted-foreground">
                  ⏳ {item.daysWaiting}d waiting{item.blockedBy ? ` · Blocked by: ${item.blockedBy}` : ''} · Suggested: {item.suggestedAction}
                </p>
              </div>
              {!applied.has(`waiting-${item.taskId}`) && (
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                    onUpdate(item.taskId, { status: 'Backlog', blocked_by: null });
                    markApplied(`waiting-${item.taskId}`);
                    toast.success(`${item.taskTitle} → Backlog`);
                  }}>→ Backlog</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markApplied(`waiting-${item.taskId}`)}>Keep Waiting</Button>
                </div>
              )}
            </SuggestionCard>
          ))}
        </ReviewSection>
      )}

      {/* Stale Tasks */}
      {staleTasks.length > 0 && (
        <ReviewSection icon={<Ghost className="h-4 w-4 text-muted-foreground" />} title="Stale Tasks" count={staleTasks.length}>
          {staleTasks.map(item => (
            <SuggestionCard key={item.taskId} applied={applied.has(`stale-${item.taskId}`)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.taskTitle}</p>
                <p className="text-xs text-muted-foreground">
                  💤 {item.daysSinceUpdate}d untouched · Currently: {item.currentStatus} · Suggested: {item.suggestedAction}
                </p>
              </div>
              {!applied.has(`stale-${item.taskId}`) && (
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                    onUpdate(item.taskId, { status: 'Backlog' });
                    markApplied(`stale-${item.taskId}`);
                    toast.success(`${item.taskTitle} → Backlog`);
                  }}>→ Backlog</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                    onDelete(item.taskId);
                    markApplied(`stale-${item.taskId}`);
                    toast.success(`${item.taskTitle} archived`);
                  }}>
                    <Archive className="h-3 w-3 mr-1" /> Archive
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markApplied(`stale-${item.taskId}`)}>Keep</Button>
                </div>
              )}
            </SuggestionCard>
          ))}
        </ReviewSection>
      )}

      {/* Weekly Focus */}
      {weeklyFocus.length > 0 && (
        <section>
          <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-primary" /> Focus for the Week
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {weeklyFocus.map((group, i) => (
              <Card key={i} className="p-4 rounded-xl">
                <h3 className="text-sm font-semibold mb-2">{group.projectName}</h3>
                <div className="space-y-1.5">
                  {group.tasks.map((t, j) => (
                    <div key={t.taskId} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-mono text-primary font-bold">{j + 1}.</span>
                      <span className="flex-1">{t.taskTitle}</span>
                      {t.estimatedTime && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{t.estimatedTime}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Done footer */}
      <Card className="p-4 text-center rounded-xl">
        <p className="text-sm text-muted-foreground">
          {changeCount > 0
            ? `${changeCount} change${changeCount !== 1 ? 's' : ''} applied during this review.`
            : 'Review complete. No changes applied yet.'}
        </p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onClose}>
          Back to Review
        </Button>
      </Card>
    </div>
  );
}

// ─── Sub-components ───

function Header({ onClose, changeCount }: { onClose: () => void; changeCount?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold">HQ Review</h2>
      </div>
      {changeCount !== undefined && changeCount > 0 && (
        <Badge variant="secondary" className="text-xs">{changeCount} applied</Badge>
      )}
    </div>
  );
}

function StatCard({ label, value, alert, note }: { label: string; value: number; alert?: boolean; note?: string }) {
  return (
    <Card className={`p-3 rounded-xl text-center ${alert ? 'border-destructive/50' : ''}`}>
      <div className={`text-xl font-bold ${alert ? 'text-destructive' : ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {note && <div className="text-[10px] text-destructive mt-0.5">{note}</div>}
    </Card>
  );
}

function ReviewSection({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-sans text-base font-semibold flex items-center gap-2 mb-3">
        {icon} {title} <Badge variant="outline" className="text-xs">{count}</Badge>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SuggestionCard({ children, applied }: { children: React.ReactNode; applied: boolean }) {
  return (
    <Card className={`p-3 rounded-xl flex items-center gap-3 transition-opacity ${applied ? 'opacity-40' : ''}`}>
      {applied && <CheckCircle2 className="h-4 w-4 text-status-done shrink-0" />}
      {children}
    </Card>
  );
}
