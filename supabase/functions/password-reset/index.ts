/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Resend HTTP API wrapper (não precisa de SDK)
const sendEmailViaResend = async (apiKey: string, options: {
  from: string;
  to: string[];
  subject: string;
  html: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const data = await response.json();
  
  if (!response.ok) {
    return { data: null, error: data };
  }
  
  return { data, error: null };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  userId?: string;
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
      console.log("[password-reset] ERROR: userId missing");
      return new Response(
        JSON.stringify({ error: "userId é obrigatório" }),
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

    if (!resendApiKey) {
      console.error("[password-reset] ERROR: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de email não configurado" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Buscar usuário pelo ID
    console.log("[password-reset] Fetching user by ID:", userId);
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error("[password-reset] ERROR fetching user:", userError.message);
      return new Response(
        JSON.stringify({ success: true, message: "Se o usuário existir, você receberá um link de recuperação." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!userData?.user?.email) {
      console.error("[password-reset] ERROR: User has no email");
      return new Response(
        JSON.stringify({ success: true, message: "Se o usuário existir, você receberá um link de recuperação." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = userData.user.email;
    console.log("[password-reset] User found:", { userId, email: userEmail });

    // Gerar link de reset
    console.log("[password-reset] Generating reset link...");
    const { data: linkData, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (resetError || !linkData?.properties?.action_link) {
      console.error("[password-reset] ERROR generating link:", resetError?.message);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resetLink = linkData.properties.action_link;
    console.log("[password-reset] Link generated successfully");

    // Enviar email via Resend
    console.log("[password-reset] Sending email via Resend to:", userEmail);
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7B3FF3, #9A5CFF); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #7B3FF3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin-top: 20px; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔐 Redefinir Senha</h1>
        </div>
        <div class="content">
          <p>Olá!</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Stream Live Hub</strong>.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Redefinir minha senha</a>
          </p>
          <div class="warning">
            ⚠️ <strong>Importante:</strong> Este link é válido por 1 hora. Se você não solicitou esta alteração, ignore este email.
          </div>
        </div>
        <div class="footer">
          <p>Stream Live Hub © ${new Date().getFullYear()}</p>
          <p>Se o botão não funcionar, copie e cole este link no navegador:<br>
          <a href="${resetLink}" style="color: #7B3FF3; word-break: break-all;">${resetLink}</a></p>
        </div>
      </body>
      </html>
    `;
    
    const { data: emailData, error: emailError } = await sendEmailViaResend(resendApiKey, {
      from: "Stream Live Hub <onboarding@resend.dev>",
      to: [userEmail],
      subject: "Redefinir sua senha - Stream Live Hub",
      html: emailHtml,
    });

    if (emailError) {
      console.error("[password-reset] ERROR sending email:", JSON.stringify(emailError));
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email. Verifique se o domínio está validado no Resend." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[password-reset] SUCCESS! Email sent:", { emailId: emailData?.id, to: userEmail });

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
