/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  userId: string;
  redirectTo: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[password-reset] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, redirectTo }: PasswordResetRequest = await req.json();
    console.log("[password-reset] Payload:", { userId, redirectTo });
    
    if (!userId) {
      console.log("[password-reset] ERROR: userId required");
      return new Response(
        JSON.stringify({ error: "userId é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Buscar o email do usuário pelo ID
    console.log("[password-reset] Fetching user by ID:", userId);
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      console.log("[password-reset] User not found by ID:", userId);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = userData.user.email;
    console.log("[password-reset] User found, sending reset via Supabase Auth");

    // Usar Supabase Auth para enviar email de reset (usa o SMTP configurado no Supabase)
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (resetError) {
      console.error("[password-reset] ERROR:", resetError.message);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar link de recuperação." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Como usamos generateLink com admin, precisamos enviar o email manualmente
    // Vamos usar resetPasswordForEmail que envia o email automaticamente
    const { error: emailError } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: redirectTo,
    });

    if (emailError) {
      console.error("[password-reset] Email error:", emailError.message);
      
      // Se for rate limit, retornar mensagem específica
      if (emailError.message.includes("security purposes") || emailError.message.includes("rate limit")) {
        return new Response(
          JSON.stringify({ error: emailError.message }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email de recuperação." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[password-reset] SUCCESS! Email sent via Supabase Auth to:", userEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Link de recuperação enviado para seu email!" 
      }),
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
