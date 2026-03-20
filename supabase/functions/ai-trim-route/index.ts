import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskInfo {
  id: string;
  title: string;
  area: string;
  estimated_minutes: number | null;
  due_date: string | null;
  project_name: string | null;
  strategic_phase: string | null;
  impact_score: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { tasks } = (await req.json()) as { tasks: TaskInfo[] };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const today = new Date().toISOString().slice(0, 10);

    const taskList = tasks
      .map(
        (t, i) =>
          `${i + 1}. "${t.title}" | area=${t.area} | est=${t.estimated_minutes ?? "?"}min | due=${t.due_date ?? "none"} | project=${t.project_name ?? "none"} | phase=${t.strategic_phase ?? "none"} | impact=${t.impact_score ?? "none"}`
      )
      .join("\n");

    const systemPrompt = `You are a calm, strategic daily planning assistant for a solo professional. Today is ${today}. The user has too many tasks on their daily route (ideally 3-6 stops). Analyze the tasks and recommend which to KEEP today and which to DEFER to Backlog. Prioritize: hard deadlines > client work > high-impact > quick wins. Preserve momentum on active projects. Be concise and warm.`;

    const userPrompt = `Here are my tasks for today:\n\n${taskList}\n\nSuggest which tasks to keep and which to defer. For each deferred task, give a brief reason.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "trim_route",
                description:
                  "Return the trimmed route plan with tasks to keep and tasks to defer.",
                parameters: {
                  type: "object",
                  properties: {
                    keep: {
                      type: "array",
                      description: "Task IDs to keep on today's route",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          reason: {
                            type: "string",
                            description: "Brief reason to keep (1 sentence)",
                          },
                        },
                        required: ["id", "reason"],
                        additionalProperties: false,
                      },
                    },
                    defer: {
                      type: "array",
                      description: "Task IDs to move to Backlog",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          reason: {
                            type: "string",
                            description: "Brief reason to defer (1 sentence)",
                          },
                        },
                        required: ["id", "reason"],
                        additionalProperties: false,
                      },
                    },
                    summary: {
                      type: "string",
                      description:
                        "A brief 1-2 sentence summary of the trimming rationale",
                    },
                  },
                  required: ["keep", "defer", "summary"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "trim_route" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "No suggestion returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trim-route error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
