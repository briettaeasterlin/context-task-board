import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Copy, Check, ExternalLink, MessageSquare } from 'lucide-react';
import type { Task, Project } from '@/types/task';
import { cn } from '@/lib/utils';

interface AIHelperPanelProps {
  open: boolean;
  onClose: () => void;
  todayTasks: Task[];
  doneTodayTasks: Task[];
  projects: Project[];
  allTasks: Task[];
  streak: number;
  weekCleared: number;
}

export function AIHelperPanel({ open, onClose, todayTasks, doneTodayTasks, projects, allTasks, streak, weekCleared }: AIHelperPanelProps) {
  const [copied, setCopied] = useState(false);

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Build top 5 active projects with progress
  const activeProjects = useMemo(() => {
    const projectProgress: { name: string; done: number; total: number; color: string }[] = [];
    for (const p of projects) {
      const pTasks = allTasks.filter(t => t.project_id === p.id);
      if (pTasks.length === 0) continue;
      const done = pTasks.filter(t => t.status === 'Done').length;
      const active = pTasks.length - done;
      projectProgress.push({ name: p.name, done, total: pTasks.length, color: p.line_color ?? '#3FAFA4' });
    }
    return projectProgress
      .filter(p => p.done < p.total)
      .sort((a, b) => (b.total - b.done) - (a.total - a.done))
      .slice(0, 5);
  }, [projects, allTasks]);

  const promptText = useMemo(() => {
    const lines: string[] = [];
    lines.push("Here's my NextMove board for today:");
    lines.push('');
    lines.push("Today's moves:");
    
    for (const t of doneTodayTasks) {
      const proj = projectMap.get(t.project_id ?? '');
      lines.push(`  ✅ ${t.title}${proj ? ` (${proj.name})` : ''}`);
    }
    for (const t of todayTasks) {
      const proj = projectMap.get(t.project_id ?? '');
      lines.push(`  ⬜ ${t.title}${proj ? ` (${proj.name})` : ''}`);
    }

    if (activeProjects.length > 0) {
      lines.push('');
      lines.push('Active projects:');
      for (const p of activeProjects) {
        lines.push(`  • ${p.name} — ${p.done}/${p.total} stops`);
      }
    }

    lines.push('');
    if (streak > 0) lines.push(`Streak: ${streak} day${streak !== 1 ? 's' : ''} | This week: ${weekCleared} cleared`);
    lines.push('');
    lines.push('Help me prioritize, think through blockers, or capture updates.');

    return lines.join('\n');
  }, [todayTasks, doneTodayTasks, projectMap, activeProjects, streak, weekCleared]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-2xl shadow-elevated max-h-[80vh] overflow-y-auto">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h2 className="font-display font-bold text-sm">Talk to your AI</h2>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-3">Copy this to your AI:</p>

          <div className="bg-muted rounded-xl p-4 text-sm font-mono whitespace-pre-wrap text-foreground/90 leading-relaxed max-h-[40vh] overflow-y-auto">
            {promptText}
          </div>

          <Button onClick={handleCopy} className="w-full mt-4 rounded-xl font-display" size="sm">
            {copied ? (
              <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy to Clipboard</>
            )}
          </Button>

          <div className="flex items-center justify-center gap-4 mt-4">
            <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              Open ChatGPT <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              Open Claude <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
