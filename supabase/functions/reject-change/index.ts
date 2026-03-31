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

    const { data: change, error: fetchError } = await supabase
      .from("proposed_changes")
      .select("id, user_id, status")
      .eq("id", proposed_change_id)
      .single();

    if (fetchError || !change) {
      return new Response(
        JSON.stringify({ error: "Proposed change not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (change.user_id !== user_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (change.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Change already ${change.status}` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await supabase
      .from("proposed_changes")
      .update({
        status: "rejected",
        reviewed_by: "user",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", proposed_change_id);

    if (updateErr) {
      console.error("Failed to reject change:", updateErr);
      throw new Error("Failed to reject change");
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id,
      entity_type: "proposed_change",
      entity_id: proposed_change_id,
      action: "reject",
      new_values: { status: "rejected" },
      source: "llm_reviewed",
      proposed_change_id,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("reject-change error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
