import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
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

  // Try Bearer token (JWT)
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

  // Try X-API-Key
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
      return json({ error: "Invalid API key" }, 401);
    }
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return json({ error: "API key expired" }, 401);
    }
    if (!keyRecord.permissions.includes("vector:read")) {
      return json({ error: "Insufficient permissions — requires vector:read" }, 403);
    }
    if (keyRecord.allowed_ips?.length > 0) {
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!keyRecord.allowed_ips.includes(clientIp)) {
        return json({ error: "IP not allowed" }, 403);
      }
    }

    await supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id);

    return { userId: keyRecord.user_id, authMethod: "api_key" };
  }

  return json({ error: "Missing auth (Authorization or x-api-key)" }, 401);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed — use GET" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authResult = await authenticate(req, supabaseUrl, serviceKey);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const supabase = createClient(supabaseUrl, serviceKey);
    const url = new URL(req.url);

    const scope = url.searchParams.get("scope") || "active";
    const projectFilter = url.searchParams.get("project") || null;
    const includeParam = url.searchParams.get("include") || "";
    const sinceParam = url.searchParams.get("since") || null;
    const includes = new Set(includeParam.split(",").map((s) => s.trim()).filter(Boolean));

    // Validate scope
    if (!["active", "full", "project"].includes(scope)) {
      return json({ error: "Invalid scope — use active, full, or project" }, 400);
    }
    if (scope === "project" && !projectFilter) {
      return json({ error: "scope=project requires a project parameter" }, 400);
    }

    // Fetch projects
    let projectsQuery = supabase
      .from("projects")
      .select("id, name, area, summary, scope_notes")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("name");

    const { data: projects } = await projectsQuery;
    const projectList = projects ?? [];
    const projectMap = new Map(projectList.map((p: any) => [p.id, p]));
    const projectNameMap = new Map(projectList.map((p: any) => [p.name.toLowerCase(), p]));

    // Resolve project filter
    let filterProjectId: string | null = null;
    if (projectFilter) {
      const found = projectNameMap.get(projectFilter.toLowerCase());
      if (!found) return json({ error: `Project "${projectFilter}" not found` }, 404);
      filterProjectId = found.id;
    }

    // Fetch tasks
    let tasksQuery = supabase
      .from("tasks")
      .select("id, title, status, area, project_id, milestone_id, context, notes, tags, blocked_by, due_date, target_window, estimated_minutes, created_at, updated_at, source")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (scope === "active") {
      tasksQuery = tasksQuery.in("status", ["Next", "Waiting", "Backlog"]);
    }
    if (filterProjectId) {
      tasksQuery = tasksQuery.eq("project_id", filterProjectId);
    }
    if (sinceParam) {
      tasksQuery = tasksQuery.gte("updated_at", sinceParam);
    }

    tasksQuery = tasksQuery.order("status").order("updated_at", { ascending: false }).limit(1000);
    const { data: tasks } = await tasksQuery;
    const taskList = tasks ?? [];

    // Build status counts
    const byStatus: Record<string, number> = {};
    for (const t of taskList) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    }

    // Compute alerts
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const alerts: Array<{ type: string; message: string; tasks?: string[] }> = [];

    const staleWaiting = taskList.filter(
      (t: any) => t.status === "Waiting" && new Date(t.updated_at) < sevenDaysAgo
    );
    if (staleWaiting.length > 0) {
      alerts.push({
        type: "stale_waiting",
        message: `${staleWaiting.length} task(s) in Waiting for >7 days`,
        tasks: staleWaiting.map((t: any) => t.title),
      });
    }

    const overdue = taskList.filter(
      (t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "Done"
    );
    if (overdue.length > 0) {
      alerts.push({
        type: "overdue",
        message: `${overdue.length} task(s) past due date`,
        tasks: overdue.map((t: any) => t.title),
      });
    }

    const nextCount = byStatus["Next"] || 0;
    if (nextCount > 10) {
      alerts.push({
        type: "focus_overload",
        message: `${nextCount} tasks in Next — consider trimming to ≤10`,
      });
    }

    // Group tasks by project
    const projectsWithTasks: any[] = [];
    const tasksByProject = new Map<string | null, any[]>();
    for (const t of taskList) {
      const key = t.project_id || null;
      if (!tasksByProject.has(key)) tasksByProject.set(key, []);
      tasksByProject.get(key)!.push(t);
    }

    for (const [projId, projTasks] of tasksByProject) {
      const proj = projId ? projectMap.get(projId) : null;
      const projByStatus: Record<string, number> = {};
      for (const t of projTasks) {
        projByStatus[t.status] = (projByStatus[t.status] || 0) + 1;
      }
      projectsWithTasks.push({
        project_id: projId,
        project_name: proj?.name || "(No Project)",
        area: proj?.area || null,
        summary: proj?.summary || null,
        scope_notes: proj?.scope_notes || null,
        by_status: projByStatus,
        tasks: projTasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          area: t.area,
          context: t.context,
          notes: t.notes,
          tags: t.tags,
          blocked_by: t.blocked_by,
          due_date: t.due_date,
          target_window: t.target_window,
          estimated_minutes: t.estimated_minutes,
          milestone_id: t.milestone_id,
          updated_at: t.updated_at,
        })),
      });
    }

    // Build response
    const response: any = {
      generated_at: now.toISOString(),
      scope,
      user_id: userId,
      summary: {
        total_tasks: taskList.length,
        by_status: byStatus,
        total_projects: projectList.length,
        stale_waiting_count: staleWaiting.length,
        overdue_count: overdue.length,
      },
      projects_with_tasks: projectsWithTasks,
      alerts,
    };

    // Optional includes
    if (includes.has("milestones")) {
      let msQuery = supabase
        .from("milestones")
        .select("id, name, project_id, is_complete, order_index, description")
        .eq("user_id", userId)
        .order("order_index");
      if (filterProjectId) msQuery = msQuery.eq("project_id", filterProjectId);
      const { data: milestones } = await msQuery;
      response.milestones = milestones ?? [];
    }

    if (includes.has("clarify")) {
      let cqQuery = supabase
        .from("clarify_questions")
        .select("id, project_id, question, reason, suggested_options, status, answer, created_at")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (filterProjectId) cqQuery = cqQuery.eq("project_id", filterProjectId);
      const { data: questions } = await cqQuery;
      response.open_questions = questions ?? [];
    }

    if (includes.has("updates")) {
      let upQuery = supabase
        .from("updates")
        .select("id, project_id, content, source, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (filterProjectId) upQuery = upQuery.eq("project_id", filterProjectId);
      const { data: updates } = await upQuery;
      response.recent_updates = updates ?? [];
    }

    if (includes.has("recent_ops")) {
      const { data: ops } = await supabase
        .from("operation_log")
        .select("id, operation_id, source, result, schema_version, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      response.recent_operations = ops ?? [];
    }

    return json(response);
  } catch (e: any) {
    console.error("vector-read error:", e);
    return json({ error: "Internal server error", message: e.message }, 500);
  }
});
