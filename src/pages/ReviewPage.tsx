import { useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BarChart3, GitPullRequestArrow } from 'lucide-react';
import { format, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { WrapUpPanel } from '@/components/review/WrapUpPanel';
import { ChangesPanel } from '@/components/review/ChangesPanel';
import { WeeklySummaryCard } from '@/components/review/WeeklySummaryCard';
import { useProposedChanges } from '@/hooks/useProposedChanges';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';

type ReviewTab = 'wrapup' | 'changes';

function getWeekKey(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  return format(start, 'yyyy-MM-dd');
}

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('wrapup');
  const { pendingChanges } = useProposedChanges();
  const { tasks } = useTasks();
  const { projects } = useProjects();

  // Show weekly summary on Saturday evening (after 6pm) or Sunday
  const showWeeklySummary = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const hour = now.getHours();
    const isWeekend = day === 0 || (day === 6 && hour >= 18);
    const weekKey = getWeekKey();
    const dismissed = localStorage.getItem('nextmove_weekly_dismissed');
    return isWeekend && dismissed !== weekKey;
  }, []);

  const [weeklySummaryVisible, setWeeklySummaryVisible] = useState(showWeeklySummary);

  const dismissWeeklySummary = () => {
    localStorage.setItem('nextmove_weekly_dismissed', getWeekKey());
    setWeeklySummaryVisible(false);
  };

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto px-1 sm:px-0">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            Review
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Weekly Summary Card */}
        {weeklySummaryVisible && (
          <WeeklySummaryCard
            tasks={tasks}
            projects={projects}
            onDismiss={dismissWeeklySummary}
          />
        )}

        {/* Segmented control */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('wrapup')}
            className={cn(
              'flex-1 text-sm font-medium py-2.5 sm:py-2 px-4 rounded-lg transition-all min-h-[44px] sm:min-h-0',
              activeTab === 'wrapup'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Wrap Up
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={cn(
              'flex-1 text-sm font-medium py-2.5 sm:py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0',
              activeTab === 'changes'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Changes
            {pendingChanges.length > 0 && (
              <span className="bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingChanges.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'wrapup' ? <WrapUpPanel /> : <ChangesPanel />}
      </div>
    </AppShell>
  );
}
