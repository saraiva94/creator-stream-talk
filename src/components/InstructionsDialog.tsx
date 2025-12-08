import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { HelpCircle, Eye, Video, Coins, Users, Gift, DollarSign } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export const InstructionsDialog = () => {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <HelpCircle className="w-4 h-4" />
          {t.profile.instructions || "How it works"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
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
                  <Coins className="w-4 h-4 text-secondary" />
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
                  <li><strong>R$1.00</strong> {t.profile.affiliateDirectDesc || "for each friend who signs up using your link"}</li>
                  <li><strong>R$0.50</strong> {t.profile.affiliateIndirectDesc || "for each person your friends refer (second level)"}</li>
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

              <section className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  {t.profile.liveRevenueTitle || "Live Stream Revenue"}
                </h4>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>{t.profile.liveRevenueDesc1 || "Viewers consume credits while watching your streams"}</li>
                  <li><strong>80%</strong> {t.profile.liveRevenueDesc2 || "of all revenue goes directly to you"}</li>
                  <li>{t.profile.liveRevenueDesc3 || "Earnings are automatically added to your creator wallet"}</li>
                </ul>
                
                {/* Revenue Example */}
                <div className="mt-4 p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg border border-primary/30">
                  <h5 className="font-semibold text-primary mb-3 flex items-center gap-2">
                    💰 {t.profile.revenueExampleTitle || "Example: How much can you earn?"}
                  </h5>
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p>{t.profile.revenueExampleIntro || "Let's say 100 people watch your live for 30 minutes:"}</p>
                    <ul className="list-none space-y-1 mt-2">
                      <li>👁️ 100 {t.profile.viewers || "viewers"} × 30 min = 3.000 min {t.profile.watched || "watched"}</li>
                      <li>⏱️ 3.000 min × 6 {t.profile.creditsPerMin || "credits/min"} = 18.000 {t.profile.creditsConsumed || "credits consumed"}</li>
                      <li>💵 18.000 {t.profile.credits || "credits"} = R$ 500,00 {t.profile.grossRevenue || "in gross revenue"}</li>
                      <li className="text-lg font-bold text-primary mt-2">
                        🎉 {t.profile.yourEarnings || "Your earnings"}: <span className="text-green-500">R$ 400,00</span> (80%)
                      </li>
                    </ul>
                    <p className="text-xs mt-3 text-muted-foreground/80 italic">
                      {t.profile.revenueExampleNote || "This money goes directly to your creator wallet and you can withdraw via PIX anytime!"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-accent" />
                  {t.profile.superchatRevenueTitle || "SuperChat Revenue"}
                </h4>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>{t.profile.superchatRevenueDesc1 || "Receive highlighted messages from viewers during streams"}</li>
                  <li><strong>80%</strong> {t.profile.superchatRevenueDesc2 || "of each SuperChat goes to you"}</li>
                  <li>{t.profile.superchatRevenueDesc3 || "SuperChats appear pinned and highlighted in your chat"}</li>
                </ul>
              </section>

              <section className="space-y-3 bg-card p-4 rounded-lg border border-primary/20">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {t.profile.affiliateCreatorTitle || "Referral Commissions"}
                </h4>
                <p className="text-muted-foreground">
                  {t.profile.affiliateCreatorDesc || "Build your community and earn extra:"}
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>R$1.00</strong> {t.profile.affiliateCreatorDirect || "for each new user who signs up with your link"}</li>
                  <li><strong>R$0.50</strong> {t.profile.affiliateCreatorIndirect || "for users referred by your referrals (2nd level)"}</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="font-semibold">{t.profile.withdrawalsTitle || "Withdrawals"}</h4>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>{t.profile.withdrawalsDesc1 || "Request withdrawals from your creator wallet anytime"}</li>
                  <li>{t.profile.withdrawalsDesc2 || "Minimum withdrawal: R$10.00"}</li>
                  <li>{t.profile.withdrawalsDesc3 || "Payments processed via PIX (instant and free)"}</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="font-semibold">{t.profile.goLiveTitle || "How to Go Live"}</h4>
                <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
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
    </Dialog>
  );
};
