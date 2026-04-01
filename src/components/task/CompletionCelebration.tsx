import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, Project } from '@/types/task';
import { CheckCircle2 } from 'lucide-react';

const RELIEF_MESSAGES = [
  "That's one less thing in your way.",
  "Handled. Mental space reclaimed.",
  "Small move, real progress.",
  "You followed through. That's your edge.",
  "Done and dusted. On to the next.",
  "That's been hanging around — good to clear it.",
  "Off your plate. Feels good, right?",
  "Consistent execution. That's the pattern.",
];

let usedIndices = new Set<number>();

function getReliefMessage(): string {
  if (usedIndices.size >= RELIEF_MESSAGES.length) usedIndices.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * RELIEF_MESSAGES.length); } while (usedIndices.has(idx));
  usedIndices.add(idx);
  return RELIEF_MESSAGES[idx];
}

function getProgressMessage(project: Project, completedCount: number, totalCount: number): string {
  const pct = Math.round((completedCount / totalCount) * 100);
  const remaining = totalCount - completedCount;

  if (remaining === 0) return `${project.name} — route complete. Every stop cleared. 🎉`;
  if (pct >= 75) return `${project.name} is ${pct}% done. ${remaining} stop${remaining !== 1 ? 's' : ''} left — you're in the home stretch.`;
  if (pct >= 50) return `Past the halfway mark on ${project.name}. Momentum is real.`;
  if (pct >= 25) return `${project.name} is building. ${completedCount} stops cleared — keep moving.`;
  return `First ground covered on ${project.name}. This is how things get shipped.`;
}

interface Props {
  task: Task;
  project?: Project;
  allTasksForProject: Task[];
  doneToday: number;
  totalToday: number;
  onDismiss: () => void;
}

export function CompletionCelebration({ task, project, allTasksForProject, doneToday, totalToday, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isProjectTask = project && allTasksForProject.length > 2;
  const completedInProject = allTasksForProject.filter(t => t.status === 'Done' || t.id === task.id).length;
  const totalInProject = allTasksForProject.length;

  const message = isProjectTask
    ? getProgressMessage(project, completedInProject, totalInProject)
    : getReliefMessage();

  const lineColor = project?.line_color ?? 'hsl(var(--accent))';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md cursor-pointer"
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        >
          <div
            className="rounded-2xl p-5 shadow-elevated border border-border/50 backdrop-blur-sm"
            style={{ background: `linear-gradient(135deg, ${lineColor}10, hsl(var(--card)))` }}
          >
            <div className="flex items-start gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1, damping: 15 }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: lineColor }}>
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground line-through opacity-70">{task.title}</p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{message}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono text-center mt-3 opacity-60">
              {doneToday} of {totalToday} today
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
