import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPWAButton = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast({
        title: "App instalado!",
        description: "O Stream Star foi adicionado à sua tela inicial.",
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Chrome/Edge automatic prompt
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      // Show manual instructions
      setShowInstructions(true);
    }
  };

  // Don't show if already installed
  if (isInstalled) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallClick}
        className="gap-2 border-primary/50 text-primary hover:bg-primary/10 group"
      >
        <div className="relative">
          <Download className="h-4 w-4 animate-bounce group-hover:animate-none" />
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-md animate-ping opacity-50" />
        </div>
        <span className="hidden sm:inline">{t.common.installApp}</span>
      </Button>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Instalar Stream Star
            </DialogTitle>
            <DialogDescription>
              Adicione o Stream Star à sua tela inicial para acesso rápido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {isIOS ? (
              <div className="space-y-3">
                <p className="font-medium">No Safari (iPhone/iPad):</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta)</li>
                  <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                  <li>Toque em <strong>"Adicionar"</strong> no canto superior direito</li>
                </ol>
              </div>
            ) : isAndroid ? (
              <div className="space-y-3">
                <p className="font-medium">No Chrome (Android):</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Toque no menu <strong>⋮</strong> (três pontos) no canto superior</li>
                  <li>Selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar app"</strong></li>
                  <li>Confirme tocando em <strong>"Adicionar"</strong></li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-medium">No navegador:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Clique no ícone de instalação na barra de endereço (se disponível)</li>
                  <li>Ou acesse pelo menu do navegador e procure <strong>"Instalar app"</strong></li>
                  <li>Confirme a instalação</li>
                </ol>
                {!isMobile && (
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Para melhor experiência, acesse este site pelo celular
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
