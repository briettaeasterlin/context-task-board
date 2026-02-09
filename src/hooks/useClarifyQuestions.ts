import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { ClarifyQuestion } from '@/types/task';

export function useClarifyQuestions(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const clarifyQuery = useQuery({
    queryKey: ['clarify_questions', user?.id, projectId],
    queryFn: async (): Promise<ClarifyQuestion[]> => {
      if (!user) return [];
      let query = supabase.from('clarify_questions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ClarifyQuestion[];
    },
    enabled: !!user,
  });

  const createClarifyQuestion = useMutation({
    mutationFn: async (q: Omit<ClarifyQuestion, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('clarify_questions').insert({ ...q, user_id: user.id } as any).select().single();
      if (error) throw error;
      return data as unknown as ClarifyQuestion;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clarify_questions'] }),
  });

  const updateClarifyQuestion = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClarifyQuestion> & { id: string }) => {
      const { data, error } = await supabase.from('clarify_questions').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as ClarifyQuestion;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clarify_questions'] }),
  });

  return { clarifyQuestions: clarifyQuery.data ?? [], isLoading: clarifyQuery.isLoading, createClarifyQuestion, updateClarifyQuestion };
}
