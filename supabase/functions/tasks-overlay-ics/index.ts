import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find user by overlay_ics_token
    const { data: settings, error: settingsError } = await supabase
      .from("user_planner_settings")
      .select("user_id")
      .eq("overlay_ics_token", token)
      .single();

    if (settingsError || !settings) {
      return new Response("Invalid token", { status: 403 });
    }

    const userId = settings.user_id;

    // Fetch planned blocks with task titles
    const { data: blocks, error: blocksError } = await supabase
      .from("planned_task_blocks")
      .select("*")
      .eq("user_id", userId)
      .order("date");

    if (blocksError) throw blocksError;

    // Fetch tasks for titles
    const taskIds = [...new Set((blocks ?? []).map(b => b.task_id).filter(Boolean))];
    let tasksMap: Record<string, string> = {};
    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, context_tag")
        .in("id", taskIds);
      if (tasks) {
        tasksMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));
      }
    }

    // Generate ICS
    const events = (blocks ?? []).map(block => {
      const title = block.task_id ? (tasksMap[block.task_id] ?? "Task") : "Planned Block";
      const dtStart = formatICSDate(block.date, block.start_time);
      const endTime = addMinutesToTime(block.start_time, block.duration_minutes);
      const dtEnd = formatICSDate(block.date, endTime);

      return [
        "BEGIN:VEVENT",
        `UID:${block.id}@taskos`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:📋 ${escapeICS(title)}`,
        `DESCRIPTION:Task overlay — does not block availability`,
        `TRANSP:TRANSPARENT`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TaskOS//Overlay//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Task OS Overlay",
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
