import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, Inbox, Brain, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIImportPanel } from '@/components/import/AIImportPanel';


export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={cn(
              "w-3 h-3 rounded-full transition-colors",
              s <= step ? "bg-accent" : "bg-muted"
            )} />
          ))}
        </div>

        {/* ── STEP 1: Import ── */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">Bring your work into NextMove</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Paste this prompt into ChatGPT, Claude, or any AI tool you use. It will organize your current work into a format NextMove can read.
              </p>
            </div>

            <AIImportPanel source="onboarding" onImportComplete={() => setStep(2)} compact />

            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setStep(2)}
            >
              Skip — I'll add things manually
            </Button>
          </div>
        )}

        {/* ── STEP 2: How NextMove Works ── */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">How NextMove keeps you on track</h2>
            </div>

            <div className="space-y-4">
              <Card className="p-5 rounded-2xl shadow-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold mb-2">Statuses</h3>
                    <p className="text-xs text-muted-foreground mb-2">Every task has a status that tells NextMove what to do with it.</p>
                    <div className="space-y-1 text-xs">
                      <div><Badge variant="outline" className="text-[10px] rounded-full mr-1.5">Next</Badge>You are actively working on this.</div>
                      <div><Badge variant="outline" className="text-[10px] rounded-full mr-1.5">Waiting</Badge>Blocked on someone else.</div>
                      <div><Badge variant="outline" className="text-[10px] rounded-full mr-1.5">Backlog</Badge>Known work, not started yet.</div>
                      <div><Badge variant="outline" className="text-[10px] rounded-full mr-1.5">Someday</Badge>Ideas for later.</div>
                      <div><Badge variant="outline" className="text-[10px] rounded-full mr-1.5">Done</Badge>Completed.</div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 rounded-2xl shadow-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold mb-1">Today's Moves</h3>
                    <p className="text-xs text-muted-foreground">Each day, NextMove looks at your Next tasks and suggests what to focus on. Open the Today view to see your plan.</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 rounded-2xl shadow-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold mb-1">Weekly Review</h3>
                    <p className="text-xs text-muted-foreground">Once a week, NextMove surfaces stale tasks, overdue items, and projects that need attention. Use Review to stay current.</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 rounded-2xl shadow-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold mb-1">Keeping it in sync</h3>
                    <p className="text-xs text-muted-foreground">Update NextMove when things change. Mark tasks done, add new ones, or paste an update from your AI tool. NextMove stays accurate when you keep it current.</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 rounded-xl font-display">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: You're Ready ── */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">You're all set</h2>
              <p className="text-sm text-muted-foreground mt-2">
                NextMove is organizing your work. Here's what to do now.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card
                className="p-6 rounded-2xl shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer text-center"
                onClick={() => navigate('/today')}
              >
                <span className="text-3xl mb-3 block">🎯</span>
                <h3 className="font-display font-semibold mb-1">See Today's Moves</h3>
                <p className="text-xs text-muted-foreground mb-3">See what NextMove suggests for today.</p>
                <Button size="sm" className="rounded-xl font-display text-xs">
                  Go to Today <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Card>

              <Card
                className="p-6 rounded-2xl shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer text-center"
                onClick={() => navigate('/review')}
              >
                <span className="text-3xl mb-3 block">🔁</span>
                <h3 className="font-display font-semibold mb-1">Run your first Review</h3>
                <p className="text-xs text-muted-foreground mb-3">Let NextMove analyze your projects.</p>
                <Button variant="outline" size="sm" className="rounded-xl font-display text-xs">
                  Start Review <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
