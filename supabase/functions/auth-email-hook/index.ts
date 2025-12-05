import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

// Stream Star brand colors
const brandColors = {
  primary: "#7B3FF3",
  primaryLight: "#9A5CFF",
  background: "#0a0a0a",
  text: "#ffffff",
  textMuted: "#a1a1aa",
  border: "#27272a",
};

// Base email template wrapper
const emailWrapper = (content: string, previewText: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stream Star</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${brandColors.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${brandColors.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #18181b; border-radius: 16px; border: 1px solid ${brandColors.border};">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.primaryLight}); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 24px;">⭐</span>
                </div>
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.primaryLight}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Stream Star</h1>
              </div>
            </td>
          </tr>
          <!-- Content -->
          ${content}
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <hr style="border: none; border-top: 1px solid ${brandColors.border}; margin: 0 0 20px;">
              <p style="margin: 0; font-size: 12px; color: ${brandColors.textMuted}; text-align: center; line-height: 1.6;">
                Este email foi enviado automaticamente pelo Stream Star.<br>
                Se você não solicitou esta ação, pode ignorar este email com segurança.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Button component
const emailButton = (href: string, text: string) => `
<a href="${href}" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.primaryLight}); color: ${brandColors.text}; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(123, 63, 243, 0.4);">
  ${text}
</a>
`;

// Recovery password email template
const recoveryEmailTemplate = (
  confirmationUrl: string,
  token: string
) => emailWrapper(`
<tr>
  <td style="padding: 20px 40px;">
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${brandColors.text}; text-align: center;">
      Recuperação de Senha
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${brandColors.textMuted}; text-align: center; line-height: 1.6;">
      Você solicitou a recuperação da sua senha no Stream Star. Clique no botão abaixo para criar uma nova senha.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      ${emailButton(confirmationUrl, "Redefinir Senha")}
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: ${brandColors.textMuted}; text-align: center;">
      Ou use este código de verificação:
    </p>
    <div style="background-color: ${brandColors.background}; border: 1px solid ${brandColors.border}; border-radius: 8px; padding: 16px; text-align: center;">
      <code style="font-size: 24px; font-weight: 700; color: ${brandColors.primary}; letter-spacing: 4px;">${token}</code>
    </div>
    <p style="margin: 16px 0 0; font-size: 13px; color: ${brandColors.textMuted}; text-align: center;">
      Este link expira em 1 hora.
    </p>
  </td>
</tr>
`, "Recupere sua senha no Stream Star");

// Signup confirmation email template
const signupEmailTemplate = (
  confirmationUrl: string,
  token: string
) => emailWrapper(`
<tr>
  <td style="padding: 20px 40px;">
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${brandColors.text}; text-align: center;">
      Bem-vindo ao Stream Star! 🎉
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${brandColors.textMuted}; text-align: center; line-height: 1.6;">
      Estamos muito felizes em ter você conosco! Confirme seu email para começar a explorar o melhor do streaming ao vivo.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      ${emailButton(confirmationUrl, "Confirmar Email")}
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: ${brandColors.textMuted}; text-align: center;">
      Ou use este código de verificação:
    </p>
    <div style="background-color: ${brandColors.background}; border: 1px solid ${brandColors.border}; border-radius: 8px; padding: 16px; text-align: center;">
      <code style="font-size: 24px; font-weight: 700; color: ${brandColors.primary}; letter-spacing: 4px;">${token}</code>
    </div>
  </td>
</tr>
`, "Confirme seu email no Stream Star");

// Magic link email template
const magicLinkEmailTemplate = (
  confirmationUrl: string,
  token: string
) => emailWrapper(`
<tr>
  <td style="padding: 20px 40px;">
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${brandColors.text}; text-align: center;">
      Login Seguro
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${brandColors.textMuted}; text-align: center; line-height: 1.6;">
      Clique no botão abaixo para fazer login de forma segura no Stream Star.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      ${emailButton(confirmationUrl, "Entrar no Stream Star")}
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: ${brandColors.textMuted}; text-align: center;">
      Ou use este código de verificação:
    </p>
    <div style="background-color: ${brandColors.background}; border: 1px solid ${brandColors.border}; border-radius: 8px; padding: 16px; text-align: center;">
      <code style="font-size: 24px; font-weight: 700; color: ${brandColors.primary}; letter-spacing: 4px;">${token}</code>
    </div>
    <p style="margin: 16px 0 0; font-size: 13px; color: ${brandColors.textMuted}; text-align: center;">
      Este link expira em 1 hora.
    </p>
  </td>
</tr>
`, "Acesse sua conta no Stream Star");

// Email change confirmation template
const emailChangeEmailTemplate = (
  confirmationUrl: string,
  token: string
) => emailWrapper(`
<tr>
  <td style="padding: 20px 40px;">
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${brandColors.text}; text-align: center;">
      Confirmação de Novo Email
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${brandColors.textMuted}; text-align: center; line-height: 1.6;">
      Você solicitou a alteração do seu email no Stream Star. Clique no botão abaixo para confirmar seu novo endereço.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      ${emailButton(confirmationUrl, "Confirmar Novo Email")}
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: ${brandColors.textMuted}; text-align: center;">
      Ou use este código de verificação:
    </p>
    <div style="background-color: ${brandColors.background}; border: 1px solid ${brandColors.border}; border-radius: 8px; padding: 16px; text-align: center;">
      <code style="font-size: 24px; font-weight: 700; color: ${brandColors.primary}; letter-spacing: 4px;">${token}</code>
    </div>
  </td>
</tr>
`, "Confirme seu novo email no Stream Star");

// Invite email template
const inviteEmailTemplate = (
  confirmationUrl: string,
  token: string
) => emailWrapper(`
<tr>
  <td style="padding: 20px 40px;">
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${brandColors.text}; text-align: center;">
      Você foi Convidado! 🌟
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${brandColors.textMuted}; text-align: center; line-height: 1.6;">
      Alguém especial convidou você para fazer parte do Stream Star, a melhor plataforma de streaming ao vivo!
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      ${emailButton(confirmationUrl, "Aceitar Convite")}
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: ${brandColors.textMuted}; text-align: center;">
      Ou use este código de verificação:
    </p>
    <div style="background-color: ${brandColors.background}; border: 1px solid ${brandColors.border}; border-radius: 8px; padding: 16px; text-align: center;">
      <code style="font-size: 24px; font-weight: 700; color: ${brandColors.primary}; letter-spacing: 4px;">${token}</code>
    </div>
  </td>
</tr>
`, "Você foi convidado para o Stream Star!");

// Reauthentication email template
const reauthEmailTemplate = (
  confirmationUrl: string,
  token: string
) => emailWrapper(`
<tr>
  <td style="padding: 20px 40px;">
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${brandColors.text}; text-align: center;">
      Verificação de Segurança
    </h2>
    <p style="margin: 0 0 24px; font-size: 16px; color: ${brandColors.textMuted}; text-align: center; line-height: 1.6;">
      Para sua segurança, precisamos verificar sua identidade. Clique no botão abaixo para continuar.
    </p>
    <div style="text-align: center; margin-bottom: 24px;">
      ${emailButton(confirmationUrl, "Verificar Identidade")}
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: ${brandColors.textMuted}; text-align: center;">
      Ou use este código de verificação:
    </p>
    <div style="background-color: ${brandColors.background}; border: 1px solid ${brandColors.border}; border-radius: 8px; padding: 16px; text-align: center;">
      <code style="font-size: 24px; font-weight: 700; color: ${brandColors.primary}; letter-spacing: 4px;">${token}</code>
    </div>
  </td>
</tr>
`, "Verificação de segurança no Stream Star");

// Get email subject based on type
const getEmailSubject = (emailType: string): string => {
  switch (emailType) {
    case "recovery":
      return "🔐 Recupere sua senha - Stream Star";
    case "signup":
      return "🎉 Bem-vindo ao Stream Star! Confirme seu email";
    case "magiclink":
      return "🔗 Seu link de acesso - Stream Star";
    case "email_change":
      return "📧 Confirme seu novo email - Stream Star";
    case "invite":
      return "🌟 Você foi convidado para o Stream Star!";
    case "reauthentication":
      return "🔒 Verificação de segurança - Stream Star";
    default:
      return "Stream Star - Notificação";
  }
};

// Get email HTML based on type
const getEmailHtml = (
  emailType: string,
  confirmationUrl: string,
  token: string
): string => {
  switch (emailType) {
    case "recovery":
      return recoveryEmailTemplate(confirmationUrl, token);
    case "signup":
      return signupEmailTemplate(confirmationUrl, token);
    case "magiclink":
      return magicLinkEmailTemplate(confirmationUrl, token);
    case "email_change":
      return emailChangeEmailTemplate(confirmationUrl, token);
    case "invite":
      return inviteEmailTemplate(confirmationUrl, token);
    case "reauthentication":
      return reauthEmailTemplate(confirmationUrl, token);
    default:
      return magicLinkEmailTemplate(confirmationUrl, token);
  }
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  console.log("[AUTH-EMAIL-HOOK] Received webhook request");

  const wh = new Webhook(hookSecret);

  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    console.log(`[AUTH-EMAIL-HOOK] Processing ${email_action_type} email for ${user.email}`);
    console.log(`[AUTH-EMAIL-HOOK] Original redirect_to: ${redirect_to}`);

    // Build confirmation URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    
    // Determine the correct redirect URL based on action type
    // Use the production site URL
    const siteUrl = "https://creator-stream-talk.vercel.app";
    let finalRedirectTo = redirect_to;
    
    // If redirect_to is empty or invalid, use defaults based on action type
    if (!redirect_to || redirect_to === "" || redirect_to === "undefined") {
      switch (email_action_type) {
        case "recovery":
          finalRedirectTo = `${siteUrl}/reset-password`;
          break;
        case "signup":
        case "email_change":
          finalRedirectTo = `${siteUrl}/`;
          break;
        default:
          finalRedirectTo = `${siteUrl}/`;
      }
    }
    
    console.log(`[AUTH-EMAIL-HOOK] Final redirect_to: ${finalRedirectTo}`);
    
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(finalRedirectTo)}`;

    const subject = getEmailSubject(email_action_type);
    const html = getEmailHtml(email_action_type, confirmationUrl, token);

    const { error } = await resend.emails.send({
      from: "Stream Star <noreply@resend.dev>",
      to: [user.email],
      subject,
      html,
    });

    if (error) {
      console.error("[AUTH-EMAIL-HOOK] Failed to send email:", error);
      throw error;
    }

    console.log(`[AUTH-EMAIL-HOOK] Successfully sent ${email_action_type} email to ${user.email}`);

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[AUTH-EMAIL-HOOK] Error:", error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
