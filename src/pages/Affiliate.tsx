import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Users, TrendingUp, Link as LinkIcon, Save, Loader2, Copy, Banknote, Wallet, Share2, Globe } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/siteUrl";
import PixWithdrawDialog from "@/components/PixWithdrawDialog";
import InternationalWithdrawDialog from "@/components/InternationalWithdrawDialog";
import ShareDialog from "@/components/ShareDialog";
import { useLanguage } from "@/hooks/useLanguage";
import HowToMonetizeDialog from "@/components/affiliate/HowToMonetizeDialog";

const CODE_REGEX = /^[a-zA-Z0-9_-]{4,32}$/;
const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");

interface AffiliateHistoryEntry {
  id: string;
  createdAt: string;
  amountCents: number;
  level: number | null;
  referredUserId: string | null;
  eventType: string;
}

interface WithdrawalHistoryEntry {
  id: string;
  createdAt: string;
  amountCents: number;
  status: string;
  pixKeyMasked: string;
}

const Affiliate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalEarningsCents, setTotalEarningsCents] = useState(0);
  const [availableBalanceCents, setAvailableBalanceCents] = useState(0);
  const [history, setHistory] = useState<AffiliateHistoryEntry[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showInternationalDialog, setShowInternationalDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const refreshBalance = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
    if (profile) setAvailableBalanceCents(Math.round((profile.balance ?? 0) * 100));

    const { data: withdrawals } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "pix_withdraw")
      .order("created_at", { ascending: false })
      .limit(20);

    if (withdrawals) {
      const entries: WithdrawalHistoryEntry[] = withdrawals.map((w) => ({
        id: w.id,
        createdAt: w.created_at,
        amountCents: Math.abs(Math.round((w.amount ?? 0) * 100)),
        status: w.status,
        pixKeyMasked: (w.metadata as Record<string, unknown>)?.pix_key_masked as string || "***",
      }));
      setWithdrawalHistory(entries);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);

      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("referral_code, affiliate_earnings, balance")
          .eq("id", session.user.id)
          .single();

        if (profileError) throw profileError;

        setCode(profile?.referral_code ?? "");
        setTotalEarningsCents(profile?.affiliate_earnings ?? 0);
        setAvailableBalanceCents(Math.round((profile?.balance ?? 0) * 100));

        const { count: referralCount } = await supabase
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("referrer_id", session.user.id);

        setTotalReferrals(referralCount ?? 0);

        const { data: logs } = await supabase
          .from("affiliate_logs")
          .select("*")
          .or(`direct_referrer.eq.${session.user.id},root_creator.eq.${session.user.id}`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (logs) {
          const historyEntries: AffiliateHistoryEntry[] = logs.map((log) => {
            const isDirectReferrer = log.direct_referrer === session.user.id;
            return {
              id: log.id,
              createdAt: log.created_at ?? new Date().toISOString(),
              amountCents: isDirectReferrer ? (log.amount_direct ?? 0) : (log.amount_root ?? 0),
              level: isDirectReferrer ? 1 : 2,
              referredUserId: log.new_user,
              eventType: log.event_type,
            };
          });
          setHistory(historyEntries);
        }

        const { data: withdrawals } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("type", "pix_withdraw")
          .order("created_at", { ascending: false })
          .limit(20);

        if (withdrawals) {
          const withdrawalEntries: WithdrawalHistoryEntry[] = withdrawals.map((w) => ({
            id: w.id,
            createdAt: w.created_at,
            amountCents: Math.abs(Math.round((w.amount ?? 0) * 100)),
            status: w.status,
            pixKeyMasked: (w.metadata as Record<string, unknown>)?.pix_key_masked as string || "***",
          }));
          setWithdrawalHistory(withdrawalEntries);
        }

        setError(null);
      } catch (err) {
        console.error("[affiliate] load error", err);
        setError(t.affiliate.errorLoading);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, t]);

  const handleSaveCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast({ title: t.affiliate.codeRequired, description: t.affiliate.defineCode, variant: "destructive" });
      return;
    }

    if (!CODE_REGEX.test(trimmed)) {
      toast({ title: t.affiliate.invalidFormat, description: t.affiliate.formatHint, variant: "destructive" });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_code", trimmed)
        .neq("id", user?.id ?? "")
        .maybeSingle();

      if (existing) {
        setError(t.affiliate.codeInUseDesc);
        toast({ title: t.affiliate.codeInUse, description: t.affiliate.codeInUseDesc, variant: "destructive" });
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase.from("profiles").update({ referral_code: trimmed }).eq("id", user?.id ?? "");
      if (updateError) throw updateError;

      setCode(trimmed);
      toast({ title: t.affiliate.codeSaved, description: t.affiliate.codeUpdated });
    } catch (err) {
      console.error("[affiliate] save code error", err);
      setError(t.affiliate.errorLoading);
      toast({ title: t.affiliate.errorSavingCode, description: t.affiliate.errorLoading, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast({ title: t.affiliate.defineCodeFirst, description: t.affiliate.saveCodeFirst, variant: "destructive" });
      return;
    }

    const link = `${siteUrl}/subscribe?ref=${trimmed}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        toast({ title: t.affiliate.linkCopied, description: t.affiliate.linkCopiedToClipboard });
        return;
      }
      throw new Error("Clipboard API unavailable");
    } catch {
      toast({ title: t.affiliate.copyManually, description: link, variant: "default" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t.common.loading}</div>
      </div>
    );
  }

  const referralLink = `${siteUrl}/subscribe?ref=${code || "YOUR-CODE"}`;

  return (
    <AppLayout showSidebar={false}>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">{t.nav.finances}</h1>
          </div>
          
          {/* Action buttons - responsive grid */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => setShowWithdrawDialog(true)} 
                className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm px-2 sm:px-4" 
                disabled={availableBalanceCents <= 0}
              >
                <Banknote className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">{t.affiliate.withdrawViaPix}</span>
              </Button>
              <Button 
                onClick={() => setShowInternationalDialog(true)} 
                variant="outline" 
                className="border-primary/50 text-xs sm:text-sm px-2 sm:px-4" 
                disabled={availableBalanceCents <= 0}
              >
                <Globe className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">{t.affiliate.bankTransferShort || "Transferência"}</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">PIX apenas para contas brasileiras</p>
          </div>
        </div>

        {error && <div className="mb-6 text-destructive text-sm">{error}</div>}

        <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-3 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">{t.affiliate.totalReferrals}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="text-2xl sm:text-3xl font-bold">{totalReferrals}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">{t.affiliate.commissionsEarned}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <span className="text-2xl sm:text-3xl font-bold">{formatBRL(totalEarningsCents)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">{t.affiliate.availableBalance}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="text-2xl sm:text-3xl font-bold">{formatBRL(availableBalanceCents)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 sm:mb-8">
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="truncate">{t.affiliate.createReferralCode}</span>
                </CardTitle>
                <HowToMonetizeDialog />
              </div>
              <div className="animate-pulse">
                <CardDescription className="text-xs sm:text-sm text-foreground" style={{ textShadow: '0 0 8px hsl(var(--foreground) / 0.5)' }}>
                  {t.affiliate.createCodeDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex flex-col gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="YOUR-CODE" className="uppercase text-sm" />
              <Button onClick={handleSaveCode} disabled={saving} className="w-full sm:w-auto">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t.common.saving}</> : <><Save className="h-4 w-4 mr-2" /> {t.common.saveCode}</>}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Input value={referralLink} readOnly className="text-xs sm:text-sm" />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={handleCopyLink} className="w-full sm:w-auto">
                  <Copy className="h-4 w-4 mr-2" />
                  {t.common.copyLink}
                </Button>
                <Button type="button" variant="default" onClick={() => code.trim() ? setShowShareDialog(true) : toast({ title: t.affiliate.defineCodeFirst, variant: "destructive" })} className="w-full sm:w-auto gap-2">
                  <Share2 className="h-4 w-4" />
                  {t.common.shareLink}
                </Button>
              </div>
            </div>
            <div className="animate-pulse block">
              <p className="text-[10px] sm:text-xs md:text-sm leading-relaxed" style={{ color: 'hsl(var(--primary))', textShadow: '0 0 8px hsl(var(--primary))' }}>
                {t.affiliate.formatHint} <span className="text-destructive block sm:inline mt-1 sm:mt-0" style={{ color: 'hsl(var(--destructive))', textShadow: '0 0 8px hsl(var(--destructive))' }}>{t.affiliate.noSpaces || "e não faça uso de espaços."}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">{t.affiliate.referralHistory}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t.affiliate.trackReferrals}</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {history.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">{t.affiliate.noReferrals}</p>
                <p className="text-xs sm:text-sm">{t.affiliate.shareCodeStart}</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 sm:p-3 bg-secondary rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base truncate">{entry.eventType === "REGISTRATION" ? t.affiliate.newRegistration : entry.eventType}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-green-500 text-sm sm:text-base">+{formatBRL(entry.amountCents)}</p>
                      <p className="text-xs text-muted-foreground">{entry.level === 1 ? t.affiliate.direct : entry.level === 2 ? t.affiliate.grandfather : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 sm:mt-8">
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
              {t.affiliate.withdrawalHistory}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t.affiliate.trackWithdrawals}</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {withdrawalHistory.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Banknote className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">{t.affiliate.noWithdrawals}</p>
                <p className="text-xs sm:text-sm">{t.affiliate.trackWithdrawals}</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {withdrawalHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 sm:p-3 bg-secondary rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base">{t.affiliate.withdrawViaPix}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)} • {entry.pixKeyMasked}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-red-500 text-sm sm:text-base">-{formatBRL(entry.amountCents)}</p>
                      <p className={`text-xs ${entry.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {entry.status === 'completed' ? t.common.success : t.common.loading}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <PixWithdrawDialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog} userId={user?.id ?? ""} availableBalanceCents={availableBalanceCents} onSuccess={refreshBalance} />
      <InternationalWithdrawDialog open={showInternationalDialog} onOpenChange={setShowInternationalDialog} />
      <ShareDialog isOpen={showShareDialog} onClose={() => setShowShareDialog(false)} link={referralLink} title="Stream Star" />
    </AppLayout>
  );
};

export default Affiliate;
