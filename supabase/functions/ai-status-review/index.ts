import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { tasks, projects } = await req.json();

    if (!tasks || !Array.isArray(tasks)) {
      return new Response(JSON.stringify({ error: 'tasks array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const todayISO = new Date().toISOString().slice(0, 10);

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
            content: `You are a senior PM advisor conducting a weekly status review. Today is ${todayISO}.

Your job is to synthesize the user's projects and tasks, identify issues, and generate structured clarification questions.

ANALYSIS RULES:
- Flag tasks marked "Next" with updated_at older than 7 days as potentially stale
- Flag tasks in "Waiting" without a blocked_by value
- Flag projects with more than 5 "Next" tasks as overloaded
- Identify backlog items that may be irrelevant (very old, no context)
- Detect potential duplicate tasks across projects
- **STRICT NEXT LIMIT**: The user should have 5-7 "Next" tasks TOTAL across all projects. If they currently have more than 7, this is a critical finding. Flag every task beyond 7 and suggest moving them to Backlog or Someday.
- Suggest "Someday" status for speculative ideas, aspirational tasks, or items with no clear timeline. Reserve "Backlog" for tasks that are likely work within the next month.

TONE: Strategic, calm, concise. Like a senior PM advisor. Encourage focus and ruthless prioritization. Default to narrowing, not expanding.

For each project, provide:
- A 1-2 sentence momentum summary
- Key bottlenecks if any
- A health indicator: 🔥 High activity, 🌿 Steady, ⚠️ At risk, 💤 Dormant
- Next milestone if identifiable
- 0-3 strategic questions about the project itself

For each ambiguous/stale task, generate a clarification question with quick-action options.

CRITICAL: At the end, suggest a focused plan for the next 14 days with a HARD MAX of 5-7 "Next" tasks total. If the user currently has more, your first recommendation must be to trim the Next list. Suggest moving speculative items to "Someday" rather than "Backlog".`
          },
          {
            role: 'user',
            content: `Here are my projects and tasks:\n\n${JSON.stringify({ projects, tasks }, null, 2)}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_status_review',
            description: 'Generate a structured status review with project summaries, task questions, and a focus plan.',
            parameters: {
              type: 'object',
              properties: {
                projectSummaries: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      projectId: { type: 'string', description: 'Project ID or "unassigned" for tasks without a project' },
                      projectName: { type: 'string' },
                      momentum: { type: 'string', description: '1-2 sentence momentum summary' },
                      bottlenecks: { type: 'string', description: 'Key bottlenecks, or null' },
                      strategicQuestions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            question: { type: 'string' },
                            options: { type: 'array', items: { type: 'string' }, description: 'Quick-select options like "High Priority", "Medium", "Low", "Archive"' }
                          },
                          required: ['question', 'options'],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ['projectId', 'projectName', 'momentum'],
                    additionalProperties: false
                  }
                },
                taskQuestions: {
                  type: 'array',
                  description: 'Questions about specific ambiguous/stale tasks',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      currentStatus: { type: 'string' },
                      reason: { type: 'string', description: 'Why this task is flagged (e.g. "Marked Next but no update in 14 days")' },
                      suggestedActions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            label: { type: 'string', description: 'Button label like "Done", "Still working", "Waiting", "Deprioritize", "Remove"' },
                            newStatus: { type: 'string', enum: ['Backlog', 'Next', 'Waiting', 'Done', 'Remove'], description: 'Status to apply. "Remove" means delete.' },
                            requiresInput: { type: 'boolean', description: 'Whether this action needs a text input (e.g. blocker name, note)' },
                            inputLabel: { type: 'string', description: 'Label for the text input if requiresInput is true' }
                          },
                          required: ['label', 'newStatus'],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ['taskId', 'taskTitle', 'currentStatus', 'reason', 'suggestedActions'],
                    additionalProperties: false
                  }
                },
                suggestedFocus: {
                  type: 'array',
                  description: 'Suggested focus tasks for the next 14 days (max 5)',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      projectName: { type: 'string' },
                      rationale: { type: 'string', description: 'Brief reason this should be a focus' }
                    },
                    required: ['taskId', 'taskTitle', 'projectName', 'rationale'],
                    additionalProperties: false
                  }
                },
                overallInsight: { type: 'string', description: '2-3 sentence overall assessment of the user\'s workload and strategic clarity' }
              },
              required: ['projectSummaries', 'taskQuestions', 'suggestedFocus', 'overallInsight'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_status_review' } }
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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('ai-status-review error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
