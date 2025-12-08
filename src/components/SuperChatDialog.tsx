import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Coins } from "lucide-react";

interface SuperChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  userId: string;
  roomId: string;
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
}: SuperChatDialogProps) => {
  const [selectedTier, setSelectedTier] = useState<typeof SUPERCHAT_TIERS[number]>(SUPERCHAT_TIERS[1]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

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
      const { data, error } = await supabase.functions.invoke("create-superchat-payment", {
        body: {
          creatorId,
          userId,
          roomId,
          tier: selectedTier.tier,
          amount: selectedTier.amount,
          duration: selectedTier.duration,
          message: message.trim(),
        },
      });

      if (error) throw error;

      if (data?.init_point) {
        window.open(data.init_point, "_blank");
        toast({
          title: t.superchat?.redirecting || "Redirecting to payment",
          description: t.superchat?.completePayment || "Complete the payment to send your SuperChat",
        });
        onOpenChange(false);
        setMessage("");
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
    </Dialog>
  );
};

export default SuperChatDialog;
