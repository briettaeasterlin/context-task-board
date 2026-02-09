import { useProjects } from '@/hooks/useProjects';
import { useClarifyQuestions } from '@/hooks/useClarifyQuestions';
import { AppShell } from '@/components/layout/AppShell';
import { UpdateForm } from '@/components/inbox/UpdateForm';
import { ClarifyCard } from '@/components/inbox/ClarifyCard';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export default function InboxPage() {
  const { projects } = useProjects();
  const { clarifyQuestions, updateClarifyQuestion } = useClarifyQuestions();
  const queryClient = useQueryClient();

  const openQuestions = clarifyQuestions.filter(q => q.status === 'open');
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  const handleAnswer = useCallback((id: string, answer: string) => {
    updateClarifyQuestion.mutate({ id, status: 'answered' as any, answer });
  }, [updateClarifyQuestion]);

  const handleDismiss = useCallback((id: string) => {
    updateClarifyQuestion.mutate({ id, status: 'dismissed' as any });
  }, [updateClarifyQuestion]);

  return (
    <AppShell>
      <div className="space-y-6">
        <section>
          <h2 className="font-mono text-sm font-semibold mb-3">Paste an Update</h2>
          <UpdateForm projects={projects} onCreated={() => queryClient.invalidateQueries()} />
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
