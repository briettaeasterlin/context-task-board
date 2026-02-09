import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { content, projectId, projectName } = await req.json();
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
Rules:
- Keep task titles short and actionable (under 10 words ideally)
- When something is waiting on someone else, set status to "Waiting" and fill blockedBy with who/what
- When something is actionable now, set status to "Next"
- When something is future work, set status to "Backlog"
- When something is completed, set status to "Done"
- Put detailed context in the context field
- Ask clarifying questions when scope is unclear, dependencies are ambiguous, or acceptance criteria are missing`
          },
          {
            role: 'user',
            content: `${projectName ? `Project: ${projectName}\n\n` : ''}Update:\n${content}`
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
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Short, actionable task title' },
                      area: { type: 'string', enum: ['Client', 'Business', 'Home', 'Family', 'Personal'] },
                      status: { type: 'string', enum: ['Backlog', 'Next', 'Waiting', 'Done'] },
                      context: { type: 'string', description: 'Additional context' },
                      blockedBy: { type: 'string', description: 'Who/what is blocking (for Waiting tasks)' }
                    },
                    required: ['title', 'status'],
                    additionalProperties: false
                  }
                },
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string', description: 'Clarifying question about scope or dependencies' },
                      reason: { type: 'string', description: 'Why this question matters' }
                    },
                    required: ['question'],
                    additionalProperties: false
                  }
                }
              },
              required: ['summary', 'tasks', 'questions'],
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
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('ai-extract error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
