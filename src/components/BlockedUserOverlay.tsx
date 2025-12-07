import { Ban } from "lucide-react";

export const BlockedUserOverlay = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/20 flex items-center justify-center">
          <Ban className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-destructive mb-4">
          Conta Bloqueada
        </h1>
        <p className="text-muted-foreground mb-6">
          Sua conta foi bloqueada. Entre em contato com o suporte para mais informações.
        </p>
        <p className="text-sm text-muted-foreground">
          Contato: suporte@streamstar.com
        </p>
      </div>
    </div>
  );
};
