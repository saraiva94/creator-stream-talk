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
  isYou = false,
  youLabel = "YOU"
}: { 
  level: number;
  color: string;
  isYou?: boolean;
  youLabel?: string;
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
        {isYou ? youLabel : `${level}º`}
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

  // Layout: 3 horizontal zones
  // Zone 1 (left): 0-90px - left side connections
  // Zone 2 (center): 90-210px - badges
  // Zone 3 (right): 210-300px - right side connections
  
  const svgWidth = 300;
  const rowHeight = 48;
  const leftZoneEnd = 85;
  const centerX = 150;
  const rightZoneStart = 215;
  
  // Y position for each level (centered in row)
  const getY = (level: number) => 20 + level * rowHeight;

  // Levels config: 5 levels
  const levels = [
    { level: 0, color: "primary", isYou: true },
    { level: 1, color: "green" },
    { level: 2, color: "yellow" },
    { level: 3, color: "orange" },
    { level: 4, color: "pink" },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 border-primary/50 hover:border-primary hover:bg-primary/10 group relative overflow-hidden px-3 text-xs whitespace-nowrap"
        >
          <HelpCircle className="w-4 h-4 text-primary animate-pulse flex-shrink-0" />
          <span className="text-primary font-medium">{t.affiliate?.howToMonetize || "Como monetizar"}</span>
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <span className="absolute inset-0 rounded-md animate-border-glow pointer-events-none" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary animate-bounce-slow" />
            {t.affiliate?.howToMonetizeTitle || "Como funciona a monetização?"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-2">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30">
            <p className="text-muted-foreground text-xs text-center">
              <strong className="text-primary">{t.affiliate?.twoLevelLogic || "Lógica de 2 níveis:"}</strong> {t.affiliate?.earnFromDirect || "Ganhe"} <span className="text-green-500 font-bold">R$1</span> {t.affiliate?.fromDirect || "do direto"} 
              {" "}{t.affiliate?.and || "e"} <span className="text-yellow-500 font-bold">R$0,50</span> {t.affiliate?.fromIndirect || "do indireto."}
            </p>
          </div>
          
          {/* Visual diagram with 3-zone layout */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-2 sm:p-3 border border-primary/20 relative overflow-hidden">
            <Sparkles className="absolute top-2 right-2 w-4 h-4 text-primary/30 animate-pulse" />
            
            <div className="relative overflow-hidden" style={{ height: `${levels.length * rowHeight + 20}px`, minWidth: '280px' }}>
              {/* SVG for connection lines - absolutely positioned */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${svgWidth} ${levels.length * rowHeight + 20}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <marker id="arrowGreen" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                    <path d="M0,0 L5,2.5 L0,5 Z" fill="#22c55e" />
                  </marker>
                  <marker id="arrowYellow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                    <path d="M0,0 L5,2.5 L0,5 Z" fill="#eab308" />
                  </marker>
                  <marker id="arrowFlow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="white" />
                  </marker>
                </defs>
                
                {/* Vertical flow arrows between levels: YOU→1º, 1º→2º, 2º→3º, 3º→4º */}
                {[
                  { from: 0, to: 1 },
                  { from: 1, to: 2 },
                  { from: 2, to: 3 },
                  { from: 3, to: 4 },
                ].map(({ from, to }, idx) => {
                  const fromY = getY(from) + 22;
                  const toY = getY(to) - 2;
                  
                  return (
                    <g key={`flow-${from}-${to}`}>
                      {/* Arrow line */}
                      <line
                        x1={centerX}
                        y1={fromY}
                        x2={centerX}
                        y2={toY}
                        stroke="white"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        markerEnd="url(#arrowFlow)"
                        opacity="0.8"
                        className="animate-flow-arrow"
                      />
                      {/* Animated dot flowing down - using animateMotion for proper path following */}
                      <circle r="3" fill="white" opacity="0.9" visibility="hidden">
                        <set attributeName="visibility" to="visible" begin={`${idx * 0.25}s`} />
                        <animateMotion
                          dur="1s"
                          repeatCount="indefinite"
                          begin={`${idx * 0.25}s`}
                        >
                          <mpath xlinkHref={`#flow-path-${from}-${to}`} />
                        </animateMotion>
                      </circle>
                      {/* Hidden path for motion reference */}
                      <path 
                        id={`flow-path-${from}-${to}`}
                        d={`M ${centerX} ${fromY} L ${centerX} ${toY}`}
                        fill="none"
                        stroke="none"
                      />
                    </g>
                  );
                })}
                
                {/* Direct connections (green) - R$1 - alternating LEFT/RIGHT zones */}
                {[1, 2, 3, 4].map((level) => {
                  const fromY = getY(level) + 12;
                  const toY = getY(level - 1) + 12;
                  const isRight = level % 2 === 1;
                  
                  // Completely contained in side zones
                  const startX = isRight ? rightZoneStart : leftZoneEnd;
                  const endX = isRight ? rightZoneStart : leftZoneEnd;
                  const peakX = isRight ? rightZoneStart + 35 : leftZoneEnd - 35;
                  const labelX = isRight ? rightZoneStart + 25 : leftZoneEnd - 25;
                  
                  return (
                    <g key={`direct-${level}`}>
                      <path
                        d={`M ${startX} ${fromY} 
                            Q ${peakX} ${(fromY + toY) / 2} ${endX} ${toY}`}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2"
                        strokeDasharray="5 3"
                        markerEnd="url(#arrowGreen)"
                        className="animate-dash"
                        opacity="0.85"
                      />
                      {/* Flowing coin */}
                      <circle r="4" fill="#22c55e" opacity="0.9" visibility="hidden">
                        <set attributeName="visibility" to="visible" begin={`${level * 0.2}s`} />
                        <animateMotion
                          dur="1.2s"
                          repeatCount="indefinite"
                          begin={`${level * 0.2}s`}
                          path={`M ${startX} ${fromY} Q ${peakX} ${(fromY + toY) / 2} ${endX} ${toY}`}
                        />
                      </circle>
                      {/* Amount label */}
                      <rect 
                        x={labelX - 12}
                        y={(fromY + toY) / 2 - 7}
                        width="24"
                        height="13"
                        rx="3"
                        fill="#22c55e"
                        opacity="0.9"
                      />
                      <text
                        x={labelX}
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
                
                {/* Indirect connections (yellow) - R$0,50 - OPPOSITE zone to direct */}
                {[2, 3, 4].map((level) => {
                  const fromY = getY(level) + 12;
                  const toY = getY(level - 2) + 12;
                  const isRight = level % 2 === 0;
                  
                  // Opposite zone, further out
                  const startX = isRight ? rightZoneStart + 5 : leftZoneEnd - 5;
                  const endX = isRight ? rightZoneStart + 5 : leftZoneEnd - 5;
                  const peakX = isRight ? rightZoneStart + 55 : leftZoneEnd - 55;
                  const labelX = isRight ? rightZoneStart + 42 : leftZoneEnd - 42;
                  
                  return (
                    <g key={`indirect-${level}`}>
                      <path
                        d={`M ${startX} ${fromY} 
                            Q ${peakX} ${(fromY + toY) / 2} ${endX} ${toY}`}
                        fill="none"
                        stroke="#eab308"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        markerEnd="url(#arrowYellow)"
                        className="animate-dash-slow"
                        opacity="0.75"
                      />
                      {/* Flowing coin */}
                      <circle r="3" fill="#eab308" opacity="0.85" visibility="hidden">
                        <set attributeName="visibility" to="visible" begin={`${level * 0.3 + 0.3}s`} />
                        <animateMotion
                          dur="1.6s"
                          repeatCount="indefinite"
                          begin={`${level * 0.3 + 0.3}s`}
                          path={`M ${startX} ${fromY} Q ${peakX} ${(fromY + toY) / 2} ${endX} ${toY}`}
                        />
                      </circle>
                      {/* Amount label */}
                      <rect 
                        x={labelX - 15}
                        y={(fromY + toY) / 2 - 7}
                        width="30"
                        height="13"
                        rx="3"
                        fill="#eab308"
                        opacity="0.9"
                      />
                      <text
                        x={labelX}
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
              
              {/* Level badges - centered in middle zone */}
              <div className="absolute inset-0 flex flex-col items-center justify-start pt-2" style={{ zIndex: 10 }}>
                {levels.map((lvl, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-center"
                    style={{ height: `${rowHeight}px` }}
                  >
                    <LevelBadge level={lvl.level} color={lvl.color} isYou={lvl.isYou} youLabel={t.affiliate?.you || "VOCÊ"} />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Continue indicator */}
            <div className="mt-2 pt-3 border-t border-dashed border-primary/30 text-center relative z-10">
              <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-2">
                <AnimatedMoney size="small" />
                <span className="font-medium">{t.affiliate?.continuesInfinitely || "E continua infinitamente..."}</span>
                <AnimatedMoney size="small" />
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="bg-card p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-xs flex items-center gap-2 mb-2">
              <Coins className="w-3 h-3 text-yellow-500" />
              {t.affiliate?.eachPersonEarns || "Cada pessoa ganha de 2 níveis:"}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-2 bg-green-500/10 rounded px-2 py-2 border border-green-500/30">
                <div className="w-6 h-1.5 bg-green-500 rounded" />
                <div>
                  <strong className="text-green-500">{t.affiliate?.directLabel || "Direto:"}</strong>
                  <span className="text-green-500 font-bold ml-1">R$1,00</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/10 rounded px-2 py-2 border border-yellow-500/30">
                <div className="w-6 h-1.5 bg-yellow-500 rounded" />
                <div>
                  <strong className="text-yellow-500">{t.affiliate?.indirectLabel || "Indireto:"}</strong>
                  <span className="text-yellow-500 font-bold ml-1">R$0,50</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Example calculation */}
          <div className="bg-gradient-to-r from-green-500/10 to-yellow-500/10 p-3 rounded-lg border border-green-500/30">
            <div className="text-[11px] text-center space-y-1">
              <div className="font-semibold text-muted-foreground">{t.affiliate?.ifEachRefers || "Se cada pessoa indicar 2 pessoas..."}</div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-green-500 font-bold">2 × R$1</span>
                <span>+</span>
                <span className="text-yellow-500 font-bold">4 × R$0,50</span>
                <span>=</span>
                <span className="text-primary font-bold text-sm">R$4,00</span>
              </div>
              <div className="text-[9px] text-muted-foreground">
                {t.affiliate?.networkGrows || "E a rede continua crescendo infinitamente!"}
              </div>
            </div>
          </div>
          
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30 text-center">
            <p className="text-[11px] text-primary font-bold flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" />
              {t.affiliate?.perpetualSystem || "Sistema de 2 níveis que se perpetua!"}
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
          @keyframes flow-arrow {
            0% { stroke-dashoffset: 12; }
            100% { stroke-dashoffset: 0; }
          }
          .animate-coin-bounce { animation: coin-bounce 1s ease-in-out infinite; }
          .animate-dash { animation: dash 1s linear infinite; }
          .animate-dash-slow { animation: dash-slow 1.5s linear infinite; }
          .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
          .animate-border-glow { animation: border-glow 2s ease-in-out infinite; }
          .animate-flow-arrow { animation: flow-arrow 0.8s linear infinite; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default HowToMonetizeDialog;
