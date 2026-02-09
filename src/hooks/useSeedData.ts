import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function useSeedData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!user || seeded) return;

    const seed = async () => {
      const { data: existing } = await supabase.from('projects').select('id').eq('user_id', user.id).limit(1);
      if (existing && existing.length > 0) { setSeeded(true); return; }

      // Create project
      const { data: project, error: pErr } = await supabase.from('projects').insert({
        user_id: user.id,
        name: 'Troveres Client Portfolio',
        area: 'Client',
        summary: 'Deliver a working client dashboard powered by Lovable Cloud with direct Snowflake connections across brands.',
        scope_notes: 'Multi-brand data integration via Snowflake, starting with Dark Iron curated data, building toward a working portfolio dashboard.',
      } as any).select().single();

      if (pErr || !project) { console.error('Seed project error:', pErr); setSeeded(true); return; }

      // Create milestones
      const milestoneData = [
        { name: 'Prototype drafted and reviewed', order_index: 0, is_complete: true, completion_rule: 'manual' },
        { name: 'Prototype updated from feedback', order_index: 1, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Dark Iron curated data available', order_index: 2, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Dark Iron ingestion validated', order_index: 3, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Snowflake multi-brand connection live', order_index: 4, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Working client dashboard delivered', order_index: 5, is_complete: false, completion_rule: 'tasks_based' },
      ];

      const { data: milestones, error: mErr } = await supabase.from('milestones')
        .insert(milestoneData.map(m => ({ ...m, user_id: user.id, project_id: (project as any).id })) as any[])
        .select()
        .order('order_index' as any);

      if (mErr || !milestones) { console.error('Seed milestones error:', mErr); setSeeded(true); return; }

      const ms = milestones as any[];

      // Create tasks linked to milestones
      const tasks = [
        { title: 'Incorporate stakeholder feedback into prototype', area: 'Client', status: 'Next', milestone_id: ms[1]?.id, context: null, blocked_by: null },
        { title: 'Receive Dark Iron curated JSON in S3', area: 'Client', status: 'Waiting', milestone_id: ms[2]?.id, context: 'Waiting on curated JSON in S3 from Daniel/Debie', blocked_by: 'Daniel/Debie' },
        { title: 'Test and configure Dark Iron data ingestion', area: 'Client', status: 'Backlog', milestone_id: ms[3]?.id, context: null, blocked_by: null },
        { title: 'Connect Lovable to Snowflake for multi-brand data', area: 'Client', status: 'Backlog', milestone_id: ms[4]?.id, context: null, blocked_by: null },
        { title: 'Deliver working Client Portfolio dashboard', area: 'Client', status: 'Backlog', milestone_id: ms[5]?.id, context: null, blocked_by: null },
      ];

      await supabase.from('tasks').insert(tasks.map(t => ({
        user_id: user.id, title: t.title, area: t.area, status: t.status,
        project_id: (project as any).id, milestone_id: t.milestone_id,
        context: t.context, blocked_by: t.blocked_by,
        notes: null, tags: [], source: null,
      })) as any[]);

      // Create clarify questions
      await supabase.from('clarify_questions').insert([
        { user_id: user.id, project_id: (project as any).id, question: 'What brands beyond Dark Iron are in scope for the initial launch?', reason: 'Unclear rollout order for multi-brand data integration', status: 'open' },
        { user_id: user.id, project_id: (project as any).id, question: 'What is the minimum acceptable "working dashboard" definition for handoff?', reason: 'Need to define acceptance criteria for the final milestone', status: 'open' },
      ] as any[]);

      setSeeded(true);
      queryClient.invalidateQueries();
    };

    const timeout = setTimeout(seed, 300);
    return () => clearTimeout(timeout);
  }, [user, seeded, queryClient]);
}
