import { useProjects, useMilestones } from '@/hooks/useProjects';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { useTasks } from '@/hooks/useTasks';
import { AppShell } from '@/components/layout/AppShell';
import { UpdateForm } from '@/components/inbox/UpdateForm';
import { ClarifyCard } from '@/components/inbox/ClarifyCard';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FollowOnActions {
  updateScope: boolean;
  createTask: boolean;
  createMilestone: boolean;
}

export default function InboxPage() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const { clarifyQuestions, updateClarifyQuestion } = useClarifyQuestions();
  const { createTask } = useTasks();
  const queryClient = useQueryClient();

  const openQuestions = clarifyQuestions.filter(q => q.status === 'open');
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  const handleAnswer = useCallback(async (id: string, answer: string, followOn?: FollowOnActions) => {
    const question = clarifyQuestions.find(q => q.id === id);
    updateClarifyQuestion.mutate({ id, status: 'answered' as any, answer });

    if (followOn && question) {
      if (followOn.updateScope && question.project_id) {
        const { data: proj } = await supabase.from('projects').select('scope_notes').eq('id', question.project_id).single();
        const existing = proj?.scope_notes || '';
        const line = `Q: ${question.question}\nA: ${answer}`;
        await supabase.from('projects').update({
          scope_notes: existing ? `${existing}\n\n${line}` : line,
        } as any).eq('id', question.project_id);
        toast.success('Scope notes updated');
      }
      if (followOn.createTask && user) {
        createTask.mutate({
          title: answer.slice(0, 80),
          area: 'Personal',
          status: 'Backlog',
          context: `From clarify: ${question.question}`,
          notes: null,
          tags: [],
          project_id: question.project_id || null,
          milestone_id: null,
          blocked_by: null,
          source: 'clarify',
          due_date: null,
          target_window: null,
        }, { onSuccess: () => toast.success('Task created from answer') });
      }
      if (followOn.createMilestone && user && question.project_id) {
        await supabase.from('milestones').insert({
          user_id: user.id,
          project_id: question.project_id,
          name: answer.slice(0, 80),
          description: `From clarify: ${question.question}`,
          order_index: 0,
        } as any);
        toast.success('Milestone created from answer');
        queryClient.invalidateQueries({ queryKey: ['milestones'] });
      }
    }
  }, [updateClarifyQuestion, clarifyQuestions, user, createTask, queryClient]);

  const handleDismiss = useCallback((id: string) => {
    updateClarifyQuestion.mutate({ id, status: 'dismissed' as any });
  }, [updateClarifyQuestion]);

  return (
    <AppShell>
      <div className="space-y-6">
        <section>
          <h2 className="font-mono text-sm font-semibold mb-3">Paste an Update</h2>
          <UpdateForm projects={projects} milestones={milestones} onCreated={() => queryClient.invalidateQueries()} />
        </section>

        <section>
          <h2 className="font-mono text-sm font-semibold mb-3">
            Clarify Queue {openQuestions.length > 0 && <span className="text-muted-foreground font-normal">({openQuestions.length} open)</span>}
          </h2>
          {openQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No open questions. 🎉</p>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {openQuestions.map(q => (
                <ClarifyCard key={q.id} question={q} projectName={projectMap.get(q.project_id)} onAnswer={handleAnswer} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
