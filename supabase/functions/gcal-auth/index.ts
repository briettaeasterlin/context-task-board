import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: "Google OAuth credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const redirectUri = `${supabaseUrl}/functions/v1/gcal-auth/callback`;

  try {
    // Step 1: Initiate OAuth - redirect user to Google
    if (path === "authorize") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (error || !data?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the return URL from the request body
      let returnUrl = "";
      try {
        const body = await req.json();
        returnUrl = body.returnUrl || "";
      } catch { /* no body */ }

      const userId = data.claims.sub;
      // Encode user ID and returnUrl in state for the callback
      const state = btoa(JSON.stringify({ userId, returnUrl }));

      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: OAuth callback - exchange code for tokens
    if (path === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(
          `<html><body><h2>Authorization failed</h2><p>${error}</p><script>window.close();</script></body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }

      if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
      }

      let userId: string;
      let returnUrl = "";
      try {
        const parsed = JSON.parse(atob(state));
        userId = parsed.userId;
        returnUrl = parsed.returnUrl || "";
      } catch {
        return new Response("Invalid state", { status: 400 });
      }

      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Token exchange failed:", tokens);
        return new Response(
          `<html><body><h2>Token exchange failed</h2><pre>${JSON.stringify(tokens)}</pre><script>setTimeout(() => window.close(), 3000);</script></body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }

      // Store tokens in user_planner_settings using service role
      const supabase = createClient(supabaseUrl, serviceKey);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const { error: upsertError } = await supabase.from("user_planner_settings").upsert({
        user_id: userId,
        gcal_connected: true,
        gcal_access_token: tokens.access_token,
        gcal_refresh_token: tokens.refresh_token ?? null,
        gcal_token_expires_at: expiresAt,
      }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to save tokens:", upsertError);
        return new Response(
          `<html><body><h2>Failed to save credentials</h2><script>setTimeout(() => window.close(), 3000);</script></body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }

      // Redirect back to the app if returnUrl is provided
      if (returnUrl) {
        return new Response(null, {
          status: 302,
          headers: { Location: returnUrl },
        });
      }

      return new Response(
        `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column">
          <h2 style="color:#2a9d8f">✓ Google Calendar Connected!</h2>
          <p>You can close this window and return to Task OS.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    // Step 3: Disconnect
    if (path === "disconnect") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (claimsErr || !data?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(supabaseUrl, serviceKey);
      await adminClient.from("user_planner_settings").update({
        gcal_connected: false,
        gcal_access_token: null,
        gcal_refresh_token: null,
        gcal_token_expires_at: null,
      }).eq("user_id", data.claims.sub);

      // Clear cached events
      await adminClient.from("calendar_events_cache").delete().eq("user_id", data.claims.sub);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error("gcal-auth error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
