import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Task, TaskInsert, TaskUpdate, TaskArea, TaskStatus } from '@/types/task';

export function useTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async (): Promise<Task[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
    enabled: !!user,
  });

  const createTask = useMutation({
    mutationFn: async (task: Omit<TaskInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...task, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Task;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const createManyTasks = useMutation({
    mutationFn: async (tasks: Omit<TaskInsert, 'user_id'>[]) => {
      if (!user) throw new Error('Not authenticated');
      const rows = tasks.map(t => ({ ...t, user_id: user.id }));
      const { data, error } = await supabase
        .from('tasks')
        .insert(rows as any[])
        .select();
      if (error) throw error;
      return data as unknown as Task[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Task;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const bulkUpdateTasks = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: TaskUpdate }) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates as any)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    createTask,
    createManyTasks,
    updateTask,
    bulkUpdateTasks,
    deleteTask,
  };
}
