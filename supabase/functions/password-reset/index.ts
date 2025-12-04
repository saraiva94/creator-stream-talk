/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email?: string;
  userId?: string;
  redirectTo: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId, redirectTo }: PasswordResetRequest = await req.json();
    
    if (!email && !userId) {
      return new Response(
        JSON.stringify({ error: "Email ou userId é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
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

    // Check if user exists
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar usuário" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find user by email or userId
    let user;
    if (userId) {
      user = userData.users.find(u => u.id === userId);
    } else if (email) {
      user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    }
    
    if (!user || !user.email) {
      // Don't reveal if user exists or not for security
      console.log("User not found for:", email || userId);
      return new Response(
        JSON.stringify({ success: true, message: "Se o usuário existir, você receberá um link de recuperação." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const userEmail = user.email;

    // Generate password reset link using admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (linkError || !linkData) {
      console.error("Error generating reset link:", linkError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // The generated link contains the token
    const resetLink = linkData.properties?.action_link;
    
    if (!resetLink) {
      console.error("No action_link in response:", linkData);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Reset link generated successfully for:", email);

    // Send email via Resend
    const resend = new Resend(resendApiKey);
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Redefinir Senha - Stream Star</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a2e; border-radius: 12px; padding: 40px; border: 1px solid #7B3FF3;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #7B3FF3; font-size: 28px; margin: 0;">Stream Star</h1>
            </div>
            
            <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 20px;">Redefinir sua senha</h2>
            
            <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Recebemos uma solicitação para redefinir a senha da sua conta. 
              Clique no botão abaixo para criar uma nova senha.
            </p>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #7B3FF3 0%, #9A5CFF 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Redefinir Senha
              </a>
            </div>
            
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
            </p>
            
            <p style="color: #7B3FF3; font-size: 12px; word-break: break-all; background-color: #0a0a0a; padding: 12px; border-radius: 6px; margin-bottom: 30px;">
              ${resetLink}
            </p>
            
            <p style="color: #666666; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
              Se você não solicitou a redefinição de senha, ignore este email.<br>
              Este link expira em 24 horas.
            </p>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "Stream Star <onboarding@resend.dev>",
      to: [userEmail],
      subject: "Redefinir sua senha - Stream Star",
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email via Resend:", emailError);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Password reset email sent successfully to:", userEmail);

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
