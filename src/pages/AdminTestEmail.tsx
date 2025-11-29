import { useState } from "react";
import EmailTemplatePreview from "@/components/email/EmailTemplatePreview";
import SendTestEmailForm from "@/components/email/SendTestEmailForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { type EmailTemplateName } from "@/lib/emailTemplatesService";

const AdminTestEmail = () => {
  const [template, setTemplate] = useState<EmailTemplateName>("welcome");

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin · Test Email</h1>
              <p className="text-muted-foreground">Envie um email de teste e visualize os templates disponíveis.</p>
            </div>
          </div>
          <Badge variant="outline">Fonte: Supabase Edge Function send-email</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Configurar envio</CardTitle>
              <CardDescription>Selecione o template e o email de destino</CardDescription>
            </CardHeader>
            <CardContent>
              <SendTestEmailForm onTemplateChange={setTemplate} />
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <EmailTemplatePreview template={template} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminTestEmail;
