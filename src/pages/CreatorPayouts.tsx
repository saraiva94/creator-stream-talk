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

const getCurrentUserId = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;
  if (!userId) throw new Error("Autenticação necessária");
  return userId;
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
      const creatorId = await getCurrentUserId();

      const { data: rows, error } = await supabase
        .from("creator_earnings")
        .select(
          "id, live_id, credits_consumed, gross_amount_cents, creator_amount_cents, platform_amount_cents, status, settled_at, created_at",
        )
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      const liveIds = Array.from(new Set((rows ?? []).map((r) => r.live_id)));
      const { data: lives } = liveIds.length
        ? await supabase.from("lives").select("id, title, created_at").in("id", liveIds)
        : { data: [] as any[] };

      const liveMap = new Map((lives ?? []).map((l: any) => [l.id, l]));

      setEarnings(
        (rows ?? []).map((row: any) => {
          const live = liveMap.get(row.live_id);
          return {
            id: row.id,
            liveId: row.live_id,
            liveTitle: live?.title ?? null,
            liveCreatedAt: live?.created_at ?? row.created_at ?? null,
            creditsConsumed: Number(row.credits_consumed ?? 0),
            grossCents: Number(row.gross_amount_cents ?? 0),
            netCents: Number(row.creator_amount_cents ?? 0),
            platformCents: Number(row.platform_amount_cents ?? 0),
            status: row.status ?? "pending",
            settledAt: row.settled_at ?? null,
          } as EarningRow;
        }),
      );
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
      const creatorId = await getCurrentUserId();

      const { data: rows, error } = await supabase
        .from("payout_requests")
        .select("id, amount, status, created_at, pix_key, source_type")
        .eq("creator_id", creatorId)
        .eq("source_type", "creator")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      setPayouts(
        (rows ?? []).map((row: any) => ({
          id: row.id,
          amountCents: Number(row.amount ?? 0),
          status: row.status ?? "pending",
          createdAt: row.created_at,
          pixKey: row.pix_key ?? null,
        })),
      );
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
              Solicite saques via PIX e acompanhe seu histórico de pagamentos. Taxa: R$ 5,00 por saque.
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
