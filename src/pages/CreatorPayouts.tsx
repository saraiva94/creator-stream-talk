import { useEffect, useState } from "react";
import PayoutsSummary from "@/components/creator/payouts/PayoutsSummary";
import PayoutsTable from "@/components/creator/payouts/PayoutsTable";
import CreatorWalletPanel from "@/components/creator/wallet/CreatorWalletPanel";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const CreatorPayouts = () => {
  const summary = { balance: 820.5, pending: 210.0, paid: 3400.75 };
  const payouts = [
    { id: "p1", amount: 150.0, status: "pending" as const, requestedAt: "2024-11-06T12:00:00Z" },
    { id: "p2", amount: 320.0, status: "approved" as const, requestedAt: "2024-11-02T09:30:00Z" },
    { id: "p3", amount: 200.5, status: "paid" as const, requestedAt: "2024-10-28T16:15:00Z" },
  ];

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

  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendBase = import.meta.env.VITE_BACKEND_URL ?? "";

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchEarnings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      };
      const res = await fetch(`${backendBase}/creator/earnings`, { headers });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || "Não foi possível carregar o histórico de ganhos");
      }
      setEarnings(body.data ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

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
            <p className="text-muted-foreground text-sm">Mock para testes de UI.</p>
          </div>
        </div>

        <CreatorWalletPanel />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Histórico de ganhos</h2>
            <Button variant="ghost" size="sm" onClick={fetchEarnings} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && earnings.length === 0 ? (
            <div className="text-sm text-muted-foreground">Carregando histórico de ganhos...</div>
          ) : earnings.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-6 text-muted-foreground">Você ainda não tem ganhos acumulados.</CardContent>
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
                      <th className="py-2 pr-3">Créditos</th>
                      <th className="py-2 pr-3">Bruto</th>
                      <th className="py-2 pr-3">Líquido</th>
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

        <PayoutsSummary summary={summary} />

        <PayoutsTable payouts={payouts} />
      </main>
    </div>
  );
};

export default CreatorPayouts;
