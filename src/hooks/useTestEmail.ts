import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { sendTestEmail, type EmailTemplateName } from "@/lib/emailTemplatesService";

export const useTestEmail = () => {
  const mutation = useMutation({
    mutationFn: ({ email, template }: { email: string; template: EmailTemplateName }) =>
      sendTestEmail(email, template),
    onSuccess: () => {
      toast({
        title: "Email enviado",
        description: "Email de teste enviado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar email",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  return {
    sendTestEmail: mutation.mutate,
    isSending: mutation.isPending,
  };
};
