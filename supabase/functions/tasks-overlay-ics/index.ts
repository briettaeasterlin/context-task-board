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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function escapeICS(str: string): string {
  return str.replace(/[\\;,\n]/g, (match) => {
    if (match === '\n') return '\\n';
    return '\\' + match;
  });
}

function formatICSDate(date: string, time: string): string {
  const [y, m, d] = date.split('-');
  const [h, min] = time.split(':');
  return `${y}${m}${d}T${h}${min}00`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || typeof token !== "string" || token.length < 32 || token.length > 128) {
      return new Response("Missing or invalid token", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find user by overlay_ics_token and check expiry
    const { data: settings, error: settingsError } = await supabase
      .from("user_planner_settings")
      .select("user_id, overlay_ics_token_expires_at")
      .eq("overlay_ics_token", token)
      .single();

    if (settingsError || !settings) {
      return new Response("Invalid token", { status: 403 });
    }

    // Check token expiry
    if (settings.overlay_ics_token_expires_at) {
      const expiresAt = new Date(settings.overlay_ics_token_expires_at);
      if (expiresAt < new Date()) {
        return new Response("Token expired. Please regenerate your ICS feed URL.", { status: 403 });
      }
    }

    const userId = settings.user_id;

    // Fetch planned blocks (only needed fields)
    const { data: blocks, error: blocksError } = await supabase
      .from("planned_task_blocks")
      .select("id, task_id, date, start_time, duration_minutes")
      .eq("user_id", userId)
      .order("date");

    if (blocksError) throw blocksError;

    // Fetch task titles only (no notes, context_tag, or other sensitive fields)
    const taskIds = [...new Set((blocks ?? []).map(b => b.task_id).filter(Boolean))];
    let tasksMap: Record<string, string> = {};
    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title")
        .in("id", taskIds);
      if (tasks) {
        tasksMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));
      }
    }

    // Generate ICS - only title and time, no sensitive data
    const events = (blocks ?? []).map(block => {
      const title = block.task_id ? (tasksMap[block.task_id] ?? "Task") : "Planned Block";
      const dtStart = formatICSDate(block.date, block.start_time);
      const endTime = addMinutesToTime(block.start_time, block.duration_minutes);
      const dtEnd = formatICSDate(block.date, endTime);

      return [
        "BEGIN:VEVENT",
        `UID:${block.id}@vectorhq`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:📋 ${escapeICS(title)}`,
        `TRANSP:TRANSPARENT`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//VectorHQ//Overlay//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:VectorHQ Task Overlay",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tasks-overlay.ics"',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("ICS generation error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
