import { ShieldX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";

interface BlockedUserOverlayProps {
  blockedReason?: string | null;
}

export const BlockedUserOverlay = ({ blockedReason }: BlockedUserOverlayProps) => {
  const { t } = useLanguage();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/50 bg-destructive/5">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10 w-fit">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">
            {t.common?.accountBlocked || "Conta Bloqueada"}
          </CardTitle>
          <CardDescription className="text-base">
            {t.common?.accountBlockedDescription || "Sua conta foi suspensa e você não pode acessar a plataforma."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {blockedReason && (
            <div className="p-4 rounded-lg bg-muted border border-border">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t.common?.blockReason || "Motivo do bloqueio:"}
              </p>
              <p className="text-sm">{blockedReason}</p>
            </div>
          )}
          {!blockedReason && (
            <div className="p-4 rounded-lg bg-muted border border-border">
              <p className="text-sm text-muted-foreground">
                {t.common?.noBlockReason || "Nenhum motivo específico foi informado. Entre em contato com o suporte para mais informações."}
              </p>
            </div>
          )}
          <div className="text-center text-sm text-muted-foreground">
            <p>{t.common?.contactSupport || "Se você acredita que isso é um erro, entre em contato com o suporte."}</p>
          </div>
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t.common?.logout || "Sair"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};