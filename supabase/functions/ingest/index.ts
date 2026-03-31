import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_SCHEMA = {
  name: "extract_proposed_changes",
  description:
    "Extract actionable task changes from raw text. Identify tasks to create, update, complete, or set to waiting.",
  parameters: {
    type: "object",
    properties: {
      proposed_changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            change_type: {
              type: "string",
              enum: ["create_task", "update_task", "complete_task", "waiting_task"],
            },
            title: { type: "string", description: "Task title" },
            target_task_id: {
              type: "string",
              description: "Existing task ID if updating/completing. Null for new tasks.",
            },
            project_name: {
              type: "string",
              description: "Project name this task belongs to, if mentioned.",
            },
            proposed_fields: {
              type: "object",
              properties: {
                status: { type: "string" },
                due_date: { type: "string" },
                notes: { type: "string" },
              },
            },
            confidence: {
              type: "number",
              description: "0-1 confidence score for this extraction",
            },
            reasoning: {
              type: "string",
              description: "Brief explanation of why this change was extracted",
            },
          },
          required: ["change_type", "title", "confidence", "reasoning"],
        },
      },
    },
    required: ["proposed_changes"],
  },
};

const SYSTEM_PROMPT = `You are a task extraction assistant for a personal productivity app called NextMove.

You receive raw text from conversations the user had with ChatGPT or Claude.
Your job is to identify actionable items and propose structured changes.

Rules:
- Extract concrete, actionable tasks only — not vague intentions
- If text mentions completing or finishing something, use "complete_task"
- If text mentions waiting on someone/something, use "waiting_task"
- If text mentions updating details of an existing task, use "update_task"
- For new action items, use "create_task"
- Set confidence based on how clearly the text implies the action (0.0–1.0)
- Include brief reasoning for each extraction
- If no actionable items exist, return an empty array`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, source, raw_text } = await req.json();

    // Validate input
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!source || !["chatgpt", "claude"].includes(source)) {
      return new Response(
        JSON.stringify({ error: 'source must be "chatgpt" or "claude"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "raw_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Store raw input as source_event
    const { data: sourceEvent, error: sourceError } = await supabase
      .from("source_events")
      .insert({
        user_id,
        source,
        raw_content: raw_text,
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sourceError) {
      console.error("Failed to store source event:", sourceError);
      throw new Error("Failed to store source event");
    }

    // Step 2: Call LLM with structured output via tool calling
    const llmResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Extract proposed changes from this ${source} conversation:\n\n${raw_text}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: EXTRACTION_SCHEMA,
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_proposed_changes" },
          },
        }),
      }
    );

    if (!llmResponse.ok) {
      const status = llmResponse.status;
      const body = await llmResponse.text();
      console.error("LLM error:", status, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted — please top up" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`LLM request failed with status ${status}`);
    }

    const llmData = await llmResponse.json();

    // Parse tool call result
    const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in LLM response:", JSON.stringify(llmData));
      return new Response(
        JSON.stringify({ success: true, proposed_changes_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted: { proposed_changes: any[] };
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse LLM arguments:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: true, proposed_changes_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const proposedChanges = extracted.proposed_changes ?? [];

    // Step 3: Insert proposed changes
    if (proposedChanges.length > 0) {
      const rows = proposedChanges.map((pc: any) => ({
        user_id,
        change_type: pc.change_type,
        summary: pc.title,
        target_task_id: pc.target_task_id || null,
        target_project_id: null,
        proposed_fields: pc.proposed_fields ?? {},
        confidence: String(pc.confidence ?? "medium"),
        reasoning: pc.reasoning ?? null,
        source,
        status: "pending",
        requires_review: true,
        source_event_id: sourceEvent.id,
      }));

      const { error: insertError } = await supabase
        .from("proposed_changes")
        .insert(rows);

      if (insertError) {
        console.error("Failed to insert proposed changes:", insertError);
        throw new Error("Failed to store proposed changes");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        proposed_changes_created: proposedChanges.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ingest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
