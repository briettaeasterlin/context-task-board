import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://context-task-board.lovable.app',
  'https://id-preview--6cb26484-5f83-41ed-b635-41425bad5c23.lovable.app',
  'https://6cb26484-5f83-41ed-b635-41425bad5c23.lovableproject.com',
  'http://localhost:5173',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

const VALID_AREAS = ['Client', 'Business', 'Home', 'Family', 'Personal'];
const VALID_STATUSES = ['Backlog', 'Next', 'Waiting', 'Done', 'Someday'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeString(s: string, maxLen: number): string {
  return s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLen);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth check ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Rate limit check ---
    const RATE_LIMIT_PER_MINUTE = 20;
    const FN_NAME = 'ai-extract';
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { count } = await adminClient
        .from('user_rate_limit_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', claimsData.claims.sub)
        .eq('function_name', FN_NAME)
        .gte('requested_at', oneMinuteAgo);
      if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded. Please try again in a moment.',
          retry_after_seconds: 60,
          limit: `${RATE_LIMIT_PER_MINUTE} requests per minute`,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      await adminClient.from('user_rate_limit_log').insert({ user_id: claimsData.claims.sub, function_name: FN_NAME });
    }

    const body = await req.json();
    // Support both old (content) and new (rawText) payload shapes
    const rawText = body.rawText ?? body.content;
    const projectId = body.projectId ?? null;
    const projectName = body.projectName ? sanitizeString(String(body.projectName), 200) : null;
    const source = body.source ? sanitizeString(String(body.source), 100) : null;

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'rawText is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rawText.length > 50000) {
      return new Response(JSON.stringify({ error: 'Input too long (max 50,000 characters)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Input validation ---
    if (projectId && !UUID_RE.test(projectId)) {
      return new Response(JSON.stringify({ error: 'Invalid projectId format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const defaults = body.defaults ?? {};
    if (defaults.area && !VALID_AREAS.includes(defaults.area)) {
      return new Response(JSON.stringify({ error: 'Invalid defaults.area value' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (defaults.status && !VALID_STATUSES.includes(defaults.status)) {
      return new Response(JSON.stringify({ error: 'Invalid defaults.status value' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sanitize existingProjects/existingTaskTitles to plain string arrays
    const existingProjects = Array.isArray(body.existingProjects)
      ? body.existingProjects.map((p: unknown) => sanitizeString(String(p), 200)).slice(0, 100)
      : null;
    const existingTaskTitles = Array.isArray(body.existingTaskTitles)
      ? body.existingTaskTitles.map((t: unknown) => sanitizeString(String(t), 200)).slice(0, 500)
      : null;
    const todayISO = new Date().toISOString().slice(0, 10);
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are VectorHQ AI, a conversation-first task reasoning system for a single user.

TODAY: ${todayISO} (${todayDay}). Use this to resolve relative dates like "Friday", "next week", "Feb 15".
CRITICAL DATE RULE: When resolving relative or partial dates (e.g. "Friday", "Feb 20"), ALWAYS pick the NEXT upcoming occurrence. Never assign a date in the past. If "Friday" is mentioned and today is Wednesday Feb 11 2026, the due date is Feb 13 2026, NOT a past Friday.

CORE PRINCIPLES:
- Clarity over completeness. Fewer, higher-signal tasks are always better than many small ones.
- Tasks should reflect intent, not anxiety. Never create artificial urgency.
- The system must feel like a thinking partner, not a task enforcer.

Areas available: Client, Business, Home, Family, Personal.
Statuses available: Backlog, Next, Waiting, Done, Someday.
- "Someday" is for speculative ideas or tasks with no clear timeline. Use when input mentions ideas, explorations, or "maybe/someday" language.
${defaults.area ? `Default area hint from UI: ${defaults.area}` : ''}
${defaults.status ? `Default status hint from UI: ${defaults.status}` : ''}
${existingProjects ? `Existing projects: ${JSON.stringify(existingProjects)}` : ''}
${existingTaskTitles ? `Existing task titles (for matching): ${JSON.stringify(existingTaskTitles)}` : ''}

Classify each piece of information into exactly ONE of these buckets:

1) NEW TASKS — clear actions required. Keep titles short (<10 words), actionable, clean.
   STATUS RULES (CRITICAL):
   - Default to "Backlog" unless there is strong evidence otherwise.
   - "Next" ONLY if the task is explicitly imminent or the user signals it should be worked on now.
     Only 1-2 tasks per project should ever be Next. Do NOT make everything Next in a batch.
   - "Waiting" ONLY with a clear external dependency — always fill blockedBy with who/what is blocking.
   - "Done" ONLY if the user explicitly says this is already completed. NEVER mark informational items as Done.
   DATE RULES (CRITICAL — HARD vs ASPIRATIONAL):
   - dueDate: Assign ONLY for hard deadlines — explicit dates, real-world events (baby shower Saturday, taxes April 15), recurring commitments. Use ISO format YYYY-MM-DD. Prefer the latest reasonable date. Never assign due dates to exploratory or backlog-only work. Deadlines create pressure.
   - targetWindow: Assign for aspirational timing — "I'd like to…", "aim to…", "try to this week", "this week" without external consequence. Use natural language like "this week", "next week", "end of month". Targets provide guidance, never urgency. They must NEVER become overdue or trigger alerts.
   - If unclear whether a date is hard or aspirational, default to targetWindow.
   FILTERING RULES:
   - Do NOT create tasks for informational statements, principles, metrics, or philosophy.
   - Skip trivial or maintenance items (groceries, minor reminders, FYIs) unless explicitly requested.
   - Prefer fewer, higher-impact tasks over granular breakdowns.
   DUPLICATE DETECTION:
   - If a new task is materially the same as an existing task title, do NOT create it.
     Instead, create a taskUpdate suggesting convergence.
   SEQUENCING:
   - When input implies a sequence of dependent tasks, infer the order. Only the earliest unblocked task may be Next.

2) TASK UPDATES — text implying progress, blocking, or completion of EXISTING tasks.
   SPRINT STATUS UPDATES: When the user pastes a structured status report (with ✅ Done, ▶ In Progress, ⬚ Backlog sections, or similar formatting):
   - Parse EVERY item in the report. This is the primary use case — do not skip items.
   - Items under "Done" / "✅" / "Completed" → create taskUpdate with newStatus="Done"
   - Items under "In Progress" / "Next" / "▶" → create taskUpdate with newStatus="Next"
   - Items under "Backlog" / "Up Next" / "⬚" → create taskUpdate with newStatus="Backlog"
   - Items under "Waiting" → create taskUpdate with newStatus="Waiting" + blockedBy if mentioned
   - For each item, extract a concise matchHint from the item text (a distinctive keyword phrase from the task title, not the full description).
   - If an item clearly describes NEW work not in existing tasks, create it as a new task with the appropriate status instead.
   ACCOMPLISHMENT LOGS: When the user pastes a list of what they accomplished (e.g. "Today I did X, Y, Z" or bullet points of completed work), treat each accomplishment as a task update:
   - If an existing task matches → create a taskUpdate with newStatus="Done" and a matchHint.
   - If NO existing task matches → create a NEW TASK with status="Done" so there's a record of the work.
   This is critical for billing reports and status tracking.
   OTHER UPDATES:
   - E.g. "Stripe is connected" → mark related task Done.
   - E.g. "Waiting on Pilot for taxes" → move related task to Waiting + blockedBy=Pilot.
   - Provide a matchHint (keyword from likely existing task title) so the app can fuzzy-match.
   - If input describes a duplicate of an existing task, use this bucket to suggest merging.

3) CONTEXT NOTES — informational content to attach to a project or task. NOT a task itself.
   - Include a targetHint describing what project/task it relates to.
   - Informational statements, principles, metrics, background info → always Context Notes, never tasks.

4) CLARIFY QUESTIONS — ambiguity about scope, ownership, dependencies, or definition of done.
   - Ask ONLY when ambiguity affects task grouping, sequencing, project assignment, or scope.
   - Prefer fewer, higher-signal questions. Include suggestedOptions when helpful.
   - Each question must clearly explain what decision the answer will affect.
   - Do NOT ask about trivial scheduling or formatting details.

5) ORGANIZATIONAL DIRECTIVES — NOT tasks. These are meta-instructions about how to organize work.
   Trigger phrases: "this is a project", "group these under", "create a project for", "these belong together",
   "reorganize", "reclassify", "move", "only X should be Next", "the rest should be Backlog",
   "this work is sequential", "set up phases/milestones".
   
   Directive types:
   - "create_project": Create a new project when the user describes a body of work with a shared goal. Provide name, area, summary.
   - "group_tasks": Attach existing tasks to a project. Provide taskMatchHints and projectMatchHint.
   - "reclassify": Change area or status of existing tasks. Provide taskMatchHints, optional newArea, optional newStatus.
   - "create_milestones": Set up milestones/phases for a project. Provide projectMatchHint and milestones array.
   - "reorder_next": Limit which tasks are Next. Provide keepNextHints (tasks to keep as Next), demoteToBacklog = true for the rest.
   
   CRITICAL: Directives are NEVER tasks. Do not create tasks for organizational intent.

TRANSPARENCY: When you infer a status, project assignment, or merge, include a brief reason in the context or description field so the user understands why.`
          },
          {
            role: 'user',
            content: `${projectName ? `Project: ${projectName}\n` : ''}${source ? `Source: ${source}\n` : ''}\nInput:\n${rawText}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_from_update',
            description: 'Extract structured tasks, updates, context notes, and clarifying questions from input text',
            parameters: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: '2-3 sentence summary of the input' },
                extractedTasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Short, actionable task title (under 10 words)' },
                      area: { type: 'string', enum: ['Client', 'Business', 'Home', 'Family', 'Personal'] },
                      status: { type: 'string', enum: ['Backlog', 'Next', 'Waiting', 'Done', 'Someday'] },
                      context: { type: 'string', description: 'Additional context or details' },
                      blockedBy: { type: 'string', description: 'Who/what is blocking (only for Waiting tasks)' },
                      dueDate: { type: 'string', description: 'Hard deadline in YYYY-MM-DD format. Only for real commitments/events.' },
                      targetWindow: { type: 'string', description: 'Aspirational timing like "this week", "next week". Never creates urgency.' }
                    },
                    required: ['title', 'status'],
                    additionalProperties: false
                  }
                },
                taskUpdates: {
                  type: 'array',
                  description: 'Updates to existing tasks (status changes, blockers)',
                  items: {
                    type: 'object',
                    properties: {
                      description: { type: 'string', description: 'What changed' },
                      matchHint: { type: 'string', description: 'Keyword to fuzzy-match an existing task title' },
                      newStatus: { type: 'string', enum: ['Backlog', 'Next', 'Waiting', 'Done', 'Someday'], description: 'New status if applicable' },
                      blockedBy: { type: 'string', description: 'Who/what is blocking (only for Waiting)' }
                    },
                    required: ['description'],
                    additionalProperties: false
                  }
                },
                contextNotes: {
                  type: 'array',
                  description: 'Informational content to attach to project/task notes',
                  items: {
                    type: 'object',
                    properties: {
                      content: { type: 'string', description: 'The informational content' },
                      targetHint: { type: 'string', description: 'Which project or task this relates to' }
                    },
                    required: ['content'],
                    additionalProperties: false
                  }
                },
                extractedClarifyQuestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string', description: 'Clarifying question about scope or dependencies' },
                      reason: { type: 'string', description: 'Why this question matters for project clarity' },
                      suggestedOptions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Suggested answer options if applicable'
                      }
                    },
                    required: ['question'],
                    additionalProperties: false
                  }
                },
                directives: {
                  type: 'array',
                  description: 'Organizational directives — meta-instructions about how to structure work. NOT tasks.',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['create_project', 'group_tasks', 'reclassify', 'create_milestones', 'reorder_next'], description: 'Type of organizational directive' },
                      label: { type: 'string', description: 'Human-readable summary of this directive (e.g. "Create project: Consulting Setup")' },
                      projectName: { type: 'string', description: 'Name for new or existing project' },
                      projectArea: { type: 'string', enum: ['Client', 'Business', 'Home', 'Family', 'Personal'], description: 'Area for new project' },
                      projectSummary: { type: 'string', description: 'Summary for new project' },
                      taskMatchHints: { type: 'array', items: { type: 'string' }, description: 'Keywords to match existing tasks' },
                      projectMatchHint: { type: 'string', description: 'Name of the project to group into' },
                      newArea: { type: 'string', enum: ['Client', 'Business', 'Home', 'Family', 'Personal'] },
                      newStatus: { type: 'string', enum: ['Backlog', 'Next', 'Waiting', 'Done', 'Someday'] },
                      milestones: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name'], additionalProperties: false } },
                      keepNextHints: { type: 'array', items: { type: 'string' }, description: 'Task keywords to keep as Next' },
                      demoteToBacklog: { type: 'boolean', description: 'Whether to demote all other Next tasks to Backlog' }
                    },
                    required: ['type', 'label'],
                    additionalProperties: false
                  }
                }
              },
              required: ['summary', 'extractedTasks', 'taskUpdates', 'contextNotes', 'extractedClarifyQuestions', 'directives'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_from_update' } }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits in Settings.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No structured response from AI');

    const result = JSON.parse(toolCall.function.arguments);

    // Normalize the response shape
    const normalized = {
      summary: result.summary ?? null,
      extractedTasks: (result.extractedTasks ?? []).map((t: any) => ({
        title: t.title,
        area: t.area || defaults.area || 'Personal',
        status: t.status || defaults.status || 'Backlog',
        context: t.context || null,
        blockedBy: t.blockedBy || null,
        dueDate: t.dueDate || null,
        targetWindow: t.targetWindow || null,
        projectId: projectId || null,
        milestoneId: null,
      })),
      taskUpdates: (result.taskUpdates ?? []).map((u: any) => ({
        description: u.description,
        matchHint: u.matchHint || null,
        newStatus: u.newStatus || null,
        blockedBy: u.blockedBy || null,
      })),
      contextNotes: (result.contextNotes ?? []).map((c: any) => ({
        content: c.content,
        targetHint: c.targetHint || null,
      })),
      extractedClarifyQuestions: (result.extractedClarifyQuestions ?? []).map((q: any) => ({
        question: q.question,
        reason: q.reason || null,
        suggestedOptions: q.suggestedOptions || null,
      })),
      directives: (result.directives ?? []).map((d: any) => ({
        type: d.type,
        label: d.label,
        projectName: d.projectName || null,
        projectArea: d.projectArea || null,
        projectSummary: d.projectSummary || null,
        taskMatchHints: d.taskMatchHints || [],
        projectMatchHint: d.projectMatchHint || null,
        newArea: d.newArea || null,
        newStatus: d.newStatus || null,
        milestones: d.milestones || [],
        keepNextHints: d.keepNextHints || [],
        demoteToBacklog: d.demoteToBacklog ?? false,
      })),
    };

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('ai-extract error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
