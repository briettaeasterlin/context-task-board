import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Task, TaskInsert, TaskUpdate } from '@/types/task';

export function useTasks(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: async (): Promise<Task[]> => {
      if (!user) return [];
      let query = supabase.from('tasks').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
    enabled: !!user,
  });

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
      // Update each task's sort_order
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
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    createTask,
    createManyTasks,
    updateTask,
    bulkUpdateTasks,
    deleteTask,
    reorderTasks,
  };
}
