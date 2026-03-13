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
        name: 'Product Launch',
        area: 'Business',
        summary: 'Coordinate the launch of the new product including marketing, documentation, and customer onboarding.',
        scope_notes: 'Multi-team coordination across engineering, marketing, and customer success. Initial focus on documentation and launch messaging.',
      } as any).select().single();

      if (pErr || !project) { console.error('Seed project error:', pErr); setSeeded(true); return; }

      // Create milestones
      const milestoneData = [
        { name: 'Launch plan drafted and reviewed', order_index: 0, is_complete: true, completion_rule: 'manual' },
        { name: 'Documentation updated from feedback', order_index: 1, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Marketing assets prepared', order_index: 2, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Customer onboarding flow validated', order_index: 3, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Internal team alignment complete', order_index: 4, is_complete: false, completion_rule: 'tasks_based' },
        { name: 'Product launched', order_index: 5, is_complete: false, completion_rule: 'tasks_based' },
      ];

      const { data: milestones, error: mErr } = await supabase.from('milestones')
        .insert(milestoneData.map(m => ({ ...m, user_id: user.id, project_id: (project as any).id })) as any[])
        .select()
        .order('order_index' as any);

      if (mErr || !milestones) { console.error('Seed milestones error:', mErr); setSeeded(true); return; }

      const ms = milestones as any[];

      // Create tasks linked to milestones
      const tasks = [
        { title: 'Incorporate stakeholder feedback into launch plan', area: 'Business', status: 'Next', milestone_id: ms[1]?.id, context: null, blocked_by: null },
        { title: 'Receive final copy from marketing team', area: 'Business', status: 'Waiting', milestone_id: ms[2]?.id, context: 'Waiting on final marketing copy from the content team', blocked_by: 'Content team' },
        { title: 'Test customer onboarding flow end-to-end', area: 'Business', status: 'Backlog', milestone_id: ms[3]?.id, context: null, blocked_by: null },
        { title: 'Schedule internal alignment meeting', area: 'Business', status: 'Backlog', milestone_id: ms[4]?.id, context: null, blocked_by: null },
        { title: 'Draft launch announcement', area: 'Business', status: 'Backlog', milestone_id: ms[5]?.id, context: null, blocked_by: null },
      ];

      await supabase.from('tasks').insert(tasks.map(t => ({
        user_id: user.id, title: t.title, area: t.area, status: t.status,
        project_id: (project as any).id, milestone_id: t.milestone_id,
        context: t.context, blocked_by: t.blocked_by,
        notes: null, tags: [], source: null,
      })) as any[]);

      // Create clarify questions
      await supabase.from('clarify_questions').insert([
        { user_id: user.id, project_id: (project as any).id, question: 'What channels are in scope for the launch announcement?', reason: 'Unclear which platforms to target for initial rollout', status: 'open' },
        { user_id: user.id, project_id: (project as any).id, question: 'What is the minimum acceptable onboarding completion rate for launch?', reason: 'Need to define success criteria for the onboarding milestone', status: 'open' },
      ] as any[]);

      setSeeded(true);
      queryClient.invalidateQueries();
    };

    const timeout = setTimeout(seed, 300);
    return () => clearTimeout(timeout);
  }, [user, seeded, queryClient]);
}
