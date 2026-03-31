import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BarChart3, GitPullRequestArrow } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WrapUpPanel } from '@/components/review/WrapUpPanel';
import { ChangesPanel } from '@/components/review/ChangesPanel';
import { useProposedChanges } from '@/hooks/useProposedChanges';

type ReviewTab = 'wrapup' | 'changes';

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('wrapup');
  const { pendingChanges } = useProposedChanges();

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            Review
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Segmented control */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('wrapup')}
            className={cn(
              'flex-1 text-sm font-medium py-2 px-4 rounded-lg transition-all',
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
              'flex-1 text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2',
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
