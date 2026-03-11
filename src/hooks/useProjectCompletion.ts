import { useMemo } from 'react';
import type { Task, Project } from '@/types/task';

export interface NearingCompletionProject {
  project: Project;
  openTasks: Task[];
  totalTasks: number;
  doneTasks: number;
  suggestedClosingTasks: string[];
}

const CLOSING_TASK_SUGGESTIONS = [
  'QA testing',
  'Final demo / review',
  'Send final invoice',
  'Write documentation',
  'Archive project files',
];

export function useProjectCompletion(tasks: Task[], projects: Project[]) {
  return useMemo(() => {
    const results: NearingCompletionProject[] = [];

    for (const project of projects) {
      const projectTasks = tasks.filter(t => t.project_id === project.id);
      const openTasks = projectTasks.filter(t => t.status !== 'Done');
      const doneTasks = projectTasks.filter(t => t.status === 'Done');

      if (openTasks.length > 0 && openTasks.length <= 3 && projectTasks.length >= 3) {
        // Check which closing tasks already exist
        const existingTitles = projectTasks.map(t => t.title.toLowerCase());
        const suggestions = CLOSING_TASK_SUGGESTIONS.filter(s =>
          !existingTitles.some(et =>
            et.includes(s.toLowerCase().split(' ')[0]) // match first word
          )
        );

        results.push({
          project,
          openTasks,
          totalTasks: projectTasks.length,
          doneTasks: doneTasks.length,
          suggestedClosingTasks: suggestions,
        });
      }
    }

    return results;
  }, [tasks, projects]);
}
