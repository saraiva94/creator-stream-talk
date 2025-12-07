import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Users, TrendingUp, Link as LinkIcon, Save, Loader2, Copy, Banknote, Wallet } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/siteUrl";
import PixWithdrawDialog from "@/components/PixWithdrawDialog";


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
  

  const refreshBalance = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();
    
    if (profile) {
      setAvailableBalanceCents(Math.round((profile.balance ?? 0) * 100));
    }

    // Also refresh withdrawal history
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

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      
      
      try {
        // Load profile to get referral code and affiliate earnings
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("referral_code, affiliate_earnings, balance")
          .eq("id", session.user.id)
          .single();

        if (profileError) throw profileError;

        setCode(profile?.referral_code ?? "");
        setTotalEarningsCents(profile?.affiliate_earnings ?? 0);
        setAvailableBalanceCents(Math.round((profile?.balance ?? 0) * 100));

        // Count total referrals
        const { count: referralCount } = await supabase
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("referrer_id", session.user.id);

        setTotalReferrals(referralCount ?? 0);

        // Load affiliate history
        const { data: logs, error: logsError } = await supabase
          .from("affiliate_logs")
          .select("*")
          .or(`direct_referrer.eq.${session.user.id},root_creator.eq.${session.user.id}`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!logsError && logs) {
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

        // Load withdrawal history
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
        setError("Não foi possível carregar seus dados de afiliado.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const handleSaveCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast({ title: "Código obrigatório", description: "Defina um código de indicação.", variant: "destructive" });
      return;
    }

    if (!CODE_REGEX.test(trimmed)) {
      toast({
        title: "Formato inválido",
        description: "Use 4-32 caracteres, letras, números, hífen ou underscore.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      // Check if code is already in use by another user
      const { data: existing, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_code", trimmed)
        .neq("id", user?.id ?? "")
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setError("Este código já está em uso. Tente outro.");
        toast({ title: "Código em uso", description: "Este código já está em uso. Tente outro.", variant: "destructive" });
        setSaving(false);
        return;
      }

      // Update profile with new code
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ referral_code: trimmed })
        .eq("id", user?.id ?? "");

      if (updateError) throw updateError;

      setCode(trimmed);
      toast({ title: "Código salvo", description: "Seu código de indicação foi atualizado." });
    } catch (err) {
      console.error("[affiliate] save code error", err);
      setError("Não foi possível salvar o código agora.");
      toast({ title: "Erro ao salvar código", description: "Não foi possível salvar o código agora.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast({
        title: "Defina o código primeiro",
        description: "Salve um código de indicação antes de copiar o link.",
        variant: "destructive",
      });
      return;
    }

    const link = `${siteUrl}/subscribe?ref=${trimmed}`;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        toast({ title: "Link copiado!", description: "Link copiado para a área de transferência." });
        return;
      }

      if (typeof document !== "undefined" && typeof document.execCommand === "function") {
        const temp = document.createElement("input");
        temp.value = link;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        toast({ title: "Link copiado!", description: "Link copiado para a área de transferência." });
        return;
      }

      throw new Error("Clipboard API indisponível");
    } catch (err) {
      console.error("[affiliate] copy link error", err);
      toast({
        title: "Copie manualmente",
        description: link,
        variant: "default",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const referralLink = `${siteUrl}/subscribe?ref=${code || "seu-codigo"}`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">Finanças</h1>
          </div>
          <Button 
            onClick={() => setShowWithdrawDialog(true)}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            disabled={availableBalanceCents <= 0}
          >
            <Banknote className="h-4 w-4 mr-2" />
            Sacar via PIX
          </Button>
        </div>

        {error ? <div className="mb-6 text-destructive text-sm">{error}</div> : null}


        <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-3 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">Total de Indicações</CardTitle>
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
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">Comissões Ganhas</CardTitle>
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
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">Saldo Disponível</CardTitle>
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
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              Criar código de indicação
            </CardTitle>
            <CardDescription 
              className="text-xs sm:text-sm animate-pulse text-foreground" 
              style={{ textShadow: '0 0 8px hsl(var(--foreground) / 0.5)' }}
            >
              Crie seu link personalizado e comece a ganhar já, cada cadastro conta e você pode sacar na hora!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex flex-col gap-2">
              <Input 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())} 
                placeholder="SEU-CODIGO" 
                className="uppercase text-sm"
              />
              <Button onClick={handleSaveCode} disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Salvar código
                  </>
                )}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Input value={referralLink} readOnly className="text-xs sm:text-sm" />
              <Button type="button" variant="outline" onClick={handleCopyLink} className="w-full sm:w-auto">
                <Copy className="h-4 w-4 mr-2" />
                Copiar link
              </Button>
            </div>
            <p 
              className="text-xs sm:text-sm animate-pulse" 
              style={{ color: 'hsl(var(--primary))', textShadow: '0 0 8px hsl(var(--primary))' }}
            >
              Use apenas letras, números, hífen ou underline. Compartilhe este código para que seus indicados recebam crédito
              e você ganhe comissão.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Histórico de Indicações</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Acompanhe suas indicações e comissões</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {history.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">Você ainda não indicou ninguém</p>
                <p className="text-xs sm:text-sm">Compartilhe seu código e comece a ganhar.</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 sm:p-3 bg-secondary rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base truncate">{entry.eventType === "REGISTRATION" ? "Novo cadastro" : entry.eventType}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-green-500 text-sm sm:text-base">+{formatBRL(entry.amountCents)}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.level === 1 ? "Direto" : entry.level === 2 ? "Avô" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal History */}
        <Card className="mt-6 sm:mt-8">
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
              Histórico de Saques PIX
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Acompanhe seus saques realizados</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {withdrawalHistory.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Banknote className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm sm:text-base">Nenhum saque realizado</p>
                <p className="text-xs sm:text-sm">Seus saques PIX aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {withdrawalHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 sm:p-3 bg-secondary rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base">Saque PIX</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)} • {entry.pixKeyMasked}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-red-500 text-sm sm:text-base">-{formatBRL(entry.amountCents)}</p>
                      <p className={`text-xs ${entry.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {entry.status === 'completed' ? 'Concluído' : 'Processando'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <PixWithdrawDialog
        open={showWithdrawDialog}
        onOpenChange={setShowWithdrawDialog}
        userId={user?.id ?? ""}
        availableBalanceCents={availableBalanceCents}
        onSuccess={refreshBalance}
      />
    </div>
  );
};

export default Affiliate;
