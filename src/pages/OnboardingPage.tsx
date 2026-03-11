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
  const { createProject } = useProjects();
  const { createManyTasks } = useTasks();

  const [step, setStep] = useState(1);
  const [jsonInput, setJsonInput] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState('');
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    toast.success('Prompt copied!');
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleJsonChange = useCallback((value: string) => {
    setJsonInput(value);
    setParseError('');
    setParseResult(null);

    if (!value.trim()) return;

    try {
      const result = parseImportJSON(value);
      if (result.projects.length === 0 && result.tasks.length === 0) {
        setParseError('No projects or tasks found in the JSON. Make sure the output includes "projects" and "tasks" arrays.');
        return;
      }
      setParseResult(result);
    } catch {
      setParseError("This doesn't look like valid JSON. Make sure you copied the full output from your AI tool.");
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!parseResult) return;
    setImporting(true);

    try {
      // Create projects first, collect name→id map
      const projectIdMap = new Map<string, string>();

      // Collect all referenced project names from tasks that aren't in the projects array
      const explicitNames = new Set(parseResult.projects.map(p => p.name.toLowerCase()));
      const implicitProjects: ParsedProject[] = [];
      for (const t of parseResult.tasks) {
        if (t.project && !explicitNames.has(t.project.toLowerCase())) {
          explicitNames.add(t.project.toLowerCase());
          implicitProjects.push({ name: t.project, area: 'Personal', summary: null });
        }
      }

      const allProjects = [...parseResult.projects, ...implicitProjects];

      for (const proj of allProjects) {
        const created = await createProject.mutateAsync({
          name: proj.name,
          area: proj.area,
          summary: proj.summary,
          scope_notes: null,
        });
        projectIdMap.set(proj.name.toLowerCase(), created.id);
      }

      // Create tasks
      if (parseResult.tasks.length > 0) {
        const taskInserts = parseResult.tasks.map(t => ({
          title: t.title,
          area: (t.project ? allProjects.find(p => p.name.toLowerCase() === t.project?.toLowerCase())?.area : undefined) ?? 'Personal' as TaskArea,
          status: t.status,
          context: t.context,
          notes: null,
          tags: [] as string[],
          project_id: t.project ? projectIdMap.get(t.project.toLowerCase()) ?? null : null,
          milestone_id: null,
          blocked_by: t.blocked_by,
          source: 'onboarding' as string,
          due_date: null,
          target_window: null,
        }));

        await createManyTasks.mutateAsync(taskInserts);
      }

      toast.success(`Imported ${allProjects.length} projects and ${parseResult.tasks.length} tasks`);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [parseResult, createProject, createManyTasks]);

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

            {/* Copyable prompt */}
            <Card className="p-4 rounded-2xl shadow-card bg-muted/30 relative">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono max-h-48 overflow-y-auto">
                {AI_PROMPT}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-3 right-3 h-7 text-[10px] gap-1 rounded-lg"
                onClick={handleCopyPrompt}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy Prompt'}
              </Button>
            </Card>

            {/* JSON paste area */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Paste the JSON result here</label>
              <Textarea
                placeholder='{"projects": [...], "tasks": [...]}'
                value={jsonInput}
                onChange={e => handleJsonChange(e.target.value)}
                rows={8}
                className="rounded-xl font-mono text-xs"
              />

              {parseError && (
                <div className="flex items-start gap-2 text-sm text-destructive p-3 rounded-xl bg-destructive/5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {parseResult && (
                <Card className="p-4 rounded-xl bg-primary/5 border-primary/20 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" />
                    Found {parseResult.projects.length} project{parseResult.projects.length !== 1 ? 's' : ''} and {parseResult.tasks.length} task{parseResult.tasks.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseResult.projects.map(p => (
                      <Badge key={p.name} variant="outline" className="text-[10px] rounded-full">{p.name}</Badge>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setStep(2)}
              >
                Skip — I'll add things manually
              </Button>
              <Button
                onClick={handleImport}
                disabled={!parseResult || importing}
                className="flex-1 rounded-xl font-display"
              >
                {importing ? 'Importing...' : 'Continue'} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
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
