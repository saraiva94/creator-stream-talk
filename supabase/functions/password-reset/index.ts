/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  userId?: string;
  email?: string;
  redirectTo: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[password-reset] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, redirectTo }: PasswordResetRequest = await req.json();
    console.log("[password-reset] Payload:", { userId, email, redirectTo });
    
    if (!userId && !email) {
      console.log("[password-reset] ERROR: userId or email required");
      return new Response(
        JSON.stringify({ error: "userId ou email é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("[password-reset] Env check:", { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceKey: !!supabaseServiceKey,
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let userEmail = email;

    // Se userId fornecido, buscar o email do usuário
    if (userId && !email) {
      console.log("[password-reset] Fetching user by ID:", userId);
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      
      if (userError || !userData?.user?.email) {
        console.error("[password-reset] ERROR fetching user:", userError?.message);
        return new Response(
          JSON.stringify({ success: true, message: "Se o usuário existir, você receberá um link de recuperação." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      userEmail = userData.user.email;
      console.log("[password-reset] User found:", { userId, email: userEmail });
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: true, message: "Se o usuário existir, você receberá um link de recuperação." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Usar Supabase Auth nativo para enviar email de recuperação
    console.log("[password-reset] Sending reset email via Supabase Auth to:", userEmail);
    
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: redirectTo,
    });

    if (resetError) {
      console.error("[password-reset] ERROR sending reset email:", resetError.message);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email de recuperação. Tente novamente." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[password-reset] SUCCESS! Reset email sent via Supabase Auth to:", userEmail);

    return new Response(
      JSON.stringify({ success: true, message: "Email de recuperação enviado com sucesso!" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("[password-reset] FATAL ERROR:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
