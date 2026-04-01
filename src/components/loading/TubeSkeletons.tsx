import { Card } from '@/components/ui/card';

function PulsingDot({ className = '' }: { className?: string }) {
  return <span className={`w-2.5 h-2.5 rounded-full bg-muted-foreground/20 animate-pulse ${className}`} />;
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full bg-muted-foreground/10 animate-pulse ${className}`} />;
}

export function TodaySkeleton() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <Card className="p-6 sm:p-8 rounded-2xl bg-muted/30">
        <SkeletonLine className="w-48 h-6 mb-3" />
        <SkeletonLine className="w-32" />
      </Card>
      <div className="flex items-center gap-1 justify-center">
        <PulsingDot />
        <div className="w-12 h-px bg-muted-foreground/15" />
        <PulsingDot />
        <div className="w-12 h-px bg-muted-foreground/15" />
        <PulsingDot />
      </div>
      {[1, 2, 3].map(i => (
        <Card key={i} className="rounded-xl p-4">
          <div className="flex items-center gap-3">
            <PulsingDot />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-3/4" />
              <SkeletonLine className="w-1/3 h-2" />
            </div>
          </div>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground text-center font-mono animate-pulse">Mapping your route…</p>
    </div>
  );
}

export function RoutesSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      <div>
        <SkeletonLine className="w-24 h-6 mb-2" />
        <SkeletonLine className="w-40 h-3" />
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="flex items-center gap-2 w-[120px] sm:w-[220px]">
            <PulsingDot />
            <SkeletonLine className="flex-1" />
          </div>
          <div className="flex-1 flex items-center gap-1">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="flex items-center">
                <PulsingDot />
                <div className="w-3 sm:w-5 h-px bg-muted-foreground/10" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground text-center font-mono animate-pulse">Loading the network…</p>
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <SkeletonLine className="w-24 h-6 mb-2" />
        <SkeletonLine className="w-40 h-3" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4 rounded-xl">
            <SkeletonLine className="w-16 h-2 mb-2" />
            <SkeletonLine className="w-12 h-6 mx-auto mb-1" />
            <SkeletonLine className="w-10 h-2 mx-auto" />
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center font-mono animate-pulse">Gathering your stats…</p>
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <SkeletonLine className="w-36 h-6 mb-2" />
        <SkeletonLine className="w-56 h-3" />
      </div>
      {[1, 2, 3].map(i => (
        <Card key={i} className="rounded-xl p-4">
          <div className="flex items-center gap-3">
            <PulsingDot />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-4/5" />
              <SkeletonLine className="w-1/3 h-2" />
            </div>
          </div>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground text-center font-mono animate-pulse">Finding your next moves…</p>
    </div>
  );
}
