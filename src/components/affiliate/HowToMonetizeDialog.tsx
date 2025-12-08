import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, User, Users, DollarSign, ArrowRight, ArrowDown, Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

// Money/coin particle component for arrow animations
const CoinParticle = ({ delay = 0, type = 'coin' }: { delay?: number; type?: 'coin' | 'dollar' }) => {
  const randomX = Math.random() * 30 - 15;
  const randomY = Math.random() * 20 - 10;
  
  return (
    <span 
      className="absolute text-xs font-bold opacity-0 pointer-events-none"
      style={{
        animation: `coin-scatter 0.6s ease-out ${delay}ms forwards`,
        left: `${50 + randomX}%`,
        top: `${50 + randomY}%`,
      }}
    >
      {type === 'coin' ? '🪙' : '$'}
    </span>
  );
};

// Money particle component for badges
const MoneyParticle = ({ delay = 0 }: { delay?: number }) => {
  const randomX = Math.random() * 40 - 20;
  const randomRotate = Math.random() * 360;
  
  return (
    <span 
      className="absolute text-xs font-bold opacity-0 pointer-events-none"
      style={{
        animation: `money-burst 0.8s ease-out ${delay}ms forwards`,
        transform: `translateX(${randomX}px) rotate(${randomRotate}deg)`,
      }}
    >
      $
    </span>
  );
};

// Animated arrow with bounce effect and coin particles
const AnimatedArrowDown = ({ className = "", color = "text-muted-foreground" }: { className?: string; color?: string }) => {
  const [showCoins, setShowCoins] = useState(false);
  const [key, setKey] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCoins(true);
      setKey(prev => prev + 1);
      setTimeout(() => setShowCoins(false), 600);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <ArrowDown 
        className={`w-6 h-6 ${color} animate-bounce-custom`}
      />
      {/* Coin particles on bounce */}
      {showCoins && (
        <div key={key} className="absolute inset-0 pointer-events-none overflow-visible">
          {[0, 1, 2].map((i) => (
            <CoinParticle key={i} delay={i * 80} type={i % 2 === 0 ? 'coin' : 'dollar'} />
          ))}
        </div>
      )}
    </div>
  );
};

// Animated horizontal arrow with coin scatter
const AnimatedArrowRight = ({ color = "text-green-500", onHit }: { color?: string; onHit?: () => void }) => {
  const [showCoins, setShowCoins] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      onHit?.();
      setShowCoins(true);
      setKey(prev => prev + 1);
      setTimeout(() => setShowCoins(false), 600);
    }, 1500);
    return () => clearInterval(interval);
  }, [onHit]);

  return (
    <div className="relative">
      <ArrowRight 
        className={`w-5 h-5 ${color} animate-arrow-hit`}
      />
      {/* Coin particles on hit */}
      {showCoins && (
        <div key={key} className="absolute -right-2 top-1/2 -translate-y-1/2 pointer-events-none overflow-visible">
          {[0, 1, 2, 3].map((i) => (
            <CoinParticle key={i} delay={i * 60} type={i % 2 === 0 ? 'coin' : 'dollar'} />
          ))}
        </div>
      )}
    </div>
  );
};

// Money badge with particles
const MoneyBadge = ({ amount, color }: { amount: string; color: "green" | "yellow" }) => {
  const [particles, setParticles] = useState<number[]>([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles([1, 2, 3, 4, 5]);
      setKey(prev => prev + 1);
      setTimeout(() => setParticles([]), 800);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const bgColor = color === "green" ? "bg-green-500" : "bg-yellow-500";
  const textColor = color === "green" ? "text-green-500" : "text-yellow-500";

  return (
    <div className="relative flex items-center gap-1">
      <AnimatedArrowRight color={textColor} />
      <div 
        className={`${bgColor} text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse-scale relative overflow-visible`}
      >
        +{amount}
        {/* Money particles */}
        <span key={key} className="absolute inset-0 flex items-center justify-center">
          {particles.map((_, i) => (
            <MoneyParticle key={`${key}-${i}`} delay={i * 50} />
          ))}
        </span>
      </div>
    </div>
  );
};

// Person node component
const PersonNode = ({ 
  icon: Icon, 
  label, 
  color, 
  isYou = false 
}: { 
  icon: typeof User; 
  label: string; 
  color: string; 
  isYou?: boolean;
}) => {
  const borderColor = isYou ? "border-primary" : color === "green" ? "border-green-500" : "border-yellow-500";
  const bgColor = isYou ? "bg-primary/20" : color === "green" ? "bg-green-500/20" : "bg-yellow-500/20";
  const textColor = isYou ? "text-primary" : color === "green" ? "text-green-500" : "text-yellow-500";

  return (
    <div 
      className={`flex items-center gap-2 ${bgColor} rounded-full px-4 py-2 border-2 ${borderColor} ${isYou ? "animate-glow-pulse" : ""}`}
    >
      <Icon className={`w-5 h-5 ${textColor} ${isYou ? "animate-bounce-slow" : ""}`} />
      <span className={`text-sm font-bold ${textColor}`}>{label}</span>
    </div>
  );
};

export const HowToMonetizeDialog = () => {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-primary hover:text-primary/80">
          <HelpCircle className="w-4 h-4" />
          {t.affiliate?.howToMonetize || "Como monetizar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary animate-bounce-slow" />
            {t.affiliate?.howToMonetizeTitle || "Como funciona a monetização?"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Simple explanation */}
          <p className="text-muted-foreground text-sm">
            {t.affiliate?.monetizationDesc || "Quando você convida alguém usando seu link, você ganha comissão! E se essa pessoa convidar outras, você também ganha uma parte."}
          </p>
          
          {/* Visual illustration */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-6 border border-primary/20 relative overflow-hidden">
            {/* Decorative sparkles */}
            <Sparkles className="absolute top-2 right-2 w-4 h-4 text-primary/30 animate-pulse" />
            <Sparkles className="absolute bottom-2 left-2 w-3 h-3 text-yellow-500/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
            
            {/* Level 1 - You */}
            <div className="flex flex-col items-center">
              <PersonNode icon={User} label={t.affiliate?.you || "VOCÊ"} color="primary" isYou />
              
              <AnimatedArrowDown color="text-primary" className="my-2" />
              
              {/* Your referral link sends */}
              <div className="text-xs text-muted-foreground mb-3 text-center">
                {t.affiliate?.yourLinkBrings || "Seu link traz"}
              </div>
              
              {/* Level 2 - Direct referral */}
              <div className="flex items-center gap-3 mb-2">
                <PersonNode icon={User} label={t.affiliate?.friend || "Amigo"} color="green" />
                <MoneyBadge amount="R$1,00" color="green" />
              </div>
              
              <AnimatedArrowDown color="text-green-500/60" className="my-2" />
              
              {/* Friend's link brings */}
              <div className="text-xs text-muted-foreground mb-3 text-center">
                {t.affiliate?.friendBrings || "Que o amigo traz"}
              </div>
              
              {/* Level 3 - Indirect referral */}
              <div className="flex items-center gap-3 mb-2">
                <PersonNode icon={Users} label={t.affiliate?.friendOfFriend || "Amigo do amigo"} color="yellow" />
                <MoneyBadge amount="R$0,50" color="yellow" />
              </div>

              {/* Continuation indicator - showing the cycle continues */}
              <div className="mt-4 pt-4 border-t border-dashed border-primary/20 w-full">
                <div className="flex flex-col items-center">
                  <div className="text-xs text-center text-muted-foreground mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-yellow-500" />
                    <span>E o ciclo continua...</span>
                    <Sparkles className="w-3 h-3 text-yellow-500" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                    <span className="text-yellow-500 font-semibold">Amigo do amigo</span>
                    <span>também pode indicar e ganhar</span>
                    <span className="text-green-500 font-bold">R$1,00</span>
                    <span>+</span>
                    <span className="text-yellow-500 font-bold">R$0,50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Summary */}
          <div className="bg-card p-4 rounded-lg border border-border space-y-2">
            <h4 className="font-semibold text-sm">{t.affiliate?.summaryTitle || "Resumo:"}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <strong className="text-green-500">R$1,00</strong> {t.affiliate?.forEachDirect || "para cada amigo que você indicar diretamente"}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                <strong className="text-yellow-500">R$0,50</strong> {t.affiliate?.forEachIndirect || "para cada pessoa que seu amigo indicar"}
              </li>
            </ul>
          </div>
          
          <p className="text-xs text-primary text-center font-medium animate-pulse">
            {t.affiliate?.noLimit || "Sem limite! Quanto mais pessoas na sua rede, mais você ganha."}
          </p>
        </div>

        {/* Custom CSS for animations */}
        <style>{`
          @keyframes money-burst {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-30px) scale(0.5);
            }
          }
          
          @keyframes coin-scatter {
            0% {
              opacity: 1;
              transform: translate(0, 0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(var(--scatter-x, 15px), var(--scatter-y, -20px)) scale(0.6);
            }
          }
          
          @keyframes bounce-custom {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-6px);
            }
          }
          
          @keyframes arrow-hit {
            0%, 100% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(4px);
            }
          }
          
          @keyframes pulse-scale {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
          
          @keyframes glow-pulse {
            0%, 100% {
              box-shadow: 0 0 5px hsl(var(--primary) / 0.3);
            }
            50% {
              box-shadow: 0 0 15px hsl(var(--primary) / 0.6);
            }
          }
          
          @keyframes bounce-slow {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-2px);
            }
          }
          
          .animate-bounce-custom {
            animation: bounce-custom 1s ease-in-out infinite;
          }
          
          .animate-arrow-hit {
            animation: arrow-hit 1.5s ease-in-out infinite;
          }
          
          .animate-pulse-scale {
            animation: pulse-scale 1.5s ease-in-out infinite;
          }
          
          .animate-glow-pulse {
            animation: glow-pulse 2s ease-in-out infinite;
          }
          
          .animate-bounce-slow {
            animation: bounce-slow 2s ease-in-out infinite;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default HowToMonetizeDialog;
