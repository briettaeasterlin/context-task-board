import { useState } from 'react';
import { useOperationLog, useApiKeys, useVectorIngest } from '@/hooks/useVectorSync';
import type { VectorPayload } from '@/types/vector-payload';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Copy, Check, Key, ChevronDown, Trash2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SOURCE_COLORS: Record<string, string> = {
  chatgpt: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  claude: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  manual: 'bg-muted text-muted-foreground',
};

function ActionSummary({ actions }: { actions: Record<string, number> }) {
  const parts: string[] = [];
  if (actions.tasks_completed) parts.push(`${actions.tasks_completed} completed`);
  if (actions.tasks_created) parts.push(`${actions.tasks_created} created`);
  if (actions.tasks_updated) parts.push(`${actions.tasks_updated} updated`);
  if (actions.tasks_deleted) parts.push(`${actions.tasks_deleted} deleted`);
  if (actions.project_updates_logged) parts.push(`${actions.project_updates_logged} updates`);
  if (actions.clarify_questions_created) parts.push(`${actions.clarify_questions_created} questions`);
  if (actions.clarify_questions_resolved) parts.push(`${actions.clarify_questions_resolved} resolved`);
  return <span className="text-xs text-muted-foreground">{parts.join(', ') || 'No actions'}</span>;
}

function PreviewActions({ payload }: { payload: VectorPayload }) {
  const parts: string[] = [];
  if (payload.tasks_completed?.length) parts.push(`Mark ${payload.tasks_completed.length} task(s) Done`);
  if (payload.tasks_created?.length) parts.push(`Create ${payload.tasks_created.length} task(s)`);
  if (payload.tasks_updated?.length) parts.push(`Update ${payload.tasks_updated.length} task(s)`);
  if (payload.tasks_deleted?.length) parts.push(`Delete ${payload.tasks_deleted.length} task(s)`);
  if (payload.project_updates?.length) parts.push(`Log ${payload.project_updates.length} update(s)`);
  if (payload.clarify_questions_created?.length) parts.push(`Create ${payload.clarify_questions_created.length} question(s)`);
  if (payload.clarify_questions_resolved?.length) parts.push(`Resolve ${payload.clarify_questions_resolved.length} question(s)`);

  // Detect low-confidence items
  const lowConfidence: string[] = [];
  for (const t of payload.tasks_completed ?? []) if (t.confidence === 'low') lowConfidence.push(`Complete: ${t.title}`);
  for (const t of payload.tasks_created ?? []) if (t.confidence === 'low') lowConfidence.push(`Create: ${t.title}`);
  for (const t of payload.tasks_updated ?? []) if (t.confidence === 'low') lowConfidence.push(`Update: ${t.title}`);
  for (const t of payload.tasks_deleted ?? []) if (t.confidence === 'low') lowConfidence.push(`Delete: ${t.title}`);

  if (!parts.length) return <p className="text-sm text-muted-foreground">No actions detected in payload.</p>;
  return (
    <div className="space-y-2">
      <ul className="text-sm space-y-1">
        {parts.map((p, i) => <li key={i} className="flex items-center gap-2"><span>•</span> {p}</li>)}
      </ul>
      {lowConfidence.length > 0 && (
        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">⚠️ Low confidence actions:</p>
          {lowConfidence.map((lc, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-300">• {lc}</p>)}
        </div>
      )}
    </div>
  );
}

export default function VectorSyncPanel() {
  const { operations, isLoading: opsLoading } = useOperationLog();
  const { keys, isLoading: keysLoading, createKey, toggleKey, deleteKey } = useApiKeys();
  const ingest = useVectorIngest();

  const [pasteText, setPasteText] = useState('');
  const [parsedPayload, setParsedPayload] = useState<VectorPayload | null>(null);
  const [parseError, setParseError] = useState('');
  const [processing, setProcessing] = useState(false);

  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const handleParse = () => {
    setParseError('');
    setParsedPayload(null);
    try {
      const obj = JSON.parse(pasteText);
      if (!obj.operation_id) { setParseError('Missing operation_id'); return; }
      if (!obj.timestamp) { setParseError('Missing timestamp'); return; }
      if (!['chatgpt', 'claude', 'manual'].includes(obj.source)) { setParseError('Invalid source — must be chatgpt, claude, or manual'); return; }
      if (obj.schema_version && !['1.0', '1.1'].includes(obj.schema_version)) {
        setParseError(`Unsupported schema version "${obj.schema_version}" — supported: 1.0, 1.1`);
        return;
      }
      setParsedPayload(obj as VectorPayload);
    } catch {
      setParseError('Invalid JSON');
    }
  };

  const handleProcess = async () => {
    if (!parsedPayload) return;
    setProcessing(true);
    try {
      const result = await ingest.mutateAsync(parsedPayload);
      if (result.deduplicated) {
        toast.info(`Duplicate payload — original: ${result.original_operation_id}`);
      } else if (result.success) {
        const total = Object.values(result.actions).reduce((a: number, b: number) => a + b, 0);
        toast.success(`Processed: ${total} actions`);
        if (result.low_confidence_actions?.length) {
          toast.warning(`${result.low_confidence_actions.length} low-confidence action(s) flagged`);
        }
      } else {
        toast.warning(`Processed with ${result.errors.length} error(s)`);
      }
      setPasteText('');
      setParsedPayload(null);
    } catch (e: any) {
      toast.error(e.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) return;
    try {
      const result = await createKey.mutateAsync(newKeyLabel.trim());
      setCreatedKey(result.key);
      setNewKeyLabel('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create key');
    }
  };

  const copyKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Section B: Manual Paste */}
      <section>
        <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3">
          <span>📋</span> Manual Payload
        </h2>
        <Card className="p-4 rounded-xl shadow-card space-y-3">
          <Textarea
            placeholder='Paste a Vector Payload JSON here...'
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="font-mono text-xs min-h-[120px]"
          />
          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" /> {parseError}
            </div>
          )}
          {parsedPayload && (
            <Card className="p-3 bg-muted/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{parsedPayload.operation_id}</p>
                {parsedPayload.schema_version && (
                  <Badge variant="outline" className="text-[10px]">v{parsedPayload.schema_version}</Badge>
                )}
              </div>
              <PreviewActions payload={parsedPayload} />
            </Card>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleParse} disabled={!pasteText.trim()}>
              Validate
            </Button>
            {parsedPayload && (
              <Button size="sm" onClick={handleProcess} disabled={processing}>
                {processing ? 'Processing...' : 'Process Payload'}
              </Button>
            )}
          </div>
        </Card>
      </section>

      {/* Section A: Recent Operations */}
      <section>
        <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3">
          <span>📡</span> Recent Operations
        </h2>
        {opsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : operations.length === 0 ? (
          <Card className="p-6 text-center rounded-xl shadow-card">
            <p className="text-sm text-muted-foreground">No operations yet. Process a payload to see it here.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {operations.map((op) => (
              <Collapsible key={op.id}>
                <Card className="rounded-xl shadow-card overflow-hidden">
                  <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2 text-left min-w-0">
                      {op.result?.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : op.result?.errors?.length ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${SOURCE_COLORS[op.source] || ''}`}>
                        {op.source}
                      </Badge>
                      <span className="text-sm font-mono truncate">{op.operation_id}</span>
                      {op.schema_version && (
                        <Badge variant="outline" className="text-[10px] px-1">v{op.schema_version}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {op.result?.actions && <ActionSummary actions={op.result.actions} />}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(op.created_at), { addSuffix: true })}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                      {op.result?.low_confidence_actions?.length ? (
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-1">
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1">
                            <Shield className="h-3 w-3" /> Low confidence actions:
                          </p>
                          {op.result.low_confidence_actions.map((lc, i) => (
                            <p key={i} className="text-xs text-amber-700 dark:text-amber-300">• [{lc.action_type}] {lc.target_title}</p>
                          ))}
                        </div>
                      ) : null}
                      {op.result?.errors?.length ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-destructive">Errors:</p>
                          {op.result.errors.map((e, i) => (
                            <p key={i} className="text-xs text-destructive/80">• [{e.action}] {e.title_or_id}: {e.message}</p>
                          ))}
                        </div>
                      ) : null}
                      {op.result?.warnings?.length ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-amber-600">Warnings:</p>
                          {op.result.warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-600/80">• [{w.action}] {w.title_or_id}: {w.message}</p>
                          ))}
                        </div>
                      ) : null}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw payload</summary>
                        <pre className="mt-1 p-2 bg-muted/30 rounded text-[10px] overflow-auto max-h-48 font-mono">
                          {JSON.stringify(op.payload, null, 2)}
                        </pre>
                      </details>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Result</summary>
                        <pre className="mt-1 p-2 bg-muted/30 rounded text-[10px] overflow-auto max-h-48 font-mono">
                          {JSON.stringify(op.result, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </section>

      {/* Section C: API Keys */}
      <section>
        <h2 className="font-sans text-lg font-semibold flex items-center gap-2 mb-3">
          <Key className="h-5 w-5" /> API Keys
        </h2>
        <Card className="p-4 rounded-xl shadow-card space-y-3">
          {keysLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys. Create one to connect external LLMs.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{k.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(k.created_at!).toLocaleDateString()}
                      {k.last_used_at && ` · Last used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}`}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {k.permissions.map(p => (
                        <Badge key={p} variant="outline" className="text-[9px] px-1">{p}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={k.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {k.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => toggleKey.mutate({ id: k.id, is_active: !k.is_active })}>
                      {k.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm('Delete this API key? This cannot be undone.')) deleteKey.mutate(k.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={() => { setCreateKeyOpen(true); setCreatedKey(null); setNewKeyLabel(''); }}>
            <Key className="h-3.5 w-3.5 mr-1.5" /> Create New Key
          </Button>
        </Card>
      </section>

      {/* Create Key Dialog */}
      <Dialog open={createKeyOpen} onOpenChange={(o) => { if (!o) { setCreateKeyOpen(false); setCreatedKey(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createdKey ? 'Key Created' : 'Create API Key'}</DialogTitle>
          </DialogHeader>
          {createdKey ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  ⚠️ This key will not be shown again. Copy it now.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input value={createdKey} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyKey}>
                  {keyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Label</Label>
                <Input placeholder="e.g. ChatGPT Vector, Claude Scheduled" value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => { setCreateKeyOpen(false); setCreatedKey(null); }}>Done</Button>
            ) : (
              <Button onClick={handleCreateKey} disabled={!newKeyLabel.trim() || createKey.isPending}>
                {createKey.isPending ? 'Creating...' : 'Create Key'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
