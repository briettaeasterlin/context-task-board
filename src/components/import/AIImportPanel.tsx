import { useState, useCallback } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskArea, TaskStatus } from '@/types/task';

const AI_PROMPT = `I need help organizing everything I'm currently working on.

Please ask me about my active projects, responsibilities, and priorities. Then output the results in this exact JSON format:

{
  "projects": [
    {
      "name": "Project Name",
      "area": "Work|Personal|Business|Home|Family",
      "summary": "One sentence description"
    }
  ],
  "tasks": [
    {
      "title": "Task title",
      "project": "Project Name",
      "status": "Next|Waiting|Backlog",
      "context": "Any helpful detail",
      "blocked_by": "Person name if waiting on someone, otherwise omit"
    }
  ]
}

Ask me questions one area at a time. Start with work, then personal, then anything else I mention. When we are done, output the final JSON.`;

const AREA_MAP: Record<string, TaskArea> = {
  work: 'Client', client: 'Client', business: 'Business',
  personal: 'Personal', home: 'Home', family: 'Family',
};

const STATUS_MAP: Record<string, TaskStatus> = {
  next: 'Next', waiting: 'Waiting', backlog: 'Backlog',
  someday: 'Someday', today: 'Today',
};

interface ParsedProject { name: string; area: TaskArea; summary: string | null; }
interface ParsedTask { title: string; project: string | null; status: TaskStatus; context: string | null; blocked_by: string | null; }
interface ParseResult { projects: ParsedProject[]; tasks: ParsedTask[]; }

function parseImportJSON(raw: string): ParseResult {
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

  const parsed = JSON.parse(jsonStr);

  const projects: ParsedProject[] = (parsed.projects ?? []).map((p: any) => ({
    name: String(p.name ?? '').trim(),
    area: AREA_MAP[(String(p.area ?? 'personal')).toLowerCase()] ?? 'Personal',
    summary: p.summary ? String(p.summary).trim() : null,
  })).filter((p: ParsedProject) => p.name.length > 0);

  const tasks: ParsedTask[] = (parsed.tasks ?? []).map((t: any) => ({
    title: String(t.title ?? '').trim(),
    project: t.project ? String(t.project).trim() : null,
    status: STATUS_MAP[(String(t.status ?? 'backlog')).toLowerCase()] ?? 'Backlog',
    context: t.context ? String(t.context).trim() : null,
    blocked_by: t.blocked_by ? String(t.blocked_by).trim() : null,
  })).filter((t: ParsedTask) => t.title.length > 0);

  return { projects, tasks };
}

interface AIImportPanelProps {
  /** Called after successful import */
  onImportComplete?: () => void;
  /** Source tag for created tasks */
  source?: string;
  /** Compact layout for embedding in tabs */
  compact?: boolean;
}

export function AIImportPanel({ onImportComplete, source = 'import', compact = false }: AIImportPanelProps) {
  const { createProject } = useProjects();
  const { createManyTasks } = useTasks();

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
      const projectIdMap = new Map<string, string>();
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
          name: proj.name, area: proj.area, summary: proj.summary, scope_notes: null,
        });
        projectIdMap.set(proj.name.toLowerCase(), created.id);
      }

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
          source,
          due_date: null,
          target_window: null,
        }));
        await createManyTasks.mutateAsync(taskInserts);
      }

      toast.success(`Imported ${allProjects.length} projects and ${parseResult.tasks.length} tasks`);
      setJsonInput('');
      setParseResult(null);
      onImportComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [parseResult, createProject, createManyTasks, source, onImportComplete]);

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="text-center space-y-2">
          <h2 className="text-xl font-sans font-bold tracking-tight text-foreground">Import from AI</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Paste this prompt into ChatGPT, Claude, or any AI tool. It will organize your work into a format NextMove can read.
          </p>
        </div>
      )}

      <Card className="rounded-xl shadow-card p-4 bg-muted/30 border-border/50">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">AI Prompt</span>
          <Button variant="outline" size="sm" className="text-xs h-7 rounded-lg" onClick={handleCopyPrompt}>
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </Button>
        </div>
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-32 overflow-y-auto leading-relaxed">
          {AI_PROMPT}
        </pre>
      </Card>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Paste the JSON result here</label>
        <Textarea
          value={jsonInput}
          onChange={e => handleJsonChange(e.target.value)}
          placeholder='{"projects": [...], "tasks": [...]}'
          rows={compact ? 5 : 6}
          className="font-mono text-xs rounded-xl"
        />
      </div>

      {parseError && (
        <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-xl">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {parseResult && (
        <Card className="p-4 rounded-xl shadow-card border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Found {parseResult.projects.length} projects and {parseResult.tasks.length} tasks
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {parseResult.projects.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{p.name}</Badge>
            ))}
          </div>
        </Card>
      )}

      {parseResult && (
        <Button className="w-full rounded-xl" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing…' : `Import ${parseResult.projects.length} projects & ${parseResult.tasks.length} tasks`}
        </Button>
      )}
    </div>
  );
}
