import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://context-task-board.lovable.app",
  "https://id-preview--6cb26484-5f83-41ed-b635-41425bad5c23.lovable.app",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const SUPPORTED_VERSIONS = ["1.0", "1.1"];
const RATE_LIMIT_PER_MINUTE = 30;

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
  apiKeyId?: string;
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
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user?.id) {
      return { userId: user.id, authMethod: "jwt" };
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
        { status: 401, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "API key expired" }),
        { status: 401, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!keyRecord.permissions.includes("vector:ingest")) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check allowed_ips if set
    if (keyRecord.allowed_ips?.length > 0) {
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!keyRecord.allowed_ips.includes(clientIp)) {
        return new Response(
          JSON.stringify({ error: "IP not allowed" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update last_used_at
    await supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id);

    return { userId: keyRecord.user_id, authMethod: "api_key", apiKeyId: keyRecord.id };
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized — provide Bearer token or X-API-Key" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function checkRateLimit(
  supabase: any,
  apiKeyId: string
): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("requested_at", oneMinuteAgo);

  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) return false;

  await supabase.from("rate_limit_log").insert({ api_key_id: apiKeyId });
  return true;
}

function computePayloadHash(payload: any): Promise<string> {
  const normalized = JSON.stringify({
    source: payload.source,
    tasks_completed: payload.tasks_completed || [],
    tasks_created: payload.tasks_created || [],
    tasks_updated: payload.tasks_updated || [],
    tasks_deleted: payload.tasks_deleted || [],
    project_updates: payload.project_updates || [],
    clarify_questions_created: payload.clarify_questions_created || [],
    clarify_questions_resolved: payload.clarify_questions_resolved || [],
    tomorrow_priorities: payload.tomorrow_priorities || [],
  });
  return sha256(normalized);
}

let _corsHeaders: Record<string, string> = {};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ..._corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  _corsHeaders = corsHeaders;
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // GET: schema discovery
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "schema") {
      return jsonResponse({
        version: "1.1",
        supported_versions: SUPPORTED_VERSIONS,
        endpoints: {
          ingest: "POST /vector-ingest",
          schema: "GET /vector-ingest?action=schema",
        },
        payload_fields: {
          required: ["operation_id", "timestamp", "source"],
          optional: ["schema_version", "tasks_completed", "tasks_created", "tasks_updated", "tasks_deleted", "project_updates", "clarify_questions_created", "clarify_questions_resolved", "tomorrow_priorities"],
        },
        sources: ["chatgpt", "claude", "manual"],
      });
    }
    return jsonResponse({ error: "Use ?action=schema for discovery" }, 400);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Authenticate
    const authResult = await authenticate(req, supabaseUrl, serviceKey);
    if (authResult instanceof Response) return authResult;
    const { userId, authMethod, apiKeyId } = authResult;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Rate limit check for API key auth
    if (authMethod === "api_key" && apiKeyId) {
      const allowed = await checkRateLimit(supabase, apiKeyId);
      if (!allowed) {
        return jsonResponse({
          error: "Rate limit exceeded",
          retry_after_seconds: 60,
          limit: `${RATE_LIMIT_PER_MINUTE} requests per minute`,
        }, 429);
      }
    }

    // Parse payload
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    // Schema version validation
    const schemaVersion = payload.schema_version || "1.0";
    if (!SUPPORTED_VERSIONS.includes(schemaVersion)) {
      return jsonResponse({
        error: "Unsupported schema version",
        provided: schemaVersion,
        supported: SUPPORTED_VERSIONS,
      }, 400);
    }

    // Validate required fields
    if (!payload.operation_id || typeof payload.operation_id !== "string") {
      return jsonResponse({ error: "Missing or invalid operation_id" }, 400);
    }
    // Default timestamp if missing
    if (!payload.timestamp) {
      payload.timestamp = new Date().toISOString();
    }
    if (!payload.source) {
      return jsonResponse({ error: "Missing required field: source (chatgpt, claude, or manual)" }, 400);
    }
    const validSources = ["chatgpt", "claude", "manual"];
    if (!validSources.includes(payload.source)) {
      return jsonResponse({ error: "Invalid source — must be chatgpt, claude, or manual" }, 400);
    }

    // Idempotency check
    const { data: existingOp } = await supabase
      .from("operation_log")
      .select("result")
      .eq("operation_id", payload.operation_id)
      .single();

    if (existingOp) {
      return jsonResponse(existingOp.result);
    }

    // Payload hash dedup (24h window)
    const payloadHash = await computePayloadHash(payload);
    const twentyFourHoursAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: dupOp } = await supabase
      .from("operation_log")
      .select("operation_id, result")
      .eq("payload_hash", payloadHash)
      .eq("user_id", userId)
      .gte("created_at", twentyFourHoursAgo)
      .limit(1)
      .maybeSingle();

    if (dupOp) {
      return jsonResponse({
        ...dupOp.result,
        deduplicated: true,
        original_operation_id: dupOp.operation_id,
        message: "Identical payload was processed within the last 24 hours",
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
        (m: any) => m.name.toLowerCase() === name.toLowerCase() && (!projectId || m.project_id === projectId)
      );
      return match?.id ?? null;
    }

    // Find task by ID or exact title
    async function findTask(
      taskId?: string, title?: string, projectName?: string
    ): Promise<{ id: string; title: string } | null> {
      if (taskId) {
        const { data } = await supabase
          .from("tasks").select("id, title")
          .eq("id", taskId).eq("user_id", userId).is("deleted_at", null).single();
        return data;
      }
      if (title) {
        const projectId = resolveProject(projectName);
        let query = supabase.from("tasks").select("id, title")
          .eq("user_id", userId).eq("title", title).is("deleted_at", null);
        if (projectId) query = query.eq("project_id", projectId);
        const { data } = await query.limit(1).single();
        if (data) return data;
        if (projectId) {
          const { data: fallback } = await supabase.from("tasks").select("id, title")
            .eq("user_id", userId).eq("title", title).is("deleted_at", null).limit(1).single();
          return fallback;
        }
      }
      return null;
    }

    // Process actions
    const errors: Array<{ action: string; title_or_id: string; message: string }> = [];
    const warnings: Array<{ action: string; title_or_id: string; message: string }> = [];
    const actionLog: Array<{ action_type: string; target_type: string; target_id?: string; target_title: string; confidence: string; detail?: any }> = [];
    const counts = {
      tasks_completed: 0, tasks_created: 0, tasks_updated: 0, tasks_deleted: 0,
      project_updates_logged: 0, clarify_questions_created: 0, clarify_questions_resolved: 0,
    };

    // tasks_completed
    if (payload.tasks_completed) {
      for (const tc of payload.tasks_completed) {
        const confidence = tc.confidence || "high";
        try {
          const task = await findTask(tc.task_id, tc.title, tc.project);
          if (!task) { errors.push({ action: "complete", title_or_id: tc.title, message: "Task not found" }); continue; }
          const { error } = await supabase.from("tasks")
            .update({ status: "Done", updated_at: new Date().toISOString() }).eq("id", task.id);
          if (error) throw error;
          counts.tasks_completed++;
          actionLog.push({ action_type: "complete", target_type: "task", target_id: task.id, target_title: task.title, confidence });
        } catch (e: any) {
          errors.push({ action: "complete", title_or_id: tc.title, message: e.message });
        }
      }
    }

    // tasks_created
    if (payload.tasks_created) {
      for (const tc of payload.tasks_created) {
        const confidence = tc.confidence || "high";
        try {
          const projectId = resolveProject(tc.project);
          if (!projectId && tc.project) {
            warnings.push({ action: "create", title_or_id: tc.title, message: `Project "${tc.project}" not found — created without project` });
          }
          const milestoneId = resolveMilestone(tc.milestone, projectId);
          const { data: created, error } = await supabase.from("tasks").insert({
            title: tc.title, user_id: userId, project_id: projectId, milestone_id: milestoneId,
            status: tc.status || "Backlog", area: tc.area || "Personal",
            context: tc.context || null, notes: tc.notes || null, tags: tc.tags || [],
            blocked_by: tc.blocked_by || null, due_date: tc.due_date || null,
            target_window: tc.target_window || null, estimated_minutes: tc.estimated_minutes || null,
            source: payload.source,
          }).select("id").single();
          if (error) throw error;
          counts.tasks_created++;
          actionLog.push({ action_type: "create", target_type: "task", target_id: created?.id, target_title: tc.title, confidence });
        } catch (e: any) {
          errors.push({ action: "create", title_or_id: tc.title, message: e.message });
        }
      }
    }

    // tasks_updated
    if (payload.tasks_updated) {
      for (const tu of payload.tasks_updated) {
        const confidence = tu.confidence || "high";
        try {
          const task = await findTask(tu.task_id, tu.title, tu.project);
          if (!task) { errors.push({ action: "update", title_or_id: tu.title, message: "Task not found" }); continue; }
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
          actionLog.push({ action_type: "update", target_type: "task", target_id: task.id, target_title: task.title, confidence, detail: updates });
        } catch (e: any) {
          errors.push({ action: "update", title_or_id: tu.title, message: e.message });
        }
      }
    }

    // tasks_deleted (soft delete)
    if (payload.tasks_deleted) {
      for (const td of payload.tasks_deleted) {
        const confidence = td.confidence || "high";
        try {
          const task = await findTask(td.task_id, td.title, td.project);
          if (!task) { errors.push({ action: "delete", title_or_id: td.title, message: "Task not found" }); continue; }
          const { error } = await supabase.from("tasks")
            .update({ deleted_at: new Date().toISOString() }).eq("id", task.id);
          if (error) throw error;
          counts.tasks_deleted++;
          actionLog.push({ action_type: "delete", target_type: "task", target_id: task.id, target_title: task.title, confidence });
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
          if (!projectId) { errors.push({ action: "project_update", title_or_id: pu.project, message: "Project not found" }); continue; }
          const validUpdateSources = ["chatgpt", "meeting", "email", "call", "doc"];
          const source = pu.source && validUpdateSources.includes(pu.source) ? pu.source : payload.source === "claude" ? "chatgpt" : payload.source;
          const { error } = await supabase.from("updates").insert({
            user_id: userId, project_id: projectId, content: pu.summary,
            source: validUpdateSources.includes(source) ? source : "chatgpt",
          });
          if (error) throw error;
          counts.project_updates_logged++;
          actionLog.push({ action_type: "create", target_type: "update", target_id: projectId, target_title: pu.project, confidence: "high" });
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
          if (!projectId) { errors.push({ action: "clarify_create", title_or_id: cq.question, message: "Project not found" }); continue; }
          const { error } = await supabase.from("clarify_questions").insert({
            user_id: userId, project_id: projectId, question: cq.question,
            reason: cq.reason || null, suggested_options: cq.suggested_options || null,
          });
          if (error) throw error;
          counts.clarify_questions_created++;
          actionLog.push({ action_type: "create", target_type: "clarify_question", target_title: cq.question, confidence: "high" });
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
            const projectId = resolveProject(cr.project);
            let query = supabase.from("clarify_questions").select("id")
              .eq("user_id", userId).eq("question", cr.question).eq("status", "open");
            if (projectId) query = query.eq("project_id", projectId);
            const { data } = await query.limit(1).single();
            questionId = data?.id;
          }
          if (!questionId) { errors.push({ action: "clarify_resolve", title_or_id: cr.question, message: "Question not found" }); continue; }
          const { error } = await supabase.from("clarify_questions")
            .update({ status: cr.status, answer: cr.answer || null, updated_at: new Date().toISOString() })
            .eq("id", questionId);
          if (error) throw error;
          counts.clarify_questions_resolved++;
          actionLog.push({ action_type: "resolve", target_type: "clarify_question", target_id: questionId, target_title: cr.question, confidence: "high" });
        } catch (e: any) {
          errors.push({ action: "clarify_resolve", title_or_id: cr.question, message: e.message });
        }
      }
    }

    // Identify low-confidence actions
    const lowConfidenceActions = actionLog.filter(a => a.confidence === "low");

    // Build result
    const result: any = {
      operation_id: payload.operation_id,
      schema_version: schemaVersion,
      processed_at: new Date().toISOString(),
      success: errors.length === 0,
      actions: counts,
      errors,
      warnings,
    };

    if (lowConfidenceActions.length > 0) {
      result.low_confidence_actions = lowConfidenceActions.map(a => ({
        action_type: a.action_type,
        target_type: a.target_type,
        target_title: a.target_title,
      }));
    }

    // Log operation
    const { data: opLog } = await supabase.from("operation_log").insert({
      operation_id: payload.operation_id,
      user_id: userId,
      source: payload.source,
      payload,
      result,
      payload_hash: payloadHash,
      schema_version: schemaVersion,
    }).select("id").single();

    // Log individual actions
    if (opLog && actionLog.length > 0) {
      await supabase.from("operation_actions").insert(
        actionLog.map(a => ({
          operation_log_id: opLog.id,
          user_id: userId,
          action_type: a.action_type,
          target_type: a.target_type,
          target_id: a.target_id || null,
          target_title: a.target_title,
          confidence: a.confidence,
          detail: a.detail || null,
        }))
      );
    }

    return jsonResponse(result);
  } catch (err: any) {
    console.error("vector-ingest error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
