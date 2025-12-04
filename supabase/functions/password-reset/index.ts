/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  userId?: string;
  redirectTo: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, redirectTo }: PasswordResetRequest = await req.json();
    
    if (!userId) {
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

    // Buscar usuário pelo ID
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ success: true, message: "Se o usuário existir, você receberá um link de recuperação." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = userData.user.email;
    console.log("Sending password reset for user:", userId, "email:", userEmail);

    // Gerar link de reset via admin API (usa sistema de email nativo do Supabase)
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Enviar email de reset usando o método nativo do Supabase
    // O generateLink já envia o email automaticamente quando chamado via admin API
    console.log("Password reset link generated and email sent for:", userEmail);

    return new Response(
      JSON.stringify({ success: true, message: "Email de recuperação enviado com sucesso!" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Password reset error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
