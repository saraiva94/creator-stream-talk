import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link } from "lucide-react";

type Overview = {
  totalEarningsCents: number;
  availableBalanceCents: number;
  totalReferrals: number;
  directReferrals: number;
  indirectReferrals: number;
};

type HistoryItem = {
  id: string;
  createdAt: string;
  amountCents: number;
  level: number | null;
  referredUserId: string | null;
};

type LinkPayload = {
  code: string;
  url: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const backendBase = import.meta.env.VITE_BACKEND_URL ?? "";

const getAuthHeaders = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;
const formatDate = (value: string) => new Date(value).toLocaleString();

const useAffiliateData = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [link, setLink] = useState<LinkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      };

      const [overviewRes, historyRes, linkRes] = await Promise.all([
        fetch(`${backendBase}/affiliate/overview`, { headers }),
        fetch(`${backendBase}/affiliate/history`, { headers }),
        fetch(`${backendBase}/affiliate/link`, { headers }),
      ]);

      const overviewBody = (await overviewRes.json()) as ApiResponse<Overview>;
      if (!overviewRes.ok || !overviewBody.success || !overviewBody.data) {
        throw new Error(overviewBody.error || "Erro ao carregar visão geral");
      }
      setOverview(overviewBody.data);

      const historyBody = (await historyRes.json()) as ApiResponse<HistoryItem[]>;
      if (!historyRes.ok || !historyBody.success || !historyBody.data) {
        throw new Error(historyBody.error || "Erro ao carregar histórico");
      }
      setHistory(historyBody.data);

      const linkBody = (await linkRes.json()) as ApiResponse<LinkPayload>;
      if (!linkRes.ok || !linkBody.success || !linkBody.data) {
        throw new Error(linkBody.error || "Erro ao carregar link de afiliado");
      }
      setLink(linkBody.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return { overview, history, link, loading, error, reload: loadAll };
};

const AffiliateHistoryTable = ({ history }: { history: HistoryItem[] }) => {
  if (history.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-6 text-muted-foreground">Você ainda não recebeu comissões.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Histórico de comissões</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Valor</th>
              <th className="py-2 pr-3">Nível</th>
              <th className="py-2 pr-3">Referido</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="border-t border-border/60">
                <td className="py-2 pr-3">{formatDate(item.createdAt)}</td>
                <td className="py-2 pr-3">{formatBRL(item.amountCents)}</td>
                <td className="py-2 pr-3">{item.level ?? "-"}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">{item.referredUserId ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export const AffiliateDashboardPanel = () => {
  const { overview, history, link, loading, error, reload } = useAffiliateData();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Afiliados</h2>
        <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Total ganho</p>
            <p className="text-2xl font-semibold">
              {loading || !overview ? "..." : formatBRL(overview.totalEarningsCents)}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-semibold">
              {loading || !overview ? "..." : formatBRL(overview.availableBalanceCents)}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Total de indicados</p>
            <p className="text-2xl font-semibold">
              {loading || !overview ? "..." : overview.totalReferrals}
            </p>
            {overview && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-400">{overview.directReferrals} Direto</span>
                {" • "}
                <span className="text-yellow-400">{overview.indirectReferrals} Indireto</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link className="h-4 w-4" /> Link de afiliado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={link?.url ?? ""} placeholder="Carregando link..." />
            <Button onClick={copyLink} disabled={!link?.url} variant="secondary">
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Compartilhe este link para ganhar comissões dos seus indicados.</p>
        </CardContent>
      </Card>

      <AffiliateHistoryTable history={history} />
    </div>
  );
};

export default AffiliateDashboardPanel;
