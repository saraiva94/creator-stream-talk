import { useEffect, useMemo, useState } from "react";
import PayoutsSummary from "@/components/creator/payouts/PayoutsSummary";
import PayoutsTable from "@/components/creator/payouts/PayoutsTable";
import CreatorWalletPanel from "@/components/creator/wallet/CreatorWalletPanel";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type EarningRow = {
  id: string;
  liveId: string;
  liveTitle: string | null;
  liveCreatedAt: string | null;
  creditsConsumed: number;
  grossCents: number;
  netCents: number;
  platformCents: number;
  status: string;
  settledAt: string | null;
};

type WalletSummary = {
  balance_cents: number;
  pending_cents: number;
};

type PayoutRow = {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
  pixKey?: string | null;
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

const CreatorPayouts = () => {
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  const [earningsError, setEarningsError] = useState<string | null>(null);

  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [isLoadingPayouts, setIsLoadingPayouts] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);

  const fetchEarnings = async () => {
    setIsLoadingEarnings(true);
    setEarningsError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      };
      const res = await fetch(`${backendBase}/creator/earnings`, { headers });
      const body = (await res.json()) as ApiResponse<EarningRow[]>;
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || "Nao foi possivel carregar o historico de ganhos");
      }
      setEarnings(body.data ?? []);
    } catch (err) {
      setEarningsError((err as Error).message);
    } finally {
      setIsLoadingEarnings(false);
    }
  };

  const fetchPayoutHistory = async () => {
    setIsLoadingPayouts(true);
    setPayoutsError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      };
      const res = await fetch(`${backendBase}/withdrawals/history`, { headers });
      const body = (await res.json()) as ApiResponse<{ payouts: PayoutRow[] }>;
      if (!res.ok || !body?.success || !body.data) {
        throw new Error(body?.error || "Nao foi possivel carregar o historico de saques");
      }
      setPayouts(body.data.payouts ?? []);
    } catch (err) {
      setPayoutsError((err as Error).message);
    } finally {
      setIsLoadingPayouts(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
    fetchPayoutHistory();
  }, []);

  const summaryData = useMemo(
    () => ({
      balance: (walletSummary?.balance_cents ?? 0) / 100,
      pending: (walletSummary?.pending_cents ?? 0) / 100,
      paid:
        payouts
          .filter((payout) => payout.status?.toLowerCase() === "paid")
          .reduce((sum, payout) => sum + payout.amountCents, 0) / 100,
    }),
    [walletSummary, payouts],
  );

  const payoutTableRows = useMemo(
    () =>
      payouts.map((payout) => {
        const normalizedStatus = (payout.status ?? "pending").toLowerCase();
        const statusForUi =
          normalizedStatus === "cancelled"
            ? "cancelled"
            : normalizedStatus === "approved"
              ? "approved"
              : normalizedStatus === "paid"
                ? "paid"
                : normalizedStatus === "rejected"
                  ? "rejected"
                  : "pending";

        return {
          id: payout.id,
          amount: payout.amountCents / 100,
          status: statusForUi as "pending" | "approved" | "paid" | "rejected" | "cancelled",
          requestedAt: payout.createdAt,
          pixKey: payout.pixKey,
        };
      }),
    [payouts],
  );

  const handleWalletUpdate = (next: WalletSummary) => {
    setWalletSummary(next);
  };

  const handleWithdrawalSuccess = (next: WalletSummary) => {
    setWalletSummary(next);
    fetchPayoutHistory();
  };

  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;
  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payouts</h1>
            <p className="text-muted-foreground text-sm">
              Solicite saques via PIX sem taxa e acompanhe seu historico de pagamentos.
            </p>
          </div>
        </div>

        <CreatorWalletPanel onWalletUpdate={handleWalletUpdate} onWithdrawalSuccess={handleWithdrawalSuccess} />

        <PayoutsSummary summary={summaryData} isLoading={!walletSummary} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Historico de saques</h2>
            <Button variant="ghost" size="sm" onClick={fetchPayoutHistory} disabled={isLoadingPayouts}>
              {isLoadingPayouts ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>

          {payoutsError && (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{payoutsError}</AlertDescription>
            </Alert>
          )}

          {isLoadingPayouts && payoutTableRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Carregando solicitacoes...</div>
          ) : payoutTableRows.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-6 text-muted-foreground">Nenhuma solicitacao de saque encontrada.</CardContent>
            </Card>
          ) : (
            <PayoutsTable payouts={payoutTableRows} />
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Historico de ganhos</h2>
            <Button variant="ghost" size="sm" onClick={fetchEarnings} disabled={isLoadingEarnings}>
              {isLoadingEarnings ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>

          {earningsError && (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{earningsError}</AlertDescription>
            </Alert>
          )}

          {isLoadingEarnings && earnings.length === 0 ? (
            <div className="text-sm text-muted-foreground">Carregando historico de ganhos...</div>
          ) : earnings.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-6 text-muted-foreground">Voce ainda nao tem ganhos acumulados.</CardContent>
            </Card>
          ) : (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg">Ganhos por live</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Live</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Creditos</th>
                      <th className="py-2 pr-3">Bruto</th>
                      <th className="py-2 pr-3">Liquido</th>
                      <th className="py-2 pr-3">Plataforma</th>
                      <th className="py-2 pr-3">Liquidado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((item) => (
                      <tr key={item.id} className="border-t border-border/60">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{item.liveTitle || "Live"}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(item.liveCreatedAt)}</div>
                        </td>
                        <td className="py-2 pr-3 capitalize">{item.status}</td>
                        <td className="py-2 pr-3">{item.creditsConsumed}</td>
                        <td className="py-2 pr-3">{formatBRL(item.grossCents)}</td>
                        <td className="py-2 pr-3">{formatBRL(item.netCents)}</td>
                        <td className="py-2 pr-3">{formatBRL(item.platformCents)}</td>
                        <td className="py-2 pr-3">{formatDate(item.settledAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
};

export default CreatorPayouts;
