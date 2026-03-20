import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export function useHabitCompletions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const key = ['habit-completions', user?.id, todayStr];

  const { data: completions = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_completions' as any)
        .select('*')
        .eq('user_id', user!.id)
        .eq('completed_date', todayStr);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const completedHabitIds = new Set(completions.map((c: any) => c.habit_id as string));

  const toggleCompletion = useMutation({
    mutationFn: async (habitId: string) => {
      const existing = completions.find((c: any) => c.habit_id === habitId);
      if (existing) {
        const { error } = await supabase
          .from('habit_completions' as any)
          .delete()
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('habit_completions' as any)
          .insert({ habit_id: habitId, user_id: user!.id, completed_date: todayStr } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { completedHabitIds, isLoading, toggleCompletion };
}
