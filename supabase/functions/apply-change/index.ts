import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposed_change_id, user_id } = await req.json();

    if (!proposed_change_id || typeof proposed_change_id !== "string") {
      return new Response(
        JSON.stringify({ error: "proposed_change_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Fetch proposed change
    const { data: change, error: fetchError } = await supabase
      .from("proposed_changes")
      .select("*")
      .eq("id", proposed_change_id)
      .single();

    if (fetchError || !change) {
      return new Response(
        JSON.stringify({ error: "Proposed change not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Validate
    if (change.user_id !== user_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — change does not belong to this user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (change.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Change already ${change.status}` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const proposedFields = (change.proposed_fields as Record<string, unknown>) ?? {};
    let entityId: string | null = null;
    let action = "";
    let newValues: Record<string, unknown> = {};

    // Step 3: Apply based on change_type
    switch (change.change_type) {
      case "create_task": {
        const taskRow: Record<string, unknown> = {
          user_id,
          title: change.summary,
          status: proposedFields.status ?? "Backlog",
          ...(proposedFields.due_date ? { due_date: proposedFields.due_date } : {}),
          ...(proposedFields.notes ? { notes: proposedFields.notes } : {}),
        };

        const { data: newTask, error: createError } = await supabase
          .from("tasks")
          .insert(taskRow)
          .select("id")
          .single();

        if (createError) {
          console.error("Failed to create task:", createError);
          throw new Error("Failed to create task");
        }

        entityId = newTask.id;
        action = "create";
        newValues = taskRow;
        break;
      }

      case "update_task": {
        const targetId = change.target_task_id;
        if (!targetId) {
          return new Response(
            JSON.stringify({ error: "No target_task_id for update_task" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify task belongs to user
        const { data: existing, error: taskErr } = await supabase
          .from("tasks")
          .select("id, user_id")
          .eq("id", targetId)
          .single();

        if (taskErr || !existing || existing.user_id !== user_id) {
          return new Response(
            JSON.stringify({ error: "Target task not found or unauthorized" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updates: Record<string, unknown> = {};
        if (proposedFields.status) updates.status = proposedFields.status;
        if (proposedFields.due_date) updates.due_date = proposedFields.due_date;
        if (proposedFields.notes) updates.notes = proposedFields.notes;

        if (Object.keys(updates).length > 0) {
          const { error: updateErr } = await supabase
            .from("tasks")
            .update(updates)
            .eq("id", targetId);

          if (updateErr) {
            console.error("Failed to update task:", updateErr);
            throw new Error("Failed to update task");
          }
        }

        entityId = targetId;
        action = "update";
        newValues = updates;
        break;
      }

      case "complete_task": {
        const targetId = change.target_task_id;
        if (!targetId) {
          return new Response(
            JSON.stringify({ error: "No target_task_id for complete_task" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing, error: taskErr } = await supabase
          .from("tasks")
          .select("id, user_id")
          .eq("id", targetId)
          .single();

        if (taskErr || !existing || existing.user_id !== user_id) {
          return new Response(
            JSON.stringify({ error: "Target task not found or unauthorized" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: completeErr } = await supabase
          .from("tasks")
          .update({ status: "Done" })
          .eq("id", targetId);

        if (completeErr) {
          console.error("Failed to complete task:", completeErr);
          throw new Error("Failed to complete task");
        }

        entityId = targetId;
        action = "update";
        newValues = { status: "Done" };
        break;
      }

      case "waiting_task": {
        const targetId = change.target_task_id;
        if (!targetId) {
          return new Response(
            JSON.stringify({ error: "No target_task_id for waiting_task" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing, error: taskErr } = await supabase
          .from("tasks")
          .select("id, user_id")
          .eq("id", targetId)
          .single();

        if (taskErr || !existing || existing.user_id !== user_id) {
          return new Response(
            JSON.stringify({ error: "Target task not found or unauthorized" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: waitErr } = await supabase
          .from("tasks")
          .update({ status: "Waiting" })
          .eq("id", targetId);

        if (waitErr) {
          console.error("Failed to set task to waiting:", waitErr);
          throw new Error("Failed to update task");
        }

        entityId = targetId;
        action = "update";
        newValues = { status: "Waiting" };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown change_type: ${change.change_type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Step 4: Audit log
    const { error: auditErr } = await supabase.from("audit_log").insert({
      user_id,
      entity_type: "task",
      entity_id: entityId,
      action,
      new_values: newValues,
      source: "llm_reviewed",
      proposed_change_id,
    });

    if (auditErr) {
      console.error("Failed to write audit log:", auditErr);
      // Non-fatal — don't fail the request
    }

    // Step 5: Update proposed change status
    const { error: statusErr } = await supabase
      .from("proposed_changes")
      .update({
        status: "applied",
        reviewed_by: "user",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", proposed_change_id);

    if (statusErr) {
      console.error("Failed to update proposed change status:", statusErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("apply-change error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
