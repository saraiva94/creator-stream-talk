import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { getSignupConfirmationUrl } from "@/lib/siteUrl";

export function ResendVerificationButton({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const resend = async () => {
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: getSignupConfirmationUrl() },
      });
      if (error) throw error;
      toast({ title: t.auth.verificationRequested });
    } catch (error) {
      toast({
        title: t.auth.resendVerificationError,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button type="button" variant="outline" className="w-full" onClick={resend} disabled={sending}>
      {sending ? t.common.loading : t.auth.resendVerification}
    </Button>
  );
}
