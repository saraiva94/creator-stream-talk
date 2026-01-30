/// <reference path="../types.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LoginWithCredentialRequest = {
  credential: string;
  password: string;
};

type ErrorPayload = {
  error: string;
  error_description?: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { credential, password } = (await req.json()) as LoginWithCredentialRequest;

    const normalizedCredential = (credential ?? "").trim();
    const normalizedPassword = password ?? "";

    if (!normalizedCredential || !normalizedPassword) {
      return jsonResponse({ error: "MISSING_FIELDS" } satisfies ErrorPayload, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_PUBLIC_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "SERVER_MISCONFIGURED" } satisfies ErrorPayload, 500);
    }

    let emailToUse = normalizedCredential;

    // If credential is not an email, resolve username -> userId -> email using admin API.
    if (!normalizedCredential.includes("@")) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("username", normalizedCredential)
        .maybeSingle();

      if (!profile?.id) {
        return jsonResponse({ error: "USER_NOT_FOUND" } satisfies ErrorPayload, 404);
      }

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);

      if (userError || !userData?.user?.email) {
        return jsonResponse({ error: "USER_NOT_FOUND" } satisfies ErrorPayload, 404);
      }

      emailToUse = userData.user.email;
    }

    // Exchange email + password for a session (password grant)
    const tokenResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailToUse,
        password: normalizedPassword,
      }),
    });

    const tokenJson = (await tokenResp.json().catch(() => null)) as Record<string, unknown> | null;

    if (!tokenResp.ok) {
      const error = String(tokenJson?.error ?? "LOGIN_FAILED");
      const error_description =
        typeof tokenJson?.error_description === "string"
          ? tokenJson?.error_description
          : typeof tokenJson?.message === "string"
            ? tokenJson?.message
            : undefined;

      // Preserve status from GoTrue when possible.
      return jsonResponse({ error, error_description } satisfies ErrorPayload, tokenResp.status);
    }

    // Pass through required fields for client to set its session.
    return jsonResponse({
      access_token: tokenJson?.access_token,
      refresh_token: tokenJson?.refresh_token,
      expires_in: tokenJson?.expires_in,
      token_type: tokenJson?.token_type,
      user: tokenJson?.user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "INTERNAL_ERROR";
    return jsonResponse({ error: "INTERNAL_ERROR", error_description: message } satisfies ErrorPayload, 500);
  }
});
