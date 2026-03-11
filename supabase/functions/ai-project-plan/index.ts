import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
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
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { project, tasks, milestones } = await req.json();

    if (!project || !tasks) {
      return new Response(JSON.stringify({ error: 'project and tasks are required' }), {
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
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a senior project manager. Given a project and its tasks, generate a structured execution plan.

RULES:
- Derive an objective from the project name, summary, and scope notes
- Group tasks into 2-4 logical phases (e.g. "Launch", "Stabilization", "Learning Loop")
- Each phase should have a name and the task IDs that belong to it
- Identify dependencies: tasks in Waiting status or with blocked_by values
- Assess project health: "On Track", "At Risk", or "Blocked" based on waiting tasks, staleness, and completion rate
- Use existing milestones if available, otherwise suggest 2-4 milestones
- Be concise and operational`
          },
          {
            role: 'user',
            content: JSON.stringify({ project, tasks, milestones })
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_project_plan',
            description: 'Generate a structured project execution plan.',
            parameters: {
              type: 'object',
              properties: {
                objective: { type: 'string', description: '1-2 sentence project objective' },
                healthStatus: { type: 'string', enum: ['On Track', 'At Risk', 'Blocked'] },
                healthReason: { type: 'string', description: 'Brief reason for health status' },
                completionPercent: { type: 'number' },
                phases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      taskIds: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'description', 'taskIds'],
                    additionalProperties: false
                  }
                },
                dependencies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      blockedBy: { type: 'string' }
                    },
                    required: ['taskId', 'taskTitle', 'blockedBy'],
                    additionalProperties: false
                  }
                },
                suggestedMilestones: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' }
                    },
                    required: ['name'],
                    additionalProperties: false
                  }
                },
                decompositionSuggestions: {
                  type: 'array',
                  description: 'High-level tasks that could be broken down further',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      suggestedSubtasks: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['taskId', 'taskTitle', 'suggestedSubtasks'],
                    additionalProperties: false
                  }
                }
              },
              required: ['objective', 'healthStatus', 'healthReason', 'completionPercent', 'phases', 'dependencies'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_project_plan' } }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
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
    console.error('ai-project-plan error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
