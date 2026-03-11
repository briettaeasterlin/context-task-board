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

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Token refresh failed:", await res.text());
    return null;
  }

  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get user's planner settings with tokens
    const { data: settings, error: settingsErr } = await adminClient
      .from("user_planner_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (settingsErr || !settings?.gcal_connected) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = settings.gcal_access_token;
    const tokenExpiry = new Date(settings.gcal_token_expires_at);

    // Refresh if expired or about to expire (5 min buffer)
    if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
      if (!settings.gcal_refresh_token) {
        return new Response(JSON.stringify({ error: "No refresh token. Please reconnect Google Calendar." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newTokens = await refreshAccessToken(settings.gcal_refresh_token);
      if (!newTokens) {
        // Mark as disconnected
        await adminClient.from("user_planner_settings").update({
          gcal_connected: false,
        }).eq("user_id", userId);

        return new Response(JSON.stringify({ error: "Token refresh failed. Please reconnect Google Calendar." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      accessToken = newTokens.access_token;
      const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await adminClient.from("user_planner_settings").update({
        gcal_access_token: accessToken,
        gcal_token_expires_at: newExpiry,
      }).eq("user_id", userId);
    }

    // Parse request body for date range
    const body = await req.json().catch(() => ({}));
    const timeMin = body.timeMin || new Date().toISOString();
    const timeMax = body.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch events from Google Calendar
    const calUrl = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`);
    calUrl.searchParams.set("timeMin", timeMin);
    calUrl.searchParams.set("timeMax", timeMax);
    calUrl.searchParams.set("singleEvents", "true");
    calUrl.searchParams.set("orderBy", "startTime");
    calUrl.searchParams.set("maxResults", "250");

    const calRes = await fetch(calUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error("Google Calendar API error:", calRes.status, errText);
      if (calRes.status === 401) {
        await adminClient.from("user_planner_settings").update({ gcal_connected: false }).eq("user_id", userId);
        return new Response(JSON.stringify({ error: "Calendar access revoked. Please reconnect." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to fetch calendar events" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calData = await calRes.json();
    const events = (calData.items || [])
      .filter((e: any) => e.status !== "cancelled")
      .map((e: any) => ({
        id: e.id,
        user_id: userId,
        title: e.summary || "(No title)",
        start_time: e.start?.dateTime || e.start?.date,
        end_time: e.end?.dateTime || e.end?.date,
        is_all_day: !e.start?.dateTime,
        location: e.location || null,
        synced_at: new Date().toISOString(),
      }));

    // Upsert into cache
    if (events.length > 0) {
      // Delete old events for this range first
      await adminClient
        .from("calendar_events_cache")
        .delete()
        .eq("user_id", userId)
        .gte("start_time", timeMin)
        .lte("start_time", timeMax);

      const { error: insertErr } = await adminClient
        .from("calendar_events_cache")
        .upsert(events, { onConflict: "id,user_id" });

      if (insertErr) {
        console.error("Cache upsert error:", insertErr);
      }
    }

    return new Response(JSON.stringify({ events, count: events.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gcal-sync error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
