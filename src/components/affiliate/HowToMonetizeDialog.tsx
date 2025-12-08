import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, User, Users, DollarSign, ArrowDown, Sparkles, Coins } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

// Animated money icon with particles
const AnimatedMoney = ({ className = "" }: { className?: string }) => {
  const [showCoins, setShowCoins] = useState(false);
  const [key, setKey] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCoins(true);
      setKey(prev => prev + 1);
      setTimeout(() => setShowCoins(false), 800);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <Coins className="w-5 h-5 text-yellow-500 animate-coin-bounce" />
      {showCoins && (
        <div key={key} className="absolute inset-0 pointer-events-none overflow-visible">
          {[0, 1, 2, 3].map((i) => (
            <span 
              key={i}
              className="absolute text-xs opacity-0"
              style={{
                animation: `coin-fly 0.8s ease-out ${i * 100}ms forwards`,
                left: '50%',
                top: '50%',
              }}
            >
              {i % 2 === 0 ? '🪙' : '$'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Animated arrow with coin particles
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
      <ArrowDown className={`w-6 h-6 ${color} animate-bounce-custom`} />
      {showCoins && (
        <div key={key} className="absolute inset-0 pointer-events-none overflow-visible">
          {[0, 1, 2].map((i) => (
            <span 
              key={i}
              className="absolute text-xs opacity-0"
              style={{
                animation: `coin-fly 0.6s ease-out ${i * 80}ms forwards`,
                left: `${40 + i * 10}%`,
                top: '50%',
              }}
            >
              {i % 2 === 0 ? '🪙' : '$'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Money badge with animated coins
const MoneyBadge = ({ amount, color }: { amount: string; color: "green" | "yellow" | "orange" }) => {
  const [showCoins, setShowCoins] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCoins(true);
      setKey(prev => prev + 1);
      setTimeout(() => setShowCoins(false), 800);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const bgColor = color === "green" ? "bg-green-500" : color === "yellow" ? "bg-yellow-500" : "bg-orange-500";

  return (
    <div className="relative flex items-center gap-1">
      <AnimatedMoney />
      <div className={`${bgColor} text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse-scale relative overflow-visible`}>
        +{amount}
        {showCoins && (
          <span key={key} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="absolute text-xs opacity-0"
                style={{
                  animation: `money-burst 0.8s ease-out ${i * 50}ms forwards`,
                  transform: `rotate(${i * 72}deg)`,
                }}
              >
                $
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
};

// Person node component
const PersonNode = ({ 
  icon: Icon, 
  label, 
  color, 
  isYou = false,
  small = false
}: { 
  icon: typeof User; 
  label: string; 
  color: string; 
  isYou?: boolean;
  small?: boolean;
}) => {
  const colorClasses = {
    primary: { border: "border-primary", bg: "bg-primary/20", text: "text-primary" },
    green: { border: "border-green-500", bg: "bg-green-500/20", text: "text-green-500" },
    yellow: { border: "border-yellow-500", bg: "bg-yellow-500/20", text: "text-yellow-500" },
    orange: { border: "border-orange-500", bg: "bg-orange-500/20", text: "text-orange-500" },
  };
  
  const classes = colorClasses[color as keyof typeof colorClasses] || colorClasses.primary;

  return (
    <div 
      className={`flex items-center gap-2 ${classes.bg} rounded-full ${small ? 'px-2 py-1' : 'px-4 py-2'} border-2 ${classes.border} ${isYou ? "animate-glow-pulse" : ""}`}
    >
      <Icon className={`${small ? 'w-3 h-3' : 'w-5 h-5'} ${classes.text} ${isYou ? "animate-bounce-slow" : ""}`} />
      <span className={`${small ? 'text-xs' : 'text-sm'} font-bold ${classes.text}`}>{label}</span>
    </div>
  );
};

// Referral chain level
const ReferralLevel = ({ 
  level, 
  label, 
  amount, 
  color, 
  description 
}: { 
  level: number;
  label: string; 
  amount: string; 
  color: "green" | "yellow" | "orange";
  description: string;
}) => (
  <div className="flex flex-col items-center">
    <div className="text-[10px] text-muted-foreground mb-2 text-center">{description}</div>
    <div className="flex items-center gap-2">
      <PersonNode 
        icon={level === 1 ? User : Users} 
        label={label} 
        color={color} 
        small={level > 2}
      />
      <MoneyBadge amount={amount} color={color} />
    </div>
  </div>
);

export const HowToMonetizeDialog = () => {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-primary/50 hover:border-primary hover:bg-primary/10 group relative overflow-hidden"
        >
          <span className="text-primary font-medium">{t.affiliate?.howToMonetize || "Como monetizar"}</span>
          <HelpCircle className="w-4 h-4 text-primary animate-pulse" />
          {/* Animated glow effect */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          {/* Pulsing border glow */}
          <span className="absolute inset-0 rounded-md animate-border-glow pointer-events-none" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary animate-bounce-slow" />
            {t.affiliate?.howToMonetizeTitle || "Como funciona a monetização?"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Simple explanation */}
          <p className="text-muted-foreground text-sm">
            {t.affiliate?.monetizationDesc || "Ganhe comissões ilimitadas! Cada pessoa que você indica gera ganhos, e quando eles indicam outros, você continua ganhando."}
          </p>
          
          {/* Visual illustration - Multiple generations */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
            {/* Decorative sparkles */}
            <Sparkles className="absolute top-2 right-2 w-4 h-4 text-primary/30 animate-pulse" />
            <Sparkles className="absolute bottom-2 left-2 w-3 h-3 text-yellow-500/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
            <Sparkles className="absolute top-1/2 right-4 w-3 h-3 text-orange-500/30 animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* Chain visualization */}
            <div className="flex flex-col items-center space-y-1">
              {/* Level 0 - You */}
              <PersonNode icon={User} label={t.affiliate?.you || "VOCÊ"} color="primary" isYou />
              
              <AnimatedArrowDown color="text-primary" className="my-1" />
              
              {/* Level 1 - Direct */}
              <ReferralLevel 
                level={1}
                label="1º Nível"
                amount="R$1,00"
                color="green"
                description="Seu link traz"
              />
              
              <AnimatedArrowDown color="text-green-500/60" className="my-1" />
              
              {/* Level 2 - Indirect 1 */}
              <ReferralLevel 
                level={2}
                label="2º Nível"
                amount="R$0,50"
                color="yellow"
                description="Que o amigo traz"
              />
              
              <AnimatedArrowDown color="text-yellow-500/60" className="my-1" />
              
              {/* Level 3 - Indirect 2 */}
              <ReferralLevel 
                level={3}
                label="3º Nível"
                amount="R$0,50"
                color="orange"
                description="Que o amigo do amigo traz"
              />

              {/* Continuation indicator */}
              <div className="mt-3 pt-3 border-t border-dashed border-primary/20 w-full">
                <div className="flex flex-col items-center">
                  <div className="text-xs text-center text-muted-foreground mb-2 flex items-center gap-1">
                    <AnimatedMoney />
                    <span className="font-medium">E assim por diante...</span>
                    <AnimatedMoney />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                    <span>Cada pessoa da sua rede indica →</span>
                    <span className="text-green-500 font-bold">+R$1,00</span>
                    <span>ou</span>
                    <span className="text-yellow-500 font-bold">+R$0,50</span>
                    <span>pra você!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Summary */}
          <div className="bg-card p-3 rounded-lg border border-border space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              {t.affiliate?.summaryTitle || "Valores líquidos para saque:"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <strong className="text-green-500">R$1,00</strong> por indicação direta (1º nível)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <strong className="text-yellow-500">R$0,50</strong> por indicação indireta (2º nível)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                <strong className="text-orange-500">R$0,50</strong> por cada nível seguinte
              </li>
            </ul>
          </div>
          
          <div className="bg-primary/10 p-3 rounded-lg border border-primary/30 text-center">
            <p className="text-sm text-primary font-bold flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 animate-pulse" />
              Ganhos ilimitados! Sua rede cresce, seu saldo cresce.
              <Sparkles className="w-4 h-4 animate-pulse" />
            </p>
          </div>
        </div>

        {/* Custom CSS for animations */}
        <style>{`
          @keyframes money-burst {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-30px) scale(0.5); }
          }
          
          @keyframes coin-fly {
            0% { opacity: 1; transform: translate(0, 0) scale(1); }
            100% { opacity: 0; transform: translate(var(--tx, 15px), var(--ty, -25px)) scale(0.4); }
          }
          
          @keyframes coin-bounce {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-4px) rotate(15deg); }
          }
          
          @keyframes bounce-custom {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          
          @keyframes pulse-scale {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          
          @keyframes glow-pulse {
            0%, 100% { box-shadow: 0 0 5px hsl(var(--primary) / 0.3); }
            50% { box-shadow: 0 0 15px hsl(var(--primary) / 0.6); }
          }
          
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          
          @keyframes border-glow {
            0%, 100% { box-shadow: inset 0 0 3px hsl(var(--primary) / 0.3); }
            50% { box-shadow: inset 0 0 8px hsl(var(--primary) / 0.5); }
          }
          
          .animate-coin-bounce { animation: coin-bounce 1s ease-in-out infinite; }
          .animate-bounce-custom { animation: bounce-custom 1s ease-in-out infinite; }
          .animate-pulse-scale { animation: pulse-scale 1.5s ease-in-out infinite; }
          .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
          .animate-border-glow { animation: border-glow 2s ease-in-out infinite; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default HowToMonetizeDialog;
