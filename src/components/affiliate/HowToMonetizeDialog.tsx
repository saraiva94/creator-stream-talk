import { useState, useEffect, useRef } from "react";
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

// Animated connection line with flowing coins
const ConnectionLine = ({ 
  type, 
  color, 
  delay = 0,
  amount 
}: { 
  type: "direct" | "indirect";
  color: string;
  delay?: number;
  amount: string;
}) => {
  const isDirect = type === "direct";
  const lineColor = isDirect ? "#22c55e" : "#eab308"; // green-500 : yellow-500
  
  return (
    <div className="relative" style={{ animationDelay: `${delay}ms` }}>
      <svg 
        width={isDirect ? "30" : "60"} 
        height="24" 
        className="overflow-visible"
        style={{ transform: isDirect ? 'none' : 'translateX(-15px)' }}
      >
        {/* Line path */}
        <path
          d={isDirect 
            ? "M 0 20 Q 15 10 30 0" 
            : "M 0 20 Q 30 -5 60 -20"
          }
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeDasharray="4 2"
          className="animate-dash"
          opacity="0.6"
        />
        
        {/* Flowing coin */}
        <circle r="4" fill={lineColor} className="animate-flow-coin" style={{ animationDelay: `${delay}ms` }}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={isDirect 
              ? "M 0 20 Q 15 10 30 0" 
              : "M 0 20 Q 30 -5 60 -20"
            }
          />
        </circle>
        
        {/* Coin emoji following path */}
        <text fontSize="8" className="animate-flow-coin" style={{ animationDelay: `${delay + 200}ms` }}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={isDirect 
              ? "M 0 20 Q 15 10 30 0" 
              : "M 0 20 Q 30 -5 60 -20"
            }
          >
          </animateMotion>
          🪙
        </text>
      </svg>
      
      {/* Amount badge */}
      <span 
        className={`absolute text-[8px] font-bold px-1 py-0.5 rounded ${
          isDirect ? 'bg-green-500' : 'bg-yellow-500'
        } text-white animate-pulse-scale`}
        style={{
          top: isDirect ? '-2px' : '-14px',
          right: isDirect ? '-8px' : '-20px',
        }}
      >
        {amount}
      </span>
    </div>
  );
};

// Visual level row with connections
const LevelRow = ({
  level,
  color,
  isYou = false,
  showDirectLine = false,
  showIndirectLine = false,
  directAmount = "R$1",
  indirectAmount = "R$0,50",
  directTo = "",
  indirectTo = "",
}: {
  level: number;
  color: string;
  isYou?: boolean;
  showDirectLine?: boolean;
  showIndirectLine?: boolean;
  directAmount?: string;
  indirectAmount?: string;
  directTo?: string;
  indirectTo?: string;
}) => {
  return (
    <div className="flex items-center gap-2 relative">
      <LevelBadge level={level} color={color} isYou={isYou} />
      
      <div className="flex flex-col gap-1">
        {showDirectLine && (
          <div className="flex items-center gap-1">
            <ConnectionLine type="direct" color="green" amount={directAmount} delay={0} />
            <span className="text-[8px] text-green-500 ml-6">→ {directTo}</span>
          </div>
        )}
        {showIndirectLine && (
          <div className="flex items-center gap-1">
            <ConnectionLine type="indirect" color="yellow" amount={indirectAmount} delay={300} />
            <span className="text-[8px] text-yellow-500 ml-10">→ {indirectTo}</span>
          </div>
        )}
      </div>
    </div>
  );
};

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
              <br />Cada pessoa na rede funciona da mesma forma!
            </p>
          </div>
          
          {/* Visual diagram with animated connections */}
          <div className="bg-gradient-to-br from-background to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
            <Sparkles className="absolute top-1 right-1 w-3 h-3 text-primary/30 animate-pulse" />
            
            {/* SVG for long connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
              <defs>
                <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="yellowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#eab308" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#eab308" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              
              {/* Direct connection lines (each level to the one above) */}
              {[1, 2, 3, 4, 5, 6].map((level, idx) => (
                <g key={`direct-${level}`}>
                  <path
                    d={`M 55 ${65 + idx * 58} Q 35 ${45 + idx * 58} 55 ${35 + idx * 58}`}
                    fill="none"
                    stroke="url(#greenGrad)"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    className="animate-dash"
                  />
                  <circle r="3" fill="#22c55e">
                    <animateMotion
                      dur="1.2s"
                      repeatCount="indefinite"
                      begin={`${idx * 0.2}s`}
                      path={`M 55 ${65 + idx * 58} Q 35 ${45 + idx * 58} 55 ${35 + idx * 58}`}
                    />
                  </circle>
                </g>
              ))}
              
              {/* Indirect connection lines (each level to two above) */}
              {[2, 3, 4, 5, 6].map((level, idx) => (
                <g key={`indirect-${level}`}>
                  <path
                    d={`M 55 ${123 + idx * 58} Q 20 ${75 + idx * 58} 55 ${35 + idx * 58}`}
                    fill="none"
                    stroke="url(#yellowGrad)"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    className="animate-dash-slow"
                  />
                  <circle r="2.5" fill="#eab308">
                    <animateMotion
                      dur="1.8s"
                      repeatCount="indefinite"
                      begin={`${idx * 0.3 + 0.5}s`}
                      path={`M 55 ${123 + idx * 58} Q 20 ${75 + idx * 58} 55 ${35 + idx * 58}`}
                    />
                  </circle>
                </g>
              ))}
            </svg>
            
            <div className="flex flex-col items-center space-y-3 relative z-10">
              {/* VOCÊ */}
              <div className="flex items-center gap-3">
                <LevelBadge level={0} color="primary" isYou />
                <div className="flex flex-col gap-0.5 bg-background/80 rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 1º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 2º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                <span className="w-4 h-0.5 bg-primary/30" />
                indica
                <span className="w-4 h-0.5 bg-primary/30" />
              </div>
              
              {/* Level 1 */}
              <div className="flex items-center gap-3">
                <LevelBadge level={1} color="green" />
                <div className="flex flex-col gap-0.5 bg-background/80 rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 2º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 3º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                <span className="w-4 h-0.5 bg-green-500/30" />
                indica
                <span className="w-4 h-0.5 bg-green-500/30" />
              </div>
              
              {/* Level 2 */}
              <div className="flex items-center gap-3">
                <LevelBadge level={2} color="yellow" />
                <div className="flex flex-col gap-0.5 bg-background/80 rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 3º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 4º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                <span className="w-4 h-0.5 bg-yellow-500/30" />
                indica
                <span className="w-4 h-0.5 bg-yellow-500/30" />
              </div>
              
              {/* Level 3 */}
              <div className="flex items-center gap-3">
                <LevelBadge level={3} color="orange" />
                <div className="flex flex-col gap-0.5 bg-background/80 rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 4º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 5º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                <span className="w-4 h-0.5 bg-orange-500/30" />
                indica
                <span className="w-4 h-0.5 bg-orange-500/30" />
              </div>
              
              {/* Level 4 */}
              <div className="flex items-center gap-3">
                <LevelBadge level={4} color="pink" />
                <div className="flex flex-col gap-0.5 bg-background/80 rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 5º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 6º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                <span className="w-4 h-0.5 bg-pink-500/30" />
                indica
                <span className="w-4 h-0.5 bg-pink-500/30" />
              </div>
              
              {/* Level 5 */}
              <div className="flex items-center gap-3">
                <LevelBadge level={5} color="cyan" />
                <div className="flex flex-col gap-0.5 bg-background/80 rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 6º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-yellow-500 font-bold">+R$0,50 do 7º</span>
                  </div>
                </div>
              </div>
              
              <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                <span className="w-4 h-0.5 bg-cyan-500/30" />
                indica
                <span className="w-4 h-0.5 bg-cyan-500/30" />
              </div>
              
              {/* Level 6 */}
              <div className="flex items-center gap-3">
                <LevelBadge level={6} color="purple" />
                <div className="flex flex-col gap-0.5 bg-background/80 rounded px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[9px] text-green-500 font-bold">+R$1 do 7º</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
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
          
          {/* Legend */}
          <div className="bg-card p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-xs flex items-center gap-2 mb-2">
              <Coins className="w-3 h-3 text-yellow-500" />
              Legenda das conexões:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-2 bg-green-500/10 rounded px-2 py-1.5 border border-green-500/30">
                <div className="flex items-center gap-1">
                  <span className="w-6 h-0.5 bg-green-500 rounded" style={{ borderStyle: 'dashed' }} />
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <strong className="text-green-500">Direto:</strong>
                  <span className="text-green-500 font-bold ml-1">R$1,00</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/10 rounded px-2 py-1.5 border border-yellow-500/30">
                <div className="flex items-center gap-1">
                  <span className="w-6 h-0.5 bg-yellow-500 rounded" style={{ borderStyle: 'dotted' }} />
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                </div>
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
          @keyframes coin-bounce {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(10deg); }
          }
          @keyframes dash {
            to { stroke-dashoffset: -12; }
          }
          @keyframes dash-slow {
            to { stroke-dashoffset: -18; }
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
          .animate-dash { animation: dash 0.8s linear infinite; }
          .animate-dash-slow { animation: dash-slow 1.2s linear infinite; }
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
