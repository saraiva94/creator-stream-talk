import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Users, TrendingUp, Link as LinkIcon, Save, Loader2, Copy } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/siteUrl";

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
  const [error, setError] = useState<string | null>(null);

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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Programa de Afiliados</h1>
        </div>

        {error ? <div className="mb-6 text-destructive text-sm">{error}</div> : null}

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Total de Indicações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{totalReferrals}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Comissões Ganhas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-3xl font-bold">{formatBRL(totalEarningsCents)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Saldo Disponível</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{formatBRL(availableBalanceCents)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Código de indicação
            </CardTitle>
            <CardDescription>Defina ou personalize o código que seus convidados vão usar no cadastro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())} 
                placeholder="SEU-CODIGO" 
                className="sm:w-80 uppercase"
              />
              <Button onClick={handleSaveCode} disabled={saving}>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input value={referralLink} readOnly className="sm:w-80 text-sm" />
              <Button type="button" variant="outline" onClick={handleCopyLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use apenas letras, números, hífen ou underline. Compartilhe este código para que seus indicados recebam crédito
              e você ganhe comissão.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Indicações</CardTitle>
            <CardDescription>Acompanhe suas indicações e comissões</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Você ainda não indicou ninguém</p>
                <p className="text-sm">Compartilhe seu código e comece a ganhar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div>
                      <p className="font-semibold">{entry.eventType === "REGISTRATION" ? "Novo cadastro" : entry.eventType}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-500">+{formatBRL(entry.amountCents)}</p>
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
      </main>
    </div>
  );
};

export default Affiliate;