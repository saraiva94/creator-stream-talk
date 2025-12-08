import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, User, Users, DollarSign, ArrowDown, Sparkles, Coins } from "lucide-react";
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

// Animated arrow with coin particles
const AnimatedArrowDown = ({ className = "", color = "text-muted-foreground", small = false }: { className?: string; color?: string; small?: boolean }) => {
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
      <ArrowDown className={`${small ? "w-4 h-4" : "w-5 h-5"} ${color} animate-bounce-custom`} />
      {showCoins && (
        <div key={key} className="absolute inset-0 pointer-events-none overflow-visible">
          {[0, 1].map((i) => (
            <span 
              key={i}
              className="absolute text-[8px] opacity-0"
              style={{
                animation: `coin-fly 0.6s ease-out ${i * 80}ms forwards`,
                left: `${40 + i * 10}%`,
                top: '50%',
              }}
            >
              🪙
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Compact level node for 6-level display
const LevelNode = ({ 
  level, 
  color,
  earnings,
  isYou = false 
}: { 
  level: number;
  color: string;
  earnings: { level: number; amount: string; color: string }[];
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
    <div className="flex items-center gap-2">
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
      
      {/* Earnings badges */}
      <div className="flex items-center gap-1">
        {earnings.map((e, idx) => (
          <div key={idx} className="flex items-center gap-0.5">
            <AnimatedMoney size="small" />
            <span 
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                e.color === "green" ? "bg-green-500 text-white" : "bg-yellow-500 text-white"
              } animate-pulse-scale`}
            >
              +{e.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const HowToMonetizeDialog = () => {
  const { t } = useLanguage();

  // 6 levels with their earnings breakdown
  const levels = [
    { level: 1, color: "green", description: "Seu link traz", earnings: [{ level: 1, amount: "R$1", color: "green" }] },
    { level: 2, color: "yellow", description: "Que indica", earnings: [{ level: 2, amount: "R$0,50", color: "yellow" }] },
    { level: 3, color: "orange", description: "Que indica", earnings: [{ level: 3, amount: "R$0,50", color: "yellow" }] },
    { level: 4, color: "pink", description: "Que indica", earnings: [{ level: 4, amount: "R$0,50", color: "yellow" }] },
    { level: 5, color: "cyan", description: "Que indica", earnings: [{ level: 5, amount: "R$0,50", color: "yellow" }] },
    { level: 6, color: "purple", description: "Que indica", earnings: [{ level: 6, amount: "R$0,50", color: "yellow" }] },
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary animate-bounce-slow" />
            {t.affiliate?.howToMonetizeTitle || "Como funciona a monetização?"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-2">
          <p className="text-muted-foreground text-xs">
            Ganhe comissões ilimitadas em até 6 níveis! Veja quanto você ganha de cada pessoa na sua rede:
          </p>
          
          {/* 6-Level visualization */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-3 border border-primary/20 relative overflow-hidden">
            <Sparkles className="absolute top-1 right-1 w-3 h-3 text-primary/30 animate-pulse" />
            
            <div className="flex flex-col items-center space-y-1">
              {/* You */}
              <LevelNode level={0} color="primary" earnings={[]} isYou />
              
              {levels.map((lvl, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <AnimatedArrowDown color={`text-${lvl.color}-500/60`} small className="my-0.5" />
                  <div className="text-[8px] text-muted-foreground mb-0.5">{lvl.description}</div>
                  <LevelNode level={lvl.level} color={lvl.color} earnings={lvl.earnings} />
                </div>
              ))}
              
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
          
          {/* Detailed breakdown */}
          <div className="bg-card p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-xs flex items-center gap-2 mb-2">
              <Coins className="w-3 h-3 text-yellow-500" />
              Seus ganhos por cada indicação:
            </h4>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex items-center gap-1 bg-green-500/10 rounded px-2 py-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <strong className="text-green-500">1º Nível:</strong>
                <span className="text-green-500 font-bold">R$1,00</span>
              </div>
              <div className="flex items-center gap-1 bg-yellow-500/10 rounded px-2 py-1">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                <strong className="text-yellow-500">2º Nível:</strong>
                <span className="text-yellow-500 font-bold">R$0,50</span>
              </div>
              <div className="flex items-center gap-1 bg-orange-500/10 rounded px-2 py-1">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                <strong className="text-orange-500">3º Nível:</strong>
                <span className="text-orange-500 font-bold">R$0,50</span>
              </div>
              <div className="flex items-center gap-1 bg-pink-500/10 rounded px-2 py-1">
                <span className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
                <strong className="text-pink-500">4º Nível:</strong>
                <span className="text-pink-500 font-bold">R$0,50</span>
              </div>
              <div className="flex items-center gap-1 bg-cyan-500/10 rounded px-2 py-1">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                <strong className="text-cyan-500">5º Nível:</strong>
                <span className="text-cyan-500 font-bold">R$0,50</span>
              </div>
              <div className="flex items-center gap-1 bg-purple-500/10 rounded px-2 py-1">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                <strong className="text-purple-500">6º Nível+:</strong>
                <span className="text-purple-500 font-bold">R$0,50</span>
              </div>
            </div>
          </div>
          
          {/* Example calculation */}
          <div className="bg-gradient-to-r from-green-500/10 to-yellow-500/10 p-3 rounded-lg border border-green-500/30">
            <div className="text-[10px] text-center space-y-1">
              <div className="font-semibold text-muted-foreground">Exemplo: Se cada pessoa indicar apenas 2 pessoas...</div>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span className="text-green-500 font-bold">2 × R$1</span>
                <span>+</span>
                <span className="text-yellow-500 font-bold">4 × R$0,50</span>
                <span>+</span>
                <span className="text-orange-500 font-bold">8 × R$0,50</span>
                <span>+</span>
                <span className="text-pink-500 font-bold">16 × R$0,50</span>
                <span>+ ...</span>
              </div>
              <div className="text-green-500 font-bold text-sm">= R$16,00+ de uma só árvore! 🌳</div>
            </div>
          </div>
          
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30 text-center">
            <p className="text-[10px] text-primary font-bold flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" />
              Quanto mais sua rede cresce, mais você ganha!
              <Sparkles className="w-3 h-3 animate-pulse" />
            </p>
          </div>
        </div>

        <style>{`
          @keyframes money-burst {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-20px) scale(0.5); }
          }
          @keyframes coin-fly {
            0% { opacity: 1; transform: translate(0, 0) scale(1); }
            100% { opacity: 0; transform: translate(var(--tx, 10px), var(--ty, -15px)) scale(0.4); }
          }
          @keyframes coin-bounce {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(10deg); }
          }
          @keyframes bounce-custom {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
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
