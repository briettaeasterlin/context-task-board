import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface HabitIntention {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cadence: 'Daily' | 'Weekly' | 'Often' | 'Seasonal';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type HabitInsert = Pick<HabitIntention, 'name' | 'cadence'>;

export function useHabits() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['habits', user?.id];

  const { data: habits = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_intentions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as HabitIntention[];
    },
  });

  const createHabit = useMutation({
    mutationFn: async (input: HabitInsert) => {
      const { error } = await supabase
        .from('habit_intentions')
        .insert({ ...input, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateHabit = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Pick<HabitIntention, 'name' | 'cadence' | 'active'>>) => {
      const { error } = await supabase
        .from('habit_intentions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteHabit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('habit_intentions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { habits: habits.filter(h => h.active), allHabits: habits, isLoading, createHabit, updateHabit, deleteHabit };
}
