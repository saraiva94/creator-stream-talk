import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, User, Users, DollarSign, Sparkles, Coins } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

// Animated money icon with particles
const AnimatedMoney = ({ className = "", size = "normal" }: { className?: string; size?: "small" | "normal" }) => {
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
      <Coins className={`${size === "small" ? "w-3 h-3" : "w-5 h-5"} text-yellow-500 animate-coin-bounce`} />
      {showCoins && (
        <div key={key} className="absolute inset-0 pointer-events-none overflow-visible">
          {[0, 1].map((i) => (
            <span 
              key={i}
              className="absolute text-[8px] opacity-0"
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

// Commission arrow connecting levels
const CommissionArrow = ({ 
  from, 
  to, 
  amount, 
  color,
  isSecondary = false
}: { 
  from: string; 
  to: string; 
  amount: string; 
  color: string;
  isSecondary?: boolean;
}) => {
  const [animate, setAnimate] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimate(true);
      setTimeout(() => setAnimate(false), 800);
    }, isSecondary ? 1500 : 1200);
    return () => clearInterval(interval);
  }, [isSecondary]);

  return (
    <div className={`flex items-center gap-1 ${isSecondary ? 'opacity-80' : ''}`}>
      <span className="text-[8px] text-muted-foreground">{from}</span>
      <div className="relative flex items-center">
        <div className={`h-[2px] ${isSecondary ? 'w-4' : 'w-6'} ${color} rounded`} />
        <div className={`absolute right-0 w-0 h-0 border-l-4 border-l-current border-y-2 border-y-transparent ${color.replace('bg-', 'text-')}`} />
        {animate && (
          <span 
            className="absolute text-[8px] opacity-0"
            style={{
              animation: 'coin-slide 0.6s ease-out forwards',
              left: '0',
              top: '-8px',
            }}
          >
            🪙
          </span>
        )}
      </div>
      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${color} text-white`}>
        {amount}
      </span>
      <span className="text-[8px] text-muted-foreground">→ {to}</span>
    </div>
  );
};

// Level badge component
const LevelBadge = ({ 
  level, 
  color,
  isYou = false 
}: { 
  level: number;
  color: string;
  isYou?: boolean;
}) => {
  const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    primary: { border: "border-primary", bg: "bg-primary/20", text: "text-primary" },
    green: { border: "border-green-500", bg: "bg-green-500/20", text: "text-green-500" },
    yellow: { border: "border-yellow-500", bg: "bg-yellow-500/20", text: "text-yellow-500" },
    orange: { border: "border-orange-500", bg: "bg-orange-500/20", text: "text-orange-500" },
    pink: { border: "border-pink-500", bg: "bg-pink-500/20", text: "text-pink-500" },
    cyan: { border: "border-cyan-500", bg: "bg-cyan-500/20", text: "text-cyan-500" },
    purple: { border: "border-purple-500", bg: "bg-purple-500/20", text: "text-purple-500" },
  };
  
  const classes = colorMap[color] || colorMap.primary;

  return (
    <div 
      className={`flex items-center gap-1 ${classes.bg} rounded-full px-2 py-1 border ${classes.border} ${isYou ? "animate-glow-pulse" : ""}`}
    >
      {isYou ? (
        <User className={`w-3 h-3 ${classes.text} animate-bounce-slow`} />
      ) : (
        <Users className={`w-3 h-3 ${classes.text}`} />
      )}
      <span className={`text-[10px] font-bold ${classes.text}`}>
        {isYou ? "VOCÊ" : `${level}º`}
      </span>
    </div>
  );
};

export const HowToMonetizeDialog = () => {
  const { t } = useLanguage();

  // 6 levels with their colors
  const levels = [
    { level: 1, color: "green", name: "1º" },
    { level: 2, color: "yellow", name: "2º" },
    { level: 3, color: "orange", name: "3º" },
    { level: 4, color: "pink", name: "4º" },
    { level: 5, color: "cyan", name: "5º" },
    { level: 6, color: "purple", name: "6º" },
  ];

  // Commission relationships: each person earns R$1 from direct (1 level) and R$0.50 from indirect (2 levels)
  // VOCÊ earns from 1º (R$1) and 2º (R$0.50)
  // 1º earns from 2º (R$1) and 3º (R$0.50)
  // 2º earns from 3º (R$1) and 4º (R$0.50)
  // etc...
  const commissionRelationships = [
    { from: "1º", to: "VOCÊ", amount: "R$1", color: "bg-green-500", isSecondary: false },
    { from: "2º", to: "VOCÊ", amount: "R$0,50", color: "bg-yellow-500", isSecondary: true },
    { from: "2º", to: "1º", amount: "R$1", color: "bg-green-500", isSecondary: false },
    { from: "3º", to: "1º", amount: "R$0,50", color: "bg-yellow-500", isSecondary: true },
    { from: "3º", to: "2º", amount: "R$1", color: "bg-green-500", isSecondary: false },
    { from: "4º", to: "2º", amount: "R$0,50", color: "bg-yellow-500", isSecondary: true },
    { from: "4º", to: "3º", amount: "R$1", color: "bg-green-500", isSecondary: false },
    { from: "5º", to: "3º", amount: "R$0,50", color: "bg-yellow-500", isSecondary: true },
    { from: "5º", to: "4º", amount: "R$1", color: "bg-green-500", isSecondary: false },
    { from: "6º", to: "4º", amount: "R$0,50", color: "bg-yellow-500", isSecondary: true },
    { from: "6º", to: "5º", amount: "R$1", color: "bg-green-500", isSecondary: false },
  ];

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
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <span className="absolute inset-0 rounded-md animate-border-glow pointer-events-none" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary animate-bounce-slow" />
            {t.affiliate?.howToMonetizeTitle || "Como funciona a monetização?"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-2">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30">
            <p className="text-muted-foreground text-xs text-center">
              <strong className="text-primary">Lógica de 2 níveis:</strong> Você ganha <span className="text-green-500 font-bold">R$1</span> de quem você indica (direto) 
              e <span className="text-yellow-500 font-bold">R$0,50</span> de quem seu indicado indica (neto). 
              <br />Cada pessoa na rede funciona da mesma forma, sempre ganhando de 2 níveis!
            </p>
          </div>
          
          {/* Visual chain showing the 6 levels */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-3 border border-primary/20 relative overflow-hidden">
            <Sparkles className="absolute top-1 right-1 w-3 h-3 text-primary/30 animate-pulse" />
            
            <div className="flex flex-col items-center space-y-2">
              {/* VOCÊ at the top */}
              <div className="flex items-center gap-2">
                <LevelBadge level={0} color="primary" isYou />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 1º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 2º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground">↓ indica ↓</div>
              
              {/* Level 1 */}
              <div className="flex items-center gap-2">
                <LevelBadge level={1} color="green" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 2º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 3º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground">↓ indica ↓</div>
              
              {/* Level 2 */}
              <div className="flex items-center gap-2">
                <LevelBadge level={2} color="yellow" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 3º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 4º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground">↓ indica ↓</div>
              
              {/* Level 3 */}
              <div className="flex items-center gap-2">
                <LevelBadge level={3} color="orange" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 4º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 5º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground">↓ indica ↓</div>
              
              {/* Level 4 */}
              <div className="flex items-center gap-2">
                <LevelBadge level={4} color="pink" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 5º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 6º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground">↓ indica ↓</div>
              
              {/* Level 5 */}
              <div className="flex items-center gap-2">
                <LevelBadge level={5} color="cyan" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 6º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 7º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground">↓ indica ↓</div>
              
              {/* Level 6 */}
              <div className="flex items-center gap-2">
                <LevelBadge level={6} color="purple" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 7º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AnimatedMoney size="small" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 8º</span>
                  </div>
                </div>
              </div>
              
              {/* Continue indicator */}
              <div className="mt-2 pt-2 border-t border-dashed border-primary/20 w-full text-center">
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                  <AnimatedMoney size="small" />
                  <span>E continua infinitamente...</span>
                  <AnimatedMoney size="small" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Commission flow visualization */}
          <div className="bg-card p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-xs flex items-center gap-2 mb-2">
              <Coins className="w-3 h-3 text-yellow-500" />
              Fluxo de comissões (2 níveis por pessoa):
            </h4>
            <div className="grid grid-cols-1 gap-1 text-[9px]">
              {commissionRelationships.map((rel, idx) => (
                <CommissionArrow key={idx} {...rel} />
              ))}
            </div>
          </div>
          
          {/* Summary box */}
          <div className="bg-card p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-xs flex items-center gap-2 mb-2">
              <Coins className="w-3 h-3 text-yellow-500" />
              Resumo - Cada pessoa ganha:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-2 bg-green-500/10 rounded px-2 py-1.5 border border-green-500/30">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div>
                  <strong className="text-green-500">Direto (1º nível):</strong>
                  <span className="text-green-500 font-bold ml-1">R$1,00</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/10 rounded px-2 py-1.5 border border-yellow-500/30">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <div>
                  <strong className="text-yellow-500">Indireto (2º nível):</strong>
                  <span className="text-yellow-500 font-bold ml-1">R$0,50</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Example calculation */}
          <div className="bg-gradient-to-r from-green-500/10 to-yellow-500/10 p-3 rounded-lg border border-green-500/30">
            <div className="text-[10px] text-center space-y-1">
              <div className="font-semibold text-muted-foreground">Exemplo: Se cada pessoa indicar apenas 2 pessoas...</div>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span className="text-green-500 font-bold">2 × R$1</span>
                <span className="text-muted-foreground">(seus 2 diretos)</span>
                <span>+</span>
                <span className="text-yellow-500 font-bold">4 × R$0,50</span>
                <span className="text-muted-foreground">(seus 4 indiretos)</span>
              </div>
              <div className="text-green-500 font-bold text-sm">= R$4,00 só da sua rede de 6 pessoas! 🌳</div>
              <div className="text-[9px] text-muted-foreground mt-1">
                E cada um desses 6 também ganha de seus 2 níveis, perpetuando infinitamente!
              </div>
            </div>
          </div>
          
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30 text-center">
            <p className="text-[10px] text-primary font-bold flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" />
              Sistema de 2 níveis que se perpetua infinitamente!
              <Sparkles className="w-3 h-3 animate-pulse" />
            </p>
          </div>
        </div>

        <style>{`
          @keyframes coin-fly {
            0% { opacity: 1; transform: translate(0, 0) scale(1); }
            100% { opacity: 0; transform: translate(var(--tx, 10px), var(--ty, -15px)) scale(0.4); }
          }
          @keyframes coin-slide {
            0% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(20px); }
          }
          @keyframes coin-bounce {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(10deg); }
          }
          @keyframes pulse-scale {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes glow-pulse {
            0%, 100% { box-shadow: 0 0 3px hsl(var(--primary) / 0.3); }
            50% { box-shadow: 0 0 10px hsl(var(--primary) / 0.6); }
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
