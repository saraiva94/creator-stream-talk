import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Copy, Check, MessageCircle, Instagram, Twitter, Share } from "lucide-react";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  link: string;
  title?: string;
}

// TikTok icon
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Messenger icon
const MessengerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.98-.87c.17-.08.36-.1.55-.06.91.25 1.88.38 2.89.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm6 7.68l-2.93 4.65c-.47.74-1.44.93-2.13.41l-2.34-1.75c-.18-.13-.42-.13-.6 0l-3.15 2.39c-.42.32-.97-.18-.68-.62l2.93-4.65c.47-.74 1.44-.93 2.13-.41l2.34 1.75c.18.13.42.13.6 0l3.15-2.39c.42-.32.97.18.68.62z"/>
  </svg>
);

export const ShareDialog = ({ isOpen, onClose, link, title }: ShareDialogProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: t.share?.linkCopied || "Copiado!",
        description: t.share?.linkCopied || "Link copiado para a área de transferência",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: t.share?.copyError || "Erro ao copiar",
        description: "Por favor, copie o link manualmente",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    
    try {
      await navigator.share({
        title: title || "StreamStar",
        text: title || "Cadastre-se na StreamStar",
        url: link,
      });
    } catch (error) {
      // User cancelled or share failed - ignore AbortError
      if ((error as Error).name !== 'AbortError') {
        console.error("Share failed:", error);
      }
    }
  };

  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const openAppWithFallback = (appScheme: string, fallbackUrl: string) => {
    if (isMobile()) {
      const start = Date.now();
      window.location.href = appScheme;
      
      // If app doesn't open within 1.5s, open fallback
      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.open(fallbackUrl, "_blank");
        }
      }, 1500);
    } else {
      window.open(fallbackUrl, "_blank");
    }
  };

  const shareToWhatsApp = async () => {
    await copyToClipboard();
    const text = encodeURIComponent(title ? `${title}: ${link}` : link);
    
    if (isMobile()) {
      // Use whatsapp:// scheme for mobile apps
      openAppWithFallback(
        `whatsapp://send?text=${text}`,
        `https://api.whatsapp.com/send?text=${text}`
      );
    } else {
      window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    }
  };

  const shareToMessenger = async () => {
    await copyToClipboard();
    const encodedLink = encodeURIComponent(link);
    
    if (isMobile()) {
      // Use fb-messenger:// scheme for mobile
      openAppWithFallback(
        `fb-messenger://share?link=${encodedLink}`,
        `https://m.me/?link=${encodedLink}`
      );
    } else {
      window.open(`https://www.facebook.com/dialog/send?link=${encodedLink}&app_id=966242223397117&redirect_uri=${encodeURIComponent(window.location.href)}`, "_blank");
    }
  };

  const shareToTikTok = async () => {
    await copyToClipboard();
    
      toast({
        title: t.share?.linkCopied || "Copiado!",
        description: t.share?.tiktokDesc || "Cole o link em sua bio ou vídeo do TikTok",
      });
    
    if (isMobile()) {
      // TikTok app schemes
      const tiktokScheme = isAndroid() ? "snssdk1233://" : "tiktok://";
      openAppWithFallback(tiktokScheme, "https://www.tiktok.com");
    } else {
      window.open("https://www.tiktok.com", "_blank");
    }
  };

  const shareToInstagram = async () => {
    await copyToClipboard();
    
      toast({
        title: t.share?.linkCopied || "Copiado!",
        description: t.share?.instagramDesc || "Cole o link em sua bio ou story do Instagram",
      });
    
    if (isMobile()) {
      // Instagram app scheme
      openAppWithFallback("instagram://app", "https://www.instagram.com");
    } else {
      window.open("https://www.instagram.com", "_blank");
    }
  };

  const shareToTwitter = async () => {
    await copyToClipboard();
    const text = encodeURIComponent(title ? `${title}: ${link}` : link);
    
    if (isMobile()) {
      // Twitter/X app scheme
      openAppWithFallback(
        `twitter://post?message=${text}`,
        `https://twitter.com/intent/tweet?text=${text}`
      );
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t.share?.title || "Compartilhar"}
          </DialogTitle>
          <DialogDescription>
            {t.share?.shareLink || "Compartilhe seu link de convite"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Social Media Buttons - Row with 5 buttons */}
          <div className="grid grid-cols-5 gap-2 sm:gap-4">
            {/* WhatsApp */}
            <button
              onClick={shareToWhatsApp}
              className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#25D366] flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">WhatsApp</span>
            </button>

            {/* Messenger */}
            <button
              onClick={shareToMessenger}
              className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{
                  background: "linear-gradient(45deg, #0078FF, #00C6FF)"
                }}
              >
                <MessengerIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Messenger</span>
            </button>

            {/* Instagram */}
            <button
              onClick={shareToInstagram}
              className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{
                  background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"
                }}
              >
                <Instagram className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Instagram</span>
            </button>

            {/* TikTok */}
            <button
              onClick={shareToTikTok}
              className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black flex items-center justify-center group-hover:scale-110 transition-transform border border-border">
                <TikTokIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">TikTok</span>
            </button>

            {/* Twitter/X */}
            <button
              onClick={shareToTwitter}
              className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black flex items-center justify-center group-hover:scale-110 transition-transform">
                <Twitter className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">X</span>
            </button>
          </div>

          {/* Link Input with Copy Button */}
          <div className="flex items-center gap-2">
            <Input
              value={link}
              readOnly
              className="bg-muted/50 text-sm"
            />
            <Button
              variant="secondary"
              onClick={copyToClipboard}
              className="shrink-0 gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {t.share?.copyLink || "Copiar"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t.share?.autoCopy || "O link será copiado automaticamente ao compartilhar"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
