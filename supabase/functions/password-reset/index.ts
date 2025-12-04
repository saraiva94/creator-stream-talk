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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    console.log("[password-reset] Env check:", { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceKey: !!supabaseServiceKey,
      hasResendKey: !!resendApiKey,
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

    // Gerar link de recuperação via Supabase Admin API
    console.log("[password-reset] Generating recovery link for:", userEmail);
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[password-reset] ERROR generating link:", linkError?.message);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação. Tente novamente." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recoveryLink = linkData.properties.action_link;
    console.log("[password-reset] Recovery link generated successfully");

    // Enviar email via Resend
    if (!resendApiKey) {
      console.error("[password-reset] ERROR: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de email não configurado." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[password-reset] Sending email via Resend to:", userEmail);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Stream Live Hub <onboarding@resend.dev>",
        to: [userEmail],
        subject: "Redefinição de Senha - Stream Live Hub",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 40px 20px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(123, 63, 243, 0.3);">
              <h1 style="color: #9A5CFF; text-align: center; margin-bottom: 30px; font-size: 28px;">
                🔐 Redefinição de Senha
              </h1>
              
              <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Olá! Recebemos uma solicitação para redefinir sua senha na <strong style="color: #9A5CFF;">Stream Live Hub</strong>.
              </p>
              
              <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Clique no botão abaixo para criar uma nova senha:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${recoveryLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #7B3FF3 0%, #9A5CFF 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(123, 63, 243, 0.4);">
                  Redefinir Senha
                </a>
              </div>
              
              <p style="color: #888; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá a mesma.
              </p>
              
              <p style="color: #888; font-size: 14px; line-height: 1.6;">
                Este link expira em 24 horas.
              </p>
              
              <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
              
              <p style="color: #666; font-size: 12px; text-align: center;">
                Stream Live Hub - Sua plataforma de streaming ao vivo
              </p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const resendResult = await resendResponse.json();
    console.log("[password-reset] Resend response:", JSON.stringify(resendResult));

    if (!resendResponse.ok) {
      console.error("[password-reset] Resend error:", resendResult);
      return new Response(
        JSON.stringify({ error: `Erro ao enviar email: ${resendResult.message || 'Falha no envio'}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[password-reset] SUCCESS! Email sent via Resend to:", userEmail);

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
