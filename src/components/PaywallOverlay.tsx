import React from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Clock, Coins, VolumeX, MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const headline =
    reason === 'credits'
      ? 'Seus créditos acabaram!'
      : 'Prévia encerrada!';

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
            Para continuar assistindo, você precisa comprar créditos.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <VolumeX className="h-4 w-4 text-destructive" />
              <span>Áudio mutado</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquareOff className="h-4 w-4 text-destructive" />
              <span>Chat bloqueado</span>
            </div>
          </div>
        </div>
        
        {/* Credits info box */}
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary font-semibold">
            <Coins className="h-5 w-5" />
            <span>Pacote mínimo: 180 créditos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ 5,00</p>
          <p className="text-xs text-muted-foreground">
            30 minutos de visualização
          </p>
        </div>
        
        {/* Remaining credits if any */}
        {typeof remainingCredits === 'number' && remainingCredits <= 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive">
            <Coins className="h-4 w-4" />
            <span>Você não tem créditos restantes</span>
          </div>
        )}
        
        {/* CTA Button */}
        <Button 
          onClick={handleBuyCredits} 
          size="lg" 
          className="w-full gap-2 text-lg py-6 bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <CreditCard className="h-6 w-6" />
          Comprar Créditos Agora
        </Button>
        
        <p className="text-xs text-muted-foreground">
          Os créditos são adicionados instantaneamente após o pagamento
        </p>
      </div>
    </div>
  );
};

export default PaywallOverlay;
