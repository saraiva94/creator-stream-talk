import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Coins } from "lucide-react";
import { createSuperChatPayment } from "@/lib/supabaseApi";
import { PixPaymentDialog, PixPaymentData } from "@/components/pix/PixPaymentDialog";

interface SuperChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  userId: string;
  roomId: string;
  initialTier?: "blue" | "yellow" | "red" | null;
}

export const SUPERCHAT_TIERS = [
  { amount: 3, tier: "blue", color: "bg-blue-500", duration: 60, labelKey: "1min" },
  { amount: 5, tier: "yellow", color: "bg-yellow-500", duration: 120, labelKey: "2min" },
  { amount: 8, tier: "red", color: "bg-red-500", duration: 180, labelKey: "3min" },
] as const;

const SuperChatDialog = ({
  open,
  onOpenChange,
  creatorId,
  userId,
  roomId,
  initialTier = null,
}: SuperChatDialogProps) => {
  const initialTierData = initialTier 
    ? SUPERCHAT_TIERS.find(t => t.tier === initialTier) || SUPERCHAT_TIERS[1]
    : SUPERCHAT_TIERS[1];
  const [selectedTier, setSelectedTier] = useState<typeof SUPERCHAT_TIERS[number]>(initialTierData);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);

  // Update selected tier when initialTier changes (e.g., from suggestion buttons)
  useEffect(() => {
    if (initialTier) {
      const tier = SUPERCHAT_TIERS.find(t => t.tier === initialTier);
      if (tier) setSelectedTier(tier);
    }
  }, [initialTier]);

  const handleSendSuperChat = async () => {
    if (!message.trim()) {
      toast({
        title: t.superchat?.messageRequired || "Message required",
        description: t.superchat?.messageRequiredDesc || "Write a message for the SuperChat",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await createSuperChatPayment({
        userId,
        creatorId,
        roomId,
        tier: selectedTier.tier,
        message: message.trim(),
      });

      if (response?.pix?.qrCode) {
        // Show PIX QR code dialog
        setPixData({
          qrCode: response.pix.qrCode,
          qrCodeImage: response.pix.qrCodeImage,
          expiresAt: response.pix.expiresAt,
          transactionId: response.transactionId || '',
          paymentId: response.paymentId,
          amount: response.amount,
          eventType: 'SUPERCHAT',
          description: `SuperChat ${selectedTier.tier.charAt(0).toUpperCase() + selectedTier.tier.slice(1)}`,
        });
        setPixDialogOpen(true);
        onOpenChange(false);
      } else {
        throw new Error("Could not generate PIX QR Code");
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : (t.superchat?.sendError || "Could not send SuperChat");
      toast({
        title: t.superchat?.errorTitle || "Error sending SuperChat",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmed = () => {
    setPixDialogOpen(false);
    setMessage("");
    toast({
      title: "SuperChat enviado!",
      description: "Seu SuperChat será exibido para o criador.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            {t.superchat?.title || "Send SuperChat"}
          </DialogTitle>
          <DialogDescription>
            {t.superchat?.desc || "Support the creator with a highlighted message!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>{t.superchat?.selectTier || "Select tier"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {SUPERCHAT_TIERS.map((tier) => {
                const tierLabel = tier.labelKey === "1min" 
                  ? (t.superchat?.tier1min || "1 minute")
                  : tier.labelKey === "2min"
                  ? (t.superchat?.tier2min || "2 minutes")
                  : (t.superchat?.tier3min || "3 minutes");
                return (
                  <Button
                    key={tier.tier}
                    variant={selectedTier.tier === tier.tier ? "default" : "outline"}
                    onClick={() => setSelectedTier(tier)}
                    className={`flex flex-col h-auto py-3 ${
                      selectedTier.tier === tier.tier ? tier.color : ""
                    }`}
                  >
                    <span className="text-lg font-bold">R$ {tier.amount}</span>
                    <span className="text-xs opacity-80">{tierLabel}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="superchat-message">{t.superchat?.message || "Your message"}</Label>
            <Input
              id="superchat-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.superchat?.messagePlaceholder || "Write your message to the creator..."}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/200 {t.superchat?.characters || "characters"}
            </p>
          </div>

          <div className={`p-3 rounded-lg ${selectedTier.color} animate-pulse`}>
            <p className="text-white text-sm font-medium">{t.superchat?.preview || "SuperChat Preview"}</p>
            <p className="text-white text-xs mt-1">{message || (t.superchat?.previewPlaceholder || "Your message will appear here...")}</p>
          </div>

          <Button
            onClick={handleSendSuperChat}
            disabled={loading || !message.trim()}
            className="w-full"
          >
            {loading ? (t.superchat?.sending || "Sending...") : `${t.superchat?.send || "Send SuperChat"} R$ ${selectedTier.amount}`}
          </Button>
        </div>
      </DialogContent>

      <PixPaymentDialog
        open={pixDialogOpen}
        onOpenChange={setPixDialogOpen}
        pixData={pixData}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </Dialog>
  );
};

export default SuperChatDialog;
