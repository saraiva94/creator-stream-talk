import { Ban } from "lucide-react";

interface BlockedUserOverlayProps {
  reason?: string | null;
}

export const BlockedUserOverlay = ({ reason }: BlockedUserOverlayProps) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/20 flex items-center justify-center">
          <Ban className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-destructive mb-4">
          Conta Bloqueada
        </h1>
        <p className="text-muted-foreground mb-4">
          Sua conta foi bloqueada e você não pode mais acessar a plataforma.
        </p>
        {reason && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-medium text-muted-foreground mb-1">Motivo:</p>
            <p className="text-foreground">{reason}</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Entre em contato com o suporte para mais informações.
        </p>
      </div>
    </div>
  );
};
