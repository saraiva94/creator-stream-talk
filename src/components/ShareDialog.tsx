import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, MessageCircle, Instagram, Globe } from "lucide-react";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  link: string;
  title?: string;
}

export const ShareDialog = ({ isOpen, onClose, link, title }: ShareDialogProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Erro ao copiar",
        description: "Por favor, copie o link manualmente",
        variant: "destructive",
      });
    }
  };

  const shareToWhatsApp = async () => {
    await copyToClipboard();
    const text = encodeURIComponent(title ? `${title}: ${link}` : link);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile) {
      window.location.href = `whatsapp://send?text=${text}`;
    } else {
      window.open(`https://web.whatsapp.com/send?text=${text}`, "_blank");
    }
  };

  const shareToInstagram = async () => {
    await copyToClipboard();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    toast({
      title: "Link copiado!",
      description: "Cole o link em sua bio ou stories do Instagram",
    });
    
    if (isMobile) {
      window.location.href = "instagram://";
    } else {
      window.open("https://instagram.com", "_blank");
    }
  };

  const shareToTikTok = async () => {
    await copyToClipboard();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    toast({
      title: "Link copiado!",
      description: "Cole o link em sua bio do TikTok",
    });
    
    if (isMobile) {
      window.location.href = "snssdk1233://";
    } else {
      window.open("https://tiktok.com", "_blank");
    }
  };

  const shareToKwai = async () => {
    await copyToClipboard();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    toast({
      title: "Link copiado!",
      description: "Cole o link em sua bio do Kwai",
    });
    
    if (isMobile) {
      window.location.href = "kwai://";
    } else {
      window.open("https://kwai.com", "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-xl">Compartilhar</DialogTitle>
          <DialogDescription>
            Compartilhe seu link de afiliado nas redes sociais
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Social Media Buttons */}
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

            {/* Instagram */}
            <button
              onClick={shareToInstagram}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{
                  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)"
                }}
              >
                <Instagram className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs text-muted-foreground">Instagram</span>
            </button>

            {/* TikTok */}
            <button
              onClick={shareToTikTok}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center group-hover:scale-110 transition-transform border border-border">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </div>
              <span className="text-xs text-muted-foreground">TikTok</span>
            </button>

            {/* Kwai */}
            <button
              onClick={shareToKwai}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#FF6B00] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs text-muted-foreground">Kwai</span>
            </button>
          </div>

          {/* Link Input */}
          <div className="flex items-center gap-2">
            <Input
              value={link}
              readOnly
              className="bg-muted/50 text-sm"
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={copyToClipboard}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
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