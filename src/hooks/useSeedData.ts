import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';

const SEED_TASKS = [
  {
    title: 'Incorporate stakeholder feedback into prototype',
    area: 'Client' as const,
    status: 'Next' as const,
    project: 'Troveres',
    context: null,
    notes: null,
    tags: [],
    blocked_by: null,
    source: null,
  },
  {
    title: 'Receive Dark Iron curated JSON',
    area: 'Client' as const,
    status: 'Waiting' as const,
    project: 'Troveres',
    context: 'Waiting on curated JSON in S3 from Daniel/Debie',
    notes: null,
    tags: [],
    blocked_by: 'Daniel/Debie',
    source: null,
  },
  {
    title: 'Test and configure Dark Iron data ingestion',
    area: 'Client' as const,
    status: 'Backlog' as const,
    project: 'Troveres',
    context: null,
    notes: null,
    tags: [],
    blocked_by: null,
    source: null,
  },
  {
    title: 'Connect Lovable to Snowflake for multi-brand data',
    area: 'Client' as const,
    status: 'Backlog' as const,
    project: 'Troveres',
    context: null,
    notes: null,
    tags: [],
    blocked_by: null,
    source: null,
  },
  {
    title: 'Deliver working Client Portfolio dashboard',
    area: 'Client' as const,
    status: 'Backlog' as const,
    project: 'Troveres',
    context: null,
    notes: null,
    tags: [],
    blocked_by: null,
    source: null,
  },
];

export function useSeedData() {
  const { user } = useAuth();
  const { tasks, createManyTasks } = useTasks();

  useEffect(() => {
    if (user && tasks.length === 0 && !createManyTasks.isPending) {
      // Only seed if user has zero tasks (first login)
      const timeout = setTimeout(() => {
        createManyTasks.mutate(SEED_TASKS);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [user, tasks.length]);
}
