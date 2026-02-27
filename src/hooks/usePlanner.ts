import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PlannedBlock {
  id: string;
  user_id: string;
  task_id: string | null;
  date: string;
  start_time: string;
  duration_minutes: number;
  source: string;
  locked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string | null;
  synced_at: string;
}

export interface PlannerSettings {
  user_id: string;
  gcal_connected: boolean;
  gcal_timezone: string;
  overlay_ics_token: string | null;
  workday_start: string;
  workday_end: string;
  max_next_tasks: number;
}

export function usePlannedBlocks(weekStart?: string, weekEnd?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const blocksQuery = useQuery({
    queryKey: ['planned_blocks', user?.id, weekStart, weekEnd],
    queryFn: async (): Promise<PlannedBlock[]> => {
      if (!user) return [];
      let query = supabase.from('planned_task_blocks').select('*').eq('user_id', user.id);
      if (weekStart) query = query.gte('date', weekStart);
      if (weekEnd) query = query.lte('date', weekEnd);
      const { data, error } = await query.order('date').order('start_time');
      if (error) throw error;
      return (data ?? []) as unknown as PlannedBlock[];
    },
    enabled: !!user,
  });

  const createBlock = useMutation({
    mutationFn: async (block: Omit<PlannedBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('planned_task_blocks')
        .insert({ ...block, user_id: user.id } as any).select().single();
      if (error) throw error;
      return data as unknown as PlannedBlock;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned_blocks'] }),
  });

  const updateBlock = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlannedBlock> & { id: string }) => {
      const { data, error } = await supabase.from('planned_task_blocks')
        .update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as PlannedBlock;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned_blocks'] }),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planned_task_blocks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned_blocks'] }),
  });

  return {
    blocks: blocksQuery.data ?? [],
    isLoading: blocksQuery.isLoading,
    createBlock,
    updateBlock,
    deleteBlock,
  };
}

export function useCalendarEvents(weekStart?: string, weekEnd?: string) {
  const { user } = useAuth();

  const eventsQuery = useQuery({
    queryKey: ['calendar_events', user?.id, weekStart, weekEnd],
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (!user) return [];
      let query = supabase.from('calendar_events_cache').select('*').eq('user_id', user.id);
      if (weekStart) query = query.gte('start_time', weekStart);
      if (weekEnd) query = query.lte('start_time', weekEnd);
      const { data, error } = await query.order('start_time');
      if (error) throw error;
      return (data ?? []) as unknown as CalendarEvent[];
    },
    enabled: !!user,
  });

  return {
    events: eventsQuery.data ?? [],
    isLoading: eventsQuery.isLoading,
  };
}

export function usePlannerSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['planner_settings', user?.id],
    queryFn: async (): Promise<PlannerSettings | null> => {
      if (!user) return null;
      const { data, error } = await supabase.from('user_planner_settings')
        .select('*').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return data as unknown as PlannerSettings | null;
    },
    enabled: !!user,
  });

  const upsertSettings = useMutation({
    mutationFn: async (settings: Partial<PlannerSettings>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('user_planner_settings')
        .upsert({ ...settings, user_id: user.id } as any, { onConflict: 'user_id' })
        .select().single();
      if (error) throw error;
      return data as unknown as PlannerSettings;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planner_settings'] }),
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    upsertSettings,
  };
}
