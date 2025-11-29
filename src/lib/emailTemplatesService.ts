import { supabase } from "@/integrations/supabase/client";

export type EmailTemplateName =
  | "welcome"
  | "purchaseSuccess"
  | "lowBalance"
  | "liveEnded"
  | "streamError"
  | "affiliateInvite";

const templateSubject: Record<EmailTemplateName, string> = {
  welcome: "Bem-vindo ao Creator Stream Talk",
  purchaseSuccess: "Pagamento confirmado",
  lowBalance: "Seu saldo está baixo",
  liveEnded: "Live encerrada",
  streamError: "Erro na transmissão",
  affiliateInvite: "Convite para afiliação",
};

export const sendTestEmail = async (recipientEmail: string, template: EmailTemplateName) => {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      to: recipientEmail,
      subject: templateSubject[template] ?? "Email de teste",
      html: `<p>Pré-visualização do template: <strong>${template}</strong></p>`,
      type: template,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
