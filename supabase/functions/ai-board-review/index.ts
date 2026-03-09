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
            content: `You are an executive assistant conducting a weekly board review of a personal task management system. Today is ${todayISO}.

Your job is to analyze ALL tasks and projects and produce a structured operational review.

ANALYSIS RULES:
1. **Promote to Next**: Find high-priority Backlog tasks that should move to Next based on deadlines, dependencies, and strategic importance. Max 5-7 suggestions.
2. **Possibly Completed**: Find tasks marked Next or Waiting that seem likely done based on age, title patterns, or context. Ask user to confirm.
3. **Waiting Too Long**: Find tasks in Waiting status with updated_at > 7 days ago. Suggest sending reminders or marking blocked.
4. **Stale Tasks**: Find tasks in Backlog or Next untouched for 30+ days. Suggest Someday, Archive, or Keep.
5. **Board Health**: Count active initiatives, tasks in Next (recommend max 5-7), blocked tasks, high-impact pending.
6. **Weekly Focus**: Group recommended focus tasks by project. Max 2-3 tasks per project, max 3-4 projects.

TONE: Concise, operational, like a chief of staff briefing. Use data-driven observations.

IMPORTANT: Never automatically change anything. All outputs are SUGGESTIONS that require user confirmation.
For each suggestion, include the task ID so the frontend can apply changes on confirmation.`
          },
          {
            role: 'user',
            content: `Here are my projects and tasks:\n\n${JSON.stringify({ projects, tasks }, null, 2)}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_board_review',
            description: 'Generate a structured weekly board review with suggested changes.',
            parameters: {
              type: 'object',
              properties: {
                promoteToNext: {
                  type: 'array',
                  description: 'Backlog tasks that should be promoted to Next',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      projectName: { type: 'string' },
                      reason: { type: 'string' }
                    },
                    required: ['taskId', 'taskTitle', 'projectName', 'reason'],
                    additionalProperties: false
                  }
                },
                possiblyCompleted: {
                  type: 'array',
                  description: 'Tasks that might already be done',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      currentStatus: { type: 'string' },
                      reason: { type: 'string' }
                    },
                    required: ['taskId', 'taskTitle', 'currentStatus', 'reason'],
                    additionalProperties: false
                  }
                },
                waitingTooLong: {
                  type: 'array',
                  description: 'Tasks stuck in Waiting > 7 days',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      daysWaiting: { type: 'number' },
                      blockedBy: { type: 'string' },
                      suggestedAction: { type: 'string', description: 'e.g. "Send reminder", "Mark blocked", "Move to Backlog"' }
                    },
                    required: ['taskId', 'taskTitle', 'daysWaiting', 'suggestedAction'],
                    additionalProperties: false
                  }
                },
                staleTasks: {
                  type: 'array',
                  description: 'Tasks untouched for 30+ days',
                  items: {
                    type: 'object',
                    properties: {
                      taskId: { type: 'string' },
                      taskTitle: { type: 'string' },
                      currentStatus: { type: 'string' },
                      daysSinceUpdate: { type: 'number' },
                      suggestedAction: { type: 'string', enum: ['Someday', 'Archive', 'Keep'] }
                    },
                    required: ['taskId', 'taskTitle', 'currentStatus', 'daysSinceUpdate', 'suggestedAction'],
                    additionalProperties: false
                  }
                },
                boardHealth: {
                  type: 'object',
                  properties: {
                    activeInitiatives: { type: 'number' },
                    tasksInNext: { type: 'number' },
                    recommendedNextMax: { type: 'number' },
                    tasksBlocked: { type: 'number' },
                    highImpactPending: { type: 'number' },
                    totalTasks: { type: 'number' },
                    healthNote: { type: 'string', description: '1-2 sentence health assessment' }
                  },
                  required: ['activeInitiatives', 'tasksInNext', 'recommendedNextMax', 'tasksBlocked', 'highImpactPending', 'totalTasks', 'healthNote'],
                  additionalProperties: false
                },
                weeklyFocus: {
                  type: 'array',
                  description: 'Recommended focus grouped by project',
                  items: {
                    type: 'object',
                    properties: {
                      projectName: { type: 'string' },
                      tasks: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            taskId: { type: 'string' },
                            taskTitle: { type: 'string' },
                            estimatedTime: { type: 'string' }
                          },
                          required: ['taskId', 'taskTitle'],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ['projectName', 'tasks'],
                    additionalProperties: false
                  }
                },
                executiveSummary: { type: 'string', description: '2-3 sentence executive summary of the board state' }
              },
              required: ['promoteToNext', 'possiblyCompleted', 'waitingTooLong', 'staleTasks', 'boardHealth', 'weeklyFocus', 'executiveSummary'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_board_review' } }
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
    console.error('ai-board-review error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
