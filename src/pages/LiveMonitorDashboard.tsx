import ActiveLivesTable from "@/components/live-monitor/ActiveLivesTable";
import LiveAlertsPanel from "@/components/live-monitor/LiveAlertsPanel";
import LiveStatusBadge from "@/components/live-monitor/LiveStatusBadge";
import RecentLivesTable from "@/components/live-monitor/RecentLivesTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveMonitor } from "@/hooks/useLiveMonitor";
import { AlertTriangle, Activity, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LiveMonitorDashboard = () => {
  const { data, summary, isLoading, isFetching } = useLiveMonitor();

  const summaryItems = [
    {
      label: "Ativas",
      value: summary.active,
      icon: <Activity className="h-4 w-4 text-primary" />,
      helper: "Lives com is_active=true",
    },
    {
      label: "Encerradas hoje",
      value: summary.endedToday,
      icon: <History className="h-4 w-4 text-primary" />,
      helper: "Lives com ended_at na data atual",
    },
    {
      label: "Alertas",
      value: summary.alerts,
      icon: <AlertTriangle className="h-4 w-4 text-primary" />,
      helper: "Eventos do monitor-lives",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Monitor de Lives</h1>
              <p className="text-muted-foreground">
                Acompanhe lives ativas, encerramentos recentes e alertas do monitor-lives.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Fonte: lives / live_heartbeat / live_end_log</Badge>
            {isFetching && <span>Atualizando…</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {summaryItems.map((item) => (
            <Card key={item.label} className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                {item.icon}
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-7 w-10" /> : <div className="text-2xl font-bold">{item.value}</div>}
                <CardDescription className="mt-1 text-muted-foreground">{item.helper}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lives ativas</CardTitle>
            <CardDescription>Conferência em tempo quase real (atualiza a cada 15s)</CardDescription>
          </CardHeader>
          <CardContent>
            <ActiveLivesTable lives={data?.activeLives ?? []} isLoading={isLoading && !data} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Últimas encerradas</CardTitle>
                <CardDescription>Últimas 10 lives encerradas nas últimas 48h</CardDescription>
              </CardHeader>
              <CardContent>
                <RecentLivesTable lives={data?.recentLives ?? []} isLoading={isLoading && !data} />
              </CardContent>
            </Card>
          </div>
          <LiveAlertsPanel alerts={data?.alerts ?? []} isLoading={isLoading && !data} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
            <CardDescription>
              Dados provenientes do monitor-lives (Edge Function) e tabelas live_heartbeat/live_end_log.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Polling automático via React Query a cada 15 segundos.</p>
            <p>Os status exibem valores armazenados em lives.status.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LiveMonitorDashboard;
