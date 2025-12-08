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
  };
  
  const classes = colorMap[color] || colorMap.primary;

  return (
    <div 
      className={`flex items-center gap-1.5 ${classes.bg} rounded-full px-3 py-1.5 border-2 ${classes.border} ${isYou ? "animate-glow-pulse" : ""} relative z-10`}
    >
      {isYou ? (
        <User className={`w-4 h-4 ${classes.text} animate-bounce-slow`} />
      ) : (
        <Users className={`w-4 h-4 ${classes.text}`} />
      )}
      <span className={`text-xs font-bold ${classes.text}`}>
        {isYou ? "VOCÊ" : `${level}º`}
      </span>
    </div>
  );
};

// Info box showing earnings
const EarningsBox = ({ 
  directFrom, 
  indirectFrom,
  side 
}: { 
  directFrom: string;
  indirectFrom: string;
  side: "left" | "right";
}) => {
  return (
    <div className={`flex flex-col gap-0.5 bg-background/95 rounded-lg px-2 py-1.5 border border-border/50 shadow-sm ${side === "left" ? "items-end" : "items-start"}`}>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-[9px] text-green-500 font-bold">+R$1 do {directFrom}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do {indirectFrom}</span>
      </div>
    </div>
  );
};

export const HowToMonetizeDialog = () => {
  const { t } = useLanguage();

  // Layout constants
  const rowHeight = 52;
  const centerX = 150;
  const badgeWidth = 40;
  
  // Y position for each level
  const getY = (level: number) => 24 + level * rowHeight;

  // Levels config: 5 levels + VOCÊ
  const levels = [
    { level: 0, color: "primary", isYou: true, direct: "1º", indirect: "2º" },
    { level: 1, color: "green", direct: "2º", indirect: "3º" },
    { level: 2, color: "yellow", direct: "3º", indirect: "4º" },
    { level: 3, color: "orange", direct: "4º", indirect: "5º" },
    { level: 4, color: "pink", direct: "5º", indirect: "6º" },
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
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30">
            <p className="text-muted-foreground text-xs text-center">
              <strong className="text-primary">Lógica de 2 níveis:</strong> Ganhe <span className="text-green-500 font-bold">R$1</span> do direto 
              e <span className="text-yellow-500 font-bold">R$0,50</span> do indireto (neto).
            </p>
          </div>
          
          {/* Visual diagram with animated connections */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
            <Sparkles className="absolute top-2 right-2 w-4 h-4 text-primary/30 animate-pulse" />
            
            {/* SVG for connection lines */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              style={{ zIndex: 1 }}
            >
              <defs>
                <marker id="arrowGreen" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#22c55e" />
                </marker>
                <marker id="arrowYellow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#eab308" />
                </marker>
              </defs>
              
              {/* Direct connections (green) - R$1 - alternating sides */}
              {[1, 2, 3, 4].map((level) => {
                const fromY = getY(level) + 14;
                const toY = getY(level - 1) + 14;
                const isRight = level % 2 === 1;
                
                // Linhas mais contidas
                const offsetX = 55;
                const curveOffset = 25;
                const startX = centerX + (isRight ? badgeWidth : -badgeWidth);
                const endX = centerX + (isRight ? badgeWidth : -badgeWidth);
                const controlX = centerX + (isRight ? offsetX + curveOffset : -(offsetX + curveOffset));
                const labelX = centerX + (isRight ? offsetX + 10 : -(offsetX + 10));
                
                return (
                  <g key={`direct-${level}`}>
                    <path
                      d={`M ${startX} ${fromY} 
                          C ${controlX} ${fromY}, ${controlX} ${toY}, ${endX} ${toY}`}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                      markerEnd="url(#arrowGreen)"
                      className="animate-dash"
                      opacity="0.85"
                    />
                    {/* Flowing coin */}
                    <circle r="4" fill="#22c55e" opacity="0.9">
                      <animateMotion
                        dur="1.2s"
                        repeatCount="indefinite"
                        begin={`${level * 0.2}s`}
                        path={`M ${startX} ${fromY} 
                              C ${controlX} ${fromY}, ${controlX} ${toY}, ${endX} ${toY}`}
                      />
                    </circle>
                    {/* Amount label */}
                    <rect 
                      x={isRight ? labelX - 2 : labelX - 26}
                      y={(fromY + toY) / 2 - 7}
                      width="28"
                      height="13"
                      rx="3"
                      fill="#22c55e"
                      opacity="0.9"
                    />
                    <text
                      x={isRight ? labelX + 12 : labelX - 12}
                      y={(fromY + toY) / 2 + 3}
                      fontSize="8"
                      fill="white"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      R$1
                    </text>
                  </g>
                );
              })}
              
              {/* Indirect connections (yellow) - R$0,50 - opposite side to direct */}
              {[2, 3, 4].map((level) => {
                const fromY = getY(level) + 14;
                const toY = getY(level - 2) + 14;
                const isRight = level % 2 === 0;
                
                // Linhas indiretas mais afastadas
                const offsetX = 80;
                const curveOffset = 35;
                const startX = centerX + (isRight ? badgeWidth + 5 : -(badgeWidth + 5));
                const endX = centerX + (isRight ? badgeWidth + 5 : -(badgeWidth + 5));
                const controlX = centerX + (isRight ? offsetX + curveOffset : -(offsetX + curveOffset));
                const labelX = centerX + (isRight ? offsetX + 20 : -(offsetX + 20));
                
                return (
                  <g key={`indirect-${level}`}>
                    <path
                      d={`M ${startX} ${fromY - 2} 
                          C ${controlX} ${fromY}, ${controlX} ${toY}, ${endX} ${toY + 2}`}
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      markerEnd="url(#arrowYellow)"
                      className="animate-dash-slow"
                      opacity="0.75"
                    />
                    {/* Flowing coin */}
                    <circle r="3" fill="#eab308" opacity="0.85">
                      <animateMotion
                        dur="1.6s"
                        repeatCount="indefinite"
                        begin={`${level * 0.3 + 0.3}s`}
                        path={`M ${startX} ${fromY - 2} 
                              C ${controlX} ${fromY}, ${controlX} ${toY}, ${endX} ${toY + 2}`}
                      />
                    </circle>
                    {/* Amount label */}
                    <rect 
                      x={isRight ? labelX - 5 : labelX - 30}
                      y={(fromY + toY) / 2 - 7}
                      width="35"
                      height="13"
                      rx="3"
                      fill="#eab308"
                      opacity="0.9"
                    />
                    <text
                      x={isRight ? labelX + 12 : labelX - 12}
                      y={(fromY + toY) / 2 + 3}
                      fontSize="7"
                      fill="white"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      R$0,50
                    </text>
                  </g>
                );
              })}
            </svg>
            
            {/* Level badges - centered */}
            <div className="flex flex-col items-center relative z-10" style={{ gap: `${rowHeight - 32}px` }}>
              {levels.map((lvl, idx) => (
                <div key={idx} className="flex items-center justify-center" style={{ height: '32px' }}>
                  <LevelBadge level={lvl.level} color={lvl.color} isYou={lvl.isYou} />
                </div>
              ))}
            </div>
            
            {/* Continue indicator */}
            <div className="mt-4 pt-3 border-t border-dashed border-primary/30 text-center relative z-10">
              <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-2">
                <AnimatedMoney size="small" />
                <span className="font-medium">E continua infinitamente...</span>
                <AnimatedMoney size="small" />
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="bg-card p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-xs flex items-center gap-2 mb-2">
              <Coins className="w-3 h-3 text-yellow-500" />
              Cada pessoa ganha de 2 níveis:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-2 bg-green-500/10 rounded px-2 py-2 border border-green-500/30">
                <div className="w-6 h-1.5 bg-green-500 rounded" />
                <div>
                  <strong className="text-green-500">Direto:</strong>
                  <span className="text-green-500 font-bold ml-1">R$1,00</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/10 rounded px-2 py-2 border border-yellow-500/30">
                <div className="w-6 h-1.5 bg-yellow-500 rounded" />
                <div>
                  <strong className="text-yellow-500">Indireto:</strong>
                  <span className="text-yellow-500 font-bold ml-1">R$0,50</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Example calculation */}
          <div className="bg-gradient-to-r from-green-500/10 to-yellow-500/10 p-3 rounded-lg border border-green-500/30">
            <div className="text-[11px] text-center space-y-1">
              <div className="font-semibold text-muted-foreground">Se cada pessoa indicar 2 pessoas...</div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-green-500 font-bold">2 × R$1</span>
                <span>+</span>
                <span className="text-yellow-500 font-bold">4 × R$0,50</span>
                <span>=</span>
                <span className="text-primary font-bold text-sm">R$4,00</span>
              </div>
              <div className="text-[9px] text-muted-foreground">
                E a rede continua crescendo infinitamente!
              </div>
            </div>
          </div>
          
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30 text-center">
            <p className="text-[11px] text-primary font-bold flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" />
              Sistema de 2 níveis que se perpetua!
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
            0%, 100% { box-shadow: 0 0 4px hsl(var(--primary) / 0.4); }
            50% { box-shadow: 0 0 12px hsl(var(--primary) / 0.7); }
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
