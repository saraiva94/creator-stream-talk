import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, User, Users, DollarSign, ArrowRight, ArrowDown } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

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
            <DollarSign className="w-5 h-5 text-primary" />
            {t.affiliate?.howToMonetizeTitle || "Como funciona a monetização?"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Simple explanation */}
          <p className="text-muted-foreground text-sm">
            {t.affiliate?.monetizationDesc || "Quando você convida alguém usando seu link, você ganha comissão! E se essa pessoa convidar outras, você também ganha uma parte."}
          </p>
          
          {/* Visual illustration */}
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl p-6 border border-primary/20">
            {/* Level 1 - You */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 bg-primary/20 rounded-full px-4 py-2 border-2 border-primary">
                <User className="w-6 h-6 text-primary" />
                <span className="font-bold text-primary">{t.affiliate?.you || "VOCÊ"}</span>
              </div>
              
              <ArrowDown className="w-6 h-6 text-muted-foreground my-2 animate-bounce" />
              
              {/* Your referral link sends */}
              <div className="text-xs text-muted-foreground mb-2 text-center">
                {t.affiliate?.yourLinkBrings || "Seu link traz"}
              </div>
              
              {/* Level 2 - Direct referral */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-green-500/20 rounded-full px-3 py-2 border-2 border-green-500">
                  <User className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-semibold text-green-500">{t.affiliate?.friend || "Amigo"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowRight className="w-4 h-4 text-green-500" />
                  <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                    +R$1,00
                  </div>
                </div>
              </div>
              
              <ArrowDown className="w-5 h-5 text-muted-foreground/50 my-2" />
              
              {/* Friend's link brings */}
              <div className="text-xs text-muted-foreground mb-2 text-center">
                {t.affiliate?.friendBrings || "O link do amigo traz"}
              </div>
              
              {/* Level 3 - Indirect referral */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-yellow-500/20 rounded-full px-3 py-2 border-2 border-yellow-500">
                  <Users className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-semibold text-yellow-500">{t.affiliate?.friendOfFriend || "Amigo do amigo"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowRight className="w-4 h-4 text-yellow-500" />
                  <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                    +R$0,50
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
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <strong className="text-green-500">R$1,00</strong> {t.affiliate?.forEachDirect || "para cada amigo que você indicar diretamente"}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                <strong className="text-yellow-500">R$0,50</strong> {t.affiliate?.forEachIndirect || "para cada pessoa que seu amigo indicar"}
              </li>
            </ul>
          </div>
          
          <p className="text-xs text-muted-foreground text-center italic">
            {t.affiliate?.noLimit || "Sem limite! Quanto mais pessoas na sua rede, mais você ganha."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowToMonetizeDialog;
