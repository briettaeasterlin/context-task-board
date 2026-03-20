import { useState, useCallback } from 'react';
import { useHabits, type HabitIntention } from '@/hooks/useHabits';
import { useHabitCompletions } from '@/hooks/useHabitCompletions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Leaf, Plus, X, MoreHorizontal, Trash2, Power } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const CADENCES = ['Daily', 'Weekly', 'Often', 'Seasonal'] as const;

const AFFIRMATIONS = [
  'Nice.',
  'That counts.',
  'Gentle win.',
  'Thanks for taking care.',
];

function HabitItem({ habit, isCompleted, onToggle }: { habit: HabitIntention; isCompleted: boolean; onToggle: () => void }) {
  const { updateHabit, deleteHabit } = useHabits();
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [phrase, setPhrase] = useState('');

  const handleToggle = useCallback(() => {
    if (!isCompleted) {
      const p = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
      setPhrase(p);
      setShowAffirmation(true);
      setTimeout(() => setShowAffirmation(false), 1500);
    }
    onToggle();
  }, [isCompleted, onToggle]);

  const cadenceLabel = habit.cadence === 'Daily' ? 'daily' : habit.cadence === 'Weekly' ? 'weekly' : habit.cadence === 'Often' ? 'often' : 'seasonal';

  return (
    <div className="relative">
      {showAffirmation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="font-mono text-xs text-primary/80 animate-fade-in select-none">
            {phrase}
          </span>
        </div>
      )}
      <Card className="p-2.5 flex items-center gap-3 group transition-colors hover:bg-muted/30">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggle}
          className="h-5 w-5 shrink-0 rounded-full"
          aria-label={`Mark "${habit.name}" complete for today`}
        />
        <div className="flex-1 min-w-0">
          <span className={`font-mono text-xs ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{habit.name}</span>
          {habit.description && (
            <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{habit.description}</p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{cadenceLabel}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => updateHabit.mutate({ id: habit.id, active: false })}>
              <Power className="h-3 w-3 mr-1.5" /> Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => deleteHabit.mutate(habit.id)} className="text-destructive">
              <Trash2 className="h-3 w-3 mr-1.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
    </div>
  );
}

export function HabitSection() {
  const { habits, isLoading, createHabit } = useHabits();
  const { completedHabitIds, toggleCompletion } = useHabitCompletions();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<typeof CADENCES[number]>('Daily');

  const handleAdd = useCallback(() => {
    if (!name.trim()) return;
    createHabit.mutate({ name: name.trim(), cadence }, {
      onSuccess: () => {
        setName('');
        setAdding(false);
        toast.success('Habit added');
      },
    });
  }, [name, cadence, createHabit]);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Leaf className="h-3.5 w-3.5" /> Gentle Intentions
        </h2>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground" onClick={() => setAdding(!adding)}>
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {adding && (
        <Card className="p-2 mb-2 flex items-center gap-2 animate-fade-in">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Morning walk"
            className="h-7 text-xs font-mono flex-1"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Select value={cadence} onValueChange={v => setCadence(v as typeof cadence)}>
            <SelectTrigger className="h-7 w-24 text-[10px] font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CADENCES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAdd} disabled={!name.trim()}>Add</Button>
        </Card>
      )}

      {isLoading ? (
        <p className="text-[10px] text-muted-foreground text-center py-3">Loading...</p>
      ) : habits.length === 0 && !adding ? (
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground font-mono">No intentions yet. Gentle habits live here.</p>
        </Card>
      ) : (
        <div className="space-y-1">
          {habits.map(h => (
            <HabitItem
              key={h.id}
              habit={h}
              isCompleted={completedHabitIds.has(h.id)}
              onToggle={() => toggleCompletion.mutate(h.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
