import React from "react";
import { CreditCard, Clock, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaywallOverlayProps {
  priceLabel?: string;
  onPurchase: () => void;
  reason?: 'preview' | 'credits';
  remainingCredits?: number;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ priceLabel, onPurchase, reason = 'preview', remainingCredits }) => {
  const headline =
    reason === 'credits'
      ? 'Seus créditos acabaram'
      : 'Prévia encerrada';

  const description =
    reason === 'credits'
      ? 'Compre mais créditos para continuar assistindo sem interrupções.'
      : 'Sua prévia gratuita terminou. Compre créditos para continuar assistindo.';

  const creditsLabel =
    typeof remainingCredits === 'number'
      ? `Créditos restantes: ${Math.max(0, Math.floor(remainingCredits))}`
      : null;

  const Icon = reason === 'credits' ? Coins : Clock;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-md p-6 text-center">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-primary/20 bg-card p-8 shadow-2xl">
        <div className="flex items-center justify-center gap-3 text-xl font-bold text-primary">
          <Icon className="h-6 w-6 animate-pulse" />
          <span>{headline}</span>
        </div>
        
        <p className="text-sm text-muted-foreground">{description}</p>
        
        {creditsLabel && (
          <div className="flex items-center justify-center gap-2 text-xs text-destructive">
            <Coins className="h-4 w-4" />
            <span>{creditsLabel}</span>
          </div>
        )}
        
        <Button onClick={onPurchase} size="lg" className="w-full gap-2">
          <CreditCard className="h-5 w-5" />
          Comprar Créditos
        </Button>
        
        <p className="text-xs text-muted-foreground">
          180 créditos = 30 min de visualização
        </p>
      </div>
    </div>
  );
};

export default PaywallOverlay;
