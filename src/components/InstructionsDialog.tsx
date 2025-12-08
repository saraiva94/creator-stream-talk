import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { HelpCircle, Eye, Video, Coins, Users, Gift, DollarSign, ArrowRight, Wallet, Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

// Animated pie chart for revenue split
const AnimatedPieChart = ({ creatorPercent = 80, platformPercent = 20 }: { creatorPercent?: number; platformPercent?: number }) => {
  const [animate, setAnimate] = useState(false);
  
  useEffect(() => {
    const timeout = setTimeout(() => setAnimate(true), 300);
    return () => clearTimeout(timeout);
  }, []);

  const creatorDeg = (creatorPercent / 100) * 360;
  
  return (
    <div className="relative w-24 h-24 mx-auto">
      <div 
        className="w-full h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          background: animate 
            ? `conic-gradient(#22c55e 0deg ${creatorDeg}deg, hsl(var(--primary)) ${creatorDeg}deg 360deg)`
            : `conic-gradient(transparent 0deg 360deg)`,
          boxShadow: animate ? '0 0 20px rgba(34, 197, 94, 0.3)' : 'none',
        }}
      />
      <div className="absolute inset-2 bg-background rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-green-500">{creatorPercent}%</span>
      </div>
      {/* Legend */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 text-xs whitespace-nowrap">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          Você
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-primary rounded-full" />
          Plataforma
        </span>
      </div>
    </div>
  );
};

// Money flow animation
const MoneyFlowAnimation = () => {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 4);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {/* Viewer */}
      <div className={`flex flex-col items-center transition-all duration-300 ${step >= 0 ? 'opacity-100 scale-100' : 'opacity-50 scale-95'}`}>
        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center border-2 border-blue-500">
          <Eye className="w-5 h-5 text-blue-500" />
        </div>
        <span className="text-[10px] mt-1 text-muted-foreground">Espectador</span>
      </div>
      
      {/* Arrow 1 */}
      <div className={`flex items-center transition-all duration-300 ${step >= 1 ? 'opacity-100' : 'opacity-30'}`}>
        <div className="flex items-center gap-0.5">
          <Coins className={`w-4 h-4 text-yellow-500 ${step === 1 ? 'animate-bounce' : ''}`} />
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* Platform */}
      <div className={`flex flex-col items-center transition-all duration-300 ${step >= 2 ? 'opacity-100 scale-100' : 'opacity-50 scale-95'}`}>
        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center border-2 border-primary relative">
          <Video className="w-5 h-5 text-primary" />
          {step === 2 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center animate-ping">
              <span className="text-[8px] font-bold text-black">$</span>
            </div>
          )}
        </div>
        <span className="text-[10px] mt-1 text-muted-foreground">Plataforma</span>
      </div>
      
      {/* Arrow 2 with split */}
      <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${step >= 3 ? 'opacity-100' : 'opacity-30'}`}>
        <div className="flex items-center">
          <ArrowRight className="w-4 h-4 text-green-500" />
          <span className="text-[10px] font-bold text-green-500">80%</span>
        </div>
      </div>
      
      {/* Creator */}
      <div className={`flex flex-col items-center transition-all duration-300 ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-50 scale-95'}`}>
        <div className={`w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 ${step === 3 ? 'animate-pulse' : ''}`}>
          <Wallet className="w-5 h-5 text-green-500" />
        </div>
        <span className="text-[10px] mt-1 text-green-500 font-semibold">Você</span>
      </div>
    </div>
  );
};

// SuperChat visual explanation - showing NET values only
const SuperChatVisual = () => {
  const [activeTier, setActiveTier] = useState(0);
  const [showCoins, setShowCoins] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTier(prev => (prev + 1) % 3);
      setShowCoins(true);
      setTimeout(() => setShowCoins(false), 800);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // NET values only (80% of gross)
  const tiers = [
    { color: 'bg-blue-500', border: 'border-blue-500', netAmount: 'R$2,40', time: '60s' },
    { color: 'bg-yellow-500', border: 'border-yellow-500', netAmount: 'R$4,00', time: '120s' },
    { color: 'bg-red-500', border: 'border-red-500', netAmount: 'R$6,40', time: '180s' },
  ];

  return (
    <div className="flex justify-center gap-3 py-3">
      {tiers.map((tier, i) => (
        <div
          key={i}
          className={`flex flex-col items-center p-2 rounded-lg transition-all duration-500 relative ${
            activeTier === i ? `${tier.color}/20 border-2 ${tier.border} scale-110` : 'bg-muted/30 border border-transparent scale-100'
          }`}
        >
          <div className={`w-8 h-8 ${tier.color} rounded-full flex items-center justify-center mb-1 ${activeTier === i ? 'animate-pulse' : ''}`}>
            <Gift className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] text-muted-foreground">{tier.time}</span>
          <div className={`mt-1 flex items-center gap-1 ${activeTier === i ? 'text-green-500' : 'text-muted-foreground'} transition-colors`}>
            <Coins className={`w-3 h-3 ${activeTier === i ? 'animate-bounce' : ''}`} />
            <span className="text-xs font-bold">{tier.netAmount}</span>
          </div>
          {activeTier === i && showCoins && (
            <div className="absolute inset-0 pointer-events-none overflow-visible flex items-center justify-center">
              {[0, 1, 2].map((j) => (
                <span 
                  key={j}
                  className="absolute text-xs opacity-0"
                  style={{
                    animation: `coin-burst 0.8s ease-out ${j * 100}ms forwards`,
                  }}
                >
                  🪙
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Earnings calculator visual
const EarningsCalculator = () => {
  const [viewers, setViewers] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [credits, setCredits] = useState(0);
  const [earnings, setEarnings] = useState(0);

  useEffect(() => {
    // Animate counting up
    const duration = 2000;
    const steps = 50;
    const interval = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      
      setViewers(Math.round(100 * progress));
      setMinutes(Math.round(30 * progress));
      setCredits(Math.round(18000 * progress));
      setEarnings(Math.round(400 * progress));
      
      if (step >= steps) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-primary/10 rounded-lg p-4 border border-green-500/30">
      <div className="text-center mb-3">
        <Sparkles className="w-5 h-5 text-yellow-500 mx-auto mb-1 animate-pulse" />
        <span className="text-xs text-muted-foreground">Exemplo de ganhos</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-background/50 rounded-lg p-2">
          <div className="text-2xl font-bold text-blue-500">{viewers}</div>
          <div className="text-[10px] text-muted-foreground">espectadores</div>
        </div>
        <div className="bg-background/50 rounded-lg p-2">
          <div className="text-2xl font-bold text-primary">{minutes}</div>
          <div className="text-[10px] text-muted-foreground">minutos</div>
        </div>
        <div className="bg-background/50 rounded-lg p-2 col-span-2">
          <div className="text-2xl font-bold text-yellow-500">{credits.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">créditos consumidos</div>
        </div>
      </div>
      
      <div className="mt-3 bg-background/50 rounded-lg p-3 border-2 border-green-500">
        <div className="text-2xl font-bold text-green-500 text-center">R${earnings},00</div>
        <div className="text-[10px] text-green-500 font-semibold text-center">receita líquida para saque imediato</div>
      </div>
      
      <p className="text-[10px] text-center text-muted-foreground mt-3">
        💰 18.000 créditos = R$400,00 em receita líquida para saque imediato do criador
      </p>
    </div>
  );
};

export const InstructionsDialog = () => {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/50 hover:border-primary hover:bg-primary/10 group relative overflow-hidden">
          <span className="text-primary font-medium">{t.profile.instructions || "Como funciona"}</span>
          <HelpCircle className="w-4 h-4 text-primary animate-pulse" />
          {/* Animated glow effect */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          {/* Pulsing border glow */}
          <span className="absolute inset-0 rounded-md pointer-events-none" style={{ animation: 'border-glow 2s ease-in-out infinite' }} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary animate-bounce" />
            {t.profile.howItWorks || "How Stream Star Works"}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="viewer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="viewer" className="gap-2">
              <Eye className="w-4 h-4" />
              {t.profile.viewerMode || "Viewer"}
            </TabsTrigger>
            <TabsTrigger value="creator" className="gap-2">
              <Video className="w-4 h-4" />
              {t.profile.creatorMode || "Creator"}
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[55vh] mt-4">
            <TabsContent value="viewer" className="space-y-6 pr-4">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  {t.profile.viewerTitle || "For Viewers"}
                </h3>
                <p className="text-muted-foreground">
                  {t.profile.viewerIntro || "Stream Star is a live streaming platform where you can watch your favorite creators in real-time."}
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  {t.profile.creditsTitle || "Credits System"}
                </h4>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>{t.profile.creditsDesc1 || "Purchase credits to watch live streams"}</li>
                  <li>{t.profile.creditsDesc2 || "Credits are consumed while watching (6 credits/minute)"}</li>
                  <li>{t.profile.creditsDesc3 || "Available packages: 180 credits (R$5) for 30min or 360 credits (R$9) for 1h"}</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-accent" />
                  {t.profile.superchatTitle || "SuperChats"}
                </h4>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>{t.profile.superchatDesc1 || "Send highlighted messages during live streams"}</li>
                  <li>{t.profile.superchatDesc2 || "Three tiers available: R$3 (Blue), R$5 (Yellow), R$8 (Red)"}</li>
                  <li>{t.profile.superchatDesc3 || "Your message stays pinned for 60-180 seconds depending on tier"}</li>
                </ul>
              </section>

              <section className="space-y-3 bg-card p-4 rounded-lg border border-primary/20">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {t.profile.affiliateTitle || "Earn with Referrals!"}
                </h4>
                <p className="text-muted-foreground">
                  {t.profile.affiliateViewerDesc || "Even as a viewer, you can earn money! Share your referral link with friends:"}
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-green-500">R$1,00</strong> {t.profile.affiliateDirectDesc || "for each friend who signs up using your link"}</li>
                  <li><strong className="text-yellow-500">R$0,50</strong> {t.profile.affiliateIndirectDesc || "for each person your friends refer (second level)"}</li>
                </ul>
                <p className="text-sm text-primary">
                  {t.profile.affiliateAccess || "Access your referral link in the Affiliate section!"}
                </p>
              </section>
            </TabsContent>

            <TabsContent value="creator" className="space-y-6 pr-4">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" />
                  {t.profile.creatorTitle || "For Creators"}
                </h3>
                <p className="text-muted-foreground">
                  {t.profile.creatorIntro || "Stream Star offers multiple ways to monetize your content!"}
                </p>
              </section>

              {/* Visual revenue flow */}
              <section className="space-y-4 bg-gradient-to-br from-primary/5 to-green-500/5 p-4 rounded-xl border border-primary/20">
                <h4 className="font-semibold flex items-center gap-2 text-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-500 animate-bounce" />
                  Como você ganha com lives
                </h4>
                
                {/* Money flow animation */}
                <MoneyFlowAnimation />
                
                {/* Pie chart */}
                <div className="pt-4 pb-8">
                  <AnimatedPieChart creatorPercent={80} platformPercent={20} />
                </div>
                
                <p className="text-xs text-center text-muted-foreground">
                  Espectadores usam créditos → Você recebe automaticamente na sua carteira
                </p>
              </section>

              {/* Earnings calculator */}
              <EarningsCalculator />

              {/* SuperChat visual */}
              <section className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-accent animate-pulse" />
                  SuperChats - Mensagens Destacadas
                </h4>
                <p className="text-sm text-muted-foreground">
                  Espectadores enviam mensagens especiais e você ganha 80% de cada uma:
                </p>
                <SuperChatVisual />
              </section>

              <section className="space-y-3 bg-card p-4 rounded-lg border border-primary/20">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {t.profile.affiliateCreatorTitle || "Referral Commissions"}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {t.profile.affiliateCreatorDesc || "Build your community and earn extra:"}
                </p>
                <div className="flex justify-center gap-4 py-2">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 mx-auto mb-1">
                      <span className="font-bold text-green-500">R$1</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">direto</span>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center border-2 border-yellow-500 mx-auto mb-1">
                      <span className="font-bold text-yellow-500">R$0,50</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">indireto</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-500" />
                  {t.profile.withdrawalsTitle || "Withdrawals"}
                </h4>
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="px-3 py-2 bg-green-500/20 rounded-lg border border-green-500 text-center">
                    <div className="text-lg font-bold text-green-500">PIX</div>
                    <div className="text-[10px] text-muted-foreground">Instantâneo</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="px-3 py-2 bg-muted rounded-lg text-center">
                    <div className="text-lg">💸</div>
                    <div className="text-[10px] text-muted-foreground">Sua conta</div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-semibold">{t.profile.goLiveTitle || "How to Go Live"}</h4>
                <ol className="list-decimal pl-6 space-y-2 text-muted-foreground text-sm">
                  <li>{t.profile.goLiveStep1 || "Request creator activation on your profile"}</li>
                  <li>{t.profile.goLiveStep2 || "Wait for admin approval"}</li>
                  <li>{t.profile.goLiveStep3 || "Click 'Transmit' in the navbar"}</li>
                  <li>{t.profile.goLiveStep4 || "Configure title, thumbnail, and camera settings"}</li>
                  <li>{t.profile.goLiveStep5 || "Toggle 'Online' to start streaming!"}</li>
                </ol>
              </section>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes coin-burst {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx, 10px), -20px) scale(0.5); }
        }
        @keyframes border-glow {
          0%, 100% { box-shadow: inset 0 0 3px hsl(var(--primary) / 0.3); }
          50% { box-shadow: inset 0 0 8px hsl(var(--primary) / 0.5); }
        }
      `}</style>
    </Dialog>
  );
};
