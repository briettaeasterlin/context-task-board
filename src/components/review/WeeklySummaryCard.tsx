import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, BarChart3 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, getDay } from 'date-fns';
import type { Task, Project } from '@/types/task';

interface WeeklySummaryCardProps {
  tasks: Task[];
  projects: Project[];
  onDismiss: () => void;
}

export function WeeklySummaryCard({ tasks, projects, onDismiss }: WeeklySummaryCardProps) {
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const summary = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    let cleared = 0;
    let planned = 0;
    const projectCleared: Record<string, number> = {};
    const doneByDow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const seenIds = new Set<string>();

    for (const t of tasks) {
      if (t.status === 'Done') {
        const d = format(new Date(t.updated_at), 'yyyy-MM-dd');
        if (d >= weekStartStr && d <= weekEndStr) {
          cleared++;
          seenIds.add(t.id);
          doneByDow[getDay(new Date(t.updated_at))] += 1;
          if (t.project_id) {
            projectCleared[t.project_id] = (projectCleared[t.project_id] ?? 0) + 1;
          }
        }
      }
      if (t.planned_date && t.planned_date >= weekStartStr && t.planned_date <= weekEndStr) {
        seenIds.add(t.id);
      }
    }
    planned = Math.max(seenIds.size, cleared);

    const completionRate = planned > 0 ? Math.round((cleared / planned) * 100) : 0;

    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let bestDow = 1;
    let bestCount = 0;
    for (let i = 0; i < 7; i++) {
      if (doneByDow[i] > bestCount) { bestCount = doneByDow[i]; bestDow = i; }
    }

    // Most active project
    const topProjectId = Object.entries(projectCleared).sort(([,a],[,b]) => b - a)[0]?.[0];
    const topProject = topProjectId ? projectMap.get(topProjectId) : null;
    const topProjectCleared = topProjectId ? projectCleared[topProjectId] : 0;

    // Contextual message
    let message = '';
    if (completionRate >= 90) {
      message = "Exceptional week. You executed at a high level. Keep this rhythm.";
    } else if (completionRate >= 70) {
      message = "Strong week. You're building real momentum. Things are getting done — not just planned.";
    } else if (completionRate >= 50) {
      message = "Solid progress. You showed up consistently. Next week, try locking in fewer moves and completing them all.";
    } else {
      message = "Tough week — and that's fine. The fact that you're here reviewing means you haven't quit. Pick 3 moves for Monday and start fresh.";
    }

    return {
      weekLabel: `${format(weekStart, 'MMMM d')} – ${format(weekEnd, 'MMMM d, yyyy')}`,
      cleared,
      planned,
      completionRate,
      bestDay: bestCount > 0 ? `${dowNames[bestDow]} (${bestCount} moves)` : '—',
      topProject,
      topProjectCleared,
      message,
    };
  }, [tasks, projectMap]);

  return (
    <Card className="p-6 rounded-2xl bg-accent/5 border-accent/20 relative">
      <Button variant="ghost" size="sm" className="absolute top-3 right-3 h-7 w-7 p-0 rounded-full text-muted-foreground" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>

      <div className="text-center mb-4">
        <BarChart3 className="h-6 w-6 text-accent mx-auto mb-2" />
        <h2 className="font-display font-bold text-lg">Your Week in Review</h2>
        <p className="text-xs text-muted-foreground mt-1">{summary.weekLabel}</p>
      </div>

      <div className="space-y-2 text-sm text-center">
        <p>
          <span className="font-bold text-foreground">{summary.cleared}</span> of{' '}
          <span className="font-bold text-foreground">{summary.planned}</span> moves cleared ({summary.completionRate}%)
        </p>
        <p className="text-muted-foreground">Best day: {summary.bestDay}</p>
      </div>

      {summary.topProject && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <span className="text-muted-foreground">Most active line:</span>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: summary.topProject.line_color ?? 'hsl(var(--accent))' }} />
          <span className="font-semibold">{summary.topProject.name}</span>
          <span className="text-muted-foreground">— {summary.topProjectCleared} stops cleared</span>
        </div>
      )}

      <div className="border-t border-border/50 mt-4 pt-4">
        <p className="text-sm text-muted-foreground text-center italic">{summary.message}</p>
      </div>

      <div className="text-center mt-4">
        <Button onClick={onDismiss} className="rounded-xl font-display" size="sm">
          Start Next Week →
        </Button>
      </div>
    </Card>
  );
}
