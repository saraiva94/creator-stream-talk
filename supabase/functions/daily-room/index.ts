import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
const DAILY_API_URL = "https://api.daily.co/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, roomName } = await req.json();

    if (action === "create") {
      // Create a new Daily room
      const roomResponse = await fetch(`${DAILY_API_URL}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: roomName || `live-${Date.now()}`,
          privacy: "public",
          properties: {
            enable_chat: false, // We use our own chat
            enable_knocking: false, // No waiting room
            start_video_off: false,
            start_audio_off: false,
            owner_only_broadcast: true, // Only owner can broadcast
            exp: Math.floor(Date.now() / 1000) + 86400, // 24h expiry
          },
        }),
      });

      if (!roomResponse.ok) {
        const errorData = await roomResponse.json();
        console.error("[daily-room] Failed to create room:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to create Daily room", details: errorData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const room = await roomResponse.json();
      console.log("[daily-room] Room created:", room.name);

      // Create owner token for the creator
      const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: room.name,
            is_owner: true,
            user_id: user.id,
            user_name: "Criador",
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
            exp: Math.floor(Date.now() / 1000) + 86400,
          },
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("[daily-room] Failed to create owner token:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to create owner token", details: errorData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();

      return new Response(
        JSON.stringify({
          roomName: room.name,
          roomUrl: room.url,
          ownerToken: tokenData.token,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "viewer-token") {
      // Create viewer token (non-owner, can only watch)
      const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            is_owner: false,
            user_id: user.id,
            user_name: user.email?.split("@")[0] || "Viewer",
            enable_screenshare: false,
            start_video_off: true,
            start_audio_off: true,
            exp: Math.floor(Date.now() / 1000) + 3600, // 1h expiry
          },
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("[daily-room] Failed to create viewer token:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to create viewer token", details: errorData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();

      return new Response(
        JSON.stringify({ viewerToken: tokenData.token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      // Delete the room when stream ends
      const deleteResponse = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${DAILY_API_KEY}`,
        },
      });

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const errorData = await deleteResponse.json();
        console.error("[daily-room] Failed to delete room:", errorData);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[daily-room] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
