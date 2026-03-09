import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface AuthResult {
  userId: string;
  authMethod: "jwt" | "api_key";
}

async function authenticate(
  req: Request,
  supabaseUrl: string,
  serviceKey: string
): Promise<AuthResult | Response> {
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // Try Bearer token (JWT) first
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) {
      return { userId: data.claims.sub as string, authMethod: "jwt" };
    }
  }

  // Try X-API-Key header
  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
  if (apiKey) {
    const keyHash = await sha256(apiKey);
    const { data: keyRecord, error: keyError } = await supabaseAdmin
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (keyError || !keyRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "API key expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check permissions
    if (!keyRecord.permissions.includes("vector:ingest")) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at
    await supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id);

    return { userId: keyRecord.user_id, authMethod: "api_key" };
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized — provide Bearer token or X-API-Key" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Authenticate
    const authResult = await authenticate(req, supabaseUrl, serviceKey);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse payload
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!payload.operation_id || typeof payload.operation_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid operation_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!payload.timestamp || !payload.source) {
      return new Response(
        JSON.stringify({ error: "Missing timestamp or source" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const validSources = ["chatgpt", "claude", "manual"];
    if (!validSources.includes(payload.source)) {
      return new Response(
        JSON.stringify({ error: "Invalid source — must be chatgpt, claude, or manual" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency check
    const { data: existingOp } = await supabase
      .from("operation_log")
      .select("result")
      .eq("operation_id", payload.operation_id)
      .single();

    if (existingOp) {
      return new Response(JSON.stringify(existingOp.result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve projects
    const { data: userProjects } = await supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", userId)
      .is("deleted_at", null);

    const projectMap = new Map<string, string>();
    const projectMapLower = new Map<string, string>();
    for (const p of userProjects ?? []) {
      projectMap.set(p.name, p.id);
      projectMapLower.set(p.name.toLowerCase(), p.id);
    }

    function resolveProject(name?: string): string | null {
      if (!name) return null;
      return projectMap.get(name) ?? projectMapLower.get(name.toLowerCase()) ?? null;
    }

    // Resolve milestones
    const { data: userMilestones } = await supabase
      .from("milestones")
      .select("id, name, project_id")
      .eq("user_id", userId);

    function resolveMilestone(name?: string | null, projectId?: string | null): string | null {
      if (!name) return null;
      const match = (userMilestones ?? []).find(
        (m) =>
          m.name.toLowerCase() === name.toLowerCase() &&
          (!projectId || m.project_id === projectId)
      );
      return match?.id ?? null;
    }

    // Find task by ID or exact title
    async function findTask(
      taskId?: string,
      title?: string,
      projectName?: string
    ): Promise<{ id: string; title: string } | null> {
      if (taskId) {
        const { data } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("id", taskId)
          .eq("user_id", userId)
          .is("deleted_at", null)
          .single();
        return data;
      }
      if (title) {
        const projectId = resolveProject(projectName);
        let query = supabase
          .from("tasks")
          .select("id, title")
          .eq("user_id", userId)
          .eq("title", title)
          .is("deleted_at", null);
        if (projectId) query = query.eq("project_id", projectId);
        const { data } = await query.limit(1).single();
        if (data) return data;
        // Try without project filter
        if (projectId) {
          const { data: fallback } = await supabase
            .from("tasks")
            .select("id, title")
            .eq("user_id", userId)
            .eq("title", title)
            .is("deleted_at", null)
            .limit(1)
            .single();
          return fallback;
        }
      }
      return null;
    }

    // Process actions
    const errors: Array<{ action: string; title_or_id: string; message: string }> = [];
    const warnings: Array<{ action: string; title_or_id: string; message: string }> = [];
    const counts = {
      tasks_completed: 0,
      tasks_created: 0,
      tasks_updated: 0,
      tasks_deleted: 0,
      project_updates_logged: 0,
      clarify_questions_created: 0,
      clarify_questions_resolved: 0,
    };

    // tasks_completed
    if (payload.tasks_completed) {
      for (const tc of payload.tasks_completed) {
        try {
          const task = await findTask(tc.task_id, tc.title, tc.project);
          if (!task) {
            errors.push({ action: "complete", title_or_id: tc.title, message: "Task not found" });
            continue;
          }
          const { error } = await supabase
            .from("tasks")
            .update({ status: "Done", updated_at: new Date().toISOString() })
            .eq("id", task.id);
          if (error) throw error;
          counts.tasks_completed++;
        } catch (e: any) {
          errors.push({ action: "complete", title_or_id: tc.title, message: e.message });
        }
      }
    }

    // tasks_created
    if (payload.tasks_created) {
      for (const tc of payload.tasks_created) {
        try {
          const projectId = resolveProject(tc.project);
          if (!projectId && tc.project) {
            warnings.push({
              action: "create",
              title_or_id: tc.title,
              message: `Project "${tc.project}" not found — created without project`,
            });
          }
          const milestoneId = resolveMilestone(tc.milestone, projectId);
          const { error } = await supabase.from("tasks").insert({
            title: tc.title,
            user_id: userId,
            project_id: projectId,
            milestone_id: milestoneId,
            status: tc.status || "Backlog",
            area: tc.area || "Personal",
            context: tc.context || null,
            notes: tc.notes || null,
            tags: tc.tags || [],
            blocked_by: tc.blocked_by || null,
            due_date: tc.due_date || null,
            target_window: tc.target_window || null,
            estimated_minutes: tc.estimated_minutes || null,
            source: payload.source,
          });
          if (error) throw error;
          counts.tasks_created++;
        } catch (e: any) {
          errors.push({ action: "create", title_or_id: tc.title, message: e.message });
        }
      }
    }

    // tasks_updated
    if (payload.tasks_updated) {
      for (const tu of payload.tasks_updated) {
        try {
          const task = await findTask(tu.task_id, tu.title, tu.project);
          if (!task) {
            errors.push({ action: "update", title_or_id: tu.title, message: "Task not found" });
            continue;
          }
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (tu.status !== undefined) updates.status = tu.status;
          if (tu.context !== undefined) updates.context = tu.context;
          if (tu.notes !== undefined) updates.notes = tu.notes;
          if (tu.blocked_by !== undefined) updates.blocked_by = tu.blocked_by;
          if (tu.due_date !== undefined) updates.due_date = tu.due_date;
          if (tu.target_window !== undefined) updates.target_window = tu.target_window;
          if (tu.tags !== undefined) updates.tags = tu.tags;
          if (tu.milestone !== undefined) {
            const projectId = resolveProject(tu.project);
            updates.milestone_id = resolveMilestone(tu.milestone, projectId);
          }
          const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
          if (error) throw error;
          counts.tasks_updated++;
        } catch (e: any) {
          errors.push({ action: "update", title_or_id: tu.title, message: e.message });
        }
      }
    }

    // tasks_deleted (soft delete)
    if (payload.tasks_deleted) {
      for (const td of payload.tasks_deleted) {
        try {
          const task = await findTask(td.task_id, td.title, td.project);
          if (!task) {
            errors.push({ action: "delete", title_or_id: td.title, message: "Task not found" });
            continue;
          }
          const { error } = await supabase
            .from("tasks")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", task.id);
          if (error) throw error;
          counts.tasks_deleted++;
        } catch (e: any) {
          errors.push({ action: "delete", title_or_id: td.title, message: e.message });
        }
      }
    }

    // project_updates
    if (payload.project_updates) {
      for (const pu of payload.project_updates) {
        try {
          const projectId = resolveProject(pu.project);
          if (!projectId) {
            errors.push({
              action: "project_update",
              title_or_id: pu.project,
              message: "Project not found",
            });
            continue;
          }
          const validSources = ["chatgpt", "meeting", "email", "call", "doc"];
          const source = pu.source && validSources.includes(pu.source) ? pu.source : payload.source === "claude" ? "chatgpt" : payload.source;
          const { error } = await supabase.from("updates").insert({
            user_id: userId,
            project_id: projectId,
            content: pu.summary,
            source: validSources.includes(source) ? source : "chatgpt",
          });
          if (error) throw error;
          counts.project_updates_logged++;
        } catch (e: any) {
          errors.push({ action: "project_update", title_or_id: pu.project, message: e.message });
        }
      }
    }

    // clarify_questions_created
    if (payload.clarify_questions_created) {
      for (const cq of payload.clarify_questions_created) {
        try {
          const projectId = resolveProject(cq.project);
          if (!projectId) {
            errors.push({
              action: "clarify_create",
              title_or_id: cq.question,
              message: "Project not found",
            });
            continue;
          }
          const { error } = await supabase.from("clarify_questions").insert({
            user_id: userId,
            project_id: projectId,
            question: cq.question,
            reason: cq.reason || null,
            suggested_options: cq.suggested_options || null,
          });
          if (error) throw error;
          counts.clarify_questions_created++;
        } catch (e: any) {
          errors.push({ action: "clarify_create", title_or_id: cq.question, message: e.message });
        }
      }
    }

    // clarify_questions_resolved
    if (payload.clarify_questions_resolved) {
      for (const cr of payload.clarify_questions_resolved) {
        try {
          let questionId = cr.question_id;
          if (!questionId) {
            // Find by question text
            const projectId = resolveProject(cr.project);
            let query = supabase
              .from("clarify_questions")
              .select("id")
              .eq("user_id", userId)
              .eq("question", cr.question)
              .eq("status", "open");
            if (projectId) query = query.eq("project_id", projectId);
            const { data } = await query.limit(1).single();
            questionId = data?.id;
          }
          if (!questionId) {
            errors.push({
              action: "clarify_resolve",
              title_or_id: cr.question,
              message: "Question not found",
            });
            continue;
          }
          const { error } = await supabase
            .from("clarify_questions")
            .update({
              status: cr.status,
              answer: cr.answer || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", questionId);
          if (error) throw error;
          counts.clarify_questions_resolved++;
        } catch (e: any) {
          errors.push({ action: "clarify_resolve", title_or_id: cr.question, message: e.message });
        }
      }
    }

    // Build result
    const result = {
      operation_id: payload.operation_id,
      processed_at: new Date().toISOString(),
      success: errors.length === 0,
      actions: counts,
      errors,
      warnings,
    };

    // Log operation (use service role to bypass RLS)
    await supabase.from("operation_log").insert({
      operation_id: payload.operation_id,
      user_id: userId,
      source: payload.source,
      payload,
      result,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("vector-ingest error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
