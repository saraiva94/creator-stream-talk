/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "resend";

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

    if (!resendApiKey) {
      console.error("[password-reset] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de email não configurado." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const resend = new Resend(resendApiKey);

    let userEmail = email;
    let userExists = false;

    // Se userId fornecido, buscar o email do usuário
    if (userId && !email) {
      console.log("[password-reset] Fetching user by ID:", userId);
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      
      if (userError || !userData?.user?.email) {
        console.log("[password-reset] User not found by ID:", userId);
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado." }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      userEmail = userData.user.email;
      userExists = true;
      console.log("[password-reset] User found by ID:", { userId, email: userEmail });
    }

    // Se email fornecido, validar que existe no auth.users
    if (email && !userExists) {
      console.log("[password-reset] Validating email exists:", email);
      
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error("[password-reset] Error listing users:", userError.message);
        return new Response(
          JSON.stringify({ error: "Erro ao validar email." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      const foundUser = userData?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
      );
      
      if (!foundUser) {
        console.log("[password-reset] Email not found in auth.users:", email);
        return new Response(
          JSON.stringify({ error: "E-mail não cadastrado. Verifique o endereço informado." }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      userExists = true;
      console.log("[password-reset] Email validated, user exists:", email);
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "Email não encontrado." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
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

    if (linkError) {
      console.error("[password-reset] ERROR generating link:", linkError.message);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    
    if (!actionLink) {
      console.error("[password-reset] No action link generated");
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[password-reset] Action link generated, sending email via Resend");

    // Enviar email via Resend (usando domínio padrão do Resend até verificar domínio próprio)
    const emailResult = await resend.emails.send({
      from: "StreamStar <onboarding@resend.dev>",
      to: [userEmail],
      subject: "Redefinição de Senha - StreamStar",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redefinição de Senha</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%); border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #0a0a0a; font-size: 28px; font-weight: bold; letter-spacing: 1px;">
                ⭐ StreamStar
              </h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 24px;">
                Redefinição de Senha
              </h2>
              
              <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                Você solicitou a redefinição de senha da sua conta StreamStar. Clique no botão abaixo para criar uma nova senha:
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${actionLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%); color: #0a0a0a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);">
                  Redefinir Minha Senha
                </a>
              </div>
              
              <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                Se você não solicitou esta redefinição, pode ignorar este email com segurança. Sua senha permanecerá inalterada.
              </p>
              
              <p style="color: #666666; font-size: 13px; margin: 20px 0 0 0;">
                ⏱️ Este link expira em 1 hora.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #0d0d0d; padding: 25px 30px; border-top: 1px solid #2a2a2a;">
              <p style="color: #666666; font-size: 12px; margin: 0; text-align: center;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${actionLink}" style="color: #d4af37; word-break: break-all;">${actionLink}</a>
              </p>
              <p style="color: #444444; font-size: 11px; margin: 15px 0 0 0; text-align: center;">
                © ${new Date().getFullYear()} StreamStar. Todos os direitos reservados.
              </p>
            </div>
            
          </div>
        </body>
        </html>
      `,
    });

    if (emailResult.error) {
      console.error("[password-reset] Resend error:", emailResult.error);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email de recuperação." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[password-reset] SUCCESS! Email sent via Resend to:", userEmail, "ID:", emailResult.data?.id);

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
