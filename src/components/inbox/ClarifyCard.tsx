import { useState } from 'react';
import type { ClarifyQuestion, Project } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { MessageCircleQuestion, Check, X } from 'lucide-react';

interface Props {
  question: ClarifyQuestion;
  projectName?: string;
  onAnswer: (id: string, answer: string) => void;
  onDismiss: (id: string) => void;
}

export function ClarifyCard({ question, projectName, onAnswer, onDismiss }: Props) {
  const [answer, setAnswer] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (question.status !== 'open') {
    return (
      <Card className="p-3 opacity-60">
        <div className="flex items-start gap-2">
          <Check className="h-3.5 w-3.5 text-status-done mt-0.5 shrink-0" />
          <div>
            <p className="text-xs line-through text-muted-foreground">{question.question}</p>
            {question.answer && <p className="text-xs mt-1 text-foreground">{question.answer}</p>}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 border-status-waiting/30">
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="h-3.5 w-3.5 text-status-waiting mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium">{question.question}</p>
          {question.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{question.reason}</p>}
          {projectName && <span className="text-[10px] text-primary font-mono">{projectName}</span>}

          {question.suggested_options && question.suggested_options.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {question.suggested_options.map((opt, i) => (
                <Button key={i} variant="outline" size="sm" className="text-[10px] h-6 px-2"
                  onClick={() => { setAnswer(String(opt)); setExpanded(true); }}>
                  {String(opt)}
                </Button>
              ))}
            </div>
          )}

          {expanded ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Type your answer..."
              />
              <div className="flex gap-1">
                <Button size="sm" className="text-[10px] h-6" onClick={() => { onAnswer(question.id, answer); setExpanded(false); }} disabled={!answer.trim()}>
                  <Check className="h-3 w-3 mr-1" /> Answer
                </Button>
                <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => { onDismiss(question.id); setExpanded(false); }}>
                  <X className="h-3 w-3 mr-1" /> Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1 mt-2">
              <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setExpanded(true)}>
                Answer
              </Button>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground" onClick={() => onDismiss(question.id)}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
