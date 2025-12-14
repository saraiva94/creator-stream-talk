import React from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Clock, Coins, VolumeX, MessageSquareOff, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

interface PaywallOverlayProps {
  priceLabel?: string;
  onPurchase?: () => void;
  reason?: 'preview' | 'credits';
  remainingCredits?: number;
  isAuthenticated?: boolean;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ 
  priceLabel, 
  onPurchase, 
  reason = 'preview', 
  remainingCredits,
  isAuthenticated = true,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const headline =
    reason === 'credits'
      ? (t.paywall?.creditsEnded || 'Seus créditos acabaram!')
      : (t.paywall?.previewEnded || 'Preview encerrado!');

  const Icon = reason === 'credits' ? Coins : Clock;

  const handleBuyCredits = () => {
    if (onPurchase) {
      onPurchase();
    } else {
      navigate('/profile');
    }
  };

  const handleLogin = () => {
    navigate('/auth');
  };

  const handleSignup = () => {
    navigate('/subscribe');
  };

  // Usuário NÃO autenticado - mostrar opções de login/cadastro
  if (!isAuthenticated) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 text-center">
        <div className="w-full max-w-lg space-y-6 rounded-2xl border-2 border-primary/30 bg-card/95 p-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-center gap-3 text-2xl font-bold text-primary">
            <Clock className="h-8 w-8 animate-pulse" />
            <span>{t.paywall?.previewEnded || "Preview encerrado!"}</span>
          </div>
          
          {/* Main message */}
          <div className="space-y-3">
            <p className="text-lg text-foreground">
              {t.paywall?.loginToWatch || "Para continuar assistindo, faça login ou cadastre-se."}
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <VolumeX className="h-4 w-4 text-destructive" />
                <span>{t.paywall?.audioMuted || "Áudio mutado"}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquareOff className="h-4 w-4 text-destructive" />
                <span>{t.paywall?.chatBlocked || "Chat bloqueado"}</span>
              </div>
            </div>
          </div>
          
          {/* Credits info box */}
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <Coins className="h-5 w-5" />
              <span>{t.paywall?.minPackage || "Pacote mínimo: 180 créditos"}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ 5,00</p>
            <p className="text-xs text-muted-foreground">
              {t.paywall?.viewingTime || "30 minutos de visualização"}
            </p>
          </div>
          
          {/* CTA Buttons - Login and Register */}
          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleLogin} 
              size="lg" 
              className="w-full gap-2 text-lg py-6 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <LogIn className="h-6 w-6" />
              {t.paywall?.login || "Fazer Login"}
            </Button>
            
            <Button 
              onClick={handleSignup} 
              size="lg" 
              variant="outline"
              className="w-full gap-2 text-lg py-6 border-primary/50 hover:bg-primary/10"
            >
              <UserPlus className="h-6 w-6" />
              {t.paywall?.register || "Cadastrar-se"}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            {t.paywall?.firstTimeBonus || "Cadastre-se e ganhe bônus de boas-vindas!"}
          </p>
        </div>
      </div>
    );
  }

  // Usuário autenticado - mostrar opção de comprar créditos
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
            {t.paywall?.needCredits || "Para continuar assistindo, você precisa comprar créditos."}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <VolumeX className="h-4 w-4 text-destructive" />
              <span>{t.paywall?.audioMuted || "Áudio mutado"}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquareOff className="h-4 w-4 text-destructive" />
              <span>{t.paywall?.chatBlocked || "Chat bloqueado"}</span>
            </div>
          </div>
        </div>
        
        {/* Credit packages - Two options */}
        <div className="grid grid-cols-2 gap-4">
          {/* Package 1: 180 credits - R$5 */}
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <Coins className="h-5 w-5" />
              <span>180 {t.paywall?.credits || "créditos"}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ 5,00</p>
            <p className="text-xs text-muted-foreground">
              30 {t.paywall?.minutes || "minutos"}
            </p>
          </div>
          
          {/* Package 2: 360 credits - R$9 */}
          <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-accent font-semibold">
              <Coins className="h-5 w-5" />
              <span>360 {t.paywall?.credits || "créditos"}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ 9,00</p>
            <p className="text-xs text-muted-foreground">
              60 {t.paywall?.minutes || "minutos"}
            </p>
          </div>
        </div>
        
        {/* Remaining credits if any */}
        {typeof remainingCredits === 'number' && remainingCredits <= 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive">
            <Coins className="h-4 w-4" />
            <span>{t.paywall?.noCreditsLeft || "Você não tem mais créditos"}</span>
          </div>
        )}
        
        {/* CTA Button */}
        <Button 
          onClick={handleBuyCredits} 
          size="lg" 
          className="w-full gap-2 text-lg py-6 bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <CreditCard className="h-6 w-6" />
          {t.paywall?.buyNow || "Comprar Créditos Agora"}
        </Button>
        
        <p className="text-xs text-muted-foreground">
          {t.paywall?.instantCredits || "Créditos são adicionados instantaneamente após o pagamento"}
        </p>
      </div>
    </div>
  );
};

export default PaywallOverlay;
