import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Update } from '@/types/task';

export function useUpdates(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updatesQuery = useQuery({
    queryKey: ['updates', user?.id, projectId],
    queryFn: async (): Promise<Update[]> => {
      if (!user) return [];
      let query = supabase.from('updates').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Update[];
    },
    enabled: !!user,
  });

  const createUpdate = useMutation({
    mutationFn: async (update: Omit<Update, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('updates').insert({ ...update, user_id: user.id } as any).select().single();
      if (error) throw error;
      return data as unknown as Update;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['updates'] }),
  });

  return { updates: updatesQuery.data ?? [], isLoading: updatesQuery.isLoading, createUpdate };
}
