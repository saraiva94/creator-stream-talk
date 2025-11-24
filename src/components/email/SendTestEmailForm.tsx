import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type EmailTemplateName } from "@/lib/emailTemplatesService";
import { useTestEmail } from "@/hooks/useTestEmail";

const options: { value: EmailTemplateName; label: string }[] = [
  { value: "welcome", label: "Bem-vindo" },
  { value: "purchaseSuccess", label: "Compra aprovada" },
  { value: "lowBalance", label: "Saldo baixo" },
  { value: "liveEnded", label: "Live encerrada" },
  { value: "streamError", label: "Erro de transmissão" },
  { value: "affiliateInvite", label: "Convite de afiliação" },
];

type Props = {
  onTemplateChange?: (value: EmailTemplateName) => void;
};

const SendTestEmailForm = ({ onTemplateChange }: Props) => {
  const [email, setEmail] = useState("");
  const [template, setTemplate] = useState<EmailTemplateName>("welcome");
  const { sendTestEmail, isSending } = useTestEmail();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    sendTestEmail({ email, template });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email de destino</Label>
        <Input
          id="email"
          type="email"
          placeholder="destinatario@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Template</Label>
        <Select
          value={template}
          onValueChange={(val) => {
            const next = val as EmailTemplateName;
            setTemplate(next);
            onTemplateChange?.(next);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um template" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={isSending} className="w-full">
        {isSending ? "Enviando..." : "Enviar email de teste"}
      </Button>
    </form>
  );
};

export default SendTestEmailForm;
