import { useState, useRef, useEffect } from 'react';
import type { ClarifyQuestion } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { MessageCircleQuestion, Check, X, ChevronDown, Plus, Milestone } from 'lucide-react';

interface FollowOnActions {
  updateScope: boolean;
  createTask: boolean;
  createMilestone: boolean;
}

interface Props {
  question: ClarifyQuestion;
  projectName?: string;
  onAnswer: (id: string, answer: string, followOn?: FollowOnActions) => void;
  onDismiss: (id: string) => void;
  showAnswered?: boolean;
}

export function ClarifyCard({ question, projectName, onAnswer, onDismiss, showAnswered = false }: Props) {
  const [answer, setAnswer] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const [showFollowOn, setShowFollowOn] = useState(false);
  const [followOn, setFollowOn] = useState<FollowOnActions>({
    updateScope: false,
    createTask: false,
    createMilestone: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => {
        if (multiline) textareaRef.current?.focus();
        else inputRef.current?.focus();
      }, 50);
    }
  }, [expanded, multiline]);

  const handleSubmit = () => {
    if (!answer.trim()) return;
    onAnswer(question.id, answer.trim(), showFollowOn ? followOn : undefined);
    setExpanded(false);
    setShowFollowOn(false);
    setAnswer('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setExpanded(false);
      setAnswer('');
    }
  };

  // Answered/dismissed state
  if (question.status !== 'open') {
    if (!showAnswered) return null;
    return (
      <Card className="p-3 opacity-60">
        <div className="flex items-start gap-2">
          {question.status === 'answered' ? (
            <Check className="h-3.5 w-3.5 text-status-done mt-0.5 shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-xs line-through text-muted-foreground">{question.question}</p>
            {question.answer && (
              <p className="text-xs mt-1 text-foreground italic">"{question.answer}"</p>
            )}
            <span className="text-[10px] text-muted-foreground capitalize">{question.status}</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 border-status-waiting/30">
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="h-3.5 w-3.5 text-status-waiting mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">{question.question}</p>
          {question.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{question.reason}</p>}
          {projectName && <span className="text-[10px] text-primary font-mono">{projectName}</span>}

          {/* Suggested options as chips */}
          {question.suggested_options && question.suggested_options.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {question.suggested_options.map((opt, i) => (
                <Button
                  key={i}
                  variant={answer === String(opt) ? 'default' : 'outline'}
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => {
                    setAnswer(String(opt));
                    if (!expanded) setExpanded(true);
                  }}
                >
                  {String(opt)}
                </Button>
              ))}
            </div>
          )}

          {expanded ? (
            <div className="mt-2 space-y-2">
              <div className="relative">
                {multiline ? (
                  <Textarea
                    ref={textareaRef}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    className="text-xs pr-8"
                    placeholder="Type your answer..."
                  />
                ) : (
                  <Input
                    ref={inputRef}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-xs h-8 pr-8"
                    placeholder="Type your answer… (Enter to save, Esc to cancel)"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-5 w-5 p-0 text-muted-foreground"
                  onClick={() => setMultiline(!multiline)}
                  title={multiline ? 'Single-line' : 'Multi-line'}
                >
                  <ChevronDown className={cn('h-3 w-3 transition-transform', multiline && 'rotate-180')} />
                </Button>
              </div>

              {/* Follow-on actions */}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-5 px-1 text-muted-foreground"
                  onClick={() => setShowFollowOn(!showFollowOn)}
                >
                  {showFollowOn ? '▾ Hide follow-on actions' : '▸ Apply this answer…'}
                </Button>
                {showFollowOn && (
                  <div className="mt-1 ml-1 space-y-1">
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={followOn.updateScope}
                        onCheckedChange={v => setFollowOn(f => ({ ...f, updateScope: !!v }))}
                        className="h-3 w-3"
                      />
                      Append to project scope notes
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={followOn.createTask}
                        onCheckedChange={v => setFollowOn(f => ({ ...f, createTask: !!v }))}
                        className="h-3 w-3"
                      />
                      Create a task from this answer
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={followOn.createMilestone}
                        onCheckedChange={v => setFollowOn(f => ({ ...f, createMilestone: !!v }))}
                        className="h-3 w-3"
                      />
                      Create a milestone from this answer
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-1">
                <Button size="sm" className="text-[10px] h-6" onClick={handleSubmit} disabled={!answer.trim()}>
                  <Check className="h-3 w-3 mr-1" /> Save Answer
                </Button>
                <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground" onClick={() => onDismiss(question.id)}>
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
