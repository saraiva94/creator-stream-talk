import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pwa-install-prompt-shown";

export function usePWAInstallPrompt() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    // Check if already shown
    const alreadyShown = localStorage.getItem(STORAGE_KEY);
    if (alreadyShown) return;

    // Check if on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    
    if (!isMobile) return;

    // Check if already installed as PWA
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Show notification after a short delay
    const timer = setTimeout(() => {
      showInstallNotification();
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const showInstallNotification = () => {
    // Mark as shown
    localStorage.setItem(STORAGE_KEY, "true");

    toast({
      duration: 10000,
      className: "bg-gradient-to-r from-primary/90 to-secondary/90 border-primary text-primary-foreground",
      title: (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Download className="h-5 w-5 animate-bounce" />
            <div className="absolute inset-0 bg-primary-foreground/30 rounded-full blur-md animate-ping opacity-50" />
          </div>
          <span className="font-bold">Instale o App!</span>
        </div>
      ) as unknown as string,
      description: (
        <div className="space-y-2">
          <p className="text-sm text-primary-foreground/90">
            Adicione Stream Star à sua tela inicial para uma experiência mais rápida e acesso offline.
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-1.5"
              onClick={() => {
                // Trigger install if available
                if (deferredPrompt && "prompt" in deferredPrompt) {
                  (deferredPrompt as BeforeInstallPromptEvent).prompt();
                } else {
                  // Show instructions for iOS
                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                  if (isIOS) {
                    alert(
                      "Para instalar:\n1. Toque no botão Compartilhar (ícone de quadrado com seta)\n2. Role e toque em 'Adicionar à Tela de Início'"
                    );
                  } else {
                    alert(
                      "Para instalar:\n1. Toque no menu do navegador (3 pontos)\n2. Selecione 'Instalar aplicativo' ou 'Adicionar à tela inicial'"
                    );
                  }
                }
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Instalar
            </Button>
          </div>
        </div>
      ) as unknown as string,
    });
  };

  return { deferredPrompt };
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
