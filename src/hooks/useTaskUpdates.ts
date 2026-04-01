import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type TaskUpdateTag = 'progress' | 'blocker' | 'decision' | 'next_step';

export interface TaskUpdate {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  tag: TaskUpdateTag | null;
  created_at: string;
}

export function useTaskUpdates(taskId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['task_updates', taskId],
    queryFn: async (): Promise<TaskUpdate[]> => {
      if (!taskId || !user) return [];
      const { data, error } = await supabase
        .from('task_updates' as any)
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TaskUpdate[];
    },
    enabled: !!taskId && !!user,
  });

  const addUpdate = useMutation({
    mutationFn: async ({ content, tag }: { content: string; tag: TaskUpdateTag | null }) => {
      if (!taskId || !user) throw new Error('Missing task or user');
      const { data, error } = await supabase
        .from('task_updates' as any)
        .insert({ task_id: taskId, user_id: user.id, content, tag } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskUpdate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task_updates', taskId] }),
  });

  const deleteUpdate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_updates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task_updates', taskId] }),
  });

  return {
    updates: query.data ?? [],
    isLoading: query.isLoading,
    addUpdate,
    deleteUpdate,
  };
}
