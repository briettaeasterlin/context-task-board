import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ProposedChange {
  id: string;
  user_id: string;
  change_type: string;
  target_task_id: string | null;
  target_project_id: string | null;
  summary: string;
  proposed_fields: Record<string, unknown>;
  confidence: string;
  reasoning: string | null;
  source: string;
  status: 'pending' | 'applied' | 'rejected';
  created_at: string;
  updated_at: string;
}

export function useProposedChanges() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['proposed_changes', user?.id],
    queryFn: async (): Promise<ProposedChange[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('proposed_changes' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProposedChange[];
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'applied' | 'rejected' }) => {
      const { error } = await supabase
        .from('proposed_changes' as any)
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposed_changes'] });
    },
  });

  const changes = query.data ?? [];
  const pendingChanges = changes.filter(c => c.status === 'pending');

  return {
    changes,
    pendingChanges,
    isLoading: query.isLoading,
    updateStatus,
  };
}
