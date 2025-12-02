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
import { api, ApiError, type AffiliateHistoryEntry, type AffiliateStatsResponse } from "@/lib/api";
import { siteUrl } from "@/lib/siteUrl";

const CODE_REGEX = /^[a-zA-Z0-9_-]{4,32}$/;
const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;
const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");

const Affiliate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [stats, setStats] = useState<AffiliateStatsResponse | null>(null);
  const [history, setHistory] = useState<AffiliateHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      try {
        const [codeRes, statsRes, historyRes] = await Promise.all([
          api.affiliates.code(),
          api.affiliates.stats(),
          api.affiliates.history(),
        ]);

        setCode(codeRes.code ?? "");
        setStats(statsRes);
        setHistory(historyRes ?? []);
        setError(null);
      } catch (err) {
        console.error("[affiliate] load error", err);
        const message = err instanceof ApiError ? err.message : "Não foi possível carregar seus dados de afiliado.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const handleSaveCode = async () => {
    const trimmed = code.trim();
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
      const response = await api.affiliates.saveCode(trimmed);
      setCode(response.code);
      toast({ title: "Código salvo", description: "Seu código de indicação foi atualizado." });
    } catch (err) {
      console.error("[affiliate] save code error", err);
      const message =
        err instanceof ApiError && err.status === 409
          ? "Este código já está em uso. Tente outro."
          : err instanceof ApiError
            ? err.message
            : "Não foi possível salvar o código agora.";
      setError(message);
      toast({ title: "Erro ao salvar código", description: message, variant: "destructive" });
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

    const link = `${siteUrl}/auth?ref=${trimmed}`;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        toast({ title: "Link copiado", description: "Link copiado para a área de transferência." });
        return;
      }

      if (typeof document !== "undefined" && typeof document.execCommand === "function") {
        const temp = document.createElement("input");
        temp.value = link;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        toast({ title: "Link copiado", description: "Link copiado para a área de transferência." });
        return;
      }

      throw new Error("Clipboard API indisponível");
    } catch (err) {
      console.error("[affiliate] copy link error", err);
      toast({
        title: "Não foi possível copiar automaticamente",
        description: `Copie manualmente: ${link}`,
        variant: "destructive",
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

  const referralLink = `${siteUrl}/auth?ref=${code || ""}`;

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
                <span className="text-3xl font-bold">{stats?.totalReferrals ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Comissões Ganhas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="text-3xl font-bold">
                  {stats ? formatBRL(stats.totalEarningsCents) : "R$ 0,00"}
                </span>
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
                <span className="text-3xl font-bold">
                  {stats ? formatBRL(stats.availableBalanceCents) : "R$ 0,00"}
                </span>
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
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="seu-codigo" className="sm:w-80" />
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
              <Input value={referralLink} readOnly className="sm:w-80" />
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
                      <p className="font-semibold">{entry.referredUserId ?? "Novo usuário"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">+{formatBRL(entry.amountCents)}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {entry.level ? `Nível ${entry.level}` : "Direto"}
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
