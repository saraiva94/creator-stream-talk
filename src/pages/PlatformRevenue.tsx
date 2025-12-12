import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import RevenueSummaryCards from "@/components/revenue/RevenueSummaryCards";
import RevenueBreakdownChart from "@/components/revenue/RevenueBreakdownChart";
import RevenueFilters from "@/components/revenue/RevenueFilters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlatformRevenue } from "@/hooks/usePlatformRevenue";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

const PlatformRevenue = () => {
  const { range, setRange, data, isLoading, isFetching } = usePlatformRevenue();

  const summary = useMemo(
    () => ({
      grossRevenue: data?.summary.grossRevenue ?? 0,
      platformCut: data?.summary.platformCut ?? 0,
      creatorPayouts: data?.summary.creatorPayouts ?? 0,
    }),
    [data],
  );

  return (
    <AppLayout showSidebar={false}>
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Receita da Plataforma</h1>
              <p className="text-muted-foreground">Acompanhe o desempenho financeiro agregado.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Fonte: platform_revenue / payments / withdrawals</Badge>
            {isFetching && <span>Atualizando…</span>}
          </div>
        </div>

        <RevenueFilters value={range} onChange={setRange} />

        <RevenueSummaryCards
          grossRevenue={summary.grossRevenue}
          platformCut={summary.platformCut}
          creatorPayouts={summary.creatorPayouts}
          isLoading={isLoading && !data}
        />

        <RevenueBreakdownChart data={data?.series ?? []} isLoading={isLoading && !data} />

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
            <CardDescription>
              Os valores de plataforma consideram somas da tabela platform_revenue; pagamentos brutos vêm de payments (status
              aprovado/completed/paid/succeeded); saques aprovados/pagos representam payouts.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Filtros de tempo aplicam-se a todas as consultas.</p>
            <p>Os dados são calculados no cliente a partir das entradas retornadas pelo Supabase.</p>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
};

export default PlatformRevenue;
