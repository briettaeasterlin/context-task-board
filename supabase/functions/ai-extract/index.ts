import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    // Support both old (content) and new (rawText) payload shapes
    const rawText = body.rawText ?? body.content;
    const projectId = body.projectId ?? null;
    const projectName = body.projectName ?? null;
    const source = body.source ?? null;

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const defaults = body.defaults ?? {};

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
            content: `You extract structured data from text input in a task/project tracking app for a single user named Brietta.
Areas available: Client, Business, Home, Family, Personal.
Statuses available: Backlog, Next, Waiting, Done.
${defaults.area ? `Default area hint from UI: ${defaults.area}` : ''}
${defaults.status ? `Default status hint from UI: ${defaults.status}` : ''}

Classify each piece of information into exactly ONE of these buckets:

1) NEW TASKS — clear actions required. Keep titles short (<10 words), actionable, clean.
   - Default to "Backlog" if uncertain. "Next" only for immediately actionable items.
   - "Waiting" ONLY with a clear external dependency — always fill blockedBy.
   - "Done" ONLY if explicitly stated as completed. NEVER mark informational items as Done.
   - Skip grocery lists, trivial errands, FYI-only items.
   - Prefer FEWER, higher-signal tasks.

2) TASK UPDATES — text implying progress or changes to EXISTING tasks.
   - E.g. "Stripe is connected" → mark related task Done.
   - E.g. "Waiting on Pilot for taxes" → move related task to Waiting + blockedBy=Pilot.
   - Provide a matchHint (keyword from likely existing task title) so the app can fuzzy-match.

3) CONTEXT NOTES — informational content to attach to a project or task. NOT a task itself.
   - Include a targetHint describing what project/task it relates to.

4) CLARIFY QUESTIONS — ambiguity about scope, ownership, dependencies, or definition of done.
   - Prefer fewer, higher-signal questions. Include suggestedOptions when helpful.
   - Do NOT ask about trivial scheduling or formatting details.`
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
                      status: { type: 'string', enum: ['Backlog', 'Next', 'Waiting', 'Done'] },
                      context: { type: 'string', description: 'Additional context or details' },
                      blockedBy: { type: 'string', description: 'Who/what is blocking (only for Waiting tasks)' }
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
                      newStatus: { type: 'string', enum: ['Backlog', 'Next', 'Waiting', 'Done'], description: 'New status if applicable' },
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
                }
              },
              required: ['summary', 'extractedTasks', 'taskUpdates', 'contextNotes', 'extractedClarifyQuestions'],
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
