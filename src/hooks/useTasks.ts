import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Task, TaskInsert, TaskUpdate } from '@/types/task';
import { useMemo, useCallback } from 'react';

const PAGE_SIZE = 100;

export function useTasks(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tasksQuery = useInfiniteQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: async ({ pageParam }): Promise<Task[]> => {
      if (!user) return [];
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (projectId) query = query.eq('project_id', projectId);

      // Cursor-based pagination: fetch tasks created before the last item's created_at
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.created_at ?? undefined;
    },
    enabled: !!user,
  });

  // Flatten all pages into a single array for consumers
  const tasks = useMemo(
    () => tasksQuery.data?.pages.flat() ?? [],
    [tasksQuery.data]
  );

  const loadMore = useCallback(() => {
    if (tasksQuery.hasNextPage && !tasksQuery.isFetchingNextPage) {
      tasksQuery.fetchNextPage();
    }
  }, [tasksQuery]);

  const createTask = useMutation({
    mutationFn: async (task: Omit<TaskInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('tasks').insert({ ...task, user_id: user.id } as any).select().single();
      if (error) throw error;
      return data as unknown as Task;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const createManyTasks = useMutation({
    mutationFn: async (tasks: Omit<TaskInsert, 'user_id'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const rows = tasks.map(t => ({ ...t, user_id: user.id }));
      const { data, error } = await supabase.from('tasks').insert(rows as any[]).select();
      if (error) throw error;
      return data as unknown as Task[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase.from('tasks').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as Task;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const bulkUpdateTasks = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: TaskUpdate }) => {
      const { error } = await supabase.from('tasks').update(updates as any).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const reorderTasks = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      const promises = updates.map(({ id, sort_order }) =>
        supabase.from('tasks').update({ sort_order } as any).eq('id', id)
      );
      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return {
    tasks,
    isLoading: tasksQuery.isLoading,
    hasMoreTasks: !!tasksQuery.hasNextPage,
    isLoadingMore: tasksQuery.isFetchingNextPage,
    loadMore,
    createTask,
    createManyTasks,
    updateTask,
    bulkUpdateTasks,
    deleteTask,
    reorderTasks,
  };
}
