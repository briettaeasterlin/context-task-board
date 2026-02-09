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
            content: `You extract structured tasks and identify clarifying questions from project updates.
Context: This is a task/project tracking app for a single user named Brietta.
Areas available: Client, Business, Home, Family, Personal.
Statuses available: Backlog, Next, Waiting, Done.

Extraction rules:
- Keep task titles short and actionable (under 10 words ideally)
- Be CONSERVATIVE with status assignment:
  - Default to "Backlog" if uncertain
  - Only assign "Waiting" if there is a clear external dependency or blocker mentioned
  - Assign "Next" only for immediately actionable items
  - Assign "Done" only if explicitly stated as completed
- When something is waiting on someone else, fill blockedBy with who/what
- Put detailed context in the context field
- Prefer creating ClarifyQuestions over guessing when scope is ambiguous
- Ask clarifying questions when:
  - Scope is unclear or could mean multiple things
  - Dependencies are ambiguous
  - Acceptance criteria are missing
  - A big change happened and downstream implications are unclear`
          },
          {
            role: 'user',
            content: `${projectName ? `Project: ${projectName}\n` : ''}${source ? `Source: ${source}\n` : ''}\nUpdate:\n${rawText}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_from_update',
            description: 'Extract a summary, actionable tasks, and clarifying questions from a project update',
            parameters: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: '2-3 sentence summary of the update' },
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
              required: ['summary', 'extractedTasks', 'extractedClarifyQuestions'],
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
      extractedTasks: (result.extractedTasks ?? result.tasks ?? []).map((t: any) => ({
        title: t.title,
        area: t.area || 'Personal',
        status: t.status || 'Backlog',
        context: t.context || null,
        blockedBy: t.blockedBy || null,
        projectId: projectId || null,
        milestoneId: null,
      })),
      extractedClarifyQuestions: (result.extractedClarifyQuestions ?? result.questions ?? []).map((q: any) => ({
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
