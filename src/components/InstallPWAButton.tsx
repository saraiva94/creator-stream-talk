import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [isMounted, setIsMounted] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const android = /Android/.test(navigator.userAgent);
    setIsIOS(ios);
    setIsAndroid(android);
    setIsMobile(ios || android);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Do NOT call preventDefault() to avoid noisy console warnings when user never clicks install.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast({ title: t.pwa.appInstalled, description: t.pwa.addedToHome });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [toast, t]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  };

  if (!isMounted || isInstalled) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleInstallClick} className="gap-2 border-primary/50 text-primary hover:bg-primary/10 group">
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
              {t.pwa.installTitle}
            </DialogTitle>
            <DialogDescription>{t.pwa.installDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {isIOS ? (
              <div className="space-y-3">
                <p className="font-medium">{t.pwa.safariTitle}</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>{t.pwa.safariStep1}</li>
                  <li>{t.pwa.safariStep2}</li>
                  <li>{t.pwa.safariStep3}</li>
                </ol>
              </div>
            ) : isAndroid ? (
              <div className="space-y-3">
                <p className="font-medium">{t.pwa.androidTitle}</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>{t.pwa.androidStep1}</li>
                  <li>{t.pwa.androidStep2}</li>
                  <li>{t.pwa.androidStep3}</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-medium">{t.pwa.browserTitle}</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>{t.pwa.browserStep1}</li>
                  <li>{t.pwa.browserStep2}</li>
                  <li>{t.pwa.browserStep3}</li>
                </ol>
                {!isMobile && <p className="text-xs text-muted-foreground mt-2">💡 {t.pwa.browserTip}</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
