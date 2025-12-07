import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Copy, Check, MessageCircle, Facebook } from "lucide-react";

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

export const ShareDialog = ({ isOpen, onClose, link, title }: ShareDialogProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

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

  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const shareToWhatsApp = async () => {
    await copyToClipboard();
    const text = encodeURIComponent(title ? `${title}: ${link}` : link);
    
    if (isMobile()) {
      window.location.href = `whatsapp://send?text=${text}`;
    } else {
      window.open(`https://web.whatsapp.com/send?text=${text}`, "_blank");
    }
  };

  const shareToMessenger = async () => {
    await copyToClipboard();
    const encodedLink = encodeURIComponent(link);
    
    if (isMobile()) {
      window.location.href = `fb-messenger://share?link=${encodedLink}`;
    } else {
      window.open(`https://www.facebook.com/dialog/send?link=${encodedLink}&app_id=966242223397117&redirect_uri=${encodeURIComponent(window.location.href)}`, "_blank");
    }
  };

  const shareToTikTok = async () => {
    await copyToClipboard();
    
    toast({
      title: t.share?.linkCopied || "Link copiado!",
      description: "Cole o link em sua bio do TikTok",
    });
    
    if (isMobile()) {
      window.location.href = "snssdk1233://";
    } else {
      window.open("https://tiktok.com", "_blank");
    }
  };

  const shareToFacebook = async () => {
    await copyToClipboard();
    const encodedLink = encodeURIComponent(link);
    
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`, "_blank");
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
          {/* Social Media Buttons - Row with 4 buttons */}
          <div className="grid grid-cols-4 gap-4">
            {/* WhatsApp */}
            <button
              onClick={shareToWhatsApp}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs text-muted-foreground">WhatsApp</span>
            </button>

            {/* Messenger */}
            <button
              onClick={shareToMessenger}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{
                  background: "linear-gradient(45deg, #0078FF, #00C6FF)"
                }}
              >
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.98-.87c.17-.08.36-.1.55-.06.91.25 1.88.38 2.89.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm6 7.68l-2.93 4.65c-.47.74-1.44.93-2.13.41l-2.34-1.75c-.18-.13-.42-.13-.6 0l-3.15 2.39c-.42.32-.97-.18-.68-.62l2.93-4.65c.47-.74 1.44-.93 2.13-.41l2.34 1.75c.18.13.42.13.6 0l3.15-2.39c.42-.32.97.18.68.62z"/>
                </svg>
              </div>
              <span className="text-xs text-muted-foreground">Messenger</span>
            </button>

            {/* TikTok */}
            <button
              onClick={shareToTikTok}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center group-hover:scale-110 transition-transform border border-border">
                <TikTokIcon className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs text-muted-foreground">TikTok</span>
            </button>

            {/* Facebook */}
            <button
              onClick={shareToFacebook}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Facebook className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs text-muted-foreground">Facebook</span>
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
            O link será copiado automaticamente ao compartilhar
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
