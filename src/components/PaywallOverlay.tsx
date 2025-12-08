import React from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Clock, Coins, VolumeX, MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

interface PaywallOverlayProps {
  priceLabel?: string;
  onPurchase?: () => void;
  reason?: 'preview' | 'credits';
  remainingCredits?: number;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ 
  priceLabel, 
  onPurchase, 
  reason = 'preview', 
  remainingCredits 
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const headline =
    reason === 'credits'
      ? (t.paywall?.creditsEnded || 'Your credits ran out!')
      : (t.paywall?.previewEnded || 'Preview ended!');

  const Icon = reason === 'credits' ? Coins : Clock;

  const handleBuyCredits = () => {
    if (onPurchase) {
      onPurchase();
    } else {
      navigate('/profile');
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 text-center">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border-2 border-primary/30 bg-card/95 p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 text-2xl font-bold text-primary">
          <Icon className="h-8 w-8 animate-pulse" />
          <span>{headline}</span>
        </div>
        
        {/* Main message */}
        <div className="space-y-3">
          <p className="text-lg text-foreground">
            {t.paywall?.needCredits || "To continue watching, you need to buy credits."}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <VolumeX className="h-4 w-4 text-destructive" />
              <span>{t.paywall?.audioMuted || "Audio muted"}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquareOff className="h-4 w-4 text-destructive" />
              <span>{t.paywall?.chatBlocked || "Chat blocked"}</span>
            </div>
          </div>
        </div>
        
        {/* Credits info box */}
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary font-semibold">
            <Coins className="h-5 w-5" />
            <span>{t.paywall?.minPackage || "Minimum package: 180 credits"}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ 5,00</p>
          <p className="text-xs text-muted-foreground">
            {t.paywall?.viewingTime || "30 minutes of viewing"}
          </p>
        </div>
        
        {/* Remaining credits if any */}
        {typeof remainingCredits === 'number' && remainingCredits <= 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive">
            <Coins className="h-4 w-4" />
            <span>{t.paywall?.noCreditsLeft || "You have no credits left"}</span>
          </div>
        )}
        
        {/* CTA Button */}
        <Button 
          onClick={handleBuyCredits} 
          size="lg" 
          className="w-full gap-2 text-lg py-6 bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <CreditCard className="h-6 w-6" />
          {t.paywall?.buyNow || "Buy Credits Now"}
        </Button>
        
        <p className="text-xs text-muted-foreground">
          {t.paywall?.instantCredits || "Credits are added instantly after payment"}
        </p>
      </div>
    </div>
  );
};

export default PaywallOverlay;
