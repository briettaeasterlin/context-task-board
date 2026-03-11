import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Project, Milestone } from '@/types/task';

export function useProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async (): Promise<Project[]> => {
      if (!user) return [];
      const { data, error } = await supabase.from('projects').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Project[];
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async (project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('projects').insert({ ...project, user_id: user.id } as any).select().single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase.from('projects').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  return { projects: projectsQuery.data ?? [], isLoading: projectsQuery.isLoading, createProject, updateProject, deleteProject };
}

export function useMilestones(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const milestonesQuery = useQuery({
    queryKey: ['milestones', user?.id, projectId],
    queryFn: async (): Promise<Milestone[]> => {
      if (!user) return [];
      let query = supabase.from('milestones').select('*').eq('user_id', user.id);
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await (query as any).order('order_index');
      if (error) throw error;
      return (data ?? []) as unknown as Milestone[];
    },
    enabled: !!user,
  });

  const createMilestone = useMutation({
    mutationFn: async (milestone: Omit<Milestone, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('milestones').insert({ ...milestone, user_id: user.id } as any).select().single();
      if (error) throw error;
      return data as unknown as Milestone;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones'] }),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Milestone> & { id: string }) => {
      const { data, error } = await supabase.from('milestones').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as Milestone;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones'] }),
  });

  return { milestones: milestonesQuery.data ?? [], isLoading: milestonesQuery.isLoading, createMilestone, updateMilestone };
}
