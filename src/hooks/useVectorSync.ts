import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { OperationLogEntry, ApiKey, VectorPayload, PayloadProcessingResult } from '@/types/vector-payload';

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `tb_${hex}`;
}

export function useOperationLog() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['operation_log', user?.id],
    queryFn: async (): Promise<OperationLogEntry[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('operation_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as OperationLogEntry[];
    },
    enabled: !!user,
  });

  return {
    operations: query.data ?? [],
    isLoading: query.isLoading,
  };
}

export function useApiKeys() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['api_keys', user?.id],
    queryFn: async (): Promise<ApiKey[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApiKey[];
    },
    enabled: !!user,
  });

  const createKey = useMutation({
    mutationFn: async (label: string): Promise<{ key: string; record: ApiKey }> => {
      if (!user) throw new Error('Not authenticated');
      const rawKey = generateApiKey();
      const keyHash = await sha256(rawKey);
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          key_hash: keyHash,
          label,
          permissions: ['vector:ingest', 'vector:read'],
        } as any)
        .select()
        .single();
      if (error) throw error;
      return { key: rawKey, record: data as unknown as ApiKey };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api_keys'] }),
  });

  const toggleKey = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api_keys'] }),
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api_keys'] }),
  });

  return {
    keys: query.data ?? [],
    isLoading: query.isLoading,
    createKey,
    toggleKey,
    deleteKey,
  };
}

export function useVectorIngest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: VectorPayload): Promise<PayloadProcessingResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/vector-ingest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ingest failed');
      return result as PayloadProcessingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation_log'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['clarify_questions'] });
    },
  });
}
