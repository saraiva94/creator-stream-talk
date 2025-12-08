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
      className={`flex items-center gap-1 ${classes.bg} rounded-full px-2.5 py-1.5 border-2 ${classes.border} ${isYou ? "animate-glow-pulse" : ""} relative z-10`}
    >
      {isYou ? (
        <User className={`w-3.5 h-3.5 ${classes.text} animate-bounce-slow`} />
      ) : (
        <Users className={`w-3.5 h-3.5 ${classes.text}`} />
      )}
      <span className={`text-[11px] font-bold ${classes.text}`}>
        {isYou ? "VOCÊ" : `${level}º`}
      </span>
    </div>
  );
};

export const HowToMonetizeDialog = () => {
  const { t } = useLanguage();

  // Layout: each row is 52px height, badge center at x=70
  const rowHeight = 52;
  const badgeCenterX = 70;
  const badgeRadius = 18;
  
  // Y positions for each level (0=VOCÊ, 1-6=levels)
  const getY = (level: number) => 26 + level * rowHeight;

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
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30">
            <p className="text-muted-foreground text-xs text-center">
              <strong className="text-primary">Lógica de 2 níveis:</strong> Você ganha <span className="text-green-500 font-bold">R$1</span> de quem você indica (direto) 
              e <span className="text-yellow-500 font-bold">R$0,50</span> de quem seu indicado indica (neto).
            </p>
          </div>
          
          {/* Visual diagram with animated connections */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-3 border border-primary/20 relative overflow-hidden">
            <Sparkles className="absolute top-1 right-1 w-3 h-3 text-primary/30 animate-pulse" />
            
            {/* SVG overlay for connection lines */}
            <svg 
              className="absolute top-3 left-3 pointer-events-none" 
              width="140" 
              height={7 * rowHeight}
              style={{ zIndex: 1 }}
            >
              <defs>
                <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#22c55e" />
                </marker>
                <marker id="arrowYellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#eab308" />
                </marker>
              </defs>
              
              {/* Direct connections (green) - from level N to level N-1 */}
              {[1, 2, 3, 4, 5, 6].map((level) => {
                const fromY = getY(level);
                const toY = getY(level - 1);
                const curveX = badgeCenterX - 35;
                
                return (
                  <g key={`direct-${level}`}>
                    <path
                      d={`M ${badgeCenterX - badgeRadius} ${fromY} 
                          Q ${curveX} ${(fromY + toY) / 2} 
                          ${badgeCenterX - badgeRadius} ${toY}`}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                      markerEnd="url(#arrowGreen)"
                      className="animate-dash"
                      opacity="0.8"
                    />
                    {/* Flowing coin */}
                    <circle r="4" fill="#22c55e" opacity="0.9">
                      <animateMotion
                        dur="1.5s"
                        repeatCount="indefinite"
                        begin={`${level * 0.15}s`}
                        path={`M ${badgeCenterX - badgeRadius} ${fromY} 
                              Q ${curveX} ${(fromY + toY) / 2} 
                              ${badgeCenterX - badgeRadius} ${toY}`}
                      />
                    </circle>
                    {/* Amount label */}
                    <text
                      x={curveX - 8}
                      y={(fromY + toY) / 2 + 3}
                      fontSize="8"
                      fill="#22c55e"
                      fontWeight="bold"
                    >
                      R$1
                    </text>
                  </g>
                );
              })}
              
              {/* Indirect connections (yellow) - from level N to level N-2 */}
              {[2, 3, 4, 5, 6].map((level) => {
                const fromY = getY(level);
                const toY = getY(level - 2);
                const curveX = badgeCenterX - 55;
                
                return (
                  <g key={`indirect-${level}`}>
                    <path
                      d={`M ${badgeCenterX - badgeRadius - 5} ${fromY - 5} 
                          Q ${curveX} ${(fromY + toY) / 2} 
                          ${badgeCenterX - badgeRadius - 5} ${toY + 5}`}
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      markerEnd="url(#arrowYellow)"
                      className="animate-dash-slow"
                      opacity="0.7"
                    />
                    {/* Flowing coin */}
                    <circle r="3" fill="#eab308" opacity="0.8">
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        begin={`${level * 0.2 + 0.5}s`}
                        path={`M ${badgeCenterX - badgeRadius - 5} ${fromY - 5} 
                              Q ${curveX} ${(fromY + toY) / 2} 
                              ${badgeCenterX - badgeRadius - 5} ${toY + 5}`}
                      />
                    </circle>
                    {/* Amount label */}
                    <text
                      x={curveX - 16}
                      y={(fromY + toY) / 2 + 3}
                      fontSize="7"
                      fill="#eab308"
                      fontWeight="bold"
                    >
                      R$0,50
                    </text>
                  </g>
                );
              })}
            </svg>
            
            <div className="flex flex-col items-start pl-12 relative z-10" style={{ gap: `${rowHeight - 32}px` }}>
              {/* VOCÊ */}
              <div className="flex items-center gap-3" style={{ height: '32px' }}>
                <LevelBadge level={0} color="primary" isYou />
                <div className="flex flex-col gap-0.5 bg-background/90 rounded px-2 py-1 border border-primary/20">
                  <span className="text-[8px] text-green-500 font-bold">← R$1 do 1º</span>
                  <span className="text-[8px] text-yellow-500 font-bold">← R$0,50 do 2º</span>
                </div>
              </div>
              
              {/* Level 1 */}
              <div className="flex items-center gap-3" style={{ height: '32px' }}>
                <LevelBadge level={1} color="green" />
                <div className="flex flex-col gap-0.5 bg-background/90 rounded px-2 py-1 border border-green-500/20">
                  <span className="text-[8px] text-green-500 font-bold">← R$1 do 2º</span>
                  <span className="text-[8px] text-yellow-500 font-bold">← R$0,50 do 3º</span>
                </div>
              </div>
              
              {/* Level 2 */}
              <div className="flex items-center gap-3" style={{ height: '32px' }}>
                <LevelBadge level={2} color="yellow" />
                <div className="flex flex-col gap-0.5 bg-background/90 rounded px-2 py-1 border border-yellow-500/20">
                  <span className="text-[8px] text-green-500 font-bold">← R$1 do 3º</span>
                  <span className="text-[8px] text-yellow-500 font-bold">← R$0,50 do 4º</span>
                </div>
              </div>
              
              {/* Level 3 */}
              <div className="flex items-center gap-3" style={{ height: '32px' }}>
                <LevelBadge level={3} color="orange" />
                <div className="flex flex-col gap-0.5 bg-background/90 rounded px-2 py-1 border border-orange-500/20">
                  <span className="text-[8px] text-green-500 font-bold">← R$1 do 4º</span>
                  <span className="text-[8px] text-yellow-500 font-bold">← R$0,50 do 5º</span>
                </div>
              </div>
              
              {/* Level 4 */}
              <div className="flex items-center gap-3" style={{ height: '32px' }}>
                <LevelBadge level={4} color="pink" />
                <div className="flex flex-col gap-0.5 bg-background/90 rounded px-2 py-1 border border-pink-500/20">
                  <span className="text-[8px] text-green-500 font-bold">← R$1 do 5º</span>
                  <span className="text-[8px] text-yellow-500 font-bold">← R$0,50 do 6º</span>
                </div>
              </div>
              
              {/* Level 5 */}
              <div className="flex items-center gap-3" style={{ height: '32px' }}>
                <LevelBadge level={5} color="cyan" />
                <div className="flex flex-col gap-0.5 bg-background/90 rounded px-2 py-1 border border-cyan-500/20">
                  <span className="text-[8px] text-green-500 font-bold">← R$1 do 6º</span>
                  <span className="text-[8px] text-yellow-500 font-bold">← R$0,50 do 7º</span>
                </div>
              </div>
              
              {/* Level 6 */}
              <div className="flex items-center gap-3" style={{ height: '32px' }}>
                <LevelBadge level={6} color="purple" />
                <div className="flex flex-col gap-0.5 bg-background/90 rounded px-2 py-1 border border-purple-500/20">
                  <span className="text-[8px] text-green-500 font-bold">← R$1 do 7º</span>
                  <span className="text-[8px] text-yellow-500 font-bold">← R$0,50 do 8º</span>
                </div>
              </div>
            </div>
            
            {/* Continue indicator */}
            <div className="mt-3 pt-2 border-t border-dashed border-primary/20 text-center relative z-10">
              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <AnimatedMoney size="small" />
                <span>E continua infinitamente...</span>
                <AnimatedMoney size="small" />
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="bg-card p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-xs flex items-center gap-2 mb-2">
              <Coins className="w-3 h-3 text-yellow-500" />
              Cada pessoa ganha apenas de 2 níveis:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-2 bg-green-500/10 rounded px-2 py-1.5 border border-green-500/30">
                <div className="w-6 h-1 bg-green-500 rounded" />
                <div>
                  <strong className="text-green-500">Direto:</strong>
                  <span className="text-green-500 font-bold ml-1">R$1,00</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/10 rounded px-2 py-1.5 border border-yellow-500/30">
                <div className="w-6 h-1 bg-yellow-500 rounded" />
                <div>
                  <strong className="text-yellow-500">Indireto:</strong>
                  <span className="text-yellow-500 font-bold ml-1">R$0,50</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Example calculation */}
          <div className="bg-gradient-to-r from-green-500/10 to-yellow-500/10 p-3 rounded-lg border border-green-500/30">
            <div className="text-[10px] text-center space-y-1">
              <div className="font-semibold text-muted-foreground">Exemplo: Se cada pessoa indicar 2 pessoas...</div>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span className="text-green-500 font-bold">2 × R$1</span>
                <span>+</span>
                <span className="text-yellow-500 font-bold">4 × R$0,50</span>
                <span>=</span>
                <span className="text-primary font-bold">R$4,00</span>
              </div>
              <div className="text-[9px] text-muted-foreground">
                Cada pessoa na rede também ganha de seus 2 níveis!
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
            100% { opacity: 0; transform: translate(10px, -15px) scale(0.4); }
          }
          @keyframes coin-bounce {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(10deg); }
          }
          @keyframes dash {
            to { stroke-dashoffset: -18; }
          }
          @keyframes dash-slow {
            to { stroke-dashoffset: -16; }
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
          .animate-dash { animation: dash 1s linear infinite; }
          .animate-dash-slow { animation: dash-slow 1.5s linear infinite; }
          .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
          .animate-border-glow { animation: border-glow 2s ease-in-out infinite; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default HowToMonetizeDialog;
